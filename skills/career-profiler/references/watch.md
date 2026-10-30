# Watch: job sources, polling, the inbox and drafts

Tracks legal job sources against the profile as far as the recorded preference allows. Polling
needs no model and no credentials beyond optional API keys; the model's work starts when a
match is in the inbox.

## Contents

- [1. Subscribe](#1-subscribe)
- [2. Poll](#2-poll)
- [3. The inbox and the drafts](#3-the-inbox-and-the-drafts)
- [4. Keeping it running](#4-keeping-it-running)
- [5. What is refused](#5-what-is-refused)
- [Without Node](#without-node)

## 1. Subscribe

Step 0 applies: `gate` must be `ok` and the preference must not be `off`. Then:

```bash
node "$CP" watch sources --json                                   # the catalog and the refusals
node "$CP" watch add --source greenhouse --board acmeledger --json
node "$CP" watch add --source lever --board brightline --mode alert --json
node "$CP" watch add --source rss --url https://jobs.example.org/feed.rss --query "nurse icu" --json
node "$CP" watch add --source email --json                        # job-alert emails saved under <store>/inbox/email/
node "$CP" watch add --source file --path ~/postings --json       # a folder of pasted postings
```

Families, their arguments and their terms are in [sources](sources.md). `--mode` lowers the
preference for one subscription (`alert` on a `draft` user); it never raises it. A subscription
cannot be more automated than the recorded preference: `watch add --mode draft` on an `alert`
user is refused by the script, and by you. When the user wants drafts for one board, the path
is [setup](setup.md) first (their words, their yes, `gate record`), then the subscription;
otherwise subscribe in `inherit` or `alert` mode; `--min-fit` (default 0.6) is the match score below which a
listing is ignored. Keyed sources (Adzuna, USAJobs) read their keys from the environment and
say so when they are missing.

The user's own alert emails from Indeed, Glassdoor or LinkedIn are the honest way to watch
those boards: they save the emails as `.eml` or `.txt` into `<store>/inbox/email/` and the
`email` source reads them.

## 2. Poll

```bash
node "$CP" watch poll --json            # every subscription that is due
node "$CP" watch poll --only S-02 --force --json
node "$CP" watch poll --dry-run --json  # prints the exact outbound URLs, fetches nothing
```

Per subscription: fetch (or read the folder), parse listings, drop the ones already seen
(`watch/seen.json`), parse each new posting, `match` it against the profile, and keep the ones
at or above `min_fit`. Each keeper becomes an inbox item; in `draft` and `prepare` modes it also
gets an application folder with `job.json`, `match.json`, the cited `resume.md` and
`cover-letter.md` skeletons (and `answers.md` in `prepare`), plus a first `resume.check.json`.
The catalog's rate limit is enforced per subscription (`--force` overrides once); exit 1 means
new matches. Outbound requests carry the subscription's own terms only; a request that would
carry a profile value is refused before it is sent. When you set up a subscription, tell the
user in one sentence what leaves their machine: the board token (and the query terms they
chose), never a profile value; and that nothing is ever submitted.

## 3. The inbox and the drafts

```bash
node "$CP" watch inbox --json
node "$CP" watch inbox --ack I-2026-10-29-acme-lead-frontend-ab12cd --note "applied by hand" --json
```

Each item: title, company, URL, fit, missing must-haves, the first gap questions, the action
taken and the application folder. Review with the user: for a draft, continue at
[resume](resume.md) §3 (targeted interview on the gaps) and §4 onward (rewrite, check,
finalize). Acknowledge items they handled; they stay for the record. Report only the
notification fields outside the conversation (title, company, URL, fit), never profile values.

## 4. Keeping it running

`node "$CP" watch schedule --show --every 6 --json` prints the snippets for this machine: a
cron line, a launchd plist outline, a `schtasks` command, a GitHub Actions workflow for a
private store repository, and the Claude Code scheduled-task wording. The skill prints them;
the user installs the one they want. Polling runs without a model; a scheduled agent session
(Claude Code cloud scheduled task, hourly at most, with the job hosts on its network allowlist)
is useful only for the drafting step, and the user still reviews. Pros and cons per option
are in [sources](sources.md) §4.

## 5. What is refused

- Subscribing to `indeed`, `glassdoor` or `linkedin` (or any URL on their hosts): their terms
  forbid bots and automated applying and they sit behind login walls. `watch add` exits 1
  with the alternative (their alert emails, Adzuna, the company's own board).
- Submitting an application, filling a form on a board, "Easy Apply", solving a CAPTCHA,
  logging in, storing board credentials, mass-applying, browser automation against a board.
- Polling faster than the catalog's rate limit, or any source whose terms the catalog does
  not cover.

Say this plainly when asked for it, once, and offer `prepare` (cited answers the user pastes).

## Without Node

Keep `watch/subscriptions.json` by hand in the shape `watch list --json` prints; read the
source's JSON or feed in the browser; compare titles with the user's targets; for a match,
follow [resume](resume.md) by hand. Write "guidance-only mode" in your reply and in the inbox
note.
