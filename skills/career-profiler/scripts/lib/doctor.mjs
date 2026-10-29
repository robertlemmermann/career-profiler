// `doctor`: the environment, the store, the gate and the integrity of the storing process, in one
// report; `--repair` fixes what a script can fix and records every repair in the changelog.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SKILL_DIR, IS_WINDOWS, exists, skillVersion, nowIso, readText, sha256, tryJson, writeFileAtomic, STORE_VERSION } from './core.mjs';
import {
  resolveStore, storePaths, loadProfile, verifyChangelog, readChangelog, unconfirmedIds, gitInfo, conflictFiles, ensureDirs, STORE_DIRS,
  writeManifest, verifyManifest, readManifest, appendChangelog, quarantineFile, acceptProfile,
} from './store.mjs';
import { checkGate, probeStore } from './gate.mjs';
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

export function doctor({ store, cwd = process.cwd(), env = process.env, repair = false } = {}) {
  const items = [];
  const repairs = [];
  const push = (name, status, detail) => items.push({ name, status, detail });
  const major = Number(process.versions.node.split('.')[0]);
  push('node', major >= 22 ? 'ok' : 'old', `${process.versions.node}${major >= 22 ? '' : ' (22+ required; guidance-only mode otherwise)'}`);
  push('skill', 'ok', `${SKILL_DIR} (version ${skillVersion()}, store layout ${STORE_VERSION})`);
  push('host', 'ok', hostFromEnv(env));
  push('os', 'ok', `${process.platform} ${process.arch}`);
  const pandoc = pandocAvailable();
  push('pandoc', pandoc ? 'ok' : 'missing', pandoc || 'optional: .docx output; without it, print the .html to PDF');
  const { dir, source } = resolveStore({ store, cwd, env });
  const paths = storePaths(dir);
  push('store', exists(paths.profile) ? 'ok' : 'missing', `${paths.profile} (resolved from ${source})${exists(paths.profile) ? '' : '; run "store init"'}`);
  let profileSummary = null;
  let gate = null;
  if (exists(paths.profile)) {
    // Directories and permissions.
    const missingDirs = STORE_DIRS.filter((d) => !exists(path.join(dir, d)));
    if (missingDirs.length) { if (repair) { ensureDirs(paths); repairs.push(`recreated ${missingDirs.join(', ')}`); push('directories', 'repaired', missingDirs.join(', ')); } else push('directories', 'warn', `missing: ${missingDirs.join(', ')} (doctor --repair recreates them)`); } else push('directories', 'ok', 'all present');
    if (!IS_WINDOWS) {
      const bad = [];
      for (const f of [paths.profile, paths.preferences, paths.changelog]) { if (!exists(f)) continue; const mode = fs.statSync(f).mode & 0o777; if (mode & 0o077) bad.push(path.basename(f)); }
      const dmode = fs.statSync(dir).mode & 0o777;
      if (dmode & 0o077) bad.push('(directory)');
      if (bad.length) { if (repair) { for (const f of [paths.profile, paths.preferences, paths.changelog, paths.manifest]) if (exists(f)) fs.chmodSync(f, 0o600); fs.chmodSync(dir, 0o700); repairs.push(`permissions set to owner-only for ${bad.join(', ')}`); push('permissions', 'repaired', bad.join(', ')); } else push('permissions', 'warn', `readable by others: ${bad.join(', ')} (doctor --repair fixes)`); } else push('permissions', 'ok', 'owner-only');
    }
    // Store version.
    const m = readManifest(paths);
    if (m && typeof m.store_version === 'number' && m.store_version > STORE_VERSION) push('store-version', 'invalid', `store is layout ${m.store_version}, this skill knows ${STORE_VERSION}: update the skill`);
    else push('store-version', 'ok', `${m && m.store_version != null ? m.store_version : 'unrecorded (manifest missing)'}`);
    // Profile.
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
    // Changelog chain.
    const chain = verifyChangelog(paths);
    if (chain.ok) push('changelog', 'ok', `${chain.entries} entries, chain intact`);
    else if (repair && chain.problems.some((p) => /chain|hash mismatch/.test(p))) {
      const log = readChangelog(paths);
      let prev = null; let good = 0;
      for (const e of log) { const { hash, ...rest } = e; if (e.prev !== prev || sha256(JSON.stringify({ ...rest, hash: undefined })) !== hash) break; prev = hash; good += 1; }
      const tail = readText(paths.changelog).split(/\r?\n/).filter(Boolean);
      fs.mkdirSync(paths.quarantine, { recursive: true, mode: 0o700 });
      writeFileAtomic(path.join(paths.quarantine, `changelog.tail.${nowIso().replace(/[:.]/g, '-')}.jsonl`), `${tail.slice(good).join('\n')}\n`, { mode: 0o600 });
      writeFileAtomic(paths.changelog, good ? `${tail.slice(0, good).join('\n')}\n` : '', { mode: 0o600 });
      appendChangelog(paths, { op: 'repair', ids: [], before_sha: null, after_sha: null, note: `changelog chain truncated to ${good} valid entries; ${tail.length - good} quarantined` });
      repairs.push(`changelog chain repaired (${tail.length - good} entries quarantined)`);
      push('changelog', 'repaired', `${good} valid entries kept`);
    } else push('changelog', 'warn', chain.problems.join('; '));
    // Manifest.
    const mv = verifyManifest(paths);
    if (mv.ok) push('manifest', 'ok', 'every file matches');
    else if (repair) { writeManifest(paths); appendChangelog(paths, { op: 'repair', ids: [], before_sha: null, after_sha: null, note: `manifest rebuilt (${mv.missing_manifest ? 'was missing' : mv.drift.join(', ')})` }); writeManifest(paths); repairs.push('manifest rebuilt'); push('manifest', 'repaired', mv.missing_manifest ? 'was missing' : `drift: ${mv.drift.join(', ')}`); }
    else push('manifest', 'warn', mv.missing_manifest ? 'missing (doctor --repair writes it)' : `drift: ${mv.drift.join(', ')} (doctor --repair rebuilds it)`);
    // Write probe.
    const pr = probeStore(paths);
    push('write-probe', pr.ok ? 'ok' : 'invalid', pr.ok ? 'write, fsync, read back, verify, delete all passed' : `failed at ${pr.failed_step}: ${pr.error} (relocate the store with --store or CAREER_PROFILER_HOME)`);
    // Gate (reported, never quarantined by doctor).
    gate = checkGate(dir, { quarantine: false, probe: false });
    push('preference-gate', gate.state === 'ok' ? 'ok' : gate.state === 'degraded' ? 'warn' : 'missing', gate.state === 'ok' ? `${gate.record.automation} (recorded ${gate.record.recorded_at})` : `${gate.state}${gate.remake_reason ? `: ${gate.remake_reason}` : ''}${gate.detail ? ` (${gate.detail})` : ''}; ${gate.state === 'degraded' ? 'run doctor --repair, then gate' : 'the agent must ask for the automation preference and run gate record'}`);
    // Git and synced folders.
    const g = gitInfo(dir);
    if (g.repo && !g.dedicated) push('git', 'warn', `the store is inside the repository ${g.top}; keep personal data out of project repositories`);
    else if (g.repo) push('git', 'ok', `dedicated repository${g.remote ? `, origin ${g.remote.replace(/\/\/[^@]+@/, '//')}` : ', no remote'}`);
    else push('git', 'ok', 'not a git repository (sync disabled)');
    const cf = conflictFiles(dir);
    if (cf.length) push('sync-conflicts', 'warn', `conflict copies from a synced folder: ${cf.slice(0, 3).map((f) => path.basename(f)).join(', ')}; compare them with profile.json, then delete them`);
    if (repair) {
      const after = checkGate(dir, { quarantine: false, probe: true });
      push('after-repair', after.state === 'ok' ? 'ok' : 'warn', after.state === 'ok' ? `repaired and verified: ${repairs.length ? repairs.join('; ') : 'nothing needed repair'}` : `repaired_but_unverified: gate is ${after.state} (${after.detail || after.remake_reason}); the preference must be re-recorded`);
      gate = after;
    }
  }
  const gitv = spawnSync('git', ['--version'], { encoding: 'utf8' });
  push('git-binary', gitv.status === 0 ? 'ok' : 'missing', gitv.status === 0 ? gitv.stdout.trim() : 'optional: store sync');
  const problems = items.filter((i) => ['old', 'missing', 'invalid'].includes(i.status) && !['pandoc', 'git-binary', 'store'].includes(i.name));
  return { ok: problems.length === 0, store: { dir, source, exists: exists(paths.profile) }, gate: gate ? { state: gate.state, automation: gate.record ? gate.record.automation : null, remake_reason: gate.remake_reason } : null, profile: profileSummary, repairs, items };
}
