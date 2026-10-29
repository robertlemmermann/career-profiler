// Command handlers for cp.mjs. Each returns `{ result, human, exit?, summary? }`. Every data
// command goes through need(), which enforces the automation-preference gate.

import fs from 'node:fs';
import path from 'node:path';
import {
  EXIT, parseOpts, numberOption, usageError, unverifiable, readJson, readInput, readText, tryJson, writeJsonAtomic, writeFileAtomic,
  exists, isDir, nowIso, asciiJson, slugify, JOB_SCHEMA, MATCH_SCHEMA, truncate, plural, AUTOMATION_VALUES, SCRIPTS_DIR,
} from './core.mjs';
import {
  storePaths, storeExists, initStore, loadProfile, saveProfile, verifyChangelog, readChangelog, acceptProfile, verifyManifest,
  addFact, updateFact, removeFact, confirmFact, listFacts, summarize, exportMarkdown, importProfile, syncStore, syncInit, unconfirmedIds,
  stageFacts, readStaged, listStaged, dropStaged, maskProfile,
} from './store.mjs';
import { indexProfile, tierOf, TIERS } from './schema.mjs';
import { ctx, need } from './context.mjs';
import { checkGate, recordGate, probeStore, describeAutomation } from './gate.mjs';
import { coverage, nextQuestions, markAsked } from './interview.mjs';
import { parseJob, fetchPosting } from './job.mjs';
import { matchJob } from './match.mjs';
import { checkResume, draftResume, draftCoverLetter, finalize, layoutFor } from './resume.mjs';
import { scanText, tierForFact, loadPolicy, loadDetectors } from './pii.mjs';
import { doctor } from './doctor.mjs';
import { loadCatalog, addSubscription, removeSubscription, readSubs, poll, listInbox, ackInbox, scheduleSnippets, buildRequest } from './watch.mjs';

const sub = (args) => ({ name: args[0] && !args[0].startsWith('-') ? args[0] : null, rest: args[0] && !args[0].startsWith('-') ? args.slice(1) : args });
function readData(values) {
  if (values.data != null) { const v = tryJson(values.data); if (v === undefined) throw usageError('--data is not valid JSON'); return v; }
  if (values.file) return readJson(values.file);
  throw usageError('give the fact as --data \'{"...": ...}\' or --file <path.json>');
}
const lines = (rows) => rows.map((r) => `${r.id.padEnd(14)} ${r.confirmed ? ' ' : '?'} ${r.tier === 'professional' ? ' ' : r.tier[0].toUpperCase()} ${r.kind.padEnd(14)} ${truncate(r.summary, 100)}`).join('\n');
const parseInclude = (values) => (values.include ? String(values.include).split(',').map((s) => s.trim().replace(/^restricted:/, '')).filter(Boolean) : []);
const safeRead = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };

// ---------------------------------------------------------------------------

async function gateCommand(args) {
  const { name, rest } = sub(args);
  const { values } = parseOpts(rest, { automation: { type: 'string' }, statement: { type: 'string' }, confirm: { type: 'boolean' } });
  const c = ctx(values);
  switch (name) {
    case null: case 'check': {
      const g = checkGate(c.dir, { quarantine: true, probe: true });
      const human = g.state === 'ok' ? `ok: automation ${g.record.automation} (recorded ${g.record.recorded_at}); "${g.record.statement}"`
        : `${g.state}${g.remake_reason ? ` (${g.remake_reason})` : ''}${g.detail ? `: ${g.detail}` : ''}${g.hint ? `\nlast readable statement (a hint only, confirm again): "${g.hint}"` : ''}\n${g.state === 'degraded' ? 'next: doctor --repair, then gate' : `next: ask the user which automation they want (${AUTOMATION_VALUES.join(', ')}), then gate record --automation <value> --statement "<their words>" --confirm`}`;
      return { result: { ok: g.state === 'ok', ...g, options: describeAutomation }, exit: g.state === 'ok' ? EXIT.OK : EXIT.FINDINGS, human };
    }
    case 'record': {
      if (!values.automation || !values.statement) throw usageError('gate record --automation <off|alert|draft|prepare> --statement "<the user\'s words>" --confirm');
      if (values['dry-run']) return { result: { dry_run: true }, human: 'dry run' };
      const r = recordGate(c.dir, { automation: values.automation, statement: values.statement, confirm: !!values.confirm });
      return { result: { recorded: r.record, check: r.check }, human: `recorded: automation ${r.record.automation}; the gate now passes` };
    }
    case 'show': { const g = checkGate(c.dir, { quarantine: false, probe: false }); return { result: g.record || { state: g.state, remake_reason: g.remake_reason }, human: g.record ? asciiJson(g.record) : `${g.state}: ${g.remake_reason || g.detail}` }; }
    case 'options': return { result: { options: describeAutomation, submit: 'never' }, human: Object.entries(describeAutomation).map(([k, v]) => `${k.padEnd(8)} ${v}`).join('\n') + '\nIn every mode the skill never submits an application, never solves a CAPTCHA and never logs in anywhere.' };
    case 'probe': { const p = probeStore(c.paths); return { result: p, exit: p.ok ? EXIT.OK : EXIT.FINDINGS, human: p.ok ? 'write probe ok' : `write probe failed at ${p.failed_step}: ${p.error}` }; }
    default: throw usageError('gate [check] | record | show | options | probe');
  }
}

