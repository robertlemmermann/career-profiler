import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classify, childEnv, codexArgs, redact } from '../lib/codex-runner.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
test('only a successful terminal event completes a CLI turn', () => {
  assert.equal(classify({ code: 0, events: [] }).state, 'blocked-infrastructure');
  assert.equal(classify({ code: 0, events: [{ type: 'item.completed', item: { text: 'rate limit' } }, { type: 'turn.completed' }] }).state, 'completed');
  assert.equal(classify({ code: 1, events: [{ type: 'error', message: 'Usage limit reached; resets later' }] }).state, 'paused-quota');
  assert.equal(classify({ code: 1, events: [], stderr: '401 Unauthorized' }).state, 'blocked-auth');
  assert.equal(classify({ code: null, events: [], timedOut: true }).state, 'interrupted');
});
test('child environment excludes unrelated secrets and resume targets an exact session', () => {
  assert.deepEqual(childEnv({ PATH: '/bin', CODEX_HOME: '/private', AWS_SECRET_ACCESS_KEY: 'secret', GH_TOKEN: 'secret' }), { PATH: '/bin', CODEX_HOME: '/private' });
  const args = codexArgs({ model: 'gpt-6-astra', effort: 'high', session: 'specific-session', cwd: '/work' });
  assert.deepEqual(args.slice(0, 3), ['exec', 'resume', 'specific-session']);
  assert.ok(!args.includes('--last')); assert.ok(!args.includes('-s'));
  assert.ok(!redact('Bearer secret-value api_key=secret').includes('secret'));
});
test('queue recovers a reply saved before CLI failure, restores lost workspace and skips passes', { skip: process.platform === 'win32' }, () => {
  const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-codex-test-'));
  fs.mkdirSync(path.join(storage, 'work'));
  const temp = path.join(storage, 'alias');
  fs.symlinkSync(path.join(storage, 'work'), temp, 'dir'); // macOS also aliases /var to /private/var
  try {
    for (const dir of ['tests', 'skills', 'evals']) fs.cpSync(path.join(root, dir), path.join(temp, dir), { recursive: true, filter: (f) => !f.includes(`${path.sep}ledger${path.sep}`) && !f.endsWith(`${path.sep}ledger`) });
    const bin = path.join(temp, 'bin'); fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'codex'), `#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const args=process.argv.slice(2);
if(args[0]==='--version'){console.log('fake-codex-for-tests');process.exit(0);}
const prompt=fs.readFileSync(0,'utf8');
const emit=(e)=>console.log(JSON.stringify(e));
const resume=args[1]==='resume';
const session=resume?args[2]:'test-'+Date.now()+'-'+Math.random();
const lost=path.join(${JSON.stringify(temp)},'lost-session');
if(resume&&fs.existsSync(lost)){fs.unlinkSync(lost);emit({type:'error',message:'session not found'});process.exit(1);}
emit({type:'thread.started',thread_id:session});
const output=args.indexOf('-o');
if(output>=0){
 const data=JSON.parse(prompt.slice(prompt.indexOf('{')));
 fs.writeFileSync(args[output+1],JSON.stringify({checks:data.criteria.map(c=>({name:c.name,passed:true,reason:'Synthetic test judgment'}))}));
}else if(!prompt.includes('The bridge already saved')){
 const work=args.includes('-C')?args[args.indexOf('-C')+1]:process.cwd();
 const bridge=path.join(${JSON.stringify(temp)},'tests/astra-session.mjs');
 const env={...process.env,CP_EVAL_HOST:'codex-cli',CP_EVAL_MODEL:'gpt-6-astra',CP_EVAL_EFFORT:'high'};
 spawnSync(process.execPath,[bridge,'read',work,'SKILL.md'],{env});
 fs.writeFileSync(path.join(work,'reply.txt'),'In guidance-only mode, please paste the job posting before I tailor a resume.');
 const r=spawnSync(process.execPath,[bridge,'reply',work,path.join(work,'reply.txt')],{env,encoding:'utf8'});
 if(r.status!==0)throw Error(r.stderr);
 const marker=path.join(${JSON.stringify(temp)},'interrupted-once');
 if(!fs.existsSync(marker)){fs.writeFileSync(marker,'yes');emit({type:'error',message:'Usage limit reached'});process.exit(1);}
}
emit({type:'turn.completed',usage:{input_tokens:10,output_tokens:5}});
`, { mode: 0o755 });
    const run = (...extra) => spawnSync(process.execPath, ['tests/run-gpt-evals.mjs', '--only', 'case/resume-without-posting', ...extra], { cwd: temp, env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` }, encoding: 'utf8', timeout: 60000 });
    let r = run(); assert.equal(r.status, 4, r.stderr + r.stdout);
    const dir = path.join(temp, 'evals/ledger/codex/gpt-6-astra/high');
    const statePath = path.join(dir, 'runner/state.json');
    const state = JSON.parse(fs.readFileSync(statePath)); assert.equal(state.status, 'paused-quota');
    const evidence = path.join(dir, state.current.id + '.json');
    const saved = JSON.parse(fs.readFileSync(evidence));
    assert.equal(saved.transcript.filter(t=>t.role==='agent').length, 1, r.stdout + r.stderr + fs.readFileSync(path.join(dir, 'logs', saved.id + '-agent.jsonl'), 'utf8'));
    fs.rmSync(saved.workspace, { recursive: true, force: true });
    state.next_retry_at = null; fs.writeFileSync(statePath, JSON.stringify(state));
    fs.writeFileSync(path.join(temp, 'lost-session'), 'yes');
    r = run(); assert.equal(r.status, 1, r.stderr + r.stdout); // selected item passes; full suite still incomplete
    const progress = JSON.parse(fs.readFileSync(path.join(dir, 'STATUS.json')));
    assert.equal(progress.passing, 1, r.stderr + r.stdout + JSON.stringify(progress.items.find(x=>x.item==='resume-without-posting')));
    const recovered = JSON.parse(fs.readFileSync(evidence));
    assert.equal(recovered.transcript.filter(t=>t.role==='agent').length, 1);
    assert.equal(recovered.cli_turns.length, 1);
    assert.equal(recovered.agent_sessions.length, 2);
    assert.notEqual(recovered.agent_id, saved.agent_id);
    const before = fs.readdirSync(dir).filter(f=>f.startsWith('cp-astra-')).length;
    r = run(); assert.equal(r.status, 1, r.stderr + r.stdout);
    assert.equal(fs.readdirSync(dir).filter(f=>f.startsWith('cp-astra-')).length, before);
    const interview = run('--only', 'interview/icu-nurse', '--max-attempts', '1');
    assert.equal(interview.status, 1, interview.stderr + interview.stdout);
    const interviewRow = fs.readdirSync(dir).filter(f=>f.startsWith('cp-astra-')).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f)))).find(s=>s.kind==='interview');
    assert.equal(interviewRow.cli_turns.length, interviewRow.max_turns);
    assert.equal(interviewRow.snapshots.length, interviewRow.max_turns);
    assert.match(interviewRow.initial_prompt, /Submit exactly one reply/);
    assert.ok(interviewRow.checks.some(c=>!c.ok)); // fake answers must not fabricate a passing interview
    // The same transport record cannot count as a Work-host result.
    assert.equal(recovered.host, 'codex-cli');
    for (const f of fs.readdirSync(dir).filter(f=>f.startsWith('cp-astra-'))) fs.rmSync(JSON.parse(fs.readFileSync(path.join(dir,f))).workspace,{recursive:true,force:true});
  } finally { fs.rmSync(storage, { recursive: true, force: true }); }
});
