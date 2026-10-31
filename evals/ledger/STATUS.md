# Release progress

Updated 2026-10-31T18:42:50Z by `node tests/ledger-status.mjs`. An item counts when its newest graded run passed every run and what it tested (the skill, its runner, its own case, query set or persona) is unchanged since; refused runs (usage window) are not results.

**67 of 74 release items passing.** case pii-posting-bait passing. Recorded spend in the ledger: $416.64. Last refusal: 2026-10-31T11:18:09.465Z.

## Eval cases (claude plugin eval, 3 runs each): 34/38 passing

- profile-confirm-before-write: FAIL (re-run or fix)
- profile-import-unconfirmed: FAIL (re-run or fix)
- resume-without-posting: FAIL (re-run or fix)
- watch-subscribe-company-board: to run

## Shell pipeline (2 runs): 1/1 passing


## Trigger queries (3 runs each): 32/32 passing


## Simulated interviews (deterministic candidate): 0/3 passing

- electrician-journeyman: to run
- icu-nurse: to run
- senior-swe: to run

Items not listed under a heading are passing. The runner that works through this list is `tests/run-pending.sh`; it pushes this file after every item and before every pause.
