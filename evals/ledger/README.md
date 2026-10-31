# Eval results ledger

`ledger.jsonl` holds one row per case, trigger query or simulated persona per run, appended by
`tests/run-evals.mjs`, `tests/run-trigger-set.mjs` and `tests/live/interview-sim.mjs`. Rows are
never edited or deleted; a re-run after a fix is a new row with the same `item` and a newer
`at`. Fields:

| Field | Meaning |
|---|---|
| `at`, `git_sha`, `skill_version`, `claude_version` | when and against what |
| `item_subject` | hash of exactly what the row tested: the skill, its runner, and its own case, query set or persona; the release gate counts a row only while that hash is unchanged, so a fix to one case re-runs only that case |
| `subject` | hash of the whole evaluated tree (informational): `skills/career-profiler/`, `evals/` (not the ledger), `tests/live/` and the two runners; the release gate matches rows by it, so committing rows does not orphan them |
| `runner` | `plugin-eval`, `trigger-set`, `interview-sim` |
| `host` | `claude`, `copilot`, `codex` |
| `model`, `judge_model` | pinned models used (`null` when the host's default was used) |
| `item` | the case name, the query id or the persona name |
| `run` | the run index within the invocation |
| `score`, `passed` | the run's score (0 to 1) and whether it passed the runner's rule |
| `graders` / `checks` | per-grader or per-check results |
| `cost_usd` | what the run cost when the host reports it |
| `sim` | for interview-sim: `deterministic` or `model` |
| `failure_class` | `null`, or one of `skill`, `grader`, `fixture`, `host-flake`, `model-drift`; set on a `triage` row, never on the result row |
| `note` | free text |

A failing result row is classified by hand with `node tests/ledger-triage.mjs --match <regex>
--class <class> --note "<why, and what was done>"`, which appends a row with `runner: "triage"`
and `refers_to: { runner, host, item, run, at }` pointing at the result row. `node
tests/ledger-triage.mjs` alone lists the failing rows that have no triage row yet; `selftest
--release` fails while any remain.

The release rule (`references/release.md` §3): the newest rows for the current subject pass every
case, every query and every persona.
