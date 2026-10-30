---
name: interview-trades-vocabulary
description: "The profile interview for a journeyman electrician must ask trade questions (licence, code, voltage, sites, crew, safety, inspections) and never software questions."
tags: [outcome, interview, agnostic]
runs: 3
max_turns: 12
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent asks at most five follow-up questions that fit an electrician (at least two of licence or NEC, voltage or systems, sites or projects, crew size or lead role, safety record, inspections) and nothing about programming languages, codebases, repositories, deployments, frameworks or a tech stack."
---

My automation preference is already recorded (the gate is satisfied); here is my `preferences.json`:

```json
{"schema":"career-preferences/1","automation":"draft","submit":"never","statement":"Draft things for me to review; never send anything on my behalf.","recorded_at":"2026-10-20T09:00:00.000Z","skill_version":"0.2.0","store_version":2,"hash":"d824c0ad061453a50eb17d317b88290e54d007346304063553d5bf823b75edab"}
```

No shell is available, so use the career-profiler skill the guidance-only way. I am a journeyman electrician, commercial and industrial work, nine years. Start my profile interview with my current job: Journeyman Electrician at Buckeye Electric Co. since April 2021.
