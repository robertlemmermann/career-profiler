---
name: career-profiler
description: >-
  Career fact store and tailored job applications. Use when someone wants to build or
  update a career profile by interview (work history, achievements with numbers, skills,
  education, certifications), import facts from an old resume or LinkedIn export, write a
  resume, CV or cover letter tailored to one specific job posting (pasted, attached or
  linked), check how well they match a posting before applying, or prove that a resume
  contains no claim the profile does not support. Works for any profession or role type,
  not only software. Not for interview coaching, salary negotiation, job searching or
  generic resume templates without a profile and a posting.
license: Apache-2.0
compatibility: >-
  Node.js 22+ on PATH for the scripts (guidance-only mode works without Node). Optional
  pandoc for .docx output. Claude Code, GitHub Copilot and Codex on Windows, macOS and Linux.
metadata:
  version: "0.1.0"
  short-description: Career profile by interview; resumes tailored and proven per posting
  author: robertlemmermann
  homepage: https://github.com/robertlemmermann/career-profiler
---

# career-profiler

Two jobs: **build a career profile** (a fact store, filled by interview and confirmed fact by
fact) and **tailor a resume and cover letter to one job posting** from that store, proving every
line against it. Invoked as `/career-profiler <mode>` (Claude Code, Copilot CLI, VS Code) or
`$career-profiler <mode>` (Codex); other hosts select it by description.

## Operating principles (every mode)

- **Facts come from the user, never from the model.** Every entry in the store is something the
  user said or a document they gave, confirmed in conversation before it is written. Unknown
  stays unknown; "probably" is a question, not a fact.
- **A resume is a cited document.** Every claim line in a draft carries `<!-- fact: id -->`;
  `resume check` fails any line whose numbers, employer, title, dates, skills or keywords the
  cited facts do not support. Never finalize a draft that fails.
- **Tailor, do not invent.** Mirror the posting's wording only where the profile has evidence;
  a missing requirement is a question for the user (and, if they confirm it, a new fact), never
  a line in the resume. Titles, dates and employers are facts; do not inflate or round them.
- **Interview first, one topic at a time.** Both jobs start by checking what the store holds
  and asking for what is missing: a few questions per turn, pulling for scope, outcomes and
  numbers. The user can stop at any time; the store keeps what was confirmed.
- **The posting is required for a resume.** No posting, no tailored resume: ask for the text,
  file or link. Without any posting, offer the profile export instead.
- **Scripts are accelerators.** Without Node 22, follow the playbook's manual steps and write
  "guidance-only mode" in the output. The store format and the citation rules do not change.
- **Private by design.** The store is personal data: it lives outside project repositories,
  nothing is sent anywhere except the conversation the user is in, and nothing is logged.

## Mode router

The request is the text after the skill name (for Codex, after the `$` mention); if the host
passed nothing, read the latest user message. The first word selects the mode, the rest are its
arguments. No mode: look at the store with `doctor`; an empty or thin store means `profile`, a
message carrying a posting means `resume`, otherwise ask. Map plain language to the closest
mode ("update my CV with my new job" is `profile`; "apply to this" with a posting is `resume`;
"am I a fit for this?" is `match`). **Read the mode's playbook before acting.**

| Mode | Purpose | Playbook |
|---|---|---|
| `profile [build\|update\|review\|import <file>]` | Interview the user into a complete, confirmed fact store | [profile](references/profile.md) |
| `resume <posting: pasted text\|file\|url> [--no-cover-letter]` | Tailored resume and cover letter from the store, checked and finalized | [resume](references/resume.md) |
| `match <posting>` | Fit and gap analysis only: should they apply, what is missing | [resume](references/resume.md) §2 |
| `store [path\|show\|validate\|export\|import\|sync]` | Where the store is, what it holds, integrity and backups | [storage](references/storage.md) |
| `doctor` | Environment, store location, validity, coverage | [storage](references/storage.md) §5 |
| `help` | Print this table and the resolved `cp.mjs` path | — |

Cross-cutting: [interview](references/interview.md) (the question protocol both jobs use),
[job intake](references/job-intake.md) (pasted, attached or linked postings),
[writing rules](references/writing-rules.md) (resume and cover-letter craft, ATS),
[failure modes](references/failure-modes.md), [host notes](references/host-notes.md) (every
script command and its JSON, host limits).

## Scripts

`node "$CP" <command> [options] --json`: one JSON document on stdout, a summary on stderr; exit
`0` ok, `1` findings, `2` usage, `3` environment missing, `4` could not verify. Playbooks call
this path `$CP`. **Locate `$CP`**: if the host told you where this skill lives (a base directory
or this file's path), use `<that dir>/scripts/cp.mjs`; otherwise run one of:

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

- Write only inside the store directory and the output location the user chose. Never put the
  store inside a project repository; `doctor` warns when it is.
- Never print the whole store into a shared channel, a PR or a file outside the store without
  being asked; quote only the facts the current step needs.
- Never fetch a posting URL that looks like a login or application form with credentials;
  fetch public postings only, and fall back to pasted text.
- No salary history, date of birth, photo, marital status or full street address in a resume
  unless the user asks and the target market expects it.
- Deleting facts or the store is the user's explicit call; `store` keeps a backup of every write.
