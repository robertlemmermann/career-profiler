import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cp, seededStore, fixture, readFixture, tmpDir, loadProfileFixture } from './helpers.mjs';
import { parseListings, parseFeed, buildRequest, poll, scheduleSnippets, screeningAnswers } from '../../skills/career-profiler/scripts/lib/watch.mjs';
import { storePaths } from '../../skills/career-profiler/scripts/lib/store.mjs';
import { atsEndpoint, atsPostingText, fetchPosting } from '../../skills/career-profiler/scripts/lib/job.mjs';

const fixturesFile = (dir) => {
  const map = JSON.parse(readFixture('sources', 'fixture-map.json'));
  const out = {};
  for (const [k, v] of Object.entries(map)) out[k] = readFixture('sources', v.slice(1));
  const f = path.join(dir, 'fixtures.json');
  fs.writeFileSync(f, JSON.stringify(out));
  return f;
};

test('parsers: greenhouse, lever, ashby, rss', () => {
  assert.equal(parseListings({ source: 'greenhouse', board: 'acmeledger' }, readFixture('sources', 'greenhouse.json')).length, 2);
  const lever = parseListings({ source: 'lever', board: 'brightline' }, readFixture('sources', 'lever.json'));
  assert.equal(lever.length, 2);
  assert.ok(lever[0].text.includes('PostgreSQL and Redis'));
  const ashby = parseListings({ source: 'ashby', board: 'northstar' }, readFixture('sources', 'ashby.json'));
  assert.equal(ashby[0].title, 'Frontend Engineer II');
  const rss = parseFeed(readFixture('sources', 'jobs.rss'));
  assert.equal(rss.length, 2);
  assert.equal(rss[0].company, 'Lakeside Regional Medical Center');
  assert.ok(rss[0].text.includes('Wisconsin RN license'));
});

test('refused sources exit 1 with the alternative; unknown source is usage; keys reported', () => {
  const store = seededStore();
  for (const s of ['indeed', 'glassdoor', 'linkedin']) {
    const r = cp(['watch', 'add', '--source', s, '--query', 'react', '--json'], { store });
    assert.equal(r.status, 1, s);
    assert.equal(r.json.error.code, 'REFUSED_TOS_AUTOMATION');
    assert.match(r.json.error.message, /alert email|Adzuna|Greenhouse/i);
  }
  let r = cp(['watch', 'add', '--source', 'rss', '--url', 'https://www.indeed.com/rss?q=react', '--json'], { store });
  assert.equal(r.status, 1, 'refused hosts via url too');
  r = cp(['watch', 'add', '--source', 'monster', '--json'], { store });
  assert.equal(r.status, 2);
  r = cp(['watch', 'add', '--source', 'greenhouse', '--json'], { store });
  assert.equal(r.status, 2, 'board is required');
  r = cp(['watch', 'add', '--source', 'adzuna', '--query', 'react', '--country', 'us', '--json'], { store, env: { ADZUNA_APP_ID: '', ADZUNA_APP_KEY: '' } });
  assert.equal(r.status, 0);
  assert.match(r.json.key_missing, /ADZUNA/);
  r = cp(['watch', 'sources', '--json'], { store });
  assert.ok(r.json.refused.indeed && r.json.families.greenhouse);
});

test('automation off refuses watching', () => {
  const store = seededStore('senior-swe', { automation: 'off' });
  const r = cp(['watch', 'add', '--source', 'greenhouse', '--board', 'acmeledger', '--json'], { store });
  assert.equal(r.status, 2);
  assert.match(r.json.error.message, /"off"/);
});

test('poll: matches land in the inbox, draft mode writes application folders, dedupe on the second poll, rate limit', async () => {
  const store = seededStore('senior-swe', { automation: 'draft' });
  const work = tmpDir();
  for (const args of [['--source', 'greenhouse', '--board', 'acmeledger'], ['--source', 'lever', '--board', 'brightline'], ['--source', 'ashby', '--board', 'northstar'], ['--source', 'rss', '--url', 'https://jobs.example.org/feed.rss', '--mode', 'alert']]) {
    const r = cp(['watch', 'add', ...args, '--json'], { store });
    assert.equal(r.status, 0, r.stderr);
  }
  const fx = fixturesFile(work);
  let r = cp(['watch', 'poll', '--fixture', fx, '--json'], { store });
  assert.ok([0, 1].includes(r.status), r.stderr);
  const rep = r.json;
  assert.equal(rep.errors.length, 0, JSON.stringify(rep.errors));
  const titles = rep.inbox.map((i) => i.title);
  assert.ok(titles.some((t) => /Lead Frontend Engineer/.test(t)), titles.join(' | '));
  assert.ok(titles.some((t) => /Payments Platform/.test(t)));
  assert.ok(!titles.some((t) => /Accountant|Nurse|Pharmacy/.test(t)), 'non-matching listings never reach the inbox');
  const lead = rep.inbox.find((i) => /Lead Frontend/.test(i.title));
  assert.equal(lead.action, 'draft');
  assert.ok(lead.application && fs.existsSync(path.join(lead.application, 'resume.md')) && fs.existsSync(path.join(lead.application, 'resume.check.json')));
  assert.ok(fs.existsSync(path.join(storePaths(store).inbox, `${lead.id}.json`)));
  assert.ok(rep.notification.every((n) => Object.keys(n).every((k) => ['job.title', 'job.company', 'job.url', 'fit'].includes(k))), 'notifications carry only policy fields');
  // RSS subscription in alert mode: the ICU posting does not match a software profile anyway.
  r = cp(['watch', 'inbox', '--json'], { store });
  assert.ok(r.json.items.length >= 2);
  r = cp(['watch', 'poll', '--fixture', fx, '--json'], { store });
  assert.equal(r.json.new_matches, 0, 'everything was seen already');
  r = cp(['watch', 'poll', '--json'], { store });
  assert.ok(r.json.skipped.length >= 1, 'rate limit skips a live poll right after a fixture poll');
  r = cp(['watch', 'inbox', '--ack', lead.id, '--note', 'applied by hand', '--json'], { store });
  assert.equal(r.json.acknowledged.acknowledged, true);
  r = cp(['watch', 'list', '--json'], { store });
  assert.equal(r.json.subscriptions.length, 4);
  assert.ok(r.json.subscriptions[0].last_result.fetched === 2);
});

