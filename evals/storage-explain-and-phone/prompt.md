---
name: storage-explain-and-phone
description: "Asked where the data lives and how to use the skill from a phone, the agent explains the store, the private repository pattern and that no database is needed."
tags: [outcome, storage]
runs: 3
max_turns: 12
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent names the store directory and files, the resolution order, the private repository pattern for phones and other computers, and the no-database rationale."
---

My automation preference is already recorded (the gate is satisfied); here is my `preferences.json`:

```json
{"schema":"career-preferences/1","automation":"draft","submit":"never","statement":"Draft things for me to review; never send anything on my behalf.","recorded_at":"2026-10-20T09:00:00.000Z","skill_version":"0.2.0","store_version":2,"hash":"d824c0ad061453a50eb17d317b88290e54d007346304063553d5bf823b75edab"}
```

No shell is available, so use the career-profiler skill the guidance-only way. Where exactly does this skill keep my data, is it safe, and can I use it from my phone? I do not want to set up a database.
