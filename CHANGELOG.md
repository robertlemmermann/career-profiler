# Changelog

All notable changes to the `career-profiler` skill. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). The top entry always equals
`metadata.version` in [SKILL.md](skills/career-profiler/SKILL.md) and the Git tag `v<version>`.

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
