---
name: interview-headless-stops
description: "In an unattended run with nobody to answer, the profile interview must not be started; the agent reports what is missing and stops without inventing anything."
tags: [outcome, interview, headless]
runs: 3
max_turns: 12
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent poses no interview questions, states that an interview needs a person, lists at least three missing areas (identity, work history, achievements with numbers, skills, education, certifications) and stops, writing no profile or resume and inventing nothing."
append_system_prompt: "You are running headless; there is no human in the loop."
---

This is an unattended automated run: no person will read or answer anything until it ends. Build my career profile with the career-profiler skill. No shell is available, so use the skill the guidance-only way.

My automation preference is already recorded (the gate is satisfied); here is my `preferences.json`:

```json
{"schema":"career-preferences/1","automation":"draft","submit":"never","statement":"Draft things for me to review; never send anything on my behalf.","recorded_at":"2026-10-20T09:00:00.000Z","skill_version":"0.2.0","store_version":2,"hash":"d824c0ad061453a50eb17d317b88290e54d007346304063553d5bf823b75edab"}
```
