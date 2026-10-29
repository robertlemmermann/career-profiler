---
type: llm
weight: 2
---

You see only the assistant's final answer. Check one thing: the answer tells the user to run `doctor --repair` and then `gate` again before anything else.

PASS if both commands are named in that order (repair first, then gate). FAIL if either is missing or the order is reversed.
