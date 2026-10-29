// Classify failing ledger rows by hand (release.md §3). Rows are never edited: each classification is
// a `triage` row that refers to the result row it classifies.
//
//   node tests/ledger-triage.mjs                       list failing result rows that have no triage row
//   node tests/ledger-triage.mjs --match <regex> --class <skill|grader|fixture|host-flake|model-drift> --note "<why>"
//        [--runner plugin-eval|trigger-set|interview-sim] [--run N] [--since <iso>]
//   --match is tested against "<item> <note> <failed grader/check names>" of each unclassified failing row.
import { parseArgs } from 'node:util';
import { readRows, appendTriage, classificationFor, isResult, FAILURE_CLASSES } from './lib/ledger.mjs';

const { values: opt } = parseArgs({ options: { match: { type: 'string' }, class: { type: 'string' }, note: { type: 'string' }, runner: { type: 'string' }, run: { type: 'string' }, since: { type: 'string' }, json: { type: 'boolean' } } });
const rows = readRows();
const failedNames = (r) => [...(r.graders || []).filter((g) => g.passed === false).map((g) => g.name), ...(r.checks || []).filter((c) => c.ok === false).map((c) => c.name)];
const pending = rows.filter((r) => isResult(r) && r.passed === false && !classificationFor(r, rows))
  .filter((r) => !opt.runner || r.runner === opt.runner).filter((r) => !opt.run || String(r.run) === opt.run).filter((r) => !opt.since || r.at >= opt.since);
if (!opt.match) {
  if (opt.json) console.log(JSON.stringify(pending, null, 2));
  else for (const r of pending) console.log(`${r.at} ${r.runner} ${r.item} run ${r.run} score ${r.score}  failed: ${failedNames(r).join(', ') || '-'}  note: ${(r.note || '').slice(0, 120)}`);
  if (!pending.length) console.log('nothing to triage');
  process.exit(0);
}
if (!FAILURE_CLASSES.includes(opt.class)) { console.error(`--class must be one of ${FAILURE_CLASSES.join(', ')}`); process.exit(2); }
if (!opt.note) { console.error('--note is required: say why this class and what was done'); process.exit(2); }
const re = new RegExp(opt.match, 'i');
const hit = pending.filter((r) => re.test(`${r.item} ${r.note || ''} ${failedNames(r).join(' ')}`));
if (!hit.length) { console.log('no unclassified failing row matches'); process.exit(1); }
appendTriage(hit.map((row) => ({ row, failure_class: opt.class, note: opt.note })));
for (const r of hit) console.log(`classified ${r.runner} ${r.item} run ${r.run} (${r.at}) as ${opt.class}`);
