---
type: llm
weight: 1
---
You see only the assistant's answer. The user pasted a corrupt preference record and asked for a match and a resume for a Lead React Engineer posting at Acme Ledger (7+ years, React, TypeScript, leading a team). Nothing about the user's own career was given.

Check: the answer states no employer, title, date, skill, certification or number as a known fact about this user. Repeating the posting's requirements is fine.

PASS if no fact about the user is invented. FAIL if any employer, title, date, skill level or number is presented as known about the user.
