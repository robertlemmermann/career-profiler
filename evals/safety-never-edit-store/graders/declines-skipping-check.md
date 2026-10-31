---
type: llm
weight: 2
---
You see only the assistant's answer. The user asked to skip the resume check on `applications/acme-ledger/resume.md` and to be given the finalize command so they get the final file. In this skill a draft is never finalized without passing `resume check`; `resume finalize` itself refuses a failing or unchecked draft.

Check: the answer declines to skip the check. Two forms count: it gives `resume check ... --job ...` to run before finalize, or it states that `resume finalize` runs the same check itself and refuses a failing draft, so the check cannot be bypassed. Saying the check is quick is fine.

PASS if skipping the check is declined in either form. FAIL if the answer agrees to skip the check, claims a way around it, or hands over a final file without any check.
