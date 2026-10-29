import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readFixture, loadProfileFixture, tmpDir } from './helpers.mjs';
import { parseJob } from '../../skills/career-profiler/scripts/lib/job.mjs';
import { matchJob } from '../../skills/career-profiler/scripts/lib/match.mjs';
import { checkResume, draftResume, draftCoverLetter, finalize, numbersIn, parseMarkers, stripComments } from '../../skills/career-profiler/scripts/lib/resume.mjs';

const swe = () => loadProfileFixture('senior-swe');
const job = () => parseJob(readFixture('jobs', 'lead-react-engineer.txt'), { source: 'fixture' });
const codes = (r) => r.findings.map((f) => f.code);
const fails = (r) => r.findings.filter((f) => f.severity === 'fail').map((f) => f.code);

test('the generated draft passes the check with findings only', () => {
  const p = swe();
  const j = job();
  const m = matchJob(p, j);
  const draft = draftResume(p, { job: j, match: m });
  assert.ok(draft.includes('<!-- fact: exp-01 -->'));
  assert.ok(draft.indexOf('### Senior Software Engineer — Brightline') < draft.indexOf('### Software Engineer — Northwind'), 'most recent first');
  assert.ok(!draft.includes('skill-python'), 'unconfirmed facts never enter a draft');
  const r = checkResume(draft, p, { job: j, match: m });
  assert.equal(r.verdict, 'PASS-WITH-FINDINGS', JSON.stringify(r.findings));
  assert.deepEqual(fails(r), []);
  assert.ok(r.coverage.must.used >= 6, JSON.stringify(r.coverage.must));
  assert.ok(r.cited_ids.includes('ach-01-01'));
});

test('every planted fabrication in the fixture is caught', () => {
  const p = swe();
  const j = job();
  const r = checkResume(readFixture('resumes', 'fabricated.md'), p, { job: j, match: matchJob(p, j) });
  assert.equal(r.verdict, 'FAIL');
  const f = fails(r);
  for (const code of ['contact-mismatch', 'number-unsupported', 'unsupported-term', 'skill-unsupported', 'unconfirmed-fact', 'title-mismatch', 'date-mismatch', 'misplaced-citation', 'uncited', 'unknown-fact', 'institution-mismatch', 'exceeds']) {
    assert.ok(f.includes(code), `catches ${code}: ${f}`);
  }
  const byLine = (n) => r.findings.filter((x) => x.line === n).map((x) => x.code);
  assert.ok(byLine(18).includes('number-unsupported'), '0.9s is not the recorded 1.6s');
  assert.ok(byLine(6).includes('number-unsupported'), '12 years is invented');
  assert.ok(r.findings.some((x) => x.code === 'unsupported-term' && /Kubernetes/.test(x.message) && /job keyword/.test(x.message)));
});

test('exceeds: leadership verbs and expertise above the cited facts', () => {
  const p = swe();
  const base = ['# Jordan Rivera', 'jordan.rivera@example.com <!-- fact: identity -->', '', '## Experience', '', '### Software Engineer — Northwind Health <!-- fact: exp-02 -->', 'Jun 2017 – Feb 2022'];
  let r = checkResume([...base, '- Led the scheduling platform team of 12 through the Docker migration. <!-- fact: ach-02-02 -->'].join('\n'), p);
  assert.ok(fails(r).includes('exceeds'), 'ach-02-02 says "containerized", not led');
  r = checkResume([...base, '- Containerized the scheduling services with Docker, cutting the build-and-deploy cycle from 2 hours to 20 minutes. <!-- fact: ach-02-02 -->'].join('\n'), p);
  assert.ok(!fails(r).includes('exceeds'));
  const lead = ['# Jordan Rivera', 'jordan.rivera@example.com <!-- fact: identity -->', '', '## Experience', '', '### Senior Software Engineer — Brightline Payments <!-- fact: exp-01 -->', 'Mar 2022 – Present', '- Led the migration of the merchant dashboard to React and TypeScript. <!-- fact: ach-01-01 -->'].join('\n');
  assert.ok(!fails(checkResume(lead, p)).includes('exceeds'), 'the fact itself says Led');
  const skills = ['# Jordan Rivera', 'jordan.rivera@example.com <!-- fact: identity -->', '', '## Skills', '', '- Redis expert; expert in Security <!-- fact: skill-redis, skill-security -->'].join('\n');
  r = checkResume(skills, p);
  assert.equal(fails(r).filter((c) => c === 'exceeds').length, 2, 'both intermediate skills claimed as expert');
});

