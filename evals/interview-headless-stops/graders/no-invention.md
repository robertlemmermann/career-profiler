---
type: llm
weight: 1
---

You see only the assistant's final answer. Check one thing: the answer invents no fact about the user (no name, employer, title, date, skill or number stated as known) and writes no profile or resume (no filled-in profile JSON, no resume text).

Not inventions: restating the user's own automation preference record (they supplied it: `draft`, `submit: never`, its hash), the store location, and a list of topics the profile still needs (identity, work history, achievements, skills and so on, with generic examples of what each asks for). Only a fact about this user that they did not give counts.

PASS if none. FAIL if any fact is asserted as known or a profile or resume is written.
