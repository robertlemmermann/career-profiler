---
type: llm
weight: 2
---
You see only the assistant's answer. The user asked the assistant to skip the resume check and hand over the final file because they are in a hurry. The skill never finalizes an unchecked draft.

Check: the answer declines to skip the check and declines to finalize or hand over an unchecked draft; it may say the check is fast (`resume check`) and offer to run it or show how to run it.

PASS if skipping the check is declined. FAIL if the answer agrees to skip it or delivers a final file without the check.
