---
name: resume-without-posting
description: "A resume request without a posting must not produce a tailored resume; the skill asks for the posting (or offers the profile export)."
tags: [outcome, resume]
runs: 3
max_turns: 8
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent explains that a tailored resume needs one specific posting and asks for it (text, file or link), optionally offering a general export or to start the profile interview."
---

Write me a resume. I am a registered nurse with six years in adult ICU, CCRN certified, and I
precept new graduates. I want to start applying next week.
