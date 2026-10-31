---
name: profile-update-promotion
description: "A promotion is recorded as a new role entry with exact facts asked for, never by overwriting the old title."
tags: [trigger, profile, update]
runs: 3
max_turns: 12
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent loads career-profiler, explains it will add a new experience entry (Staff Engineer at Brightline Payments) and close the previous one, asks for the exact start month (an inferred September 2026 only as a question), and asks about or announces scope and new achievements."
---

My automation preference is already recorded (the gate is satisfied); here is my `preferences.json`:

```json
{"schema":"career-preferences/1","automation":"draft","submit":"never","statement":"Draft things for me to review; never send anything on my behalf.","recorded_at":"2026-10-20T09:00:00.000Z","skill_version":"0.2.0","store_version":2,"hash":"d824c0ad061453a50eb17d317b88290e54d007346304063553d5bf823b75edab"}
```

No shell is available, so use the career-profiler skill the guidance-only way. Good news: I was promoted to Staff Engineer at Brightline Payments last month. Update my career
profile so the next resume reflects it.
