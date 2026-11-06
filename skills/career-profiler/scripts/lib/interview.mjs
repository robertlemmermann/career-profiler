// Interview support: how complete the profile is, what is thin, and the next questions to ask.
// The model conducts the conversation; this module only measures and proposes.

import path from 'node:path';
import { ASSETS_DIR, readJson, round } from './core.mjs';

let bank;
export function loadQuestionBank() {
  if (!bank) bank = readJson(path.join(ASSETS_DIR, 'question-bank.json'));
  return bank;
}

const has = (v) => v != null && v !== '' && !(Array.isArray(v) && !v.length) && !(typeof v === 'object' && !Array.isArray(v) && !Object.values(v).some((x) => x));
const confirmed = (e) => e && e.provenance && e.provenance.confirmed === true;
const WEAK_ACH = /^(?:responsible for|worked on|helped|assisted|participated|involved in|duties included)\b/i;

/** Domains that apply to this profile, from titles, industries and targets. */
export function domainsOf(profile) {
  const qb = loadQuestionBank();
  const text = [
    ...(profile.experience || []).map((e) => `${e.title} ${e.industry || ''}`),
    ...((profile.targets && profile.targets.roles) || []), ...((profile.targets && profile.targets.industries) || []),
    (profile.identity && profile.identity.headline) || '',
  ].join(' ').toLowerCase();
  const out = ['general'];
  for (const [domain, words] of Object.entries(qb.domain_keywords)) if (words.some((w) => text.includes(w))) out.push(domain);
  return out;
}

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));

/**
 * Coverage: `{ score, sections[], gaps[] }`. Each gap has `code`, `priority`, `question`, `probes`,
 * `about` (an id when it concerns one entry). Codes listed in `meta.interview.asked` are skipped
 * (the user already answered "none" or "skip").
 */
