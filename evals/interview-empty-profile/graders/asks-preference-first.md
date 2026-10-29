---
type: llm
weight: 2
---
You see only the assistant's answer. A new user with no store and no shell asked the skill to build their career profile and start the interview. The skill's step 0 says the only thing to do until the automation preference is recorded is to ask for it; a host that gets one message may add the first interview questions after it, but the preference must come first.

Check: the first question the answer puts to the user is which automation level they want for job searching, offering choices equivalent to off, alerts only, drafts for review and prepared answers. Asking for the user's name and contact details or an existing resume in the same message is acceptable only if it comes after the preference question.

PASS if the preference question is the first question asked and all four choices are offered. FAIL if another question comes before it, if the question is missing, or if a choice is missing.
