---
type: llm
weight: 2
---

You see only the assistant's final answer. Check one thing: the answer says the extracted facts are recorded as unconfirmed (or shows `fact add ... --unconfirmed` / `--source document`) and that unconfirmed facts never reach a resume.

Without a shell, holding the extracted facts as unconfirmed (listed as unconfirmed, written only after the user confirms them) counts as recording them as unconfirmed.

PASS if both points are made. FAIL if either is missing.
