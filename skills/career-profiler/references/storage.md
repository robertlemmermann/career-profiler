# Storage: where the facts live and how they stay safe

## Contents

- [1. The store](#1-the-store)
- [2. Where it resolves](#2-where-it-resolves)
- [3. Integrity: backups, changelog, permissions](#3-integrity-backups-changelog-permissions)
- [4. Roaming: phone, several computers, sharing the skill](#4-roaming-phone-several-computers-sharing-the-skill)
- [5. doctor and store commands](#5-doctor-and-store-commands)
- [6. Why not a database](#6-why-not-a-database)

## 1. The store

One directory:

| Path | What it holds |
|---|---|
| `profile.json` | the fact store, `career-profile/1`, written only by `cp.mjs` |
| `preferences.json` | the automation preference record (`career-preferences/1`), hashed; see [setup](setup.md) |
| `MANIFEST.json` | sha256 of every store file, the store layout version, the last write-probe result; written last after every write |
| `changelog.jsonl` | one hash-chained line per write (op, ids, before and after hashes, preference hashes, repairs, includes) |
| `backups/` | `profile.<UTC stamp>.json`, the file as it was before each write (last 50) |
| `documents/` | files the user supplied (old resumes, exports); read by the model, never parsed by the scripts |
| `applications/<date>-<slug>/` | per posting: `job.json`, `match.json`, `resume.md` (cited draft), `resume.check.json`, finalized outputs, `cover-letter.*`, `answers.md` in prepare mode |
| `staging/` | facts staged with `fact stage`, waiting for the user's yes (`fact commit --confirm`) |
| `quarantine/` | what repairs and the gate moved aside: corrupt preference records, changelog tails, previous records |
| `watch/`, `inbox/` | subscriptions and seen listings; inbox items; `inbox/email/` for saved job-alert emails |
| `.gitignore` | ignores `backups/`, `staging/`, `quarantine/`, `.probe/` and temp files when the store is its own repository (quarantined records never sync) |

Files are created owner-only (`0600`, `0700`) on POSIX systems.

## 2. Where it resolves

1. `--store <dir>` on the command line.
2. `CAREER_PROFILER_HOME` in the environment.
3. The current directory, when it holds a `profile.json` with schema `career-profile/1`
   (a dedicated private repository the user opened the host in).
4. `~/.career-profiler/` (the default for a personal computer).

`node "$CP" store path --json` shows the resolved directory and why. A store inside a project
repository is a mistake: `doctor` and `store sync` warn and refuse respectively. The rule:
personal data lives in the home directory or in its own private repository, never next to
code.

## 3. Integrity: backups, changelog, permissions

- Every write validates the whole profile first (exit 2 on a bad fact, nothing written),
  backs up the previous file, writes atomically, then appends a changelog entry whose hash
  covers the entry and the previous hash.
- `store validate` checks the structure, the chain, the manifest, the gate and whether the
  file matches the last logged hash. A hand edit, a sync conflict or a restore shows as
  "changed outside the scripts": review it, then `store accept --confirm` to log the current
  file as the accepted state, or restore the latest file from `backups/` over it. Until one of
  those happens the gate is `degraded` and `doctor --repair` leaves the file and the manifest
  alone: a repair never blesses a hand edit.
- Every write ends by rewriting `MANIFEST.json`; `doctor` reports drift (a file changed behind
  the scripts) and `doctor --repair` rebuilds the manifest, recreates missing directories and
  permissions, truncates a broken changelog chain into `quarantine/` and logs each repair as a
  `repair` entry. A store written by a newer skill version (`store_version` in the manifest) is
  refused with exit 3 rather than rewritten.
- The gate runs a write-fsync-read-hash probe once a day (`last_probe_at` in the manifest);
  a failing probe makes the store `degraded` before any data write happens.
- `store backup` forces a backup; restoring is copying a file from `backups/` over
  `profile.json` followed by `store accept`.
- Unconfirmed facts (`provenance.confirmed: false`) are kept but never cited; `doctor` lists
  them.
- Nothing here is encryption. Protect the directory the way you protect any personal file:
  disk encryption, a private repository, no shared machines.

## 4. Roaming: phone, several computers, sharing the skill

The skill runs wherever an agent host runs; the store follows one of three patterns:

| Pattern | Set-up | Works on |
|---|---|---|
| **Home directory** (default) | nothing to do; `~/.career-profiler/` | one computer with Claude Code, Copilot or Codex |
| **Dedicated private repository** | `git init` a private repo (for example `career-profile`), install the skill into it (`.claude/skills/`, `.agents/skills/`, `.github/skills/`), run `store init` **inside it** so the store resolves from `cwd`; `store sync` commits and pushes after sessions | every computer that clones it; **phones and tablets** through Claude Code on the web or in the Claude app (open a session on that repository, ask for a resume, the files are committed back); Copilot cloud agent and Codex cloud on the same repository |
| **Portable file** | keep `profile.json` in a synced folder (iCloud, Dropbox, OneDrive) and point `CAREER_PROFILER_HOME` at it, or paste `store export --format json` into a chat and `store import` it elsewhere | ad-hoc moves, hosts without a shell (chat-only: the model follows the guidance-only fallbacks with the file in context) |

Giving the skill to someone else: they install the skill (README), run `store init`, and the
interview begins; nothing in the skill is tied to one person, and every store is separate.

## 5. doctor and store commands

`doctor` reports Node, host, OS, pandoc, the store path and its source, validity, warnings,
unconfirmed facts, coverage, the changelog chain, file permissions and git status. `store`
commands: `init`, `path`, `show`, `validate`, `changelog`, `backup`, `accept`, `export
[--format md|json] [--out f]`, `import <profile.json>`, `sync [--message m]` (dedicated
repositories only; best effort, never fails a session). Full table: [host notes](host-notes.md).

## 6. Why not a database

A career profile is a few hundred facts that change a few times a year and must be readable
by a model, a human and a script on any machine, including a phone session with no package
manager. A JSON file with a schema, validation on every write, backups and a hash-chained
changelog gives the integrity a database would (and `git` gives history and roaming) without
a server, a driver, a native module or a credential to manage. PostgreSQL or SQLite stay
possible as a later adapter behind the same `store` commands if a user wants querying across
many profiles; a single person's profile does not need them.

## Without Node

Read `profile.json`, `preferences.json` and the last lines of `changelog.jsonl` by hand; the
shapes are in `assets/schema/profile.schema.json` and [setup](setup.md). You cannot verify
hashes without Node: say so, write "guidance-only mode", and leave `MANIFEST.json` alone (the
next session with Node repairs it). Back up by copying `profile.json` before any hand edit.