async function storeCommand(args) {
  const { name, rest } = sub(args);
  const { values, positionals } = parseOpts(rest, { name: { type: 'string' }, force: { type: 'boolean' }, format: { type: 'string' }, out: { type: 'string' }, message: { type: 'string' }, tier: { type: 'string' }, include: { type: 'string' }, remote: { type: 'string' } });
  const c = ctx(values);
  switch (name) {
    case 'init': {
      if (values['dry-run']) return { result: { dry_run: true, store: c.dir }, human: `would create ${c.paths.profile}` };
      const { profile } = initStore(c.dir, { name: values.name, force: values.force });
      return { result: { store: c.dir, profile: c.paths.profile, name: profile.identity.name, next: 'gate record (the automation preference) before anything else' }, human: `created ${c.paths.profile}\nnext: record the automation preference (gate options; gate record ...)`, summary: `store: ${c.dir}` };
    }
    case 'path': return { result: { store: c.dir, resolved_from: c.source, exists: storeExists(c.dir), files: c.paths }, human: `${c.dir} (from ${c.source}${storeExists(c.dir) ? '' : ', not created yet'})` };
    case 'show': {
      const { profile } = need(values);
      const tiers = values.tier ? ['professional', ...values.tier.split(',')] : ['professional'];
      const view = maskProfile(profile, { tiers });
      return { result: view, human: exportMarkdown(view) };
    }
    case 'validate': {
      const { profile, validation } = loadProfile(c.dir, { strict: false });
      const chain = verifyChangelog(c.paths);
      const manifest = verifyManifest(c.paths);
      const gate = checkGate(c.dir, { quarantine: false, probe: false });
      const unc = unconfirmedIds(profile);
      const ok = validation.ok && chain.ok;
      return { result: { ok, validation, changelog: chain, manifest, gate: { state: gate.state, remake_reason: gate.remake_reason }, unconfirmed: unc }, exit: ok ? EXIT.OK : EXIT.FINDINGS,
        human: [`profile: ${validation.ok ? 'valid' : `${plural(validation.errors.length, 'error')}`}`, ...validation.errors.map((e) => `  error ${e.path}: ${e.message}`), ...validation.warnings.map((w) => `  warn  ${w.path}: ${w.message}`),
          `changelog: ${chain.ok ? `${chain.entries} entries, chain intact` : chain.problems.join('; ')}`, `manifest: ${manifest.ok ? 'matches' : manifest.missing_manifest ? 'missing' : `drift ${manifest.drift.join(', ')}`}`, `gate: ${gate.state}${gate.remake_reason ? ` (${gate.remake_reason})` : ''}`, `unconfirmed facts: ${unc.length ? unc.join(', ') : 'none'}`].join('\n') };
    }
    case 'changelog': { const log = readChangelog(c.paths); return { result: { entries: log }, human: log.map((e) => `${e.seq}\t${e.at}\t${e.op}\t${(e.ids || []).join(',')}\t${e.note || ''}`).join('\n') || '(empty)' }; }
    case 'backup': {
      const { profile } = loadProfile(c.dir);
      const r = saveProfile(c.paths, profile, { op: 'backup', note: 'manual backup', dryRun: values['dry-run'] });
      return { result: r, human: `backup written under ${c.paths.backups}` };
    }
    case 'accept': { const e = acceptProfile(c.paths, values.message); return { result: e, human: `accepted current profile.json as seq ${e.seq}` }; }
    case 'export': {
      const { profile } = need(values);
      const include = parseInclude(values);
      const policy = loadPolicy().profiles.export;
      for (const f of include) if (!policy.restricted_on_request.includes(f)) throw usageError(`--include restricted:${f} is not allowed for exports (allowed: ${policy.restricted_on_request.join(', ')})`);
      const view = maskProfile(profile, { tiers: ['professional'], include });
      if (include.length && !values.yes) { /* the conversation must have confirmed; recorded in the changelog below */ }
      const fmt = values.format || 'md';
      const text = fmt === 'json' ? `${asciiJson(view)}\n` : exportMarkdown(view);
      const pii = scanText(text, { profileName: 'export', profile, include });
      if (pii.blocks) throw usageError(`export refused: ${pii.hits.filter((h) => h.severity === 'block').map((h) => h.label).join('; ')}`, { pii });
      if (include.length) saveProfile(c.paths, profile, { op: 'export.include', ids: [], note: `export included restricted: ${include.join(', ')}`, dryRun: values['dry-run'] });
      if (values.out) { writeFileAtomic(values.out, text); return { result: { out: path.resolve(values.out), format: fmt, pii_reviews: pii.reviews, include }, human: `wrote ${values.out}${pii.reviews ? ` (${pii.reviews} items to review: ${pii.hits.map((h) => h.label).join('; ')})` : ''}` }; }
      return { result: { format: fmt, content: text, pii_reviews: pii.reviews, include }, human: text };
    }
    case 'import': {
      const file = positionals[0];
      if (!file) throw usageError('store import <profile.json>');
      if (!storeExists(c.dir)) initStore(c.dir, {});
      const r = importProfile(c.paths, readJson(file), { dryRun: values['dry-run'] });
      return { result: r, human: `imported ${file} into ${c.paths.profile}` };
    }
    case 'sync': {
      if (positionals[0] === 'init') { const r = syncInit(c.dir, { remote: values.remote }); return { result: r, human: `${r.initialized ? 'initialized' : 'already a repository'}${r.remote ? `, origin ${r.remote}` : ''}` }; }
      const r = syncStore(c.dir, { message: values.message, dryRun: values['dry-run'] });
      return { result: r, exit: r.synced || r.dry_run ? EXIT.OK : EXIT.FINDINGS, human: r.synced ? 'synced' : `not synced: ${r.reason || 'dry run'}` };
    }
    default: throw usageError('store init | path | show | validate | changelog | backup | accept | export | import | sync [init --remote url]');
  }
}

