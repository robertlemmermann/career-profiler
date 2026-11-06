// Work-mode transport for fresh GPT-6 Astra validation threads. No API credentials or Claude calls.
// prepare <kind> <item> <run>; read <workspace> <skill-relative-path>;
// reply <workspace> <text-file>; bind <workspace> <agent-id>; grade <workspace> <grade-file>;
// status. The coordinator alone uses prepare/bind/grade/status.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { candidateReply } from './lib/interview-candidate.mjs';
import { gradeInterview } from './lib/interview-grade.mjs';
import { checkpoint, restoreCheckpoint } from './lib/astra-checkpoint.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
import { DIR as EVIDENCE, MODEL, HOST, EFFORT, BRIDGE_ENV } from './lib/eval-profile.mjs';
const read = (f) => fs.readFileSync(f, 'utf8');
const json = (f) => JSON.parse(read(f));
const hash = (x) => createHash('sha256').update(x).digest('hex');
const write = (f, x) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const tmp = `${f}.${randomUUID()}.tmp`; fs.writeFileSync(tmp, JSON.stringify(x, null, 2) + '\n'); fs.renameSync(tmp, f); };
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const body = (s) => s.replace(/^---\r?\n[\s\S]*?\r?\n---\s*/, '');

export function subject(kind, item) {
  const paths = ['skills/career-profiler', 'tests/astra-session.mjs', 'tests/lib/interview-candidate.mjs', 'tests/lib/interview-grade.mjs', 'tests/lib/astra-checkpoint.mjs', 'tests/lib/eval-profile.mjs'];
  if (HOST === 'codex-cli') paths.push('tests/lib/codex-runner.mjs', 'tests/run-gpt-evals.mjs', 'tests/astra-evidence.mjs');
  paths.push(kind === 'case' ? `evals/${item}` : kind === 'trigger' ? 'evals/trigger-set.json' : kind === 'interview' ? `tests/live/personas/${item}.json` : 'evals/scripts-pipeline');
  const files = paths.flatMap((p) => fs.statSync(path.join(ROOT, p)).isDirectory() ? walk(path.join(ROOT, p)) : [path.join(ROOT, p)]).filter((p) => !p.endsWith('/references/release.md')).sort();
  return hash(files.map((f) => `${path.relative(ROOT, f)}\0${hash(read(f))}`).join('\n'));
}
function statePath(work) { return path.join(EVIDENCE, `${path.basename(work)}.json`); }
function load(work) { const s = json(statePath(work)); if (s.workspace !== work) throw Error('workspace mismatch'); return s; }
function save(s) { write(statePath(s.workspace), s); }
const checkpointPath = (work) => path.join(EVIDENCE, 'checkpoints', `${path.basename(work)}.json`);
function instrument(work) {
  const cli = path.join(work, 'skill/scripts/cp.mjs');
  const original = read(cli);
  const prefix = `import fsAstraTrace from 'node:fs';\nimport { checkpoint as checkpointAstra } from ${JSON.stringify(path.join(ROOT, 'tests/lib/astra-checkpoint.mjs'))};\nfsAstraTrace.appendFileSync(${JSON.stringify(path.join(work, 'commands.jsonl'))}, JSON.stringify({at:new Date().toISOString(),argv:process.argv.slice(2)})+'\\n');\nprocess.on('exit', () => checkpointAstra(${JSON.stringify(work)}, ${JSON.stringify(checkpointPath(work))}));\n`;
  fs.writeFileSync(cli, original.startsWith('#!') ? original.replace(/^(#![^\n]*\n)/, `$1${prefix}`) : prefix + original);
}
function cp(s, args) {
  const r = spawnSync(process.execPath, [path.join(s.workspace, 'skill/scripts/cp.mjs'), ...args, '--store', path.join(s.workspace, 'store'), '--json'], { encoding: 'utf8' });
  if (r.status !== 0) throw Error(`fixture command failed: ${r.stdout} ${r.stderr}`);
  return JSON.parse(r.stdout);
}
function catalog(s) {
  const source = read(path.join(s.workspace, 'skill/SKILL.md'));
  const fm = /^---\n([\s\S]*?)\n---/.exec(source)[1];
  return `Available optional skill: career-profiler\n${fm.match(/description: >-?\n([\s\S]*?)(?=\n\S)/)[1].trim()}\nTo consult it, use the read bridge below. Select skills by relevance to the user's task.`;
}
export function prepare(kind, item, run) {
  if (!['case', 'trigger', 'interview', 'pipeline'].includes(kind)) throw Error('invalid kind');
  const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cp-astra-')));
  fs.cpSync(path.join(ROOT, 'skills/career-profiler'), path.join(work, 'skill'), { recursive: true });
  const s = { schema: 'cp-astra-evidence/1', id: path.basename(work), at: new Date().toISOString(), host: HOST, model: MODEL, effort: EFFORT, kind, item, run: Number(run), subject: subject(kind, item), workspace: work, agent_id: null, reads: [], transcript: [], snapshots: [], used: [], status: 'pending', grade: null, cost_usd: null };
  const bridge = path.join(ROOT, 'tests/astra-session.mjs');
  let request;
  if (kind === 'interview') {
    const persona = json(path.join(ROOT, 'tests/live/personas', `${item}.json`));
    s.max_turns = persona.turns || 16;
    request = `Use the career-profiler skill to build my career profile. Interview me; I will answer. Save what I confirm as you go. If you need to know how automated I want job searching to be: only alert me, never apply for me. Scripts: ${work}/skill/scripts/cp.mjs; the store is at ${work}/store. Pass --store ${work}/store on every command.`;
  } else if (kind === 'pipeline') {
    cp(s, ['store', 'init']);
    cp(s, ['gate', 'record', '--automation', 'draft', '--statement', 'Draft things for me to review; never send anything on my behalf.', '--confirm']);
    cp(s, ['store', 'import', path.join(ROOT, 'evals/scripts-pipeline/fixtures/profile.json'), '--confirm']);
    fs.copyFileSync(path.join(ROOT, 'evals/scripts-pipeline/fixtures/posting.txt'), path.join(work, 'posting.txt'));
    request = body(read(path.join(ROOT, 'evals/scripts-pipeline/prompt.md')));
  } else if (kind === 'case') request = body(read(path.join(ROOT, 'evals', item, 'prompt.md')));
  else request = json(path.join(ROOT, 'evals/trigger-set.json')).queries.find((q) => q.id === item)?.query;
  if (!request) throw Error('missing request');
  const infrastructure = `Workspace: ${work}. Use only this workspace and the supplied read/reply bridge. Do not browse other directories or inspect the bridge implementation.\nSkill reads: ${BRIDGE_ENV}node ${bridge} read ${work} SKILL.md (or a relative references/ or assets/ path). This logs the consulted document. Use the bridge for skill-document reads.\n${kind === 'case' || kind === 'trigger' ? 'The task environment supports document reads only: do not execute career-profiler scripts or create user artifacts. Shell tools may be used solely to call the read/reply bridge and write the response transport file.' : 'Run actual skill commands in this workspace. Do not invent user replies.'}\nWrite your exact user-facing response to ${work}/reply.txt, then call: ${BRIDGE_ENV}node ${bridge} reply ${work} ${work}/reply.txt. ${kind === 'interview' ? HOST === 'codex-cli' ? 'Submit exactly one reply and stop this invocation. The coordinator will deliver the next candidate message in the same session. Do not answer that next message yet. Do not read other session or persona files.' : 'The reply bridge is the user inbox: it returns the next user message. Continue answering those messages until it says complete. It stores your messages unchanged. Do not read any other session or persona files.' : 'Return the same response as your final message after submitting it.'}`;
  s.initial_prompt = `${infrastructure}\n\n${catalog(s)}\n\nUser request:\n${request}`;
  s.transcript.push({ role: 'user', text: request, turn: 0 });
  fs.writeFileSync(path.join(work, 'request.md'), s.initial_prompt);
  if (kind === 'pipeline' || kind === 'interview') instrument(work);
  save(s);
  checkpoint(work, checkpointPath(work));
  const result = { workspace: work, evidence: statePath(work), request: path.join(work, 'request.md') };
  if (HOST !== 'codex-cli') console.log(JSON.stringify(result));
  return result;
}
function reply(work, file) {
  const s = load(work);
  if (s.status !== 'pending') throw Error('session already complete');
  if (subject(s.kind, s.item) !== s.subject) throw Error('inputs changed during session');
  const text = read(file);
  if (!text.trim()) throw Error('empty response');
  const turn = s.transcript.filter((x) => x.role === 'agent').length + 1;
  s.transcript.push({ role: 'agent', text, turn });
  if (s.kind === 'interview') {
    const store = path.join(work, 'store');
    const changes = fs.existsSync(path.join(store, 'changelog.jsonl')) ? read(path.join(store, 'changelog.jsonl')).trim().split('\n').filter(Boolean).map(JSON.parse) : [];
    const adds = changes.filter((e) => ['add', 'update', 'remove', 'confirm'].includes(e.op) && (e.ids || []).some((id) => !/^fact-/.test(id))).length;
    const previous = s.snapshots.at(-1)?.adds || 0;
    const lastUser = [...s.transcript].reverse().find((x) => x.role === 'candidate');
    s.snapshots.push({ turn, adds, new_adds: adds - previous, candidate_said_yes: !!lastUser && /\b(yes|correct|right|exact|confirmed?)\b/i.test(lastUser.text), profile: fs.existsSync(path.join(store, 'profile.json')) ? json(path.join(store, 'profile.json')) : null, changelog: changes });
    if (turn < s.max_turns) {
      const persona = json(path.join(ROOT, 'tests/live/personas', `${s.item}.json`));
      const next = candidateReply(persona, text, s.used);
      s.used = next.used;
      const message = turn === s.max_turns - 1 ? "Let's stop here for today. What did we cover, and what is still missing?" : next.reply;
      s.transcript.push({ role: 'candidate', text: message, turn });
      save(s); checkpoint(work, checkpointPath(work)); console.log(JSON.stringify({ complete: false, user_message: message })); return;
    }
    s.checks = gradeInterview({ CP: path.join(work, 'skill/scripts/cp.mjs'), store, persona: json(path.join(ROOT, 'tests/live/personas', `${s.item}.json`)), transcript: s.transcript, addsPerTurn: s.snapshots });
  }
  s.status = 'completed';
  if (s.kind === 'pipeline') {
    s.commands = fs.existsSync(path.join(work, 'commands.jsonl')) ? read(path.join(work, 'commands.jsonl')).trim().split('\n').map(JSON.parse) : [];
    s.artifacts = Object.fromEntries(walk(path.join(work, 'store')).filter((f) => f.includes('/applications/') && /\.(md|txt|html|json)$/.test(f)).map((f) => [path.relative(work, f), read(f)]));
  }
  save(s); checkpoint(work, checkpointPath(work)); console.log(JSON.stringify({ complete: true }));
}
export function restore(work) {
  const s = load(work);
  if (s.status !== 'pending' && HOST !== 'codex-cli') throw Error('only pending sessions can resume');
  if (subject(s.kind, s.item) !== s.subject) throw Error('inputs changed: keep old evidence and start a fresh run');
  if (fs.existsSync(work)) throw Error('workspace exists; do not overwrite live work');
  if (!fs.existsSync(checkpointPath(work))) throw Error('no full checkpoint exists');
  fs.mkdirSync(work, { recursive: true });
  restoreCheckpoint(work, checkpointPath(work));
  fs.cpSync(path.join(ROOT, 'skills/career-profiler'), path.join(work, 'skill'), { recursive: true });
  if (s.kind === 'pipeline' || s.kind === 'interview') instrument(work);
  s.restores = [...(s.restores || []), { at: new Date().toISOString(), after_turn: s.transcript.filter((t) => t.role === 'agent').length }];
  save(s);
  fs.writeFileSync(path.join(work, 'request.md'), `${s.initial_prompt}\n\nRestored conversation (continue after the last candidate message, do not repeat completed writes; commands.jsonl records executed CLI calls):\n${s.transcript.map((t) => `${t.role}: ${t.text}`).join('\n\n')}`);
  console.log(JSON.stringify({ request: path.join(work, 'request.md') }));
}
function readSkill(work, rel) {
  const s = load(work);
  const skill = path.join(work, 'skill');
  const resolved = path.resolve(skill, rel);
  if (!resolved.startsWith(skill + path.sep) || !/\.(md|json)$/.test(resolved)) throw Error('only skill documents can be read');
  const text = read(resolved);
  s.reads.push({ path: rel, sha256: hash(text), at: new Date().toISOString() }); save(s); console.log(text);
}
function status() {
  const rows = fs.existsSync(EVIDENCE) ? fs.readdirSync(EVIDENCE).filter((f) => f.endsWith('.json')).map((f) => json(path.join(EVIDENCE, f))) : [];
  console.log(JSON.stringify(rows.map((s) => ({ id: s.id, kind: s.kind, item: s.item, run: s.run, status: s.status, current: s.subject === subject(s.kind, s.item), agent_id: s.agent_id, turns: s.transcript.filter((t) => t.role === 'agent').length, failures: s.checks?.filter((c) => !c.ok).map((c) => c.name), grade: s.grade })), null, 2));
}
const [cmd, ...args] = process.argv.slice(2);
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (cmd === 'prepare') prepare(...args);
  else if (cmd === 'read') readSkill(...args);
  else if (cmd === 'reply') reply(...args);
  else if (cmd === 'bind') { const s = load(args[0]); s.agent_id = args[1]; save(s); }
  else if (cmd === 'grade') { const s = load(args[0]); if (s.status !== 'completed') throw Error('cannot grade incomplete session'); s.grade = json(args[1]); save(s); }
  else if (cmd === 'status') status();
  else if (cmd === 'restore') restore(...args);
  else throw Error('expected prepare/read/reply/bind/grade/status');
}
