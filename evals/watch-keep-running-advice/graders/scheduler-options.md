---
type: llm
weight: 2
---
You see only the assistant's final answer. Every fact you need is listed here; do not require anything else.

Facts for the judge: the user has watch subscriptions set up with the career-profiler skill and asks how to keep polling running while the laptop is closed and how to see new matches from a phone. The skill's polling runs as a plain script without a model; a model (or the user) is needed only to review drafts.

Check exactly one thing:
The answer names an OS scheduler (cron, launchd or Task Scheduler) and a GitHub Actions schedule in a private repository that holds the store. PASS if both.
