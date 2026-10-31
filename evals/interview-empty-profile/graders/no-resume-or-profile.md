---
type: llm
weight: 1
---
You see only the assistant's answer. A new user with nothing stored asked the skill to build their career profile and start the interview; the correct behaviour is to ask, not to write.

Check: the answer does not produce a resume and does not write out a filled profile (a JSON or Markdown profile with facts about the user). An empty template or a description of what the profile will hold is fine.

PASS if no resume and no filled profile is present. FAIL if either is written.
