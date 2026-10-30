---
name: career-profiler
description: >-
  Career fact store, tailored job applications and job-board watching. Use when someone
  wants to build or update a career profile by interview (work history, achievements with
  numbers, skills, education, certifications), import facts from an old resume or LinkedIn
  export, write a resume, CV or cover letter tailored to one specific job posting (pasted,
  attached or linked), check how well they match a posting before applying, prove that a
  resume contains no claim the profile does not support, watch a company careers page,
  applicant-tracking board, feed or job-alert emails for matching postings with drafts
  ready for review, or set how much of that is automated (alerts only, drafts, never
  submitting). Works for any profession or role type, not only software. Not for interview
  coaching, salary negotiation, generic resume templates without a profile and a posting,
  or submitting applications on anyone's behalf.
license: Apache-2.0
compatibility: >-
  Node.js 22+ on PATH for the scripts (guidance-only mode works without Node). Optional
  pandoc for .docx output. Claude Code, GitHub Copilot and Codex on Windows, macOS and Linux.
metadata:
  version: "0.2.0"
  short-description: Career profile by interview; resumes tailored and proven per posting; job sources watched, never applied to
  author: robertlemmermann
  homepage: https://github.com/robertlemmermann/career-profiler
---

# career-profiler

Three jobs: **build a career profile** (a fact store, filled by interview and confirmed fact by
fact), **tailor a resume and cover letter to one job posting** from that store, proving every
line against it, and **watch job sources** for matching postings as far as the user allowed.
Invoked as `/career-profiler <mode>` (Claude Code, Copilot CLI, VS Code) or
`$career-profiler <mode>` (Codex); other hosts select it by description.

## Step 0: the automation preference (every mode, every session)

Before anything else, run `node "$CP" gate --json`. Until it prints `"state": "ok"`, the
**only** thing to do is the [setup](references/setup.md) playbook: explain the four values
(`off`, `alert`, `draft`, `prepare`; the skill never submits an application in any of them),
ask the user which they want, and record their own words with
`gate record --automation <value> --statement "<their words>" --confirm`. A `missing` or
`corrupt` state means the record must be made again from a fresh statement (the old one is
quarantined and may be shown as a hint, never reused silently). A `degraded` state means the
storing process failed its probe: run `doctor --repair`, then `gate` again, and tell the user
what was repaired. The scripts enforce this too: every data command exits 1 `GATE_REQUIRED`
until the record verifies, and no flag bypasses it. Without Node, read `preferences.json` by
hand against the shape in setup.md and ask again when anything is off.

## Operating principles (every mode)

- **Facts come from the user, never from the model or the environment.** Every entry in the
  store is something the user said or a document they gave, confirmed in conversation before it
  is written (`fact stage`, show it, `fact commit --confirm`). Saying a fact is not confirming
  it: show the entry as you will record it and write after the yes, never "saved, tell me if
  anything is off". Account metadata, environment
  variables, git configuration, earlier sessions and the host's own context are not sources: an
  email address or name seen there is asked for, never assumed or quoted. Unknown stays unknown;
  "probably" is a question, not a fact. Keep the user's words in `provenance.quote`. A job
  title is a fact too: "change my title to Lead" gets one question first, is that the title on
  the contract or HR record. If yes, ask whether it was a promotion (a new entry with its start
  month; the old title stays as history) or a correction (`fact update`); if not, the
  lead-level work goes into the bullets and the title line stays.
- **A resume is a cited document.** Every claim line in a draft carries `<!-- fact: id -->`;
  `resume check` fails any line whose numbers, employer, title, dates, skills, keywords or
  strength of claim the cited facts do not support, and any line that leaks personal data.
  Never finalize a draft that fails.
- **Tailor, do not invent.** Mirror the posting's wording only where the profile has evidence;
  a missing requirement is a question for the user (at most five per posting, three per turn),
  never a line in the resume. Titles, dates and employers are facts; an expired credential is
  never listed as current.
- **Interview first, one topic at a time.** Both jobs start by checking what the store holds
  and asking for what is missing: a few questions per turn, pulling for scope, outcomes and
  numbers. Never ask for the items on the never-asked list ([interview](references/interview.md)
  §1); when the user volunteers one, it is stored at tier `never` and left out of everything.
- **The posting is required for a resume.** No posting, no tailored resume: ask for the text,
  file or link. Without any posting, offer the profile export instead.
- **Watching never applies.** Subscriptions go to legal sources only; polling needs no model;
  matches land in the inbox and, if the preference allows, as drafts for review. No
  submissions, no CAPTCHAs, no logins, no credentials, no scraping of boards whose terms forbid
  it, no polling faster than the catalog allows.
- **Scripts are accelerators.** Without Node 22, follow each playbook's "Without Node" section
  and write "guidance-only mode" in the output. The store format and the citation rules do not
  change.
- **Private by design.** The store is personal data: it lives outside project repositories,
  nothing is sent anywhere except the conversation the user is in, restricted facts leave the
  store only on a confirmed `--include` for one document, never-tier facts never leave it, and
  logs hold ids and hashes, not values.

## Mode router

