---
name: trigger-build-profile
description: "A user wants a reusable record of their career; the skill must be selected and must start an interview instead of inventing a profile."
tags: [trigger, profile]
runs: 3
max_turns: 8
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent loads career-profiler and asks the first interview questions (identity, existing resume, most recent role) without fabricating any fact."
---

I want to put together a proper, reusable record of my whole career so that later I can generate
a resume for any specific job posting without starting from scratch each time. I am a senior
software engineer. Interview me and build it up; I will answer your questions.
