# Release progress

Updated 2026-11-01T18:30:36Z by `node tests/ledger-status.mjs`. An item counts when its newest graded run passed every run and what it tested (the skill, its runner, its own case, query set or persona) is unchanged since; refused runs (usage window) are not results.

**39 of 74 release items passing.** queries pos-03,pos-04,pos-05,pos-06,pos-07,pos-08,pos-09,pos-10,pos-11,pos-12,neg-01,neg-02,neg-03,neg-04,neg-05,neg-06,neg-07,neg-08,neg-09,neg-10,neg-11,neg-12,pos-13,pos-14,pos-15,pos-16,neg-13,neg-14,neg-15,neg-16 failed twice; set aside for triage. Recorded spend in the ledger: $559.1. Last refusal: 2026-11-01T02:31:23.973Z.

## Eval cases (claude plugin eval, 3 runs each): 37/38 passing

- resume-without-posting: to run

## Shell pipeline (2 runs): 0/1 passing

- scripts-pipeline: FAIL (re-run or fix)

## Trigger queries (3 runs each): 2/32 passing

- pos-03: FAIL (re-run or fix)
- pos-04: FAIL (re-run or fix)
- pos-05: FAIL (re-run or fix)
- pos-06: FAIL (re-run or fix)
- pos-07: FAIL (re-run or fix)
- pos-08: FAIL (re-run or fix)
- pos-09: FAIL (re-run or fix)
- pos-10: FAIL (re-run or fix)
- pos-11: FAIL (re-run or fix)
- pos-12: FAIL (re-run or fix)
- neg-01: FAIL (re-run or fix)
- neg-02: FAIL (re-run or fix)
- neg-03: FAIL (re-run or fix)
- neg-04: FAIL (re-run or fix)
- neg-05: FAIL (re-run or fix)
- neg-06: FAIL (re-run or fix)
- neg-07: FAIL (re-run or fix)
- neg-08: FAIL (re-run or fix)
- neg-09: FAIL (re-run or fix)
- neg-10: FAIL (re-run or fix)
- neg-11: FAIL (re-run or fix)
- neg-12: FAIL (re-run or fix)
- pos-13: FAIL (re-run or fix)
- pos-14: FAIL (re-run or fix)
- pos-15: FAIL (re-run or fix)
- pos-16: FAIL (re-run or fix)
- neg-13: FAIL (re-run or fix)
- neg-14: FAIL (re-run or fix)
- neg-15: FAIL (re-run or fix)
- neg-16: FAIL (re-run or fix)

## Simulated interviews (deterministic candidate): 0/3 passing

- electrician-journeyman: to run
- icu-nurse: to run
- senior-swe: to run

Items not listed under a heading are passing. The runner that works through this list is `tests/run-pending.sh`; it pushes this file after every item and before every pause.
