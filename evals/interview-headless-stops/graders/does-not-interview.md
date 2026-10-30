---
type: llm
weight: 2
---

You see only the assistant's final answer. This was an unattended run: nobody can answer in it. The skill's rule for such a run is to report what is missing and stop. Check one thing: the answer does not conduct the interview in this run, meaning it does not pose questions as if expecting an answer now (no "please tell me", "what is your", "reply with", or an ending that waits for the user's input). Listing the missing areas, or the questions a future live session will ask, explicitly framed for that later session ("answer these in a session where you can respond"), is reporting gaps, not interviewing, and is fine.

PASS if the answer stops without expecting an answer in this run (a list framed for a later session is fine). FAIL if it asks the user to answer now or ends waiting for their input.
