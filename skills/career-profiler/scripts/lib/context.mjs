// Command context: the resolved store, and the gate that every data command must pass.
import path from 'node:path';
import { resolveStore, storePaths, loadProfile } from './store.mjs';
import { requireGate } from './gate.mjs';

export const ctx = (values) => {
  const cwd = values.cwd ? path.resolve(values.cwd) : process.cwd();
  const { dir, source } = resolveStore({ store: values.store, cwd });
  return { cwd, dir, source, paths: storePaths(dir) };
};

/** A loaded profile behind the gate: exit 1 GATE_REQUIRED until the preference record verifies. */
export const need = (values, { gate = true } = {}) => {
  const c = ctx(values);
  const { profile } = loadProfile(c.dir); // exit 3 without a store, 4 when it is corrupt
  const g = gate ? requireGate(c.dir) : null; // exit 1 until the preference record verifies
  return { ...c, profile, gate: g };
};