test('poll in alert mode drafts nothing; prepare mode writes cited screening answers without restricted facts', async () => {
  const storeA = seededStore('senior-swe', { automation: 'alert' });
  const work = tmpDir();
  cp(['watch', 'add', '--source', 'greenhouse', '--board', 'acmeledger', '--json'], { store: storeA });
  let r = cp(['watch', 'poll', '--fixture', fixturesFile(work), '--json'], { store: storeA });
  assert.ok(r.json.inbox.length >= 1);
  assert.equal(r.json.drafted.length, 0);
  const storeP = seededStore('electrician-journeyman', { automation: 'prepare' });
  cp(['watch', 'add', '--source', 'file', '--path', fixture('jobs'), '--query', 'electrician', '--json'], { store: storeP });
  r = cp(['watch', 'poll', '--json'], { store: storeP });
  assert.ok(r.json.inbox.length >= 1, JSON.stringify(r.json));
  const app = r.json.inbox[0].application;
  const answers = fs.readFileSync(path.join(app, 'answers.md'), 'utf8');
  assert.ok(answers.includes('<!-- fact:'));
  assert.ok(!answers.includes('US citizen') && !answers.includes('back condition'), 'restricted and never facts never appear');
  assert.ok(/Work authorization:\*\* ASK THE USER/.test(answers));
});

test('outbound requests carry query terms only; dry-run shows the redacted URL; a protected value is refused', async () => {
  const sub = { source: 'adzuna', query: 'electrician', country: 'us' };
  const req = buildRequest(sub, { ADZUNA_APP_ID: 'id123', ADZUNA_APP_KEY: 'secretkey' });
  assert.ok(req.url.includes('app_key=secretkey') && !req.redacted_url.includes('secretkey'));
  const store = seededStore('electrician-journeyman', { automation: 'alert' });
  cp(['watch', 'add', '--source', 'greenhouse', '--board', 'acme', '--json'], { store });
  let r = cp(['watch', 'poll', '--dry-run', '--json'], { store });
  assert.equal(r.json.subscriptions[0].request, 'https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true');
  const profile = loadProfileFixture('electrician-journeyman');
  const paths = storePaths(store);
  const subs = JSON.parse(fs.readFileSync(path.join(paths.watch, 'subscriptions.json'), 'utf8'));
  subs.subscriptions[0].board = 'acme-US-citizen';
  fs.writeFileSync(path.join(paths.watch, 'subscriptions.json'), JSON.stringify(subs));
  const rep = await poll(paths, profile, { automation: 'alert', fetchImpl: async () => ({ ok: true, text: async () => '{"jobs":[]}' }), force: true });
  assert.ok(rep.errors.some((e) => /protected value/.test(e.error)));
});

test('ATS endpoints and login-wall detection', async () => {
  assert.equal(atsEndpoint('https://boards.greenhouse.io/acmeledger/jobs/4011').api, 'https://boards-api.greenhouse.io/v1/boards/acmeledger/jobs/4011');
  assert.equal(atsEndpoint('https://jobs.lever.co/brightline/a1b2c3d4-0000-4000-8000-000000000001').family, 'lever');
  assert.equal(atsEndpoint('https://example.com/jobs/1'), null);
  const gh = JSON.parse(readFixture('sources', 'greenhouse.json')).jobs[0];
  assert.ok(atsPostingText('greenhouse', gh).includes('4+ years of React'));
  const wall = async () => ({ ok: true, status: 200, text: async () => '<html><body><h1>Sign in to view this job</h1><p>Please verify you are human.</p></body></html>' });
  await assert.rejects(fetchPosting('https://jobs.example.com/x', { fetchImpl: wall }), /login wall|paste/i);
  const blocked = async () => ({ ok: false, status: 403, text: async () => '' });
  await assert.rejects(fetchPosting('https://jobs.example.com/x', { fetchImpl: blocked }), /403/);
  await assert.rejects(fetchPosting('https://www.indeed.com/viewjob?jk=1', { fetchImpl: wall }), /forbids automated access/);
  const ats = async (url) => ({ ok: true, status: 200, text: async () => (url.includes('boards-api') ? JSON.stringify(gh) : '<html>irrelevant</html>') });
  const text = await fetchPosting('https://boards.greenhouse.io/acmeledger/jobs/4011', { fetchImpl: ats });
  assert.ok(text.includes('Lead Frontend Engineer'));
});

test('schedule snippets are printed, never installed', () => {
  const s = scheduleSnippets({ cp: '/x/cp.mjs', store: '/s', every: 4 });
  assert.ok(s.cron.startsWith('0 */4 * * *') && s.github_actions.includes("cron: '0 */4 * * *'") && /never edits/.test(s.note));
  const store = seededStore();
  const r = cp(['watch', 'schedule', '--show', '--json'], { store });
  assert.ok(r.json.cron && r.json.schtasks && r.json.launchd);
});
