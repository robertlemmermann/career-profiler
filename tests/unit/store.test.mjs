import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cp, seededStore, tmpDir, fixture } from './helpers.mjs';

test('store init, path resolution and refusal to overwrite', () => {
  const store = path.join(tmpDir(), 'store');
  let r = cp(['store', 'init', '--name', 'Test Person', '--json'], { store });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(store, 'profile.json')));
  assert.ok(fs.existsSync(path.join(store, '.gitignore')));
  r = cp(['store', 'init', '--json'], { store });
  assert.equal(r.status, 2, 'second init is a usage error');
  r = cp(['store', 'path', '--json'], { store });
  assert.equal(r.json.resolved_from, 'CAREER_PROFILER_HOME');
  // --store wins over the environment; cwd with a profile.json wins over home.
  const other = path.join(tmpDir(), 'elsewhere');
  r = cp(['store', 'path', '--store', other, '--json'], { store });
  assert.equal(r.json.store, other);
  const cwdStore = seededStore();
  r = cp(['store', 'path', '--json'], { cwd: cwdStore, env: { CAREER_PROFILER_HOME: '' } });
  assert.equal(r.json.resolved_from, 'cwd');
});

test('missing store is exit 3; corrupt store is exit 4', () => {
  const store = path.join(tmpDir(), 'none');
  let r = cp(['fact', 'list', '--json'], { store });
  assert.equal(r.status, 3);
  assert.equal(r.json.error.code, 'NO_STORE');
  fs.mkdirSync(store, { recursive: true });
  fs.writeFileSync(path.join(store, 'profile.json'), '{ not json');
  r = cp(['fact', 'list', '--json'], { store });
  assert.equal(r.status, 4);
});

test('fact add / update / confirm / remove with validation, backups and a chained changelog', () => {
  const store = seededStore();
  let r = cp(['fact', 'add', 'experience', '--data', JSON.stringify({ employer: 'Globex', title: 'Staff Engineer', start: '2015-01', end: '2017-05' }), '--confirm', '--json'], { store });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.json.added[0].id, 'exp-03');
  assert.equal(r.json.added[0].provenance.confirmed, true);
  r = cp(['fact', 'add', 'achievement', '--parent', 'exp-03', '--data', JSON.stringify({ text: 'Shipped the thing, saving 30% of build time.', metrics: [{ value: 30, unit: '%', label: 'build time saved' }] }), '--confirm', '--json'], { store });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.json.added[0].id, 'ach-03-01');
  r = cp(['fact', 'add', 'achievement', '--data', '{"text":"orphan"}', '--confirm', '--json'], { store });
  assert.equal(r.status, 2, 'achievement without a parent is a usage error');
  r = cp(['fact', 'add', 'skills', '--data', '{"name":"React"}', '--confirm', '--json'], { store });
  assert.equal(r.status, 2, 'duplicate skill is a usage error');
  r = cp(['fact', 'add', 'skills', '--data', '{"name":"Vue","level":"guru"}', '--confirm', '--json'], { store });
  assert.equal(r.status, 2, 'invalid level never reaches disk');
  r = cp(['fact', 'add', 'skills', '--data', '{"name":"Vue","level":"intermediate"}', '--unconfirmed', '--json'], { store });
  assert.equal(r.json.added[0].id, 'skill-vue');
  assert.equal(r.json.added[0].provenance.confirmed, false);
  r = cp(['fact', 'confirm', 'skill-vue', '--confirm', '--json'], { store });
  assert.equal(r.json.facts[0].provenance.confirmed, true);
  r = cp(['fact', 'update', 'exp-03', '--data', '{"location":"Berlin","end":null}', '--json'], { store });
  assert.equal(r.status, 2, 'update needs --confirm');
  r = cp(['fact', 'update', 'exp-03', '--data', '{"location":"Berlin","end":null}', '--confirm', '--json'], { store });
  assert.equal(r.json.updated.location, 'Berlin');
  assert.equal('end' in r.json.updated, false, 'null removes a field');
  r = cp(['fact', 'update', 'identity', '--data', '{"headline":"Staff engineer"}', '--confirm', '--json'], { store });
  assert.equal(r.status, 0, r.stderr);
  r = cp(['fact', 'update', 'identity', '--data', '{"headline":"Staff engineer, born 1990-07-14"}', '--confirm', '--json'], { store });
  assert.equal(r.status, 2, 'a detector hit on a singleton is refused');
  r = cp(['fact', 'update', 'identity', '--data', '{"salary":1}', '--confirm', '--json'], { store });
  assert.equal(r.status, 2, 'unknown identity field is a usage error');
  r = cp(['fact', 'get', 'ach-03-01', '--json'], { store });
  assert.equal(r.json.parent, 'exp-03');
  r = cp(['fact', 'remove', 'ach-03-01', '--json'], { store });
  assert.equal(r.status, 2, 'remove needs --confirm');
  r = cp(['fact', 'remove', 'ach-03-01', '--confirm', '--json'], { store });
  assert.equal(r.status, 0);
  r = cp(['fact', 'list', 'experience', '--json'], { store });
  assert.equal(r.json.facts.length, 3);
  assert.ok(r.json.unconfirmed.includes('skill-python'));
  const backups = fs.readdirSync(path.join(store, 'backups'));
  assert.ok(backups.length >= 6, `a backup per write (${backups.length})`);
  r = cp(['store', 'validate', '--json'], { store });
  assert.equal(r.status, 0, r.stdout);
  assert.equal(r.json.changelog.ok, true);
  assert.ok(r.json.changelog.entries >= 8);
  const log = fs.readFileSync(path.join(store, 'changelog.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  for (let i = 1; i < log.length; i++) assert.equal(log[i].prev, log[i - 1].hash, 'chained');
  assert.equal(log[log.length - 1].after_sha.length, 64);
});

