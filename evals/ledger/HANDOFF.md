# Live evals: handoff

**Accepted result: 73 of 74 release items** on commit `0e7dc9a`: 38/38 eval cases, 32/32 trigger
queries, 3/3 simulated interviews. The shell pipeline (`scripts-pipeline`) passed one of its two
runs: the other run's first shell line was a compound `cd; export; node` the locked-down host
refused. The skill fix for that (`b199182`, one plain `node` call per script) was re-run on 22 of
74 items, all passing, before the run was stopped by decision. Nothing is running.

To finish the re-verification of `b199182`, run `bash tests/run-pending.sh claude-opus-5-5
claude-sonnet-5-5`; it runs only what has no passing, current row.

## What runs these

The cases test the skill **inside Claude Code**, so every runner drives the `claude` CLI. A ChatGPT
or Codex session can operate these scripts, but the agent under test must be Claude Code:

- `claude plugin eval` (the cases), `tests/live/pipeline-sim.mjs` and `tests/live/interview-sim.mjs`
  need a signed-in `claude` CLI.
- `node tests/run-trigger-set.mjs --host codex` measures triggering on Codex, which is a separate host
  column, not the Claude release gate.

## Commands

Run everything still missing, one item at a time, pushing `STATUS.md` after each item:

```bash
bash tests/run-pending.sh claude-opus-5-5 claude-sonnet-5-5
```

Or run the pieces by hand:

```bash
node tests/run-evals.mjs --case resume-without-posting --model claude-opus-5-5 --judge-model claude-sonnet-5-5 -j 3
node tests/live/pipeline-sim.mjs --model claude-opus-5-5 --judge-model claude-sonnet-5-5
node tests/run-trigger-set.mjs --runs 3 --model claude-opus-5-5
node tests/live/interview-sim.mjs --persona icu-nurse --sim deterministic --model claude-opus-5-5
node tests/live/interview-sim.mjs --persona electrician-journeyman --sim deterministic --model claude-opus-5-5
node tests/live/interview-sim.mjs --persona senior-swe --sim deterministic --turns 20 --model claude-opus-5-5
node tests/ledger-status.mjs          # progress
node tests/ledger-triage.mjs          # failing rows that still need a class
node tests/selftest.mjs --release     # the release gate
```

Every runner appends to `ledger.jsonl`; commit it after each run.

## Rules that matter

- A row counts while what it tested is unchanged: the skill, its runner, and its own case, query set or
  persona. A skill edit re-runs everything; a rubric edit re-runs only that case.
- Classify every failing row before fixing anything: `skill`, `grader`, `fixture`, `host-flake` or
  `model-drift` (`tests/ledger-triage.mjs --match ... --class ... --note ...`). Never lower a rubric's bar.
- In a container that runs as root, `claude plugin eval` mounts the workspace read-only, so the
  shell case is run by `pipeline-sim.mjs` instead.
- Keep the agent and judge models pinned for the whole set.