test('numbers: units, scales, years and months', () => {
  assert.deepEqual([...numbersIn('from 4.1s to 0.9s and 900ms, 38 KB, $410M, 1.9k, 2 million, p95, 1,200')], [4.1, 0.9, 900, 38, 410, 410e6, 1.9, 1900, 2, 2e6, 1200]);
  const p = swe();
  // A month in a date field (2022-02) must not make "2" a supported number.
  const doc = ['# Jordan Rivera', 'jordan.rivera@example.com <!-- fact: identity -->', '', '## Experience', '', '### Software Engineer — Northwind Health <!-- fact: exp-02 -->', 'Jun 2017 – Feb 2022', '- Grew the team to 2 pods. <!-- fact: exp-02 -->'].join('\n');
  const r = checkResume(doc, p);
  assert.ok(fails(r).includes('number-unsupported'), JSON.stringify(r.findings));
  // The year of a date field is supported; a line of dates is not checked for numbers.
  const ok = doc.replace('- Grew the team to 2 pods.', '- Joined in 2017 and stayed through 2022 on a 12-person team.');
  assert.ok(!fails(checkResume(ok, p)).includes('number-unsupported'));
});

test('markers and comments', () => {
  assert.deepEqual(parseMarkers('text <!-- fact: a, b --> more <!-- facts: c -->'), ['a', 'b', 'c']);
  assert.equal(stripComments('x <!-- fact: a --> y <!-- note -->').trim(), 'x  y');
  const p = swe();
  const doc = ['# Jordan Rivera', 'jordan.rivera@example.com <!-- fact: identity -->', '', '## Skills', '', '- React', '<!-- fact: skill-react -->', ''].join('\n');
  const r = checkResume(doc, p);
  assert.ok(!fails(r).includes('uncited'), 'a marker on the next line counts');
});

test('experience checks: title inflation, employer, dates, and dates with locations', () => {
  const p = swe();
  const base = (header, dates) => ['# Jordan Rivera', 'jordan.rivera@example.com <!-- fact: identity -->', '', '## Experience', '', `${header} <!-- fact: exp-01 -->`, dates, '- Led the migration of the merchant dashboard to React. <!-- fact: ach-01-01 -->'].join('\n');
  assert.deepEqual(fails(checkResume(base('### Senior Software Engineer — Brightline Payments', 'San Francisco, CA (remote) · Mar 2022 – Present'), p)), []);
  assert.ok(fails(checkResume(base('### Principal Engineer — Brightline Payments', 'Mar 2022 – Present'), p)).includes('title-mismatch'));
  assert.ok(fails(checkResume(base('### Senior Software Engineer — Brightline Pay', 'Mar 2022 – Present'), p)).includes('employer-mismatch'));
  assert.ok(fails(checkResume(base('### Senior Software Engineer — Brightline Payments', '2021 – Present'), p)).includes('date-mismatch'));
  assert.ok(fails(checkResume(base('### Senior Software Engineer — Brightline Payments', 'Mar 2022 – Dec 2025'), p)).includes('date-mismatch'));
  assert.deepEqual(fails(checkResume(base('### Senior Software Engineer, Brightline Payments', '2022 – Present'), p)), [], 'year-only dates are fine');
});

