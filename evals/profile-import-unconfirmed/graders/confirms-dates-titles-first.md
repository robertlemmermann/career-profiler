---
type: llm
weight: 2
---
You see only the assistant's final answer. The user pasted an old resume (Jordan Rivera; Senior Software Engineer at Brightline Payments 2022-present; Software Engineer at Northwind Health 2017-2022; B.S. Computer Science, University of Washington; skills React, TypeScript, Python) and asked for it to be imported. The skill extracts everything as unconfirmed and then confirms the roles' exact titles and dates before anything else.

Check one thing: among the questions the answer asks the user, the first ones are about the roles' exact titles and their start and end months (for example "is Senior Software Engineer the exact title, and which month in 2022 did you start?"), before any question about skills, skill levels, or achievement numbers. Only the questions count for this order, in the order they are asked; a note inside the shown entries that points ahead to a later question (such as "see question 3") is not a question: the answer may first write out the imported, unconfirmed profile or file contents (which naturally lists skills and bullets), and that is not a question.

A question confirming the identity or contact details before the titles is fine; only skills, skill levels and bullets must not come before titles and dates.

PASS if the first questions asked are about exact titles and dates (an identity check before them is fine). FAIL if the answer asks about skills, levels or bullets before titles and dates, or asks nothing about titles and dates.
