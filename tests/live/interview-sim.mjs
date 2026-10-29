// Simulated-candidate interview (paid). Two headless Claude sessions: the agent, with the skill
// installed and a shell for its scripts, interviews the candidate; the candidate is a second
// `claude -p` with no tools that only knows the persona's facts. After the turns, the store the
// agent wrote is graded against the persona's ground truth: recall of employers and titles, exact
// start dates, no employer or number that the persona never said, must-mention terms, coverage.
//
//   node tests/live/interview-sim.mjs [--persona icu-nurse] [--turns 8] [--max-cost-usd 12]
//        [--model <id>] [--candidate-model <id>] [--keep] [--json] [--out report.json]
//
// Exit 0 when the store passes, 1 when it does not, 4 when the run could not complete.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const NAME = 'career-profiler';
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const CP = path.join(repo, 'skills', NAME, 'scripts', 'cp.mjs');
const { values: opt } = parseArgs({ options: {
  persona: { type: 'string', default: 'icu-nurse' }, turns: { type: 'string', default: '8' }, 'max-cost-usd': { type: 'string', default: '12' },
  model: { type: 'string' }, 'candidate-model': { type: 'string' }, keep: { type: 'boolean' }, json: { type: 'boolean' }, out: { type: 'string' }, 'timeout-s': { type: 'string', default: '300' },
} });
const persona = JSON.parse(fs.readFileSync(path.join(here, 'personas', `${opt.persona}.json`), 'utf8'));
const turns = Number(opt.turns);
const cap = Number(opt['max-cost-usd']);

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-sim-'));
fs.cpSync(path.join(repo, 'skills', NAME), path.join(work, '.claude', 'skills', NAME), { recursive: true });
const store = path.join(work, 'store');
const env = { ...process.env, CAREER_PROFILER_HOME: store };
for (const k of Object.keys(env)) if (/^(CLAUDECODE|CLAUDE_CODE_ENTRYPOINT|COPILOT|CODEX_)/.test(k)) delete env[k];

let spent = 0;
const transcript = [];
function claude(args, { cwd = work, label }) {
  const r = spawnSync('claude', ['-p', '--output-format', 'json', ...args], { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: Number(opt['timeout-s']) * 1000, maxBuffer: 64 * 1024 * 1024 });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch {}
  if (!json) return { error: `${label}: ${r.error ? r.error.message : `exit ${r.status}`}: ${(r.stderr || r.stdout || '').slice(0, 300)}` };
  spent += json.total_cost_usd || 0;
  return { text: json.result || '', session: json.session_id, error: json.is_error ? `${label}: ${(json.errors || []).join('; ') || json.subtype}` : null, raw: json };
}

// --allowedTools is variadic: one argument per rule (a comma-joined list is read as one unknown tool).
const agentArgs = (first) => ['--allowedTools', 'Bash(node:*)', 'Bash(cat:*)', 'Bash(ls:*)', 'Bash(mkdir:*)', 'Read', 'Glob', 'Grep', 'Skill', '--permission-mode', 'dontAsk',
  '--max-budget-usd', String(Math.max(0.5, cap / (turns + 1))), ...(opt.model ? ['--model', opt.model] : []),
  ...(first ? [] : [])];
const candidateSystem = `${persona.voice}\n\nYour facts (the only things you know):\n${JSON.stringify(persona.facts, null, 2)}\n\nReply in plain prose, two to six sentences, no lists longer than four items.`;

let agentSession = null;
let candidateSession = null;
let userMessage = `Use the career-profiler skill to build my career profile. Interview me; I will answer. Save what I confirm as you go. (Scripts: ${path.join(work, '.claude', 'skills', NAME, 'scripts', 'cp.mjs')}; the store is at ${store}.)`;
let failure = null;
for (let t = 1; t <= turns; t++) {
  if (spent >= cap) { failure = `cost cap $${cap} reached after ${t - 1} turns`; break; }
  const a = claude([...(agentSession ? ['--resume', agentSession] : []), ...agentArgs(!agentSession), '--', userMessage], { label: `agent turn ${t}` });
  if (a.error && !a.text) { failure = a.error; break; }
  agentSession = a.session || agentSession;
  transcript.push({ turn: t, role: 'agent', text: a.text });
  process.stderr.write(`agent ${t}: ${a.text.replace(/\s+/g, ' ').slice(0, 160)}\n`);
  if (t === turns) break;
  const c = claude([...(candidateSession ? ['--resume', candidateSession] : ['--system-prompt', candidateSystem]), '--tools', '', '--max-budget-usd', '0.5',
    ...(opt['candidate-model'] ? ['--model', opt['candidate-model']] : []), '--', a.text], { label: `candidate turn ${t}`, cwd: os.tmpdir() });
  if (c.error && !c.text) { failure = c.error; break; }
  candidateSession = c.session || candidateSession;
  transcript.push({ turn: t, role: 'candidate', text: c.text });
  process.stderr.write(`candidate ${t}: ${c.text.replace(/\s+/g, ' ').slice(0, 160)}\n`);
  userMessage = c.text;
}

