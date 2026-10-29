import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cp, seededStore, tmpDir, fixture } from './helpers.mjs';

const prefs = (store) => path.join(store, 'preferences.json');
const readPrefs = (store) => JSON.parse(fs.readFileSync(prefs(store), 'utf8'));

test('the gate blocks every data command until the preference is recorded; exempt commands still work', () => {
  const store = seededStore('senior-swe', { gate: false });
  for (const args of [['fact', 'list'], ['interview', 'next'], ['store', 'show'], ['store', 'export'], ['job', 'parse', fixture('jobs', 'prose-only.txt')], ['app', 'list'], ['watch', 'list'], ['resume', 'draft']]) {
    const r = cp([...args, '--json'], { store });
    assert.equal(r.status, 1, `${args.join(' ')} must be blocked`);
    assert.equal(r.json.error.code, 'GATE_REQUIRED', args.join(' '));
    assert.equal(r.json.error.details.blocked_by, 'preference-gate');
  }
  for (const args of [['gate'], ['store', 'path'], ['store', 'validate'], ['store', 'changelog'], ['doctor'], ['help'], ['gate', 'options'], ['pii', 'policy']]) {
    const r = cp([...args, '--json'], { store });
    assert.ok([0, 1].includes(r.status) && !(r.json && r.json.error && r.json.error.code === 'GATE_REQUIRED'), `${args.join(' ')} is exempt`);
  }
  const g = cp(['gate', '--json'], { store });
  assert.equal(g.status, 1);
  assert.equal(g.json.state, 'missing');
  assert.ok(g.json.options.alert && g.json.options.prepare);
});

