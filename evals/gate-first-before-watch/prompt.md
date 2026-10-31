---
name: gate-first-before-watch
description: "With no preference recorded, a request to watch a Greenhouse board and draft resumes must start with the automation question; no subscription is set up yet."
tags: [outcome, gate, watch]
runs: 3
max_turns: 12
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent asks which automation level the user wants (off, alert, draft, prepare), says it never submits applications, gives no watch command to run now and claims no subscription, and invents nothing about the user."
---

No shell is available, so use the career-profiler skill the guidance-only way. I have never used it and nothing is stored. Watch Acme Ledger's Greenhouse board (https://boards.greenhouse.io/acmeledger) for frontend lead roles and draft a resume whenever one appears.
