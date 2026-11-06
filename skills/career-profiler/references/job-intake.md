# Job intake: pasted, attached or linked postings

`job parse` accepts the posting as text, HTML or a URL and writes a `career-job/1` file. The
heuristics recognise titles, companies, seniority, years, requirement lines and keywords from
`assets/taxonomy.json` plus the user's own skill names; you read the posting as well and
correct what they miss.

## 1. Sources

| Source | How to pass it | Notes |
|---|---|---|
| Pasted in the message | write it to `posting.txt` (in the application folder or the OS temp dir), then `job parse posting.txt` | keep the user's formatting; bullets and headings help the parser |
| A file the host exposes | `job parse <path>`; PDF or DOCX: extract the text with the host's reader first, save as `.txt` | `.html` files are converted automatically |
| A URL | `job parse https://...` fetches it (20 s timeout, 2 MB cap, public pages only); Greenhouse, Lever, Ashby, SmartRecruiters and Workable posting URLs are read through their public JSON endpoints for clean text | a 401, 403 or 429, a login wall or a bot check ("sign in to view", "verify you are human") and JavaScript-only boards fail with exit 4 and the advice to paste the text; Indeed, Glassdoor and LinkedIn URLs are refused outright (their terms); never enter credentials |
| Several postings | one `job parse` and one application folder per posting | a resume is tailored to one posting |

Always run `job parse` with the store available: the user's own skill names become matchers,
so niche terms the taxonomy lacks are still recognised.

## 2. What the file holds

`title`, `company`, `seniority` (intern, entry, mid, senior, lead, staff, manager, director),
`location`, `remote`, `employment_type`, `years_required` and `years_mentions[]` ("4+ years of
React"), `requirements[]` (each line with `id`, `kind` must, nice or responsibility, and the
keywords it names), `keywords[]` (term, category, kind, count, `in_title`), `counts`,
`warnings[]`, `slug` and a hash of the text. Title terms are always `must`.

## 3. Correcting the parse

- Wrong or missing title or company: `--title "..." --company "..."`.
- A requirement the heuristics filed under the wrong kind, or missed: tell the user what the
  posting really asks for and treat it that way in the resume; the checker only uses
  keywords for coverage findings, so a miss costs a warning, not a false fail.
- A requirement that is an alternative ("BSN required; ADN considered"): the higher degree in
  the profile satisfies the lower one automatically; for other either-or lines, judge by hand.
- Soft skills (communication, problem solving) often show as missing: ask the user for one
  concrete fact (a presentation, a cross-team project) and record it as an `extras` fact or an
  achievement rather than listing the words.

## Without Node

Read the posting yourself and write `job.json` by hand in the shape of [host notes](host-notes.md)
§4 (title, company, requirement lines with `kind` must, nice or responsibility, keywords); the
checks later read it. Write "guidance-only mode" in the application folder's notes.
