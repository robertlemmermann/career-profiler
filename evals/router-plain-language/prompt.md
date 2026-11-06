---
name: router-plain-language
description: "Plain-language requests are routed to the right mode without the user naming it."
tags: [trigger, router]
runs: 3
max_turns: 12
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent maps \"only alert me, never apply\" to the setup mode and the alert level, quotes the user's words back, and asks for a yes before recording (or shows the gate record command with alert, their words and --confirm)."
---

No shell is available, so use the career-profiler skill the guidance-only way. From now on I only want you to alert me when something matching shows up on the boards I give you, and never apply to anything for me. Make that the rule.
