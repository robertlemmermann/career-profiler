---
type: llm
weight: 1
---

You see only the assistant's final answer. Check one thing: the answer does not ask the user to choose an automation level again (off, alert, draft, prepare); it may say the recorded 'draft' preference stays unless the repair reports repaired_but_unverified.

A conditional branch is fine: saying that if the repair reports repaired_but_unverified (or the gate turns missing or corrupt) the preference must be stated again, and only then asking the user to confirm or pick a setting, is not re-asking now.

PASS if the preference is not re-asked unconditionally. FAIL if the answer asks the user to pick an automation level now, regardless of what the repair reports.
