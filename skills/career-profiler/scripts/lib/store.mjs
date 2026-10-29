// The fact store on disk: where it lives, loading and saving with validation, the append-only
// hash-chained changelog, backups, Markdown export and the fact CRUD every mode uses.
//
// Layout of a store directory:
//   profile.json      the fact store (career-profile/1), written only by this module
//   changelog.jsonl   one line per write: { seq, at, op, ids[], before_sha, after_sha, prev, hash }
//   backups/          profile.<UTC stamp>.json, the file as it was before each write
//   documents/        files the user supplied (old resumes, exports); never parsed on load
//   applications/     one folder per job application (job.json, match.json, resume.md, ...)

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  STORE_FILE, PROFILE_SCHEMA, exists, isDir, readJson, writeJsonAtomic, writeFileAtomic, nowIso, sha256, asciiJson,
  homeDir, envError, usageError, unverifiable, generatedBy, tryJson,
} from './core.mjs';
import {
  SECTIONS, CHILDREN, SINGLETONS, emptyProfile, validateProfile, indexProfile, nextId, skillId, defaultProvenance,
} from './schema.mjs';

export const DEFAULT_STORE_NAME = '.career-profiler';

/**
 * Where the store is: `--store`, then $CAREER_PROFILER_HOME, then a profile.json in the current
 * directory (a dedicated private repository), then ~/.career-profiler. Returns `{ dir, source }`.
 */
export function resolveStore({ store, cwd = process.cwd(), env = process.env } = {}) {
  if (store) return { dir: path.resolve(cwd, store), source: '--store' };
  if (env.CAREER_PROFILER_HOME) return { dir: path.resolve(cwd, env.CAREER_PROFILER_HOME), source: 'CAREER_PROFILER_HOME' };
  const local = path.join(cwd, STORE_FILE);
  if (exists(local)) {
    const p = tryJson(safeRead(local));
    if (p && p.schema === PROFILE_SCHEMA) return { dir: cwd, source: 'cwd' };
  }
  return { dir: path.join(homeDir(env), DEFAULT_STORE_NAME), source: 'home' };
}

const safeRead = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };

export const storePaths = (dir) => ({
  dir,
  profile: path.join(dir, STORE_FILE),
  changelog: path.join(dir, 'changelog.jsonl'),
  backups: path.join(dir, 'backups'),
  documents: path.join(dir, 'documents'),
  applications: path.join(dir, 'applications'),
});

export function storeExists(dir) { return exists(storePaths(dir).profile); }

/** Create a store. Refuses to overwrite an existing profile unless `force`. */
export function initStore(dir, { name, force = false } = {}) {
  const paths = storePaths(dir);
  if (exists(paths.profile) && !force) throw usageError(`a profile already exists at ${paths.profile} (use --force to replace it; a backup is kept)`);
  for (const d of [paths.dir, paths.backups, paths.documents, paths.applications]) fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  const before = exists(paths.profile) ? backup(paths) : null;
  const profile = emptyProfile({ name });
  writeJsonAtomic(paths.profile, profile, { mode: 0o600 });
  appendChangelog(paths, { op: 'init', ids: [], before_sha: before ? before.sha : null, after_sha: profileSha(profile), note: force ? 'replaced' : 'created' });
  writeGitignore(paths);
  return { paths, profile };
}

/** The sha256 of the profile file exactly as written (asciiJson + newline, LF). */
export const profileSha = (profile) => sha256(`${asciiJson(profile)}\n`);
const fileSha = (text) => sha256(text.replace(/\r\n/g, '\n'));

/** A .gitignore inside the store so a dedicated repository never commits backups or outputs by accident. */
function writeGitignore(paths) {
  const f = path.join(paths.dir, '.gitignore');
  if (exists(f)) return;
  writeFileAtomic(f, ['# career-profiler: backups are local; applications hold generated outputs you may or may not want to keep.',
    'backups/', '*.tmp', ''].join('\n'));
}

/** Load and validate the profile. Throws exit 3 when the store is missing, exit 4 when it is corrupt. */
export function loadProfile(dir, { strict = true } = {}) {
  const paths = storePaths(dir);
  if (!exists(paths.profile)) {
    throw envError('NO_STORE', `no profile at ${paths.profile}; run "store init" (or point --store / CAREER_PROFILER_HOME at an existing store)`);
  }
  const profile = readJson(paths.profile);
  const validation = validateProfile(profile);
  if (strict && !validation.ok) {
    throw unverifiable('INVALID_PROFILE', `profile at ${paths.profile} is invalid: ${validation.errors.slice(0, 5).map((e) => `${e.path}: ${e.message}`).join('; ')}`, validation);
  }
  return { paths, profile, validation };
}

