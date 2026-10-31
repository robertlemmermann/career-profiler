# Failure modes

What goes wrong when a model writes resumes, and what in this skill stops it.

| FM | Failure mode | Stopped by |
|---|---|---|
| FM-01 | Fabricated experience: a skill, tool or employer the user never had, because the posting asked for it | `unsupported-term`, `skill-unsupported`, `unknown-fact`; gaps are questions, never lines |
| FM-02 | Inflated numbers: "60%" becomes "70%", "1,200" becomes "2,000", a vague "a lot" becomes a figure | `number-unsupported`: every number must be in a cited fact |
| FM-03 | Title inflation: "Senior" becomes "Lead" or "Principal" to match the posting | `title-mismatch`; titles are facts, the lead work goes into bullets |
| FM-04 | Date drift: gaps closed, tenures stretched | `date-mismatch` against the store |
| FM-05 | Misattribution: an achievement moved to the employer the posting will like | `misplaced-citation` |
| FM-06 | Unconfirmed facts from an old resume treated as true | `provenance.confirmed`; `unconfirmed-fact` fails; drafts skip them |
| FM-07 | Keyword stuffing: the posting's words pasted without evidence | terms need evidence; the skills section must match the cited facts |
| FM-08 | Keyword blindness: supported terms left out, so the screen misses them | `keyword-unused` findings with the evidence ids |
| FM-09 | Generic resume: the same document for every posting | the posting is required; `match` orders bullets by relevance; the draft is regenerated per application |
| FM-10 | Interrogation fatigue: forty questions in one turn, or a questionnaire for a software engineer sent to a nurse | three questions per turn, coverage-driven order, domain probes from the profile |
| FM-11 | Silent inference: the model "remembers" a detail the user never said | confirm before `fact add`; the store is the only memory |
| FM-12 | Store corruption or loss: a bad write, a hand edit, a sync conflict | validation before every write, atomic writes, backups, hash-chained changelog, `store accept` |
| FM-13 | Personal data in the wrong place: the store committed into a project repository, printed into a PR | store resolution rules, `doctor` warning, `store sync` refusal, the safety section of SKILL.md |
| FM-14 | Cover letter with placeholders or the wrong company name | `placeholder`, `company-missing` |
| FM-15 | Finalizing a draft that fails | `finalize` refuses a `FAIL` |
| FM-16 | Headless run pretends to interview | no human means report the gaps and stop |
| FM-17 | Overclaiming: "led" cited to a fact that says "worked on"; "expert" above the recorded level | `exceeds` fails the line |
| FM-18 | Expired licence or certification listed as current | `match` marks it `expired` with a question; the draft omits it; `expired-credential` fails the line |
| FM-19 | Personal data in a document: date of birth, national id, street address, health, family, religion, a never-tier fact, an unreleased restricted fact | tiers, detectors and value checks in `check`, `finalize` and `export` (`pii-block`, `pii-never`); the never-asked list in the interview |
| FM-20 | Automation the user did not choose: watching, drafting or preparing without a recorded preference, or submitting anything | the gate (`GATE_REQUIRED` from every data command), `submit: never` in the record, refusals in `watch` |
| FM-21 | A corrupt or missing preference record silently reused, or a degraded store written to | `gate` quarantines and demands a fresh statement; the daily probe and `doctor --repair` log every repair; `repaired_but_unverified` until a fresh gate passes |
| FM-22 | A profile value sent to a job board, or a board's terms broken | requests carry subscription terms only and are scanned; refused families and hosts; catalog rate limits |
| FM-23 | Facts written on the model's say-so | `fact stage` then `fact commit --confirm`; `--yes` is never confirmation; `provenance.quote` |
| FM-24 | A never-tier fact leaks by paraphrase | the value check matches any run of six words of a long never-tier fact; the playbooks paraphrase only the constraint, never the detail |
| FM-25 | A repair that rewrites what the user did not approve | `doctor --repair` never touches `profile.json`; a hand edit stays `degraded` until `store accept --confirm` or a restore |

Known limits: the checker proves consistency with the store, not the truth of the store (a
user can lie to the interview); the keyword heuristics miss requirements written as prose
(the model reads the posting too); `unsupported-term` cannot see synonyms the taxonomy lacks
(add the skill with `aliases` and it will); a URL behind a login cannot be fetched.
