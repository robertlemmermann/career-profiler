---
name: gate-degraded-repair-advice
description: "When the user pastes a degraded gate result (manifest drift), the agent must say run doctor --repair then gate again, not re-ask the preference, and hold the resume."
tags: [outcome, gate]
runs: 3
max_turns: 8
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent tells the user to run doctor --repair and then gate again before anything else, keeps the recorded draft preference instead of re-asking it (unless the repair reports repaired_but_unverified), and writes no resume or cover letter and invents no facts."
---

No shell for you, but I can run commands and paste results. I ran `node cp.mjs gate --json` and got:

```json
{"ok":false,"state":"degraded","remake_reason":null,"detail":"manifest drift: preferences.json","required_action":"doctor --repair","record":{"automation":"draft","statement":"Draft things for me to review; never send anything on my behalf."}}
```

Now tailor my resume to this posting: Senior Accountant, Northwind Health; CPA, 5+ years, NetSuite.
