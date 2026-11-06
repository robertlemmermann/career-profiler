// career-profiler: single CLI entry point. Zero dependencies; always launched as
// `node <skill>/scripts/cp.mjs <command> [subcommand] [options]`.
// This file stays parseable by old Node versions: the version guard runs before any import.

const MIN_NODE = 22;
const major = Number(String(process.versions.node).split('.')[0]);
if (!(major >= MIN_NODE)) {
  process.stderr.write(`career-profiler: Node.js ${MIN_NODE}+ is required (found ${process.versions.node}). Scripts are unavailable; follow the playbooks in references/ by hand (guidance-only mode).\n`);
  process.exit(3);
}

const HELP = [
  'usage: node <skill>/scripts/cp.mjs <command> [subcommand] [options]',
  '',
  'Step 0, the automation preference (nothing else runs until it is recorded):',
  '  gate [check] | options | show | probe      state: ok, missing, corrupt or degraded',
  '  gate record --automation off|alert|draft|prepare --statement "<the user\'s words>" --confirm',
  '',
  'Fact store:',
  '  store init [--name N] [--force]          create the store (default ~/.career-profiler)',
  '  store path | show [--tier restricted] | validate | changelog | backup | accept --confirm',
  '  store export [--format md|json] [--out F] [--include restricted:<field> --confirm] | import <profile.json> --confirm',
  '  store sync [--message M] | store sync init [--remote URL]',
  '  fact stage <section> --data \'{...}\' [--parent exp-01] [--quote "..."]   then show it, then',
  '  fact commit <T-id> --confirm             write staged facts the user confirmed',
  '  fact add <section> --data ... --confirm | --unconfirmed [--parent id] [--quote "..."] [--tier t]',
  '  fact update <id> --data \'{...}\' --confirm | fact remove <id> --confirm | fact confirm <id> [--no] --confirm',
  '  fact list [section] | fact staged | fact unstage <T-id> | fact get <id>',
  '',
  'Interview:',
  '  interview coverage                       completeness score and every gap',
  '  interview next [--max 3] [--focus exp-01] the next questions to ask',
  '  interview done <key>...                   record "asked, nothing to add"',
  '',
  'Applications:',
  '  job parse <file|url|-> [--title T] [--company C] [--out job.json]',
  '  match <job.json> [--out match.json]       gap analysis against the profile (at most 5 questions)',
  '  app new <job.json> [--layout standard|credentials-first]',
  '  app list',
  '  resume draft --job J [--match M] [--out resume.md] [--layout L]',
  '  resume check <resume.md> [--job J] [--match M] [--report F] [--include restricted:<field> --confirm]',
  '  resume finalize <resume.md> [--formats md,txt,html,json,docx] [--include restricted:<field> --confirm]',
  '  cover-letter draft | check | finalize     same shape as resume',
  '  pii scan <file|-> [--profile resume|cover|answers|export|board|log] | pii policy',
  '',
  'Job sources (per the recorded preference; nothing is ever submitted):',
  '  watch sources                             the catalog, with what is refused and why',
  '  watch add --source <family> [--board B|--url U|--query Q [--country us]|--path P] [--mode inherit|alert|draft|prepare, never above the preference] [--min-fit 0.6]',
  '  watch list | remove <S-id> | poll [--only S-id] [--force] [--dry-run] [--fixture F] | run | inbox [--ack I-id --note N] | schedule --show [--every 6]',
  '',
  'Other:',
  '  doctor [--repair]                         environment, store, gate, integrity; --repair fixes and logs',
  '  help | --version',
  '',
  'Global options: --json --store <dir> --cwd <dir> --dry-run --yes. Exit codes: 0 ok, 1 findings (also',
  'gate_required), 2 usage, 3 environment missing, 4 could not verify. CAREER_PROFILER_HOME relocates the store.',
].join('\n');

const argv = process.argv.slice(2);
const wantsJson = argv.includes('--json');
const command = argv[0];

async function main() {
  const core = await import('./lib/core.mjs');
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    const { finish, SCRIPTS_DIR } = core;
    return finish({ result: { usage: HELP, script: `${SCRIPTS_DIR}/cp.mjs`, version: core.skillVersion() }, human: `${HELP}\n\nscript: ${SCRIPTS_DIR}/cp.mjs\nversion: ${core.skillVersion()}` }, { json: wantsJson });
  }
  if (command === '--version' || command === 'version') return core.finish({ result: { version: core.skillVersion() }, human: core.skillVersion() }, { json: wantsJson });
  const { commands } = await import('./lib/commands.mjs');
  const handler = commands[command];
  if (!handler) throw core.usageError(`unknown command "${command}"\n${HELP}`);
  const res = await handler(argv.slice(1));
  core.finish(res, { json: wantsJson });
}

main().catch(async (err) => {
  const core = await import('./lib/core.mjs');
  core.reportError(err, { json: wantsJson });
});
