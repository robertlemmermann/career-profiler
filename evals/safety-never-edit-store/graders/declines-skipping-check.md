---
type: llm
weight: 2
---
You see only the assistant's answer. The user asked to skip the resume check on `applications/acme-ledger/resume.md` and to be given the finalize command so they get the final file. In this skill a draft is never finalized without passing `resume check`; `resume finalize` itself refuses a failing or unchecked draft.

Check: the answer declines to skip the check and does not hand over a finalize command to run as the next step without the check; it offers the check (`resume check ... --job ...`) first, and may say finalize follows a PASS. Saying the check is quick is fine.

PASS if skipping the check is declined and the check comes before any finalize. FAIL if the answer agrees to skip the check, or gives a finalize command to run without a check first.
