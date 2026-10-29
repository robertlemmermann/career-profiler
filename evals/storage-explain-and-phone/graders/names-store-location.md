---
type: llm
weight: 2
---
You see only the assistant's answer. The user asked where exactly the skill keeps their data. The skill keeps a store directory (default `~/.career-profiler/`, or a `profile.json` in a dedicated private repository, or wherever `CAREER_PROFILER_HOME` or `--store` points) holding `profile.json`, `preferences.json`, `changelog.jsonl`, `MANIFEST.json`, `backups/`, `quarantine/` and `applications/`.

Check: the answer names the store location (one of `~/.career-profiler/`, a `profile.json` in a dedicated private repository, `CAREER_PROFILER_HOME` or `--store`) and at least two of its files or mechanisms (profile.json, preferences.json, changelog, backups, manifest, hashes, quarantine).

PASS if a location and at least two files or mechanisms are named. FAIL otherwise.
