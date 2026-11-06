---
type: llm
weight: 2
---
You see only the assistant's answer. The user pasted a posting and asked for a tailored resume; their automation preference is recorded, no profile was given, and no shell is available. The skill tailors only from recorded profile facts.

Check: the answer states that it needs the user's profile facts before tailoring (an existing profile or store to paste or point to, or an interview to build one), or it reports that it looked for the profile, found none, and asks how to proceed.

PASS if the answer asks for or sets out to build the profile before writing. FAIL if it neither mentions the profile nor asks for facts.
