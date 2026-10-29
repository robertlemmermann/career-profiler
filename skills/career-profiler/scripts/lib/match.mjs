// Gap analysis: every job requirement and keyword against the profile. Evidence is a list of
// fact ids; nothing is ever inferred into the profile. The output tells the model which terms it
// may use verbatim (supported), which it must leave out (unsupported) and what to ask the user.

import { MATCH_SCHEMA, nowIso, generatedBy, round, uniq } from './core.mjs';
import { buildMatchers, findTerms, termRegex } from './taxonomy.mjs';
import { indexProfile } from './schema.mjs';
import { SENIORITY_RANK, seniorityOf } from './job.mjs';

const LEVEL_WEIGHT = { expert: 1, advanced: 1, intermediate: 0.7, beginner: 0.4 };

/** Searchable text of one entry, children excluded (they are indexed on their own). */
export function entryText(kind, e) {
  const parts = [];
  const push = (v) => { if (v == null) return; if (Array.isArray(v)) v.forEach(push); else if (typeof v === 'object') Object.values(v).forEach(push); else parts.push(String(v)); };
  for (const [k, v] of Object.entries(e)) if (!['id', 'provenance', 'achievements', 'evidence'].includes(k)) push(v);
  return parts.join(' \n ');
}

/**
 * Evidence index: canonical term -> [{ id, kind, strength, via }], where strength is 1 for a
 * declared skill at advanced/expert, 0.7 intermediate, 0.4 beginner, 0.6 for a stack entry or an
 * achievement/project/certification that names the term.
 */
export function buildEvidenceIndex(profile, matchers) {
  const index = new Map();
  const add = (term, hit) => { if (!index.has(term)) index.set(term, []); index.get(term).push(hit); };
  for (const [id, { kind, entry, parent }] of indexProfile(profile)) {
    if (!entry.provenance || entry.provenance.confirmed !== true) continue;
    if (kind === 'skills') {
      const names = [entry.name, ...(entry.aliases || [])];
      const canon = new Set();
      for (const n of names) for (const t of findTerms(n, matchers)) canon.add(t.term);
      if (!canon.size) canon.add(entry.name);
      for (const term of canon) add(term, { id, kind, strength: LEVEL_WEIGHT[entry.level] ?? 0.8, via: 'skill', years: entry.years ?? null, last_used: entry.last_used ?? null });
      continue;
    }
    const text = entryText(kind, entry);
    for (const t of findTerms(text, matchers)) {
      const inStack = kind === 'experience' && (entry.stack || []).some((s) => termRegex(t.via).test(s) || s.toLowerCase() === t.term.toLowerCase());
      add(t.term, { id, kind, strength: inStack ? 0.6 : (kind === 'certifications' ? 0.9 : 0.6), via: kind, parent: parent ? parent.id : null });
    }
  }
  return index;
}

function statusOf(hits) {
  if (!hits || !hits.length) return 'missing';
  const best = Math.max(...hits.map((h) => h.strength));
  const skill = hits.some((h) => h.via === 'skill');
  const uses = hits.filter((h) => h.via !== 'skill').length;
  if ((skill && best >= 0.7) || (skill && uses >= 1) || uses >= 2 || best >= 0.9) return 'strong';
  return 'partial';
}

const STATUS_SCORE = { strong: 1, partial: 0.5, missing: 0 };
const DEGREE_RANK = { 'High school diploma': 0, 'Associate degree': 1, "Bachelor's degree": 2, "Master's degree": 3, PhD: 4 };

/** The highest degree level in the profile's education entries, with its id. */
export function highestDegree(profile, matchers) {
  let best = null;
  for (const e of profile.education || []) {
    if (!e.provenance || e.provenance.confirmed !== true) continue;
    for (const t of findTerms(`${e.degree || ''} ${e.field || ''}`, matchers)) {
      const r = DEGREE_RANK[t.term];
      if (r != null && (!best || r > best.rank)) best = { id: e.id, term: t.term, rank: r };
    }
  }
  return best;
}

export function totalYears(profile, now = nowIso().slice(0, 7)) {
  const spans = (profile.experience || []).filter((e) => e.start).map((e) => {
    const [ys, ms = 1] = e.start.split('-').map(Number);
    const endStr = e.end && !/present/i.test(e.end) ? e.end : now;
    const [ye, me = 12] = endStr.split('-').map(Number);
    return [ys * 12 + (ms - 1), ye * 12 + (me - 1) + 1];
  }).sort((a, b) => a[0] - b[0]);
  let months = 0;
  let cur = null;
  for (const [s, e] of spans) {
    if (!cur || s > cur[1]) { if (cur) months += cur[1] - cur[0]; cur = [s, e]; } else cur[1] = Math.max(cur[1], e);
  }
  if (cur) months += cur[1] - cur[0];
  return round(months / 12, 1);
}

