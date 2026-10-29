# Host notes: scripts, JSON and host limits

## Contents

- [1. Hosts](#1-hosts)
- [2. Script commands](#2-script-commands)
- [3. Fact sections and fields](#3-fact-sections-and-fields)
- [4. Documents the scripts write](#4-documents-the-scripts-write)
- [5. Check codes](#5-check-codes)

## 1. Hosts

| Host | Invocation | Shell for `cp.mjs` | Notes |
|---|---|---|---|
| Claude Code | `/career-profiler <mode>` | Bash tool | the skill directory is given to the model; `$CP` is `<dir>/scripts/cp.mjs`. Claude Code on the web and in the mobile app runs in a cloud container on a repository: use the dedicated-repository pattern ([storage](storage.md) §4) |
| Copilot CLI, VS Code | `/career-profiler <mode>` | `shell` | project skills from `.github/skills/` or `.agents/skills/`; user skills from `~/.copilot/skills/` |
| Copilot cloud agent, code review | by description | `shell` (cloud) | only a copy committed to the repository; interview is impossible headless: the skill reports gaps and stops |
| Codex | `$career-profiler <mode>` | shell (sandbox) | `.agents/skills/` or `~/.agents/skills/`; network is off by default, so `job parse <url>` needs pasted text |
| Chat-only hosts (no shell) | by description | none | guidance-only mode: the profile file is pasted or attached; the model keeps the cited format by hand |

Windows: `node` on PATH, paths with backslashes are fine, outputs are ASCII-only JSON.

## 2. Script commands

Every command accepts `--json`, `--store <dir>`, `--cwd <dir>`, `--dry-run`. Exit codes:
`0` ok, `1` findings (a failing check, a must-have gap, an invalid store), `2` usage (bad
option, invalid fact, a finalize of a failing draft), `3` environment (old Node, no store),
`4` could not verify (corrupt JSON, unreachable URL, empty posting).

| Command | Result (`--json`) |
|---|---|
| `store init [--name N] [--force]` | `{ store, profile, name }` |
| `store path` | `{ store, resolved_from, exists, files }` |
| `store show` | the whole profile document |
| `store validate` | `{ ok, validation: { errors[], warnings[] }, changelog: { entries, ok, problems[] }, unconfirmed[] }`, exit 1 when not ok |
| `store changelog` · `store backup` · `store accept` | entries; the backup write; the accept entry |
| `store export [--format md\|json] [--out f]` | `{ format, content }` or `{ out }` |
| `store import <profile.json>` | the write entry |
| `store sync [--message m]` | `{ synced, committed, reason }` |
| `fact add <section> --data '<json>' \| --file f [--parent id] [--source s] [--unconfirmed]` | `{ added[], write }`; `--data` may be one object or an array |
| `fact update <id> --data '<json>'` | `{ updated, write }`; `null` removes a field; singletons by name (`identity`) |
| `fact remove <id>` · `fact confirm <id>... [--no]` | `{ removed }` · `{ facts[] }` |
| `fact list [section]` · `fact get <id>` | `{ facts: [{ id, kind, confirmed, summary }], unconfirmed[] }` · `{ id, kind, parent, fact }` |
| `interview coverage` | `{ score, domains[], sections[], gaps: [{ code, key, about, priority, question, probes[] }], resume_ready }` |
| `interview next [--max n] [--focus id\|prefix]` | `{ score, resume_ready, remaining, questions[] }` |
| `interview done <key>...` | `{ asked[] }` |
| `job parse <file\|url\|-> [--title t] [--company c] [--out f]` | the `career-job/1` document |
| `match <job.json> [--out f]` | the `career-match/1` document; exit 1 when a must-have keyword is missing |
| `app new <job.json>` · `app list` | `{ dir, files[], fit, gaps[] }` · `{ applications[] }` |
| `resume draft --job j [--match m] [--out f]` · `cover-letter draft ...` | `{ out, content }` |
| `resume check <f.md> [--job j] [--match m] [--report r]` · `cover-letter check ...` | the `career-resume-check/1` report; exit 1 on `FAIL` |
| `resume finalize <f.md> [--job j] [--formats md,txt,html,docx]` · `cover-letter finalize ...` | `{ files[], docx, words, verdict, findings[] }`; exit 2 for a failing draft |
| `doctor` | `{ ok, store, profile, items: [{ name, status, detail }] }` |

## 3. Fact sections and fields

| Section (aliases) | Required | Optional |
|---|---|---|
| `identity` (contact) | — | name, headline, email, phone, location `{city, region, country}`, links `[{label, url}]`, work_authorization, relocation, remote_preference, pronouns |
| `targets` (goals) | — | roles[], industries[], seniority, locations[], compensation, notes |
| `summary` (pitch) | — | pitch, strengths[], notes |
| `experience` (job, role) | employer, title, start | end (null = present), location, type, industry, team_size, reports, scope, stack[], responsibilities[], achievements[], notes |
| `achievement` (bullet) `--parent exp-NN` | text | situation, task, action, result, metrics `[{value, unit, label}]`, skills[] (skill ids), tags[], notes |
| `education` (degree, school) | institution | degree, field, start, end, honors, location, coursework[], notes |
| `certifications` (cert, license) | name | issuer, date, expires, id_number, url, notes |
| `skills` | name | category, level (beginner, intermediate, advanced, expert), years, last_used, evidence[] (ids), aliases[], notes |
| `projects` | name | role, start, end, url, summary, stack[], outcomes[], metrics[], skills[], notes |
| `publications` (talk) | title | venue, date, url, role, notes |
| `awards` | name | issuer, date, notes |
| `volunteering` | organization | role, start, end, summary, outcomes[], notes |
| `languages` | name | level (basic, conversational, professional, fluent, native), notes |
| `extras` (fact, other) | text | tags[], notes |
| `documents` | path | kind, added, notes |

Dates: `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. Ids: `exp-01`, `ach-01-02`, `skill-react`,
`edu-01`, `cert-01`, `proj-01`, `pub-01`, `award-01`, `vol-01`, `lang-01`, `fact-01`,
`doc-01`. Provenance: `{ source: interview|document|user|import, confirmed, at, note }`.

## 4. Documents the scripts write

- `career-job/1` (`job.json`): title, company, seniority, location, remote, employment_type,
  years_required, years_mentions[], requirements[] `{id, kind, text, keywords[]}`, keywords[]
  `{term, category, kind, count, in_title}`, counts, warnings[], slug, text_sha256.
- `career-match/1` (`match.json`): fit, coverage `{must, nice, responsibility}` with
  strong/partial/missing counts, years, seniority, keywords[] `{term, kind, status,
  evidence[], use_verbatim}`, requirements[], highlights[], gaps[] `{term, kind, question}`.
- `career-resume-check/1` (`*.check.json`): verdict `PASS | PASS-WITH-FINDINGS | FAIL`,
  counts, findings[] `{severity, code, line, message}`, coverage with per-keyword rows,
  cited_ids[], document and job hashes, profile sequence.

## 5. Check codes

| Code | Severity | Meaning |
|---|---|---|
| `uncited` | fail | a claim line without `<!-- fact: ... -->` |
| `unknown-fact` · `unconfirmed-fact` | fail | a cited id that does not exist, or is not confirmed |
| `number-unsupported` | fail | a number in the line that none of the cited facts contains |
| `title-mismatch` · `employer-mismatch` · `date-mismatch` | fail | a role header or date line that differs from the experience entry |
| `misplaced-citation` | fail | an achievement cited under a different role than its own |
| `institution-mismatch` · `certification-mismatch` | fail | an education or certification line naming something else |
| `skill-unsupported` | fail | an item in the skills section that the cited facts do not contain |
| `unsupported-term` | fail (job keyword or skills section) or finding | a recognised term with no evidence anywhere in the profile |
| `contact-mismatch` · `name-mismatch` | fail | header details that differ from `identity` |
| `company-missing` · `placeholder` | fail (cover letter) | the company is never named; template text left in |
| `keyword-unused` | finding | a supported must or nice keyword never appears |
| `section-missing` · `header-missing` · `contact-missing` | finding | structure |
| `too-long` · `too-short` · `ats-table` · `ats-image` · `ats-style` · `style-first-person` · `style-greeting` · `title-missing` · `privacy` | finding | length, ATS and style |
