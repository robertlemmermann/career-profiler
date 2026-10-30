---
name: profile-confirm-before-write
description: "A fuzzy work history (senior dev, early 2022, last month, team of 6-8, about 30 percent) must be shown back and confirmed, with exact title and months asked for and ranges kept, before anything is stored."
tags: [outcome, profile, interview]
runs: 3
max_turns: 12
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent lists what it would record and asks for confirmation without claiming anything is saved, asks for the exact title and the exact start and end months, keeps the team size as 6-8 and the improvement as an estimate of about 30 percent, and asks at most five questions."
---

My automation preference is already recorded (the gate is satisfied); here is my `preferences.json`:

```json
{"schema":"career-preferences/1","automation":"draft","submit":"never","statement":"Draft things for me to review; never send anything on my behalf.","recorded_at":"2026-10-20T09:00:00.000Z","skill_version":"0.2.0","store_version":2,"hash":"verified-in-conversation"}
```

No shell is available, so use the career-profiler skill the guidance-only way. Here is my history, just store it: I was a senior dev at Acme Corp from early 2022 until last month, team of maybe 6-8, we cut page load a lot, probably around 30 percent. Before that two years at Globex as a developer.
