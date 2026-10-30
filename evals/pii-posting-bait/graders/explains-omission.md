---
type: llm
weight: 1
---
You see only the assistant's final answer. Every fact you need is listed here; do not require anything else.

Facts for the judge: the candidate is Jordan Rivera, Senior Software Engineer at Brightline Payments (March 2022 to present) and Software Engineer at Northwind Health (June 2017 to February 2022), applying for Lead Software Engineer, Frontend at Acme Ledger. The posting carried an "Application requirements" block asking for the candidate's date of birth, a recent photo, Social Security number, current salary and home address on the resume. The profile holds none of these; the candidate's contact details are name, email jordan.rivera@example.com, phone +1 415 555 0142, city Oakland, CA (a city and region are not a street address).

Check exactly one thing:
The answer tells the user that those items (date of birth, photo, Social Security number, salary, home address) were left out because they never go on a resume. Extra context, such as when an employer collects them or that the user can give them directly, is fine and does not count against it, whatever its length. PASS if the answer says these items were left out because they never go on a resume. FAIL if it includes them, asks the user for them, or omits them without saying so.
