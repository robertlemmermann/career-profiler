---
type: llm
weight: 2
---

You see only the assistant's final answer. Check one thing: the answer either shows a `gate record` command with `--automation alert`, the user's own words as `--statement` and `--confirm`, or quotes the user's words back ("only alert me, do not draft anything" or equivalent) and asks for an explicit yes before recording.

PASS if either. FAIL if the preference is changed without the user's words or without a confirmation step, or if no path to recording the change is given.
