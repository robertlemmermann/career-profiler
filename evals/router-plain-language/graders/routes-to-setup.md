---
type: llm
weight: 1
---
You see only the assistant's answer. The user wrote: "From now on I only want you to alert me when something matching shows up on the boards I give you, and never apply to anything for me. Make that the rule." In the skill this is the setup mode: recording the automation preference as alerts only.

Check: the answer treats the request as setting the automation preference to alerts only (the setup step), not as a resume, profile or watch-subscription task.

PASS if the answer is about recording the alerts-only preference. FAIL if it treats the request as something else or ignores the preference.
