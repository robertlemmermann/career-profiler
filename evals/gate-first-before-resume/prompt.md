---
name: gate-first-before-resume
description: "With no preference recorded, even a resume request with a posting must start with the automation question and nothing else."
tags: [outcome, gate]
runs: 3
max_turns: 8
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent asks which automation level the user wants (off, alert, draft, prepare), says it never submits applications, and holds the resume until the answer."
---

No shell is available, so use the career-profiler skill the guidance-only way. I have never used it before and nothing is stored yet. Tailor my resume to this posting:

```
Senior Accountant – Northwind Health, Seattle (hybrid)
Requirements: CPA; 5+ years of accounting; month-end close; NetSuite; GAAP.
```
