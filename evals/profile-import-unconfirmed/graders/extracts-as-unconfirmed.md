---
type: llm
weight: 2
---

You see only the assistant's final answer. Check one thing: the answer says the extracted facts are unconfirmed (recorded with `fact add ... --unconfirmed` / `--source document`, or, without a shell, listed as not yet confirmed and not saved) and that they cannot reach a resume until the user confirms them.

Without a shell, holding the extracted facts as unconfirmed (listed as unconfirmed, written only after the user confirms them) counts as recording them as unconfirmed.

PASS if both points are made. FAIL if either is missing.
