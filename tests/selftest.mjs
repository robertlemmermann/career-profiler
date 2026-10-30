// `selftest`: the skill's own free checks behind one command, run from the repository root:
//   node tests/selftest.mjs [--only area,...] [--json]
// Areas: footprint (the shipped skill folder), frontmatter, scripts, assets, evals (layout only;
// paid runs are printed, never started), readme, release, unit (node --test). Exit 0 when every
// area passes, 1 otherwise. Development tooling: never installed with the skill.

import { spawnSync } from 'node:child_process';
import { subjectHash } from './lib/ledger.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const NAME = 'career-profiler';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = path.join(ROOT, 'skills', NAME);
const { values: opt } = parseArgs({ options: { only: { type: 'string' }, json: { type: 'boolean' }, release: { type: 'boolean' } } });
// --release: the ledger area also requires a passing row for every item at HEAD (the release rule).
const SHIPPED_TOP = new Set(['SKILL.md', 'references', 'scripts', 'assets']);
const LIMITS = { files: 80, fileBytes: 2 * 1024 * 1024, skillLines: 160, refLines: 300, descriptionChars: 1024, compatibilityChars: 500, evalFiles: 12 };
/** Playbooks that describe script steps must carry a "Without Node" (guidance-only) section. */
const NEEDS_WITHOUT_NODE = ['profile.md', 'resume.md', 'storage.md', 'job-intake.md', 'setup.md', 'watch.md'];

const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => { try { fs.statSync(p); return true; } catch { return false; } };
const walk = (dir, rel = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), path.posix.join(rel, e.name)) : [path.posix.join(rel, e.name)]));
const results = {};
function area(name, fn) {
  if (opt.only && !opt.only.split(',').includes(name)) return;
  const problems = [];
  const notes = [];
  try { fn(problems, notes); } catch (err) { problems.push(`threw: ${err.message}`); }
  results[name] = { status: problems.length ? 'fail' : 'pass', problems, notes };
}

function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const fm = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const top = /^([a-z_-]+):\s*(.*)$/.exec(line);
    if (top) { key = top[1]; fm[key] = top[2].replace(/^>-?$/, '').replace(/^\|-?$/, '').trim(); continue; }
    const nested = /^\s+([a-z_-]+):\s*(.*)$/.exec(line);
    if (nested && key === 'metadata') { fm[nested[1]] = nested[2].trim(); continue; }
    if (key && /^\s+/.test(line)) fm[key] = `${fm[key]} ${line.trim()}`.trim();
  }
  return fm;
}