// Grade the store.
const run = (args) => { const r = spawnSync(process.execPath, [CP, ...args, '--json'], { env, encoding: 'utf8' }); let j = null; try { j = JSON.parse(r.stdout); } catch {} return { status: r.status, json: j }; };
const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
const gt = persona.ground_truth;
const validate = run(['store', 'validate']);
check('store-exists-and-valid', validate.status === 0 && validate.json && validate.json.ok, validate.json ? JSON.stringify(validate.json.validation.errors.slice(0, 3)) : 'no store written');
let profile = null;
if (fs.existsSync(path.join(store, 'profile.json'))) profile = JSON.parse(fs.readFileSync(path.join(store, 'profile.json'), 'utf8'));
if (profile) {
  const exps = profile.experience || [];
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  for (const e of gt.employers) check(`recall-employer:${e}`, exps.some((x) => norm(x.employer).includes(norm(e))), exps.map((x) => x.employer).join(' | '));
  for (const x of exps) check(`no-fabricated-employer:${x.employer}`, gt.employers.some((e) => norm(x.employer).includes(norm(e)) || norm(e).includes(norm(x.employer))), x.id);
  for (const t of gt.titles) check(`exact-title:${t}`, exps.some((x) => norm(x.title) === norm(t)), exps.map((x) => x.title).join(' | '));
  for (const s of gt.starts) check(`start-date:${s}`, exps.some((x) => String(x.start).startsWith(s)), exps.map((x) => x.start).join(' | '));
  // Numbers the agent wrote into fact text and metrics (provenance timestamps, ids and dates excluded).
  const stripped = JSON.parse(JSON.stringify([profile.experience, profile.skills, profile.certifications, profile.education, profile.summary], (k, v) => (['provenance', 'id', 'at', 'start', 'end', 'date', 'expires', 'last_used', 'added', 'evidence', 'skills'].includes(k) ? undefined : v)));
  const text = JSON.stringify(stripped);
  const numbers = new Set((text.match(/(?<![\w.-])\d+(?:\.\d+)?(?![\w.])/g) || []).map(Number).filter((n) => n < 1900 || n > 2100 || gt.numbers.includes(n)));
  const unknown = [...numbers].filter((n) => !gt.numbers.includes(n) && !(n >= 1900 && n <= 2100));
  check('no-invented-numbers', unknown.length === 0, unknown.join(', ') || 'none');
  for (const m of gt.must_mention) check(`mentions:${m}`, new RegExp(`\\b${m}\\b`, 'i').test(text), '');
  const cov = run(['interview', 'coverage']);
  check(`coverage>=${gt.min_coverage}`, cov.json && cov.json.score >= gt.min_coverage, cov.json ? `score ${cov.json.score}` : 'n/a');
  const unconfirmed = (validate.json && validate.json.unconfirmed) || [];
  check('nothing-left-unconfirmed', unconfirmed.length === 0, unconfirmed.join(', ') || 'none');
}
const passed = checks.filter((c) => c.ok).length;
const report = { schema: 'cp-interview-sim/1', persona: persona.name, turns_run: transcript.filter((t) => t.role === 'agent').length, cost_usd: Math.round(spent * 1000) / 1000, failure, workspace: opt.keep ? work : null,
  passed, total: checks.length, verdict: !failure && checks.every((c) => c.ok) ? 'PASS' : failure ? 'INCOMPLETE' : 'FAIL', checks, transcript };
if (opt.out) fs.writeFileSync(opt.out, `${JSON.stringify(report, null, 2)}\n`);
if (opt.json) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`${report.verdict}: ${passed}/${checks.length} checks, ${report.turns_run} agent turns, $${report.cost_usd}${failure ? `; ${failure}` : ''}`);
  for (const c of checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
  if (opt.keep) console.log(`workspace kept at ${work}`);
}
if (!opt.keep) fs.rmSync(work, { recursive: true, force: true });
process.exitCode = report.verdict === 'PASS' ? 0 : report.verdict === 'FAIL' ? 1 : 4;
