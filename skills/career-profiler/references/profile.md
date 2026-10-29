# Profile: build, update, review, import

The `profile` mode turns a conversation into a confirmed fact store. It is the foundation of
every resume the skill will write, so depth matters more than speed: a role with three
quantified achievements beats six roles with duties.

## Contents

- [1. Before the first question](#1-before-the-first-question)
- [2. Build (a new or thin store)](#2-build-a-new-or-thin-store)
- [3. Update (new job, promotion, new skill)](#3-update-new-job-promotion-new-skill)
- [4. Import (an old resume, LinkedIn export, portfolio)](#4-import-an-old-resume-linkedin-export-portfolio)
- [5. Review (read the store back)](#5-review-read-the-store-back)
- [6. Writing facts](#6-writing-facts)
- [7. Output of the mode](#7-output-of-the-mode)
- [Manual fallback (guidance-only mode)](#manual-fallback-guidance-only-mode)

## 1. Before the first question

1. Locate `$CP` (SKILL.md) and run `node "$CP" doctor --json`. Note the store path and
   whether it exists. Tell the user where their data will live in one sentence, and offer
   `--store <dir>` or `CAREER_PROFILER_HOME` if they want it elsewhere
   ([storage](storage.md)). If `doctor` warns that the store is inside a project repository,
   stop and move it first.
2. No store: `node "$CP" store init --name "<name if known>" --json`.
3. `node "$CP" interview coverage --json`: the score, the sections and the ordered `gaps[]`.
   Each gap carries the question to ask, its `key` and its probes. Coverage decides the
   agenda; do not improvise a questionnaire.
4. Say what will happen: a short interview, a few questions at a time, every answer confirmed
   before it is saved, stop whenever they like. Ask whether they have an existing resume or
   LinkedIn export to start from (§4); it saves most of the typing.

## 2. Build (a new or thin store)

Follow [interview](interview.md) for the conversation rules. The order is the gap priority
from `interview next`: identity, documents, work history most recent first, then the depth
pass per role (scope, stack, achievements with numbers), skills, education, certifications,
and the optional sections.

Per turn:

1. `node "$CP" interview next --max 3 --json` and ask those questions in your own words,
   grouped naturally (identity questions together; one role at a time).
2. Turn the answer into facts. Show them back briefly ("I will record: ...") and ask for a
   yes or a correction when anything is inferred, rounded or ambiguous. Exact titles, dates
   and numbers always get a confirmation.
3. Write with `fact add` (§6). Batch the facts of one answer in one `--data '[...]'` call.
4. When the user says a section does not apply ("no certifications"), record it:
   `node "$CP" interview done certifications.none --json`, so the question is not repeated.
5. Every few turns, `interview coverage` again and tell the user the score and what is left.
   `resume_ready: true` means a tailored resume is possible; the interview can continue or
   stop there.

Depth pass per role (the part that makes resumes good): for each role ask for three to five
achievements as situation, action, result; pull for a number for each (percent, money, time,
volume, people, quality or safety measure); ask which tools or skills were central; record
`metrics[]` with `value`, `unit` and `label` so `resume check` can verify them later.

## 3. Update (new job, promotion, new skill)

"I started at X", "I got promoted", "add that I learned Y":

1. `node "$CP" fact list experience --json` to see the current roles.
2. A new role: `fact add experience` with employer, title, start and `end: null`; then, if the
   previous role is still open, `fact update <id> --data '{"end":"YYYY-MM"}'`.
3. A promotion is a **new experience entry** at the same employer with the new title and
   start date (resumes list it that way); close the old one. Never overwrite the old title.
4. A new skill: `fact add skills` with level, years and `last_used`; then ask where it was
   used and attach evidence (`evidence: ["ach-.."]`) or a new achievement.
5. Run the depth pass (§2) for the new role.

## 4. Import (an old resume, LinkedIn export, portfolio)

1. Read the document (pasted text or a file; a PDF or DOCX through the host's reader).
   Copy it into the store: `documents/<name>` under `node "$CP" store path`, then
   `fact add documents --data '{"path":"documents/<name>","kind":"resume","added":"YYYY-MM-DD"}' --source document`.
2. Extract candidate facts: roles (employer, title, dates), bullets as achievements, skills,
   education, certifications. Write them **unconfirmed**:
   `fact add experience --data '[...]' --source document --unconfirmed`.
3. Walk the user through them section by section: "Your resume says X; is that exact?"
   Dates and titles first. Confirm with `fact confirm <id>...`; fix with `fact update`;
   drop with `fact remove`. An unconfirmed fact never reaches a resume, so nothing is lost by
   confirming later.
4. Old bullets are usually duties without numbers; run the depth pass (§2) on them.

## 5. Review (read the store back)

`node "$CP" store export --format md` renders the whole store with ids and marks unconfirmed
entries. Use it when the user asks "what do you have on me", before a long update, or to
hand them a copy. `store validate` reports structural problems, the changelog chain and
unconfirmed ids.

## 6. Writing facts

Sections: `identity`, `targets`, `summary` (singletons, written with `fact update identity
--data '{...}'`), and the lists `experience`, `achievement` (needs `--parent exp-NN`),
`education`, `certifications`, `skills`, `projects`, `publications`, `awards`,
`volunteering`, `languages`, `extras` (any other fact as text), `documents`. Field names and
rules: [host notes](host-notes.md) §3 and `assets/schema/profile.schema.json`.

```bash
node "$CP" fact add experience --data '{"employer":"Brightline Payments","title":"Senior Software Engineer","start":"2022-03","end":null,"location":"San Francisco, CA (remote)","type":"full-time","team_size":8,"scope":"Frontend architecture for the merchant dashboard","stack":["React","TypeScript"]}' --json
node "$CP" fact add achievement --parent exp-01 --data '{"text":"Led the migration to React, cutting p95 page load from 4.1s to 1.6s.","metrics":[{"value":4.1,"unit":"s","label":"p95 before"},{"value":1.6,"unit":"s","label":"p95 after"}],"skills":["skill-react"]}' --json
node "$CP" fact add skills --data '[{"name":"React","category":"frontend","level":"expert","years":8,"last_used":"2026"},{"name":"PostgreSQL","category":"database","level":"advanced","years":7}]' --json
```

```powershell
node $CP fact add skills --data '[{"name":"React","category":"frontend","level":"expert","years":8}]' --json
```

Rules: dates are `YYYY-MM` (or `YYYY`); `end: null` means present; `level` is beginner,
intermediate, advanced or expert; achievement `text` is one result sentence in the implied
first person ("Led ...", not "I led" and not "Responsible for"); every number in the text
also goes into `metrics[]`. A write that fails validation is a usage error (exit 2) and
nothing is saved: fix the data and retry. The scripts back up the previous file before every
write and append a hash-chained changelog entry.

## 7. Output of the mode

End every profile session with: the store path, the coverage score before and after, the
ids added or changed, the unconfirmed ids still open, and the next questions if the user
wants to continue. Never paste the whole store unless asked.

## Manual fallback (guidance-only mode)

Without Node 22: write "guidance-only mode" in your output. Keep `profile.json` by hand in
the shape of `assets/schema/profile.schema.json`: a `schema` of `career-profile/1`, ids
`exp-01`, `ach-01-01`, `skill-<slug>`, and a `provenance` `{ "source", "confirmed", "at" }`
on every entry. Ask the questions from `assets/question-bank.json` in priority order. Keep
every number in the achievement text and in `metrics[]`. Validate the JSON by reading it back
before ending the session.
