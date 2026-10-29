// Job-source watching: subscriptions to legal sources, polling without a model, dedupe, matching
// against the profile, an inbox of matches, and drafts per the user's automation preference.
// Nothing here submits anything anywhere.

import fs from 'node:fs';
import path from 'node:path';
import { ASSETS_DIR, readJson, writeJsonAtomic, writeFileAtomic, exists, isDir, nowIso, sha256, slugify, usageError, unverifiable, tryJson, truncate, uniq } from './core.mjs';
import { parseJob, htmlToText, looksLikeHtml, REFUSED_HOSTS } from './job.mjs';
import { matchJob } from './match.mjs';
import { draftResume, draftCoverLetter, checkResume } from './resume.mjs';
import { scanText, loadPolicy } from './pii.mjs';

let catalog;
export function loadCatalog() { if (!catalog) catalog = readJson(path.join(ASSETS_DIR, 'sources', 'catalog.json')); return catalog; }

const subsFile = (paths) => path.join(paths.watch, 'subscriptions.json');
const seenFile = (paths) => path.join(paths.watch, 'seen.json');
export function readSubs(paths) { return exists(subsFile(paths)) ? readJson(subsFile(paths)) : { schema: 'career-watch/1', subscriptions: [] }; }
export function writeSubs(paths, subs) { fs.mkdirSync(paths.watch, { recursive: true, mode: 0o700 }); writeJsonAtomic(subsFile(paths), subs, { mode: 0o600 }); }
const readSeen = (paths) => (exists(seenFile(paths)) ? readJson(seenFile(paths)) : { fingerprints: {} });
const writeSeen = (paths, seen) => writeJsonAtomic(seenFile(paths), seen, { mode: 0o600 });

/** Validate and add a subscription. Refused families exit 1 with the alternative. */
export function addSubscription(paths, { source, board, url, query, country, filePath, mode = 'inherit', minFit = 0.6 }) {
  const cat = loadCatalog();
  const fam = String(source || '').toLowerCase();
  if (cat.refused[fam]) {
    const r = cat.refused[fam];
    throw Object.assign(usageError(`${fam} is refused: ${r.reason}. Alternative: ${r.alternative}`), { exit: 1, code: 'REFUSED_TOS_AUTOMATION', details: { refused: fam, reason: r.reason, alternative: r.alternative } });
  }
  if (url) { let h = ''; try { h = new URL(url).hostname; } catch { throw usageError(`not a URL: ${url}`); } if (REFUSED_HOSTS.some((re) => re.test(h))) throw Object.assign(usageError(`${h} is refused: its terms forbid automated access; use its job-alert emails with --source email`), { exit: 1, code: 'REFUSED_TOS_AUTOMATION' }); }
  const f = cat.families[fam];
  if (!f) throw usageError(`unknown source "${source}"; families: ${Object.keys(cat.families).join(', ')}`);
  for (const a of f.args) {
    const v = { board, url, query, country, path: filePath }[a];
    if (!v) throw usageError(`--source ${fam} needs --${a}${f.example ? ` (example: ${f.example})` : ''}`);
  }
  if (!['inherit', 'alert', 'draft', 'prepare'].includes(mode)) throw usageError('--mode must be inherit, alert, draft or prepare');
  const subs = readSubs(paths);
  const id = `S-${String(subs.subscriptions.length + 1).padStart(2, '0')}`;
  const sub = { id, source: fam, board: board || null, url: url || null, query: query || null, country: country || null, path: filePath ? path.resolve(filePath) : null, mode, min_fit: Number(minFit), created_at: nowIso(), last_polled_at: null, last_result: null, needs_key: !!f.needs_key, key_env: f.key_env || null };
  subs.subscriptions.push(sub);
  writeSubs(paths, subs);
  return sub;
}

export function removeSubscription(paths, id) {
  const subs = readSubs(paths);
  const before = subs.subscriptions.length;
  subs.subscriptions = subs.subscriptions.filter((s) => s.id !== id);
  if (subs.subscriptions.length === before) throw usageError(`no subscription "${id}"`);
  writeSubs(paths, subs);
}

