---
type: llm
weight: 2
---
You see only the assistant's answer. The user (Priya Natarajan, an ICU registered nurse) pasted her profile and a Cardiothoracic ICU posting from Mercy Heart Institute and asked how well she matches and what the assistant needs before writing the resume. Facts for this check: the posting requires ECMO specialist training and PALS, and the profile records neither.

Check: the answer asks the user whether she has real experience or certification for the missing items (ECMO, PALS, and optionally IABP or cardiothoracic experience), or asks for the facts needed to record them. It does not assume the answer about her: saying that the profile does not record them, that they are "missing" from the profile, or that only ACLS and BLS are on file, is a statement about the profile and is fine; stating as a fact that she has never done ECMO or does not hold PALS, without asking, is not.

PASS if the answer asks the user about the missing items without asserting the answer. FAIL if it asks nothing about them, or asserts as fact that she has or lacks them.
