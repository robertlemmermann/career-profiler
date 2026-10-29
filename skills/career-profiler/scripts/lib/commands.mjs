// Command handlers for cp.mjs. Each returns `{ result, human, exit?, summary? }`.

import fs from 'node:fs';
import path from 'node:path';
import {
  EXIT, parseOpts, numberOption, usageError, unverifiable, readJson, readInput, readText, tryJson, writeJsonAtomic, writeFileAtomic,
  exists, isDir, nowIso, asciiJson, slugify, JOB_SCHEMA, MATCH_SCHEMA, truncate, plural,
} from './core.mjs';
import {
  resolveStore, storePaths, storeExists, initStore, loadProfile, saveProfile, verifyChangelog, readChangelog, acceptProfile,
  addFact, updateFact, removeFact, confirmFact, listFacts, summarize, exportMarkdown, importProfile, syncStore, unconfirmedIds,
} from './store.mjs';
import { indexProfile } from './schema.mjs';
import { coverage, nextQuestions, markAsked } from './interview.mjs';
import { parseJob, fetchPosting } from './job.mjs';
import { matchJob } from './match.mjs';
import { checkResume, draftResume, draftCoverLetter, finalize } from './resume.mjs';
import { doctor } from './doctor.mjs';

const sub = (args) => ({ name: args[0] && !args[0].startsWith('-') ? args[0] : null, rest: args[0] && !args[0].startsWith('-') ? args.slice(1) : args });
const ctx = (values) => {
  const cwd = values.cwd ? path.resolve(values.cwd) : process.cwd();
  const { dir, source } = resolveStore({ store: values.store, cwd });
  return { cwd, dir, source, paths: storePaths(dir) };
};
const need = (values) => { const c = ctx(values); const { profile } = loadProfile(c.dir); return { ...c, profile }; };
const jsonArg = (values) => {
  if (values.json && typeof values.json === 'string') return values.json;
  return null;
};
/** `--data '<json>'` or `--file <path>` (the global --json flag is boolean, so data uses --data). */
function readData(values) {
  if (values.data != null) { const v = tryJson(values.data); if (v === undefined) throw usageError('--data is not valid JSON'); return v; }
  if (values.file) return readJson(values.file);
  throw usageError('give the fact as --data \'{"...": ...}\' or --file <path.json>');
}
const lines = (rows) => rows.map((r) => `${r.id.padEnd(14)} ${r.confirmed ? ' ' : '?'} ${r.kind.padEnd(14)} ${truncate(r.summary, 100)}`).join('\n');

// ---------------------------------------------------------------------------

