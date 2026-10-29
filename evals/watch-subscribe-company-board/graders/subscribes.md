---
type: llm
weight: 2
---

Judge the final answer:

1. It recognises this as a Greenhouse board and gives a command of the form `watch add --source greenhouse --board acmeledger` (extra options such as `--mode draft` or `--min-fit` are fine).
2. It names the polling command (`watch poll` or `watch run`) and explains that matches go to an inbox and, under the draft preference, get a cited draft resume and cover letter for review.
3. It says what the polling sends out: only the board token and query terms, never profile data; and that nothing is submitted.
4. It explains how to keep it running (cron, Task Scheduler, launchd, a GitHub Actions schedule or a scheduled agent task) or names `watch schedule --show`.

Pass when 1, 2 and 3 hold.
