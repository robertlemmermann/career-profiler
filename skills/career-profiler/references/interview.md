# Interview protocol

Both jobs interview the user: `profile` to fill the store, `resume` to close the gaps a posting
exposes. Same rules in both.

## Contents

- [1. Conduct](#1-conduct)
- [2. Getting to facts](#2-getting-to-facts)
- [3. Pulling for numbers and scope](#3-pulling-for-numbers-and-scope)
- [4. Role-agnostic question shapes](#4-role-agnostic-question-shapes)
- [5. Confirming and writing](#5-confirming-and-writing)
- [6. Stopping and resuming](#6-stopping-and-resuming)

## 1. Conduct

- One topic per turn, at most three questions, the most important first. Headless hosts
  (no human can answer) get no interview: report the gaps and stop. Write the gaps as a list of
  topics ("Work history: employer, exact title, start and end months"), not as questions put to
  the user, and end with how to continue ("run /career-profiler profile in an interactive
  session"); nothing in a headless answer waits for a reply.
- Use the user's words. Rephrase a question only when the first form confused them.
- Never fill a silence with a guess. "I don't remember the number" is recorded as no number;
  "roughly 30%" is recorded as `~30%` with `"note": "estimate"` in the metric.
- Acknowledge in one clause, then move on. No praise loops, no career advice unless asked.
- Keep the agenda visible every few turns: coverage score, what is done, what is left.
- Adapt to the profession from the answers (`interview coverage` reports `domains`); do not
  assume software. A nurse's "stack" is Epic, ventilators and CRRT; a sales manager's is
  Salesforce, quota and territory; an electrician's is panels, code sections and sites.
- **Never ask for**: date of birth or age; national identity, passport, tax or social security
  numbers; street address; marital or family status; religion or belief; health, disability or
  medical history; ethnicity, nationality or citizenship as an attribute; a photo; bank or
  payment details (`interview next` prints the list as `never_asked`). City and region are
  enough for location. Work authorization and salary expectations are restricted facts: ask
  only when the user raises them or a posting requires them, and record them as such. When the
  user volunteers an item from the list, say in one sentence that it is stored at tier `never`
  (never exported, never cited) and used only to respect their constraints; the scripts assign
  the tier automatically. One sentence means one: "Your date of birth and street address stay
  out of your profile and every document; nothing here needs them." No list of reasons. A paraphrase that keeps the substance ("a health constraint on
  shifts") is fine; the value itself is not repeated.

## 2. Getting to facts

Every answer is sorted into: a **fact** (recordable as is), an **inference** (yours, must be
confirmed), or **unknown** (ask once more, then leave it). Facts are written in the shape the
store expects:

| You hear | You record |
|---|---|
| "I was basically running the front end" | `scope`: ask what "running" meant (decisions, people, systems) and record the concrete version |
| "senior dev at Acme since early 2022" | `title`: ask for the exact title on the contract; `start`: ask for the month |
| "we cut load time a lot" | an achievement without a metric, then §3 |
| "I know Kubernetes" | `skills`: ask level, years, last used, and where it was used (evidence) |
| "the team was maybe 6-8" | `team_size: "6-8"` as given; never pick 7 |

## 3. Pulling for numbers and scope

For each achievement, ask until one of these is answered or the user says there is none:
how much (percent, money, count), how fast (time saved, cycle time), how big (users,
patients, revenue, units, sites), how good (score, rating, error or incident rate, audit
result), who (people led, trained, served). Then the comparison: before versus after, or
versus the team or the target. Record each as a metric with `value`, `unit`, `label`.

Scope questions per role: team size, reports, who they reported to, budget or caseload or
territory, what they owned alone, the main tools or systems. These feed the summary and the
seniority match later.

## 4. Role-agnostic question shapes

The question bank (`assets/question-bank.json`) phrases every question so it works for any
profession; `interview next` fills in the employer and title. Domain probes are added from the
profile's domains (engineering, leadership, healthcare, sales, operations, finance, education,
trades, creative, general). When none fits, use the general probes: who benefited and how
would they describe the change; what did it cost or save.

## 5. Confirming and writing

Two steps, enforced by the scripts: `fact stage <section> --data '[...]' --quote "<their
words>"` stores the candidate facts under a `T-` id and prints them; show them to the user in
one short list ("Recording: Senior Software Engineer at Brightline Payments, Mar 2022 to
present, San Francisco (remote), full-time"); anything inferred or rounded gets an explicit "is
that exact?"; on their yes, `fact commit T-001 --confirm`. `--confirm` is your assertion that
they said yes in this conversation; `--yes` is not accepted. `fact add --confirm` is the
one-shot form for a single fact whose shown wording the user just said yes to; facts extracted from a document are
written `fact add --unconfirmed` and confirmed section by section with `fact confirm`. Keep up
to 300 characters of the user's own words in `--quote`: it is the evidence the fact rests on.
Read the returned ids back to yourself for later citations.

Stating a fact is not confirming it. The user told you what happened; they have not yet seen how
you will record it (your wording, the dates and numbers you derived, the section you chose).
So every write follows a yes to the entry as shown, in every section, `identity` and `targets`
included. Never write first and invite corrections afterwards ("I saved these; tell me if any
wording is off"): show, ask, and write in the turn after the yes. Two writes need no yes: an
`interview done <key>` marker for a topic the user said is empty, and a volunteered
never-asked item the scripts store at tier `never` because the user asked you to keep it in mind
(say so in the same turn). Batch the confirmations: one short list, one question.

## 6. Stopping and resuming

The user may stop at any moment; every confirmed fact is already on disk. Close with the
coverage score and the first question of the next session. Resuming is `interview next` again:
the store remembers what was asked (`interview done`) and what is thin.
