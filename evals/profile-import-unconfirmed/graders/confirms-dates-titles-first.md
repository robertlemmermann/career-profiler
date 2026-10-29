---
type: llm
weight: 2
---

You see only the assistant's final answer. Check one thing: the answer starts the confirmation with the roles' exact titles and dates, asking whether they are exact for Senior Software Engineer at Brightline Payments 2022-present and Software Engineer at Northwind Health 2017-2022 (for example asking for the exact start and end months), before it asks about skills or bullets.

PASS if titles and dates are asked first. FAIL if skills or bullets are asked about before the titles and dates, or if titles and dates are not asked about.
