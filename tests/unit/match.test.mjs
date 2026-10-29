import test from 'node:test';
import assert from 'node:assert/strict';
import { readFixture, loadProfileFixture } from './helpers.mjs';
import { parseJob } from '../../skills/career-profiler/scripts/lib/job.mjs';
import { matchJob, totalYears, highestSeniority } from '../../skills/career-profiler/scripts/lib/match.mjs';

const swe = () => loadProfileFixture('senior-swe');
const nurse = () => loadProfileFixture('icu-nurse');

test('senior engineer vs lead react posting: strong on React, gaps on Kubernetes, never on unconfirmed facts', () => {
  const job = parseJob(readFixture('jobs', 'lead-react-engineer.txt'), { source: 'fixture' });
  const m = matchJob(swe(), job);
  assert.equal(m.schema, 'career-match/1');
  const k = Object.fromEntries(m.keywords.map((x) => [x.term, x]));
  assert.equal(k.React.status, 'strong');
  assert.ok(k.React.evidence.includes('skill-react'));
  assert.equal(k.TypeScript.status, 'strong');
  assert.equal(k['Technical Leadership'].status, 'strong');
  assert.equal(k.Kubernetes.status, 'missing');
  assert.equal(k.Communication.status, 'missing');
  assert.ok(m.gaps.some((g) => g.term === 'Kubernetes' && /stays out of the resume/.test(g.question)));
  assert.ok(m.gaps.every((g) => g.term !== 'React'));
  assert.ok(m.fit >= 0.6 && m.fit <= 0.85, `fit ${m.fit}`);
  assert.equal(m.years.verdict, 'meets');
  assert.equal(m.seniority.verdict, 'one-step-up');
  // Python is unconfirmed in the fixture: it must not count as evidence.
  const py = m.keywords.find((x) => x.term === 'Python');
  assert.ok(!py || py.status === 'missing');
  assert.ok(m.requirements.some((r) => r.status === 'strong'));
});

test('nurse profile vs ICU posting fits; nurse profile vs react posting does not', () => {
  const icu = parseJob(readFixture('jobs', 'icu-nurse.txt'), { source: 'fixture' });
  const react = parseJob(readFixture('jobs', 'lead-react-engineer.txt'), { source: 'fixture' });
  const good = matchJob(nurse(), icu);
  const bad = matchJob(nurse(), react);
  assert.ok(good.fit > 0.7, `icu fit ${good.fit}`);
  assert.ok(bad.fit < 0.25, `react fit ${bad.fit}`);
  const k = Object.fromEntries(good.keywords.map((x) => [x.term, x]));
  assert.equal(k['Critical Care'].status, 'strong');
  assert.equal(k.BLS.status, 'strong');
  assert.equal(k.ACLS.status, 'strong');
  assert.equal(k.EHR.status, 'strong', 'Epic alias on the EHR skill');
  assert.ok(good.gaps.length <= 3, JSON.stringify(good.gaps));
  assert.ok(!good.gaps.some((g) => g.term === 'Associate degree'), 'a BSN satisfies an ADN requirement');
  assert.equal(Object.fromEntries(good.keywords.map((x) => [x.term, x]))["Bachelor's degree"].status, 'strong');
});

test('years and seniority helpers', () => {
  assert.equal(totalYears(swe(), '2026-10'), 9.4);
  assert.equal(highestSeniority(swe()), 'senior');
  assert.equal(highestSeniority(nurse()), null);
  const p = swe();
  p.experience.push({ id: 'exp-03', employer: 'X', title: 'Contractor', start: '2018-01', end: '2019-01', provenance: { source: 'interview', confirmed: true } });
  assert.equal(totalYears(p, '2026-10'), 9.4, 'overlapping spans do not double count');
  p.experience.push({ id: 'exp-04', employer: 'Y', title: 'Dev', start: '2010-01', end: '2011-12', provenance: { source: 'interview', confirmed: true } });
  assert.equal(totalYears(p, '2026-10'), 11.4);
});
