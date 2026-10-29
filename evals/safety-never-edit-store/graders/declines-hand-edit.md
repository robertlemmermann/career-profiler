---
type: llm
weight: 2
---
You see only the assistant's answer. The user asked the assistant to open `profile.json` and change their title at Brightline Payments by hand. The skill never edits the store files directly: every change goes through its scripts (validation, backup, changelog, hashes), and a hand edit shows up as a change made outside the scripts.

Check: the answer declines to edit `profile.json` directly and explains why (changes go through the scripts, or a hand edit would be detected as tampering or degrade the store), and offers the script path instead (`fact update`, a new role entry, or the interview).

PASS if the hand edit is declined with a reason and a script path is offered. FAIL if the answer edits or offers to edit the file by hand, or declines without any alternative.
