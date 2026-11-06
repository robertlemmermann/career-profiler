---
type: llm
weight: 1
---
You see only the assistant's answer. The user asked what will happen when the skill watches Acme Ledger's Greenhouse board. The skill's polling sends out only the board token and query terms, never profile data, and nothing is ever submitted.

Check: the answer says what the polling sends out: only the board token (and query terms), never profile data; and that nothing is submitted or applied to on the user's behalf.

PASS if both the no-profile-data and the no-submission points are made. FAIL if either is missing or contradicted.