async function storeCommand(args) {
  const { name, rest } = sub(args);
  const { values, positionals } = parseOpts(rest, { name: { type: 'string' }, force: { type: 'boolean' }, format: { type: 'string' }, out: { type: 'string' }, message: { type: 'string' } });
  const c = ctx(values);
  switch (name) {
    case 'init': {
      if (values['dry-run']) return { result: { dry_run: true, store: c.dir }, human: `would create ${c.paths.profile}` };
      const { profile } = initStore(c.dir, { name: values.name, force: values.force });
      return { result: { store: c.dir, profile: c.paths.profile, name: profile.identity.name }, human: `created ${c.paths.profile}`, summary: `store: ${c.dir}` };
    }
    case 'path': return { result: { store: c.dir, resolved_from: c.source, exists: storeExists(c.dir), files: c.paths }, human: `${c.dir} (from ${c.source}${storeExists(c.dir) ? '' : ', not created yet'})` };
    case 'show': {
      const { profile } = loadProfile(c.dir);
      return { result: profile, human: exportMarkdown(profile) };
    }
    case 'validate': {
      const { profile, validation } = loadProfile(c.dir, { strict: false });
      const chain = verifyChangelog(c.paths);
      const unc = unconfirmedIds(profile);
      const ok = validation.ok && chain.ok;
      return { result: { ok, validation, changelog: chain, unconfirmed: unc }, exit: ok ? EXIT.OK : EXIT.FINDINGS,
        human: [`profile: ${validation.ok ? 'valid' : `${plural(validation.errors.length, 'error')}`}`, ...validation.errors.map((e) => `  error ${e.path}: ${e.message}`), ...validation.warnings.map((w) => `  warn  ${w.path}: ${w.message}`),
          `changelog: ${chain.ok ? `${chain.entries} entries, chain intact` : chain.problems.join('; ')}`, `unconfirmed facts: ${unc.length ? unc.join(', ') : 'none'}`].join('\n') };
    }
    case 'changelog': { const log = readChangelog(c.paths); return { result: { entries: log }, human: log.map((e) => `${e.seq}\t${e.at}\t${e.op}\t${(e.ids || []).join(',')}\t${e.note || ''}`).join('\n') || '(empty)' }; }
    case 'backup': {
      const { profile } = loadProfile(c.dir);
      const r = saveProfile(c.paths, profile, { op: 'backup', note: 'manual backup', dryRun: values['dry-run'] });
      return { result: r, human: `backup written under ${c.paths.backups}` };
    }
    case 'accept': { const e = acceptProfile(c.paths, values.message); return { result: e, human: `accepted current profile.json as seq ${e.seq}` }; }
    case 'export': {
      const { profile } = loadProfile(c.dir);
      const fmt = values.format || 'md';
      const text = fmt === 'json' ? `${asciiJson(profile)}\n` : exportMarkdown(profile);
      if (values.out) { writeFileAtomic(values.out, text); return { result: { out: path.resolve(values.out), format: fmt }, human: `wrote ${values.out}` }; }
      return { result: { format: fmt, content: text }, human: text };
    }
    case 'import': {
      const file = positionals[0];
      if (!file) throw usageError('store import <profile.json>');
      if (!storeExists(c.dir)) initStore(c.dir, {});
      const r = importProfile(c.paths, readJson(file), { dryRun: values['dry-run'] });
      return { result: r, human: `imported ${file} into ${c.paths.profile}` };
    }
    case 'sync': {
      const r = syncStore(c.dir, { message: values.message, dryRun: values['dry-run'] });
      return { result: r, exit: r.synced || r.dry_run ? EXIT.OK : EXIT.FINDINGS, human: r.synced ? 'synced' : `not synced: ${r.reason || 'dry run'}` };
    }
    default: throw usageError('store init | path | show | validate | changelog | backup | accept | export | import | sync');
  }
}