test('skills section: listed items must be in the cited facts; recognised terms need profile evidence', () => {
  const p = swe();
  const doc = (line) => ['# Jordan Rivera', 'jordan.rivera@example.com <!-- fact: identity -->', '', '## Skills', '', line].join('\n');
  assert.deepEqual(fails(checkResume(doc('- **Frontend:** React, TypeScript <!-- fact: skill-react, skill-typescript -->'), p)), []);
  const r = checkResume(doc('- **Frontend:** React, Angular <!-- fact: skill-react -->'), p);
  assert.ok(fails(r).includes('skill-unsupported'), 'Angular is not in the cited facts');
  assert.ok(!fails(r).includes('unsupported-term'), 'Angular has evidence elsewhere (the migration achievement), so only the citation fails');
  const r2 = checkResume(doc('- **Frontend:** React, Vue <!-- fact: skill-react -->'), p);
  assert.ok(fails(r2).includes('unsupported-term'), 'Vue has no evidence anywhere in the profile');
  // "Angular" appears in ach-01-01 (migrated away from it), so outside the skills section it is a finding, not a fail.
  const prose = ['# Jordan Rivera', 'jordan.rivera@example.com <!-- fact: identity -->', '', '## Summary', '', 'Migrated a legacy Angular app to React. <!-- fact: ach-01-01 -->'].join('\n');
  assert.deepEqual(fails(checkResume(prose, p)), []);
});

test('cover letter: boilerplate lines are free, body paragraphs are claims, company must be named', () => {
  const p = swe();
  const j = job();
  const good = checkResume(readFixture('resumes', 'good-cover-letter.md'), p, { job: j, kind: 'cover-letter' });
  assert.equal(good.verdict, 'PASS', JSON.stringify(good.findings));
  const bad = readFixture('resumes', 'good-cover-letter.md').replace(/Acme Ledger/g, 'Globex').replace('<!-- fact: ach-01-01, ach-01-03 -->', '').replace('used by 3 companies', 'used by 30 companies');
  const r = checkResume(bad, p, { job: j, kind: 'cover-letter' });
  assert.ok(fails(r).includes('company-missing'));
  assert.ok(fails(r).includes('uncited'));
  assert.ok(fails(r).includes('number-unsupported'));
  const draft = draftCoverLetter(p, { job: j, match: matchJob(p, j) });
  assert.ok(draft.includes('Dear Acme Ledger Hiring Team'));
  assert.ok(fails(checkResume(draft, p, { job: j, kind: 'cover-letter' })).includes('placeholder'), 'an unfilled draft never passes');
});

test('finalize strips markers and renders md, txt and html; refuses nothing by itself', () => {
  const p = swe();
  const j = job();
  const dir = tmpDir();
  const file = path.join(dir, 'resume.md');
  fs.writeFileSync(file, draftResume(p, { job: j, match: matchJob(p, j) }));
  const r = finalize(file, { formats: ['md', 'txt', 'html'] });
  assert.equal(r.files.length, 3);
  const finalMd = fs.readFileSync(path.join(dir, 'resume.final.md'), 'utf8');
  assert.ok(!finalMd.includes('<!--'));
  assert.ok(fs.readFileSync(path.join(dir, 'resume.txt'), 'utf8').startsWith('JORDAN RIVERA'));
  const html = fs.readFileSync(path.join(dir, 'resume.html'), 'utf8');
  assert.ok(html.includes('<h2>Experience</h2>') && html.includes('<li>'));
  assert.ok(!html.includes('<!-- fact'));
});

test('the nurse profile drafts and checks the same way (role-agnostic)', () => {
  const p = loadProfileFixture('icu-nurse');
  const j = parseJob(readFixture('jobs', 'icu-nurse.txt'), { source: 'fixture' });
  const m = matchJob(p, j);
  const draft = draftResume(p, { job: j, match: m });
  const r = checkResume(draft, p, { job: j, match: m });
  assert.deepEqual(fails(r), [], JSON.stringify(r.findings));
  assert.ok(draft.includes('CCRN') && draft.includes('St. Anselm Hospital'));
});
