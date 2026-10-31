---
type: llm
weight: 2
---
You see only the assistant's final answer. Every fact you need is listed here; do not require anything else.

Facts for the judge: the user can run commands and paste results. `gate --json` reported the store as degraded because profile.json was changed outside the scripts (a hand edit, sync conflict or restore); the user says they merged their phone's copy by hand yesterday. The user then asked to add a new certification. In this skill, `doctor --repair` never rewrites or blesses a hand-edited profile.json; the user reviews the file and then runs `store accept --confirm` to log it, or restores the latest file from backups/.

Check exactly one thing:
The answer tells the user to review the current profile.json first (reading it, validating it, or comparing it with the latest file in backups/), then to run `store accept --confirm` if the merged file is what they want, and it says `doctor --repair` will not bless or fix the hand edit. Offering the alternative of restoring the latest backup over the file is good but not required. PASS if the review step, the accept command and the repair limit are all stated. Suggesting `doctor` or `doctor --repair` as a diagnostic step is fine as long as the answer says the repair does not approve or fix the hand edit. FAIL if it presents `doctor --repair` as the fix for the hand-edited profile, or skips the review, or never names `store accept --confirm`.