export function highestSeniority(profile) {
  let best = null;
  for (const e of profile.experience || []) {
    const s = seniorityOf(e.title);
    if (s && (best == null || SENIORITY_RANK[s] > SENIORITY_RANK[best])) best = s;
  }
  return best;
}

/** Match a career-job/1 document against the profile. */
export function matchJob(profile, job) {
  const matchers = buildMatchers(profile);
  const evidence = buildEvidenceIndex(profile, matchers);
  const degree = highestDegree(profile, matchers);
  const keywords = job.keywords.map((k) => {
    let hits = evidence.get(k.term) || [];
    // A degree requirement is met by any degree at that level or above.
    if (k.category === 'education-level' && DEGREE_RANK[k.term] != null && degree && degree.rank >= DEGREE_RANK[k.term] && !hits.length) hits = [{ id: degree.id, kind: 'education', strength: 1, via: 'degree' }];
    const status = statusOf(hits);
    return { term: k.term, kind: k.kind, category: k.category, in_title: !!k.in_title, status, evidence: hits.map((h) => h.id), use_verbatim: status !== 'missing' };
  });
  const requirements = job.requirements.map((r) => {
    const terms = r.keywords.map((t) => keywords.find((k) => k.term === t)).filter(Boolean);
    let status;
    if (!terms.length) status = 'unscored';
    else if (terms.every((t) => t.status === 'strong')) status = 'strong';
    else if (terms.every((t) => t.status === 'missing')) status = 'missing';
    else status = 'partial';
    return { id: r.id, kind: r.kind, text: r.text, status, terms: terms.map((t) => t.term), evidence: uniq(terms.flatMap((t) => t.evidence)) };
  });
  const weight = (k) => (k.kind === 'must' ? 2 : k.kind === 'nice' ? 1 : 0.5);
  const scored = keywords.filter((k) => k.kind !== 'context');
  const denom = scored.reduce((s, k) => s + weight(k), 0);
  const num = scored.reduce((s, k) => s + weight(k) * STATUS_SCORE[k.status], 0);
  const fit = denom ? round(num / denom, 2) : null;
  const byKind = (kind) => {
    const list = keywords.filter((k) => k.kind === kind);
    return { total: list.length, strong: list.filter((k) => k.status === 'strong').length, partial: list.filter((k) => k.status === 'partial').length, missing: list.filter((k) => k.status === 'missing').length };
  };
  const years = totalYears(profile);
  const mySen = highestSeniority(profile);
  const seniority = {
    job: job.seniority, profile: mySen,
    verdict: !job.seniority || !mySen ? 'unknown' : SENIORITY_RANK[mySen] >= SENIORITY_RANK[job.seniority] ? 'meets' : SENIORITY_RANK[mySen] + 1 === SENIORITY_RANK[job.seniority] ? 'one-step-up' : 'stretch',
  };
  const gaps = keywords.filter((k) => k.status === 'missing' && k.kind !== 'context').map((k) => ({
    term: k.term, kind: k.kind,
    question: `The posting ${k.kind === 'must' ? 'requires' : 'prefers'} ${k.term}. Do you have real experience with it that is not in your profile yet? If yes: where, for how long, and what did you do with it? If no, it stays out of the resume.`,
  }));
  const highlights = keywords.filter((k) => k.status !== 'missing' && k.kind !== 'context').map((k) => ({ term: k.term, kind: k.kind, evidence: k.evidence.slice(0, 6) }));
  return {
    schema: MATCH_SCHEMA, generated_at: nowIso(), generated_by: generatedBy(),
    job: { title: job.title, company: job.company, slug: job.slug, text_sha256: job.text_sha256 },
    profile_sequence: profile.meta && profile.meta.sequence,
    fit, coverage: { must: byKind('must'), nice: byKind('nice'), responsibility: byKind('responsibility') },
    years: { profile_total: years, required: job.years_required, verdict: job.years_required == null ? 'unknown' : years >= job.years_required ? 'meets' : 'short' },
    seniority,
    keywords, requirements, highlights, gaps,
    guidance: [
      'Use only terms whose status is strong or partial; cite their evidence ids in the resume.',
      'Every gap is a question for the user, never a line in the resume. Ask them before writing.',
      'A partial term may appear where its evidence shows it; do not escalate it to an expert claim.',
    ],
  };
}
