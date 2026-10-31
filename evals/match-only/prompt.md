---
name: match-only
description: "A should-I-apply question with a posting selects the skill and yields a fit assessment with gaps, not a resume."
tags: [trigger, match]
runs: 3
max_turns: 12
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent loads career-profiler and either produces a gap analysis from the profile or, lacking one, asks for the profile facts; it does not write a resume."
---

No shell is available, so use the career-profiler skill the guidance-only way.

My automation preference is already recorded (the gate is satisfied); here is my `preferences.json`:

```json
{"schema":"career-preferences/1","automation":"draft","submit":"never","statement":"Draft things for me to review; never send anything on my behalf.","recorded_at":"2026-10-20T09:00:00.000Z","skill_version":"0.2.0","store_version":2,"hash":"d824c0ad061453a50eb17d317b88290e54d007346304063553d5bf823b75edab"}
```

Should I even apply to this? Be honest about what I am missing.

```
Regional Sales Manager – Midwest
Kestrel Industrial Supply

Requirements
- 5+ years of B2B sales experience, including 2+ years managing a sales team
- Track record of exceeding quota in industrial, manufacturing or distribution sales
- Proficiency with Salesforce CRM and pipeline management
- Strong negotiation and presentation skills
- Willingness to travel up to 50%
Preferred
- Bachelor's degree in Business or related field
- Experience selling MRO or safety products
```
