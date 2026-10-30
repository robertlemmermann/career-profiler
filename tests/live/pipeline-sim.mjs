// The scripts pipeline, live (paid): the `scripts-pipeline` eval case run as a headless Claude Code
// session with a shell, graded offline against the same checks as evals/scripts-pipeline/case.yaml.
//
// Why a second runner: `claude plugin eval` confines Bash in an OS sandbox whose writes go to the
// run's workspace. When the harness itself runs as root (common in containers and CI images) it
// cannot seal that workspace and mounts it read-only, so the skill's scripts cannot write the
// application folder and the case fails for an environment reason. This runner gives the agent the
// same prompt, scaffold, tools and turn limit in a throwaway temp workspace, then applies the same
// graders: tool_used and tool_order on the Bash commands it ran, file_exists on the outputs, and the
// llm criteria judged by a second `claude -p` (three votes, majority).
//
//   node tests/live/pipeline-sim.mjs [--dry-run] [--runs 2] [--model <id>] [--judge-model <id>] [--max-cost-usd 20]
//        [--keep] [--json] [--out report.json] [--no-ledger]
//
// Exit 0 when every run passes every grader, 1 when one does not, 4 when a run could not complete.
// Every run appends a row to evals/ledger/ledger.jsonl (runner "pipeline-sim", item "scripts-pipeline").

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { appendRows } from '../lib/ledger.mjs';

const NAME = 'career-profiler';
const CASE = 'scripts-pipeline';
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const caseDir = path.join(repo, 'evals', CASE);
const { values: opt } = parseArgs({ allowNegative: true, options: {
  runs: { type: 'string' }, model: { type: 'string' }, 'judge-model': { type: 'string', default: 'sonnet' },
  'max-cost-usd': { type: 'string', default: '20' }, 'timeout-s': { type: 'string', default: '900' },
  keep: { type: 'boolean' }, json: { type: 'boolean' }, out: { type: 'string' }, ledger: { type: 'boolean', default: true }, 'dry-run': { type: 'boolean' },
} });

// --- the case file: a small reader for the shape case.yaml uses (no YAML dependency) ---
const yaml = fs.readFileSync(path.join(caseDir, 'case.yaml'), 'utf8').split(/\r?\n/);
const scalar = (key) => { const l = yaml.find((x) => new RegExp(`^\\s*${key}:\\s*\\S`).test(x)); return l ? l.replace(/^\s*[^:]+:\s*/, '').replace(/^"|"$/g, '') : null; };
const unq = (s) => s.replace(/^"|"$/g, '').replace(/\\\\/g, '\\');
const graders = [];
{
  let g = null; let inCriteria = false; let criteriaIndent = 0; let side = null;
  const start = yaml.findIndex((l) => /^graders:/.test(l));
  for (const line of yaml.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const m = /^(\s*)- name:\s*(.+)$/.exec(line);
    if (m) { g = { name: m[2].trim(), criteria: [] }; graders.push(g); inCriteria = false; side = null; continue; }
    if (!g) continue;
    if (inCriteria) {
      const indent = /^(\s*)/.exec(line)[1].length;
      if (line.trim() === '' || indent >= criteriaIndent) { g.criteria.push(line.slice(criteriaIndent)); continue; }
      inCriteria = false;
    }
    const kv = /^(\s*)([a-z_]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, ind, key, val] = kv;
    if (key === 'criteria') { inCriteria = true; criteriaIndent = ind.length + 2; continue; }
    if (key === 'before' || key === 'after') { side = key; continue; }
    if (key === 'input_match') { if (side) g[side] = unq(val); else g.input_match = unq(val); continue; }
    if (['type', 'tool', 'path', 'weight'].includes(key)) g[key] = key === 'weight' ? Number(val) : unq(val);
  }
}
const maxTurns = Number(scalar('max_turns') || 40);
const runs = Number(opt.runs || scalar('runs') || 2);
const promptBody = fs.readFileSync(path.join(caseDir, 'prompt.md'), 'utf8').replace(/^---[\s\S]*?\n---\n/, '').trim();
const cap = Number(opt['max-cost-usd']);
if (opt['dry-run']) {
  console.log(JSON.stringify({ runs, maxTurns, graders: graders.map((g) => ({ ...g, criteria: g.criteria.length ? `${g.criteria.length} lines: ${g.criteria.join(' ').trim().slice(0, 80)}...` : undefined })) }, null, 2));
  process.exit(0);
}

