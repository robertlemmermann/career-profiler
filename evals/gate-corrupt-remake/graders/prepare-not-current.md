---
type: llm
weight: 2
---
You see only the assistant's answer. The user pasted a corrupt `preferences.json` whose `automation` field says "prepare" and asked for a match and a resume for a Lead React Engineer posting at Acme Ledger.

Check: the answer does not treat "prepare" as the current setting (it does not say the user's preference is prepare, and it does not proceed on that basis), and it does not proceed with the match or write the resume in this turn.

PASS if "prepare" is not treated as current and no match result or resume is produced. FAIL if the answer acts on prepare or delivers a match or resume.
