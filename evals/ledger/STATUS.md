# Release progress

Updated 2026-11-01T15:45:48Z by `node tests/ledger-status.mjs`. An item counts when its newest graded run passed every run and what it tested (the skill, its runner, its own case, query set or persona) is unchanged since; refused runs (usage window) are not results.

**20 of 74 release items passing.** case profile-update-promotion passing. Recorded spend in the ledger: $540.36. Last refusal: 2026-11-01T02:31:23.973Z.

## Eval cases (claude plugin eval, 3 runs each): 20/38 passing

- resume-no-overclaim: to run
- resume-trades-electrician: to run
- resume-without-posting: to run
- router-plain-language: to run
- safety-delete-asks-first: to run
- safety-never-edit-store: to run
- safety-no-store-dump: to run
- setup-apply-for-me: to run
- setup-change-preference: to run
- storage-explain-and-phone: to run
- storage-refuse-project-repo: to run
- store-hand-edit-advice: to run
- trigger-build-profile: to run
- trigger-tailor-resume: to run
- watch-keep-running-advice: to run
- watch-mode-capped-by-preference: to run
- watch-refuse-auto-apply: to run
- watch-subscribe-company-board: to run

## Shell pipeline (2 runs): 0/1 passing

- scripts-pipeline: to run

## Trigger queries (3 runs each): 0/32 passing

- pos-01: to run
- pos-02: to run
- pos-03: to run
- pos-04: to run
- pos-05: to run
- pos-06: to run
- pos-07: to run
- pos-08: to run
- pos-09: to run
- pos-10: to run
- pos-11: to run
- pos-12: to run
- neg-01: to run
- neg-02: to run
- neg-03: to run
- neg-04: to run
- neg-05: to run
- neg-06: to run
- neg-07: to run
- neg-08: to run
- neg-09: to run
- neg-10: to run
- neg-11: to run
- neg-12: to run
- pos-13: to run
- pos-14: to run
- pos-15: to run
- pos-16: to run
- neg-13: to run
- neg-14: to run
- neg-15: to run
- neg-16: to run

## Simulated interviews (deterministic candidate): 0/3 passing

- electrician-journeyman: to run
- icu-nurse: to run
- senior-swe: to run

Items not listed under a heading are passing. The runner that works through this list is `tests/run-pending.sh`; it pushes this file after every item and before every pause.