export function coverage(profile) {
  const qb = loadQuestionBank();
  const asked = new Set((profile.meta && profile.meta.interview && profile.meta.interview.asked) || []);
  const gaps = [];
  const domains = domainsOf(profile);
  const probesFor = (extra = []) => {
    const list = [...extra];
    for (const d of domains) for (const p of qb.domain_probes[d] || []) if (!list.includes(p)) list.push(p);
    return list.slice(0, 6);
  };
  const gap = (code, vars = {}, about = null, { key = code } = {}) => {
    if (asked.has(key)) return;
    const q = qb.questions[code];
    if (!q) return;
    gaps.push({ code, key, about, priority: q.priority, question: fill(q.question, vars), probes: probesFor(q.probes || []) });
  };
  const id = profile.identity || {};
  const sections = [];
  // Identity (weight 10)
  const idChecks = [['name', 'identity.name'], ['email', 'identity.email'], ['location', 'identity.location'], ['phone', 'identity.phone'], ['links', 'identity.links'], ['headline', 'identity.headline']];
  let idDone = 0;
  for (const [f, code] of idChecks) { if (has(id[f])) idDone += 1; else gap(code); }
  sections.push({ section: 'identity', weight: 10, score: round(idDone / idChecks.length, 2) });
  // Targets (5)
  const tg = profile.targets || {};
  const tgChecks = [['roles', 'targets.roles'], ['seniority', 'targets.seniority'], ['locations', 'targets.locations'], ['industries', 'targets.industries']];
  let tgDone = 0;
  for (const [f, code] of tgChecks) { if (has(tg[f])) tgDone += 1; else gap(code); }
  sections.push({ section: 'targets', weight: 5, score: round(tgDone / tgChecks.length, 2) });
  // Summary (5)
  const pitch = has(profile.summary && profile.summary.pitch);
  if (!pitch) gap('summary.pitch');
  sections.push({ section: 'summary', weight: 5, score: pitch ? 1 : 0 });
  // Documents (asked once)
  if (!(profile.documents || []).length) gap('documents.none');
  // Experience (40)
  const exps = (profile.experience || []).filter(confirmed).sort((a, b) => String(b.start).localeCompare(String(a.start)));
  if (!exps.length) { gap('experience.none'); sections.push({ section: 'experience', weight: 40, score: 0 }); } else {
    let total = 0;
    const oldest = exps[exps.length - 1];
    gap('experience.next', { title: oldest.title, employer: oldest.employer }, oldest.id, { key: `experience.next:${oldest.id}` });
    for (const e of exps) {
      const achs = (e.achievements || []).filter(confirmed);
      const withMetrics = achs.filter((a) => (a.metrics && a.metrics.length) || /\d/.test(a.text));
      let s = 0;
      if (has(e.scope) || has(e.team_size) || has(e.responsibilities)) s += 0.2; else gap('experience.scope', { title: e.title, employer: e.employer }, e.id, { key: `experience.scope:${e.id}` });
      if (has(e.stack)) s += 0.1; else gap('experience.stack', { employer: e.employer }, e.id, { key: `experience.stack:${e.id}` });
      s += Math.min(achs.length, 4) / 4 * 0.5;
      if (achs.length < 3) gap('experience.achievements.few', { count: 3 - achs.length, title: e.title, employer: e.employer }, e.id, { key: `experience.achievements.few:${e.id}` });
      if (achs.length && !withMetrics.length) gap('experience.metrics.none', { employer: e.employer }, e.id, { key: `experience.metrics.none:${e.id}` }); else if (achs.length) s += 0.2;
      for (const a of achs) if (WEAK_ACH.test(a.text) || a.text.trim().length < 40) gap('achievement.weak', { text: a.text.slice(0, 80) }, a.id, { key: `achievement.weak:${a.id}` });
      total += s;
    }
    sections.push({ section: 'experience', weight: 40, score: round(total / exps.length, 2), roles: exps.length });
  }
  // Skills (20)
  const skills = (profile.skills || []).filter(confirmed);
  let sk = Math.min(skills.length, 10) / 10 * 0.7;
  if (skills.length < 8) gap('skills.few');
  const leveled = skills.filter((s) => s.level);
  if (skills.length) sk += leveled.length / skills.length * 0.3;
  for (const s of skills.filter((s) => !s.level).slice(0, 3)) gap('skills.level.missing', { skill: s.name }, s.id, { key: `skills.level.missing:${s.id}` });
  const mentioned = JSON.stringify([profile.experience, profile.projects]).toLowerCase();
  for (const s of skills.filter((s) => !(s.evidence || []).length && !mentioned.includes(String(s.name).toLowerCase())).slice(0, 3)) gap('skills.evidence.none', { skill: s.name }, s.id, { key: `skills.evidence.none:${s.id}` });
  sections.push({ section: 'skills', weight: 20, score: round(sk, 2), count: skills.length });
  // Education (10) and the rest (10)
  const edu = (profile.education || []).filter(confirmed).length;
  if (!edu) gap('education.none');
  sections.push({ section: 'education', weight: 10, score: edu ? 1 : 0 });
  let other = 0;
  for (const [sec, code] of [['certifications', 'certifications.none'], ['projects', 'projects.none'], ['languages', 'languages.none'], ['volunteering', 'volunteering.none'], ['awards', 'awards.none']]) {
    if ((profile[sec] || []).filter(confirmed).length || asked.has(code)) other += 0.2; else gap(code);
  }
  sections.push({ section: 'other', weight: 10, score: round(other, 2) });
  const score = Math.round(sections.reduce((s, x) => s + x.weight * x.score, 0));
  gaps.sort((a, b) => b.priority - a.priority);
  return { score, domains, sections, gaps, resume_ready: score >= 60 && exps.length > 0 && skills.length >= 3 && has(id.name) && has(id.email) };
}

export function nextQuestions(profile, { max = 3, focus = null } = {}) {
  const c = coverage(profile);
  let gaps = c.gaps;
  if (focus) gaps = gaps.filter((g) => g.code.startsWith(focus) || g.about === focus);
  return { score: c.score, resume_ready: c.resume_ready, domains: c.domains, remaining: gaps.length, questions: gaps.slice(0, max) };
}

export function markAsked(profile, keys) {
  profile.meta = profile.meta || {};
  profile.meta.interview = profile.meta.interview || { asked: [] };
  for (const k of keys) if (!profile.meta.interview.asked.includes(k)) profile.meta.interview.asked.push(k);
  return profile.meta.interview.asked;
}
