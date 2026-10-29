# Changelog

All notable changes to the `career-profiler` skill. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). The top entry always equals
`metadata.version` in [SKILL.md](skills/career-profiler/SKILL.md) and the Git tag `v<version>`.

## [0.2.0] - 2026-10-29

The merged plan: two independent plans were written against the owner's requirements, cross-
referenced with 0.1.0, and the common denominator built (`plans` repository,
`robertlemmermann_career-profiler/merged-plan.md`).

### Added

- **The automation-preference gate.** `preferences.json` (`career-preferences/1`: `automation`
  off, alert, draft or prepare; `submit: never`; the user's verbatim statement; a hash) echoed
  in the changelog and the manifest. `gate`, `gate record --confirm`, `gate options`, `gate
  probe`. Every data command exits 1 `GATE_REQUIRED` until the record verifies; no bypass flag;
  `--yes` is never confirmation. A corrupt record is quarantined with a `remake_reason` and must
  be re-made from a fresh statement; manifest drift or a failed daily write probe makes the store
  `degraded`.
- **Self-fix.** `MANIFEST.json` with sha256 of every file and a store layout version (a newer
  store is refused); `fsync` before every rename and a copy-and-verify fallback on Windows;
  `doctor --repair` recreates directories and permissions, truncates a broken changelog chain
  into `quarantine/`, rebuilds the manifest, logs each repair and reports
  `repaired_but_unverified` until the gate passes again.
- **Job sources.** `assets/sources/catalog.json` (Greenhouse, Lever, Ashby, SmartRecruiters,
  Workable, Remotive, Arbeitnow, USAJobs, Adzuna, Hacker News, RSS, alert emails, files) and
  `watch sources|add|list|remove|poll|run|inbox|schedule --show`. Polling needs no model;
  listings are deduplicated, parsed, matched and put in `inbox/`; `draft` writes application
  folders, `prepare` adds cited screening answers. Indeed, Glassdoor and LinkedIn are refused
  (`REFUSED_TOS_AUTOMATION`) with the alternative. Catalog rate limits, `--dry-run` URLs, a
  request that would carry a profile value is never sent.
- **PII controls.** `tier` on every fact (professional, restricted, never) with defaults;
  `assets/pii/detectors.json` (19 detectors) and `assets/export-policy.json`; `pii scan`; the
  value of never-tier and unreleased restricted facts must not appear in any document; scans
  inside `check`, `finalize`, `store export` and the watch request builder; `--include
  restricted:<field>` per document, logged; masked `store show` and `fact list`; the never-asked
  list in the interview; volunteered PII quarantined at tier `never`.
- **Facts.** `provenance.quote`; `fact stage` and `fact commit --confirm`; `fact add` requires
  `--confirm` or `--unconfirmed`; duplicate experience, skill and certification detection.
- **Matching and verification.** Gap questions capped at five (`ask_now`), must-haves first;
  declined gaps recorded as `extras` tagged `gap` and not asked again; expired credentials as
  `expired` with a question; per-term years; `exceeds` (leadership or expertise above the cited
  fact), `expired-credential`, `pii-block`, `pii-never`, `pii-review`; JSON Resume output;
  credentials-first layout for regulated roles; login-wall and bot-check detection; public ATS
  JSON endpoints for posting URLs; a 2 MB fetch cap.
- **Playbooks.** `setup.md`, `watch.md`, `sources.md`, `privacy.md`, `release.md`; step 0 in
  SKILL.md; "Without Node" sections in every script-driven playbook.
- **Tests and evals.** 76 unit tests (gate, PII, watch, repair, ATS endpoints, the preference ceiling, hand-edit handling, finalize scans, overclaims, declined gaps, expired credentials, paraphrase leaks, staging); an electrician
  profile and posting; feed fixtures; selftest areas `playbooks`, `pii-honeypots`, `ledger`;
  three personas with honeypot PII and deterministic answers; `interview-sim --sim
  deterministic|model`; trigger set 16/16; `run-trigger-set --host claude|copilot|codex`;
  twenty-nine new `claude plugin eval` cases (the gate first in every mode, corrupt and
  degraded records, changing the preference, confirm before any write, headless runs, trades
  vocabulary, expired credentials, overclaiming, declined gaps, posting bait, the preference
  ceiling on subscriptions, schedulers, store dumps and deletions, hand edits, and more); one
  llm grader per check with the facts the judge needs written into the grader; simulator
  conduct checks (never-asked items, questions per turn, confirm before commit, honeypot
  echoes, restricted fields out of the default export); `evals/ledger/ledger.jsonl` appended by every runner;
  `tests/manual-matrix.md`; a CI workflow on Linux, macOS and Windows with Node 22 and 24.

### Changed

- `threshold 1` and a Sonnet judge by default in `tests/run-evals.mjs`.
- Node 22+ stated in `compatibility`; the version guard matches.

## [0.1.0] - 2026-10-29

First release: a career fact store built by interview, and resumes plus cover letters tailored
to one job posting and proven against that store, for Claude Code, GitHub Copilot and Codex on
Windows, macOS and Linux with a zero-dependency Node 22 runtime.

### Added

- `skills/career-profiler/` with the six-field Agent Skills frontmatter, a mode router
  (`profile`, `resume`, `match`, `store`, `doctor`, `help`), operating principles and
  safety rules; playbooks under `references/`.
- The `career-profile/1` fact store: `profile.json` with identity, targets, summary,
  experience (with achievements, metrics and STAR fields), education, certifications,
  skills, projects, publications, awards, volunteering, languages, extras and source
  documents; every entry has an id and a provenance (`source`, `confirmed`).
- `scripts/cp.mjs`: `store` (init, path, show, validate, changelog, backup, accept, export,
  import, sync), `fact` (add, update, remove, confirm, list, get), `interview` (coverage,
  next, done), `job parse` (text, HTML or URL to `career-job/1`), `match` (gap analysis to
  `career-match/1`), `app new|list`, `resume` and `cover-letter` (`draft`, `check`,
  `finalize`), `doctor`. One JSON document per command with `--json`; exit codes 0/1/2/3/4.
- Hash-chained `changelog.jsonl`, a backup before every write, owner-only file modes, a
  `.gitignore` inside the store, and `store sync` for a dedicated private repository.
- `resume check`: every claim line cites fact ids; unknown, unconfirmed, misplaced and
  mismatched citations fail; numbers must come from the cited facts; employer, title, dates,
  institutions and certifications are compared with the store; skills lines and recognised
  terms need evidence; job keyword coverage, length and ATS findings are reported.
- `assets/taxonomy.json` (170+ terms with aliases across software, data, healthcare, sales,
  finance, operations, trades, education and general skills), `assets/question-bank.json`
  (gap-coded interview questions with domain probes) and `assets/schema/profile.schema.json`.
- Tests at the repository root: unit tests (`node --test`), `tests/selftest.mjs`, fixtures
  (two profiles, four postings, resumes), a 20-query trigger set, `claude plugin eval` cases
  with `tests/run-evals.mjs`, a Claude Code trigger-set runner and a simulated-candidate
  interview harness under `tests/live/`.
