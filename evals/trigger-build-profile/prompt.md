---
name: trigger-build-profile
description: "A user wants a reusable record of their career; the skill must be selected and must start an interview instead of inventing a profile."
tags: [trigger, profile]
runs: 3
max_turns: 8
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "With the automation preference already recorded, the agent loads career-profiler and asks the first interview questions (identity, existing resume, most recent role) without fabricating any fact."
---

My automation preference is already recorded (the gate is satisfied); here is my `preferences.json`:

```json
{"schema":"career-preferences/1","automation":"draft","submit":"never","statement":"Draft things for me to review; never send anything on my behalf.","recorded_at":"2026-10-20T09:00:00.000Z","skill_version":"0.2.0","store_version":2,"hash":"verified-in-conversation"}
```

No shell is available, so use the career-profiler skill the guidance-only way. I want to put together a proper, reusable record of my whole career so that later I can generate
a resume for any specific job posting without starting from scratch each time. I am a senior
software engineer. Interview me and build it up; I will answer your questions.
