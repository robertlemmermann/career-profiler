---
type: llm
weight: 1
---
You see only the assistant's answer. The user's automation preference is already recorded (the prompt supplied a verified `preferences.json`), so the interview starts now. The skill's first topics for an empty profile are identity and contact details, an existing resume or LinkedIn export to import, and the most recent job (employer, exact title, start month).

Check: at least one question concerns identity or contact details, an existing resume or LinkedIn export, or the most recent job (employer, exact title, dates). A question that only re-asks the automation preference does not count.

PASS if at least one such interview question is asked. FAIL otherwise.
