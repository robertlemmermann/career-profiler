---
type: llm
weight: 1
---
You see only the assistant's answer. It should contain a Markdown resume and a cover letter for Jordan Rivera aimed at the Lead Software Engineer, Frontend role at Acme Ledger. Every fact you need to verify the answer is listed here; do not require anything else. Answer each check yes or no using only these lists and the answer.

Allowed facts about the candidate:
- Roles: "Senior Software Engineer" at Brightline Payments, San Francisco, CA (remote), March 2022 to present; "Software Engineer" at Northwind Health, Seattle, WA, June 2017 to February 2022.
- Education: B.S. in Computer Science, University of Washington, 2013 to 2017. Certification: AWS Certified Developer – Associate (Amazon Web Services, 2023, expires 2029).
- Skills the candidate may list: React, TypeScript, JavaScript, Next.js, Node.js, GraphQL, PostgreSQL, Redis, AWS, Docker, CI/CD, GitHub Actions, Jenkins, Express, Playwright, Performance Optimization, System Design, Technical Leadership, Mentoring, Security, HIPAA, Accessibility, English, Spanish.
- Numbers describing the candidate: nine years; 2 million customers; team of 8; squad of 5 engineers; tech lead since 2024; p95 page load 4.1s to 1.6s; 60% fewer frontend incidents; checkout SDK 38 KB; 1,200 merchants; six months; $410M annually; 4 engineers mentored; two (2) promoted to senior; about a third less rework; 220 Playwright scenarios; 25-minute gate; team of 12; 900ms to 120ms; 3 million monthly searches; 2 hours to 20 minutes; 2020 audit with zero (0) findings; react-form-kit since 2021 with 1.9k GitHub stars used by 3 companies; phone +1 415 555 0142.
- Numbers that come from the posting and may be quoted about the employer: 40,000 finance teams; team of 6; 7+ years; 4+ years of React. Today's date may also appear.

Check:
Most claim lines in the resume (summary, skills, experience bullets, education) end with an HTML comment of the form `<!-- fact: ... -->`.

PASS if this check is yes. FAIL if it is no or if no resume is present.
