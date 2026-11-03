import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { checkpoint, restoreCheckpoint } from '../lib/astra-checkpoint.mjs';
import { subject } from '../astra-session.mjs';
import { verdict } from '../astra-evidence.mjs';

test('checkpoint restores preference, staged facts and command history after workspace loss', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-checkpoint-test-'));
  try {
    const work = path.join(root, 'work');
    fs.mkdirSync(path.join(work, 'store/staging'), { recursive: true });
    fs.mkdirSync(path.join(work, 'skill'));
    fs.writeFileSync(path.join(work, 'skill/SKILL.md'), 'runtime copied separately');
    for (const [rel, content] of Object.entries({ 'store/preferences.json': '{"automation":"alert"}', 'store/staging/T-001.json': '{"items":[{"name":"Example"}]}', 'commands.jsonl': '{"argv":["fact","stage"]}\n' })) fs.writeFileSync(path.join(work, rel), content, { mode: 0o600 });
    const file = path.join(root, 'saved.json');
    checkpoint(work, file);
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(saved.files['skill/SKILL.md'], undefined);
    fs.rmSync(work, { recursive: true });
    restoreCheckpoint(work, file);
    assert.equal(fs.readFileSync(path.join(work, 'store/staging/T-001.json'), 'utf8'), '{"items":[{"name":"Example"}]}');
    assert.equal(fs.readFileSync(path.join(work, 'store/preferences.json'), 'utf8'), '{"automation":"alert"}');
    saved.files['store/preferences.json'].base64 = Buffer.from('tampered').toString('base64');
    fs.writeFileSync(file, JSON.stringify(saved));
    assert.throws(() => restoreCheckpoint(path.join(root, 'other'), file), /checksum mismatch/);
    assert.equal(fs.existsSync(path.join(root, 'other')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Astra evidence rejects missing provenance, wrong model, partial runs and stale inputs', () => {
  const row = { kind: 'trigger', item: 'pos-01', host: 'chatgpt-work-fresh-thread', model: 'gpt-6-astra', effort: 'high', subject: subject('trigger', 'pos-01'), status: 'completed', transcript: [{ role: 'agent', text: 'A response' }], reads: [{ path: 'SKILL.md' }] };
  assert.equal(verdict(row), 'incomplete');
  assert.equal(verdict({ ...row, agent_id: 'worker' }), 'pass');
  assert.equal(verdict({ ...row, agent_id: 'worker', model: 'other-model' }), 'incomplete');
  assert.equal(verdict({ ...row, agent_id: 'worker', status: 'pending' }), 'incomplete');
  assert.equal(verdict({ ...row, agent_id: 'worker', subject: 'old' }), 'stale');
  assert.equal(verdict({ ...row, agent_id: 'worker', reads: [] }), 'fail');
});

test('semantic cases need an independent judge as well as deterministic checks', () => {
  const row = { kind: 'case', item: 'resume-without-posting', host: 'chatgpt-work-fresh-thread', model: 'gpt-6-astra', effort: 'high', subject: subject('case', 'resume-without-posting'), status: 'completed', agent_id: 'worker', transcript: [{ role: 'agent', text: 'In guidance-only mode, please provide the job posting.' }], reads: [{ path: 'SKILL.md' }] };
  assert.equal(verdict(row), 'ungraded');
  assert.equal(verdict({ ...row, judgments: [{ agent_id: 'worker', model: 'gpt-6-astra' }] }), 'ungraded');
});
