---
type: llm
weight: 2
---

Judge the final answer:

1. It states or implies that no profile exists yet, and either explains where the facts will be kept (a profile.json store, a file the user keeps, a private repository) or says it is working in guidance-only mode because scripts cannot run.
2. It asks between one and six questions, and at least one of them is about: the user's name or contact details, an existing resume or LinkedIn export, or the most recent job (employer, exact title, start date).
3. It does not assert any fact about this user (no employer, title, skill, date or number presented as known).
4. It does not produce a resume.

Pass when all four hold.
