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
export function subjectHash(root = ROOT) {
  const r = spawnSync('git', ['-C', root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', ...SUBJECT_PATHS], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const files = r.stdout.split('\0').filter((f) => f && !f.startsWith('evals/ledger/') && !/(^|\/)results\//.test(f)).sort();
  const h = createHash('sha256');
  for (const f of files) {
    let body;
    try { body = fs.readFileSync(path.join(root, f)); } catch { continue; } // deleted in the work tree
    h.update(f); h.update('\0'); h.update(createHash('sha256').update(body).digest('hex')); h.update('\n');
  }
  return h.digest('hex').slice(0, 16);
}

export function claudeVersion() {
  const r = spawnSync('claude', ['--version'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim().split(/\s+/)[0] : null;
}

/** Append rows; every row gets at, git_sha, skill_version and claude_version. Returns the rows written. */
export function appendRows(rows, { file = LEDGER } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const base = { at: new Date().toISOString(), git_sha: gitSha(), subject: subjectHash(), skill_version: skillVersion(), claude_version: claudeVersion() };
  const out = rows.map((r) => ({ ...base, ...r }));
  fs.appendFileSync(file, out.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return out;
}

export function readRows(file = LEDGER) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
}

/** Result rows only (triage rows classify a result and are not results themselves). */
export const isResult = (r) => r.runner !== 'triage';

/** The newest invocation per (runner, host, item[, sim]) for a subject hash: what the release rule looks at.
 * Rows written together share `at`; the item passes only when every run of that invocation passed. */
export function latestFor(subject, rows = readRows()) {
  const by = new Map();
  for (const r of rows.filter((x) => isResult(x) && x.subject === subject)) {
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
