import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cp, seededStore, fixture, tmpDir } from './helpers.mjs';

test('help, version and usage errors', () => {
  let r = cp(['help', '--json']);
  assert.equal(r.status, 0);
  assert.match(r.json.script, /cp\.mjs$/);
  assert.match(r.json.version, /^\d+\.\d+\.\d+$/);
  r = cp(['--version']);
  assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+$/);
  r = cp(['nonsense', '--json']);
  assert.equal(r.status, 2);
  r = cp(['store', 'init', '--bogus', '--json']);
  assert.equal(r.status, 2);
  r = cp(['fact', '--json'], { store: seededStore() });
  assert.equal(r.status, 2);
});

test('output is ASCII-only JSON with --json and never includes the error on stdout without it', () => {
  const store = seededStore();
  const r = cp(['fact', 'add', 'extras', '--data', JSON.stringify({ text: 'Café résumé — naïve' }), '--confirm', '--json'], { store });
  assert.equal(r.status, 0);
  assert.ok(/^[\x00-\x7f]*$/.test(r.stdout), 'ascii only');
  assert.ok(r.stdout.includes('\\u00e9'));
  const bad = cp(['fact', 'get', 'nope'], { store });
  assert.equal(bad.status, 2);
  assert.equal(bad.stdout, '');
  assert.match(bad.stderr, /no fact with id/);
});

test('the full application pipeline through the CLI', () => {
  const store = seededStore();
  const work = tmpDir();
  let r = cp(['job', 'parse', fixture('jobs', 'lead-react-engineer.txt'), '--out', 'job.json', '--json'], { store, cwd: work });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.json.company, 'Acme Ledger');
  r = cp(['job', 'parse', fixture('jobs', 'prose-only.txt'), '--title', 'Shift Lead', '--company', 'Rise Bakery', '--json'], { store, cwd: work });
  assert.equal(r.json.title, 'Shift Lead');
  assert.equal(r.json.slug, 'rise-bakery-shift-lead');
  r = cp(['match', 'job.json', '--out', 'match.json', '--json'], { store, cwd: work });
  assert.ok([0, 1].includes(r.status), 'exit 1 only means a must-have keyword is missing');
  assert.equal(r.json.schema, 'career-match/1');
  r = cp(['app', 'new', 'job.json', '--json'], { store, cwd: work });
  assert.equal(r.status, 0, r.stderr);
  const appDir = r.json.dir;
  for (const f of ['job.json', 'match.json', 'resume.md', 'cover-letter.md']) assert.ok(fs.existsSync(path.join(appDir, f)), f);
  r = cp(['app', 'list', '--json'], { store });
  assert.equal(r.json.applications.length, 1);
  r = cp(['resume', 'check', path.join(appDir, 'resume.md'), '--job', path.join(appDir, 'job.json'), '--match', path.join(appDir, 'match.json'), '--json'], { store, cwd: work });
  assert.equal(r.status, 0, r.stdout);
  assert.notEqual(r.json.verdict, 'FAIL');
  assert.ok(fs.existsSync(path.join(appDir, 'resume.check.json')));
  r = cp(['resume', 'finalize', path.join(appDir, 'resume.md'), '--job', path.join(appDir, 'job.json'), '--json'], { store, cwd: work });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(appDir, 'resume.html')));
  r = cp(['resume', 'check', fixture('resumes', 'fabricated.md'), '--job', 'job.json', '--report', path.join(work, 'bad.json'), '--json'], { store, cwd: work });
  assert.equal(r.status, 1);
  assert.equal(r.json.verdict, 'FAIL');
  r = cp(['resume', 'finalize', fixture('resumes', 'fabricated.md'), '--json'], { store, cwd: work });
  assert.equal(r.status, 2, 'finalize refuses a failing draft');
  r = cp(['cover-letter', 'check', fixture('resumes', 'good-cover-letter.md'), '--job', 'job.json', '--json'], { store, cwd: work });
  assert.equal(r.json.verdict, 'PASS');
  r = cp(['interview', 'next', '--max', '2', '--json'], { store });
  assert.equal(r.json.questions.length, 2);
  r = cp(['interview', 'done', 'volunteering.none', '--json'], { store });
  assert.ok(r.json.asked.includes('volunteering.none'));
  r = cp(['doctor', '--json'], { store });
  assert.equal(r.status, 0, r.stdout);
  assert.equal(r.json.profile.resume_ready, true);
  assert.ok(r.json.items.some((i) => i.name === 'unconfirmed-facts' && i.status === 'warn'));
});

test('job parse rejects empty input and an unreachable URL without hanging', () => {
  const store = seededStore();
  let r = cp(['job', 'parse', '-', '--json'], { store, input: '' });
  assert.equal(r.status, 4);
  r = cp(['job', 'parse', 'http://127.0.0.1:9/nothing', '--json'], { store });
  assert.equal(r.status, 4);
  assert.match(r.json.error.message, /paste the posting text/);
});
