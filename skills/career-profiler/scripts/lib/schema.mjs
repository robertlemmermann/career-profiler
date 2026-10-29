// The career-profile/1 fact store: sections, entry shapes, ids, provenance and validation.
// Hand-written validator (no dependencies); assets/schema/profile.schema.json documents the
// same shape for humans and other tools and tests/unit/schema.test.mjs keeps them in step.

import { PROFILE_SCHEMA, nowIso, generatedBy } from './core.mjs';

export const PROVENANCE_SOURCES = ['interview', 'document', 'user', 'import'];
export const TIERS = ['professional', 'restricted', 'never'];
/** Singleton fields that are restricted by default (exported only on a confirmed --include). */
export const RESTRICTED_FIELDS = Object.freeze({ identity: ['work_authorization', 'relocation'], targets: ['compensation'] });
/** Entry fields that are restricted regardless of the entry's tier. */
export const RESTRICTED_ENTRY_FIELDS = Object.freeze({ certifications: ['id_number'] });
export const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
export const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'contract', 'freelance', 'internship', 'volunteer', 'self-employed', 'other'];
export const LANGUAGE_LEVELS = ['basic', 'conversational', 'professional', 'fluent', 'native'];

/**
 * Sections that hold lists of entries with ids. `prefix` builds ids (`exp-01`), `required`
 * names the fields an entry must have, `fields` the optional ones, `children` nested lists.
 */
export const SECTIONS = Object.freeze({
  experience: {
    prefix: 'exp', label: 'work experience',
    required: ['employer', 'title', 'start'],
    fields: ['end', 'location', 'type', 'industry', 'team_size', 'reports', 'scope', 'stack', 'responsibilities', 'achievements', 'notes'],
    children: { achievements: 'achievement' },
  },
  education: { prefix: 'edu', label: 'education', required: ['institution'], fields: ['degree', 'field', 'start', 'end', 'honors', 'location', 'notes', 'coursework'] },
  certifications: { prefix: 'cert', label: 'certifications and licenses', required: ['name'], fields: ['issuer', 'date', 'expires', 'id_number', 'url', 'notes'] },
  skills: { prefix: 'skill', label: 'skills', required: ['name'], fields: ['category', 'level', 'years', 'last_used', 'evidence', 'aliases', 'notes'] },
  projects: { prefix: 'proj', label: 'projects', required: ['name'], fields: ['role', 'start', 'end', 'url', 'summary', 'stack', 'outcomes', 'metrics', 'skills', 'notes'] },
  publications: { prefix: 'pub', label: 'publications and talks', required: ['title'], fields: ['venue', 'date', 'url', 'role', 'notes'] },
  awards: { prefix: 'award', label: 'awards and recognition', required: ['name'], fields: ['issuer', 'date', 'notes'] },
  volunteering: { prefix: 'vol', label: 'volunteering and community', required: ['organization'], fields: ['role', 'start', 'end', 'summary', 'outcomes', 'notes'] },
  languages: { prefix: 'lang', label: 'languages', required: ['name'], fields: ['level', 'notes'] },
  extras: { prefix: 'fact', label: 'other facts', required: ['text'], fields: ['tags', 'notes'] },
  documents: { prefix: 'doc', label: 'source documents', required: ['path'], fields: ['kind', 'added', 'notes'] },
});

/** Child entry shapes (nested inside a parent entry). */
export const CHILDREN = Object.freeze({
  achievement: {
    prefix: 'ach', label: 'achievement', parent: 'experience', list: 'achievements',
    required: ['text'],
    fields: ['situation', 'task', 'action', 'result', 'metrics', 'skills', 'tags', 'notes'],
  },
});

export const SINGLETONS = Object.freeze({
  identity: ['name', 'headline', 'email', 'phone', 'location', 'links', 'work_authorization', 'relocation', 'remote_preference', 'pronouns'],
  targets: ['roles', 'industries', 'seniority', 'locations', 'compensation', 'notes'],
  summary: ['pitch', 'strengths', 'notes'],
});

export function emptyProfile({ name } = {}) {
  const now = nowIso();
  const p = {
    schema: PROFILE_SCHEMA,
    meta: { created: now, updated: now, generated_by: generatedBy(), locale: 'en', sequence: 0, store_version: 2 },
    identity: { name: name || '', headline: '', email: '', phone: '', location: {}, links: [] },
    targets: { roles: [], industries: [], seniority: '', locations: [] },
    summary: { pitch: '', strengths: [] },
  };
  for (const s of Object.keys(SECTIONS)) p[s] = [];
  return p;
}

export const defaultProvenance = (source = 'interview', extra = {}) => ({ source, confirmed: true, at: nowIso(), ...extra });

