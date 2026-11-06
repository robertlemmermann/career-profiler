---
type: llm
weight: 2
---
You see only the assistant's answer. The user said they were promoted to Staff Engineer at Brightline Payments last month and asked to update their career profile. No shell is available. The skill records a promotion as a new experience entry and closes the previous one; it never renames the old title.

Check: the answer treats the promotion as a new role entry (new title, new start date) alongside the previous role, or explicitly says the previous title will be kept and closed with an end date. It must not say it will simply rename or overwrite the old title. If the answer says it could not find the profile and asks where it is or offers to start one, that is acceptable as long as it still describes the change as a new entry.

PASS if the promotion is handled as a new entry with the old one kept and closed. FAIL if the answer renames or overwrites the old title, or says nothing about how the change is recorded.
