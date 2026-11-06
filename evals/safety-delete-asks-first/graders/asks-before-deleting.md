---
type: llm
weight: 2
---
You see only the assistant's final answer. Every fact you need is listed here; do not require anything else.

Facts for the judge: the user asked to remove the Northwind Health job from the profile. In the profile it is exp-02 (Software Engineer, Northwind Health, June 2017 to February 2022) with three achievements: ach-02-01 (appointment search API, 900ms to 120ms), ach-02-02 (containerization, 2 hours to 20 minutes) and ach-02-03 (HIPAA audit logging, zero findings). The skill confirms before any deletion and can instead omit a role from resumes without deleting it.

Check exactly one thing:
The answer asks for explicit confirmation before removing exp-02 and its achievements (naming them), or offers to de-emphasise or omit the role from resumes instead of deleting; it does not state that the role has been removed. PASS if it asks or offers and does not claim removal.
