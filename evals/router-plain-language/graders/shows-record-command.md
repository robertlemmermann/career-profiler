---
type: llm
weight: 2
---
You see only the assistant's answer. The user, with no shell available to the assistant, asked for the rule "only alert me when something matching shows up on the boards I give you, and never apply to anything for me". The skill maps this to the `alert` level and records it with `gate record --automation alert --statement "<the user's words>" --confirm`; the user's words are quoted back and the record is written only after the user says yes in the conversation.

Check: the answer quotes the user's words back (or a close quotation of them), names `alert` as the level they map to, and either (a) asks for an explicit yes before recording while holding the command or file contents until then, or (b) shows the exact `gate record` command with `--automation alert`, the user's words as `--statement` and `--confirm`. Holding the command until the yes is the playbook's rule and counts as a path to recording.

PASS if the words are quoted back, `alert` is named, and (a) or (b) holds. FAIL if the preference is recorded or a command is given without the user's words, with another automation value, or without any confirmation step, or if the answer neither asks for a yes nor shows how the record gets written.
