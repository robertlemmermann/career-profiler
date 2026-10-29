# Privacy: tiers, detectors and what leaves the store

## 1. Tiers

Every fact has a tier (`professional` by default):

| Tier | Leaves the store | Examples |
|---|---|---|
| `professional` | in resumes, cover letters, answers and exports | roles, achievements, skills, education, current certifications, the chosen contact details |
| `restricted` | only on a confirmed `--include restricted:<field>` for one document or export, logged in the changelog | `identity.work_authorization`, `identity.relocation`, `targets.compensation`, `certifications.id_number` |
| `never` | never, under no flag | anything the detectors recognise as date of birth, age, national id, street address, marital or family status, religion, health, ethnicity, bank details; anything the user marks `--tier never` |

`fact add` and `fact commit` assign `never` automatically when a detector fires and say so;
`store show --tier restricted` and `fact list --tier restricted` reveal restricted fields;
nothing lists never-tier values (`fact list` shows them as `[never-tier fact]`; `fact get <id>`
shows one when you need it); `store export` masks and releases only with `--include ... --confirm`.

## 2. The never-asked list

The interview does not ask for: date of birth or age; national identity, passport, tax or
social security numbers; street address; marital or family status; religion or belief; health,
disability or medical history; ethnicity, nationality or citizenship as an attribute; a photo;
bank or payment details. When the user volunteers one, say in one sentence that it is kept at
tier never and used only to respect their constraints, never written anywhere.

## 3. Where the scan runs

`pii scan` (detectors in `assets/pii/detectors.json`, policy in `assets/export-policy.json`)
runs inside `resume check` and `cover-letter check` (a `block` is a fail), `finalize` and
`store export` (refused on a block), the watch request builder (a request carrying a protected
value is never sent) and the notification payload (title, company, URL, fit only). The strongest
check is value-based: the exact text of never-tier facts and unexported restricted fields must
not appear. Review-class hits (marital status, religion, health terms, a second email or
phone) are reported for a decision, not blocked, because some are job words ("nurse").

## 4. Logs and transcripts

`changelog.jsonl` holds operations, ids, hashes and notes, never fact values. Playbooks never
echo restricted or never-tier facts back unless the user asks, and summarise rather than quote
when confirming one ("I noted a health constraint; I will only use it to filter").