/** The outbound request for a subscription: URL and headers; query terms only, never profile values. */
export function buildRequest(sub, env = process.env) {
  const f = loadCatalog().families[sub.source];
  if (!f || !f.url) return null;
  const enc = encodeURIComponent;
  let url = f.url.replace('{board}', enc(sub.board || '')).replace('{query}', enc(sub.query || '')).replace('{country}', enc((sub.country || 'us').toLowerCase())).replace('{url}', sub.url || '');
  const headers = { 'user-agent': 'career-profiler/1 (+https://github.com/robertlemmermann/career-profiler)', accept: 'application/json,application/rss+xml,application/atom+xml,text/xml,text/html;q=0.8' };
  if (sub.source === 'adzuna') { if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) return { error: 'ADZUNA_APP_ID and ADZUNA_APP_KEY are not set' }; url = url.replace('{app_id}', enc(env.ADZUNA_APP_ID)).replace('{app_key}', enc(env.ADZUNA_APP_KEY)); }
  if (sub.source === 'usajobs') { if (!env.USAJOBS_API_KEY || !env.USAJOBS_USER_AGENT) return { error: 'USAJOBS_API_KEY and USAJOBS_USER_AGENT are not set' }; headers['Authorization-Key'] = env.USAJOBS_API_KEY; headers['User-Agent'] = env.USAJOBS_USER_AGENT; }
  return { url, headers, redacted_url: url.replace(/app_key=[^&]+/, 'app_key=***').replace(/app_id=[^&]+/, 'app_id=***') };
}

// ---------------------------------------------------------------------------
// Parsers: every family yields [{ external_id, title, company, url, location, text }].

const strip = (h) => (h ? htmlToText(String(h)) : '');
export function parseListings(sub, body) {
  const j = tryJson(body);
  switch (sub.source) {
    case 'greenhouse': return ((j && j.jobs) || []).map((x) => ({ external_id: String(x.id), title: x.title, company: sub.board, url: x.absolute_url, location: x.location && x.location.name, text: [x.title, x.location && x.location.name, strip(x.content)].filter(Boolean).join('\n') }));
    case 'lever': return (Array.isArray(j) ? j : []).map((x) => ({ external_id: x.id, title: x.text, company: sub.board, url: x.hostedUrl, location: x.categories && x.categories.location, text: [x.text, x.categories && [x.categories.team, x.categories.location, x.categories.commitment].filter(Boolean).join(' · '), x.descriptionPlain || strip(x.description), ...(x.lists || []).map((l) => `${l.text}\n${strip(l.content)}`), x.additionalPlain || strip(x.additional)].filter(Boolean).join('\n') }));
    case 'ashby': return ((j && j.jobs) || []).map((x) => ({ external_id: String(x.id), title: x.title, company: sub.board, url: x.jobUrl || x.applyUrl, location: x.location, text: [x.title, x.location, x.descriptionPlain || strip(x.descriptionHtml)].filter(Boolean).join('\n') }));
    case 'smartrecruiters': return ((j && j.content) || []).map((x) => ({ external_id: String(x.id), title: x.name, company: (x.company && x.company.name) || sub.board, url: `https://jobs.smartrecruiters.com/${sub.board}/${x.id}`, location: x.location && [x.location.city, x.location.country].filter(Boolean).join(', '), text: [x.name, x.location && x.location.city, x.department && x.department.label].filter(Boolean).join('\n'), needs_detail: true }));
    case 'workable': return ((j && j.jobs) || []).map((x) => ({ external_id: x.shortcode || String(x.id), title: x.title, company: sub.board, url: x.url || x.shortlink, location: x.city, text: [x.title, x.city, strip(x.description), strip(x.requirements)].filter(Boolean).join('\n') }));
    case 'remotive': return ((j && j.jobs) || []).map((x) => ({ external_id: String(x.id), title: x.title, company: x.company_name, url: x.url, location: x.candidate_required_location, text: [x.title, x.company_name, x.candidate_required_location, strip(x.description)].filter(Boolean).join('\n') }));
    case 'arbeitnow': return ((j && j.data) || []).map((x) => ({ external_id: x.slug, title: x.title, company: x.company_name, url: x.url, location: x.location, text: [x.title, x.company_name, x.location, strip(x.description)].filter(Boolean).join('\n') }));
    case 'usajobs': return (((j && j.SearchResult && j.SearchResult.SearchResultItems) || [])).map((x) => { const d = x.MatchedObjectDescriptor || {}; return { external_id: x.MatchedObjectId, title: d.PositionTitle, company: d.OrganizationName, url: d.PositionURI, location: d.PositionLocationDisplay, text: [d.PositionTitle, d.OrganizationName, d.PositionLocationDisplay, (d.UserArea && d.UserArea.Details && [d.UserArea.Details.JobSummary, d.UserArea.Details.MajorDuties, d.UserArea.Details.Requirements].filter(Boolean).map(strip).join('\n')) || d.QualificationSummary].filter(Boolean).join('\n') }; });
    case 'adzuna': return ((j && j.results) || []).map((x) => ({ external_id: String(x.id), title: x.title, company: x.company && x.company.display_name, url: x.redirect_url, location: x.location && x.location.display_name, text: [x.title, x.company && x.company.display_name, x.location && x.location.display_name, x.description].filter(Boolean).join('\n') }));
    case 'rss': return parseFeed(body);
    default: return [];
  }
}

