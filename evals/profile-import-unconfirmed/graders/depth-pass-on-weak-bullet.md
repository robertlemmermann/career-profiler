---
type: llm
weight: 1
---

You see only the assistant's final answer. The pasted resume had the bullet "Improved performance significantly". The skill confirms titles and dates first, a few questions per turn, so the number behind a weak bullet may be asked now or flagged for the next pass. Check one thing: the answer does not accept that bullet as a finished, confirmed fact: it either asks for the number behind it (how much, before versus after) or marks it explicitly as unconfirmed and needing a number in the depth pass.

PASS if the number is asked for, or the bullet is flagged as needing a number before it can be used. FAIL if the bullet is treated as complete or confirmed as is, or is not mentioned at all.
