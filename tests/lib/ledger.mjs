// The eval results ledger: one JSON row per case, query or persona per run, appended by every
// runner, never deleted. evals/ledger/ledger.jsonl is committed with the repository.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const LEDGER = path.join(ROOT, 'evals', 'ledger', 'ledger.jsonl');
export const FAILURE_CLASSES = ['skill', 'grader', 'fixture', 'host-flake', 'model-drift'];

export function gitSha() {
  const r = spawnSync('git', ['-C', ROOT, 'rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}
export function skillVersion() {
  const text = fs.readFileSync(path.join(ROOT, 'skills', 'career-profiler', 'SKILL.md'), 'utf8');
  const m = /^\s+version:\s*"?([0-9][^"\s]*)"?/m.exec(text);
  return m ? m[1] : '0.0.0';
}
/** What a result row was produced against: the shipped skill, the eval cases (not the ledger), the
 * personas, the simulator and the two runners. Committing ledger rows or docs does not change it, so the
 * release gate can match rows to the tree they tested even after the rows themselves are committed. */
export const SUBJECT_PATHS = ['skills/career-profiler', 'evals', 'tests/live', 'tests/run-evals.mjs', 'tests/run-trigger-set.mjs'];
// release.md is the maintainers' release checklist; no case reads it, so editing it re-runs nothing.
const NOT_TESTED = (f) => f.startsWith('evals/ledger/') || /(^|\/)results\//.test(f); // the whole-tree subject, as recorded in rows
const IGNORED = (f) => NOT_TESTED(f) || f === 'skills/career-profiler/references/release.md'; // per-item hashes

/** The paths one result row depends on: the skill, its runner, and its own case, query set or persona. */
export function itemPaths(runner, item) {
  // release.md is the maintainers' release checklist; no case reads it, so editing it re-runs nothing.
  const base = ['skills/career-profiler'];
  if (runner === 'plugin-eval') return [...base, `evals/${item}`, 'tests/run-evals.mjs'];
  if (runner === 'pipeline-sim') return [...base, 'evals/scripts-pipeline', 'tests/live/pipeline-sim.mjs'];
  if (runner === 'trigger-set') return [...base, 'evals/trigger-set.json', 'tests/run-trigger-set.mjs'];
  if (runner === 'interview-sim') return [...base, 'tests/live/interview-sim.mjs', `tests/live/personas/${item}.json`];
  return SUBJECT_PATHS;
}
const itemCache = new Map();
/** Hash of exactly what one row tested; a fix to one case invalidates only that case's rows. */
export function itemSubject(runner, item, root = ROOT) {
  const k = `${runner}|${item}`;
  if (!itemCache.has(k)) itemCache.set(k, subjectHash(root, itemPaths(runner, item)));
  return itemCache.get(k);
}
/** The same hash as subjectHash, computed from a commit instead of the work tree (git objects only). */
const commitCache = new Map();
export function subjectHashAtCommit(sha, paths = SUBJECT_PATHS, root = ROOT, skip = paths === SUBJECT_PATHS ? NOT_TESTED : IGNORED) {
  const key = `${sha}|${paths.join(',')}|${skip === IGNORED}`;
  if (commitCache.has(key)) return commitCache.get(key);
  let out = null;
  const ls = spawnSync('git', ['-C', root, 'ls-tree', '-r', '-z', sha, '--', ...paths], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (ls.status === 0) {
    const entries = ls.stdout.split('\0').filter(Boolean).map((l) => { const [meta, f] = l.split('\t'); return { f, id: meta.split(' ')[2] }; })
      .filter((e) => !skip(e.f)).sort((a, b) => (a.f < b.f ? -1 : a.f > b.f ? 1 : 0));
    const h = createHash('sha256');
    for (const e of entries) {
      const b = spawnSync('git', ['-C', root, 'cat-file', 'blob', e.id], { maxBuffer: 64 * 1024 * 1024 });
      if (b.status !== 0) continue;
      h.update(e.f); h.update('\0'); h.update(createHash('sha256').update(b.stdout).digest('hex')); h.update('\n');
    }
    out = h.digest('hex').slice(0, 16);
  }
  commitCache.set(key, out);
  return out;
}

/** What a row tested. A row whose recorded subject equals the tree hash at its recorded commit (it ran on
 * committed files) is hashed from that commit with today's item paths; otherwise its stored item_subject is
 * used, and a row with neither does not count. */
export function rowItemSubject(r, root = ROOT) {
  // Verified against its commit: hash what it tested at that commit with today's definition of "what it tested".
  if (r.git_sha && r.subject && subjectHashAtCommit(r.git_sha, SUBJECT_PATHS, root) === r.subject) return subjectHashAtCommit(r.git_sha, itemPaths(r.runner, r.item), root);
  return r.item_subject || null;
}

export function subjectHash(root = ROOT, paths = SUBJECT_PATHS, skip = paths === SUBJECT_PATHS ? NOT_TESTED : IGNORED) {
  const r = spawnSync('git', ['-C', root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', ...paths], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const files = r.stdout.split('\0').filter((f) => f && !skip(f)).sort();
  const h = createHash('sha256');
  for (const f of files) {
    let body;
    try { body = fs.readFileSync(path.join(root, f)); } catch { continue; } // deleted in the work tree
    h.update(f); h.update('\0'); h.update(createHash('sha256').update(body).digest('hex')); h.update('\n');
  }
  return h.digest('hex').slice(0, 16);
}

// Captured when a runner starts, so rows name the tree the run actually used even if files change meanwhile.
export const SUBJECT_AT_START = subjectHash();

export function claudeVersion() {
  const r = spawnSync('claude', ['--version'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim().split(/\s+/)[0] : null;
}

/** Append rows; every row gets at, git_sha, skill_version and claude_version. Returns the rows written. */
export function appendRows(rows, { file = LEDGER } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const base = { at: new Date().toISOString(), git_sha: gitSha(), subject: SUBJECT_AT_START, skill_version: skillVersion(), claude_version: claudeVersion() };
  const out = rows.map((r) => ({ ...base, ...(r.runner && r.runner !== 'triage' ? { item_subject: itemSubject(r.runner, r.item) } : {}), ...r }));
  fs.appendFileSync(file, out.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return out;
}

export function readRows(file = LEDGER) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
}

/** Result rows only (triage rows classify a result and are not results themselves). */
export const isResult = (r) => r.runner !== 'triage';
/** A run the host refused (usage window, out of credits, rate limit, API error): nothing was graded, so it is
 * neither a pass nor a fail and never supersedes an earlier graded run. */
export const isRefusal = (r) => r.passed !== true && /hit your .{0,20}limit|usage credits|rate limit|api error|judge call failed|cost cap/i.test(`${r.note || ''} ${JSON.stringify(r.checks || [])}`) && !(r.graders || []).some((g) => g.passed === true && !/judge call failed/.test(g.name || ''));
export const isGraded = (r) => isResult(r) && !isRefusal(r);

/** The newest invocation per (runner, host, item[, sim]) for a subject hash: what the release rule looks at.
 * Rows written together share `at`; the item passes only when every run of that invocation passed. */
export function latestFor(subject, rows = readRows()) {
  const by = new Map();
  for (const r of rows.filter((x) => isGraded(x) && x.subject === subject)) {
    const k = `${r.runner}|${r.host}|${r.item}${r.runner === 'interview-sim' ? `|${r.sim || 'deterministic'}` : ''}`;
    const cur = by.get(k);
    if (!cur || r.at > cur.at) by.set(k, { at: r.at, rows: [r] }); else if (r.at === cur.at) cur.rows.push(r);
  }
  return [...by.values()].map(({ rows: rs }) => ({ ...rs[0], runs: rs.length, passed: rs.every((x) => x.passed === true) }));
}

/** Triage rows: `{ runner: 'triage', refers_to: { runner, host, item, run, at }, failure_class, note }`, appended after a failing
 * result row is classified by hand. Rows are never edited, so the classification is a row of its own. */
export function classificationFor(row, rows = readRows()) {
  return rows.filter((t) => t.runner === 'triage' && t.refers_to && t.refers_to.runner === row.runner && t.refers_to.item === row.item && t.refers_to.run === row.run && t.refers_to.at === row.at).pop() || null;
}

export function appendTriage(entries, opts) {
  return appendRows(entries.map((e) => ({ runner: 'triage', host: e.row.host, item: e.row.item, run: e.row.run, passed: null, refers_to: { runner: e.row.runner, host: e.row.host, item: e.row.item, run: e.row.run, at: e.row.at }, failure_class: e.failure_class, note: e.note })), opts);
}
