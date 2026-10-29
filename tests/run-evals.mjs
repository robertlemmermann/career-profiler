// Runs the skill's own `claude plugin eval` cases (paid: they bill the signed-in Claude account).
// `claude plugin eval` reads cases only from inside its target, and a bare skill folder is a valid
// target, but evals/ stays out of the shipped skill. So this copies the skill to the OS temp dir,
// puts evals/ inside the copy and evaluates that. Nothing is written to the repository.
//
//   node tests/run-evals.mjs [claude plugin eval options...]
//
// Defaults: --ablation none (so `tool_used: Skill` graders count), --threshold 1 (every grader
// must pass in every run), --judge-model sonnet, --max-cost-usd 15, --no-publish, --tag outcome --tag trigger (the shell case is excluded unless
// you pass --tag shell or --case scripts-pipeline with --scaffold and --allow-tools), results in a
// temp dir that is printed. Pass --case <glob>, --tag <tag>, --model, --judge-model, --runs through.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NAME = 'career-profiler';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const has = (flag) => args.some((a) => a === flag || a.startsWith(`${flag}=`));

const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cp-eval-')), NAME);
fs.cpSync(path.join(repo, 'skills', NAME), target, { recursive: true });
fs.cpSync(path.join(repo, 'evals'), path.join(target, 'evals'), { recursive: true });

const out = has('--output-dir') ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'cp-eval-results-'));
const evalArgs = ['plugin', 'eval', target, '--trust-plugin',
  ...(has('--ablation') ? [] : ['--ablation', 'none']),
  ...(has('--threshold') ? [] : ['--threshold', '1']),
  ...(has('--judge-model') ? [] : ['--judge-model', 'sonnet']),
  ...(has('--max-cost-usd') ? [] : ['--max-cost-usd', '15']),
  ...(has('--publish-report') || has('--no-publish') ? [] : ['--no-publish']),
  ...(has('--tag') || has('--case') ? [] : ['--tag', 'outcome', '--tag', 'trigger']),
  ...(out ? ['--output-dir', out] : []),
  ...args];
process.stderr.write(`run-evals: target ${target}${out ? `, results ${out}` : ''}\n`);
const env = { ...process.env };
delete env.CLAUDECODE; // a nested session marker would make the child refuse to start
const res = process.platform === 'win32'
  ? spawnSync(['claude', ...evalArgs].map((a) => `"${a.replace(/"/g, '""')}"`).join(' '), { stdio: 'inherit', shell: true, env })
  : spawnSync('claude', evalArgs, { stdio: 'inherit', env });
if (res.error) process.stderr.write(`run-evals: could not start claude: ${res.error.message}\n`);
process.exitCode = res.status ?? 1;
