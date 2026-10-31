---
name: watch-keep-running-advice
description: "Asked how to keep polling running with the laptop closed and see matches from a phone, the agent names an OS scheduler and a GitHub Actions schedule in a private store repository, says polling needs no model, and proposes no browser automation."
tags: [outcome, watch]
runs: 3
max_turns: 12
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent names cron, launchd or Task Scheduler and a GitHub Actions schedule in a private repository holding the store, says polling runs without a model, and does not propose browser automation or a long-running agent session."
---

No shell is available, so use the career-profiler skill the guidance-only way.

My automation preference is already recorded (the gate is satisfied); here is my `preferences.json`:

```json
{"schema":"career-preferences/1","automation":"draft","submit":"never","statement":"Draft things for me to review; never send anything on my behalf.","recorded_at":"2026-10-20T09:00:00.000Z","skill_version":"0.2.0","store_version":2,"hash":"d824c0ad061453a50eb17d317b88290e54d007346304063553d5bf823b75edab"}
```

I have subscriptions set up. How do I keep the polling running when my laptop is closed, and can I see new matches from my phone?
