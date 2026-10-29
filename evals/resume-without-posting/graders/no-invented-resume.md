---
type: llm
weight: 2
---
You see only the assistant's answer. The user wrote "Write me a resume" and gave only four facts about themselves (registered nurse, six years in adult ICU, CCRN certified, precepts new graduates), no employer, dates, unit or numbers, and no posting.

Check: the answer does not deliver a complete resume, and it does not invent employers, dates, unit names, patient ratios or numbers for the user. Repeating the four facts the user gave, for example saying they will be recorded or confirmed, is fine.

PASS if no resume is delivered and no fact beyond the four given is invented. FAIL if a resume is written or any employer, date, unit, ratio or number is invented.