/** Validate, back up the previous file, write, append the changelog. Returns the changelog entry. */
export function saveProfile(paths, profile, { op = 'update', ids = [], note, dryRun = false } = {}) {
  const validation = validateProfile(profile);
  if (!validation.ok) {
    throw usageError(`refusing to write an invalid profile: ${validation.errors.slice(0, 5).map((e) => `${e.path}: ${e.message}`).join('; ')}`, validation);
  }
  profile.meta = { ...(profile.meta || {}), updated: nowIso(), generated_by: generatedBy(), sequence: ((profile.meta && profile.meta.sequence) || 0) + 1 };
  if (dryRun) return { dry_run: true, op, ids, validation };
  const before = exists(paths.profile) ? backup(paths) : null;
  writeJsonAtomic(paths.profile, profile, { mode: 0o600 });
  const entry = appendChangelog(paths, { op, ids, before_sha: before ? before.sha : null, after_sha: profileSha(profile), note });
  pruneBackups(paths);
  return { ...entry, validation };
}

function backup(paths) {
  fs.mkdirSync(paths.backups, { recursive: true, mode: 0o700 });
  const text = fs.readFileSync(paths.profile, 'utf8');
  const stamp = nowIso().replace(/[:.]/g, '-');
  const file = path.join(paths.backups, `profile.${stamp}.json`);
  fs.writeFileSync(file, text, { mode: 0o600 });
  return { file, sha: fileSha(text) };
}

const KEEP_BACKUPS = 50;
function pruneBackups(paths) {
  let files = [];
  try { files = fs.readdirSync(paths.backups).filter((f) => /^profile\..*\.json$/.test(f)).sort(); } catch { return; }
  for (const f of files.slice(0, Math.max(0, files.length - KEEP_BACKUPS))) { try { fs.unlinkSync(path.join(paths.backups, f)); } catch {} }
}

export function readChangelog(paths) {
  if (!exists(paths.changelog)) return [];
  return fs.readFileSync(paths.changelog, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => tryJson(l)).filter(Boolean);
}

