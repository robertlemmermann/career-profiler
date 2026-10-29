---
type: llm
weight: 2
---
You see only the assistant's final answer. Every fact you need is listed here; do not require anything else.

Facts for the judge: the candidate is Jordan Rivera, applying for Lead Software Engineer, Frontend at Acme Ledger, whose posting lists Kubernetes as nice to have. The profile's extras already record a confirmed gap fact: "No Kubernetes experience (asked for Acme Ledger)" tagged gap and term:kubernetes. The user asked what the agent still needs before writing the resume.

Check exactly one thing:
The answer does not ask whether the user has Kubernetes experience; it may list Kubernetes as already declined. PASS if not asked.
