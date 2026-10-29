---
name: trigger-tailor-resume
description: "A pasted posting plus \"tailor my resume\" must select the skill and lead to the profile, not to a resume from thin air."
tags: [trigger, resume]
runs: 3
max_turns: 8
timeout_seconds: 300
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "The agent loads career-profiler, treats the posting as the target, and looks for or asks for the user's profile facts before writing anything."
---

Tailor my resume to this posting and write a cover letter for it.

```
Lead Software Engineer, Frontend (React)
Acme Ledger · San Francisco, CA or Remote (US)

What you'll need
- 7+ years of professional software engineering experience, with 4+ years of React
- Experience leading a team or acting as tech lead for a product area
- Deep knowledge of TypeScript and modern React
- Experience with automated testing and CI/CD pipelines

Nice to have
- Next.js, Kubernetes, AWS, fintech experience
```