The request is the text after the skill name (for Codex, after the `$` mention); if the host
passed nothing, read the latest user message. The first word selects the mode, the rest are its
arguments. No mode: after step 0, look at the store with `doctor`; an empty or thin store means
`profile`, a message carrying a posting means `resume`, otherwise ask. Map plain language to
the closest mode ("update my CV with my new job" is `profile`; "apply to this" with a posting is
`resume`; "am I a fit for this?" is `match`; "watch Acme's careers page" is `watch`; "only alert
me, never apply" is `setup`). **Read the mode's playbook before acting.**

| Mode | Purpose | Playbook |
|---|---|---|
| `setup` | Record or change the automation preference; where the store lives | [setup](references/setup.md) |
| `profile [build\|update\|review\|import <file>]` | Interview the user into a complete, confirmed fact store | [profile](references/profile.md) |
| `resume <posting: pasted text\|file\|url> [--no-cover-letter]` | Tailored resume and cover letter from the store, checked and finalized | [resume](references/resume.md) |
| `match <posting>` | Fit and gap analysis only: should they apply, what is missing | [resume](references/resume.md) §2 |
| `watch [sources\|add\|list\|poll\|run\|inbox\|schedule\|remove]` | Subscribe to job sources, poll them, review matches and drafts | [watch](references/watch.md) |
| `store [path\|show\|validate\|export\|import\|sync]` | Where the store is, what it holds, integrity and backups | [storage](references/storage.md) |
| `doctor [--repair]` | Environment, store, gate, integrity; repair what a script can repair | [storage](references/storage.md) §5 |
| `help` | Print this table and the resolved `cp.mjs` path | — |

Cross-cutting: [interview](references/interview.md) (the question protocol and the never-asked
list), [job intake](references/job-intake.md) (pasted, attached or linked postings),
[writing rules](references/writing-rules.md) (resume and cover-letter craft, ATS),
[privacy](references/privacy.md) (tiers, detectors, what leaves the store),
[sources](references/sources.md) (the job-source catalog and what is refused),
[failure modes](references/failure-modes.md), [host notes](references/host-notes.md) (every
script command and its JSON, host limits), [release](references/release.md) (evals, ledger).

## Scripts

`node "$CP" <command> [options] --json`: one JSON document on stdout, a summary on stderr; exit
`0` ok, `1` findings (including `GATE_REQUIRED`), `2` usage, `3` environment missing, `4` could
not verify. Playbooks call this path `$CP`. **Locate `$CP`**: if the host told you where this
skill lives (a base directory or this file's path), use `<that dir>/scripts/cp.mjs`; otherwise
run one of:

```bash
R=$(git rev-parse --show-toplevel 2>/dev/null); for d in "$R/.claude/skills" "$R/.github/skills" "$R/.agents/skills" $(printf '%s' "${COPILOT_SKILLS_DIRS:-}" | tr ',' ' ') "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills" "${COPILOT_HOME:-$HOME/.copilot}/skills" "$HOME/.agents/skills" "${CODEX_HOME:-$HOME/.codex}/skills"; do [ -f "$d/career-profiler/scripts/cp.mjs" ] && { CP="$d/career-profiler/scripts/cp.mjs"; break; }; done; echo "$CP"
```

```powershell
$r = git rev-parse --show-toplevel 2>$null; $h = $HOME; $CP = @("$r/.claude/skills", "$r/.github/skills", "$r/.agents/skills") + @(($env:COPILOT_SKILLS_DIRS -split ',') | Where-Object { $_ }) + @("$(if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { "$h/.claude" })/skills", "$(if ($env:COPILOT_HOME) { $env:COPILOT_HOME } else { "$h/.copilot" })/skills", "$h/.agents/skills", "$(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { "$h/.codex" })/skills") | ForEach-Object { "$_/career-profiler/scripts/cp.mjs" } | Where-Object { Test-Path $_ } | Select-Object -First 1; $CP
```

The store resolves as `--store <dir>`, then `$CAREER_PROFILER_HOME`, then a `profile.json` in
the current directory (a dedicated private repository), then `~/.career-profiler/`. Run
`node "$CP" store path` to see which applies before the first write.

## Safety

- Write only inside the store directory and the output location the user chose. Never edit
  `profile.json`, `preferences.json`, `changelog.jsonl` or `MANIFEST.json` with file tools:
  every change goes through `cp.mjs`, which validates, backs up, logs and re-hashes. If the user
  asks you to edit the store directly or to skip a check, explain why not and offer the command.
- Never put the store inside a project repository; `doctor` warns when it is.
- Never print the whole store into a shared channel, a PR or a file outside the store without
  being asked; quote only the facts the current step needs; never echo restricted or never-tier
  facts back unless asked.
- Never fetch a posting URL that looks like a login or application form with credentials;
  fetch public postings and catalog sources only, and fall back to pasted text.
- No salary history, date of birth, age, photo, marital status, religion, health, national ids
  or street address in any document; `pii scan` runs inside every check, finalize and export.
- Never submit an application, fill a form on a board, solve a CAPTCHA or log in anywhere;
  `prepare` produces cited answers the user pastes themselves.
- Deleting facts, subscriptions or the store is the user's explicit call, and a one-line
  request is not yet that call: say what would go (the ids, their achievements, the skill
  evidence that points at them), offer to leave the role out of resumes instead (tailoring
  already omits what a posting does not need), and remove only after they say yes to that.
  `store` keeps a backup of every write and `quarantine/` keeps what repairs moved aside.