function appendChangelog(paths, fields) {
  const log = readChangelog(paths);
  const prev = log.length ? log[log.length - 1].hash : null;
  const seq = log.length ? (log[log.length - 1].seq || 0) + 1 : 1;
  const entry = { seq, at: nowIso(), ...fields, prev };
  entry.hash = sha256(JSON.stringify({ ...entry, hash: undefined }));
  fs.appendFileSync(paths.changelog, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
  return entry;
}

/** Walk the changelog chain and compare its last after_sha with the file. */
export function verifyChangelog(paths) {
  const log = readChangelog(paths);
  const problems = [];
  let prev = null;
  log.forEach((e, i) => {
    const { hash, ...rest } = e;
    if (e.prev !== prev) problems.push(`entry ${i + 1} (seq ${e.seq}): prev hash does not chain`);
    if (sha256(JSON.stringify({ ...rest, hash: undefined })) !== hash) problems.push(`entry ${i + 1} (seq ${e.seq}): hash mismatch`);
    prev = hash;
  });
  let current = null;
  if (exists(paths.profile)) current = fileSha(fs.readFileSync(paths.profile, 'utf8'));
  const last = log.length ? log[log.length - 1] : null;
  const matchesFile = last && current ? last.after_sha === current : null;
  if (last && current && !matchesFile) problems.push('profile.json was changed outside the scripts since the last logged write (hand edit, sync conflict or restore); run "store validate" and, if it is right, "store accept"');
  return { entries: log.length, ok: problems.length === 0, problems, matches_file: matchesFile, last_seq: last ? last.seq : 0 };
}

/** Record the current file as the accepted state (after a deliberate hand edit or restore). */
export function acceptProfile(paths, note = 'accepted current file') {
  const { profile } = loadProfile(paths.dir);
  return appendChangelog(paths, { op: 'accept', ids: [], before_sha: null, after_sha: fileSha(fs.readFileSync(paths.profile, 'utf8')), note, sequence: profile.meta && profile.meta.sequence });
}

// ---------------------------------------------------------------------------
// Fact CRUD

const SINGLETON_NAMES = Object.keys(SINGLETONS);

/** Resolve a user-facing section name: section, singular, child kind or singleton. */
export function resolveKind(name) {
  const n = String(name || '').toLowerCase().replace(/_/g, '-');
  const aliases = {
    job: 'experience', jobs: 'experience', role: 'experience', roles: 'experience', work: 'experience', experiences: 'experience',
    achievement: 'achievement', achievements: 'achievement', accomplishment: 'achievement', bullet: 'achievement', result: 'achievement',
    skill: 'skills', certification: 'certifications', cert: 'certifications', certs: 'certifications', license: 'certifications', licenses: 'certifications',
    project: 'projects', publication: 'publications', talk: 'publications', talks: 'publications', award: 'awards', volunteer: 'volunteering',
    language: 'languages', extra: 'extras', fact: 'extras', facts: 'extras', other: 'extras', document: 'documents', degree: 'education', school: 'education',
    contact: 'identity', about: 'identity', target: 'targets', goals: 'targets', pitch: 'summary',
  };
  const kind = aliases[n] || n;
  if (SECTIONS[kind]) return { kind, type: 'section' };
  if (CHILDREN[kind]) return { kind, type: 'child' };
  if (SINGLETON_NAMES.includes(kind)) return { kind, type: 'singleton' };
  throw usageError(`unknown section "${name}"; sections: ${[...Object.keys(SECTIONS), ...Object.keys(CHILDREN), ...SINGLETON_NAMES].join(', ')}`);
}

function stripUnknownProvenance(data, source, confirmed) {
  const { id, provenance, ...rest } = data;
  return { rest, provenance: { ...defaultProvenance(source), ...(provenance || {}), confirmed: confirmed ?? (provenance ? provenance.confirmed !== false : true) } };
}

/** Add one entry. `data` is the entry body; `parent` an id for child kinds. Returns the entry. */
export function addFact(profile, kindName, data, { parent, source = 'interview', confirmed } = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw usageError('the fact must be a JSON object');
  const { kind, type } = resolveKind(kindName);
  if (type === 'singleton') {
    const allowed = SINGLETONS[kind];
    for (const k of Object.keys(data)) if (!allowed.includes(k)) throw usageError(`${kind}.${k} is not a field; fields: ${allowed.join(', ')}`);
    profile[kind] = { ...(profile[kind] || {}), ...data, provenance: defaultProvenance(source, { confirmed: confirmed ?? true }) };
    return { id: kind, ...profile[kind] };
  }
  const { rest, provenance } = stripUnknownProvenance(data, source, confirmed);
  if (type === 'child') {
    const cs = CHILDREN[kind];
    const index = indexProfile(profile);
    const hit = parent && index.get(parent);
    if (!hit || hit.kind !== cs.parent) throw usageError(`${kind} needs --parent <${cs.parent} id> (got ${parent || 'none'})`);
    const entry = { id: nextId(profile, kind, hit.entry), ...rest, provenance };
    hit.entry[cs.list] = hit.entry[cs.list] || [];
    hit.entry[cs.list].push(entry);
    return entry;
  }
  const id = kind === 'skills' ? skillId(profile, rest.name) : nextId(profile, kind);
  if (kind === 'skills' && (profile.skills || []).some((s) => s.name && rest.name && s.name.toLowerCase() === String(rest.name).toLowerCase())) {
    throw usageError(`skill "${rest.name}" already exists (${profile.skills.find((s) => s.name.toLowerCase() === String(rest.name).toLowerCase()).id}); use "fact update"`);
  }
  const entry = { id, ...rest, provenance };
  profile[kind] = profile[kind] || [];
  profile[kind].push(entry);
  return entry;
}

/** Merge fields into an existing entry (null removes a field). */
export function updateFact(profile, id, data, { source, confirmed } = {}) {
  if (SINGLETON_NAMES.includes(id)) return addFact(profile, id, data, { source: source || 'user', confirmed });
  const hit = indexProfile(profile).get(id);
  if (!hit) throw usageError(`no fact with id "${id}"`);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw usageError('the update must be a JSON object');
  const { id: _ignored, provenance, ...rest } = data;
  for (const [k, v] of Object.entries(rest)) { if (v === null) delete hit.entry[k]; else hit.entry[k] = v; }
  hit.entry.provenance = { ...(hit.entry.provenance || defaultProvenance('user')), ...(provenance || {}), at: nowIso() };
  if (source) hit.entry.provenance.source = source;
  if (confirmed != null) hit.entry.provenance.confirmed = confirmed;
  return hit.entry;
}

export function removeFact(profile, id) {
  const hit = indexProfile(profile).get(id);
  if (!hit) throw usageError(`no fact with id "${id}"`);
  if (hit.parent) {
    const list = CHILDREN[hit.kind].list;
    hit.parent[list] = hit.parent[list].filter((c) => c.id !== id);
  } else {
    profile[hit.section] = profile[hit.section].filter((e) => e.id !== id);
  }
  return hit.entry;
}

export function confirmFact(profile, id, confirmed = true) {
  const hit = indexProfile(profile).get(id);
  if (!hit) throw usageError(`no fact with id "${id}"`);
  hit.entry.provenance = { ...(hit.entry.provenance || defaultProvenance('user')), confirmed, at: nowIso() };
  return hit.entry;
}

/** Ids of entries whose provenance is not confirmed (never allowed into a resume). */
export function unconfirmedIds(profile) {
  const out = [];
  for (const [id, hit] of indexProfile(profile)) if (!hit.entry.provenance || hit.entry.provenance.confirmed !== true) out.push(id);
  return out;
}

/** Flat list for `fact list`: `{ id, kind, summary }`. */
export function listFacts(profile, kindName) {
  const want = kindName ? resolveKind(kindName) : null;
  const rows = [];
  for (const [id, hit] of indexProfile(profile)) {
    if (want && want.type === 'section' && hit.section !== want.kind) continue;
    if (want && want.type === 'child' && hit.kind !== want.kind) continue;
    if (want && want.type === 'section' && hit.parent) continue;
    rows.push({ id, kind: hit.kind, confirmed: !!(hit.entry.provenance && hit.entry.provenance.confirmed), summary: summarize(hit.kind, hit.entry) });
  }
  return rows;
}

export function summarize(kind, e) {
  switch (kind) {
    case 'experience': return `${e.title} at ${e.employer} (${e.start} to ${e.end || 'present'})${e.achievements ? `, ${e.achievements.length} achievement(s)` : ''}`;
    case 'achievement': return e.text;
    case 'skills': return `${e.name}${e.level ? ` (${e.level}` : ''}${e.years != null ? `${e.level ? ', ' : ' ('}${e.years}y` : ''}${e.level || e.years != null ? ')' : ''}`;
    case 'education': return `${e.degree || ''} ${e.field || ''} ${e.institution}`.replace(/\s+/g, ' ').trim();
    case 'certifications': return `${e.name}${e.issuer ? `, ${e.issuer}` : ''}${e.date ? ` (${e.date})` : ''}`;
    case 'projects': return `${e.name}${e.role ? ` (${e.role})` : ''}`;
    case 'publications': return `${e.title}${e.venue ? `, ${e.venue}` : ''}`;
    case 'awards': return `${e.name}${e.issuer ? `, ${e.issuer}` : ''}`;
    case 'volunteering': return `${e.role || 'volunteer'} at ${e.organization}`;
    case 'languages': return `${e.name}${e.level ? ` (${e.level})` : ''}`;
    case 'extras': return e.text;
    case 'documents': return `${e.kind || 'document'}: ${e.path}`;
    default: return JSON.stringify(e);
  }
}

// ---------------------------------------------------------------------------
// Export and import

/** Markdown rendering of the whole profile, every entry with its id (the audit view). */
export function exportMarkdown(p) {
  const out = [];
  const id = p.identity || {};
  out.push(`# Career profile: ${id.name || '(no name)'}`, '');
  out.push(`Schema ${p.schema}; updated ${p.meta && p.meta.updated}; sequence ${p.meta && p.meta.sequence}.`, '');
  out.push('## Identity', '');
  for (const k of SINGLETONS.identity) if (id[k] != null && id[k] !== '' && !(Array.isArray(id[k]) && !id[k].length)) out.push(`- ${k}: ${fmt(id[k])}`);
  out.push('', '## Targets', '');
  for (const k of SINGLETONS.targets) if (p.targets && p.targets[k] != null && p.targets[k] !== '' && !(Array.isArray(p.targets[k]) && !p.targets[k].length)) out.push(`- ${k}: ${fmt(p.targets[k])}`);
  out.push('', '## Summary', '');
  if (p.summary && p.summary.pitch) out.push(p.summary.pitch, '');
  if (p.summary && p.summary.strengths && p.summary.strengths.length) out.push(`Strengths: ${p.summary.strengths.join(', ')}`, '');
  for (const [name, spec] of Object.entries(SECTIONS)) {
    const list = p[name] || [];
    if (!list.length) continue;
    out.push(`## ${cap(spec.label)}`, '');
    for (const e of list) {
      out.push(`### ${summarize(name, e)} [${e.id}]${e.provenance && e.provenance.confirmed ? '' : ' (unconfirmed)'}`, '');
      for (const [k, v] of Object.entries(e)) {
        if (['id', 'provenance', 'achievements'].includes(k) || v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
        if (name === 'experience' && ['employer', 'title', 'start', 'end'].includes(k)) continue;
        out.push(`- ${k}: ${fmt(v)}`);
      }
      if (e.achievements && e.achievements.length) {
        out.push('', 'Achievements:', '');
        for (const a of e.achievements) {
          out.push(`- [${a.id}] ${a.text}${a.provenance && a.provenance.confirmed ? '' : ' (unconfirmed)'}`);
          if (a.metrics && a.metrics.length) out.push(`  - metrics: ${a.metrics.map((m) => `${m.value}${m.unit || ''} ${m.label}`).join('; ')}`);
          if (a.skills && a.skills.length) out.push(`  - skills: ${a.skills.join(', ')}`);
          for (const k of ['situation', 'task', 'action', 'result']) if (a[k]) out.push(`  - ${k}: ${a[k]}`);
        }
      }
      out.push('');
    }
  }
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function fmt(v) {
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' && x ? Object.values(x).filter(Boolean).join(' ') : String(x))).join(', ');
  if (v && typeof v === 'object') return Object.entries(v).filter(([, x]) => x != null && x !== '').map(([k, x]) => `${k} ${x}`).join(', ');
  return String(v);
}

/** Import a whole profile JSON (validated) over the current one. */
export function importProfile(paths, incoming, { dryRun } = {}) {
  if (!incoming || incoming.schema !== PROFILE_SCHEMA) throw usageError(`import expects a ${PROFILE_SCHEMA} document`);
  return saveProfile(paths, incoming, { op: 'import', ids: [], dryRun });
}

// ---------------------------------------------------------------------------
// Optional git sync (a dedicated private repository holding the store)

export function gitInfo(dir) {
  const r = spawnSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (r.status !== 0) return { repo: false };
  const top = r.stdout.trim();
  const dedicated = path.resolve(top) === path.resolve(dir);
  const remote = spawnSync('git', ['-C', dir, 'remote', 'get-url', 'origin'], { encoding: 'utf8' });
  return { repo: true, top, dedicated, remote: remote.status === 0 ? remote.stdout.trim() : null };
}

/** Commit the store and push, best effort; never throws for network problems. */
export function syncStore(dir, { message, dryRun } = {}) {
  const info = gitInfo(dir);
  if (!info.repo) return { synced: false, reason: 'the store is not inside a git repository (git init it, or skip sync)' };
  if (!info.dedicated) return { synced: false, reason: `the store sits inside another repository (${info.top}); a profile belongs in its own private repository, not in a project` };
  if (dryRun) return { synced: false, dry_run: true };
  const run = (args) => spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  run(['pull', '--ff-only', '--quiet']);
  run(['add', '-A', '--', '.']);
  const staged = run(['diff', '--cached', '--quiet']);
  let committed = false;
  if (staged.status === 1) {
    const c = run(['-c', 'user.name=career-profiler', '-c', 'user.email=career-profiler@localhost', 'commit', '-q', '-m', message || `profile: ${nowIso()}`]);
    committed = c.status === 0;
    if (!committed) return { synced: false, committed, reason: `git commit failed: ${(c.stderr || c.stdout).trim()}` };
  }
  if (!info.remote) return { synced: false, committed, reason: 'no origin remote; committed locally only' };
  const p = run(['push', '--quiet']);
  return { synced: p.status === 0, committed, reason: p.status === 0 ? null : `git push failed: ${(p.stderr || '').trim().split('\n')[0]} (will sync next time)` };
}

export { SECTIONS, CHILDREN, SINGLETONS, isDir };