const baseEnv = { ...process.env };
for (const k of Object.keys(baseEnv)) if (/^(CLAUDECODE|CLAUDE_CODE_ENTRYPOINT|CAREER_PROFILER_)/.test(k)) delete baseEnv[k];
let spent = 0;

function claude(args, { cwd, input }) {
  const r = spawnSync('claude', ['-p', ...args], { cwd, env: baseEnv, input, encoding: 'utf8', stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'], timeout: Number(opt['timeout-s']) * 1000, maxBuffer: 128 * 1024 * 1024 });
  return r;
}
const refusal = (res) => res && res.is_error && (res.api_error_status != null || res.terminal_reason === 'api_error' || /hit your .{0,20}limit|usage credits|rate limit/i.test(String(res.result || '')));

/** One agent run: scaffold, prompt, stream; returns the Bash commands, the final answer and the result record. */
function runAgent(work) {
  const scaffold = spawnSync('bash', [path.join(caseDir, 'fixture.sh')], { cwd: work, env: baseEnv, encoding: 'utf8' });
  if (scaffold.status !== 0) return { error: `scaffold failed: ${(scaffold.stderr || scaffold.stdout).slice(0, 300)}` };
  fs.cpSync(path.join(repo, 'skills', NAME), path.join(work, '.claude', 'skills', NAME), { recursive: true });
  const args = ['--output-format', 'stream-json', '--verbose', '--max-turns', String(maxTurns),
    '--allowedTools', 'Bash', 'Read', 'Glob', 'Grep', 'Skill', 'Write', 'Edit', '--permission-mode', 'dontAsk',
    '--max-budget-usd', String(Math.max(2, cap / runs)), ...(opt.model ? ['--model', opt.model] : []), '--', promptBody];
  const r = claude(args, { cwd: work });
  const events = (r.stdout || '').split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const bash = [];
  for (const e of events) for (const c of ((e.message && e.message.content) || [])) if (c.type === 'tool_use' && c.name === 'Bash') bash.push(String((c.input && c.input.command) || ''));
  const result = [...events].reverse().find((e) => e.type === 'result') || null;
  if (result) spent += result.total_cost_usd || 0;
  if (!result) return { error: `no result record (exit ${r.status}): ${(r.stderr || '').slice(0, 300)}`, bash };
  if (refusal(result)) return { error: `api error ${result.api_error_status ?? ''} ${String(result.result || '').slice(0, 160)}`, bash, result };
  return { bash, answer: String(result.result || ''), result, turns: result.num_turns };
}

/** One llm criterion, three judge votes, majority wins. */
function judge(criteria, answer) {
  const votes = [];
  for (let i = 0; i < 3; i++) {
    const prompt = `You are grading an AI assistant's final answer against one criterion. You see only the final answer.\n\nCriterion:\n${criteria}\n\nFinal answer:\n<<<\n${answer}\n>>>\n\nReply with PASS or FAIL as the first word, then one sentence of reason.`;
    const r = claude(['--output-format', 'json', '--tools', '', '--max-budget-usd', '0.5', '--model', opt['judge-model']], { cwd: os.tmpdir(), input: prompt });
    let j = null; try { j = JSON.parse(r.stdout); } catch {}
    if (j) spent += j.total_cost_usd || 0;
    if (!j || refusal(j)) return { passed: false, error: j ? String(j.result).slice(0, 160) : `judge exit ${r.status}` };
    votes.push(/^\s*\**\s*PASS\b/i.test(String(j.result || '')));
  }
  return { passed: votes.filter(Boolean).length >= 2, votes };
}

function grade(work, run) {
  const out = [];
  for (const g of graders) {
    if (g.type === 'tool_used') {
      const re = new RegExp(g.input_match);
      const n = run.bash.filter((c) => re.test(c)).length;
      out.push({ name: g.name, weight: g.weight || 1, passed: n >= 1, detail: `${n} matching Bash call(s)` });
    } else if (g.type === 'tool_order') {
      const b = run.bash.findIndex((c) => new RegExp(g.before).test(c));
      const a = run.bash.findIndex((c) => new RegExp(g.after).test(c));
      out.push({ name: g.name, weight: g.weight || 1, passed: b >= 0 && a >= 0 && b < a, detail: `before at ${b}, after at ${a}` });
    } else if (g.type === 'file_exists') {
      const [dir, , file] = g.path.split('/').length === 4 ? [g.path.split('/').slice(0, 2).join('/'), null, g.path.split('/')[3]] : [null, null, null];
      let found = [];
      try { found = dir ? fs.readdirSync(path.join(work, dir)).filter((d) => fs.existsSync(path.join(work, dir, d, file))) : []; } catch {}
      out.push({ name: g.name, weight: g.weight || 1, passed: found.length > 0, detail: found.length ? `${dir}/${found[0]}/${file}` : `${g.path} missing` });
    } else if (g.type === 'llm') {
      const v = judge(g.criteria.join('\n').trim(), run.answer || '');
      out.push({ name: g.name, weight: g.weight || 1, passed: v.passed, detail: v.error || `votes ${v.votes.map((x) => (x ? 'PASS' : 'FAIL')).join(' ')}` });
    }
  }
  return out;
}

const reports = [];
const rows = [];
let incomplete = false;
for (let i = 1; i <= runs; i++) {
  if (spent >= cap) { incomplete = true; reports.push({ run: i, error: `cost cap $${cap} reached` }); break; }
  const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cp-pipe-')));
  process.stderr.write(`run ${i}: workspace ${work}\n`);
  const run = runAgent(work);
  if (run.error) {
    incomplete = true;
    reports.push({ run: i, error: run.error, workspace: opt.keep ? work : null });
    rows.push({ runner: 'pipeline-sim', host: 'claude', model: opt.model || null, judge_model: opt['judge-model'], item: CASE, run: i, score: 0, passed: false, graders: [], cost_usd: run.result ? run.result.total_cost_usd : null, failure_class: null, note: run.error });
    process.stderr.write(`run ${i}: INCOMPLETE ${run.error}\n`);
    continue;
  }
  const g = grade(work, run);
  const total = g.reduce((s, x) => s + x.weight, 0);
  const score = Math.round((g.filter((x) => x.passed).reduce((s, x) => s + x.weight, 0) / total) * 1000) / 1000;
  const passed = g.every((x) => x.passed);
  reports.push({ run: i, score, passed, turns: run.turns, cost_usd: run.result.total_cost_usd, graders: g, bash: run.bash, answer: run.answer, workspace: opt.keep ? work : null });
  rows.push({ runner: 'pipeline-sim', host: 'claude', model: opt.model || null, judge_model: opt['judge-model'], item: CASE, run: i, score, passed, graders: g.map((x) => ({ name: x.name, passed: x.passed })), cost_usd: run.result.total_cost_usd, failure_class: null, note: null });
  process.stderr.write(`run ${i}: ${passed ? 'PASS' : 'FAIL'} ${score}\n${g.map((x) => `  ${x.passed ? 'ok  ' : 'FAIL'} ${x.name} (${x.detail})`).join('\n')}\n`);
  if (!opt.keep) fs.rmSync(work, { recursive: true, force: true });
}
if (opt.ledger && rows.length) appendRows(rows);
const report = { schema: 'cp-pipeline-sim/1', case: CASE, model: opt.model || null, judge_model: opt['judge-model'], runs, cost_usd: Math.round(spent * 1000) / 1000,
  verdict: incomplete ? 'INCOMPLETE' : reports.every((r) => r.passed) ? 'PASS' : 'FAIL', reports };
if (opt.out) fs.writeFileSync(opt.out, `${JSON.stringify(report, null, 2)}\n`);
if (opt.json) console.log(JSON.stringify(report, null, 2));
else console.log(`${report.verdict}: ${reports.filter((r) => r.passed).length}/${runs} runs passed, $${report.cost_usd}`);
process.exitCode = report.verdict === 'PASS' ? 0 : report.verdict === 'INCOMPLETE' ? 4 : 1;