async function factCommand(args) {
  const { name, rest } = sub(args);
  const { values, positionals } = parseOpts(rest, { data: { type: 'string' }, file: { type: 'string' }, parent: { type: 'string' }, source: { type: 'string' }, unconfirmed: { type: 'boolean' }, no: { type: 'boolean' } });
  const c = need(values);
  const save = (op, ids, note) => saveProfile(c.paths, c.profile, { op, ids, note, dryRun: values['dry-run'] });
  switch (name) {
    case 'add': {
      const section = positionals[0];
      if (!section) throw usageError('fact add <section> --data \'{...}\' [--parent id]');
      const data = readData(values);
      const items = Array.isArray(data) ? data : [data];
      const added = items.map((d) => addFact(c.profile, section, d, { parent: values.parent, source: values.source || 'interview', confirmed: values.unconfirmed ? false : undefined }));
      const r = save('add', added.map((a) => a.id));
      return { result: { added, write: r }, human: added.map((a) => `added ${a.id}: ${summarize(section === 'achievement' || section === 'achievements' ? 'achievement' : (indexProfile(c.profile).get(a.id) || {}).kind || section, a)}`).join('\n'), summary: `${plural(added.length, 'fact')} added` };
    }
    case 'update': {
      const id = positionals[0];
      if (!id) throw usageError('fact update <id> --data \'{...}\'');
      const e = updateFact(c.profile, id, readData(values), { source: values.source, confirmed: values.unconfirmed ? false : undefined });
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
      const rows = listFacts(c.profile, positionals[0]);
      return { result: { facts: rows, unconfirmed: unconfirmedIds(c.profile) }, human: rows.length ? lines(rows) : '(no facts yet)' };
    }
    case 'get': {
      const hit = indexProfile(c.profile).get(positionals[0]);
      if (!hit) throw usageError(`no fact with id "${positionals[0]}"`);
      return { result: { id: positionals[0], kind: hit.kind, parent: hit.parent ? hit.parent.id : null, fact: hit.entry }, human: asciiJson(hit.entry) };
    }
    default: throw usageError('fact add | update | remove | confirm | list | get');
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

async function jobCommand(args) {
  const { name, rest } = sub(args);
  const { values, positionals } = parseOpts(rest, { title: { type: 'string' }, company: { type: 'string' }, out: { type: 'string' } });
  if (name !== 'parse' && name !== 'show') throw usageError('job parse <file|url|-> [--title T] [--company C] [--out job.json]');
  const spec = positionals[0];
  if (!spec) throw usageError('job parse needs a file path, a URL or - for stdin');
  if (name === 'show') { const j = readJob(spec); return { result: j, human: jobHuman(j) }; }
  const c = ctx(values);
  const profile = storeExists(c.dir) ? loadProfile(c.dir, { strict: false }).profile : null;
  let text;
  let source;
  if (/^https?:\/\//i.test(spec)) { text = await fetchPosting(spec); source = spec; } else { const r = readInput(spec, { allowText: spec.length > 200 }); text = r.text; source = r.source; }
  if (!text || text.trim().length < 40) throw unverifiable('EMPTY_POSTING', 'the posting text is empty or too short; paste the full job description');
  const job = parseJob(text, { source, profile });
  if (values.title) { job.title = values.title; job.warnings = job.warnings.filter((w) => !w.startsWith('no title')); }
  if (values.company) { job.company = values.company; job.warnings = job.warnings.filter((w) => !w.startsWith('no company')); }
  job.slug = slugify(`${job.company || 'company'}-${job.title || 'role'}`);
  if (values.out && !values['dry-run']) writeJsonAtomic(values.out, job);
  return { result: job, human: jobHuman(job) + (values.out ? `\nwrote ${values.out}` : ''), summary: `${job.counts.must} must, ${job.counts.nice} nice, ${job.keywords.length} keywords` };
}

function readJob(file) {
  const j = readJson(file);
  if (!j || j.schema !== JOB_SCHEMA) throw usageError(`${file} is not a ${JOB_SCHEMA} document (run "job parse" first)`);
  return j;
}
function readMatch(file) {
  const m = readJson(file);
  if (!m || m.schema !== MATCH_SCHEMA) throw usageError(`${file} is not a ${MATCH_SCHEMA} document (run "match" first)`);
  return m;
}
function jobHuman(j) {
  return [`${j.title || '(no title)'} at ${j.company || '(no company)'}${j.seniority ? ` [${j.seniority}]` : ''}${j.remote ? ` ${j.remote}` : ''}${j.years_required != null ? `, ${j.years_required}+ years` : ''}`,
    `must-have keywords: ${j.keywords.filter((k) => k.kind === 'must').map((k) => k.term).join(', ') || 'none recognised'}`,
    `nice-to-have keywords: ${j.keywords.filter((k) => k.kind === 'nice').map((k) => k.term).join(', ') || 'none'}`,
    `requirement lines: ${j.counts.must} must, ${j.counts.nice} nice, ${j.counts.responsibility} responsibilities`,
    ...j.warnings.map((w) => `warning: ${w}`)].join('\n');
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
    ...(m.gaps.length ? ['ask the user before writing:', ...m.gaps.map((g) => `  - ${g.term} (${g.kind})`)] : ['no missing keywords']),
    ...(values.out ? [`wrote ${values.out}`] : [])].join('\n');
  return { result: m, human, exit: m.gaps.some((g) => g.kind === 'must') ? EXIT.FINDINGS : EXIT.OK, summary: `fit ${m.fit}` };
}

async function appCommand(args) {
  const { name, rest } = sub(args);
  const { values, positionals } = parseOpts(rest, {});
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
  writeFileAtomic(path.join(dir, 'resume.md'), draftResume(c.profile, { job, match: m }));
  writeFileAtomic(path.join(dir, 'cover-letter.md'), draftCoverLetter(c.profile, { job, match: m }));
  return { result: { dir, files: ['job.json', 'match.json', 'resume.md', 'cover-letter.md'], fit: m.fit, gaps: m.gaps }, human: `created ${dir}\n  job.json, match.json, resume.md (draft), cover-letter.md (draft); fit ${m.fit == null ? 'n/a' : Math.round(m.fit * 100)}%, ${plural(m.gaps.length, 'gap')} to ask about` };
}
const safeRead = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };

function docCommand(kind) {
  return async (args) => {
    const { name, rest } = sub(args);
    const { values, positionals } = parseOpts(rest, { job: { type: 'string' }, match: { type: 'string' }, out: { type: 'string' }, report: { type: 'string' }, formats: { type: 'string' }, title: { type: 'string' } });
    const c = need(values);
    const job = values.job ? readJob(values.job) : null;
    const match = values.match ? readMatch(values.match) : (job ? matchJob(c.profile, job) : null);
    switch (name) {
      case 'draft': {
        const text = kind === 'resume' ? draftResume(c.profile, { job, match }) : draftCoverLetter(c.profile, { job, match });
        const out = values.out || (kind === 'resume' ? 'resume.md' : 'cover-letter.md');
        if (!values['dry-run']) writeFileAtomic(path.resolve(c.cwd, out), text);
        return { result: { out: path.resolve(c.cwd, out), content: text }, human: `wrote ${out}\n\n${text}` };
      }
      case 'check': {
        const file = positionals[0];
        if (!file) throw usageError(`${kind} check <file.md> [--job job.json] [--match match.json] [--report report.json]`);
        const text = readText(path.resolve(c.cwd, file));
        const report = checkResume(text, c.profile, { job, match, kind });
        report.document = path.resolve(c.cwd, file);
        const reportPath = values.report || path.resolve(c.cwd, file).replace(/\.md$/i, '') + '.check.json';
        if (!values['dry-run']) writeJsonAtomic(reportPath, report);
        const human = [`${report.verdict}: ${report.counts.fail} fail, ${report.counts.finding} findings; ${report.counts.words} words, ${report.counts.cited_facts} facts cited`,
          ...report.findings.map((f) => `  ${f.severity === 'fail' ? 'FAIL' : 'note'} ${f.line != null ? `L${f.line} ` : ''}${f.code}: ${f.message}`),
          ...(report.coverage ? [`keyword coverage: must ${report.coverage.must.used}/${report.coverage.must.supported} supported used (${report.coverage.must.total} in posting); nice ${report.coverage.nice.used}/${report.coverage.nice.supported} (${report.coverage.nice.total})`] : []),
          `report: ${reportPath}`].join('\n');
        return { result: report, human, exit: report.verdict === 'FAIL' ? EXIT.FINDINGS : EXIT.OK, summary: report.verdict };
      }
      case 'finalize': {
        const file = positionals[0];
        if (!file) throw usageError(`${kind} finalize <file.md> [--formats md,txt,html,docx]`);
        const abs = path.resolve(c.cwd, file);
        const text = readText(abs);
        const report = checkResume(text, c.profile, { job, match, kind });
        if (report.verdict === 'FAIL') throw usageError(`${file} fails the check (${report.counts.fail} fail); fix it and run "${kind} check" first`, { findings: report.findings });
        const formats = (values.formats || 'md,txt,html').split(',').map((s) => s.trim()).filter(Boolean);
        if (values['dry-run']) return { result: { dry_run: true, formats }, human: 'dry run' };
        const r = finalize(abs, { formats, title: values.title });
        writeJsonAtomic(abs.replace(/\.md$/i, '') + '.check.json', { ...report, document: abs, finalized: r.files });
        return { result: { ...r, verdict: report.verdict, findings: report.findings }, human: [`${report.verdict}; wrote:`, ...r.files.map((f) => `  ${f}`), ...(r.docx ? [`  docx: ${r.docx}`] : [])].join('\n') };
      }
      default: throw usageError(`${kind} draft | check | finalize`);
    }
  };
}

async function doctorCommand(args) {
  const { values } = parseOpts(args, {});
  const r = doctor({ store: values.store, cwd: values.cwd ? path.resolve(values.cwd) : process.cwd() });
  return { result: r, exit: r.ok ? EXIT.OK : EXIT.FINDINGS, human: r.items.map((i) => `${i.status.padEnd(8)} ${i.name.padEnd(18)} ${i.detail}`).join('\n') };
}

export const commands = {
  store: storeCommand,
  fact: factCommand,
  interview: interviewCommand,
  job: jobCommand,
  match: matchCommand,
  app: appCommand,
  resume: docCommand('resume'),
  'cover-letter': docCommand('cover-letter'),
  doctor: doctorCommand,
};
