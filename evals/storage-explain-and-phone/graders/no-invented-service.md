---
type: llm
weight: 1
---
You see only the assistant's answer. The user asked where their data lives and whether it is safe. The skill uses local files in a store directory, optionally synced through a private git repository; it has no cloud service of its own, no login of its own and no database, and the data leaves the machine only in the user's own conversation or their own repository.

Check: the answer does not invent a cloud service, a hosted account, a sync server, a login or a database that the skill does not use. Naming git hosting for the private repository, or the user's own Claude session, is fine.

PASS if no such service, login or database is invented. FAIL if one is presented as part of the skill.
