// Shared runtime for every cp.mjs command: options, output, errors, files, paths.
// Zero dependencies; Node 22+. Same conventions as agentic-developer-companion: one JSON
// document on stdout with --json, a summary on stderr, exit 0 ok / 1 findings / 2 usage /
// 3 environment / 4 could not verify.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const SKILL_NAME = 'career-profiler';
export const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SCRIPTS_DIR = path.join(SKILL_DIR, 'scripts');
export const ASSETS_DIR = path.join(SKILL_DIR, 'assets');
export const IS_WINDOWS = process.platform === 'win32';
export const PROFILE_SCHEMA = 'career-profile/1';
export const JOB_SCHEMA = 'career-job/1';
export const MATCH_SCHEMA = 'career-match/1';
export const CHECK_SCHEMA = 'career-resume-check/1';
export const STORE_FILE = 'profile.json';

export const EXIT = Object.freeze({ OK: 0, FINDINGS: 1, USAGE: 2, ENV: 3, UNVERIFIABLE: 4 });

export class CpError extends Error {
  constructor(exit, code, message, details) {
    super(message);
    this.exit = exit;
    this.code = code;
    this.details = details;
  }
}
export const usageError = (message, details) => new CpError(EXIT.USAGE, 'USAGE', message, details);
export const envError = (code, message, details) => new CpError(EXIT.ENV, code, message, details);
export const unverifiable = (code, message, details) => new CpError(EXIT.UNVERIFIABLE, code, message, details);

let cachedVersion;
export function skillVersion() {
  if (cachedVersion) return cachedVersion;
  try {
    const text = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
    const m = /^\s+version:\s*["']?([0-9][^"'\s]*)["']?\s*$/m.exec(text.split(/^---\s*$/m)[1] || '');
    cachedVersion = m ? m[1] : '0.0.0';
  } catch {
    cachedVersion = '0.0.0';
  }
  return cachedVersion;
}
export const generatedBy = () => `${SKILL_NAME} ${skillVersion()}`;

const GLOBAL_OPTIONS = Object.freeze({
  json: { type: 'boolean' },
  store: { type: 'string' },
  cwd: { type: 'string' },
  'dry-run': { type: 'boolean' },
  yes: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
});

/** Parse argv with the global options merged in. Throws a usage error (exit 2) on bad input. */
export function parseOpts(argv, options = {}, { positionals = true } = {}) {
  try {
    const { values, positionals: pos } = parseArgs({
      args: argv, options: { ...GLOBAL_OPTIONS, ...options }, allowPositionals: positionals, strict: true,
    });
    return { values, positionals: pos };
  } catch (err) {
    throw usageError(err.message);
  }
}

export function numberOption(values, name, def = null, { integer = false, allowZero = false } = {}) {
  const raw = values ? values[name] : null;
  if (raw == null || String(raw).trim() === '') return def;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || (allowZero ? n < 0 : n <= 0) || (integer && !Number.isInteger(n))) {
    throw usageError(`--${name} must be a ${allowZero ? 'non-negative' : 'positive'} ${integer ? 'integer' : 'number'} (got "${raw}")`);
  }
  return n;
}

// ---------------------------------------------------------------------------
// Output

/** JSON with every non-ASCII character escaped, so Windows consoles and logs never mangle it. */
export function asciiJson(value, indent = 2) {
  return JSON.stringify(value, null, indent).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export const nowIso = () => new Date().toISOString();
export const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export const truncate = (s, n = 400) => (s.length > n ? `${s.slice(0, n - 3)}...` : s);

/** Deliver a command result: `{ result, human, exit }`. */
export function finish(res, { json } = {}) {
  const payload = res.result ?? {};
  if (json) process.stdout.write(`${asciiJson(payload)}\n`);
  else process.stdout.write(`${typeof res.human === 'string' ? res.human : asciiJson(payload)}\n`);
  if (res.summary) process.stderr.write(`${res.summary}\n`);
  process.exitCode = res.exit ?? EXIT.OK;
}

export function reportError(err, { json } = {}) {
  const exit = err instanceof CpError ? err.exit : EXIT.UNVERIFIABLE;
  const code = err instanceof CpError ? err.code : 'INTERNAL';
  const payload = { error: { code, message: String(err && err.message ? err.message : err), details: err && err.details } };
  if (json) process.stdout.write(`${asciiJson(payload)}\n`);
  process.stderr.write(`${SKILL_NAME}: ${payload.error.message}\n`);
  if (!(err instanceof CpError) && process.env.CP_DEBUG) process.stderr.write(`${err.stack}\n`);
  process.exitCode = exit;
}

// ---------------------------------------------------------------------------
// Files

export const exists = (p) => { try { fs.statSync(p); return true; } catch { return false; } };
export const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
export const readText = (p) => fs.readFileSync(p, 'utf8');
export function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (err) {
    throw unverifiable('BAD_JSON', `cannot parse JSON in ${p}: ${err.message}`);
  }
}
export function tryJson(text) { try { return JSON.parse(text); } catch { return undefined; } }

/** Write atomically: temp file next to the target, then rename. */
export function writeFileAtomic(file, content, { mode } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, content, mode != null ? { mode } : undefined);
  fs.renameSync(tmp, file);
}
export const writeJsonAtomic = (file, value, opts) => writeFileAtomic(file, `${asciiJson(value)}\n`, opts);

/** Read stdin fully (used for `-` inputs). */
export function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

/** Read a positional input: a file path, `-` for stdin, or literal text when `--text`. */
export function readInput(spec, { allowText = false } = {}) {
  if (spec === '-' ) return { text: readStdin(), source: 'stdin' };
  if (spec && exists(spec) && !isDir(spec)) return { text: readText(spec), source: path.resolve(spec) };
  if (allowText && spec) return { text: spec, source: 'inline' };
  throw usageError(`input not found: ${spec || '(none)'}`);
}

/** Home directory that respects HOME, USERPROFILE and a test override. */
export const homeDir = (env = process.env) => env.CAREER_PROFILER_TEST_HOME || os.homedir();

export const slugify = (s, max = 48) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
  .trim().replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max) || 'untitled';

export const uniq = (arr) => [...new Set(arr)];
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
export const plural = (n, s) => `${n} ${s}${n === 1 ? '' : 's'}`;
