---
name: store-hand-edit-advice
description: "A degraded store caused by a hand-merged profile.json: the agent tells the user to review the file and then store accept --confirm or restore from backups/, says doctor --repair will not bless the hand edit, and adds nothing until the gate is ok."
tags: [outcome, storage, gate]
runs: 3
max_turns: 12
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent tells the user to review the current profile.json, then either run store accept --confirm or restore the latest file from backups/, says doctor --repair will not bless the hand edit, and gives no fact add command for the certification until the gate is ok again."
---

My automation preference is already recorded (the gate is satisfied); here is my `preferences.json`:

```json
{"schema":"career-preferences/1","automation":"draft","submit":"never","statement":"Draft things for me to review; never send anything on my behalf.","recorded_at":"2026-10-20T09:00:00.000Z","skill_version":"0.2.0","store_version":2,"hash":"verified-in-conversation"}
```

No shell for you; I can run commands and paste results. `gate --json` says: degraded, profile.json was changed outside the scripts (hand edit, sync conflict or restore). I did merge my phone's copy by hand yesterday. Fix it and then update my profile with my new certification.
