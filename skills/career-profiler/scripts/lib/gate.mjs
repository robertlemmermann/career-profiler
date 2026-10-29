// The automation-preference gate (preferences.json). Nothing else runs until a record exists and
// verifies. A corrupt record is quarantined and must be re-made from a fresh statement by the
// user; a store whose writing process fails its probe is `degraded` until `doctor --repair` passes.

import fs from 'node:fs';
import path from 'node:path';
import {
  PREFS_SCHEMA, STORE_VERSION, AUTOMATION_VALUES, exists, readJson, tryJson, writeJsonAtomic, nowIso, sha256, recordHash, skillVersion,
  usageError, unverifiable, CpError, EXIT, readText,
} from './core.mjs';
import { storePaths, storeExists, appendChangelog, readChangelog, writeManifest, updateManifestFields, readManifest, verifyManifest, quarantineFile, ensureDirs } from './store.mjs';

export const GATE_EXEMPT = new Set(['gate', 'doctor', 'help']);
export const STORE_EXEMPT_SUBCOMMANDS = new Set(['init', 'path', 'validate', 'changelog', 'backup', 'accept', 'sync']);
const PROBE_INTERVAL_MS = 24 * 3600 * 1000;

export const describeAutomation = {
  off: 'no job-board watching at all; profile and tailored applications only, each on request',
  alert: 'watch the boards you subscribe to and put matches in the inbox; nothing is drafted until you ask',
  draft: 'watch and, for each match, draft a cited resume and cover letter for your review; nothing is sent',
  prepare: 'draft, finalize and prepare cited answers to common screening questions for your review; nothing is submitted',
};

/** Build a preference record from a statement. */
export function makeRecord({ automation, statement, storeDir }) {
  if (!AUTOMATION_VALUES.includes(automation)) throw usageError(`--automation must be one of ${AUTOMATION_VALUES.join(', ')}`);
  const text = String(statement || '').trim();
  if (text.length < 3 || text.length > 600) throw usageError('--statement must be the user\'s own words (3 to 600 characters)');
  const record = { schema: PREFS_SCHEMA, automation, submit: 'never', statement: text, recorded_at: nowIso(), skill_version: skillVersion(), store_version: STORE_VERSION };
  record.hash = recordHash(record);
  return record;
}

const fileHash = (f) => sha256(readText(f).replace(/\r\n/g, '\n'));

/**
 * Check the record. Returns `{ state: ok|missing|corrupt|degraded, remake_reason, hint, record, checks[] }`.
 * `quarantine: true` moves a corrupt file aside (the default for commands; `doctor` reports only).
 */
export function checkGate(dir, { quarantine = true, probe = true } = {}) {
  const paths = storePaths(dir);
  const checks = [];
  const fail = (reason, detail) => ({ state: reason === 'missing' ? 'missing' : 'corrupt', remake_reason: reason, detail, checks, record: null, hint: null });
  if (!storeExists(dir)) return { state: 'missing', remake_reason: 'no_store', detail: 'no store yet', checks, record: null, hint: null };
  if (!exists(paths.preferences)) return fail('missing', 'no preferences.json');
  checks.push('exists');
  const raw = readText(paths.preferences);
  const rec = tryJson(raw);
  let hint = null;
  const quarantineNow = () => { if (quarantine) { const q = quarantineFile(paths, paths.preferences, 'preferences'); try { appendChangelog(paths, { op: 'preference.quarantined', ids: [], before_sha: null, after_sha: null, note: path.basename(q || '') }); } catch {} writeManifestSafe(paths); return q; } return null; };
  const corrupt = (reason, detail) => { if (rec && typeof rec.statement === 'string') hint = rec.statement; const q = quarantineNow(); return { ...fail(reason, detail), hint, quarantined: q }; };
  if (!rec) return corrupt('parse', 'preferences.json is not valid JSON');
  checks.push('parses');
  const problems = [];
  if (rec.schema !== PREFS_SCHEMA) problems.push('schema');
  if (!AUTOMATION_VALUES.includes(rec.automation)) problems.push('enum');
  if (rec.submit !== 'never') problems.push('submit');
  if (typeof rec.statement !== 'string' || !rec.statement.trim()) problems.push('statement');
  if (typeof rec.recorded_at !== 'string' || Number.isNaN(Date.parse(rec.recorded_at))) problems.push('recorded_at');
  if (typeof rec.hash !== 'string') problems.push('hash-missing');
  if (problems.length) return corrupt(problems.includes('enum') ? 'enum' : 'schema', `invalid fields: ${problems.join(', ')}`);
  checks.push('schema', 'enum');
  if (recordHash(rec) !== rec.hash) return corrupt('hash', 'the record hash does not match its content');
  checks.push('hash');
  if (typeof rec.store_version === 'number' && rec.store_version > STORE_VERSION) return { state: 'degraded', remake_reason: 'version', detail: `record store_version ${rec.store_version} is newer than ${STORE_VERSION}`, checks, record: rec, hint: rec.statement };
  const log = readChangelog(paths);
  const last = [...log].reverse().find((e) => e.op === 'preference.set');
  if (!last) return corrupt('journal', 'no preference.set entry in changelog.jsonl');
  if (last.record_hash !== rec.hash) return corrupt('journal', 'the changelog records a different preference than the file holds');
  checks.push('changelog');
  const mv = verifyManifest(paths);
  const degraded = [];
  if (mv.missing_manifest) degraded.push('manifest missing');
  else if (mv.drift.length) degraded.push(`manifest drift: ${mv.drift.join(', ')}`);
  checks.push('manifest');
  if (probe) {
    const m = readManifest(paths);
    const due = !m || !m.last_probe_at || Date.now() - Date.parse(m.last_probe_at) > PROBE_INTERVAL_MS;
    if (due) { const pr = probeStore(paths); if (!pr.ok) degraded.push(`write probe failed at ${pr.failed_step}: ${pr.error}`); }
  }
  if (degraded.length) return { state: 'degraded', remake_reason: null, detail: degraded.join('; '), checks, record: rec, hint: rec.statement, required_action: 'doctor --repair' };
  return { state: 'ok', remake_reason: null, detail: null, checks, record: rec, hint: null };
}