test('a hand edit is detected by the changelog and cleared by store accept', () => {
  const store = seededStore();
  const file = path.join(store, 'profile.json');
  const p = JSON.parse(fs.readFileSync(file, 'utf8'));
  p.identity.headline = 'edited by hand';
  fs.writeFileSync(file, JSON.stringify(p, null, 2));
  let r = cp(['store', 'validate', '--json'], { store });
  assert.equal(r.status, 1);
  assert.equal(r.json.changelog.ok, false);
  assert.match(r.json.changelog.problems[0], /outside the scripts/);
  r = cp(['gate', '--json'], { store });
  assert.equal(r.json.state, 'degraded', 'a hand edit degrades the gate');
  r = cp(['doctor', '--repair', '--json'], { store });
  assert.equal(r.json.items.find((i) => i.name === 'profile-file').status, 'invalid', 'repair never blesses a hand edit');
  assert.equal(r.json.gate.state, 'degraded');
  r = cp(['store', 'accept', '--json'], { store });
  assert.equal(r.status, 2, 'accept needs --confirm');
  r = cp(['store', 'accept', '--confirm', '--json'], { store });
  assert.equal(r.status, 0);
  r = cp(['store', 'validate', '--json'], { store });
  assert.equal(r.status, 0);
  assert.equal(cp(['gate', '--json'], { store }).json.state, 'ok');
  // Tampering with a logged entry breaks the chain.
  const logFile = path.join(store, 'changelog.jsonl');
  const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
  const e = JSON.parse(lines[1]); e.op = 'forged'; lines[1] = JSON.stringify(e);
  fs.writeFileSync(logFile, `${lines.join('\n')}\n`);
  r = cp(['store', 'validate', '--json'], { store });
  assert.ok(r.json.changelog.problems.some((x) => /hash mismatch/.test(x)));
});

