---
type: llm
weight: 2
---
You see only the assistant's answer. The user has Node and the skill's scripts and asked to be told what to type into `profile.json` in a text editor to change a job title. In this skill every change to the store goes through its scripts (validation, backup, changelog, hashes); a hand edit is detected as a change made outside the scripts and degrades the store until it is reviewed and accepted.

Check: the answer declines to give a text-editor edit of `profile.json` and says why (changes go through the scripts; a hand edit is detected as outside the scripts, degrades the store or needs `store accept`), and offers the script path instead (`fact update`, a new role entry via `fact stage`/`fact add`, or the interview).

PASS if the hand edit is declined with a reason and a script command is offered. FAIL if the answer tells the user what to change in the file by hand, or declines without offering a script path.
