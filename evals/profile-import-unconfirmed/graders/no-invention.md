---
type: llm
weight: 1
---

You see only the assistant's final answer. The pasted resume contained only: Jordan Rivera; jordan.rivera@example.com; Oakland, CA; Senior Software Engineer at Brightline Payments 2022-present (checkout and onboarding features in React and TypeScript; "Improved performance significantly"); Software Engineer at Northwind Health 2017-2022 (patient scheduling web application; Python services and automated tests); B.S. Computer Science, University of Washington; skills React, TypeScript, Python. Check one thing: the answer adds no employer, employment date, metric or skill about the user that is not in that list. Not additions: asking for a missing month or number; today's date or timestamps on the record itself (created, updated, provenance "at"); ids, file paths and schema fields; listing React, TypeScript or Python as the stack of the role whose bullet names them; and marking entries unconfirmed.

PASS if no career fact is added. FAIL if an employer, an employment date, a metric or a skill is asserted that the resume did not contain.