function writeManifestSafe(paths) { try { writeManifest(paths); } catch {} }

/** Write a fresh record: file, changelog entry, manifest; then verify it end to end. */
export function recordGate(dir, { automation, statement, confirm }) {
  if (!confirm) throw usageError('gate record needs --confirm: the user must have confirmed the statement in conversation (--yes does not count)');
  const paths = storePaths(dir);
  if (!storeExists(dir)) throw new CpError(EXIT.ENV, 'NO_STORE', `no store at ${dir}; run "store init" first`);
  ensureDirs(paths);
  const record = makeRecord({ automation, statement, storeDir: dir });
  if (exists(paths.preferences)) quarantineFile(paths, paths.preferences, 'preferences-previous');
  writeJsonAtomic(paths.preferences, record, { mode: 0o600 });
  appendChangelog(paths, { op: 'preference.set', ids: [], before_sha: null, after_sha: null, record_hash: record.hash, automation, note: 'recorded with --confirm' });
  writeManifest(paths);
  const check = checkGate(dir, { quarantine: false, probe: true });
  if (check.state !== 'ok') throw unverifiable('GATE_UNVERIFIED', `the record was written but does not verify (${check.state}: ${check.detail}); run "doctor --repair"`, check);
  return { record, check };
}

/** Write-fsync-read-hash-delete a sentinel; record the result in the manifest. */
export function probeStore(paths) {
  const steps = [];
  let failed = null;
  let error = null;
  try {
    fs.mkdirSync(paths.probe, { recursive: true, mode: 0o700 }); steps.push('mkdir');
    const f = path.join(paths.probe, `probe-${process.pid}.json`);
    const payload = JSON.stringify({ at: nowIso(), nonce: Math.random().toString(36).slice(2) });
    writeJsonAtomic(f, JSON.parse(payload), { mode: 0o600 }); steps.push('write');
    const back = readJson(f); steps.push('read');
    if (JSON.stringify(back) !== JSON.stringify(JSON.parse(payload))) throw new Error('read back differs from what was written');
    steps.push('verify');
    fs.unlinkSync(f); steps.push('delete');
  } catch (err) { failed = ['mkdir', 'write', 'read', 'verify', 'delete'][steps.length]; error = err.message; }
  const ok = failed == null;
  try { updateManifestFields(paths, { last_probe_at: nowIso(), last_probe_ok: ok }); } catch {}
  return { ok, steps, failed_step: failed, error };
}

/** The gate as commands see it: throws exit 1 `GATE_REQUIRED` unless the state is ok. */
export function requireGate(dir) {
  if (!storeExists(dir)) throw new CpError(EXIT.ENV, 'NO_STORE', `no profile at ${storePaths(dir).profile}; run "store init" (or point --store / CAREER_PROFILER_HOME at an existing store)`);
  const c = checkGate(dir, { quarantine: true, probe: true });
  if (c.state === 'ok') return c;
  const next = c.state === 'degraded' ? `run "doctor --repair", then "gate"` : `ask the user for their automation preference and run "gate record --automation <off|alert|draft|prepare> --statement \"<their words>\" --confirm"`;
  throw new CpError(EXIT.FINDINGS, 'GATE_REQUIRED', `automation preference not recorded (${c.state}${c.remake_reason ? `: ${c.remake_reason}` : ''}${c.detail ? `, ${c.detail}` : ''}); ${next}`, { gate: c, blocked_by: 'preference-gate', required_action: next });
}
