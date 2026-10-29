import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SKILL, loadProfileFixture } from './helpers.mjs';
import { validateProfile, emptyProfile, nextId, skillId, indexProfile, SECTIONS, CHILDREN, SINGLETONS } from '../../skills/career-profiler/scripts/lib/schema.mjs';

test('fixture profiles are valid', () => {
  for (const name of ['senior-swe', 'icu-nurse']) {
    const v = validateProfile(loadProfileFixture(name));
    assert.deepEqual(v.errors, [], `${name}: ${JSON.stringify(v.errors)}`);
  }
});

test('an empty profile is valid and has every section', () => {
  const p = emptyProfile({ name: 'X' });
  assert.equal(validateProfile(p).ok, true);
  for (const s of Object.keys(SECTIONS)) assert.ok(Array.isArray(p[s]), s);
});

test('validation reports the classic mistakes', () => {
  const p = loadProfileFixture('senior-swe');
  p.experience[0].start = '03/2022';
  p.experience[1].end = '2015-01';
  p.skills[0].level = 'ninja';
  p.skills[1].provenance = { source: 'gossip', confirmed: 'yes' };
  delete p.education[0].institution;
  p.certifications.push({ ...p.certifications[0] });
  const v = validateProfile(p);
  const paths = v.errors.map((e) => e.path);
  assert.ok(paths.includes('experience[0].start'));
  assert.ok(paths.includes('experience[1].end'));
  assert.ok(paths.includes('skills[0].level'));
  assert.ok(paths.includes('skills[1].provenance.source'));
  assert.ok(paths.includes('skills[1].provenance.confirmed'));
  assert.ok(paths.includes('education[0].institution'));
  assert.ok(paths.some((x) => x.startsWith('certifications[1]')), 'duplicate id');
});

test('unknown fields warn, dangling references warn, nothing fails', () => {
  const p = loadProfileFixture('senior-swe');
  p.experience[0].salary = 1;
  p.skills[0].evidence.push('ach-99-99');
  const v = validateProfile(p);
  assert.equal(v.ok, true);
  assert.ok(v.warnings.some((w) => w.path === 'experience[0].salary'));
  assert.ok(v.warnings.some((w) => w.message.includes('ach-99-99')));
});

test('ids: next ids never collide, skill ids are slugs', () => {
  const p = loadProfileFixture('senior-swe');
  assert.equal(nextId(p, 'experience'), 'exp-03');
  assert.equal(nextId(p, 'achievement', p.experience[0]), 'ach-01-05');
  assert.equal(skillId(p, 'Vue.js'), 'skill-vue-js');
  assert.equal(skillId(p, 'React'), nextId(p, 'skills'), 'collision falls back to numeric');
  assert.equal(indexProfile(p).get('ach-02-01').parent.id, 'exp-02');
});

test('assets/schema/profile.schema.json names every section, child and singleton', () => {
  const doc = JSON.parse(fs.readFileSync(path.join(SKILL, 'assets', 'schema', 'profile.schema.json'), 'utf8'));
  for (const s of [...Object.keys(SECTIONS), ...Object.keys(SINGLETONS)]) assert.ok(doc.properties[s], `schema documents ${s}`);
  for (const c of Object.keys(CHILDREN)) assert.ok(doc.$defs[c], `schema documents child ${c}`);
  for (const [s, spec] of Object.entries(SECTIONS)) {
    const item = doc.properties[s].items;
    const ref = item.$ref ? doc.$defs[item.$ref.replace('#/$defs/', '')] : item;
    for (const f of spec.required) assert.ok((ref.required || []).includes(f), `${s}.${f} required in schema`);
  }
});