area('footprint', (p, n) => {
  const top = fs.readdirSync(SKILL);
  for (const t of top) if (!SHIPPED_TOP.has(t)) p.push(`unexpected top-level entry in the skill folder: ${t}`);
  const files = walk(SKILL);
  n.push(`${files.length} files`);
  if (files.length > LIMITS.files) p.push(`${files.length} files (limit ${LIMITS.files})`);
  for (const f of files) {
    const abs = path.join(SKILL, f);
    const st = fs.statSync(abs);
    if (st.size > LIMITS.fileBytes) p.push(`${f}: ${st.size} bytes`);
    if (/\.(md|mjs|json)$/.test(f) && read(abs).includes('\r\n')) p.push(`${f}: CRLF line endings`);
    if (/(^|\/)(tests?|evals?|node_modules|\.env.*|CHANGELOG\.md|README\.md)(\/|$)/.test(f)) p.push(`${f}: development file inside the skill`);
  }
  const skill = read(path.join(SKILL, 'SKILL.md'));
  const skillLines = skill.split('\n').length;
  if (skillLines > LIMITS.skillLines) p.push(`SKILL.md has ${skillLines} lines (limit ${LIMITS.skillLines})`);
  const refs = fs.readdirSync(path.join(SKILL, 'references')).filter((f) => f.endsWith('.md'));
  for (const r of refs) {
    if (!skill.includes(`references/${r}`)) p.push(`references/${r} is not linked from SKILL.md`);
    const lines = read(path.join(SKILL, 'references', r)).split('\n').length;
    if (lines > LIMITS.refLines) p.push(`references/${r} has ${lines} lines (limit ${LIMITS.refLines})`);
  }
  // Relative links in SKILL.md and references resolve.
  for (const f of ['SKILL.md', ...refs.map((r) => `references/${r}`)]) {
    const text = read(path.join(SKILL, f));
    for (const m of text.matchAll(/\]\(([^)#\s]+)(#[^)]*)?\)/g)) {
      const target = m[1];
      if (/^[a-z]+:/.test(target)) continue;
      if (!exists(path.resolve(path.dirname(path.join(SKILL, f)), target))) p.push(`${f}: broken link ${target}`);
    }
  }
  for (const token of ['$ARGUMENTS', '${CLAUDE_SKILL_DIR}', '!`']) if (skill.includes(token)) p.push(`SKILL.md uses the host substitution ${token}`);
});

area('playbooks', (p, n) => {
  for (const r of NEEDS_WITHOUT_NODE) {
    const f = path.join(SKILL, 'references', r);
    if (!exists(f)) { p.push(`${r} missing`); continue; }
    const text = read(f);
    if (!/^## (?:Without Node|Manual fallback \(guidance-only mode\))/m.test(text)) p.push(`${r}: no "Without Node" section`);
  }
  const skill = read(path.join(SKILL, 'SKILL.md'));
  for (const must of ['Step 0', 'gate record', 'never submits', 'GATE_REQUIRED']) if (!skill.includes(must)) p.push(`SKILL.md does not mention "${must}"`);
  for (const [f, must] of [['interview.md', 'Never ask for'], ['watch.md', 'refused'], ['privacy.md', 'never'], ['setup.md', '--confirm']]) if (!read(path.join(SKILL, 'references', f)).includes(must)) p.push(`${f} does not mention "${must}"`);
  for (const f of fs.readdirSync(path.join(SKILL, 'references')).filter((x) => x.endsWith('.md'))) {
    const text = read(path.join(SKILL, 'references', f));
    for (const m of text.matchAll(/```bash\n([\s\S]*?)```/g)) if (/\/tmp\/|\/home\/[a-z]+\//.test(m[1])) p.push(`${f}: a bash snippet hard-codes a local path`);
  }
  n.push(`${NEEDS_WITHOUT_NODE.length} playbooks with guidance-only sections`);
});

area('pii-honeypots', (p, n) => {
  // Every persona plants PII; no fixture profile, eval prompt or README may carry a planted value at professional tier.
  const personas = fs.readdirSync(path.join(ROOT, 'tests', 'live', 'personas')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(read(path.join(ROOT, 'tests', 'live', 'personas', f))));
  let planted = 0;
  for (const per of personas) {
    const hp = (per.facts && per.facts.honeypots) || {};
    if (!Object.keys(hp).length) p.push(`${per.name}: no honeypots`);
    if (!per.deterministic || !per.deterministic.answers || per.deterministic.answers.length < 8) p.push(`${per.name}: no deterministic answers`);
    for (const v of per.ground_truth.never_in_professional || []) { planted += 1; if (!JSON.stringify(per.deterministic || {}).includes(v) && !JSON.stringify(hp).includes(v)) p.push(`${per.name}: honeypot "${v}" is never volunteered`); }
  }
  const det = JSON.parse(read(path.join(SKILL, 'assets', 'pii', 'detectors.json')));
  for (const d of det.detectors) { try { new RegExp(d.pattern, d.flags || ''); } catch (err) { p.push(`detector ${d.id}: ${err.message}`); } }
  const policy = JSON.parse(read(path.join(SKILL, 'assets', 'export-policy.json')));
  for (const k of ['resume', 'cover', 'export', 'board', 'notification', 'log']) if (!policy.profiles[k]) p.push(`export policy lacks profile ${k}`);
  for (const f of fs.readdirSync(path.join(ROOT, 'tests', 'fixtures', 'profiles'))) {
    const prof = JSON.parse(read(path.join(ROOT, 'tests', 'fixtures', 'profiles', f)));
    const text = JSON.stringify(prof);
    for (const re of [/\b\d{3}-\d{2}-\d{4}\b/, /date of birth/i, /\d+ [A-Z][a-z]+ (?:Street|Avenue|Court)\b/]) if (re.test(text) && !text.includes('"tier":"never"') && !text.includes('"tier": "never"')) p.push(`${f}: planted PII outside tier never`);
  }
  n.push(`${personas.length} personas, ${planted} planted values, ${det.detectors.length} detectors`);
});

area('ledger', (p, n) => {
  const f = path.join(ROOT, 'evals', 'ledger', 'ledger.jsonl');
  if (!exists(path.join(ROOT, 'evals', 'ledger', 'README.md'))) p.push('evals/ledger/README.md missing');
  if (!exists(f)) { if (opt.release) p.push('no ledger rows: run the paid runners on this sha'); else n.push('no rows yet'); return; }
  const rows = read(f).split(/\r?\n/).filter(Boolean).map((l, i) => { try { return JSON.parse(l); } catch { p.push(`row ${i + 1} is not JSON`); return null; } }).filter(Boolean);
  const classes = new Set([null, 'skill', 'grader', 'fixture', 'host-flake', 'model-drift']);
  rows.forEach((r, i) => {
    for (const k of ['at', 'git_sha', 'skill_version', 'runner', 'host', 'item', 'passed']) if (!(k in r)) p.push(`row ${i + 1}: missing ${k}`);
    if (!classes.has(r.failure_class ?? null)) p.push(`row ${i + 1}: bad failure_class ${r.failure_class}`);
    if (!['plugin-eval', 'pipeline-sim', 'trigger-set', 'interview-sim', 'triage'].includes(r.runner)) p.push(`row ${i + 1}: bad runner ${r.runner}`);
    if (r.runner === 'triage' && (!r.refers_to || !r.failure_class)) p.push(`row ${i + 1}: triage row without refers_to or failure_class`);
  });
  const sha = (spawnSync('git', ['-C', ROOT, 'rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).stdout || '').trim();
  const results = rows.filter((r) => r.runner !== 'triage');
  const triaged = new Set(rows.filter((r) => r.runner === 'triage').map((r) => `${r.refers_to.runner}|${r.refers_to.item}|${r.refers_to.run}|${r.refers_to.at}`));
  // An item's result is its newest invocation (rows written together share `at`): it passes only when
  // every run in that invocation passed. A model-played simulation is reported but never decides.
  const keyOf = (r) => `${r.runner}|${r.host}|${r.item}${r.runner === 'interview-sim' ? `|${r.sim || 'deterministic'}` : ''}`;
  const newest = (list) => {
    const by = new Map();
    for (const r of list) { const k = keyOf(r); const cur = by.get(k); if (!cur || r.at > cur.at) by.set(k, { at: r.at, rows: [r] }); else if (r.at === cur.at) cur.rows.push(r); }
    return [...by.values()].map(({ rows: rs }) => ({ ...rs[0], runs: rs.length, passed: rs.every((x) => x.passed === true) ? true : rs.some((x) => x.passed === false) ? false : null }));
  };
  const current = newest(results);
  const failing = current.filter((r) => r.passed === false);
  const unclassified = results.filter((r) => r.passed === false && !triaged.has(`${r.runner}|${r.item}|${r.run}|${r.at}`));
  n.push(`${rows.length} rows, ${current.length} items, ${failing.length} failing in their newest run, ${unclassified.length} failing row(s) not yet triaged${sha ? `, HEAD ${sha}` : ''}`);
  if (opt.release && unclassified.length) p.push(`${unclassified.length} failing ledger row(s) have no triage row (node tests/ledger-triage.mjs)`);
  if (failing.length) n.push(`failing: ${failing.map((r) => r.item).join(', ')}`);
  const subject = subjectHash(ROOT);
  // "At HEAD" means: produced against the same skill, cases, personas and runners as the work tree now
  // holds (the subject hash), so committing the ledger rows does not orphan them.
  const atHead = newest(results.filter((r) => r.subject === subject));
  const deciding = atHead.filter((r) => !(r.runner === 'interview-sim' && r.sim === 'model'));
  n.push(`subject ${subject}: ${deciding.length} items with rows, ${deciding.filter((r) => r.passed === true).length} passing`);
  if (opt.release) {
    if (!atHead.length) p.push(`no ledger rows for subject ${subject}`);
    for (const r of deciding) if (r.passed !== true) p.push(`${r.runner} ${r.item} is not passing at HEAD (${r.runs} run(s) in its newest invocation)`);
    const cases = fs.readdirSync(path.join(ROOT, 'evals'), { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== 'ledger').map((e) => e.name);
    // The shell case may be proven by plugin eval or, where its OS sandbox cannot write (a root harness), by pipeline-sim.
    for (const c of cases) if (!deciding.some((r) => (r.runner === 'plugin-eval' || (r.runner === 'pipeline-sim' && c === 'scripts-pipeline')) && r.item === c)) p.push(`no plugin-eval row at HEAD for case ${c}`);
    const set = JSON.parse(read(path.join(ROOT, 'evals', 'trigger-set.json')));
    for (const q of set.queries) if (!deciding.some((r) => r.runner === 'trigger-set' && r.item === q.id)) p.push(`no trigger-set row at HEAD for ${q.id}`);
    for (const per of fs.readdirSync(path.join(ROOT, 'tests', 'live', 'personas')).filter((x) => x.endsWith('.json'))) { const name = per.replace(/\.json$/, ''); if (!deciding.some((r) => r.runner === 'interview-sim' && r.item === name)) p.push(`no deterministic interview-sim row at HEAD for ${name}`); }
  }
});

area('frontmatter', (p, n) => {
  const fm = frontmatter(read(path.join(SKILL, 'SKILL.md')));
  if (!fm) { p.push('no frontmatter'); return; }
  const allowed = ['name', 'description', 'license', 'compatibility', 'metadata'];
  for (const k of Object.keys(fm)) if (!allowed.includes(k) && !['version', 'short-description', 'author', 'homepage'].includes(k)) p.push(`field outside the six-field spec: ${k}`);
  if (fm.name !== NAME) p.push(`name "${fm.name}" is not the directory name`);
  if (!/^[a-z0-9-]{1,64}$/.test(fm.name || '')) p.push('name must be lowercase letters, digits and hyphens');
  if (!fm.description) p.push('description missing');
  else if (fm.description.length > LIMITS.descriptionChars) p.push(`description is ${fm.description.length} chars`);
  if (fm.compatibility && fm.compatibility.length > LIMITS.compatibilityChars) p.push('compatibility over 500 chars');
  if (!/^"?\d+\.\d+\.\d+"?$/.test(fm.version || '')) p.push(`metadata.version "${fm.version}" is not semver`);
  n.push(`description ${fm.description ? fm.description.length : 0} chars, version ${fm.version}`);
});

area('scripts', (p, n) => {
  const scripts = walk(path.join(SKILL, 'scripts')).filter((f) => f.endsWith('.mjs'));
  for (const f of scripts) { const r = spawnSync(process.execPath, ['--check', path.join(SKILL, 'scripts', f)], { encoding: 'utf8' }); if (r.status !== 0) p.push(`${f}: ${r.stderr.trim().split('\n')[0]}`); }
  const help = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'cp.mjs'), 'help', '--json'], { encoding: 'utf8' });
  let j = null; try { j = JSON.parse(help.stdout); } catch {}
  if (help.status !== 0 || !j) p.push('cp.mjs help --json failed');
  const fm = frontmatter(read(path.join(SKILL, 'SKILL.md')));
  if (j && fm && j.version !== fm.version.replace(/"/g, '')) p.push(`cp.mjs reports ${j.version}, SKILL.md says ${fm.version}`);
  for (const cmd of ['store', 'fact', 'interview', 'job', 'match', 'app', 'resume', 'cover-letter', 'doctor']) if (j && !j.usage.includes(`  ${cmd}`)) p.push(`help does not list ${cmd}`);
  n.push(`${scripts.length} modules`);
});

area('assets', (p, n) => {
  const tax = JSON.parse(read(path.join(SKILL, 'assets', 'taxonomy.json')));
  const seen = new Map();
  for (const t of tax.terms) {
    for (const a of [t.term, ...t.aliases]) { const k = a.toLowerCase(); if (seen.has(k) && seen.get(k) !== t.term) p.push(`alias "${a}" belongs to both ${seen.get(k)} and ${t.term}`); seen.set(k, t.term); }
  }
  const qb = JSON.parse(read(path.join(SKILL, 'assets', 'question-bank.json')));
  for (const [code, q] of Object.entries(qb.questions)) if (!q.question || typeof q.priority !== 'number') p.push(`question ${code} lacks text or priority`);
  for (const d of Object.keys(qb.domain_keywords)) if (!qb.domain_probes[d]) p.push(`domain ${d} has keywords but no probes`);
  JSON.parse(read(path.join(SKILL, 'assets', 'schema', 'profile.schema.json')));
  n.push(`${tax.terms.length} terms, ${Object.keys(qb.questions).length} questions`);
});

area('evals', (p, n) => {
  const ev = path.join(ROOT, 'evals');
  const set = JSON.parse(read(path.join(ev, 'trigger-set.json')));
  if (set.skill !== NAME) p.push('trigger-set.json names another skill');
  const pos = set.queries.filter((q) => q.should_trigger).length;
  const neg = set.queries.length - pos;
  if (pos < 12 || neg < 12) p.push(`trigger set has ${pos} positives and ${neg} negatives (need 12+ each)`);
  if (set.queries.some((q) => /TODO/.test(q.query))) p.push('trigger set contains TODO queries');
  const ids = new Set(); for (const q of set.queries) { if (ids.has(q.id)) p.push(`duplicate query id ${q.id}`); ids.add(q.id); }
  const cases = fs.readdirSync(ev, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== 'ledger').map((e) => e.name);
  for (const c of cases) {
    const dir = path.join(ev, c);
    const hasPrompt = exists(path.join(dir, 'prompt.md'));
    const hasYaml = exists(path.join(dir, 'case.yaml'));
    if (!hasPrompt && !hasYaml) { p.push(`${c}: no prompt.md or case.yaml`); continue; }
    if (hasPrompt) {
      const fm = frontmatter(read(path.join(dir, 'prompt.md')));
      if (!fm) p.push(`${c}: prompt.md has no frontmatter`);
      else {
        if (fm.name && fm.name !== c) p.push(`${c}: frontmatter name "${fm.name}" differs from the directory`);
        for (const k of Object.keys(fm)) if (!['schema_version', 'name', 'description', 'tags', 'plugins', 'runs', 'expected_outcome', 'model', 'max_turns', 'timeout_seconds', 'allowed_tools', 'append_system_prompt', 'env'].includes(k)) p.push(`${c}: unknown prompt.md key ${k}`);
        for (const k of ['description', 'expected_outcome']) if (fm[k] && /^[^"].*: /.test(fm[k])) p.push(`${c}: ${k} has an unquoted colon`);
      }
      const graders = exists(path.join(dir, 'graders')) ? fs.readdirSync(path.join(dir, 'graders')).filter((f) => f.endsWith('.md')) : [];
      if (!graders.length && !hasYaml) p.push(`${c}: no graders`);
      for (const g of graders) { const gf = frontmatter(read(path.join(dir, 'graders', g))); if (!gf || !['regex', 'tool_used', 'tool_order', 'file_exists', 'llm', 'baseline'].includes(gf.type)) p.push(`${c}/graders/${g}: bad or missing type`); }
    }
    const count = walk(dir).length;
    if (count > LIMITS.evalFiles) p.push(`${c}: ${count} files`);
  }
  // Shell-case fixtures mirror tests/fixtures.
  const sp = path.join(ev, 'scripts-pipeline', 'fixtures');
  if (exists(sp)) {
    if (read(path.join(sp, 'posting.txt')) !== read(path.join(ROOT, 'tests', 'fixtures', 'jobs', 'lead-react-engineer.txt'))) p.push('scripts-pipeline/fixtures/posting.txt differs from tests/fixtures');
    if (JSON.stringify(JSON.parse(read(path.join(sp, 'profile.json')))) !== JSON.stringify(JSON.parse(read(path.join(ROOT, 'tests', 'fixtures', 'profiles', 'senior-swe.json'))))) p.push('scripts-pipeline/fixtures/profile.json differs from tests/fixtures');
  }
  n.push(`${cases.length} cases, ${set.queries.length} trigger queries`);
  n.push('paid runs (not started): node tests/run-evals.mjs; node tests/run-trigger-set.mjs; node tests/live/interview-sim.mjs');
});

area('readme', (p, n) => {
  const text = read(path.join(ROOT, 'README.md'));
  for (const h of ['## 🧭 What it is', '## ✨ Features', '## 🚀 Install', '## 🎛️ Use', '## 📁 Where your data lives', '## 🧪 Testing the skill itself', '## 🔒 Privacy', '## 📡 Job boards']) if (!text.includes(h)) p.push(`missing section ${h}`);
  for (const m of text.matchAll(/\]\(([^)#\s]+)(#[^)]*)?\)/g)) { const t = m[1]; if (/^[a-z]+:/.test(t)) continue; if (!exists(path.join(ROOT, t))) p.push(`broken link ${t}`); }
  if (/\/home\/|C:\\Users/.test(text)) p.push('absolute local path in README');
  n.push(`${text.split('\n').length} lines`);
});

area('release', (p, n) => {
  const fm = frontmatter(read(path.join(SKILL, 'SKILL.md')));
  const version = (fm.version || '').replace(/"/g, '');
  const log = read(path.join(ROOT, 'CHANGELOG.md'));
  const top = /^## \[(\d+\.\d+\.\d+)\]/m.exec(log);
  if (!top || top[1] !== version) p.push(`CHANGELOG top entry ${top ? top[1] : 'none'} differs from metadata.version ${version}`);
  const readme = read(path.join(ROOT, 'README.md'));
  if (!readme.includes(`Version ${version}`)) p.push(`README does not state Version ${version}`);
  n.push(`version ${version}`);
});

area('unit', (p, n) => {
  const files = fs.readdirSync(path.join(ROOT, 'tests', 'unit')).filter((f) => f.endsWith('.test.mjs')).map((f) => path.join(ROOT, 'tests', 'unit', f));
  const r = spawnSync(process.execPath, ['--test', ...files], { encoding: 'utf8', cwd: ROOT, timeout: 600_000 });
  const tests = /^# tests (\d+)/m.exec(r.stdout);
  const fail = /^# fail (\d+)/m.exec(r.stdout);
  if (r.status !== 0 || !fail || fail[1] !== '0') {
    p.push(`node --test exit ${r.status}: ${fail ? `${fail[1]} failed` : 'no summary'}`);
    for (const m of r.stdout.matchAll(/^not ok \d+ - (.+)$/gm)) p.push(`failed: ${m[1]}`);
  }
  n.push(`${tests ? tests[1] : '?'} tests`);
});

const failed = Object.values(results).filter((r) => r.status === 'fail').length;
if (opt.json) console.log(JSON.stringify({ ok: failed === 0, failed, areas: results }, null, 2));
else {
  for (const [name, r] of Object.entries(results)) {
    console.log(`${r.status.padEnd(5)} ${name.padEnd(12)} ${r.notes.join('; ')}`);
    for (const pr of r.problems) console.log(`      - ${pr}`);
  }
  console.log(`${failed ? `${failed} area(s) failed` : 'all areas passed'}`);
}
process.exitCode = failed ? 1 : 0;
