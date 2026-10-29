---
type: llm
weight: 2
---

Judge the final answer:

1. It treats the request as setting the automation preference to alerts only (the setup mode), not as a resume or profile task.
2. It confirms the user's words back and either records the preference with the gate record command (quoting the user's statement and the confirm flag) or asks for an explicit yes before recording.
3. It states that the skill never submits applications in any mode.
4. It does not invent facts about the user or create subscriptions the user did not name.

Pass when 1, 2 and 3 hold.