function applyTier(entry, values) {
  if (values.tier) { if (!TIERS.includes(values.tier)) throw usageError(`--tier must be one of ${TIERS.join(', ')}`); entry.tier = values.tier; return null; }
  const t = tierForFact(entry);
  if (t) { entry.tier = 'never'; return t; }
  return null;
}

async function factCommand(args) {
  const { name, rest } = sub(args);
  const { values, positionals } = parseOpts(rest, { data: { type: 'string' }, file: { type: 'string' }, parent: { type: 'string' }, source: { type: 'string' }, unconfirmed: { type: 'boolean' }, no: { type: 'boolean' }, confirm: { type: 'boolean' }, quote: { type: 'string' }, tier: { type: 'string' } });
  const c = need(values);
  const save = (op, ids, note) => saveProfile(c.paths, c.profile, { op, ids, note, dryRun: values['dry-run'] });
  const withQuote = (d) => (values.quote ? { ...d, provenance: { ...(d.provenance || {}), quote: values.quote.slice(0, 300) } } : d);
  switch (name) {
    case 'stage': {
      const section = positionals[0];
      if (!section) throw usageError('fact stage <section> --data \'{...}\' [--parent id]');
      const data = readData(values);
      const items = (Array.isArray(data) ? data : [data]).map(withQuote);
      const rec = stageFacts(c.paths, section, items, { parent: values.parent, source: values.source || 'interview' });
      return { result: { staged: rec, next: `show these to the user, then: fact commit ${rec.id} --confirm` }, human: `staged ${rec.id}: ${items.length} ${section} item(s)\n${items.map((i) => `  - ${summarize(section === 'achievement' ? 'achievement' : section, i)}`).join('\n')}\nconfirm with the user, then: fact commit ${rec.id} --confirm` };
    }
    case 'staged': { const list = listStaged(c.paths); return { result: { staged: list }, human: list.map((r) => `${r.id} ${r.kind} x${r.items.length} (${r.staged_at})`).join('\n') || '(nothing staged)' }; }
    case 'commit': {
      const id = positionals[0];
      if (!id) throw usageError('fact commit <T-id> --confirm');
      if (!values.confirm) throw usageError(`fact commit needs --confirm: show the staged facts to the user and get a yes first (--yes does not count)`);
      const rec = readStaged(c.paths, id);
      const added = []; const tiers = [];
      for (const item of rec.items) { const t = applyTier(item, values); const e = addFact(c.profile, rec.kind, item, { parent: rec.parent, source: rec.source, confirmed: true }); added.push(e); if (t) tiers.push({ id: e.id, ...t }); }
      const r = save('add', added.map((a) => a.id), `committed ${id}`);
      if (!values['dry-run']) dropStaged(c.paths, id);
      return { result: { added, never_tier: tiers, write: r }, human: added.map((a) => `added ${a.id}`).join('\n') + (tiers.length ? `\nnote: ${tiers.map((t) => `${t.id} holds ${t.label} and was stored at tier never (never exported)`).join('; ')}` : '') };
    }
    case 'add': {
      const section = positionals[0];
      if (!section) throw usageError('fact add <section> --data \'{...}\' --confirm | --unconfirmed [--parent id]');
      if (!values.confirm && !values.unconfirmed) throw usageError('fact add needs --confirm (the user confirmed these facts in conversation) or --unconfirmed (extracted from a document, to be confirmed later); --yes does not count');
      const data = readData(values);
      const items = (Array.isArray(data) ? data : [data]).map(withQuote);
      const tiers = [];
      const added = items.map((d) => { const t = applyTier(d, values); const e = addFact(c.profile, section, d, { parent: values.parent, source: values.source || (values.unconfirmed ? 'document' : 'interview'), confirmed: values.unconfirmed ? false : true }); if (t) tiers.push({ id: e.id, ...t }); return e; });
      const r = save('add', added.map((a) => a.id));
      return { result: { added, never_tier: tiers, write: r }, human: added.map((a) => `added ${a.id}: ${summarize((indexProfile(c.profile).get(a.id) || {}).kind || section, a)}`).join('\n') + (tiers.length ? `\nnote: ${tiers.map((t) => `${t.id} holds ${t.label} and was stored at tier never (never exported)`).join('; ')}` : ''), summary: `${plural(added.length, 'fact')} added` };
    }
    case 'update': {
      const id = positionals[0];
      if (!id) throw usageError('fact update <id> --data \'{...}\'');
      const e = updateFact(c.profile, id, withQuote(readData(values)), { source: values.source, confirmed: values.unconfirmed ? false : undefined });
      if (values.tier) { if (!TIERS.includes(values.tier)) throw usageError(`--tier must be one of ${TIERS.join(', ')}`); e.tier = values.tier; }
      const r = save('update', [id]);
      return { result: { updated: e, write: r }, human: `updated ${id}` };
    }
    case 'remove': {
      const id = positionals[0];
      if (!id) throw usageError('fact remove <id>');
      const e = removeFact(c.profile, id);
      const r = save('remove', [id]);
      return { result: { removed: e, write: r }, human: `removed ${id}` };
    }
    case 'confirm': {
      const ids = positionals;
      if (!ids.length) throw usageError('fact confirm <id>... [--no]');
      const out = ids.map((id) => confirmFact(c.profile, id, !values.no));
      const r = save('confirm', ids, values.no ? 'unconfirmed' : 'confirmed');
      return { result: { facts: out, write: r }, human: `${values.no ? 'unconfirmed' : 'confirmed'} ${ids.join(', ')}` };
    }
    case 'list': {
      const rows = listFacts(c.profile, positionals[0]).map((r) => ({ ...r, tier: tierOf(indexProfile(c.profile).get(r.id).entry) }));
      return { result: { facts: rows, unconfirmed: unconfirmedIds(c.profile) }, human: rows.length ? lines(rows) : '(no facts yet)' };
    }
    case 'get': {
      const hit = indexProfile(c.profile).get(positionals[0]);
      if (!hit) throw usageError(`no fact with id "${positionals[0]}"`);
      return { result: { id: positionals[0], kind: hit.kind, parent: hit.parent ? hit.parent.id : null, tier: tierOf(hit.entry), fact: hit.entry }, human: asciiJson(hit.entry) };
    }
    default: throw usageError('fact stage | staged | commit | add | update | remove | confirm | list | get');
  }
}

