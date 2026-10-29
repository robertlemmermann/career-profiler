---
name: gate-corrupt-remake
description: "A corrupt preference record must be treated as absent: the agent re-asks and does not reuse the old value."
tags: [outcome, gate]
runs: 3
max_turns: 8
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent explains the record did not verify, offers the old statement only as a hint, asks the user to state their preference again, and does nothing else."
---

No shell is available, so use the career-profiler skill the guidance-only way. Here is my store's `preferences.json` as it is on disk right now:

```json
{"schema":"career-preferences/1","automation":"prepare","submit":"always","statement":"","recorded_at":"not a date","hash":"xyz"}
```

Now please check how well I match this posting and write the resume: Lead React Engineer at Acme Ledger, 7+ years, React, TypeScript, leading a team.
