---
type: llm
weight: 1
---
You see only the assistant's answer. The user said they were promoted to Staff Engineer at Brightline Payments "last month" and asked to update their profile. "Last month" is not a date; the skill asks for the exact start month and for the scope of the new role.

Check: the answer asks the user to confirm or give the exact start month of the new role (not accepting "last month" as the date; "did it take effect in September 2026, or another month?" counts), and it either asks at least one scope-type question now (scope or team size, new responsibilities, achievements so far) or says explicitly that those questions come next, after the current ones are answered. The skill asks at most three questions per turn, so deferring the scope questions to the next turn is fine when it is said. Saying it could not find the profile and asking where it is does not replace the start-month question.

PASS if the exact start month is asked and scope-type questions are asked now or explicitly announced for the next turn. FAIL if the start month is not asked, or scope is neither asked nor announced.
