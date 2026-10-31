---
type: llm
weight: 1
---
You see only the assistant's answer. The user's prompt supplied a verified `preferences.json` (automation "draft", statement "Draft things for me to review; never send anything on my behalf."), so the automation preference is already recorded.

Check: the answer does not ask the user to choose an automation level (off, alerts only, drafts for review, prepared answers) again. Acknowledging the recorded preference in passing is fine.

PASS if the preference is not re-asked. FAIL if the answer asks the user to choose or confirm an automation level.
