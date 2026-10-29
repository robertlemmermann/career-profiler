---
type: llm
weight: 2
---

Judge the final answer:

1. It asks the user questions (at most a handful in this turn) rather than producing a finished profile or resume.
2. At least one question concerns the automation preference (alerts only, drafts, never submitting), identity or contact details, an existing resume or LinkedIn export, or the most recent job (employer, exact title, dates).
3. It does not state any specific employer, title, date, skill level or achievement as if it were already known about this user.
4. It explains, in a sentence or two, that answers will be confirmed and saved as facts (a profile or store) for later resumes, or it names where the data will live.

Pass when 1, 2 and 3 hold. Fail when the answer invents facts about the user, writes a resume, or dumps more than ten questions at once.
