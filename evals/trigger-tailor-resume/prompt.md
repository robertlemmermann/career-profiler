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
expected_outcome: "With the automation preference already recorded, the agent loads career-profiler, treats the posting as the target, and looks for or asks for the user's profile facts before writing anything."
---

My automation preference is already recorded (the gate is satisfied); here is my `preferences.json`:

```json
{"schema":"career-preferences/1","automation":"draft","submit":"never","statement":"Draft things for me to review; never send anything on my behalf.","recorded_at":"2026-10-20T09:00:00.000Z","skill_version":"0.2.0","store_version":2,"hash":"verified-in-conversation"}
```

No shell is available, so use the career-profiler skill the guidance-only way. Tailor my resume to this posting and write a cover letter for it.

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
