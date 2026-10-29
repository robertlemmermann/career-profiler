---
name: watch-subscribe-company-board
description: "Watching a company careers page is set up through the legal catalog with the commands shown and no profile data sent."
tags: [outcome, watch]
runs: 3
max_turns: 8
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent identifies the board family and token, shows the watch add and poll commands, explains what leaves the machine and how to schedule polling."
---

My automation preference is already recorded (the gate is satisfied); here is my `preferences.json`:

```json
{"schema":"career-preferences/1","automation":"draft","submit":"never","statement":"Draft things for me to review; never send anything on my behalf.","recorded_at":"2026-10-20T09:00:00.000Z","skill_version":"0.2.0","store_version":2,"hash":"verified-in-conversation"}
```

Acme Ledger posts all its jobs at https://boards.greenhouse.io/acmeledger. Watch that page for me and build a draft resume whenever a frontend lead role shows up. I cannot run commands here, so tell me exactly what to run and what will happen.