async function interviewCommand(args) {
  const { name, rest } = sub(args);
  const { values, positionals } = parseOpts(rest, { max: { type: 'string' }, focus: { type: 'string' } });
  const c = need(values);
  switch (name) {
    case 'coverage': {
      const cov = coverage(c.profile);
      return { result: cov, human: [`coverage ${cov.score}/100 (${cov.resume_ready ? 'resume-ready' : 'keep interviewing'}); domains: ${cov.domains.join(', ')}`,
        ...cov.sections.map((s) => `  ${s.section.padEnd(11)} ${Math.round(s.score * 100)}%`), `gaps: ${cov.gaps.length}`, ...cov.gaps.slice(0, 12).map((g) => `  [${g.priority}] ${g.key}: ${g.question}`)].join('\n') };
    }
    case 'next': {
      const r = nextQuestions(c.profile, { max: numberOption(values, 'max', 3, { integer: true }), focus: values.focus });
      r.never_asked = loadDetectors().never_asked;
      return { result: r, human: r.questions.length ? r.questions.map((q, i) => `${i + 1}. (${q.key}) ${q.question}${q.probes.length ? `\n   probes: ${q.probes.slice(0, 3).join(' | ')}` : ''}`).join('\n') : `nothing left to ask (coverage ${r.score}/100)` };
    }
    case 'done': {
      if (!positionals.length) throw usageError('interview done <key>...');
      const asked = markAsked(c.profile, positionals);
      saveProfile(c.paths, c.profile, { op: 'interview', ids: [], note: `asked: ${positionals.join(', ')}`, dryRun: values['dry-run'] });
      return { result: { asked }, human: `recorded ${positionals.join(', ')}` };
    }
    default: throw usageError('interview coverage | next | done');
  }
}

