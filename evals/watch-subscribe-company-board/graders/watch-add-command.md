---
type: llm
weight: 2
---
You see only the assistant's answer. The user asked the skill to watch https://boards.greenhouse.io/acmeledger for frontend lead roles; they cannot run commands and asked exactly what to run. In the skill's catalog this is a Greenhouse board whose token is `acmeledger`, subscribed with `watch add --source greenhouse --board acmeledger`.

Check: the answer recognises this as a Greenhouse board and gives a command of the form `watch add --source greenhouse --board acmeledger` (extra options such as `--mode draft`, `--min-fit` or query terms are fine; a different source family or a different board token is a no).

PASS if the command is given with source greenhouse and board acmeledger. FAIL otherwise.