/** The tier of an entry (default professional). */
export const tierOf = (entry) => (entry && TIERS.includes(entry.tier) ? entry.tier : 'professional');

// ---------------------------------------------------------------------------
// Validation

const isStr = (v) => typeof v === 'string';
const isNonEmptyStr = (v) => isStr(v) && v.trim() !== '';
const isArr = Array.isArray;
const isObj = (v) => v != null && typeof v === 'object' && !isArr(v);
const DATE_RE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;
export const isDate = (v) => isStr(v) && DATE_RE.test(v);
export const isPresent = (v) => v == null || v === '' || /^present$/i.test(String(v));

/** Validate a profile. Returns `{ ok, errors[], warnings[] }`; errors are `{ path, message }`. */
export function validateProfile(p) {
  const errors = [];
  const warnings = [];
  const err = (path, message) => errors.push({ path, message });
  const warn = (path, message) => warnings.push({ path, message });
  if (!isObj(p)) return { ok: false, errors: [{ path: '', message: 'profile is not an object' }], warnings };
  if (p.schema !== PROFILE_SCHEMA) err('schema', `expected "${PROFILE_SCHEMA}", got ${JSON.stringify(p.schema)}`);
  if (!isObj(p.meta)) err('meta', 'missing object');
  for (const [name, fields] of Object.entries(SINGLETONS)) {
    if (p[name] == null) { err(name, 'missing object'); continue; }
    if (!isObj(p[name])) { err(name, 'must be an object'); continue; }
    for (const k of Object.keys(p[name])) if (!fields.includes(k) && k !== 'provenance' && k !== 'tiers') warn(`${name}.${k}`, 'unknown field (kept, but no playbook reads it)');
  }
  if (p.identity && p.identity.links != null && !isArr(p.identity.links)) err('identity.links', 'must be an array of { label, url }');
  if (p.identity && p.identity.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.identity.email)) warn('identity.email', 'does not look like an email address');

  const ids = new Map();
  const seen = (id, where) => {
    if (ids.has(id)) err(where, `duplicate id "${id}" (also at ${ids.get(id)})`); else ids.set(id, where);
  };
  const checkProvenance = (entry, where) => {
    const pr = entry.provenance;
    if (!isObj(pr)) { err(`${where}.provenance`, 'missing'); return; }
    if (!PROVENANCE_SOURCES.includes(pr.source)) err(`${where}.provenance.source`, `must be one of ${PROVENANCE_SOURCES.join(', ')}`);
    if (typeof pr.confirmed !== 'boolean') err(`${where}.provenance.confirmed`, 'must be true or false');
    if (pr.at != null && !isStr(pr.at)) err(`${where}.provenance.at`, 'must be an ISO timestamp string');
    if (pr.quote != null && (!isStr(pr.quote) || pr.quote.length > 300)) err(`${where}.provenance.quote`, 'must be a string of at most 300 characters');
  };
  const checkEntry = (entry, spec, where, prefix) => {
    if (!isObj(entry)) { err(where, 'must be an object'); return; }
    if (!isNonEmptyStr(entry.id)) err(`${where}.id`, 'missing id');
    else {
      seen(entry.id, where);
      if (!entry.id.startsWith(`${prefix}-`)) warn(`${where}.id`, `id does not start with "${prefix}-"`);
    }
    for (const f of spec.required) if (!isNonEmptyStr(entry[f]) && !(isArr(entry[f]) && entry[f].length)) err(`${where}.${f}`, 'required');
    if (entry.tier != null && !TIERS.includes(entry.tier)) err(`${where}.tier`, `must be one of ${TIERS.join(', ')}`);
    const allowed = new Set(['id', 'provenance', 'tier', ...spec.required, ...spec.fields]);
    for (const k of Object.keys(entry)) if (!allowed.has(k)) warn(`${where}.${k}`, 'unknown field (kept, but no playbook reads it)');
    for (const f of ['start', 'end', 'date', 'expires', 'added']) {
      if (entry[f] != null && entry[f] !== '' && !isPresent(entry[f]) && !isDate(entry[f])) err(`${where}.${f}`, `"${entry[f]}" is not YYYY, YYYY-MM or YYYY-MM-DD`);
    }
    if (isDate(entry.start) && isDate(entry.end) && entry.end < entry.start) err(`${where}.end`, 'ends before it starts');
    if (entry.level != null && spec.prefix === 'skill' && !SKILL_LEVELS.includes(entry.level)) err(`${where}.level`, `must be one of ${SKILL_LEVELS.join(', ')}`);
    if (entry.level != null && spec.prefix === 'lang' && !LANGUAGE_LEVELS.includes(entry.level)) err(`${where}.level`, `must be one of ${LANGUAGE_LEVELS.join(', ')}`);
    if (entry.type != null && spec.prefix === 'exp' && !EMPLOYMENT_TYPES.includes(entry.type)) warn(`${where}.type`, `not one of ${EMPLOYMENT_TYPES.join(', ')}`);
    if (entry.years != null && !(typeof entry.years === 'number' && entry.years >= 0)) err(`${where}.years`, 'must be a non-negative number');
    if (entry.metrics != null) {
      if (!isArr(entry.metrics)) err(`${where}.metrics`, 'must be an array');
      else entry.metrics.forEach((m, i) => {
        if (!isObj(m)) { err(`${where}.metrics[${i}]`, 'must be { value, unit?, label }'); return; }
        if (m.value == null || (typeof m.value !== 'number' && !isNonEmptyStr(m.value))) err(`${where}.metrics[${i}].value`, 'required (number or string)');
        if (!isNonEmptyStr(m.label)) err(`${where}.metrics[${i}].label`, 'required');
      });
    }
    for (const f of ['stack', 'responsibilities', 'skills', 'evidence', 'aliases', 'tags', 'outcomes', 'coursework', 'strengths']) {
      if (entry[f] != null && !(isArr(entry[f]) && entry[f].every(isStr))) err(`${where}.${f}`, 'must be an array of strings');
    }
    checkProvenance(entry, where);
  };

  for (const [name, spec] of Object.entries(SECTIONS)) {
    if (p[name] == null) { err(name, 'missing array'); continue; }
    if (!isArr(p[name])) { err(name, 'must be an array'); continue; }
    p[name].forEach((entry, i) => {
      const where = `${name}[${i}]`;
      checkEntry(entry, spec, where, spec.prefix);
      for (const [list, childKind] of Object.entries(spec.children || {})) {
        const cs = CHILDREN[childKind];
        if (entry && entry[list] != null) {
          if (!isArr(entry[list])) err(`${where}.${list}`, 'must be an array');
          else entry[list].forEach((c, j) => checkEntry(c, cs, `${where}.${list}[${j}]`, cs.prefix));
        }
      }
    });
  }
  // Cross references: skills.evidence and achievement.skills must point at existing ids.
  const refs = [];
  for (const s of p.skills || []) for (const e of (isObj(s) && isArr(s.evidence) ? s.evidence : [])) refs.push([`skills(${s.id}).evidence`, e]);
  for (const x of p.experience || []) for (const a of (isObj(x) && isArr(x.achievements) ? x.achievements : [])) for (const sk of (isObj(a) && isArr(a.skills) ? a.skills : [])) refs.push([`achievement(${a.id}).skills`, sk]);
  for (const pr of p.projects || []) for (const sk of (isObj(pr) && isArr(pr.skills) ? pr.skills : [])) refs.push([`project(${pr.id}).skills`, sk]);
  for (const [where, id] of refs) if (!ids.has(id)) warn(where, `references unknown id "${id}"`);
  return { ok: errors.length === 0, errors, warnings };
}

