---
type: llm
weight: 1
---
You see only the assistant's answer. The user asked to change their title at Brightline Payments from "Senior Software Engineer" to "Lead Software Engineer". In the skill a title is a fact: it is recorded only if it is the actual title; lead-level work that is not the title belongs in the achievement bullets.

Check: the answer asks whether "Lead Software Engineer" is the actual title (a real promotion or a correction) rather than lead-level work under the old title, and gives both branches: if it is real, a new role entry (promotion, with the start month) or `fact update` (correction); if it is not, the lead work goes into the bullets and the title stays.

PASS if the answer asks whether the title is real and gives both branches. FAIL if it changes or offers to change the title without asking, or omits the question.
