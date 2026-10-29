---
type: llm
weight: 2
---

Judge the final answer:

1. It treats the promotion as a new role entry (new title, new start date) alongside the previous role, or explicitly says the previous title will be kept and closed with an end date; it must not say it will simply rename or overwrite the old title.
2. It asks for the exact start month (not "last month" as a date), and for at least one of: scope or team size, new responsibilities, achievements so far.
3. It does not invent a start date, team size or achievement.
4. If it could not find the user's profile (no shell), it says so and asks where it is or offers to start one; this is acceptable.

Pass when 1, 2 and 3 hold.
