import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProfileFixture } from './helpers.mjs';
import { emptyProfile } from '../../skills/career-profiler/scripts/lib/schema.mjs';
import { coverage, nextQuestions, markAsked, domainsOf } from '../../skills/career-profiler/scripts/lib/interview.mjs';

test('an empty profile asks for identity, documents and work history first', () => {
  const c = coverage(emptyProfile());
  assert.ok(c.score < 10);
  assert.equal(c.resume_ready, false);
  const first = c.gaps.slice(0, 5).map((g) => g.code);
  assert.ok(first.includes('identity.name'));
  assert.ok(first.includes('experience.none'));
  assert.ok(first.includes('documents.none'));
  assert.ok(c.gaps.every((g) => typeof g.question === 'string' && !/\{\w+\}/.test(g.question)), 'no unfilled placeholders');
});

test('a full profile is resume-ready and only has optional gaps; markAsked clears them', () => {
  const p = loadProfileFixture('senior-swe');
  const c = coverage(p);
  assert.ok(c.score >= 85, `score ${c.score}`);
  assert.equal(c.resume_ready, true);
  assert.ok(c.domains.includes('engineering') && c.domains.includes('leadership'));
  const keys = c.gaps.map((g) => g.key);
  assert.ok(keys.includes('volunteering.none'));
  markAsked(p, ['volunteering.none', 'awards.none', 'experience.next:exp-02']);
  const after = coverage(p);
  assert.ok(!after.gaps.some((g) => ['volunteering.none', 'awards.none', 'experience.next:exp-02'].includes(g.key)));
  assert.ok(after.score > c.score);
});

test('thin roles get scope, stack, achievement and metric questions with domain probes', () => {
  const p = loadProfileFixture('icu-nurse');
  p.experience[1].achievements = [{ id: 'ach-02-01', text: 'Responsible for patient care', provenance: { source: 'interview', confirmed: true } }];
  delete p.experience[1].scope;
  const c = coverage(p);
  const keys = c.gaps.map((g) => g.key);
  assert.ok(keys.includes('experience.scope:exp-02'));
  assert.ok(keys.includes('experience.achievements.few:exp-02'));
  assert.ok(keys.includes('experience.metrics.none:exp-02'));
  assert.ok(keys.includes('achievement.weak:ach-02-01'));
  const q = c.gaps.find((g) => g.key === 'experience.achievements.few:exp-02');
  assert.ok(q.question.includes('Dane County Medical Center') && q.question.includes('2 more'));
  assert.ok(q.probes.some((x) => /patient|unit/i.test(x)), 'healthcare probes apply');
  assert.ok(domainsOf(p).includes('healthcare'));
  const n = nextQuestions(p, { max: 2, focus: 'exp-02' });
  assert.equal(n.questions.length, 2);
  assert.ok(n.questions.every((x) => x.about === 'exp-02'));
});
