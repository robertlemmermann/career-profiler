# Resume and cover letter: tailor, prove, finalize

The `resume` mode turns one job posting and the fact store into a resume and a cover letter
that are tailored to that posting and proven against the store. `match` is the first half of
the same flow and stops after the gap analysis.

## Contents

- [1. Intake](#1-intake)
- [2. Match and gaps (also the `match` mode)](#2-match-and-gaps-also-the-match-mode)
- [3. Targeted interview](#3-targeted-interview)
- [4. Write the resume](#4-write-the-resume)
- [5. Write the cover letter](#5-write-the-cover-letter)
- [6. Check until it passes](#6-check-until-it-passes)
- [7. Finalize and hand over](#7-finalize-and-hand-over)
- [Manual fallback (guidance-only mode)](#manual-fallback-guidance-only-mode)

## 1. Intake

0. Step 0 of SKILL.md: `node "$CP" gate --json` must be `ok`; otherwise [setup](setup.md) first.
1. The posting is required. Take it from the message (pasted text), a file (`--file`, an
   attachment the host exposes as a path) or a URL. No posting: ask for one and stop; offer
   `store export` if they only want a general resume. Details: [job intake](job-intake.md).
2. The store must be resume-ready: `node "$CP" doctor --json` (`profile.resume_ready`). If
   not, run the `profile` playbook first; say so and start it in the same session.
3. Parse: `node "$CP" job parse <file|url|-> --out job.json --json` (pasted text: write it to
   a file first, or pipe it to `-`). Read `title`, `company`, `seniority`, `years_required`,
   `keywords` (must, nice, responsibility) and `warnings`. Fix a wrong or missing title or
   company with `--title` and `--company`; if the heuristics missed obvious requirements,
   tell the user what you read instead and keep going (the model's reading of the posting
   wins over the heuristics; the file is for the checks).

## 2. Match and gaps (also the `match` mode)

`node "$CP" match job.json --out match.json --json` reports `fit` (0 to 1), coverage per
keyword kind, `years` (total and per term) and `seniority` verdicts, every keyword with status
`strong`, `partial`, `expired` or `missing` and its evidence ids, `gaps[]` with a question per
missing or expired term (must-haves first, `ask_now` on the first five), and `declined[]` for
terms the user already said no to.

Tell the user the picture in plain words: fit, the strongest matches, what is missing, and
whether seniority or years are a stretch. In `match` mode this is the deliverable: add a
recommendation (apply, apply with the gaps named in the cover letter, or skip) and stop.

## 3. Targeted interview

Ask the `ask_now` gaps (at most five per posting, three per turn, must-haves first); the rest
are reported, not asked. Three outcomes:

- The user has the experience: record it (`fact add skills` and an achievement or `extras`
  fact with evidence), confirm, then `match` again.
- They have something adjacent: record what is true (a `partial` is fine) and plan to show it
  honestly ("exposure to", "worked alongside").
- They do not: it stays out of the resume. Record the no so it is not asked again for this
  posting: `fact add extras --data '{"text":"No Kubernetes experience (asked for Acme Ledger)","tags":["gap","<decline_tag from gaps[]>"]}' --confirm`.
  The cover letter may address a key gap in one honest sentence if the user wants.
- An `expired` credential: ask whether it was renewed; update `expires` with the new date, or
  leave it off the resume (the draft already omits it with a comment).

Also ask once for anything the posting emphasises that the store lacks a number for, and
whether a role should be de-emphasised or omitted (short stints, unrelated work). Stop
interviewing when the must-have gaps are resolved or declined; do not re-interview the
whole profile.

## 4. Write the resume

1. `node "$CP" app new job.json --json` creates `applications/<date>-<slug>/` in the store
   with `job.json`, `match.json`, `resume.md` and `cover-letter.md` drafts. The resume draft
   places every structural fact with its citation and lists achievements per role in order
   of relevance to the posting. Work in that folder.
2. Rewrite the draft for this posting, following [writing rules](writing-rules.md):
   - Summary: two or three sentences that answer the posting's headline needs with the
     strongest facts; cite `summary` and the facts used.
   - Skills: the posting's wording where the profile supports it (React, TypeScript, CI/CD),
     most relevant group first; everything listed must be in the cited facts.
   - Experience: most recent first; per role three to six bullets, the ones that answer the
     posting first; each bullet is one result with its number, rewritten to mirror the
     posting's terms where the fact supports them; keep `<!-- fact: ach-.. -->` on each line.
     Cut low-relevance bullets rather than shortening everything.
   - Education, certifications, projects: keep what the posting cares about; drop the rest.
   - Length: one page for under ten years, two at most. Target 350 to 700 words.
3. Rules that `resume check` enforces (§6): every claim line cites facts; numbers come from
   the cited facts; titles, employers, dates, institutions match the store; the skills section
   only lists what the cited facts contain; a job keyword with no profile evidence is a fail; a
   leadership or ownership verb, or "expert", needs a fact that records it (`exceeds`); an
   expired credential is not listed as current; no never-tier fact and no personal data beyond
   the chosen contact details (`pii-block`), and a restricted fact only with
   `--include restricted:<field>` after the user said yes.

## 5. Write the cover letter

Unless the user said `--no-cover-letter`, fill `cover-letter.md`: greeting to the company's
hiring team (or a named person from the posting), an opening that names the role and the
strongest reason, one paragraph of evidence (two results with numbers, cited), one paragraph
on why this company or team (in their words from the posting), a closing. 250 to 400 words,
every body paragraph cited, the company and role named, no placeholders. The user chooses
whether to send it; produce it anyway so the choice is theirs.

## 6. Check until it passes

```bash
node "$CP" resume check resume.md --job job.json --match match.json --json
node "$CP" cover-letter check cover-letter.md --job job.json --json
```

The report lists `findings[]` with `severity` (`fail` blocks, `finding` advises), `code`,
`line` and a message, plus `coverage` (must and nice keywords supported versus used). Fix
every `fail` in the draft (never by editing the store to fit the resume: a fact changes only
when the user corrects it), re-run, repeat until `verdict` is `PASS` or `PASS-WITH-FINDINGS`.
Read the findings too: an unused supported keyword is usually worth a rewrite. Codes:
[host notes](host-notes.md) §5.

## 7. Finalize and hand over

```bash
node "$CP" resume finalize resume.md --job job.json --formats md,txt,html,docx --json
node "$CP" cover-letter finalize cover-letter.md --job job.json --formats md,txt,html --json
```

`finalize` refuses a failing draft, strips the citations and writes `resume.final.md`,
`resume.txt` (ATS-safe plain text), `resume.html` (print to PDF from a browser), `resume.json`
(JSON Resume, with `json` in `--formats`) and, when pandoc is installed, `resume.docx`. A
restricted fact the posting needs (work authorization, relocation, salary expectations for the
letter) goes in only after the user's yes, with `--include restricted:<field>` on `check` and
`finalize`; the include is logged in the changelog. The cited draft and `resume.check.json` stay in the
application folder as the evidence for every line. Hand over: the folder path, the files, the
fit and coverage numbers, the gaps that were declined, and one line on how to regenerate after
a profile change (`app new` again, or edit and `check`).

## Manual fallback (guidance-only mode)

Without Node 22, write "guidance-only mode", check `preferences.json` first ([setup](setup.md),
Without Node) and do the same by hand: list the posting's
must-have and nice-to-have terms; for each, find the supporting entry in `profile.json` (or
ask); write the resume with `<!-- fact: id -->` on every line; then check each line yourself
against the cited entry (numbers, title, employer, dates, listed skills) and remove what you
cannot cite. Keep the cited draft and deliver a copy with the comments removed.