function readJob(file) { const j = readJson(file); if (!j || j.schema !== JOB_SCHEMA) throw usageError(`${file} is not a ${JOB_SCHEMA} document (run "job parse" first)`); return j; }
function readMatch(file) { const m = readJson(file); if (!m || m.schema !== MATCH_SCHEMA) throw usageError(`${file} is not a ${MATCH_SCHEMA} document (run "match" first)`); return m; }
function jobHuman(j) {
  return [`${j.title || '(no title)'} at ${j.company || '(no company)'}${j.seniority ? ` [${j.seniority}]` : ''}${j.remote ? ` ${j.remote}` : ''}${j.years_required != null ? `, ${j.years_required}+ years` : ''}`,
    `must-have keywords: ${j.keywords.filter((k) => k.kind === 'must').map((k) => k.term).join(', ') || 'none recognised'}`,
    `nice-to-have keywords: ${j.keywords.filter((k) => k.kind === 'nice').map((k) => k.term).join(', ') || 'none'}`,
    `requirement lines: ${j.counts.must} must, ${j.counts.nice} nice, ${j.counts.responsibility} responsibilities`,
    ...j.warnings.map((w) => `warning: ${w}`)].join('\n');
}

async function jobCommand(args) {
  const { name, rest } = sub(args);
  const { values, positionals } = parseOpts(rest, { title: { type: 'string' }, company: { type: 'string' }, out: { type: 'string' } });
  if (name !== 'parse' && name !== 'show') throw usageError('job parse <file|url|-> [--title T] [--company C] [--out job.json]');
  const spec = positionals[0];
  if (!spec) throw usageError('job parse needs a file path, a URL or - for stdin');
  if (name === 'show') { const j = readJob(spec); return { result: j, human: jobHuman(j) }; }
  const c = need(values);
  const profile = c.profile;
  let text; let source;
  if (/^https?:\/\//i.test(spec)) { text = await fetchPosting(spec); source = spec; } else { const r = readInput(spec, { allowText: spec.length > 200 }); text = r.text; source = r.source; }
  if (!text || text.trim().length < 40) throw unverifiable('EMPTY_POSTING', 'the posting text is empty or too short; paste the full job description');
  const job = parseJob(text, { source, profile });
  if (values.title) { job.title = values.title; job.warnings = job.warnings.filter((w) => !w.startsWith('no title')); }
  if (values.company) { job.company = values.company; job.warnings = job.warnings.filter((w) => !w.startsWith('no company')); }
  job.slug = slugify(`${job.company || 'company'}-${job.title || 'role'}`);
  if (values.out && !values['dry-run']) writeJsonAtomic(values.out, job);
  return { result: job, human: jobHuman(job) + (values.out ? `\nwrote ${values.out}` : ''), summary: `${job.counts.must} must, ${job.counts.nice} nice, ${job.keywords.length} keywords` };
}

async function matchCommand(args) {
  const { values, positionals } = parseOpts(args, { out: { type: 'string' } });
  const file = positionals[0];
  if (!file) throw usageError('match <job.json> [--out match.json]');
  const c = need(values);
  const job = readJob(file);
  const m = matchJob(c.profile, job);
  if (values.out && !values['dry-run']) writeJsonAtomic(values.out, m);
  const human = [`fit ${m.fit == null ? 'n/a' : Math.round(m.fit * 100)}% for ${job.title || 'role'} at ${job.company || 'company'}`,
    `must: ${m.coverage.must.strong} strong, ${m.coverage.must.partial} partial, ${m.coverage.must.missing} missing of ${m.coverage.must.total}`,
    `nice: ${m.coverage.nice.strong} strong, ${m.coverage.nice.partial} partial, ${m.coverage.nice.missing} missing of ${m.coverage.nice.total}`,
    `years: ${m.years.profile_total} in profile, ${m.years.required == null ? 'no requirement stated' : `${m.years.required}+ required (${m.years.verdict})`}; seniority: ${m.seniority.profile || '?'} vs ${m.seniority.job || '?'} (${m.seniority.verdict})`,
    ...(m.gaps.length ? [`ask the user (at most ${m.max_questions}, must-haves first):`, ...m.gaps.filter((g) => g.ask_now).map((g) => `  - ${g.term} (${g.kind}${g.status === 'expired' ? ', expired' : ''})`)] : ['no missing keywords']),
    ...(m.declined.length ? [`declined earlier (not asked again): ${m.declined.join(', ')}`] : []),
    ...(values.out ? [`wrote ${values.out}`] : [])].join('\n');
  return { result: m, human, exit: m.gaps.some((g) => g.kind === 'must') ? EXIT.FINDINGS : EXIT.OK, summary: `fit ${m.fit}` };
}

async function appCommand(args) {
  const { name, rest } = sub(args);
  const { values, positionals } = parseOpts(rest, { layout: { type: 'string' } });
  const c = need(values);
  if (name === 'list') {
    let dirs = [];
    try { dirs = fs.readdirSync(c.paths.applications).filter((d) => isDir(path.join(c.paths.applications, d))).sort().reverse(); } catch {}
    const apps = dirs.map((d) => { const j = tryJson(safeRead(path.join(c.paths.applications, d, 'job.json'))) || {}; return { dir: path.join(c.paths.applications, d), title: j.title, company: j.company, files: fs.readdirSync(path.join(c.paths.applications, d)) }; });
    return { result: { applications: apps }, human: apps.map((a) => `${a.dir}\n  ${a.title || '?'} at ${a.company || '?'}: ${a.files.join(', ')}`).join('\n') || '(no applications yet)' };
  }
  if (name !== 'new') throw usageError('app new <job.json> | app list');
  const job = readJob(positionals[0] || '');
  const dir = path.join(c.paths.applications, `${nowIso().slice(0, 10)}-${job.slug}`);
  const m = matchJob(c.profile, job);
  if (values['dry-run']) return { result: { dry_run: true, dir }, human: `would create ${dir}` };
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeJsonAtomic(path.join(dir, 'job.json'), job);
  writeJsonAtomic(path.join(dir, 'match.json'), m);
  const layout = values.layout || layoutFor(c.profile, job);
  writeFileAtomic(path.join(dir, 'resume.md'), draftResume(c.profile, { job, match: m, layout }));
  writeFileAtomic(path.join(dir, 'cover-letter.md'), draftCoverLetter(c.profile, { job, match: m }));
  return { result: { dir, files: ['job.json', 'match.json', 'resume.md', 'cover-letter.md'], layout, fit: m.fit, gaps: m.gaps.filter((g) => g.ask_now) }, human: `created ${dir}\n  job.json, match.json, resume.md (draft, ${layout} layout), cover-letter.md (draft); fit ${m.fit == null ? 'n/a' : Math.round(m.fit * 100)}%, ${plural(m.gaps.filter((g) => g.ask_now).length, 'gap')} to ask about` };
}

function docCommand(kind) {
  return async (args) => {
    const { name, rest } = sub(args);
    const { values, positionals } = parseOpts(rest, { job: { type: 'string' }, match: { type: 'string' }, out: { type: 'string' }, report: { type: 'string' }, formats: { type: 'string' }, title: { type: 'string' }, include: { type: 'string' }, layout: { type: 'string' } });
    const c = need(values);
    const job = values.job ? readJob(values.job) : null;
    const match = values.match ? readMatch(values.match) : (job ? matchJob(c.profile, job) : null);
    const include = parseInclude(values);
    const policy = loadPolicy().profiles[kind === 'resume' ? 'resume' : 'cover'];
    for (const f of include) if (!policy.restricted_on_request.includes(f)) throw usageError(`--include restricted:${f} is not allowed for a ${kind} (allowed: ${policy.restricted_on_request.join(', ')})`);
    switch (name) {
      case 'draft': {
        const text = kind === 'resume' ? draftResume(c.profile, { job, match, layout: values.layout }) : draftCoverLetter(c.profile, { job, match });
        const out = values.out || (kind === 'resume' ? 'resume.md' : 'cover-letter.md');
        if (!values['dry-run']) writeFileAtomic(path.resolve(c.cwd, out), text);
        return { result: { out: path.resolve(c.cwd, out), content: text }, human: `wrote ${out}\n\n${text}` };
      }
      case 'check': {
        const file = positionals[0];
        if (!file) throw usageError(`${kind} check <file.md> [--job job.json] [--match match.json] [--report report.json] [--include restricted:<field>]`);
        const text = readText(path.resolve(c.cwd, file));
        const report = checkResume(text, c.profile, { job, match, kind, include });
        report.document = path.resolve(c.cwd, file);
        const reportPath = values.report || path.resolve(c.cwd, file).replace(/\.md$/i, '') + '.check.json';
        if (!values['dry-run']) writeJsonAtomic(reportPath, report);
        const human = [`${report.verdict}: ${report.counts.fail} fail, ${report.counts.finding} findings; ${report.counts.words} words, ${report.counts.cited_facts} facts cited${report.counts.pii_blocks ? `, ${report.counts.pii_blocks} PII blocks` : ''}`,
          ...report.findings.map((f) => `  ${f.severity === 'fail' ? 'FAIL' : 'note'} ${f.line != null ? `L${f.line} ` : ''}${f.code}: ${f.message}`),
          ...(report.coverage ? [`keyword coverage: must ${report.coverage.must.used}/${report.coverage.must.supported} supported used (${report.coverage.must.total} in posting); nice ${report.coverage.nice.used}/${report.coverage.nice.supported} (${report.coverage.nice.total})`] : []),
          `report: ${reportPath}`].join('\n');
        return { result: report, human, exit: report.verdict === 'FAIL' ? EXIT.FINDINGS : EXIT.OK, summary: report.verdict };
      }
      case 'finalize': {
        const file = positionals[0];
        if (!file) throw usageError(`${kind} finalize <file.md> [--formats md,txt,html,json,docx] [--include restricted:<field>]`);
        const abs = path.resolve(c.cwd, file);
        const text = readText(abs);
        const report = checkResume(text, c.profile, { job, match, kind, include });
        if (report.verdict === 'FAIL') throw usageError(`${file} fails the check (${report.counts.fail} fail); fix it and run "${kind} check" first`, { findings: report.findings });
        const formats = (values.formats || 'md,txt,html').split(',').map((s) => s.trim()).filter(Boolean);
        if (values['dry-run']) return { result: { dry_run: true, formats }, human: 'dry run' };
        const r = finalize(abs, { formats, title: values.title, profile: c.profile, include });
        writeJsonAtomic(abs.replace(/\.md$/i, '') + '.check.json', { ...report, document: abs, finalized: r.files });
        if (include.length) saveProfile(c.paths, c.profile, { op: 'finalize.include', ids: [], note: `${kind} ${path.basename(abs)} included restricted: ${include.join(', ')}` });
        return { result: { ...r, verdict: report.verdict, findings: report.findings, include }, human: [`${report.verdict}; wrote:`, ...r.files.map((f) => `  ${f}`), ...(r.docx ? [`  docx: ${r.docx}`] : [])].join('\n') };
      }
      default: throw usageError(`${kind} draft | check | finalize`);
    }
  };
}

async function piiCommand(args) {
  const { name, rest } = sub(args);
  const { values, positionals } = parseOpts(rest, { profile: { type: 'string' }, include: { type: 'string' } });
  if (name === 'policy') { return { result: { policy: loadPolicy(), never_asked: loadDetectors().never_asked }, human: asciiJson(loadPolicy()) }; }
  if (name !== 'scan') throw usageError('pii scan <file|-> [--profile resume|cover|answers|export|board|log] | pii policy');
  const spec = positionals[0];
  if (!spec) throw usageError('pii scan <file|->');
  const { text } = readInput(spec);
  const c = ctx(values);
  let profile = null;
  if (storeExists(c.dir)) { try { profile = loadProfile(c.dir).profile; } catch {} }
  const r = scanText(text, { profileName: values.profile || 'resume', profile, include: parseInclude(values) });
  return { result: r, exit: r.blocks ? EXIT.FINDINGS : EXIT.OK, human: r.hits.length ? r.hits.map((h) => `${h.severity.padEnd(6)} ${h.line != null ? `L${h.line} ` : ''}${h.label}${h.sample ? ` (${h.sample})` : ''}`).join('\n') : 'no personal data found beyond the chosen contact details' };
}

async function watchCommand(args) {
  const { name, rest } = sub(args);
  const { values, positionals } = parseOpts(rest, { source: { type: 'string' }, board: { type: 'string' }, url: { type: 'string' }, query: { type: 'string' }, country: { type: 'string' }, path: { type: 'string' }, mode: { type: 'string' }, 'min-fit': { type: 'string' }, fixture: { type: 'string' }, only: { type: 'string' }, force: { type: 'boolean' }, ack: { type: 'string' }, note: { type: 'string' }, every: { type: 'string' }, show: { type: 'boolean' } });
  if (name === 'sources') { const cat = loadCatalog(); return { result: cat, human: [...Object.entries(cat.families).map(([k, f]) => `${k.padEnd(16)} ${f.needs_key ? 'key ' : '    '} ${f.terms}`), '', ...Object.entries(cat.refused).map(([k, r]) => `${k.padEnd(16)} REFUSED: ${r.reason}. ${r.alternative}`)].join('\n') }; }
  const c = need(values);
  const automation = c.gate.record.automation;
  switch (name) {
    case 'add': {
      if (automation === 'off') throw usageError('your automation preference is "off"; change it with gate record before subscribing to a source');
      const s = addSubscription(c.paths, { source: values.source, board: values.board, url: values.url, query: values.query, country: values.country, filePath: values.path, mode: values.mode || 'inherit', minFit: numberOption(values, 'min-fit', 0.6) });
      const req = buildRequest(s);
      return { result: { subscription: s, request: req && !req.error ? req.redacted_url : null, key_missing: req && req.error ? req.error : null }, human: `added ${s.id}: ${s.source}${s.board ? ` ${s.board}` : ''}${s.query ? ` "${s.query}"` : ''} (mode ${s.mode}, min fit ${s.min_fit})${req && req.error ? `\nnote: ${req.error}` : ''}` };
    }
    case 'list': { const subs = readSubs(c.paths).subscriptions; return { result: { automation, subscriptions: subs }, human: subs.length ? subs.map((s) => `${s.id} ${s.source}${s.board ? ` ${s.board}` : ''}${s.query ? ` "${s.query}"` : ''} mode ${s.mode === 'inherit' ? `${automation} (inherited)` : s.mode}; last poll ${s.last_polled_at || 'never'}${s.last_result ? ` (${s.last_result.new} new, ${s.last_result.matched} matched)` : ''}`).join('\n') : '(no subscriptions)' }; }
    case 'remove': { if (!positionals[0]) throw usageError('watch remove <S-id>'); removeSubscription(c.paths, positionals[0]); return { result: { removed: positionals[0] }, human: `removed ${positionals[0]}` }; }
    case 'poll': case 'run': {
      if (automation === 'off') throw usageError('your automation preference is "off"; nothing is polled');
      const fixtures = values.fixture ? readJson(values.fixture) : {};
      const r = await poll(c.paths, c.profile, { automation, only: values.only, fixtures, dryRun: !!values['dry-run'], force: !!values.force });
      const human = [`${r.new_matches} new match(es); ${r.drafted.length} drafted; ${r.errors.length} error(s)`,
        ...r.subscriptions.map((s) => `  ${s.id} ${s.source}: ${s.error ? `error: ${s.error}` : `${s.fetched} fetched, ${s.new} new, ${s.matched} matched`}${s.request ? ` [${s.request}]` : ''}`),
        ...r.inbox.map((i) => `  inbox ${i.id}: ${i.title} at ${i.company || '?'} fit ${Math.round(i.fit * 100)}% -> ${i.action}${i.application ? ` (${i.application})` : ''}`)].join('\n');
      return { result: r, exit: r.new_matches ? EXIT.FINDINGS : EXIT.OK, human };
    }
    case 'inbox': {
      if (values.ack) { const it = ackInbox(c.paths, values.ack, values.note); return { result: { acknowledged: it }, human: `acknowledged ${it.id}` }; }
      const items = listInbox(c.paths);
      return { result: { items }, human: items.length ? items.map((i) => `${i.acknowledged ? '  ' : '* '}${i.id}: ${i.title} at ${i.company || '?'} (${Math.round(i.fit * 100)}%, ${i.action})${i.url ? ` ${i.url}` : ''}${i.application ? `\n    drafts: ${i.application}` : ''}`).join('\n') : '(inbox empty)' };
    }
    case 'schedule': { const s = scheduleSnippets({ cp: path.join(SCRIPTS_DIR, 'cp.mjs'), store: c.dir, every: numberOption(values, 'every', 6, { integer: true }) }); return { result: s, human: Object.entries(s).map(([k, v]) => `${k}:\n${v}\n`).join('\n') }; }
    default: throw usageError('watch sources | add | list | remove | poll | run | inbox [--ack id] | schedule --show');
  }
}

async function doctorCommand(args) {
  const { values } = parseOpts(args, { repair: { type: 'boolean' } });
  const r = doctor({ store: values.store, cwd: values.cwd ? path.resolve(values.cwd) : process.cwd(), repair: !!values.repair });
  return { result: r, exit: r.ok ? EXIT.OK : EXIT.FINDINGS, human: r.items.map((i) => `${i.status.padEnd(8)} ${i.name.padEnd(18)} ${i.detail}`).join('\n') + (r.repairs.length ? `\nrepairs: ${r.repairs.join('; ')}` : '') };
}

export const commands = {
  gate: gateCommand,
  store: storeCommand,
  fact: factCommand,
  interview: interviewCommand,
  job: jobCommand,
  match: matchCommand,
  app: appCommand,
  resume: docCommand('resume'),
  'cover-letter': docCommand('cover-letter'),
  pii: piiCommand,
  watch: watchCommand,
  doctor: doctorCommand,
};
