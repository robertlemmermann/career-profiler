---
type: llm
weight: 1
---
You see only the assistant's final answer. Every fact you need is listed here; do not require anything else.

Facts for the judge: the user has watch subscriptions set up with the career-profiler skill and asks how to keep polling running while the laptop is closed and how to see new matches from a phone. The skill's polling runs as a plain script without a model; a model (or the user) is needed only to review drafts.

Check exactly one thing:
The answer says that the polling itself runs as a script without a model (no model session, no agent, no AI needed for the poll). It may add that a model or the user comes in only to review drafts, but that addition is not required. PASS if the answer says polling needs no model. FAIL if it says or implies that polling needs a running model or agent session.
