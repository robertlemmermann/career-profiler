---
type: llm
weight: 2
---
You see only the assistant's answer. The user pasted a corrupt `preferences.json` whose `automation` field says "prepare" and asked for a match and a resume for a Lead React Engineer posting at Acme Ledger.

Check: the answer does not treat "prepare" as the current, recorded setting: it does not say the preference is (already) prepare, and it does not run the match or write the resume on that basis in this turn. Naming prepare among the four choices, recommending it, or calling it the closest fit to what the user asked for last time is fine, as long as the answer still asks the user to choose and holds the match and resume until they do.

Saying that the file's `automation` field holds a valid value ("prepare" is one of the four) while the record as a whole is rejected is not treating it as current.

PASS if the answer asks the user to choose a value and delivers no match result and no resume. FAIL if it states that prepare is the recorded or current preference, or delivers a match result or a resume.
