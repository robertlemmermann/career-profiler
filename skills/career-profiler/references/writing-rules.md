# Writing rules: resumes and cover letters that pass screens and checks

## 1. The checked format

The resume is Markdown with this skeleton (the draft from `app new` produces it):

```markdown
# Name
City, Region · email · phone · links <!-- fact: identity -->

## Summary
Two or three sentences. <!-- fact: summary, exp-01, ach-01-02 -->

## Skills
- **Frontend:** React, TypeScript, Next.js <!-- fact: skill-react, skill-typescript, skill-next-js -->

## Experience
### Exact Title — Employer <!-- fact: exp-01 -->
Location · Mon YYYY – Present
- One result with its number, in the posting's words where the fact supports them. <!-- fact: ach-01-01 -->

## Education
- Degree in Field, Institution, YYYY <!-- fact: edu-01 -->

## Certifications
- Name, Issuer, YYYY <!-- fact: cert-01 -->
```

Markers may also sit on the line below a claim. Any claim line without a marker fails.

## 2. Tailoring without inventing

- Mirror the posting's exact terms where the profile supports them: "React" not "ReactJS" if
  the posting says React; "CI/CD" where the fact says GitHub Actions pipelines. The checker's
  `keyword-unused` findings list the supported terms you have not used yet.
- Lead with what the posting leads with. A lead role: leadership, mentoring, architecture
  decisions first; a clinical role: the unit, acuity, protocols, certifications first.
- Reorder bullets by relevance; cut the rest. Three to six bullets per recent role, one to
  three for older ones; roles older than about fifteen years can collapse to one line.
- A partial match is shown as what it is ("exposure to", "contributed to", "alongside the
  platform team"); never promoted to ownership or expertise.
- Titles are exact. A posting for "Lead Engineer" does not turn "Senior Software Engineer
  (tech lead for a squad of 5)" into "Lead Engineer"; the lead work goes into the bullets.
- Numbers come from the facts, as recorded. Rounding is allowed only when the fact allows it
  ("about a third" for `~33%`); "from 4.1s to 1.6s" stays those numbers.

## 3. Bullet craft

- Implied first person, past tense for past roles, present for the current one: "Led ...",
  "Cut ...", never "I led" or "Responsible for".
- Result first or action then result, with the measure: what changed, how much, over what.
- One idea per bullet, under about thirty words, no semicolons stacking three results.
- Verbs that name the contribution precisely: led, designed, shipped, cut, grew, precepted,
  negotiated, audited, built, migrated. Avoid "helped", "worked on", "involved in".

## 4. ATS and format

- Standard headings (Summary, Skills, Experience, Education, Certifications); no tables,
  columns, images, icons or text boxes; `resume.txt` is the version to paste into forms.
- Keywords in context (in bullets), not only in the skills list; abbreviations spelled out
  once ("continuous integration (CI/CD)").
- One page under ten years, two pages at most; 350 to 700 words.
- Contact line: location (city, region), email, phone, one or two links. No photo, date of
  birth, marital status, full street address or salary history unless the user asks and the
  market expects it.
- Current dates, consistent formats (`Mar 2022 – Present`), no "References available".

## 5. Cover letter craft

- 250 to 400 words, four paragraphs: role and the one reason; evidence with two results
  and numbers; why this company or team in their words; close with availability and thanks.
- Named greeting when the posting gives a name; otherwise "Dear <Company> Hiring Team".
- Every body paragraph cites facts; numbers only from cited facts; the company and the role
  named exactly; no placeholders.
- One honest sentence may address a key gap the user chose to acknowledge; otherwise the
  letter does not mention what the candidate lacks.
- The letter is optional for the user, not for the skill: always produce it, then say they can
  drop it.
