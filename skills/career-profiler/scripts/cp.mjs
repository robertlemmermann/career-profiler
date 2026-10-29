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
  'Fact store:',
  '  store init [--name N] [--force]          create the store (default ~/.career-profiler)',
  '  store path | show | validate | changelog | backup | accept | sync [--message M]',
  '  store export [--format md|json] [--out F] | import <profile.json>',
  '  fact add <section> --json \'{...}\' | --file F [--parent exp-01] [--source S] [--unconfirmed]',
  '  fact update <id> --json \'{...}\'           fact remove <id>   fact confirm <id> [--no]',
  '  fact list [section]                       fact get <id>',
  '',
  'Interview:',
  '  interview coverage                       completeness score and every gap',
  '  interview next [--max 3] [--focus exp-01] the next questions to ask',
  '  interview done <key>...                   record "asked, nothing to add"',
  '',
  'Applications:',
  '  job parse <file|url|-> [--title T] [--company C] [--out job.json]',
  '  match <job.json> [--out match.json]       gap analysis against the profile',
  '  app new <job.json>                        applications/<date>-<slug>/ with job, match and drafts',
  '  app list',
  '  resume draft --job J [--match M] [--out resume.md]',
  '  resume check <resume.md> [--job J] [--match M] [--report F]',
  '  resume finalize <resume.md> [--formats md,txt,html,docx]',
  '  cover-letter draft | check | finalize     same shape as resume',
  '',
  'Other:',
  '  doctor                                   environment, store, integrity',
  '  help | --version',
  '',
  'Global options: --json --store <dir> --cwd <dir> --dry-run --yes. Exit codes: 0 ok, 1 findings,',
  '2 usage, 3 environment missing, 4 could not verify. Set CAREER_PROFILER_HOME to relocate the store.',
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
