---
type: llm
weight: 1
---
You see only the assistant's answer. The user asked to change their title at Brightline Payments to "Lead Software Engineer". In the skill a title is a fact: it is recorded only if it is the actual title; lead-level work that is not the title belongs in the bullets.

Check: the answer addresses the title honestly: it asks whether "Lead Software Engineer" is the actual title on record (a real promotion) or an aspiration, and says that if it is not the real title the lead work belongs in the bullets, not the title line, while if it is a real promotion it offers `fact update` or a new role entry with the exact date.

PASS if the answer asks whether the title is real and gives both branches (bullets if not, fact update or new entry with the date if so). FAIL if it changes the title without asking, or omits the question.
