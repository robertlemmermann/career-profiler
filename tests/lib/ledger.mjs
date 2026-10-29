// The eval results ledger: one JSON row per case, query or persona per run, appended by every
// runner, never deleted. evals/ledger/ledger.jsonl is committed with the repository.
import { spawnSync } from 'node:child_process';
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
export function claudeVersion() {
  const r = spawnSync('claude', ['--version'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim().split(/\s+/)[0] : null;
}

/** Append rows; every row gets at, git_sha, skill_version and claude_version. Returns the rows written. */
export function appendRows(rows, { file = LEDGER } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const base = { at: new Date().toISOString(), git_sha: gitSha(), skill_version: skillVersion(), claude_version: claudeVersion() };
  const out = rows.map((r) => ({ ...base, ...r }));
  fs.appendFileSync(file, out.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return out;
}

export function readRows(file = LEDGER) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
}

/** The newest run per (runner, host, item) for a sha: what the release rule looks at. */
export function latestFor(sha, rows = readRows()) {
  const latest = new Map();
  for (const r of rows.filter((x) => x.git_sha === sha)) latest.set(`${r.runner}|${r.host}|${r.item}`, r);
  return [...latest.values()];
}
