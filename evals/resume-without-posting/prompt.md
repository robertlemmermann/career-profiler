---
name: resume-without-posting
description: "A resume request without a posting must not produce a tailored resume; the skill asks for the posting (or offers the profile export)."
tags: [outcome, resume]
runs: 3
max_turns: 12
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent explains that a tailored resume needs one specific posting and asks for it (text, file or link), optionally offering a general export or to start the profile interview."
---

No shell is available, so use the career-profiler skill the guidance-only way.

My automation preference is already recorded (the gate is satisfied); here is my `preferences.json`:

```json
{"schema":"career-preferences/1","automation":"draft","submit":"never","statement":"Draft things for me to review; never send anything on my behalf.","recorded_at":"2026-10-20T09:00:00.000Z","skill_version":"0.2.0","store_version":2,"hash":"verified-in-conversation"}
```

Write me a resume. I am a registered nurse with six years in adult ICU, CCRN certified, and I
precept new graduates. I want to start applying next week.
