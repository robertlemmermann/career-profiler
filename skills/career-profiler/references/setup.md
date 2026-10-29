# Setup: the automation preference

The first thing the skill does for a new user, and the first check in every session. Nothing
else runs until the record exists and verifies: the scripts refuse (`GATE_REQUIRED`), and the
playbooks say so. It takes one question.

## Contents

- [1. The four values](#1-the-four-values)
- [2. Recording it](#2-recording-it)
- [3. Missing, corrupt or degraded](#3-missing-corrupt-or-degraded)
- [4. Changing it later](#4-changing-it-later)
- [Without Node](#without-node)

## 1. The four values

Say them in plain words and say, in every case, that the skill never submits an application,
never solves a CAPTCHA, never logs in anywhere and never sends their data to a job board:

| Value | What the skill does with job sources |
|---|---|
| `off` | nothing automatic: profile and tailored applications on request only |
| `alert` | polls the sources they subscribe to and puts matches in the inbox; drafts only when asked |
| `draft` | polls and, for each match, drafts a cited resume and cover letter for their review |
| `prepare` | drafts, and also prepares cited answers to common screening questions; the user pastes what they choose |

`node "$CP" gate options --json` prints the same table. Ask: "Which of these do you want?
You can change it any time." Accept their answer in their words; if they say "apply for me",
explain that submission is refused in every mode (see [sources](sources.md) §3) and ask them to
choose among the four.

## 2. Recording it

```bash
node "$CP" gate record --automation draft --statement "Draft things for me to look at, but never send anything." --confirm --json
```

`--statement` is their own words (quoted back to them first), `--confirm` is your assertion
that they confirmed it in this conversation (`--yes` is not accepted). The record is written to
`preferences.json` with a hash, echoed into `changelog.jsonl` and `MANIFEST.json`, then
verified end to end. `gate --json` now prints `"state": "ok"` and every other mode is open.

Then continue with whatever the user originally asked for.

## 3. Missing, corrupt or degraded

`gate --json` reports one of:

- `missing`: no record yet (or no store: run `store init` first). Ask and record.
- `corrupt` with `remake_reason` (`parse`, `schema`, `enum`, `hash`, `journal`): the file did
  not verify; it was moved to `quarantine/`. Tell the user, show the quarantined statement
  only as a hint ("last time you said ..."), ask again and record a fresh statement. Never
  re-record the old value without their yes.
- `degraded` with `required_action: doctor --repair`: the storing process failed (manifest
  drift, a failed write probe, a store from a newer version). Run `node "$CP" doctor --repair
  --json`, read `repairs[]` and `after-repair`, tell the user in one line what was repaired, then
  run `gate` again. `repaired_but_unverified` means the preference itself must be re-recorded.

The gate also runs a write-fsync-read probe once a day; a failing probe flips the store to
`degraded` before any data write is attempted, so degradation is found at the next use.

## 4. Changing it later

"Only alert me from now on" is `setup` again: confirm, then `gate record` with the new value.
The previous record goes to `quarantine/` and the change is logged. Subscriptions with
`mode: inherit` follow the new value at the next poll.

## Without Node

Open `preferences.json`. It must contain `schema` `career-preferences/1`, `automation` one of
the four values, `submit` `never`, a non-empty `statement`, `recorded_at` and a `hash`. You
cannot verify the hash by hand: treat any doubt as corrupt, ask the user again, and write the
file with `"hash": "unverified-manual"`; the next session with Node will report it as corrupt
and re-record it with their confirmation. Write "guidance-only mode" in your reply.
