# Manual test matrix

Filled once per release tag. `node tests/selftest.mjs` and the paid runners cover what a Linux
container shows; this matrix covers what only a real host on a real OS shows: installation,
discovery, the model following the playbooks, the gate on a fresh profile. Rows are OS × host
× step; columns are version, result and date. `not run` is never `pass`.

## Steps

| Step | Do | Pass when |
|---|---|---|
| S1 install | Install with the README command for the host, then `node <cp> doctor`. | The host lists the skill; `doctor` resolves the store path and reports `preference-gate: missing` on a fresh profile. |
| S2 gate | Ask `/career-profiler profile` on the fresh profile. | The agent asks for the automation preference first, records it with `gate record ... --confirm`, and only then starts the interview. |
| S3 profile | Answer three turns of the interview. | Facts are staged, shown, committed on your yes; `store validate` is clean; nothing you did not say is in `profile.json`. |
| S4 resume | Paste a posting and ask for a resume. | `match` runs, gap questions are at most five, the draft is checked (`PASS` or `PASS-WITH-FINDINGS`), outputs exist, the cover letter is offered. |
| S5 watch | `/career-profiler watch add --source greenhouse --board <any public board>` then `watch poll`. | Listings are fetched, matches reach the inbox per the preference, `watch add --source indeed` is refused with the alternative. |
| S6 pii | Volunteer a date of birth during the interview; then export. | The agent says it is kept at tier never; `store export` does not contain it. |
| S7 repair | Edit `MANIFEST.json` by hand, then run any data command. | `gate` reports `degraded`; `doctor --repair` fixes it and logs the repair; the gate passes again. |

## Results

| OS / launch path | Host | Version | S1 | S2 | S3 | S4 | S5 | S6 | S7 | Date | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Ubuntu (bash) | Claude Code | | not run | not run | not run | not run | not run | not run | not run | | |
| Ubuntu (bash) | Copilot CLI | | not run | not run | not run | not run | not run | not run | not run | | |
| Ubuntu (bash) | Codex | | not run | not run | not run | not run | not run | not run | not run | | |
| macOS (zsh) | Claude Code | | not run | not run | not run | not run | not run | not run | not run | | |
| Windows 11 (PowerShell 7) | Claude Code | | not run | not run | not run | not run | not run | not run | not run | | |
| Windows 11 (PowerShell 7) | Copilot CLI | | not run | not run | not run | not run | not run | not run | not run | | |
| Claude Code on the web (private store repository) | Claude Code | | not run | not run | not run | not run | not run | not run | not run | | |
