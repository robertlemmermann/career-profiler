# Job sources: what can be watched, how, and what is refused

The catalog is `assets/sources/catalog.json`; `watch sources` prints it. Verified against the
research in the owner's plans repository on 2026-10-29; `verified_on: null` marks a family whose
endpoint shape is documented but was not reached from the build environment.

## 1. Families

| Family | Needs | Description included | Rate limit | Terms |
|---|---|---|---|---|
| `greenhouse` | `--board` | yes | hourly | public board API, no auth |
| `lever` | `--board` | yes | hourly | public postings API |
| `ashby` | `--board` | yes | hourly | public job-board API |
| `smartrecruiters` | `--board` | per posting | hourly | public list; details fetched per posting |
| `workable` | `--board` | yes | 2 h | widget API (unverified) |
| `remotive` | `--query` | yes | 6 h | at most 4 requests a day, 24 h delay, link back |
| `arbeitnow` | `--query` | yes | 2 h | public, paginated, filtered locally |
| `usajobs` | `--query`, `USAJOBS_API_KEY`, `USAJOBS_USER_AGENT` | yes | 2 h | free key |
| `adzuna` | `--query`, `--country`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | excerpts | 4 h | free key, quota, attribution |
| `hn` | `--query` | yes | 12 h | Hacker News "Who is hiring" thread |
| `rss` | `--url` | yes | hourly | any RSS or Atom feed the publisher offers |
| `email` | files in `<store>/inbox/email/` | yes | none | the board's own job-alert emails |
| `file` | `--path` | yes | none | a folder of pasted postings |

The board token is the last path segment of the company's careers page
(`boards.greenhouse.io/<board>`, `jobs.lever.co/<board>`, `jobs.ashbyhq.com/<board>`).

## 2. What leaves the machine

Only the subscription's own terms: the board token, the query words, the country. Never a
profile value; `watch poll --dry-run` prints every outbound URL (keys redacted) so the user can
see it. Fetched postings are stored under the application folder; recruiter contact details in
them are never copied into drafts.

## 3. Refused, and why

| Board | Why | Instead |
|---|---|---|
| Indeed | no public job-search API (the Publisher API was retired); terms forbid bots, scrapers and automating Indeed Apply; Cloudflare and login walls | an Indeed job-alert email with `--source email`; Adzuna (free key) aggregates many of the same postings |
| Glassdoor | API closed; terms forbid automated access; login wall | Glassdoor alert emails with `--source email` |
| LinkedIn | Jobs API is partner-only; the user agreement bans bots and restricts accounts that use them | LinkedIn alert emails (up to 20) with `--source email`; the employer's own Greenhouse, Lever or Ashby board |

Automated applying ("Easy Apply" bots, mass-apply products) is refused in every mode: it
breaches the boards' terms, gets accounts restricted, is treated as spam by recruiters, cannot
answer screening questions truthfully, and submits irreversibly in the user's name. `prepare`
gives the user cited answers to paste themselves.

## 4. Keeping a watch running: the options

| Option | Model needed | Where credentials live | Cost | Reliability | Fits |
|---|---|---|---|---|---|
| OS scheduler (cron, launchd, Task Scheduler) running `watch poll` | no | the machine's environment | free | the machine must be on | one computer, the default |
| GitHub Actions `schedule` in the private store repository | no | repository secrets | free minutes (2,000/month private), 5 min minimum interval, delays under load, auto-disable after 60 days of inactivity on public repos | good | multi-device and phone users |
| Claude Code scheduled task (cloud) | yes, every firing | the environment | a full model session per run; hourly at most; job hosts must be on the network allowlist | good | the drafting step after a poll |
| Claude Code `/loop` or a long-running session | yes | the session | billed while it runs; session-scoped, expires | poor for days | demos only |
| Copilot or Codex scheduled runs | yes | their environments | per their plans; hourly, daily or weekly | fair | same as above on those hosts |
| Browser automation (Claude in Chrome, computer use, Playwright) against a board | yes | the user's logged-in browser | expensive, fragile | poor | refused for the three big boards; never for applying |

Recommendation: poll with the script under a scheduler, call a model only on the delta.

## 5. Notifications

`watch poll` exits 1 when there are new matches, which cron mail or a workflow step can act
on; `report.notification` holds title, company, URL and fit only. A webhook (ntfy, Slack,
Discord), a GitHub issue or a local mail command can forward that; the skill prints the
payload and does not post it itself.
