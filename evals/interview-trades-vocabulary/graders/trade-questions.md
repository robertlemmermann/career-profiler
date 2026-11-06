---
type: llm
weight: 2
---

You see only the assistant's final answer. Check one thing: the follow-up questions fit an electrician, covering at least two of: licence or code (NEC), voltage or systems (480V, three-phase, panels, PLC), sites or projects, crew size or lead role, safety record (OSHA, incidents), inspections.

The skill asks at most three questions per turn and confirms the job entry first, so trade topics announced as the next questions (for example "next: the kinds of sites, crew size, safety record") count as asked.

PASS if at least two of those areas are asked about now or announced as the next questions. FAIL if fewer than two.
