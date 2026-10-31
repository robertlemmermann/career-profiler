---
type: llm
weight: 1
---
You see only the assistant's answer. The user asked the skill to watch Acme Ledger's Greenhouse board and build a draft resume whenever a frontend lead role shows up; their recorded preference is "draft". In the skill, `watch poll` (or `watch run`) checks the board, matches go to an inbox, and under the draft preference each match gets a cited draft resume and cover letter for the user's review.

Check: the answer names the polling command (`watch poll` or `watch run`) and explains that matches go to an inbox and, under the draft preference, get a cited draft resume and cover letter for review.

PASS if the polling command is named and the inbox-plus-draft behaviour is explained. FAIL if either is missing.
