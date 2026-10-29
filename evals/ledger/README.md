# Eval results ledger

`ledger.jsonl` holds one row per case, trigger query or simulated persona per run, appended by
`tests/run-evals.mjs`, `tests/run-trigger-set.mjs` and `tests/live/interview-sim.mjs`. Rows are
never edited or deleted; a re-run after a fix is a new row with the same `item` and a newer
`at`. Fields:

| Field | Meaning |
|---|---|
| `at`, `git_sha`, `skill_version`, `claude_version` | when and against what |
| `runner` | `plugin-eval`, `trigger-set`, `interview-sim` |
| `host` | `claude`, `copilot`, `codex` |
| `model`, `judge_model` | pinned models used (`null` when the host's default was used) |
| `item` | the case name, the query id or the persona name |
| `run` | the run index within the invocation |
| `score`, `passed` | the run's score (0 to 1) and whether it passed the runner's rule |
| `graders` / `checks` | per-grader or per-check results |
| `cost_usd` | what the run cost when the host reports it |
| `sim` | for interview-sim: `deterministic` or `model` |
| `failure_class` | `null`, or one of `skill`, `grader`, `fixture`, `host-flake`, `model-drift`, set by hand after triage |
| `note` | free text |

The release rule (`references/release.md` §3): the newest rows for the release sha pass every
case, every query and every persona.
