// Independent grading packets and a host/model-bound release gate for Work-mode live evidence.
// packet <workspace>; record <packet> <judgment> <judge-agent-id>; report [--release].
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { subject } from './astra-session.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
import { DIR, MODEL, HOST, EFFORT } from './lib/eval-profile.mjs';
const read = (f) => fs.readFileSync(f, 'utf8');
const json = (f) => JSON.parse(read(f));
const hash = (s) => createHash('sha256').update(s).digest('hex');
const write = (f, data) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const tmp = `${f}.${randomUUID()}.tmp`; fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n'); fs.renameSync(tmp, f); };
const stateFile = (work) => path.join(DIR, `${path.basename(work)}.json`);
const response = (s) => s.transcript.filter((t) => t.role === 'agent').at(-1)?.text || '';
const scalar = (text, key) => { const raw = new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(text)?.[1]; return raw?.startsWith('"') ? JSON.parse(raw) : raw; };
export function rubrics(s) {
  if (s.kind === 'case') return fs.readdirSync(path.join(ROOT, 'evals', s.item, 'graders')).sort().map((f) => {
    const text = read(path.join(ROOT, 'evals', s.item, 'graders', f));
    return { name: f.replace(/\.md$/, ''), type: scalar(text, 'type'), pattern: scalar(text, 'pattern'), flags: scalar(text, 'flags'), criterion: text.replace(/^---\n[\s\S]*?\n---\s*/, ''), source_sha256: hash(text) };
  });
  if (s.kind === 'pipeline') {
    const source = read(path.join(ROOT, 'evals/scripts-pipeline/case.yaml'));
    return source.split(/\n  - name: /).slice(1).map((text) => ({ name: text.split('\n')[0], type: /\n    type: (\S+)/.exec(text)?.[1], criterion: text.split('    criteria: |\n')[1]?.replace(/^      /gm, '').trim(), source_sha256: hash(text) }));
  }
  return [];
}
export function expectedChecks(s) {
  const answer = response(s);
  if (s.kind === 'trigger') {
    const q = json(path.join(ROOT, 'evals/trigger-set.json')).queries.find((q) => q.id === s.item);
    return [{ name: 'trigger-matches-label', passed: s.reads.some((r) => r.path === 'SKILL.md') === q.should_trigger }];
  }
  if (s.kind === 'interview') return (s.checks || []).map((c) => ({ name: c.name, passed: c.ok }));
  const commands = (s.commands || []).map((c) => c.argv.join(' '));
  return rubrics(s).filter((g) => g.type !== 'llm').map((g) => {
    let passed = false;
    if (g.type === 'regex') passed = new RegExp(g.pattern, g.flags || '').test(answer);
    else if (s.kind === 'case' && g.type === 'tool_used') passed = s.reads.some((r) => r.path === 'SKILL.md');
    else if (g.name === 'parsed-the-posting') passed = commands.some((x) => /\bjob +parse\b/.test(x));
    else if (g.name === 'checked-the-resume') passed = commands.some((x) => /\bresume +check\b/.test(x));
    else if (g.name === 'check-before-finalize') {
      const firstCheck = commands.findIndex((x) => /\bresume +check\b/.test(x));
      const firstFinal = commands.findIndex((x) => /\bresume +finalize\b/.test(x));
      passed = firstCheck >= 0 && firstFinal > firstCheck;
    } else if (g.name === 'outputs-written') passed = Object.keys(s.artifacts || {}).some((p) => /^store\/applications\/[^/]+\/resume\.html$/.test(p));
    else if (g.name === 'report-written') passed = Object.keys(s.artifacts || {}).some((p) => /^store\/applications\/[^/]+\/resume\.check\.json$/.test(p));
    return { name: g.name, passed };
  });
}
export function packet(work) {
  const s = json(stateFile(work));
  if (s.status !== 'completed') throw Error('session incomplete');
  if (!['case', 'pipeline'].includes(s.kind)) throw Error('no model judge needed');
  const p = { schema: 'cp-astra-grade-packet/1', evidence_id: s.id, subject: s.subject, response_sha256: hash(response(s)), answer: response(s), criteria: rubrics(s).filter((g) => g.type === 'llm') };
  const dir = path.join(DIR, 'grading', s.id);
  fs.mkdirSync(dir, { recursive: true });
  write(path.join(dir, 'packet.json'), p);
  const result = { packet: path.join(dir, 'packet.json'), output: path.join(dir, 'judgment.json'), deterministic: expectedChecks(s) };
  if (HOST !== 'codex-cli') console.log(JSON.stringify(result));
  return result;
}
export function record(packetFile, resultFile, agent) {
  const p = json(packetFile), result = json(resultFile);
  const f = path.join(DIR, `${p.evidence_id}.json`), s = json(f);
  if (!agent || (s.agent_sessions || [s.agent_id]).includes(agent)) throw Error('an independent judge is required');
  if (p.subject !== s.subject || p.response_sha256 !== hash(response(s))) throw Error('packet does not match evidence');
  const current = rubrics(s).filter((g) => g.type === 'llm');
  if (JSON.stringify(p.criteria) !== JSON.stringify(current)) throw Error('rubrics changed');
  if (!Array.isArray(result.checks) || result.checks.length !== current.length) throw Error('missing criteria');
  if (new Set(result.checks.map((c) => c.name)).size !== current.length) throw Error('duplicate criteria');
  for (const g of current) {
    const c = result.checks.find((c) => c.name === g.name);
    if (!c || typeof c.passed !== 'boolean' || typeof c.reason !== 'string' || !c.reason.trim()) throw Error(`invalid judgment: ${g.name}`);
  }
  if ((s.judgments || []).some((j) => j.agent_id === agent)) throw Error('judge already recorded');
  s.judgments = [...(s.judgments || []), { at: new Date().toISOString(), agent_id: agent, model: MODEL, packet: p, checks: result.checks }];
  write(f, s);
  console.log(JSON.stringify({ id: s.id, checks: expectedChecks(s), judgment: result.checks }));
}
export function verdict(s) {
  if (s.host !== HOST || s.model !== MODEL || s.effort !== EFFORT || !s.agent_id) return 'incomplete';
  if (s.status !== 'completed') return 'incomplete';
  if (HOST === 'codex-cli' && ((s.cli_turns || []).length !== s.transcript.filter((t) => t.role === 'agent').length || !(s.cli_turns || []).every((t) => (s.agent_sessions || [s.agent_id]).includes(t.session) && t.completed_at && t.cli_version))) return 'incomplete';
  if (s.subject !== subject(s.kind, s.item)) return 'stale';
  if (!response(s).trim()) return 'incomplete';
  const checks = expectedChecks(s);
  if (!checks.length) return 'incomplete';
  if (s.kind === 'interview' && (s.transcript.filter((t) => t.role === 'agent').length !== s.max_turns || s.snapshots.length !== s.max_turns)) return 'incomplete';
  if (checks.some((c) => !c.passed)) return 'fail';
  const llm = rubrics(s).filter((g) => g.type === 'llm');
  if (llm.length) {
    const js = (s.judgments || []).filter((j) => !(s.agent_sessions || [s.agent_id]).includes(j.agent_id) && j.model === MODEL && j.packet.subject === s.subject && j.packet.response_sha256 === hash(response(s)) && JSON.stringify(j.packet.criteria) === JSON.stringify(llm));
    const count = s.kind === 'pipeline' ? 3 : 1;
    if (new Set(js.map((j) => j.agent_id)).size < count) return 'ungraded';
    for (const g of llm) if (js.slice(-count).filter((j) => j.checks.find((c) => c.name === g.name)?.passed === true).length <= count / 2) return 'fail';
  }
  return 'pass';
}
export function report(release, quiet = false) {
  const rows = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => json(path.join(DIR, f))).filter((s) => s.schema === 'cp-astra-evidence/1') : [];
  const cases = fs.readdirSync(path.join(ROOT, 'evals'), { withFileTypes: true }).filter((e) => e.isDirectory() && !['ledger', 'scripts-pipeline'].includes(e.name)).map((e) => e.name);
  const queries = json(path.join(ROOT, 'evals/trigger-set.json')).queries.map((q) => q.id);
  const personas = fs.readdirSync(path.join(ROOT, 'tests/live/personas')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  const groups = [['case', cases, 3], ['pipeline', ['scripts-pipeline'], 2], ['trigger', queries, 3], ['interview', personas, 1]];
  const items = groups.flatMap(([kind, names, runs]) => names.sort().map((item) => {
    const current = rows.filter((s) => s.kind === kind && s.item === item && s.subject === subject(kind, item));
    const attempts = Array.from({ length: runs }, (_, i) => {
      const row = current.filter((s) => s.run === i + 1).sort((a, b) => b.at.localeCompare(a.at))[0];
      return { run: i + 1, id: row?.id || null, state: row ? verdict(row) : 'missing' };
    });
    return { kind, item, passing: attempts.every((r) => r.state === 'pass'), attempts };
  }));
  const result = { schema: 'cp-astra-progress/1', model: MODEL, host: HOST, effort: EFFORT, passing: items.filter((i) => i.passing).length, total: items.length, items };
  if (!quiet) console.log(JSON.stringify(result, null, 2));
  if (release && result.passing !== result.total) process.exitCode = 1;
  return result;
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'packet') packet(...args);
  else if (cmd === 'record') record(...args);
  else if (cmd === 'report') report(args.includes('--release'));
  else throw Error('expected packet/record/report');
}