test('export renders every id; import replaces the profile; dry-run writes nothing', () => {
  const store = seededStore();
  let r = cp(['store', 'export', '--json'], { store });
  for (const id of ['exp-01', 'ach-01-02', 'skill-react', 'edu-01', 'cert-01', 'proj-01']) assert.ok(r.json.content.includes(`[${id}]`), id);
  assert.ok(r.json.content.includes('(unconfirmed)'));
  const before = fs.readFileSync(path.join(store, 'profile.json'), 'utf8');
  r = cp(['fact', 'add', 'extras', '--data', '{"text":"dry"}', '--dry-run', '--confirm', '--json'], { store });
  assert.equal(r.status, 0);
  assert.equal(fs.readFileSync(path.join(store, 'profile.json'), 'utf8'), before);
  r = cp(['store', 'import', fixture('profiles', 'icu-nurse.json'), '--json'], { store });
  assert.equal(r.status, 2, 'import needs --confirm');
  r = cp(['store', 'import', fixture('profiles', 'icu-nurse.json'), '--confirm', '--json'], { store });
  assert.equal(r.status, 0, r.stderr);
  r = cp(['fact', 'list', 'experience', '--json'], { store });
  assert.equal(r.json.facts[0].summary.includes('St. Anselm'), true);
  r = cp(['store', 'import', fixture('jobs', 'lead-react-engineer.txt'), '--confirm', '--json'], { store });
  assert.notEqual(r.status, 0, 'importing a non-profile fails');
});

test('store sync refuses a store nested in a project repository and works in a dedicated one', async () => {
  const store = seededStore();
  let r = cp(['store', 'sync', '--json'], { store });
  assert.equal(r.status, 1);
  assert.match(r.json.reason, /not inside a git repository/);
  const { spawnSync } = await require_child();
  spawnSync('git', ['-C', store, 'init', '-q']);
  r = cp(['store', 'sync', '--json'], { store });
  assert.equal(r.json.committed, true);
  assert.match(r.json.reason, /no origin remote/);
  const nested = path.join(store, 'nested');
  fs.mkdirSync(nested);
  cp(['store', 'init', '--json'], { store: nested });
  r = cp(['store', 'sync', '--json'], { store: nested });
  assert.match(r.json.reason, /inside another repository/);
});
async function require_child() { return import('node:child_process'); }

test('doctor warns when the store sits inside a project repository', async () => {
  const { spawnSync } = await require_child();
  const repo = tmpDir();
  spawnSync('git', ['-C', repo, 'init', '-q']);
  fs.writeFileSync(path.join(repo, 'package.json'), '{"name":"payments-app"}');
  const store = path.join(repo, 'career');
  cp(['store', 'init', '--json'], { store });
  const r = cp(['doctor', '--json'], { store });
  const git = r.json.items.find((i) => i.name === 'git');
  assert.ok(git && git.status === 'warn', JSON.stringify(r.json.items));
  assert.match(git.detail, /inside the repository/);
});

test('fact stage writes to staging/, fact staged lists it, commit needs --confirm and keeps the quote', () => {
  const store = seededStore();
  let r = cp(['fact', 'stage', 'experience', '--data', '{"title":"Staff Engineer","employer":"Globex","start":"2024-02","end":"present"}', '--quote', 'I moved to Globex as a staff engineer in February 2024', '--json'], { store });
  assert.equal(r.status, 0, r.stderr);
  const id = r.json.staged.id;
  assert.match(id, /^T-\d+/);
  assert.ok(fs.readdirSync(path.join(store, 'staging')).some((f) => f.includes(id)));
  r = cp(['fact', 'staged', '--json'], { store });
  assert.ok(r.json.staged.some((s) => s.id === id && s.kind === 'experience'));
  r = cp(['fact', 'commit', id, '--json'], { store });
  assert.equal(r.status, 2, 'commit without --confirm is a usage error');
  r = cp(['fact', 'commit', id, '--confirm', '--json'], { store });
  assert.equal(r.status, 0, r.stderr);
  const added = r.json.added[0];
  assert.equal(added.title, 'Staff Engineer');
  const got = cp(['fact', 'get', added.id, '--json'], { store }).json;
  const entry = got.entry || got.fact || got;
  assert.equal(JSON.stringify(entry).includes('February 2024'), true, 'the quote is kept in provenance');
  assert.ok(!fs.readdirSync(path.join(store, 'staging')).some((f) => f.includes(id)), 'the staged record is dropped after commit');
});
