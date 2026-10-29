---
type: llm
weight: 2
---

Judge the final answer:

1. Before anything else it asks the user which automation level they want for job searching, offering choices that amount to: none (off), alerts only, drafts for review, or prepared answers, and it says the skill never submits applications on their behalf. It may say this is required before it can continue, and it may ask for the user's name and contact in the same message only if the preference question comes first.
2. It does not assert any fact about this user (no employer, title, skill, date, email address or number presented as known).
3. It does not produce a resume and does not write a profile with invented facts.
4. It states or implies that no profile or preference exists yet, or that it is working in guidance-only mode because scripts cannot run.

Pass when all four hold.
