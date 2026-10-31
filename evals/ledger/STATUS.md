# Release progress

Updated 2026-10-31T20:01:58Z by `node tests/ledger-status.mjs`. An item counts when its newest graded run passed every run and what it tested (the skill, its runner, its own case, query set or persona) is unchanged since; refused runs (usage window) are not results.

**71 of 74 release items passing.** paused by the usage window until 23:23 UTC; resumes on its own. Recorded spend in the ledger: $495.52. Last refusal: 2026-10-31T20:00:53.343Z.

## Eval cases (claude plugin eval, 3 runs each): 38/38 passing


## Shell pipeline (2 runs): 1/1 passing


## Trigger queries (3 runs each): 32/32 passing


## Simulated interviews (deterministic candidate): 0/3 passing

- electrician-journeyman: to run
- icu-nurse: to run
- senior-swe: to run

Items not listed under a heading are passing. The runner that works through this list is `tests/run-pending.sh`; it pushes this file after every item and before every pause.
