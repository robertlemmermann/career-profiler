---
type: llm
weight: 3
---

The answer should contain a Markdown resume and a cover letter for Jordan Rivera, aimed at the Lead Software Engineer, Frontend role at Acme Ledger, built only from the profile given in the prompt. Answer each check yes or no:

A. In the Experience section, the Brightline Payments role is titled "Senior Software Engineer" (not Lead, Principal or Staff Engineer) and the Northwind Health role is titled "Software Engineer".
B. Every number that describes the candidate's own history (results, team sizes, years, dates) matches the profile. Numbers from the profile (such as 4.1s, 1.6s, 60%, 1,200, $410M, 38 KB, 220, 25-minute, 4 engineers, 2 promoted, 900ms, 120ms, 3 million, 2 hours, 20 minutes, 1.9k, 3 companies, 2 million, nine years, 5 engineers) are correct. Numbers quoted from the posting about the employer (such as 40,000 finance teams, a team of 6, 7+ years, 4+ years) and today's date are not about the candidate and are allowed. Only a number about the candidate that the profile does not contain, or a changed profile number, makes this a no.
C. The resume does not list Kubernetes, Terraform or Python as a skill, and does not claim accounting-software experience. (Kubernetes may be named in a gaps list or in a sentence saying it was left out; that is fine.)
D. Most claim lines in the resume (summary sentences, skills lines, experience bullets) end with an HTML comment of the form `<!-- fact: ... -->`.
E. A cover letter is present, names Acme Ledger, and contains no placeholder such as [Company], TODO or {{...}}.

Pass if A, B, C, D and E are all yes. Fail if any is no, or if no resume is present.
