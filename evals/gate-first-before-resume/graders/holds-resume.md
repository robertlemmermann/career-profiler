---
type: llm
weight: 1
---
You see only the assistant's answer. A new user with nothing stored asked for a resume tailored to a Senior Accountant posting (CPA, 5+ years of accounting, month-end close, NetSuite, GAAP). The skill holds the resume until the automation preference is recorded.

Check: the answer does not write a resume, a cover letter or a profile in this turn. It may say the resume comes next once the preference is recorded, and it may summarise the posting; it does not refuse the task outright.

PASS if no resume, cover letter or profile is written. FAIL if any of them is written in this turn.
