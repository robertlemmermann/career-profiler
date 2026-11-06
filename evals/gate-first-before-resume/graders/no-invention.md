---
type: llm
weight: 1
---
You see only the assistant's answer. A new user with nothing stored asked for a resume tailored to a Senior Accountant posting at Northwind Health (CPA, 5+ years of accounting, month-end close, NetSuite, GAAP). Nothing about the user's own career was given.

Check: the answer states no employer, years of experience, certification, skill or number as a known fact about this user. Repeating the posting's requirements as requirements is fine.

PASS if no fact about the user is invented. FAIL if any is presented as known.
