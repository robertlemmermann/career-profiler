// Job posting intake: text or HTML or a URL in, a career-job/1 document out (title, company,
// location, remote, seniority, years, requirement lines classified as must / nice /
// responsibility, recognised keywords). The model refines what the heuristics miss; the file is
// what `match` and `resume check` read.

import { JOB_SCHEMA, nowIso, sha256, generatedBy, slugify, uniq, unverifiable } from './core.mjs';
import { buildMatchers, findTerms } from './taxonomy.mjs';

const HEADINGS = [
  { kind: 'must', re: /^(?:minimum|basic|required|essential|core)?\s*(?:qualifications|requirements|skills(?: and| &)? (?:experience|qualifications)|what (?:you(?:'ll|’ll| will)? (?:need|bring)|we(?:'re|’re| are) looking for)|who you are|must[- ]haves?|you have|your (?:profile|background|experience)|about you|experience(?: required)?|ideal candidate)\b/i },
  { kind: 'nice', re: /^(?:preferred|desired|desirable|bonus|nice[- ]to[- ]haves?|good to have|plus(?:es)?|additional|extra credit|it would be great|you might also have|preferred qualifications)\b/i },
  { kind: 'responsibility', re: /^(?:responsibilities|duties|what you(?:'ll|’ll| will) (?:do|be doing|own|work on)|the role|your role|in this role|day[- ]to[- ]day|key responsibilities|job duties|essential (?:functions|duties)|about the (?:role|job|position))\b/i },
  { kind: 'context', re: /^(?:about (?:us|the (?:company|team))|who we are|our (?:team|mission|company)|benefits|perks|compensation|salary|what we offer|why join|equal opportunity|eeo|how to apply|the team)\b/i },
];
const MUST_CUES = /\b(?:required|must(?: have)?|minimum|at least|essential|mandatory|need(?:s|ed)? to|proven|strong|demonstrated|expert(?:ise)?|solid|deep)\b/i;
const NICE_CUES = /\b(?:preferred|nice to have|a plus|plus|bonus|desirable|ideally|familiarity with|exposure to|is a strong plus|would be (?:great|nice|a bonus)|not required|helpful)\b/i;
const YEARS_RE = /(\d{1,2})\s*(?:\+|or more|plus)?\s*(?:-|to|–)?\s*(\d{1,2})?\s*\+?\s*(?:years?|yrs?)(?:'|’)?(?:\s+of)?(?:\s+(?:professional|relevant|hands[- ]on|industry|progressive|work|direct|related|proven|commercial|demonstrated|experience))*\s*(?:experience|exp\.?)?(?:\s+(?:in|with|of|as|using|building|developing|leading|working))?\s*([^.;,\n]{0,60})?/gi;
const SENIORITY = [
  ['intern', /\b(?:intern|internship|trainee)\b/i], ['entry', /\b(?:entry[- ]level|junior|graduate|associate|apprentice|new grad)\b/i],
  ['mid', /\b(?:mid[- ]level|intermediate)\b/i], ['senior', /\bsenior\b|\bsr\.?\b/i], ['lead', /\b(?:lead|tech lead|team lead|supervisor|charge)\b/i],
  ['staff', /\b(?:staff|principal|distinguished|architect|fellow)\b/i], ['manager', /\b(?:manager|head of)\b/i], ['director', /\b(?:director|vp|vice president|chief|c[a-z]o)\b/i],
];
export const SENIORITY_RANK = { intern: 0, entry: 1, mid: 2, senior: 3, lead: 4, staff: 5, manager: 5, director: 6 };
const REMOTE = [['remote', /\b(?:fully remote|100% remote|remote[- ]first|work from home|wfh|remote)\b/i], ['hybrid', /\bhybrid\b/i], ['onsite', /\b(?:on[- ]?site|in[- ]office|in person)\b/i]];
const EMPLOYMENT = [['full-time', /\bfull[- ]time\b/i], ['part-time', /\bpart[- ]time\b/i], ['contract', /\b(?:contract|contractor|freelance|temporary|temp)\b/i], ['internship', /\binternship\b/i]];
const TITLE_WORDS = /\b(?:engineer|developer|manager|nurse|analyst|designer|director|specialist|coordinator|lead|architect|scientist|consultant|technician|assistant|associate|administrator|accountant|teacher|therapist|representative|executive|officer|supervisor|clerk|electrician|plumber|driver|mechanic|writer|editor|recruiter|planner|pharmacist|physician|paralegal|chef|cook|cashier|intern|head of|vp|president|principal|staff)\b/i;

/** Strip HTML to plain text (block elements become line breaks, entities decoded). */
export function htmlToText(html) {
  let t = String(html);
  t = t.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  t = t.replace(/<\s*(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/header|\/ul|\/ol|\/dd|\/dt)\b[^>]*>/gi, '\n');
  t = t.replace(/<\s*li\b[^>]*>/gi, '\n- ');
  t = t.replace(/<[^>]+>/g, ' ');
  t = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
  return t.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export const looksLikeHtml = (s) => /<\s*(?:html|body|div|p|ul|li|br|h[1-6])\b/i.test(s);

/** Fetch a URL to text (Node's global fetch). Exit 4 when it cannot be read. */
export async function fetchPosting(url, { timeoutMs = 20000 } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { 'user-agent': `career-profiler/1 (+https://github.com/robertlemmermann/career-profiler)`, accept: 'text/html,text/plain;q=0.9,*/*;q=0.5' } });
    if (!res.ok) throw unverifiable('FETCH_FAILED', `GET ${url} returned ${res.status}; paste the posting text instead`);
    const body = await res.text();
    const text = looksLikeHtml(body) ? htmlToText(body) : body;
    if (text.trim().length < 200) throw unverifiable('FETCH_EMPTY', `GET ${url} returned almost no text (a login wall or a JavaScript-only page); paste the posting text instead`);
    return text;
  } catch (err) {
    if (err && err.exit) throw err;
    throw unverifiable('FETCH_FAILED', `cannot fetch ${url}: ${err && err.message ? err.message : err}; paste the posting text instead`);
  } finally { clearTimeout(timer); }
}

const clean = (s) => s.replace(/^[\s•·▪●◦*\-–—]+/, '').replace(/\s+/g, ' ').trim();
const isHeading = (line) => line.length <= 60 && !/[.;]$/.test(line) && (/^#+\s/.test(line) || /^[A-Z][^a-z]{0,2}[\w\s/&'’()-]*:?$/.test(line) || /:$/.test(line));
function headingKind(line) {
  const l = clean(line.replace(/^#+\s*/, '')).replace(/:$/, '');
  for (const h of HEADINGS) if (h.re.test(l)) return h.kind;
  return null;
}

/** Guess the title and company from the first lines and explicit labels. */
function guessTitleCompany(lines, text) {
  let title = null;
  let company = null;
  const label = (re) => { const m = re.exec(text); return m ? clean(m[1]) : null; };
  title = label(/^(?:job )?title\s*[:\-]\s*(.+)$/im) || label(/^(?:position|role)\s*[:\-]\s*(.+)$/im);
  company = label(/^(?:company|employer|organization|organisation)\s*[:\-]\s*(.+)$/im);
  const head = lines.slice(0, 12);
  for (let i = 0; i < head.length; i++) {
    const l = clean(head[i].replace(/^#+\s*/, ''));
    if (!l || l.length > 90) continue;
    if (!title && TITLE_WORDS.test(l) && !/\b(?:about|we are|our|you will|you'll)\b/i.test(l)) {
      const m = /^(.*?)\s+(?:at|@|-|–|—|\|)\s+([A-Z][\w&.'’ -]{1,40})$/.exec(l);
      if (m && TITLE_WORDS.test(m[1])) { title = clean(m[1]); company = company || clean(m[2]); } else title = l.replace(/\s*\(.*\)$/, '');
      // "Company – City, ST" or "Company · Remote" on the next line.
      const next = clean((head[i + 1] || '').replace(/^#+\s*/, ''));
      const nm = /^([A-Z][\w&.'’ -]{2,60}?)\s*(?:–|—|-|·|\|)\s*(.{2,60})$/.exec(next);
      if (!company && nm && !TITLE_WORDS.test(nm[1]) && nm[1].split(/\s+/).length <= 6 && !/\b(?:about|we are)\b/i.test(nm[1])) company = clean(nm[1]);
      continue;
    }
  }
  if (!company) {
    const m = /\b(?:about|join|at)\s+([A-Z][\w&.'’-]*(?:\s+[A-Z][\w&.'’-]*){0,3})(?=[\s,.:!])/.exec(text) || /^([A-Z][\w&.'’-]*(?:\s+[A-Z][\w&.'’-]*){0,3}) is (?:a|an|the|hiring|looking)\b/m.exec(text);
    if (m) company = clean(m[1]);
  }
  return { title, company };
}

function detect(list, text) {
  for (const [label, re] of list) if (re.test(text)) return label;
  return null;
}

export function seniorityOf(title) {
  if (!title) return null;
  let best = null;
  for (const [label, re] of SENIORITY) if (re.test(title)) best = best == null || SENIORITY_RANK[label] > SENIORITY_RANK[best] ? label : best;
  return best;
}

/** Parse a posting's plain text into a career-job/1 document. */
export function parseJob(rawText, { source = 'inline', profile = null } = {}) {
  const text = (looksLikeHtml(rawText) ? htmlToText(rawText) : String(rawText)).replace(/\r\n/g, '\n').replace(/\t/g, ' ');
  const lines = text.split('\n').map((l) => l.replace(/\s+$/, ''));
  const { title, company } = guessTitleCompany(lines.filter((l) => l.trim()), text);
  const matchers = buildMatchers(profile);
  const requirements = [];
  let section = 'context';
  let seenHeading = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (isHeading(line) || /^#+\s/.test(line)) {
      const k = headingKind(line);
      if (k) { section = k; seenHeading = true; continue; }
      if (/^#+\s/.test(line)) { section = 'context'; continue; }
    }
    const body = clean(line);
    if (body.length < 12 || /^(?:[A-Z][a-z]+ ?){1,3}:$/.test(body)) continue;
    const bulletish = /^[•·▪●◦*\-–—]\s*/.test(line) || /^\d+[.)]\s/.test(line);
    let kind = section;
    if (section === 'context' && !seenHeading) {
      if (MUST_CUES.test(body) && (bulletish || /\bexperience\b/i.test(body))) kind = 'must';
      else if (NICE_CUES.test(body) && bulletish) kind = 'nice';
      else if (bulletish && /^(?:you(?:'ll|’ll| will)|own|lead|build|design|drive|manage|collaborate|partner|mentor|develop|deliver|ensure|provide|maintain|support)\b/i.test(body)) kind = 'responsibility';
    } else if (section === 'must' && NICE_CUES.test(body) && !MUST_CUES.test(body)) kind = 'nice';
    if (kind === 'context' && !bulletish && !MUST_CUES.test(body)) {
      // Prose paragraphs outside a requirements section are context, but keep them for keyword counts.
      requirements.push({ id: null, text: body, kind: 'context', keywords: findTerms(body, matchers).map((t) => t.term) });
      continue;
    }
    const terms = findTerms(body, matchers);
    requirements.push({ id: null, text: body, kind, keywords: terms.map((t) => t.term) });
  }
  let n = 0;
  for (const r of requirements) if (r.kind !== 'context') r.id = `req-${String(++n).padStart(2, '0')}`;

  // Keywords: strongest kind wins (must > nice > responsibility > context), with counts.
  const rank = { must: 3, nice: 2, responsibility: 1, context: 0 };
  const kw = new Map();
  for (const r of requirements) {
    for (const t of findTerms(r.text, matchers)) {
      const cur = kw.get(t.term) || { term: t.term, category: t.category, kind: 'context', count: 0, via: t.via };
      cur.count += t.count;
      if (rank[r.kind] > rank[cur.kind]) cur.kind = r.kind;
      kw.set(t.term, cur);
    }
  }
  // Title terms are always must: "Lead React Engineer" wants React and leadership.
  if (title) for (const t of findTerms(title, matchers)) { const cur = kw.get(t.term) || { term: t.term, category: t.category, kind: 'must', count: 0, via: t.via }; cur.kind = 'must'; cur.in_title = true; kw.set(t.term, cur); }
  const keywords = [...kw.values()].sort((a, b) => rank[b.kind] - rank[a.kind] || b.count - a.count);

  // Years of experience: "5+ years of React", "3-5 years experience".
  const years = [];
  let m;
  YEARS_RE.lastIndex = 0;
  while ((m = YEARS_RE.exec(text))) {
    const lo = Number(m[1]);
    const hi = m[2] ? Number(m[2]) : null;
    const topic = clean(m[3] || '');
    const terms = findTerms(topic, matchers).map((t) => t.term);
    years.push({ min: lo, max: hi, topic: topic || null, terms, text: clean(m[0]).slice(0, 120) });
  }
  const general = years.filter((y) => !y.terms.length);
  const yearsRequired = general.length ? Math.max(...general.map((y) => y.min)) : (years.length ? Math.max(...years.map((y) => y.min)) : null);

  const job = {
    schema: JOB_SCHEMA,
    source, fetched_at: nowIso(), generated_by: generatedBy(),
    title: title || null, company: company || null,
    seniority: seniorityOf(title),
    location: (/(?:location|based in|office)\s*[:\-]?\s*([A-Z][\w .,'-]{2,60})/.exec(text) || [])[1] || null,
    remote: detect(REMOTE, text), employment_type: detect(EMPLOYMENT, text),
    years_required: yearsRequired, years_mentions: years,
    requirements: requirements.filter((r) => r.kind !== 'context'),
    context_lines: requirements.filter((r) => r.kind === 'context').length,
    keywords,
    counts: {
      must: requirements.filter((r) => r.kind === 'must').length,
      nice: requirements.filter((r) => r.kind === 'nice').length,
      responsibility: requirements.filter((r) => r.kind === 'responsibility').length,
      keywords_must: keywords.filter((k) => k.kind === 'must').length,
      keywords_nice: keywords.filter((k) => k.kind === 'nice').length,
    },
    text_sha256: sha256(text), text_chars: text.length,
    slug: slugify(`${company || 'company'}-${title || 'role'}`),
    warnings: [],
  };
  if (!job.title) job.warnings.push('no title recognised; set it with --title or edit job.json');
  if (!job.company) job.warnings.push('no company recognised; set it with --company or edit job.json');
  if (!job.requirements.length) job.warnings.push('no requirement lines recognised; the posting may be prose only, read it and add requirements by hand');
  if (text.length < 300) job.warnings.push('the posting is very short; ask the user for the full text');
  return job;
}

export { uniq };
