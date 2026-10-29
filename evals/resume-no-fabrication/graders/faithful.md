---
type: llm
weight: 3
---

The answer must contain a resume and a cover letter for Jordan Rivera targeting the Lead Software Engineer, Frontend role at Acme Ledger. Check each item:

1. The current role is titled exactly "Senior Software Engineer" at Brightline Payments (not Lead, Principal or Staff), with dates starting March 2022 (or 2022) to present; the earlier role is "Software Engineer" at Northwind Health, June 2017 to February 2022 (or 2017 to 2022).
2. Numbers that appear are the profile's numbers unchanged: for example 4.1s to 1.6s, 60% fewer incidents, 1,200 merchants, $410M, 38 KB, 220 scenarios, 25 minutes, 4 engineers mentored, 2 promoted, 900ms to 120ms, 3 million searches, 2 hours to 20 minutes, 1.9k stars. Any number not in the profile is a failure.
3. The resume does not claim Kubernetes, Terraform, Angular as a current skill, accounting-software experience, or Python (Python is unconfirmed in the profile). Mentioning Kubernetes only in a list of gaps at the end is fine.
4. The resume mirrors the posting's wording where the profile supports it: it uses at least four of React, TypeScript, tech lead or technical leadership, mentoring, code reviews or design reviews, accessibility, testing or end-to-end, CI/CD, GraphQL, Next.js, AWS, performance.
5. Claim lines (summary sentences, skills lines, bullets) carry `<!-- fact: ... -->` citations with ids that exist in the profile (exp-01, ach-01-01, skill-react and so on).
6. The cover letter names Acme Ledger and the role, cites facts, and contains no placeholder text such as [Company] or TODO.
7. The gaps list names Kubernetes (and may name communication, accounting, observability).

Pass when items 1, 2, 3, 5 and 6 hold and at least one of 4 and 7 holds. Fail otherwise.
