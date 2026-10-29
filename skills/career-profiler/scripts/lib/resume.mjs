// Resumes and cover letters as cited documents. A draft is a Markdown file in which every claim
// line carries `<!-- fact: id, id -->`; `check` proves each line against the fact store and the
// job; `finalize` strips the markers and renders the deliverables. The check report is the
// evidence ledger of the application.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CHECK_SCHEMA, nowIso, generatedBy, sha256, uniq, exists, writeFileAtomic, readText } from './core.mjs';
import { indexProfile } from './schema.mjs';
import { buildMatchers, findTerms } from './taxonomy.mjs';
import { buildEvidenceIndex, entryText, isExpired } from './match.mjs';
import { scanText } from './pii.mjs';
import { tierOf } from './schema.mjs';

const LEAD_CLAIM = /\b(?:led|lead|leading|managed|managing|manage|directed|directing|headed|heading|owned|owning|oversaw|overseeing|supervised|supervising|ran|running|spearheaded|founded|architected|established)\b/i;
const LEAD_EVIDENCE = /\b(?:led|lead|leading|managed|managing|manage|directed|headed|owned|own(?:ing)?|oversaw|supervis\w*|ran|charge|spearheaded|founded|architected|established|tech lead|team lead|mentor\w*|precept\w*|coordinat\w*|responsible for|roadmap|designed)\b/i;
const LEVEL_CLAIM = /\b(?:expert|expertise|mastery|master of|deep expertise|advanced)\b\s+(?:in|with|of|at)?\s*([A-Z][\w+#.]*(?:\s[A-Z][\w+#.]*){0,2})/g;
const LEVEL_RANK = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };

export const MARKER_RE = /<!--\s*facts?\s*:\s*([^>]*?)\s*-->/gi;
const ANY_COMMENT_RE = /<!--[\s\S]*?-->/g;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DATE_RANGE_RE = /(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.? )?\d{4}\s*(?:-|–|—|to)\s*(?:(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.? )?\d{4}|present|current|now)\b/i;
/** A non-bullet line that is mostly a date range (optionally a location before it). */
const isDateLine = (s) => !/^[-*+]\s/.test(s) && DATE_RANGE_RE.test(s) && s.replace(DATE_RANGE_RE, '').split(/\s+/).filter(Boolean).length <= 8;
const DATE_FIELDS = new Set(['start', 'end', 'date', 'expires', 'added', 'last_used']);
const PSEUDO = new Set(['identity', 'summary', 'targets']);

export function parseMarkers(line) {
  const ids = [];
  let m;
  MARKER_RE.lastIndex = 0;
  while ((m = MARKER_RE.exec(line))) ids.push(...m[1].split(/[,\s]+/).map((s) => s.trim()).filter(Boolean));
  return uniq(ids);
}
export const stripComments = (s) => s.replace(ANY_COMMENT_RE, '').replace(/[ \t]+$/gm, '');

/** Numbers in a text: `40%` -> 40, `1,200` -> 1200, `$2M` -> 2 and 2000000, `2.5x` -> 2.5. */
export function numbersIn(text) {
  const out = new Set();
  // A number is a digit run not glued to a word or a dot before it; a unit after it (s, ms, KB) is
  // allowed, and k/M/B/x/thousand/million/billion scale it.
  const re = /(?<![\w.])[$€£]?(\d[\d,]*(?:\.\d+)?)(?:\s*(%|thousand|million|billion|MM|bn|[kKmMBxX](?![a-zA-Z])))?/g;
  let m;
  const t = String(text || '');
  while ((m = re.exec(t))) {
    const n = Number(m[1].replace(/,/g, ''));
    if (!Number.isFinite(n)) continue;
    out.add(n);
    const suf = (m[2] || '').toLowerCase();
    if (suf === 'k' || suf === 'thousand') out.add(n * 1000);
    if (suf === 'm' || suf === 'mm' || suf === 'million') out.add(n * 1e6);
    if (suf === 'b' || suf === 'bn' || suf === 'billion') out.add(n * 1e9);
  }
  return out;
}

/** Numbers one entry supports: its text fields and metrics, plus the years of its date fields (never their months). */
function numbersOfEntry(entry) {
  const set = new Set();
  const walk = (v) => { if (v == null) return; if (Array.isArray(v)) v.forEach(walk); else if (typeof v === 'object') Object.entries(v).forEach(([k, x]) => { if (!DATE_FIELDS.has(k) && k !== 'provenance' && k !== 'achievements' && k !== 'id' && k !== 'evidence' && k !== 'skills') walk(x); }); else for (const n of numbersIn(String(v))) set.add(n); };
  walk(entry);
  for (const m of entry.metrics || []) if (typeof m.value === 'number') set.add(m.value);
  for (const f of DATE_FIELDS) if (entry[f] && /^\d{4}/.test(String(entry[f]))) set.add(Number(String(entry[f]).slice(0, 4)));
  return set;
}

/** Numbers the cited facts (and an achievement's parent role) support. */
function supportedNumbers(hits) {
  const set = new Set();
  for (const h of hits) {
    for (const n of numbersOfEntry(h.entry)) set.add(n);
    if (h.parent) for (const n of numbersOfEntry(h.parent)) set.add(n);
  }
  return set;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9+#.&' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const contains = (hay, needle) => norm(hay).includes(norm(needle));
function datePair(line) {
  const m = /(?:((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*)\.? )?(\d{4})\s*(?:-|–|—|to)\s*(?:(?:((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*)\.? )?(\d{4})|(present|current|now))/i.exec(line);
  if (!m) return null;
  const mon = (s) => (s ? MONTHS.indexOf(s.slice(0, 3).toLowerCase()) + 1 : null);
  return { start: { y: Number(m[2]), m: mon(m[1]) }, end: m[5] ? 'present' : { y: Number(m[4]), m: mon(m[3]) } };
}
function dateMatches(wanted, entryDate) {
  if (wanted === 'present') return !entryDate || /present/i.test(entryDate);
  if (!entryDate || /present/i.test(entryDate)) return false;
  const [y, mo] = entryDate.split('-').map(Number);
  if (y !== wanted.y) return false;
  return wanted.m == null || mo == null || wanted.m === mo;
}

/** Cover-letter lines that are not claims: name, contact, date, greeting, closing, signature. */
function isLetterBoilerplate(plain, id) {
  const p = plain.trim();
  if (!p) return true;
  if (id.name && norm(p) === norm(id.name)) return true;
  if ((id.email && p.includes(id.email)) || (id.phone && p.replace(/\D/g, '').includes(String(id.phone).replace(/\D/g, '')) && p.length < 120)) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(p) || /^(?:\d{1,2} )?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,? ?(?:\d{1,2},? )?\d{4}$/i.test(p)) return true;
  if (/^(?:dear|hello|hi|to whom)\b/i.test(p) && p.length < 80) return true;
  if (/^(?:sincerely|best regards|kind regards|warm regards|regards|respectfully|thank you|yours (?:truly|sincerely|faithfully)|best),?$/i.test(p)) return true;
  if (/^(?:re|subject):/i.test(p)) return true;
  return false;
}

/** Split a document into logical lines, attaching a marker-only line to the line before it. */
function logicalLines(text) {
  const raw = text.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  raw.forEach((line, i) => {
    const t = line.trim();
    if (/^<!--[\s\S]*-->$/.test(t) && parseMarkers(t).length && out.length && !out[out.length - 1].blank) {
      out[out.length - 1].text += ` ${t}`;
      return;
    }
    out.push({ n: i + 1, text: line, blank: t === '' });
  });
  return out;
}

const sectionOf = (heading) => {
  const h = norm(heading);
  if (/summary|profile|about|objective/.test(h)) return 'summary';
  if (/skill|technolog|competenc|expertise|tools/.test(h)) return 'skills';
  if (/experience|employment|work history|career|professional background/.test(h)) return 'experience';
  if (/education|academic/.test(h)) return 'education';
  if (/certif|licen|credential/.test(h)) return 'certifications';
  if (/project/.test(h)) return 'projects';
  if (/publication|talk|speaking/.test(h)) return 'publications';
  if (/award|honor|honour|recognition/.test(h)) return 'awards';
  if (/volunteer|community/.test(h)) return 'volunteering';
  if (/language/.test(h)) return 'languages';
  return 'other';
};

/**
 * Check a resume draft. Returns the report: `{ verdict, findings[], coverage, stats }`.
 * `job` (career-job/1) and `match` (career-match/1) are optional but needed for keyword checks.
 */
export function checkResume(text, profile, { job = null, match = null, kind = 'resume', include = [] } = {}) {
  const index = indexProfile(profile);
  const matchers = buildMatchers(profile);
  const evidence = buildEvidenceIndex(profile, matchers);
  const findings = [];
  const add = (severity, code, n, message, extra = {}) => findings.push({ severity, code, line: n, message, ...extra });
  const lines = logicalLines(text);
  let section = kind === 'resume' ? 'header' : 'body';
  let currentRole = null;
  let headerLines = 0;
  const citedIds = new Set();
  const usedTerms = new Map();
  const jobTerms = new Map((job ? job.keywords : []).map((k) => [k.term, k]));
  const matchTerms = new Map((match ? match.keywords : []).map((k) => [k.term, k]));
  const sectionsSeen = new Set();
  let paragraphNo = 0;
  const id = profile.identity || {};

  for (const L of lines) {
    const t = L.text.trim();
    if (!t) continue;
    if (/^#\s/.test(t) && section === 'header') { headerLines += 1; if (kind === 'resume' && id.name && !contains(t, id.name)) add('fail', 'name-mismatch', L.n, `the name line does not contain "${id.name}"`); continue; }
    if (/^##\s/.test(t)) { section = sectionOf(t.replace(/^##\s*/, '')); sectionsSeen.add(section); currentRole = null; continue; }
    if (/^(?:---|\*\*\*|___)\s*$/.test(t)) continue;
    if (/^<!--/.test(t) && /-->$/.test(t) && !parseMarkers(t).length) continue;
    const plain = stripComments(t).trim();
    if (kind !== 'resume' && isLetterBoilerplate(plain, id)) continue;
    const ids = parseMarkers(t);
    const hits = [];
    for (const cid of ids) {
      if (PSEUDO.has(cid)) { hits.push({ id: cid, kind: cid, entry: { ...(profile[cid] || {}) }, parent: null }); continue; }
      const hit = index.get(cid);
      if (!hit) { add('fail', 'unknown-fact', L.n, `cited id "${cid}" does not exist in the profile`); continue; }
      if (!hit.entry.provenance || hit.entry.provenance.confirmed !== true) add('fail', 'unconfirmed-fact', L.n, `cited id "${cid}" is not confirmed; confirm it with the user first ("fact confirm ${cid}")`);
      hits.push({ id: cid, ...hit });
      citedIds.add(cid);
    }
    if (!plain) continue;

    // Header contact lines (resume): everything must come from identity.
    if (section === 'header' && kind === 'resume') {
      if (!ids.includes('identity')) add('fail', 'uncited', L.n, 'contact line must carry <!-- fact: identity -->');
      const email = /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(plain);
      if (email && id.email && email[0].toLowerCase() !== id.email.toLowerCase()) add('fail', 'contact-mismatch', L.n, `email ${email[0]} is not the profile email`);
      const phone = /\+?\d[\d ()./-]{7,}\d/.exec(plain);
      if (phone && id.phone && phone[0].replace(/\D/g, '') !== String(id.phone).replace(/\D/g, '')) add('fail', 'contact-mismatch', L.n, 'phone number is not the profile phone');
      for (const u of plain.match(/https?:\/\/\S+|\b[\w-]+\.(?:com|io|dev|me|org|net)\/\S*/g) || []) {
        const known = (id.links || []).some((l) => l && l.url && norm(l.url).replace(/^https?:\/\//, '').replace(/^www\./, '') === norm(u).replace(/^https?:\/\//, '').replace(/^www\./, ''));
        if (!known) add('fail', 'contact-mismatch', L.n, `link ${u} is not in the profile links`);
      }
      continue;
    }

    // Experience role headers.
    if (section === 'experience' && /^###\s/.test(t)) {
      const exp = hits.find((h) => h.kind === 'experience');
      if (!exp) { add('fail', 'uncited', L.n, 'role header must cite its experience id (<!-- fact: exp-NN -->)'); currentRole = null; continue; }
      currentRole = exp;
      const head = plain.replace(/^###\s*/, '');
      if (!contains(head, exp.entry.employer)) add('fail', 'employer-mismatch', L.n, `header does not name the employer "${exp.entry.employer}" of ${exp.id}`);
      if (!contains(head, exp.entry.title) && !contains(exp.entry.title, head.split(/[—–|·-]/)[0])) add('fail', 'title-mismatch', L.n, `header title differs from "${exp.entry.title}" recorded for ${exp.id} (titles are facts; do not inflate them)`);
      continue;
    }
    if (section === 'experience' && isDateLine(plain)) {
      const role = currentRole || hits.find((h) => h.kind === 'experience');
      if (!role) { add('fail', 'uncited', L.n, 'date line outside a cited role header'); continue; }
      const dp = datePair(plain);
      if (dp) {
        if (!dateMatches(dp.start, role.entry.start)) add('fail', 'date-mismatch', L.n, `start date does not match ${role.id} (${role.entry.start})`);
        if (!dateMatches(dp.end, role.entry.end)) add('fail', 'date-mismatch', L.n, `end date does not match ${role.id} (${role.entry.end || 'present'})`);
      }
      continue;
    }

    // Every other content line is a claim.
    const isClaim = /^[-*+]\s/.test(plain) || /^\d+[.)]\s/.test(plain) || section !== 'header';
    if (!isClaim) continue;
    paragraphNo += 1;
    if (!hits.length) { add('fail', 'uncited', L.n, `claim without a fact citation: "${plain.slice(0, 80)}"`); continue; }
    if (section === 'experience' && currentRole) {
      for (const h of hits) if (h.kind === 'achievement' && h.parent && h.parent.id !== currentRole.id) add('fail', 'misplaced-citation', L.n, `${h.id} belongs to ${h.parent.id}, not to ${currentRole.id}; achievements stay under the role where they happened`);
    }
    if (section === 'education') for (const h of hits) if (h.kind === 'education' && !contains(plain, h.entry.institution)) add('fail', 'institution-mismatch', L.n, `line does not name "${h.entry.institution}" (${h.id})`);
    if (section === 'certifications') for (const h of hits) if (h.kind === 'certifications' && !contains(plain, h.entry.name)) add('fail', 'certification-mismatch', L.n, `line does not name "${h.entry.name}" (${h.id})`);

    // Numbers must be supported by the cited facts.
    const supported = supportedNumbers(hits);
    // Full dates (2029-05, 2024-03-01) count by their year only; a supported year disappears before extraction.
    const claimNumbers = isDateLine(plain) ? new Set() : numbersIn(plain.replace(/\b((?:19|20)\d{2})-\d{2}(?:-\d{2})?\b/g, '$1').replace(/\b(19|20)\d{2}\b/g, (y) => (supported.has(Number(y)) ? '' : y)));
    for (const n of claimNumbers) if (!supported.has(n)) add('fail', 'number-unsupported', L.n, `the number ${n} is not in the cited facts (${ids.join(', ')}); numbers come from the store, not from memory`);

    // Skills lines: each listed item must be in the cited facts.
    if (section === 'skills') {
      const body = plain.replace(/^[-*+]\s*/, '').replace(/^\*\*[^*]+\*\*:?\s*/, '').replace(/^[^:]{1,40}:\s*/, '');
      const citedText = hits.map((h) => `${entryText(h.kind, h.entry)} ${(h.entry.aliases || []).join(' ')}`).join('\n');
      for (const item of body.split(/[,;·|•]+/).map((s) => s.trim()).filter(Boolean)) {
        const terms = findTerms(item, matchers).map((x) => x.term);
        const citedTerms = new Set(findTerms(citedText, matchers).map((x) => x.term));
        const ok = contains(citedText, item) || terms.some((x) => citedTerms.has(x));
        if (!ok) add('fail', 'skill-unsupported', L.n, `"${item}" is not in the cited facts (${ids.join(', ')})`);
      }
    }

    // Recognised terms used in the line: supported by the profile at all?
    for (const term of findTerms(plain, matchers)) {
      usedTerms.set(term.term, (usedTerms.get(term.term) || 0) + term.count);
      const ev = evidence.get(term.term) || [];
      const inJob = jobTerms.get(term.term);
      if (!ev.length) {
        const severity = (inJob && inJob.kind !== 'context') || section === 'skills' ? 'fail' : 'finding';
        add(severity, 'unsupported-term', L.n, `"${term.term}" (matched "${term.via}") has no evidence in the profile${inJob ? ' and is a job keyword' : ''}; remove it or add the fact after asking the user`);
      }
    }
  }

  // Claims that exceed their facts: leadership verbs without leadership in the cited facts; expertise above the recorded level.
  for (const L of lines) {
    const t = L.text.trim();
    if (!t || /^#/.test(t) || /^<!--/.test(t)) continue;
    const plain = stripComments(t).trim();
    const ids = parseMarkers(t);
    if (!ids.length || !plain) continue;
    const hits = ids.map((cid) => (PSEUDO.has(cid) ? { id: cid, kind: cid, entry: { ...(profile[cid] || {}) }, parent: null } : index.get(cid) && { id: cid, ...index.get(cid) })).filter(Boolean);
    if (!hits.length) continue;
    const verb = LEAD_CLAIM.exec(plain);
    if (verb && !/^###/.test(plain)) {
      const evidenceText = hits.map((h) => `${entryText(h.kind, h.entry)} ${h.parent ? `${h.parent.scope || ''} ${(h.parent.responsibilities || []).join(' ')} ${h.parent.title || ''} ${h.parent.reports || ''}` : ''} ${h.entry.title || ''} ${(h.entry.responsibilities || []).join(' ')}`).join('\n');
      if (!LEAD_EVIDENCE.test(evidenceText) && !hits.some((h) => h.kind === 'summary')) add('fail', 'exceeds', L.n, `"${verb[0]}" claims leadership or ownership that the cited facts (${ids.join(', ')}) do not record; use the fact's own verb or ask the user and record the scope first`);
    }
    for (const m of plain.matchAll(LEVEL_CLAIM)) {
      const name = m[1];
      const skill = (profile.skills || []).find((s) => s.name && name && (s.name.toLowerCase() === name.toLowerCase() || findTerms(name, matchers).some((x) => findTerms(s.name, matchers).some((y) => y.term === x.term))));
      if (skill && skill.level && (LEVEL_RANK[skill.level] || 0) < 3) add('fail', 'exceeds', L.n, `"${m[0].trim()}" is above the recorded level of ${skill.name} (${skill.level}, ${skill.id}); say what the fact supports`);
    }
    for (const h of hits) {
      if (h.kind === 'certifications' && isExpired(h.entry) && !/\b(?:expired|lapsed|renewal|renewing|formerly)\b/i.test(plain)) add('fail', 'expired-credential', L.n, `${h.entry.name} (${h.id}) expired ${h.entry.expires}; do not list it as current (ask whether it was renewed)`);
      if (tierOf(h.entry) === 'never') add('fail', 'pii-never', L.n, `${h.id} is a never-tier fact and cannot appear in any document`);
    }
  }

  // PII: detectors and the exact values of never-tier facts and unexported restricted fields.
  const pii = scanText(stripComments(text), { profileName: kind === 'resume' ? 'resume' : 'cover', profile, include });
  for (const h of pii.hits) add(h.severity === 'block' ? 'fail' : 'finding', h.severity === 'block' ? 'pii-block' : 'pii-review', h.line, `${h.label} (${h.detector}${h.sample ? `, ${h.sample}` : ''})${h.severity === 'block' ? '; remove it, or for a restricted field ask the user and pass --include restricted:<field>' : '; keep only if the user wants it in this market'}`);

  // Structure and ATS.
  const plainText = stripComments(text);
  const words = plainText.split(/\s+/).filter(Boolean).length;
  if (kind === 'resume') {
    if (!sectionsSeen.has('experience') && (profile.experience || []).length) add('finding', 'section-missing', null, 'no Experience section although the profile has work history');
    if (!sectionsSeen.has('skills')) add('finding', 'section-missing', null, 'no Skills section (ATS keyword scans read it first)');
    if (!sectionsSeen.has('education') && (profile.education || []).length) add('finding', 'section-missing', null, 'no Education section although the profile has education');
    if (headerLines === 0) add('finding', 'header-missing', null, 'no "# Name" header line');
    if (id.email && !plainText.includes(id.email)) add('finding', 'contact-missing', null, 'the profile email is not in the header');
    if (words > 1000) add('finding', 'too-long', null, `${words} words; two pages is about 1000 words`);
    if (words < 180) add('finding', 'too-short', null, `${words} words; a resume this short reads as unfinished`);
    if (/\breferences available\b/i.test(plainText)) add('finding', 'ats-style', null, '"References available upon request" wastes a line');
    if (/^\s*\|.*\|\s*$/m.test(plainText)) add('finding', 'ats-table', null, 'tables are often scrambled by applicant tracking systems');
    if (/!\[[^\]]*\]\(/.test(plainText)) add('finding', 'ats-image', null, 'images are ignored by applicant tracking systems');
    if (/^\s*[-*+]\s+I\b/m.test(plainText)) add('finding', 'style-first-person', null, 'bullets start with "I"; use the implied first person ("Led ...")');
    if (/\b(?:date of birth|dob|marital status|nationality)\b/i.test(plainText)) add('finding', 'privacy', null, 'personal data that most markets neither need nor want');
  } else {
    if (job && job.company && !contains(plainText, job.company)) add('fail', 'company-missing', null, `the cover letter never names ${job.company}`);
    if (job && job.title && !contains(plainText, job.title.split(/[(,]/)[0])) add('finding', 'title-missing', null, `the cover letter never names the role "${job.title}"`);
    if (/\[[^\]]{2,40}\]|\{\{[^}]+\}\}|\bTODO\b|lorem ipsum/i.test(plainText)) add('fail', 'placeholder', null, 'placeholder text left in the letter');
    if (/to whom it may concern/i.test(plainText)) add('finding', 'style-greeting', null, 'prefer "Dear Hiring Team" or a named person over "To whom it may concern"');
    if (words > 450) add('finding', 'too-long', null, `${words} words; cover letters land best at 250-400`);
    if (words < 120) add('finding', 'too-short', null, `${words} words; too short to make the case`);
  }

  // Coverage of job keywords.
  let coverage = null;
  if (job) {
    const rows = job.keywords.filter((k) => k.kind === 'must' || k.kind === 'nice').map((k) => {
      const m = matchTerms.get(k.term);
      const status = m ? m.status : (evidence.get(k.term) || []).length ? 'partial' : 'missing';
      const used = usedTerms.has(k.term);
      return { term: k.term, kind: k.kind, status, used, evidence: m ? m.evidence : (evidence.get(k.term) || []).map((e) => e.id) };
    });
    for (const r of rows) if (r.status !== 'missing' && !r.used && kind === 'resume') add('finding', 'keyword-unused', null, `${r.kind === 'must' ? 'required' : 'preferred'} keyword "${r.term}" is supported (${r.evidence.slice(0, 3).join(', ')}) but never appears; mirror the posting's wording`);
    const must = rows.filter((r) => r.kind === 'must');
    const nice = rows.filter((r) => r.kind === 'nice');
    coverage = {
      must: { total: must.length, supported: must.filter((r) => r.status !== 'missing').length, used: must.filter((r) => r.used).length },
      nice: { total: nice.length, supported: nice.filter((r) => r.status !== 'missing').length, used: nice.filter((r) => r.used).length },
      rows,
    };
  }
  const fails = findings.filter((f) => f.severity === 'fail').length;
  const verdict = fails ? 'FAIL' : findings.length ? 'PASS-WITH-FINDINGS' : 'PASS';
  return {
    schema: CHECK_SCHEMA, kind, checked_at: nowIso(), generated_by: generatedBy(),
    document_sha256: sha256(text), profile_sequence: profile.meta && profile.meta.sequence,
    job: job ? { title: job.title, company: job.company, text_sha256: job.text_sha256 } : null,
    verdict, counts: { fail: fails, finding: findings.length - fails, words, cited_facts: citedIds.size, pii_blocks: pii.blocks, pii_reviews: pii.reviews },
    include, findings, coverage, cited_ids: [...citedIds].sort(),
  };
}

// ---------------------------------------------------------------------------
// Drafts

const fmtMonth = (d) => {
  if (!d || /present/i.test(d)) return 'Present';
  const [y, m] = String(d).split('-');
  return m ? `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1]} ${y}` : y;
};
const joinLoc = (loc) => (loc && typeof loc === 'object' ? [loc.city, loc.region, loc.country].filter(Boolean).join(', ') : String(loc || ''));

/** Relevance of an entry to the job: number of distinct job keywords its text mentions, weighted. */
function relevance(entry, kind, matchers, jobTerms) {
  if (!jobTerms.size) return 0;
  let score = 0;
  for (const t of findTerms(entryText(kind, entry), matchers)) { const k = jobTerms.get(t.term); if (k) score += k.kind === 'must' ? 2 : k.kind === 'nice' ? 1 : 0.5; }
  return score;
}

/** A resume skeleton: every structural fact placed and cited, achievements listed in relevance order. */
const REGULATED = /\b(?:nurse|rn|lpn|clinical|medical|physician|therapist|pharmac|paramedic|electrician|plumber|hvac|welder|cdl|driver|pilot|teacher|attorney|lawyer|accountant|cpa|engineer\b.*\b(?:licensed|pe)\b|security guard)\b/i;
/** credentials-first when the role is regulated (licences decide the screen), else standard. */
export function layoutFor(profile, job) {
  const text = `${job && job.title ? job.title : ''} ${((profile.targets && profile.targets.roles) || []).join(' ')} ${(profile.experience || []).map((e) => e.title).join(' ')}`;
  return (profile.certifications || []).length && REGULATED.test(text) ? 'credentials-first' : 'standard';
}

export function draftResume(profile, { job = null, match = null, layout = null } = {}) {
  const id = profile.identity || {};
  const chosen = layout || layoutFor(profile, job);
  const matchers = buildMatchers(profile);
  const jobTerms = new Map((job ? job.keywords : []).filter((k) => k.kind !== 'context').map((k) => [k.term, k]));
  const supported = new Set((match ? match.keywords : []).filter((k) => k.status !== 'missing').map((k) => k.term));
  const confirmed = (e) => e.provenance && e.provenance.confirmed === true && tierOf(e) !== 'never';
  const out = [];
  out.push(`# ${id.name || 'NAME'}`);
  const contact = [joinLoc(id.location), id.email, id.phone, ...(id.links || []).map((l) => (l && l.url) || '')].filter(Boolean).join(' · ');
  out.push(`${contact} <!-- fact: identity -->`, '');
  out.push('<!-- Draft generated by career-profiler. Rewrite bullets for this job, keep every fact marker on the line it belongs to, delete what does not serve the application, then run "resume check". -->', '');
  if (job) out.push(`<!-- Target: ${job.title || 'role'} at ${job.company || 'company'}. Must-have keywords supported by the profile: ${[...supported].filter((t) => (jobTerms.get(t) || {}).kind === 'must').join(', ') || 'none recognised'}. Supported nice-to-haves: ${[...supported].filter((t) => (jobTerms.get(t) || {}).kind === 'nice').join(', ') || 'none'}. -->`, '');
  out.push('## Summary', '');
  const summaryIds = ['summary', ...(profile.experience || []).filter(confirmed).slice(0, 2).map((e) => e.id)];
  out.push(`${(profile.summary && profile.summary.pitch) || 'TODO: two or three sentences that answer the posting, built only from facts below.'} <!-- fact: ${summaryIds.join(', ')} -->`, '');
  const certsBlock = () => {
    const certs = (profile.certifications || []).filter(confirmed);
    if (!certs.length) return;
    out.push('## Certifications and licenses', '');
    for (const c of certs) {
      if (isExpired(c)) { out.push(`<!-- ${c.name} (${c.id}) expired ${c.expires}: left out; ask whether it was renewed -->`); continue; }
      out.push(`- ${c.name}${c.issuer ? `, ${c.issuer}` : ''}${c.date ? `, ${String(c.date).slice(0, 4)}` : ''}${c.expires ? ` (valid through ${fmtMonth(c.expires)})` : ''} <!-- fact: ${c.id} -->`);
    }
    out.push('');
  };
  if (chosen === 'credentials-first') certsBlock();
  // Skills grouped by category, job-relevant first.
  const skills = (profile.skills || []).filter(confirmed);
  if (skills.length) {
    out.push('## Skills', '');
    const groups = new Map();
    const relevanceOf = (s) => { const canon = findTerms(`${s.name} ${(s.aliases || []).join(' ')}`, matchers).map((t) => t.term); return canon.some((t) => (jobTerms.get(t) || {}).kind === 'must') ? 2 : canon.some((t) => jobTerms.has(t)) ? 1 : 0; };
    for (const s of [...skills].sort((a, b) => relevanceOf(b) - relevanceOf(a))) {
      const g = s.category || 'General';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(s);
    }
    for (const [g, list] of groups) out.push(`- **${g.charAt(0).toUpperCase() + g.slice(1)}:** ${list.map((s) => s.name).join(', ')} <!-- fact: ${list.map((s) => s.id).join(', ')} -->`);
    out.push('');
  }
  const exps = (profile.experience || []).filter(confirmed).sort((a, b) => String(b.start).localeCompare(String(a.start)));
  if (exps.length) {
    out.push('## Experience', '');
    for (const e of exps) {
      out.push(`### ${e.title} — ${e.employer} <!-- fact: ${e.id} -->`);
      out.push(`${[joinLoc(e.location), `${fmtMonth(e.start)} – ${fmtMonth(e.end)}`].filter(Boolean).join(' · ')}`);
      const achs = (e.achievements || []).filter(confirmed).map((a) => ({ a, r: relevance(a, 'achievement', matchers, jobTerms) })).sort((x, y) => y.r - x.r);
      for (const { a, r } of achs) out.push(`- ${a.text} <!-- fact: ${a.id} -->${r ? '' : ' <!-- low relevance to this posting: cut or shorten -->'}`);
      if (!achs.length) out.push(`<!-- no confirmed achievements recorded for ${e.id}; interview the user before writing bullets -->`);
      out.push('');
    }
  }
  const edu = (profile.education || []).filter(confirmed);
  if (edu.length) {
    out.push('## Education', '');
    for (const d of edu) out.push(`- ${[d.degree, d.field].filter(Boolean).join(' in ')}${d.degree || d.field ? ', ' : ''}${d.institution}${d.end ? `, ${String(d.end).slice(0, 4)}` : ''}${d.honors ? ` (${d.honors})` : ''} <!-- fact: ${d.id} -->`);
    out.push('');
  }
  if (chosen !== 'credentials-first') certsBlock();
  const projects = (profile.projects || []).filter(confirmed).map((p) => ({ p, r: relevance(p, 'projects', matchers, jobTerms) })).filter((x) => x.r > 0 || !job);
  if (projects.length) {
    out.push('## Projects', '');
    for (const { p } of projects) out.push(`- **${p.name}**${p.role ? ` (${p.role})` : ''}: ${p.summary || ''} <!-- fact: ${p.id} -->`);
    out.push('');
  }
  return `${out.join('\n').trim()}\n`;
}

export function draftCoverLetter(profile, { job = null, match = null } = {}) {
  const id = profile.identity || {};
  const top = (match ? match.highlights : []).slice(0, 6);
  const gaps = (match ? match.gaps : []).slice(0, 4);
  const lines = [
    `${id.name || 'NAME'}`, `${[id.email, id.phone, joinLoc(id.location)].filter(Boolean).join(' · ')}`, '',
    `${nowIso().slice(0, 10)}`, '',
    `Dear ${job && job.company ? `${job.company} Hiring Team` : 'Hiring Team'},`, '',
    `<!-- Opening: name the role (${job && job.title ? job.title : 'TODO role'}) and one reason this candidate fits it; one fact citation at the end of the paragraph. -->`,
    'TODO opening paragraph. <!-- fact: identity -->', '',
    `<!-- Body 1: the strongest matching evidence. Supported keywords: ${top.map((h) => `${h.term} (${h.evidence.slice(0, 2).join(', ')})`).join('; ') || 'run match first'}. -->`,
    'TODO body paragraph with one or two concrete results, numbers only from the cited facts. <!-- fact: TODO -->', '',
    '<!-- Body 2: why this company or team, in their own words from the posting; connect to a second fact. -->',
    'TODO second body paragraph. <!-- fact: TODO -->', '',
    gaps.length ? `<!-- Gaps the letter must not paper over: ${gaps.map((g) => g.term).join(', ')}. Do not claim them. -->` : '<!-- No missing must-have keywords. -->',
    '<!-- Closing: one sentence, availability, thanks. -->',
    'TODO closing. <!-- fact: identity -->', '',
    'Sincerely,', `${id.name || 'NAME'}`, '',
  ];
  return `${lines.join('\n')}`;
}

// ---------------------------------------------------------------------------
// Finalize

function mdToText(md) {
  return md.split('\n').map((l) => {
    if (/^#\s/.test(l)) return l.replace(/^#\s*/, '').toUpperCase();
    if (/^##\s/.test(l)) return `\n${l.replace(/^##\s*/, '').toUpperCase()}`;
    if (/^###\s/.test(l)) return l.replace(/^###\s*/, '');
    return l.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function inline(s) {
  return esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
}
function mdToHtml(md, title) {
  const body = [];
  let inList = false;
  const closeList = () => { if (inList) { body.push('</ul>'); inList = false; } };
  for (const raw of md.split('\n')) {
    const l = raw.trimEnd();
    if (!l.trim()) { closeList(); continue; }
    if (/^#\s/.test(l)) { closeList(); body.push(`<h1>${inline(l.replace(/^#\s*/, ''))}</h1>`); continue; }
    if (/^##\s/.test(l)) { closeList(); body.push(`<h2>${inline(l.replace(/^##\s*/, ''))}</h2>`); continue; }
    if (/^###\s/.test(l)) { closeList(); body.push(`<h3>${inline(l.replace(/^###\s*/, ''))}</h3>`); continue; }
    if (/^[-*+]\s/.test(l)) { if (!inList) { body.push('<ul>'); inList = true; } body.push(`<li>${inline(l.replace(/^[-*+]\s*/, ''))}</li>`); continue; }
    closeList();
    body.push(`<p>${inline(l)}</p>`);
  }
  closeList();
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>\n<style>\nbody{font-family:Georgia,"Times New Roman",serif;font-size:11pt;line-height:1.35;color:#111;max-width:7.5in;margin:0.6in auto;padding:0 0.25in}\nh1{font-size:20pt;margin:0 0 2pt}h2{font-size:12pt;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #999;margin:14pt 0 4pt;padding-bottom:2pt}h3{font-size:11pt;margin:8pt 0 0}\np{margin:2pt 0}ul{margin:2pt 0 4pt 1.1em;padding:0}li{margin:1pt 0}a{color:inherit;text-decoration:none}\n@media print{body{margin:0;max-width:none}@page{margin:0.6in}}\n</style></head><body>\n${body.join('\n')}\n</body></html>\n`;
}

/** JSON Resume (https://jsonresume.org/schema) built from the profile and the cited draft's chosen ids. */
export function jsonResume(profile, draftText, { include = [] } = {}) {
  const id = profile.identity || {};
  const ids = new Set(parseMarkers(draftText.replace(/\n/g, ' ')));
  const want = (e) => ids.has(e.id) && tierOf(e) !== 'never';
  const loc = id.location && typeof id.location === 'object' ? id.location : {};
  const profiles = (id.links || []).filter((l) => l && l.url).map((l) => ({ network: l.label || new URL(l.url).hostname.replace(/^www\./, ''), url: l.url }));
  const toYM = (d) => (d && !/present/i.test(d) ? String(d) : undefined);
  return {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: { name: id.name || '', label: id.headline || '', email: id.email || '', phone: id.phone || '', summary: (profile.summary && profile.summary.pitch) || '', location: { city: loc.city || '', region: loc.region || '', countryCode: loc.country || '' }, profiles },
    work: (profile.experience || []).filter(want).map((e) => ({ name: e.employer, position: e.title, location: e.location || '', startDate: toYM(e.start), endDate: toYM(e.end), summary: e.scope || '', highlights: (e.achievements || []).filter(want).map((a) => a.text) })),
    education: (profile.education || []).filter(want).map((d) => ({ institution: d.institution, studyType: d.degree || '', area: d.field || '', startDate: toYM(d.start), endDate: toYM(d.end) })),
    certificates: (profile.certifications || []).filter(want).map((c) => ({ name: c.name, issuer: c.issuer || '', date: toYM(c.date) })),
    skills: (profile.skills || []).filter(want).map((s) => ({ name: s.name, level: s.level || '', keywords: s.aliases || [] })),
    projects: (profile.projects || []).filter(want).map((p) => ({ name: p.name, description: p.summary || '', url: p.url || '', keywords: p.stack || [] })),
    languages: (profile.languages || []).filter(want).map((l) => ({ language: l.name, fluency: l.level || '' })),
    meta: { generated_by: generatedBy(), include },
  };
}

export function pandocAvailable() {
  const r = spawnSync('pandoc', ['--version'], { encoding: 'utf8' });
  return r.status === 0 ? (r.stdout.split('\n')[0] || 'pandoc') : null;
}

/** Strip citations and write the deliverables next to the draft. Returns the files written. */
export function finalize(draftPath, { formats = ['md', 'txt', 'html'], title, docx = false, profile = null, include = [] } = {}) {
  const text = readText(draftPath);
  const plain = stripComments(text).replace(/\n{3,}/g, '\n\n').trim() + '\n';
  const base = draftPath.replace(/\.md$/i, '');
  const files = [];
  const name = title || (/^#\s*(.+)$/m.exec(plain) || [])[1] || path.basename(base);
  if (formats.includes('md')) { writeFileAtomic(`${base}.final.md`, plain); files.push(`${base}.final.md`); }
  if (formats.includes('txt')) { writeFileAtomic(`${base}.txt`, mdToText(plain)); files.push(`${base}.txt`); }
  if (formats.includes('html')) { writeFileAtomic(`${base}.html`, mdToHtml(plain, name)); files.push(`${base}.html`); }
  if (formats.includes('json') && profile) { writeFileAtomic(`${base}.json`, `${JSON.stringify(jsonResume(profile, text, { include }), null, 2)}\n`); files.push(`${base}.json`); }
  let docxResult = null;
  if (docx || formats.includes('docx')) {
    if (pandocAvailable()) {
      const r = spawnSync('pandoc', [`${base}.final.md`, '-f', 'gfm', '-o', `${base}.docx`], { encoding: 'utf8' });
      docxResult = r.status === 0 ? `${base}.docx` : `pandoc failed: ${(r.stderr || '').trim()}`;
      if (r.status === 0) files.push(`${base}.docx`);
    } else docxResult = 'pandoc not installed: open the .html in a browser and print to PDF, or paste the .final.md into a document editor';
  }
  return { files, docx: docxResult, words: plain.split(/\s+/).filter(Boolean).length };
}

export { exists, fs };
