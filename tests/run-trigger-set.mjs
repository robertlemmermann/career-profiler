// Runs evals/trigger-set.json against Claude Code headless (paid). Method: each query runs in a
// fresh temp workspace holding only .claude/skills/career-profiler/ (evals excluded); the skill
// counts as triggered when the transcript shows a Skill tool call naming it or a Read of its
// SKILL.md. Scoring follows agentic-developer-companion's tooling-eval playbook: 3 runs per query,
// a query passes when more than half of its runs behave as labeled, the suite score is the share
// of passing queries, accepted at the set's suite_threshold (0.8).
//
//   node tests/run-trigger-set.mjs [--dry-run] [--runs 3] [--split all|train|validation]
//        [--only pos|neg|<id,...>] [--model <id>] [--max-cost-usd 80] [--budget-per-run 0.6]
//        [--timeout-s 180] [--out results.json] [--json]

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { appendRows } from './lib/ledger.mjs';

const NAME = 'career-profiler';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values: opt } = parseArgs({ allowNegative: true, options: {
  'dry-run': { type: 'boolean' }, runs: { type: 'string' }, split: { type: 'string', default: 'all' }, only: { type: 'string' },
  model: { type: 'string' }, 'max-cost-usd': { type: 'string', default: '80' }, 'budget-per-run': { type: 'string', default: '0.6' },
  'timeout-s': { type: 'string', default: '180' }, out: { type: 'string' }, json: { type: 'boolean' }, host: { type: 'string', default: 'claude' }, ledger: { type: 'boolean', default: true },
} });
const HOST = opt.host;
if (!['claude', 'copilot', 'codex'].includes(HOST)) { console.error('--host must be claude, copilot or codex'); process.exit(2); }
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

const SKILL_DIR_FOR = { claude: ['.claude', 'skills'], copilot: ['.github', 'skills'], codex: ['.agents', 'skills'] };
function workspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-trigger-'));
  const dest = path.join(dir, ...SKILL_DIR_FOR[HOST], NAME);
  fs.cpSync(path.join(repo, 'skills', NAME), dest, { recursive: true });
  if (HOST === 'codex') spawnSync('git', ['init', '-q'], { cwd: dir });
  return dir;
}
/** Method per host, from agentic-developer-companion's tooling-eval playbook; confidence is reported in the result. */
const METHOD = {
  claude: { confidence: 'high', bin: 'claude', args: (q) => ['-p', q, '--output-format', 'stream-json', '--verbose', '--tools', 'Skill,Read,Glob,Grep', '--permission-mode', 'dontAsk', '--no-session-persistence', '--max-budget-usd', String(perRun), ...(opt.model ? ['--model', opt.model] : [])],
    triggered: (text) => new RegExp(`"name":"Skill"[^\\n]*${NAME}`).test(text) || new RegExp(`"name":"Read"[^\\n]*skills/${NAME}/SKILL\\.md`).test(text) },
  copilot: { confidence: 'unconfirmed', bin: 'copilot', args: (q, dir) => ['-p', q, '--output-format', 'json', '--no-ask-user', '--trust-folder', '--share', path.join(dir, 'share.md')],
    triggered: (text, dir) => { let share = ''; try { share = fs.readFileSync(path.join(dir, 'share.md'), 'utf8'); } catch {} return new RegExp(`skills/${NAME}/SKILL\\.md`).test(text) || new RegExp(`"skill"[^\\n]*${NAME}`).test(text) || (/skill/i.test(share) && share.includes(NAME) && !share.includes(`"${NAME}"`)); } },
  codex: { confidence: 'medium', bin: 'codex', args: (q) => ['exec', '--json', '--ephemeral', '--skip-git-repo-check', q],
    triggered: (text) => new RegExp(`skills/${NAME}/(?:SKILL\\.md|scripts/)`).test(text) },
};

