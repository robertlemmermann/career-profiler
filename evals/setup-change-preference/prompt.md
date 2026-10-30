---
name: setup-change-preference
description: "Changing a recorded draft preference to alert must confirm the user's words first, keep the old record as history, and let an inherit-mode subscription follow the new setting."
tags: [outcome, gate]
runs: 3
max_turns: 12
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent shows a gate record command with --automation alert, the user's own statement and --confirm (or asks for an explicit yes first), says the draft record is quarantined or kept as history and the change logged, and says subscription S-01 in inherit mode follows the alert setting at its next poll with no drafts."
---

My automation preference is already recorded (the gate is satisfied); here is my `preferences.json`:

```json
{"schema":"career-preferences/1","automation":"draft","submit":"never","statement":"Draft things for me to review; never send anything on my behalf.","recorded_at":"2026-10-20T09:00:00.000Z","skill_version":"0.2.0","store_version":2,"hash":"d824c0ad061453a50eb17d317b88290e54d007346304063553d5bf823b75edab"}
```

No shell is available, so use the career-profiler skill the guidance-only way. Change my setting: from now on only alert me, do not draft anything. I already have a Greenhouse subscription S-01 in inherit mode.
