# Release progress

Updated 2026-11-02T12:58:55Z by `node tests/ledger-status.mjs`. An item counts when its newest graded run passed every run and what it tested (the skill, its runner, its own case, query set or persona) is unchanged since.

**71 of 74 release items passing.** runner started. Recorded spend in the ledger: $591.11.

## Eval cases (claude plugin eval, 3 runs each): 38/38 passing


## Shell pipeline (2 runs): 1/1 passing


## Trigger queries (3 runs each): 32/32 passing


## Simulated interviews (deterministic candidate): 0/3 passing

- electrician-journeyman: FAIL (re-run or fix)
- icu-nurse: to run
- senior-swe: to run

Items not listed under a heading are passing. The runner that works through this list is `tests/run-pending.sh`; it pushes this file after every item.