/** RSS 2.0 and Atom items. */
export function parseFeed(xml) {
  const items = [];
  const tag = (block, name) => { const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i').exec(block); return m ? m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim() : ''; };
  const attr = (block, name, a) => { const m = new RegExp(`<${name}\\b[^>]*\\b${a}="([^"]+)"`, 'i').exec(block); return m ? m[1] : ''; };
  for (const m of String(xml).matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)) {
    const b = m[0];
    const title = strip(tag(b, 'title'));
    const link = tag(b, 'link') || attr(b, 'link', 'href');
    const desc = tag(b, 'content:encoded') || tag(b, 'description') || tag(b, 'content') || tag(b, 'summary');
    const guid = tag(b, 'guid') || tag(b, 'id') || link || title;
    items.push({ external_id: guid, title, company: strip(tag(b, 'dc:creator') || tag(b, 'author')) || null, url: link, location: null, text: [title, strip(desc)].filter(Boolean).join('\n') });
  }
  return items;
}

/** Local sources: a folder of files (email alerts or pasted postings). */
function readFolder(dir, { since }) {
  if (!dir || !isDir(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    const abs = path.join(dir, f);
    if (!/\.(txt|md|html?|eml|json)$/i.test(f) || !fs.statSync(abs).isFile()) continue;
    const raw = fs.readFileSync(abs, 'utf8');
    const text = /\.html?$/i.test(f) || looksLikeHtml(raw) ? htmlToText(raw) : raw.replace(/^(?:[A-Za-z-]+:.*\r?\n)+\r?\n/, '');
    out.push({ external_id: `${f}:${sha256(raw).slice(0, 12)}`, title: (/^subject:\s*(.+)$/im.exec(raw) || [])[1] || f.replace(/\.[^.]+$/, ''), company: null, url: null, location: null, text, file: abs });
  }
  return out;
}

const fingerprint = (sub, l) => sha256(`${sub.source}|${l.external_id || l.url || l.title}`);

/**
 * Poll every (or one) subscription. `fetchImpl(url, init)` is injectable (tests pass fixtures);
 * `fixture` maps a subscription id to a response body. Returns the run report; writes inbox items
 * and, in draft or prepare mode, application folders.
 */
export async function poll(paths, profile, { automation, only = null, fixtures = {}, fetchImpl = globalThis.fetch, dryRun = false, force = false, env = process.env, now = Date.now() } = {}) {
  const subs = readSubs(paths);
  const seen = readSeen(paths);
  const cat = loadCatalog();
  const report = { schema: 'career-watch-run/1', at: nowIso(), automation, subscriptions: [], new_matches: 0, inbox: [], drafted: [], skipped: [], errors: [] };
  const policy = loadPolicy().profiles.notification;
  for (const sub of subs.subscriptions) {
    if (only && sub.id !== only) continue;
    const fam = cat.families[sub.source];
    const row = { id: sub.id, source: sub.source, fetched: 0, new: 0, matched: 0, error: null, request: null };
    const minutes = fam ? fam.rate_limit_minutes : 60;
    if (!force && !fixtures[sub.id] && sub.last_polled_at && now - Date.parse(sub.last_polled_at) < minutes * 60000) { row.error = `polled ${Math.round((now - Date.parse(sub.last_polled_at)) / 60000)} min ago; the catalog allows one poll per ${minutes} min (--force overrides)`; report.subscriptions.push(row); report.skipped.push(sub.id); continue; }
    let listings = [];
    try {
      if (sub.source === 'email') listings = readFolder(path.join(paths.inbox, 'email'), {});
      else if (sub.source === 'file') listings = readFolder(sub.path, {});
      else if (sub.source === 'hn') listings = await hnListings(fetchImpl, fixtures[sub.id]);
      else {
        const req = buildRequest(sub, env);
        if (!req || req.error) throw new Error((req && req.error) || 'no request for this source');
        // The outbound request carries only the subscription's own terms; never profile values.
        const leak = scanText(req.url, { profileName: 'board', profile });
        if (leak.blocks) throw new Error(`refusing to send a request that carries a protected value (${leak.hits.map((h) => h.label).join(', ')})`);
        row.request = req.redacted_url;
        if (dryRun && !fixtures[sub.id]) { report.subscriptions.push(row); continue; }
        const body = fixtures[sub.id] != null ? fixtures[sub.id] : await (async () => { const res = await fetchImpl(req.url, { headers: req.headers, redirect: 'follow' }); if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text(); })();
        listings = parseListings(sub, body);
        if (sub.source === 'smartrecruiters' && !fixtures[sub.id]) for (const l of listings.filter((x) => x.needs_detail).slice(0, 25)) { try { const r = await fetchImpl(`https://api.smartrecruiters.com/v1/companies/${sub.board}/postings/${l.external_id}`, { headers: req.headers }); if (r.ok) { const d = tryJson(await r.text()); if (d) l.text = [l.text, ...Object.values((d.jobAd && d.jobAd.sections) || {}).map((s) => `${s.title || ''}\n${strip(s.text)}`)].join('\n'); } } catch {} }
      }
    } catch (err) { row.error = err.message; report.errors.push({ id: sub.id, error: err.message }); report.subscriptions.push(row); continue; }
    row.fetched = listings.length;
    if (sub.query && ['arbeitnow', 'rss', 'email', 'file', 'hn'].includes(sub.source)) {
      const terms = sub.query.toLowerCase().split(/\s+/).filter(Boolean);
      listings = listings.filter((l) => { const t = `${l.title} ${l.text}`.toLowerCase(); return terms.every((x) => t.includes(x)); });
    }
    for (const l of listings) {
      const fp = fingerprint(sub, l);
      if (seen.fingerprints[fp]) continue;
      row.new += 1;
      const job = parseJob(l.text, { source: l.url || l.file || sub.source, profile });
      if (l.title && (!job.title || job.title.length < 4)) job.title = l.title;
      if (l.company && !job.company) job.company = l.company;
      job.slug = slugify(`${job.company || sub.board || sub.source}-${job.title || 'role'}`);
      job.url = l.url || null;
      const m = matchJob(profile, job);
      const fit = m.fit == null ? 0 : m.fit;
      const matched = fit >= (sub.min_fit ?? 0.6);
      const mode = sub.mode === 'inherit' ? automation : sub.mode;
      const action = !matched ? 'skip' : mode === 'off' ? 'skip' : mode;
      seen.fingerprints[fp] = { sub: sub.id, at: nowIso(), fit, action, title: job.title, company: job.company };
      if (!matched) continue;
      row.matched += 1;
      report.new_matches += 1;
      const item = { id: `I-${nowIso().slice(0, 10)}-${job.slug.slice(0, 40)}-${fp.slice(0, 6)}`, subscription: sub.id, source: sub.source, title: job.title, company: job.company, url: job.url, location: job.location, fit, must_missing: m.coverage.must.missing, gaps: m.gaps.slice(0, 5).map((g) => g.term), action, found_at: nowIso(), acknowledged: false, application: null };
      if (!dryRun) {
        fs.mkdirSync(paths.inbox, { recursive: true, mode: 0o700 });
        if (action === 'draft' || action === 'prepare') {
          const dir = path.join(paths.applications, `${nowIso().slice(0, 10)}-${job.slug}`);
          fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
          writeJsonAtomic(path.join(dir, 'job.json'), job);
          writeJsonAtomic(path.join(dir, 'match.json'), m);
          writeFileAtomic(path.join(dir, 'resume.md'), draftResume(profile, { job, match: m }));
          writeFileAtomic(path.join(dir, 'cover-letter.md'), draftCoverLetter(profile, { job, match: m }));
          writeFileAtomic(path.join(dir, 'posting.txt'), l.text);
          if (action === 'prepare') writeFileAtomic(path.join(dir, 'answers.md'), screeningAnswers(profile, job, m));
          const check = checkResume(fs.readFileSync(path.join(dir, 'resume.md'), 'utf8'), profile, { job, match: m });
          writeJsonAtomic(path.join(dir, 'resume.check.json'), { ...check, document: path.join(dir, 'resume.md'), note: 'skeleton draft from watch; rewrite with the model, then check and finalize' });
          item.application = dir;
          report.drafted.push(dir);
        }
        writeJsonAtomic(path.join(paths.inbox, `${item.id}.json`), item);
      }
      report.inbox.push(item);
    }
    sub.last_polled_at = nowIso();
    sub.last_result = { fetched: row.fetched, new: row.new, matched: row.matched };
    report.subscriptions.push(row);
  }
  if (!dryRun) { writeSubs(paths, subs); writeSeen(paths, seen); }
  // Notifications carry only what the policy allows.
  report.notification = report.inbox.map((i) => Object.fromEntries(policy.fields.map((f) => [f, f === 'job.title' ? i.title : f === 'job.company' ? i.company : f === 'job.url' ? i.url : i.fit])));
  return report;
}

async function hnListings(fetchImpl, fixture) {
  const body = fixture != null ? fixture : await (await fetchImpl('https://hacker-news.firebaseio.com/v0/user/whoishiring.json')).text();
  const u = tryJson(body);
  if (fixture != null && u && Array.isArray(u.comments)) return u.comments.map((c, i) => ({ external_id: String(c.id || i), title: strip(c.text).split('\n')[0].slice(0, 120), company: strip(c.text).split('|')[0].trim().slice(0, 80), url: c.id ? `https://news.ycombinator.com/item?id=${c.id}` : null, location: null, text: strip(c.text) }));
  if (!u || !Array.isArray(u.submitted)) return [];
  for (const id of u.submitted.slice(0, 10)) {
    const s = tryJson(await (await fetchImpl(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)).text());
    if (s && /who is hiring/i.test(s.title || '')) {
      const kids = (s.kids || []).slice(0, 300);
      const out = [];
      for (const k of kids) { const c = tryJson(await (await fetchImpl(`https://hacker-news.firebaseio.com/v0/item/${k}.json`)).text()); if (c && c.text) out.push({ external_id: String(c.id), title: strip(c.text).split('\n')[0].slice(0, 120), company: strip(c.text).split('|')[0].trim().slice(0, 80), url: `https://news.ycombinator.com/item?id=${c.id}`, location: null, text: strip(c.text) }); }
      return out;
    }
  }
  return [];
}

/** Cited screening answers for the questions most forms ask; every answer cites facts or says "ask the user". */
export function screeningAnswers(profile, job, m) {
  const id = profile.identity || {};
  const years = m.years.profile_total;
  const lines = [`# Screening answers (draft) for ${job.title || 'role'} at ${job.company || 'company'}`, '',
    '<!-- Cited drafts for common application-form questions. Nothing here is submitted by the skill; the user pastes what they choose. Restricted facts (work authorization, salary) are never filled in without asking. -->', '',
    `**Years of relevant experience:** ${years} years. <!-- fact: ${(profile.experience || []).map((e) => e.id).join(', ')} -->`, '',
    `**Why this role:** TODO one paragraph in the posting's own terms, cited. <!-- fact: summary -->`, '',
    `**Key qualifications:** ${m.highlights.slice(0, 6).map((h) => `${h.term}`).join(', ')}. <!-- fact: ${uniq(m.highlights.slice(0, 6).flatMap((h) => h.evidence.slice(0, 2))).join(', ')} -->`, '',
    '**Work authorization:** ASK THE USER (restricted field; include only with their yes).', '',
    '**Salary expectations:** ASK THE USER (restricted field).', '',
    `**Location and remote:** ${[id.location && [id.location.city, id.location.region].filter(Boolean).join(', '), id.remote_preference].filter(Boolean).join('; ') || 'ASK THE USER'} <!-- fact: identity -->`, '',
    `**Gaps to answer honestly if asked:** ${m.gaps.slice(0, 5).map((g) => g.term).join(', ') || 'none'}`, ''];
  return lines.join('\n');
}

export function listInbox(paths) {
  if (!isDir(paths.inbox)) return [];
  return fs.readdirSync(paths.inbox).filter((f) => /^I-.*\.json$/.test(f)).sort().reverse().map((f) => tryJson(fs.readFileSync(path.join(paths.inbox, f), 'utf8'))).filter(Boolean);
}
export function ackInbox(paths, id, note) {
  const f = path.join(paths.inbox, `${id}.json`);
  if (!exists(f)) throw usageError(`no inbox item "${id}"`);
  const item = readJson(f);
  item.acknowledged = true; item.acknowledged_at = nowIso(); if (note) item.note = note;
  writeJsonAtomic(f, item, { mode: 0o600 });
  return item;
}

/** Scheduler snippets for this machine; printed, never installed. */
export function scheduleSnippets({ cp, store, every = 6 }) {
  const cmd = `node "${cp}" watch poll --store "${store}" --json`;
  return {
    cron: `0 */${every} * * * ${cmd} >> "${store}/watch/poll.log" 2>&1`,
    launchd: `~/Library/LaunchAgents/com.career-profiler.watch.plist with ProgramArguments [node, ${cp}, watch, poll, --store, ${store}, --json] and StartInterval ${every * 3600}`,
    schtasks: `schtasks /Create /SC HOURLY /MO ${every} /TN career-profiler-watch /TR "node \\"${cp}\\" watch poll --store \\"${store}\\" --json"`,
    github_actions: `# .github/workflows/watch.yml in the private store repository\non:\n  schedule:\n    - cron: '0 */${every} * * *'\n  workflow_dispatch:\njobs:\n  poll:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with: { node-version: 22 }\n      - run: node .claude/skills/career-profiler/scripts/cp.mjs watch poll --store . --json || true\n      - run: git config user.name career-profiler && git config user.email career-profiler@localhost && git add -A && git diff --cached --quiet || git commit -m "watch: poll $(date -u +%FT%TZ)" && git push\n`,
    claude_code_scheduled_task: `A Claude Code cloud scheduled task (hourly at most) on the private store repository with the prompt: "/career-profiler watch run, then rewrite and check any new drafts in applications/ and report the inbox". It needs the job hosts on the environment's network allowlist. Use it for the drafting step; polling alone needs no model.`,
    note: 'Polling needs no model and no credentials beyond the optional API keys. The skill prints these; it never edits your crontab, launchd, Task Scheduler or workflows.',
  };
}

export { truncate };
