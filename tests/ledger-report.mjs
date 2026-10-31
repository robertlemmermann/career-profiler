// Summarise evals/ledger/ledger.jsonl for one subject (default: the work tree's): per runner, the items
// whose newest invocation passed every run, the runs and the cost; plus the whole ledger's totals.
//
//   node tests/ledger-report.mjs [--subject <hash>] [--json]
import { parseArgs } from 'node:util';
import { readRows, latestFor, isResult, subjectHash } from './lib/ledger.mjs';

const { values: opt } = parseArgs({ options: { subject: { type: 'string' }, json: { type: 'boolean' } } });
const rows = readRows();
const subject = opt.subject || subjectHash();
const results = rows.filter(isResult);
const at = results.filter((r) => r.subject === subject);
const latest = latestFor(subject, rows);
const runners = {};
for (const r of latest) {
  const key = r.runner === 'interview-sim' ? `interview-sim (${r.sim || 'deterministic'})` : r.runner;
  const x = (runners[key] ||= { items: 0, passing: 0, runs: 0, failing: [] });
  x.items += 1; x.runs += r.runs; if (r.passed) x.passing += 1; else x.failing.push(r.item);
}
const sum = (list) => Math.round(list.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0) * 100) / 100;
const report = {
  subject, rows_for_subject: at.length, cost_for_subject_usd: sum(at), runners,
  ledger: { rows: rows.length, result_rows: results.length, triage_rows: rows.length - results.length, subjects: new Set(results.map((r) => r.subject).filter(Boolean)).size, models: [...new Set(results.map((r) => r.model).filter(Boolean))], cost_usd: sum(results) },
};
if (opt.json) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`subject ${subject}: ${at.length} rows, $${report.cost_for_subject_usd}`);
  for (const [k, x] of Object.entries(runners)) console.log(`  ${k.padEnd(28)} ${x.passing}/${x.items} items passing over ${x.runs} runs${x.failing.length ? `; failing: ${x.failing.join(', ')}` : ''}`);
  console.log(`ledger: ${report.ledger.rows} rows (${report.ledger.triage_rows} triage), ${report.ledger.subjects} subjects, models ${report.ledger.models.join(', ')}, $${report.ledger.cost_usd} recorded`);
}