test('gate record needs --confirm and a valid value; --yes never substitutes', () => {
  const store = seededStore('senior-swe', { gate: false });
  let r = cp(['gate', 'record', '--automation', 'alert', '--statement', 'alerts only please', '--json'], { store });
  assert.equal(r.status, 2);
  r = cp(['gate', 'record', '--automation', 'alert', '--statement', 'alerts only please', '--yes', '--json'], { store });
  assert.equal(r.status, 2, '--yes is not confirmation');
  r = cp(['gate', 'record', '--automation', 'apply', '--statement', 'apply for me', '--confirm', '--json'], { store });
  assert.equal(r.status, 2, 'apply is not a value');
  r = cp(['gate', 'record', '--automation', 'alert', '--statement', 'Only alert me; I will decide what to apply to.', '--confirm', '--json'], { store });
  assert.equal(r.status, 0, r.stderr);
  const p = readPrefs(store);
  assert.equal(p.automation, 'alert');
  assert.equal(p.submit, 'never');
  assert.equal(p.schema, 'career-preferences/1');
  assert.match(p.hash, /^[0-9a-f]{64}$/);
  const log = fs.readFileSync(path.join(store, 'changelog.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const set = log.filter((e) => e.op === 'preference.set');
  assert.equal(set.length, 1);
  assert.equal(set[0].record_hash, p.hash);
  const manifest = JSON.parse(fs.readFileSync(path.join(store, 'MANIFEST.json'), 'utf8'));
  assert.ok(manifest.files['preferences.json']);
  r = cp(['gate', '--json'], { store });
  assert.equal(r.status, 0);
  assert.equal(r.json.state, 'ok');
  r = cp(['fact', 'list', '--json'], { store });
  assert.equal(r.status, 0, 'data commands pass once recorded');
});

const corruptions = {
  'corrupt-json': (store) => fs.writeFileSync(prefs(store), '{ not json'),
  'corrupt-enum': (store) => { const p = readPrefs(store); p.automation = 'apply'; fs.writeFileSync(prefs(store), JSON.stringify(p)); },
  'corrupt-hash': (store) => { const p = readPrefs(store); p.statement = 'edited by hand'; fs.writeFileSync(prefs(store), JSON.stringify(p)); },
  'corrupt-submit': (store) => { const p = readPrefs(store); p.submit = 'always'; fs.writeFileSync(prefs(store), JSON.stringify(p)); },
  'journal-mismatch': (store) => { const f = path.join(store, 'changelog.jsonl'); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').split('\n').filter((l) => !l.includes('preference.set')).join('\n')); },
  'missing': (store) => fs.unlinkSync(prefs(store)),
};
for (const [name, corrupt] of Object.entries(corruptions)) {
  test(`corruption "${name}" is detected, quarantined and requires a remake`, () => {
    const store = seededStore();
    corrupt(store);
    const r = cp(['fact', 'list', '--json'], { store });
    assert.equal(r.status, 1, name);
    assert.equal(r.json.error.code, 'GATE_REQUIRED');
    const state = r.json.error.details.gate.state;
    assert.ok(['missing', 'corrupt'].includes(state), `${name}: ${state}`);
    if (name !== 'missing') {
      assert.ok(!fs.existsSync(prefs(store)), `${name}: the bad file is moved aside`);
      const q = fs.readdirSync(path.join(store, 'quarantine'));
      assert.ok(q.some((f) => f.startsWith('preferences.')), `${name}: quarantined`);
    }
    if (['corrupt-enum', 'corrupt-hash', 'corrupt-submit', 'journal-mismatch'].includes(name)) assert.ok(r.json.error.details.gate.hint, 'the old statement is offered as a hint');
    // Remake from a fresh statement passes again.
    const rec = cp(['gate', 'record', '--automation', 'draft', '--statement', 'Draft for my review, never send anything.', '--confirm', '--json'], { store });
    assert.equal(rec.status, 0, rec.stderr);
    assert.equal(cp(['gate', '--json'], { store }).json.state, 'ok');
  });
}

test('manifest drift is degraded, not corrupt; doctor --repair fixes it and logs the repair', () => {
  const store = seededStore();
  const mf = path.join(store, 'MANIFEST.json');
  const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
  m.files['preferences.json'] = 'deadbeef';
  fs.writeFileSync(mf, JSON.stringify(m));
  let r = cp(['gate', '--json'], { store });
  assert.equal(r.status, 1);
  assert.equal(r.json.state, 'degraded');
  assert.ok(fs.existsSync(prefs(store)), 'degraded never quarantines the record');
  r = cp(['doctor', '--json'], { store });
  assert.ok(r.json.items.find((i) => i.name === 'manifest').status === 'warn');
  r = cp(['doctor', '--repair', '--json'], { store });
  assert.ok(r.json.repairs.some((x) => /manifest/.test(x)), JSON.stringify(r.json.repairs));
  assert.equal(r.json.items.find((i) => i.name === 'after-repair').status, 'ok');
  assert.equal(cp(['gate', '--json'], { store }).json.state, 'ok');
  const log = fs.readFileSync(path.join(store, 'changelog.jsonl'), 'utf8');
  assert.ok(log.includes('"op":"repair"'));
});

test('a broken changelog chain is repaired by quarantining the tail; the preference must then be re-recorded if its entry was lost', () => {
  const store = seededStore();
  const f = path.join(store, 'changelog.jsonl');
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n');
  const e = JSON.parse(lines[1]); e.note = 'forged'; lines[1] = JSON.stringify(e);
  fs.writeFileSync(f, `${lines.join('\n')}\n`);
  let r = cp(['doctor', '--repair', '--json'], { store });
  assert.ok(r.json.repairs.some((x) => /chain/.test(x)), JSON.stringify(r.json.repairs));
  assert.ok(fs.readdirSync(path.join(store, 'quarantine')).some((x) => x.startsWith('changelog.tail')));
  const after = r.json.items.find((i) => i.name === 'after-repair');
  assert.equal(after.status, 'warn', 'the preference.set entry was in the lost tail');
  assert.match(after.detail, /repaired_but_unverified/);
  r = cp(['gate', 'record', '--automation', 'draft', '--statement', 'Draft for my review.', '--confirm', '--json'], { store });
  assert.equal(r.status, 0);
  assert.equal(cp(['doctor', '--json'], { store }).json.gate.state, 'ok');
});

test('the write probe runs, records itself and fails loudly on an unwritable store', () => {
  const store = seededStore();
  let r = cp(['gate', 'probe', '--json'], { store });
  assert.equal(r.status, 0);
  assert.deepEqual(r.json.steps, ['mkdir', 'write', 'read', 'verify', 'delete']);
  const m = JSON.parse(fs.readFileSync(path.join(store, 'MANIFEST.json'), 'utf8'));
  assert.ok(m.last_probe_at && m.last_probe_ok === true);
  if (process.getuid && process.getuid() === 0) return; // root ignores modes
  fs.chmodSync(path.join(store, '.probe'), 0o500);
  r = cp(['gate', 'probe', '--json'], { store });
  fs.chmodSync(path.join(store, '.probe'), 0o700);
  assert.equal(r.status, 1);
  assert.equal(r.json.ok, false);
});

test('doctor repairs missing directories and permissions', () => {
  const store = seededStore();
  fs.rmSync(path.join(store, 'backups'), { recursive: true, force: true });
  fs.chmodSync(path.join(store, 'profile.json'), 0o644);
  let r = cp(['doctor', '--json'], { store });
  assert.equal(r.json.items.find((i) => i.name === 'directories').status, 'warn');
  if (process.platform !== 'win32') assert.equal(r.json.items.find((i) => i.name === 'permissions').status, 'warn');
  r = cp(['doctor', '--repair', '--json'], { store });
  assert.ok(fs.existsSync(path.join(store, 'backups')));
  if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(store, 'profile.json')).mode & 0o077, 0);
  assert.equal(r.json.gate.state, 'ok');
});

test('a store from a newer layout is refused', () => {
  const store = seededStore();
  const mf = path.join(store, 'MANIFEST.json');
  const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
  m.store_version = 99;
  fs.writeFileSync(mf, JSON.stringify(m));
  const r = cp(['fact', 'list', '--json'], { store });
  assert.equal(r.status, 3);
  assert.equal(r.json.error.code, 'STORE_NEWER');
});
