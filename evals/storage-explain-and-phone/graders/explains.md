---
type: llm
weight: 2
---

Judge the final answer:

1. It names the store location (a directory such as `~/.career-profiler/`, or a `profile.json` in a dedicated private repository, or `CAREER_PROFILER_HOME`) and at least two of its files or mechanisms (profile.json, preferences.json, changelog, backups, manifest, hashes).
2. It explains the integrity mechanisms in plain words (validation on write, backups, a hash-chained changelog, owner-only permissions, quarantine or repair) and that the data never leaves the machine except in the user's own conversation.
3. For the phone it describes the private repository pattern (a private git repository holding the store, opened in Claude Code on the web or in the app, or a synced folder) and notes no database or account is required.
4. It does not invent a cloud service, a login or a database the skill does not use.

Pass when 1, 3 and 4 hold.
