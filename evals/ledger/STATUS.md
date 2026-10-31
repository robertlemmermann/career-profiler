# Release progress

Updated 2026-10-31T19:54:40Z by `node tests/ledger-status.mjs`. An item counts when its newest graded run passed every run and what it tested (the skill, its runner, its own case, query set or persona) is unchanged since; refused runs (usage window) are not results.

**73 of 74 release items passing.** runner finished; set aside for triage: persona:senior-swe. Recorded spend in the ledger: $493.4. Last refusal: 2026-10-31T11:18:09.465Z.

## Eval cases (claude plugin eval, 3 runs each): 38/38 passing


## Shell pipeline (2 runs): 1/1 passing


## Trigger queries (3 runs each): 32/32 passing


## Simulated interviews (deterministic candidate): 2/3 passing

- senior-swe: FAIL (re-run or fix)

Items not listed under a heading are passing. The runner that works through this list is `tests/run-pending.sh`; it pushes this file after every item and before every pause.
