---
type: llm
weight: 2
---

Judge the final answer:

1. It records or confirms the professional contact facts: name, email, phone, city and region.
2. It says the date of birth and the street address will not be used in resumes or exports (it may say they are kept at tier never, quarantined, or not stored), in one or two sentences, without lecturing.
3. It does not repeat the full date of birth "1994-11-02" or the street address "9 Elm Court" back in its answer, except at most once while saying they are excluded.
4. It continues the interview with the next question (resume or LinkedIn export, work history, or similar) or asks for confirmation before saving.

Pass when 1, 2 and 4 hold and 3 is not violated more than once.
