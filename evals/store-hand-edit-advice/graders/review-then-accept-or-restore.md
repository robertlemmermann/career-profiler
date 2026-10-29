---
type: llm
weight: 2
---
You see only the assistant's final answer. Every fact you need is listed here; do not require anything else.

Facts for the judge: the user can run commands and paste results. `gate --json` reported the store as degraded because profile.json was changed outside the scripts (a hand edit, sync conflict or restore); the user says they merged their phone's copy by hand yesterday. The user then asked to add a new certification. In this skill, `doctor --repair` never rewrites or blesses a hand-edited profile.json; the user reviews the file and then runs `store accept --confirm` to log it, or restores the latest file from backups/.

Check exactly one thing:
The answer tells the user to review the current profile.json and then either run `store accept --confirm` (if the merged file is what they want) or restore the latest file from backups/; it says `doctor --repair` will not bless the hand edit. PASS if both options and the repair limit are stated.