function runOnce(query, dir) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/^(CLAUDECODE|CLAUDE_CODE_ENTRYPOINT|COPILOT|CODEX_)/.test(k)) delete env[k];
  env.HOME = env.HOME || os.homedir();
  if (HOST === 'copilot') env.COPILOT_AUTO_UPDATE = 'false';
  const m = METHOD[HOST];
  const args = m.args(query, dir);
  const started = Date.now();
  const r = spawnSync(m.bin, args, { cwd: dir, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: Number(opt['timeout-s']) * 1000, maxBuffer: 64 * 1024 * 1024 });
  if (r.error && r.error.code === 'ENOENT') { console.error(`${m.bin} is not installed`); process.exit(3); }
  const text = r.stdout || '';
  let cost = null;
  const costMatch = /"total_cost_usd":\s*([0-9.]+)/.exec(text);
  if (costMatch) cost = Number(costMatch[1]);
  // A refused or failed run is an error, never a "did not trigger": the host's usage limit, an API error or a
  // non-zero exit all land here, so the row is re-run instead of counted against the description.
  const refusal = /hit your .{0,20}limit|"is_error":\s*true|rate limit|overloaded|api error/i.exec(`${text}\n${r.stderr || ''}`);
  const error = r.error ? r.error.message : r.status !== 0 ? `exit ${r.status}: ${(r.stderr || text).replace(/\s+/g, ' ').slice(0, 200)}` : refusal ? `api error: ${refusal[0]}` : null;
  const triggered = error ? null : m.triggered(text, dir);
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
  schema: 'cp-trigger-results/1', skill: NAME, host: HOST, method_confidence: METHOD[HOST].confidence, runs, model: opt.model || null, dry_run: !!opt['dry-run'], partial,
  queries: results.length, suite_score: score(scored), threshold: set.suite_threshold ?? 0.8,
  train_score: score(scored.filter((r) => r.split === 'train')), validation_score: score(scored.filter((r) => r.split === 'validation')),
  cost_usd: Math.round(spent * 1000) / 1000, errors: results.flatMap((r) => r.runs).filter((r) => r.error).length,
  failing: scored.filter((r) => !r.passed).map((r) => ({ id: r.id, should_trigger: r.should_trigger, pass_rate: r.pass_rate })),
  results,
  method: HOST === 'claude' ? 'claude -p --output-format stream-json --tools Skill,Read,Glob,Grep; triggered = a Skill call naming the skill or a Read of its SKILL.md' : HOST === 'copilot' ? 'copilot -p --output-format json --share; triggered = an event or share line naming the skill (unconfirmed method)' : 'codex exec --json --ephemeral; triggered = an event naming the skill folder',
};
if (opt.ledger && !opt['dry-run']) appendRows(results.map((r) => ({ runner: 'trigger-set', host: HOST, model: opt.model || null, judge_model: null, item: r.id, run: 1, score: r.pass_rate, passed: r.passed, checks: r.runs.map((x) => ({ triggered: x.triggered, error: x.error })), cost_usd: r.runs.reduce((s, x) => s + (x.cost_usd || 0), 0) || null, failure_class: null, note: r.should_trigger ? 'should trigger' : 'near miss' })));
if (opt.out) fs.writeFileSync(opt.out, `${JSON.stringify(report, null, 2)}\n`);
if (opt.json) console.log(JSON.stringify(report, null, 2));
else {
  console.log(opt['dry-run'] ? `dry run: ${results.length} queries x ${runs} runs would cost at most $${(results.length * runs * perRun).toFixed(2)} (cap $${cap})`
    : `suite ${report.suite_score} (threshold ${report.threshold}); train ${report.train_score}, validation ${report.validation_score}; cost $${report.cost_usd}; errors ${report.errors}${partial ? '; PARTIAL (cost cap)' : ''}`);
  for (const f of report.failing) console.log(`  failing ${f.id} (should_trigger ${f.should_trigger}): pass rate ${f.pass_rate}`);
}
process.exitCode = opt['dry-run'] ? 0 : report.errors > (results.length * runs) / 2 ? 4 : (report.suite_score ?? 0) >= report.threshold ? 0 : 1;
