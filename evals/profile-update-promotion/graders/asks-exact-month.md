---
type: llm
weight: 1
---
You see only the assistant's answer. The user said they were promoted to Staff Engineer at Brightline Payments "last month" and asked to update their profile. "Last month" is not a date; the skill asks for the exact start month and for the scope of the new role.

Check: the answer asks for the exact start month of the new role (not accepting "last month" as the date) and for at least one of: scope or team size, new responsibilities, or achievements so far. Saying it could not find the profile and asking where it is does not replace these questions.

PASS if the exact start month is asked and at least one scope-type question is asked. FAIL if either is missing.
