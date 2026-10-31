---
type: llm
weight: 1
---
You see only the assistant's answer. The user said only that they are a senior software engineer and asked to be interviewed, and pasted a recorded automation preference (automation "draft", submit "never", statement "Draft things for me to review; never send anything on my behalf.", recorded 2026-10-20). No employer, title, date, skill or achievement was given.

Check: the answer does not state any specific employer, job title, employment date, skill level, education or achievement as if it were already known about this user. Not inventions: restating the pasted preference record or its fields, calling the user a senior software engineer, naming where the store will live (such as ~/.career-profiler/profile.json), describing the skill's process, and examples clearly marked as examples of what to provide.

PASS if no career fact about the user (employer, title, dates, skills, education, achievements) is invented. FAIL if any such fact is presented as known.
