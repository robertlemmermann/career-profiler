---
type: llm
weight: 2
---
You see only the assistant's answer. The user, with no shell available to the assistant, asked for the rule "only alert me when something matching shows up on the boards I give you, and never apply to anything for me". The skill records this with `gate record --automation alert --statement "<the user's words>" --confirm`, and without a shell the assistant shows the exact command for the user to run.

Check: the answer confirms the user's words back and shows the exact `gate record` command with `--automation alert`, the user's own words (or a close quotation of them) as the `--statement` value, and the `--confirm` flag. Asking for an explicit yes before the user runs it is fine in addition, but not instead of showing the command.

PASS if the command is shown with all three parts (alert, the user's words as the statement, confirm). FAIL if the command is missing, uses another automation value, omits the statement or omits confirm.
