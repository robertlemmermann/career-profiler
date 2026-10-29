// Runs evals/trigger-set.json against Claude Code headless (paid). Method: each query runs in a
// fresh temp workspace holding only .claude/skills/career-profiler/ (evals excluded); the skill
// counts as triggered when the transcript shows a Skill tool call naming it or a Read of its
// SKILL.md. Scoring follows agentic-developer-companion's tooling-eval playbook: 3 runs per query,
// a query passes when more than half of its runs behave as labeled, the suite score is the share
// of passing queries, accepted at the set's suite_threshold (0.8).
//
//   node tests/run-trigger-set.mjs [--dry-run] [--runs 3] [--split all|train|validation]
//        [--only pos|neg|<id,...>] [--model <id>] [--max-cost-usd 10] [--budget-per-run 0.6]
//        [--timeout-s 180] [--out results.json] [--json]

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const NAME = 'career-profiler';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values: opt } = parseArgs({ options: {
  'dry-run': { type: 'boolean' }, runs: { type: 'string' }, split: { type: 'string', default: 'all' }, only: { type: 'string' },
  model: { type: 'string' }, 'max-cost-usd': { type: 'string', default: '10' }, 'budget-per-run': { type: 'string', default: '0.6' },
  'timeout-s': { type: 'string', default: '180' }, out: { type: 'string' }, json: { type: 'boolean' },
} });
const set = JSON.parse(fs.readFileSync(path.join(repo, 'evals', 'trigger-set.json'), 'utf8'));
if (set.queries.some((q) => /TODO/.test(q.query))) { console.error('trigger set still contains TODO queries'); process.exit(2); }
const runs = Number(opt.runs || set.runs || 3);
const cap = Number(opt['max-cost-usd']);
const perRun = Number(opt['budget-per-run']);

// Fixed, label-stratified 60/40 split from a hash of the query id (never changes between runs).
const splitOf = (q) => (parseInt(createHash('sha256').update(q.id).digest('hex').slice(0, 8), 16) % 10 < 6 ? 'train' : 'validation');
let queries = set.queries.map((q) => ({ ...q, split: splitOf(q) }));
if (opt.split !== 'all') queries = queries.filter((q) => q.split === opt.split);
if (opt.only === 'pos') queries = queries.filter((q) => q.should_trigger);
else if (opt.only === 'neg') queries = queries.filter((q) => !q.should_trigger);
else if (opt.only) { const ids = new Set(opt.only.split(',')); queries = queries.filter((q) => ids.has(q.id)); }

function workspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-trigger-'));
  const dest = path.join(dir, '.claude', 'skills', NAME);
  fs.cpSync(path.join(repo, 'skills', NAME), dest, { recursive: true });
  return dir;
}

function runOnce(query, dir) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/^(CLAUDECODE|CLAUDE_CODE_ENTRYPOINT|COPILOT|CODEX_)/.test(k)) delete env[k];
  env.HOME = env.HOME || os.homedir();
  const args = ['-p', query, '--output-format', 'stream-json', '--verbose', '--tools', 'Skill,Read,Glob,Grep', '--permission-mode', 'dontAsk',
    '--no-session-persistence', '--max-budget-usd', String(perRun), ...(opt.model ? ['--model', opt.model] : [])];
  const started = Date.now();
  const r = spawnSync('claude', args, { cwd: dir, env, encoding: 'utf8', timeout: Number(opt['timeout-s']) * 1000, maxBuffer: 64 * 1024 * 1024 });
  const text = r.stdout || '';
  const triggered = new RegExp(`"name":"Skill"[^\\n]*${NAME}`).test(text) || new RegExp(`"name":"Read"[^\\n]*skills/${NAME}/SKILL\\.md`).test(text);
  let cost = null;
  const m = /"total_cost_usd":\s*([0-9.]+)/.exec(text);
  if (m) cost = Number(m[1]);
  const error = r.error ? r.error.message : (r.status !== 0 && !text ? `exit ${r.status}: ${(r.stderr || '').slice(0, 200)}` : null);
  return { triggered, cost_usd: cost, error, ms: Date.now() - started };
}

const results = [];
let spent = 0;
let partial = false;
for (const q of queries) {
  const row = { id: q.id, split: q.split, should_trigger: q.should_trigger, runs: [] };
  for (let i = 0; i < runs; i++) {
    if (opt['dry-run']) { row.runs.push({ dry_run: true }); continue; }
    if (spent >= cap) { partial = true; row.runs.push({ error: 'cost cap reached', triggered: null }); continue; }
    const dir = workspace();
    const r = runOnce(q.query, dir);
    fs.rmSync(dir, { recursive: true, force: true });
    spent += r.cost_usd ?? perRun;
    row.runs.push(r);
    process.stderr.write(`${q.id} run ${i + 1}: ${r.error ? `error (${r.error})` : r.triggered ? 'triggered' : 'not triggered'}${r.cost_usd != null ? ` $${r.cost_usd.toFixed(3)}` : ''}\n`);
  }
  const good = row.runs.filter((r) => !r.error && r.triggered === q.should_trigger).length;
  row.pass_rate = opt['dry-run'] ? null : good / runs;
  row.passed = opt['dry-run'] ? null : good / runs > (set.query_threshold ?? 0.5);
  results.push(row);
}
const scored = results.filter((r) => r.passed != null);
const score = (rows) => (rows.length ? rows.filter((r) => r.passed).length / rows.length : null);
const report = {
  schema: 'cp-trigger-results/1', skill: NAME, host: 'claude', runs, model: opt.model || null, dry_run: !!opt['dry-run'], partial,
  queries: results.length, suite_score: score(scored), threshold: set.suite_threshold ?? 0.8,
  train_score: score(scored.filter((r) => r.split === 'train')), validation_score: score(scored.filter((r) => r.split === 'validation')),
  cost_usd: Math.round(spent * 1000) / 1000, errors: results.flatMap((r) => r.runs).filter((r) => r.error).length,
  failing: scored.filter((r) => !r.passed).map((r) => ({ id: r.id, should_trigger: r.should_trigger, pass_rate: r.pass_rate })),
  results,
  method: 'claude -p --output-format stream-json --tools Skill,Read,Glob,Grep; triggered = a Skill call naming the skill or a Read of its SKILL.md',
};
if (opt.out) fs.writeFileSync(opt.out, `${JSON.stringify(report, null, 2)}\n`);
if (opt.json) console.log(JSON.stringify(report, null, 2));
else {
  console.log(opt['dry-run'] ? `dry run: ${results.length} queries x ${runs} runs would cost at most $${(results.length * runs * perRun).toFixed(2)} (cap $${cap})`
    : `suite ${report.suite_score} (threshold ${report.threshold}); train ${report.train_score}, validation ${report.validation_score}; cost $${report.cost_usd}; errors ${report.errors}${partial ? '; PARTIAL (cost cap)' : ''}`);
  for (const f of report.failing) console.log(`  failing ${f.id} (should_trigger ${f.should_trigger}): pass rate ${f.pass_rate}`);
}
process.exitCode = opt['dry-run'] ? 0 : report.errors > (results.length * runs) / 2 ? 4 : (report.suite_score ?? 0) >= report.threshold ? 0 : 1;
