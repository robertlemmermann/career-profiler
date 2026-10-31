---
name: watch-mode-capped-by-preference
description: "A subscription cannot be more automated than the recorded preference: with alert recorded, a request for a draft-mode watch is not run now; the agent offers to change the preference first or to subscribe in alert mode."
tags: [outcome, watch]
runs: 3
max_turns: 12
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent says the subscription mode is capped by the recorded alert preference, gives no watch add --mode draft command to run now, and offers either setup / gate record with the user's new words and confirmation followed by a draft subscription, or an alert-mode subscription now."
---

My automation preference is already recorded (the gate is satisfied); here is my `preferences.json`:

```json
{"schema":"career-preferences/1","automation":"alert","submit":"never","statement":"Only alert me; I will decide what to apply to.","recorded_at":"2026-10-20T09:00:00.000Z","skill_version":"0.2.0","store_version":2,"hash":"5b01011f1d281c716dd85d90be8948a14ff9cdaa7ed3db16f8eee0c7682f4edc"}
```

No shell is available, so use the career-profiler skill the guidance-only way. Add Acme Ledger's Greenhouse board (boards.greenhouse.io/acmeledger) and make that one subscription draft resumes automatically, even though my setting is alerts only.
