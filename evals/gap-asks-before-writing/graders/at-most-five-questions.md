---
type: llm
weight: 1
---
You see only the assistant's answer. The user pasted a profile and a posting and asked what the assistant needs from her before it writes the resume. The skill allows at most five gap questions per posting.

Check: count the distinct questions the user is asked to answer in this answer. A sentence ending in a question mark, or an imperative request for one item ("tell me ..."), counts as one; a list of several items inside one question counts as one; a rhetorical question that the answer itself answers does not count.

Counting rule: each numbered or bulleted item the user is asked about counts as one question, however many question marks or sub-questions it contains; a sentence announcing what will be asked next turn is not a question; a rhetorical question the user is not meant to answer is not a question.

PASS if at most five distinct questions are asked. FAIL if six or more are asked.
