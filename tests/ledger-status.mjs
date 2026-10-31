// Release progress from the ledger: which cases, trigger queries, the shell pipeline and the simulated
// interviews have a passing, current run (their newest graded invocation passed every run, and what they
// tested is unchanged), and what is still to run. Writes evals/ledger/STATUS.md; --json prints the plan.
//
//   node tests/ledger-status.mjs [--json] [--note "paused until 15:20 UTC"] [--no-write]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT, readRows, isGraded, isRefusal, itemSubject, rowItemSubject } from './lib/ledger.mjs';

const { values: opt } = parseArgs({ options: { json: { type: 'boolean' }, note: { type: 'string' }, 'no-write': { type: 'boolean' } } });
const all = readRows();
const graded = all.filter(isGraded);
const current = graded.filter((r) => { const x = rowItemSubject(r); return x && x === itemSubject(r.runner, r.item); });
const keyOf = (r) => `${r.runner}|${r.item}|${r.runner === 'interview-sim' ? r.sim || 'deterministic' : ''}`;
const newest = new Map();
for (const r of current) { const k = keyOf(r); const c = newest.get(k); if (!c || r.at > c.at) newest.set(k, { at: r.at, rows: [r] }); else if (r.at === c.at) c.rows.push(r); }
const state = (k) => { const c = newest.get(k); if (!c) return 'to run'; return c.rows.every((x) => x.passed === true) ? 'pass' : 'fail'; };

const cases = fs.readdirSync(path.join(ROOT, 'evals'), { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== 'ledger' && e.name !== 'scripts-pipeline').map((e) => e.name).sort();
const queries = JSON.parse(fs.readFileSync(path.join(ROOT, 'evals', 'trigger-set.json'), 'utf8')).queries.map((q) => q.id);
const personas = fs.readdirSync(path.join(ROOT, 'tests', 'live', 'personas')).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();
const pipelineOk = ['pipeline-sim|scripts-pipeline|', 'plugin-eval|scripts-pipeline|'].some((k) => state(k) === 'pass');
const groups = {
  cases: cases.map((c) => ({ item: c, state: state(`plugin-eval|${c}|`) })),
  pipeline: [{ item: 'scripts-pipeline', state: pipelineOk ? 'pass' : state('pipeline-sim|scripts-pipeline|') }],
  queries: queries.map((q) => ({ item: q, state: state(`trigger-set|${q}|`) })),
  personas: personas.map((p) => ({ item: p, state: state(`interview-sim|${p}|deterministic`) })),
};
const plan = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.filter((x) => x.state !== 'pass').map((x) => x.item)]));
const total = Object.values(groups).flat().length;
const passing = Object.values(groups).flat().filter((x) => x.state === 'pass').length;
const cost = Math.round(all.filter((r) => r.runner !== 'triage').reduce((s, r) => s + (Number(r.cost_usd) || 0), 0) * 100) / 100;
const lastRefusal = [...all].reverse().find((r) => r.runner !== 'triage' && isRefusal(r));

if (opt.json) { console.log(JSON.stringify({ passing, total, plan })); }
const label = { pass: 'pass', fail: 'FAIL (re-run or fix)', 'to run': 'to run' };
const section = (title, list) => [`## ${title}: ${list.filter((x) => x.state === 'pass').length}/${list.length} passing`, '', ...list.filter((x) => x.state !== 'pass').map((x) => `- ${x.item}: ${label[x.state]}`), ''].join('\n');
const md = [
  '# Release progress', '',
  `Updated ${new Date().toISOString().replace(/\.\d+Z$/, 'Z')} by \`node tests/ledger-status.mjs\`. An item counts when its newest graded run passed every run and what it tested (the skill, its runner, its own case, query set or persona) is unchanged since; refused runs (usage window) are not results.`, '',
  `**${passing} of ${total} release items passing.** ${opt.note ? `${opt.note}. ` : ''}Recorded spend in the ledger: $${cost}.${lastRefusal ? ` Last refusal: ${lastRefusal.at}.` : ''}`, '',
  section('Eval cases (claude plugin eval, 3 runs each)', groups.cases),
  section('Shell pipeline (2 runs)', groups.pipeline),
  section('Trigger queries (3 runs each)', groups.queries),
  section('Simulated interviews (deterministic candidate)', groups.personas),
  'Items not listed under a heading are passing. The runner that works through this list is `tests/run-pending.sh`; it pushes this file after every item and before every pause.', '',
].join('\n');
if (!opt['no-write']) fs.writeFileSync(path.join(ROOT, 'evals', 'ledger', 'STATUS.md'), md);
if (!opt.json) console.log(`${passing}/${total} passing; to run: ${Object.entries(plan).map(([k, v]) => `${k} ${v.length}`).join(', ')}`);
