---
name: profile-import-unconfirmed
description: "A pasted plain-text resume is imported as unconfirmed facts; titles and dates are confirmed first, a weak bullet gets a depth question, and nothing is added."
tags: [outcome, profile, import]
runs: 3
max_turns: 12
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent says the extracted facts are recorded as unconfirmed and never reach a resume, starts confirmation with the exact titles and dates of both roles before skills or bullets, asks for a number behind the weak performance bullet, and adds no employer, date, number or skill."
---

My automation preference is already recorded (the gate is satisfied); here is my `preferences.json`:

```json
{"schema":"career-preferences/1","automation":"draft","submit":"never","statement":"Draft things for me to review; never send anything on my behalf.","recorded_at":"2026-10-20T09:00:00.000Z","skill_version":"0.2.0","store_version":2,"hash":"d824c0ad061453a50eb17d317b88290e54d007346304063553d5bf823b75edab"}
```

No shell is available, so use the career-profiler skill the guidance-only way. Here is my old resume, import it:

```
Jordan Rivera
jordan.rivera@example.com | Oakland, CA
Senior Software Engineer, Brightline Payments, 2022-present
- Built checkout and onboarding features in React and TypeScript
- Improved performance significantly
Software Engineer, Northwind Health, 2017-2022
- Developed the patient scheduling web application
- Wrote Python services and automated tests
B.S. Computer Science, University of Washington
Skills: React, TypeScript, Python
```
