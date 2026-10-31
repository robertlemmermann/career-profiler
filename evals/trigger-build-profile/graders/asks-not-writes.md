---
type: llm
weight: 2
---
You see only the assistant's answer. The user, a senior software engineer whose automation preference is already recorded, asked the skill to interview them and build a reusable career profile. The skill asks a few questions per turn, one topic at a time.

Check: the answer asks the user questions (at most a handful in this turn) rather than producing a finished profile or resume.

PASS if the answer asks questions and writes no finished profile or resume. FAIL if it produces a profile or resume, or dumps more than ten questions at once.
