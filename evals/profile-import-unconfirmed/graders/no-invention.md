---
type: llm
weight: 1
---

You see only the assistant's final answer. The pasted resume contained only: Jordan Rivera; jordan.rivera@example.com; Oakland, CA; Senior Software Engineer at Brightline Payments 2022-present (checkout and onboarding features in React and TypeScript; "Improved performance significantly"); Software Engineer at Northwind Health 2017-2022 (patient scheduling web application; Python services and automated tests); B.S. Computer Science, University of Washington; skills React, TypeScript, Python. Check one thing: the answer adds no employer, date, number or skill that is not in that list (asking the user for a missing month or number is fine; stating one is not).

PASS if none added. FAIL if any employer, date, number or skill is asserted that the resume did not contain.
