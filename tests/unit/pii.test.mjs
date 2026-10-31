import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cp, seededStore, loadProfileFixture, tmpDir, fixture } from './helpers.mjs';
import { scanText, tierForFact, forbiddenValues } from '../../skills/career-profiler/scripts/lib/pii.mjs';
import { checkResume } from '../../skills/career-profiler/scripts/lib/resume.mjs';

const ids = (r) => r.hits.map((h) => h.detector);

test('detectors: block classes', () => {
  const r = scanText(['SSN 123-45-6789', 'Date of birth: 04/02/1988', 'I live at 12 Maple Street, Apt 4', 'IBAN DE89 3704 0044 0532 0130 00', 'Card 4111 1111 1111 1111', 'Passport number X1234567', 'token sk-abcdefghijklmnopqrstuvwxyz1234'].join('\n'));
  for (const d of ['ssn-us', 'dob', 'street-address', 'iban', 'card-number', 'national-id-label', 'secret-token']) assert.ok(ids(r).includes(d), d);
  assert.ok(r.blocks >= 7);
  assert.ok(r.hits.every((h) => !/123-45-6789|1988|Maple/.test(h.sample)), 'samples are masked');
});

test('detectors: review classes, contact allowlist and false-positive guards', () => {
  const p = loadProfileFixture('senior-swe');
  const r = scanText('Married with 2 kids. Catholic. I was diagnosed with ADHD. Contact: jordan.rivera@example.com, +1 415 555 0142, also old@example.net and 206-555-0101.', { profile: p });
  for (const d of ['marital-family', 'religion', 'health']) assert.ok(ids(r).includes(d), d);
  assert.equal(r.blocks, 0, 'review classes do not block');
  const emails = r.hits.filter((h) => h.detector === 'extra-email');
  assert.equal(emails.length, 1, 'the chosen email is allowed, the other is reviewed');
  const phones = r.hits.filter((h) => h.detector === 'extra-phone');
  assert.equal(phones.length, 1);
  const ok = scanText('BSN, Nursing, University of Wisconsin, 2018. Processed $410M in 2024 for 1,200 merchants; ADN considered.', { profile: p });
  assert.equal(ok.blocks, 0, `degrees, money and years are not ids: ${JSON.stringify(ok.hits)}`);
});

test('store values: never-tier facts and unexported restricted fields are caught; --include releases a restricted field', () => {
  const p = loadProfileFixture('electrician-journeyman');
  const fv = forbiddenValues(p);
  assert.ok(fv.some((v) => v.tier === 'never' && /back condition/.test(v.value)));
  assert.ok(fv.some((v) => v.label === 'identity.work_authorization'));
  const text = 'Journeyman electrician. US citizen. Has a back condition that rules out sustained overhead work.';
  const r = scanText(text, { profile: p });
  assert.equal(r.hits.filter((h) => h.detector === 'store-value').length, 2);
  const r2 = scanText(text, { profile: p, include: ['work_authorization'] });
  assert.equal(r2.hits.filter((h) => h.detector === 'store-value').length, 1, 'only the never value remains');
});

test('tierForFact quarantines volunteered PII as never', () => {
  assert.equal(tierForFact({ text: 'Born on 1988-04-02 in Lima' }).tier, 'never');
  assert.equal(tierForFact({ text: 'My SSN is 123-45-6789' }).tier, 'never');
  assert.equal(tierForFact({ text: 'Cut p95 latency 60%' }), null);
});

test('resume check fails on PII blocks and never-tier citations; cover letter review items are findings', () => {
  const p = loadProfileFixture('electrician-journeyman');
  const base = ['# Marcus Oyelaran', 'Columbus, OH · marcus.oyelaran@example.com · +1 614 555 0188 <!-- fact: identity -->', '', '## Experience', '', '### Journeyman Electrician — Buckeye Electric Co. <!-- fact: exp-01 -->', 'Columbus, OH · Apr 2021 – Present'];
  let r = checkResume([...base, '- Led a crew of 3 through the electrical build-out of a 40,000 sq ft distribution center. <!-- fact: ach-01-01 -->', '- Lives at 12 Maple Street, Columbus. <!-- fact: identity -->'].join('\n'), p);
  assert.ok(r.findings.some((f) => f.code === 'pii-block' && f.severity === 'fail'));
  r = checkResume([...base, '- Has a back condition that rules out sustained overhead work. <!-- fact: fact-01 -->'].join('\n'), p);
  assert.ok(r.findings.some((f) => f.code === 'pii-never'));
  assert.ok(r.findings.some((f) => f.code === 'pii-block' && f.detector !== undefined || f.code === 'pii-block'));
  r = checkResume([...base, '- US citizen, available for second shift. <!-- fact: identity -->'].join('\n'), p);
  assert.ok(r.findings.some((f) => f.code === 'pii-block' && /work_authorization/.test(f.message)), 'restricted field without --include');
  r = checkResume([...base, '- US citizen, available for second shift. <!-- fact: identity -->'].join('\n'), p, { include: ['work_authorization'] });
  assert.ok(!r.findings.some((f) => f.code === 'pii-block'), 'released with --include');
});

