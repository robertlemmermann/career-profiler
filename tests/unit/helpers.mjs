// Shared helpers for the unit tests: temp stores seeded from fixtures, the CLI runner.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SKILL = path.join(ROOT, 'skills', 'career-profiler');
export const CP = path.join(SKILL, 'scripts', 'cp.mjs');
export const FIXTURES = path.join(ROOT, 'tests', 'fixtures');
export const fixture = (...p) => path.join(FIXTURES, ...p);
export const readFixture = (...p) => fs.readFileSync(fixture(...p), 'utf8');
export const loadProfileFixture = (name) => JSON.parse(readFixture('profiles', `${name}.json`));

export function tmpDir(prefix = 'cp-test-') {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return fs.realpathSync.native(d);
}

/** Run the CLI with a clean environment pointed at `store`. Returns { status, stdout, stderr, json }. */
export function cp(args, { store, cwd, input, env = {} } = {}) {
  const base = {};
  for (const [k, v] of Object.entries(process.env)) if (!/^(CAREER_PROFILER_|CLAUDE|COPILOT|CODEX_)/.test(k)) base[k] = v;
  const r = spawnSync(process.execPath, [CP, ...args], {
    cwd: cwd || (store && fs.existsSync(store) ? store : os.tmpdir()), input, encoding: 'utf8',
    env: { ...base, CAREER_PROFILER_HOME: store || path.join(tmpDir(), 'store'), CAREER_PROFILER_TEST_HOME: tmpDir(), ...env },
  });
  let json;
  if (args.includes('--json')) { try { json = JSON.parse(r.stdout); } catch { json = undefined; } }
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, json };
}

/** A store seeded with a fixture profile, with the automation preference recorded; returns the store directory. */
export function seededStore(name = 'senior-swe', { gate = true, automation = 'draft' } = {}) {
  const store = path.join(tmpDir(), 'store');
  const init = cp(['store', 'init', '--json'], { store });
  if (init.status !== 0) throw new Error(`store init failed: ${init.stderr}`);
  if (gate) {
    recordGate(store, automation);
    const imp = cp(['store', 'import', fixture('profiles', `${name}.json`), '--confirm', '--json'], { store });
    if (imp.status !== 0) throw new Error(`store import failed: ${imp.stderr}`);
  } else {
    // No gate yet: the fixture is copied in and accepted, the way a user restoring a backup would.
    fs.copyFileSync(fixture('profiles', `${name}.json`), path.join(store, 'profile.json'));
    const acc = cp(['store', 'accept', '--confirm', '--json'], { store });
    if (acc.status !== 0) throw new Error(`store accept failed: ${acc.stderr}`);
  }
  return store;
}

export function recordGate(store, automation = 'draft', statement = 'Draft things for me to review; never send anything on my behalf.') {
  const r = cp(['gate', 'record', '--automation', automation, '--statement', statement, '--confirm', '--json'], { store });
  if (r.status !== 0) throw new Error(`gate record failed: ${r.stderr} ${r.stdout}`);
  return r.json;
}