/** Every id in the profile with its section and entry (flattened, children included). */
export function indexProfile(p) {
  const index = new Map();
  for (const [name, spec] of Object.entries(SECTIONS)) {
    for (const entry of p[name] || []) {
      if (!entry || !entry.id) continue;
      index.set(entry.id, { section: name, kind: name, entry, parent: null });
      for (const [list, childKind] of Object.entries(spec.children || {})) {
        for (const c of entry[list] || []) if (c && c.id) index.set(c.id, { section: name, kind: childKind, entry: c, parent: entry });
      }
    }
  }
  return index;
}

/** The next free id for a section or child kind (`exp-03`, `ach-03-02`). */
export function nextId(p, kind, parent) {
  const index = indexProfile(p);
  if (CHILDREN[kind]) {
    const cs = CHILDREN[kind];
    const parentNum = parent && /-(\d+)$/.exec(parent.id) ? /-(\d+)$/.exec(parent.id)[1] : '00';
    const list = (parent && parent[cs.list]) || [];
    let n = list.length + 1;
    while (index.has(`${cs.prefix}-${parentNum}-${String(n).padStart(2, '0')}`)) n += 1;
    return `${cs.prefix}-${parentNum}-${String(n).padStart(2, '0')}`;
  }
  const spec = SECTIONS[kind];
  let n = (p[kind] || []).length + 1;
  while (index.has(`${spec.prefix}-${String(n).padStart(2, '0')}`)) n += 1;
  return `${spec.prefix}-${String(n).padStart(2, '0')}`;
}

/** Stable slug ids for skills (`skill-react`), falling back to the numeric scheme on collision. */
export function skillId(p, name) {
  const base = `skill-${String(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)}`;
  const index = indexProfile(p);
  if (base !== 'skill-' && !index.has(base)) return base;
  return nextId(p, 'skills');
}
