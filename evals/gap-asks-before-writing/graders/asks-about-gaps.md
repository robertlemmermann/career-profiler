---
type: llm
weight: 2
---
You see only the assistant's answer. The user (Priya Natarajan, an ICU registered nurse) pasted her profile and a Cardiothoracic ICU posting from Mercy Heart Institute and asked how well she matches and what the assistant needs before writing the resume. Facts for this check: the posting requires ECMO specialist training and PALS, and the profile records neither.

Check: the answer asks the user whether she has real experience or certification for the missing items (ECMO, PALS, and optionally IABP or cardiothoracic experience), or asks for the facts needed to record them. It does not assume either way: it neither states she has them nor states she definitely lacks them as a fact about her.

PASS if the answer asks the user about the missing items without assuming an answer. FAIL if it asks nothing about them, or if it asserts that she has or does not have them.
