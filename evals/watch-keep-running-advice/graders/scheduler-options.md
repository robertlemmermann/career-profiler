---
type: llm
weight: 2
---
You see only the assistant's final answer. Every fact you need is listed here; do not require anything else.

Facts for the judge: the user has watch subscriptions set up with the career-profiler skill and asks how to keep polling running while the laptop is closed and how to see new matches from a phone. The skill's polling runs as a plain script without a model; a model (or the user) is needed only to review drafts.

Check exactly one thing:
The answer names an OS scheduler (cron, launchd or Task Scheduler) and a GitHub Actions schedule in a private repository that holds the store. Mentioning cron, launchd or Task Scheduler in any role counts as naming the OS scheduler, including when the answer says it is the option for an always-on machine or that it is not suitable for a closed laptop; recommending GitHub Actions for the closed laptop counts as naming the Actions schedule. PASS if both an OS scheduler and a GitHub Actions schedule are mentioned anywhere in the answer. FAIL only if one of them is never mentioned at all.
