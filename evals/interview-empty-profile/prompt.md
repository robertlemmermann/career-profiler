---
name: interview-empty-profile
description: "With no store and no shell, the profile mode explains where facts will live and starts the interview without inventing anything."
tags: [outcome, profile, interview]
runs: 3
max_turns: 8
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent explains that nothing is stored yet and asks the first questions: name and contact, an existing resume, the most recent role."
---

Use the career-profiler skill to build my career profile. I have never used it before. This
environment has no shell, so you cannot run its scripts; do what the skill says to do in that
case. Start the interview.
