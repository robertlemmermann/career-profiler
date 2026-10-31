import test from 'node:test';
import assert from 'node:assert/strict';
import { readFixture } from './helpers.mjs';
import { parseJob, htmlToText, seniorityOf } from '../../skills/career-profiler/scripts/lib/job.mjs';
import { buildMatchers, findTerms, termRegex } from '../../skills/career-profiler/scripts/lib/taxonomy.mjs';

const terms = (j, kind) => j.keywords.filter((k) => k.kind === kind).map((k) => k.term);

test('lead react posting: title, company, seniority, years, must and nice keywords', () => {
  const j = parseJob(readFixture('jobs', 'lead-react-engineer.txt'), { source: 'fixture' });
  assert.equal(j.schema, 'career-job/1');
  assert.match(j.title, /^Lead Software Engineer/);
  assert.equal(j.company, 'Acme Ledger');
  assert.equal(j.seniority, 'lead');
  assert.equal(j.years_required, 7);
  assert.equal(j.remote, 'remote');
  const must = terms(j, 'must');
  for (const t of ['React', 'TypeScript', 'Technical Leadership', 'Accessibility', 'CI/CD', "Bachelor's degree"]) assert.ok(must.includes(t), `must has ${t}: ${must}`);
  const nice = terms(j, 'nice');
  for (const t of ['Next.js', 'Kubernetes', 'AWS', 'GraphQL']) assert.ok(nice.includes(t), `nice has ${t}: ${nice}`);
  assert.ok(!must.includes('Associate degree'), 'the word "as" is not a degree');
  assert.ok(j.counts.must >= 6 && j.counts.nice >= 3 && j.counts.responsibility >= 4, JSON.stringify(j.counts));
  assert.ok(j.years_mentions.some((y) => y.min === 4 && y.terms.includes('React')), '4+ years of React');
  assert.deepEqual(j.warnings, []);
});

test('nurse posting: healthcare terms, licences and certifications', () => {
  const j = parseJob(readFixture('jobs', 'icu-nurse.txt'), { source: 'fixture' });
  assert.match(j.title, /Registered Nurse/);
  assert.equal(j.company, 'Lakeside Regional Medical Center');
  assert.equal(j.years_required, 2);
  const must = terms(j, 'must');
  for (const t of ['Nursing', 'Critical Care', 'BLS', 'ACLS', "Bachelor's degree"]) assert.ok(must.includes(t), `must has ${t}: ${must}`);
  const all = j.keywords.map((k) => k.term);
  for (const t of ['EHR', 'Ventilator Management', 'Medication Administration', 'Patient Care']) assert.ok(all.includes(t), `recognised ${t}`);
  assert.equal(j.keywords.find((k) => k.term === 'Critical Care').in_title, true);
});

test('HTML posting is converted and parsed; sales terms recognised', () => {
  const html = readFixture('jobs', 'sales-manager.html');
  const text = htmlToText(html);
  assert.ok(!/<[a-z]+/i.test(text), 'no tags left');
  assert.ok(text.includes('- Lead, coach and hire'), 'list items become bullets');
  const j = parseJob(html, { source: 'fixture' });
  assert.equal(j.company, 'Kestrel Industrial Supply');
  assert.match(j.title, /Regional Sales Manager/);
  assert.equal(j.seniority, 'manager');
  assert.equal(j.years_required, 5);
  const all = j.keywords.map((k) => k.term);
  for (const t of ['Sales', 'CRM', 'Negotiation', 'People Management']) assert.ok(all.includes(t), `recognised ${t}: ${all}`);
});

test('prose-only posting still yields keywords and a warning about requirement lines', () => {
  const j = parseJob(readFixture('jobs', 'prose-only.txt'), { source: 'fixture' });
  const all = j.keywords.map((k) => k.term);
  assert.ok(all.includes('Retail') || all.includes('Hospitality'), all.join(','));
  assert.ok(j.warnings.length >= 1);
});

test('term matching: aliases, word boundaries, case rules', () => {
  const m = buildMatchers(null);
  const found = (s) => findTerms(s, m).map((t) => t.term);
  assert.ok(found('we use ReactJS and k8s daily').includes('React'));
  assert.ok(found('we use ReactJS and k8s daily').includes('Kubernetes'));
  assert.ok(!found('willing to go the extra mile').includes('Go'), 'lowercase go is a verb');
  assert.ok(found('Go, Rust and Python').includes('Go'));
  assert.ok(!found('as needed').includes('Associate degree'));
  assert.ok(found('a BSN is required').includes("Bachelor's degree"));
  assert.ok(found('current RN license').includes('Nursing'));
  assert.ok(found('C++ and C# experience').includes('C++'));
  assert.ok(found('C++ and C# experience').includes('C#'));
  assert.ok(found('.NET Core services').includes('.NET'));
  assert.ok(!found('a javascripter').includes('JavaScript'), 'word boundary');
  assert.ok(termRegex('Node.js').test('node js and nodejs'), 'spaces and dots are flexible');
  const withProfile = buildMatchers({ skills: [{ name: 'Impella', aliases: ['impella device'] }] });
  assert.ok(findTerms('Impella devices', withProfile).some((t) => t.term === 'Impella'));
});

test('seniority ladder', () => {
  assert.equal(seniorityOf('Senior Staff Engineer'), 'staff');
  assert.equal(seniorityOf('Junior Developer'), 'entry');
  assert.equal(seniorityOf('Charge Nurse'), 'lead');
  assert.equal(seniorityOf('Director of Engineering'), 'director');
  assert.equal(seniorityOf('Registered Nurse'), null);
});
