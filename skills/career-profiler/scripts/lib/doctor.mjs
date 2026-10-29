// `doctor`: the environment, the store and its integrity, in one report.

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { SKILL_DIR, IS_WINDOWS, exists, skillVersion } from './core.mjs';
import { resolveStore, storePaths, loadProfile, verifyChangelog, unconfirmedIds, gitInfo } from './store.mjs';
import { pandocAvailable } from './resume.mjs';
import { coverage } from './interview.mjs';

const hostFromEnv = (env = process.env) => {
  if (env.CLAUDECODE || env.CLAUDE_CODE_ENTRYPOINT) return 'claude-code';
  if (env.COPILOT_AGENT_PROMPT || env.GITHUB_COPILOT_API_TOKEN) return 'copilot-cloud';
  if (env.COPILOT_CLI) return 'copilot-cli';
  if (env.CODEX_SANDBOX || env.CODEX_THREAD_ID) return 'codex';
  if (env.TERM_PROGRAM === 'vscode') return 'vscode';
  return 'unknown';
};

export function doctor({ store, cwd = process.cwd(), env = process.env } = {}) {
  const items = [];
  const push = (name, status, detail) => items.push({ name, status, detail });
  const major = Number(process.versions.node.split('.')[0]);
  push('node', major >= 22 ? 'ok' : 'old', `${process.versions.node}${major >= 22 ? '' : ' (22+ required; guidance-only mode otherwise)'}`);
  push('skill', 'ok', `${SKILL_DIR} (version ${skillVersion()})`);
  push('host', 'ok', hostFromEnv(env));
  push('os', 'ok', `${process.platform} ${process.arch}`);
  const pandoc = pandocAvailable();
  push('pandoc', pandoc ? 'ok' : 'missing', pandoc || 'optional: .docx output; without it, print the .html to PDF');
  const { dir, source } = resolveStore({ store, cwd, env });
  const paths = storePaths(dir);
  push('store', exists(paths.profile) ? 'ok' : 'missing', `${paths.profile} (resolved from ${source})${exists(paths.profile) ? '' : '; run "store init"'}`);
  let profileSummary = null;
  if (exists(paths.profile)) {
    try {
      const { profile, validation } = loadProfile(dir, { strict: false });
      push('profile', validation.ok ? 'ok' : 'invalid', validation.ok ? `valid, sequence ${profile.meta && profile.meta.sequence}, updated ${profile.meta && profile.meta.updated}` : validation.errors.slice(0, 3).map((e) => `${e.path}: ${e.message}`).join('; '));
      if (validation.warnings.length) push('profile-warnings', 'warn', validation.warnings.slice(0, 3).map((w) => `${w.path}: ${w.message}`).join('; '));
      const unc = unconfirmedIds(profile);
      push('unconfirmed-facts', unc.length ? 'warn' : 'ok', unc.length ? `${unc.length} unconfirmed (never used in a resume): ${unc.slice(0, 5).join(', ')}` : 'none');
      const cov = coverage(profile);
      profileSummary = { name: profile.identity && profile.identity.name, roles: (profile.experience || []).length, skills: (profile.skills || []).length, coverage: cov.score, resume_ready: cov.resume_ready };
      push('coverage', cov.resume_ready ? 'ok' : 'warn', `${cov.score}/100${cov.resume_ready ? ', resume-ready' : ', keep interviewing'}`);
    } catch (err) { push('profile', 'invalid', err.message); }
    const chain = verifyChangelog(paths);
    push('changelog', chain.ok ? 'ok' : 'warn', chain.ok ? `${chain.entries} entries, chain intact` : chain.problems.join('; '));
    if (!IS_WINDOWS) {
      try {
        const mode = fs.statSync(paths.profile).mode & 0o777;
        push('permissions', (mode & 0o077) === 0 ? 'ok' : 'warn', `profile.json mode ${mode.toString(8)}${(mode & 0o077) === 0 ? '' : ' (readable by others; chmod 600)'}`);
      } catch {}
    }
    const g = gitInfo(dir);
    if (g.repo && !g.dedicated) push('git', 'warn', `the store is inside the repository ${g.top}; keep personal data out of project repositories`);
    else if (g.repo) push('git', 'ok', `dedicated repository${g.remote ? `, origin ${g.remote.replace(/\/\/[^@]+@/, '//')}` : ', no remote'}`);
    else push('git', 'ok', 'not a git repository (sync disabled)');
  }
  const gitv = spawnSync('git', ['--version'], { encoding: 'utf8' });
  push('git-binary', gitv.status === 0 ? 'ok' : 'missing', gitv.status === 0 ? gitv.stdout.trim() : 'optional: store sync');
  const problems = items.filter((i) => ['old', 'missing', 'invalid'].includes(i.status) && !['pandoc', 'git-binary', 'store'].includes(i.name));
  return { ok: problems.length === 0, store: { dir, source, exists: exists(paths.profile) }, profile: profileSummary, items };
}
