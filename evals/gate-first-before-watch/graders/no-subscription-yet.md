---
type: llm
weight: 2
---

You see only the assistant's final answer. Check one thing: the answer does not give a `watch add` command to run now and does not say a subscription or watch has been set up; it may say watching comes next once the preference is recorded.

Naming `watch add` as a later step, in a sequence that comes after the preference is recorded (for example "a later session with Node can run `watch add --source greenhouse --board acmeledger`"), is describing what comes next, not a command to run now.

PASS if no command is given to run now and no subscription is claimed. FAIL if a `watch add` command is presented as the thing to run now, before the preference is recorded, or the answer says the board is now being watched.