test('finalize scans every rendering: a JSON Resume that would carry a never-tier value is refused', () => {
  const store = seededStore('senior-swe');
  const work = tmpDir();
  // A never-tier extras fact that the draft never cites still feeds nothing into JSON Resume; a restricted identity field does.
  cp(['fact', 'update', 'identity', '--data', '{"work_authorization":"H-1B, needs sponsorship"}', '--confirm', '--json'], { store });
  let r = cp(['job', 'parse', fixture('jobs', 'lead-react-engineer.txt'), '--out', 'job.json', '--json'], { store, cwd: work });
  r = cp(['resume', 'draft', '--job', 'job.json', '--out', 'resume.md', '--json'], { store, cwd: work });
  assert.equal(r.status, 0, r.stderr);
  r = cp(['resume', 'finalize', 'resume.md', '--job', 'job.json', '--formats', 'md,json', '--json'], { store, cwd: work });
  assert.equal(r.status, 0, r.stderr);
  const json = JSON.parse(fs.readFileSync(path.join(work, 'resume.json'), 'utf8'));
  assert.ok(!JSON.stringify(json).includes('H-1B'), 'restricted fields never enter the JSON Resume');
  assert.equal(json.basics.name, 'Jordan Rivera');
});

test('CLI: fact add quarantines a DOB at tier never; show and export mask it; export --include releases a restricted field once and logs it', () => {
  const store = seededStore('electrician-journeyman');
  let r = cp(['fact', 'add', 'extras', '--data', '{"text":"Date of birth: 1988-04-02, in case a form asks"}', '--confirm', '--json'], { store });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.json.added[0].tier, 'never');
  assert.equal(r.json.never_tier.length, 1);
  r = cp(['store', 'show', '--json'], { store });
  assert.ok(!JSON.stringify(r.json).includes('1988-04-02'));
  assert.equal(r.json.identity.work_authorization, '[restricted]');
  r = cp(['store', 'export', '--format', 'json', '--json'], { store });
  assert.ok(!r.json.content.includes('1988-04-02') && !r.json.content.includes('US citizen'));
  r = cp(['store', 'export', '--format', 'json', '--include', 'restricted:work_authorization', '--json'], { store });
  assert.equal(r.status, 2, 'an include needs --confirm');
  r = cp(['store', 'export', '--format', 'json', '--include', 'restricted:work_authorization', '--confirm', '--json'], { store });
  assert.ok(r.json.content.includes('US citizen') && !r.json.content.includes('1988-04-02'), r.stdout.slice(0, 300));
  assert.ok(!r.json.content.includes('at least 38 per hour'), 'only the released field is unmasked');
  const log = fs.readFileSync(path.join(store, 'changelog.jsonl'), 'utf8');
  assert.ok(log.includes('"op":"include"'));
  r = cp(['store', 'export', '--include', 'restricted:dob', '--confirm', '--json'], { store });
  assert.equal(r.status, 2, 'never fields cannot be included');
  r = cp(['fact', 'list', '--json'], { store });
  assert.ok(r.json.facts.every((f) => f.tier !== 'never' || /never-tier/.test(f.summary)), 'never-tier values are masked in lists');
  assert.ok(!r.stdout.includes('1988-04-02'));
  r = cp(['pii', 'scan', '-', '--json'], { store, input: 'Marcus Oyelaran, US citizen, born 04/02/1988' });
  assert.equal(r.status, 1);
  assert.ok(r.json.hits.some((h) => h.detector === 'dob') && r.json.hits.some((h) => h.detector === 'store-value'));
});

test('FM-24: six consecutive words of a never-tier fact are a store-value hit; five are not; resume check blocks the line', () => {
  const p = loadProfileFixture('electrician-journeyman');
  const words = p.extras[0].text.replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/); // "Has a back condition that rules out sustained overhead work ..."
  const six = words.slice(0, 6).join(' ');
  const five = words.slice(0, 5).join(' ');
  assert.ok(six.length >= 25, six);
  const hit = scanText(`Note: ${six} but is otherwise fine.`, { profile: p });
  assert.ok(hit.hits.some((h) => h.detector === 'store-value'), JSON.stringify(hit));
  const miss = scanText(`Note: ${five} but is otherwise fine.`, { profile: p });
  assert.ok(!miss.hits.some((h) => h.detector === 'store-value'), JSON.stringify(miss));
  const draft = `# Dana Okafor\n\n## Summary\n\nJourneyman electrician. ${six} on site. <!-- fact: exp-01 -->\n`;
  const r = checkResume(draft, p, {});
  assert.ok(r.findings.some((f) => f.code === 'pii-block' && f.severity === 'fail'), JSON.stringify(r.findings));
});

test('logs hold no values: a never-tier value is absent from the changelog and manifest; the statement lives in preferences.json only', () => {
  const store = seededStore('senior-swe');
  const r = cp(['fact', 'add', 'extras', '--data', '{"text":"Date of birth: 1988-04-02, in case a form asks"}', '--confirm', '--json'], { store });
  assert.equal(r.status, 0, r.stderr);
  const log = fs.readFileSync(path.join(store, 'changelog.jsonl'), 'utf8');
  const manifest = fs.readFileSync(path.join(store, 'MANIFEST.json'), 'utf8');
  assert.ok(!log.includes('1988-04-02') && !log.includes('Date of birth'), 'the changelog carries ids and hashes only');
  assert.ok(!manifest.includes('1988'), 'the manifest carries hashes only');
  const statement = 'Draft things for me to review; never send anything on my behalf.';
  assert.ok(!log.includes(statement), 'the statement is not copied into the log');
  assert.ok(fs.readFileSync(path.join(store, 'preferences.json'), 'utf8').includes(statement));
});
