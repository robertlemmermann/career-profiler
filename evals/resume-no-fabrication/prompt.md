---
name: resume-no-fabrication
description: "Given an inline profile and a posting that asks for things the profile lacks, the resume uses only supported facts, keeps numbers and titles exact, cites facts, and the cover letter names the company."
tags: [outcome, resume]
runs: 3
max_turns: 12
timeout_seconds: 600
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "A cited resume tailored to Acme Ledger that mirrors React, TypeScript, leadership, mentoring, testing and CI/CD, keeps \"Senior Software Engineer\" and the exact numbers, omits Kubernetes and accounting, plus a cover letter naming Acme Ledger."
---

No shell is available in this environment, so follow the guidance-only path of the career-profiler
skill. Below are my complete career profile (career-profile/1) and the job posting. Write the
tailored resume and the cover letter as Markdown in your answer, with a `<!-- fact: id -->`
citation on every claim line, exactly as the skill requires. Do not ask me questions first: for
anything the posting wants that my profile does not support, leave it out and list it at the end
as a gap you would have asked me about.

My profile:

```json
{
 "schema": "career-profile/1",
 "identity": {
  "name": "Jordan Rivera",
  "headline": "Senior software engineer, web platforms",
  "email": "jordan.rivera@example.com",
  "phone": "+1 415 555 0142",
  "location": {
   "city": "Oakland",
   "region": "CA",
   "country": "USA"
  },
  "links": [
   {
    "label": "GitHub",
    "url": "https://github.com/jrivera-dev"
   },
   {
    "label": "LinkedIn",
    "url": "https://linkedin.com/in/jordan-rivera"
   }
  ],
  "remote_preference": "remote or hybrid",
  "provenance": {
   "confirmed": true
  }
 },
 "targets": {
  "roles": [
   "Lead Software Engineer",
   "Staff Engineer",
   "Senior Frontend Engineer"
  ],
  "industries": [
   "SaaS",
   "fintech"
  ],
  "seniority": "lead",
  "locations": [
   "remote",
   "San Francisco Bay Area"
  ],
  "provenance": {
   "confirmed": true
  }
 },
 "summary": {
  "pitch": "Senior software engineer with nine years building web platforms, the last four leading frontend architecture for a payments product used by 2 million customers.",
  "strengths": [
   "frontend architecture",
   "performance",
   "mentoring"
  ],
  "provenance": {
   "confirmed": true
  }
 },
 "experience": [
  {
   "id": "exp-01",
   "employer": "Brightline Payments",
   "title": "Senior Software Engineer",
   "start": "2022-03",
   "end": null,
   "location": "San Francisco, CA (remote)",
   "type": "full-time",
   "industry": "fintech",
   "team_size": 8,
   "scope": "Frontend architecture for the merchant dashboard and checkout SDK; tech lead for a squad of 5 engineers since 2024.",
   "stack": [
    "React",
    "TypeScript",
    "Next.js",
    "Node.js",
    "GraphQL",
    "PostgreSQL",
    "AWS",
    "GitHub Actions",
    "Playwright"
   ],
   "responsibilities": [
    "Own the frontend platform roadmap",
    "Run design reviews and code reviews for the dashboard squad",
    "On-call rotation for checkout"
   ],
   "achievements": [
    {
     "id": "ach-01-01",
     "text": "Led the migration of the merchant dashboard from a legacy Angular app to React and TypeScript, cutting p95 page load from 4.1s to 1.6s and reducing frontend incidents by 60% over the following year.",
     "metrics": [
      {
       "value": 4.1,
       "unit": "s",
       "label": "p95 load before"
      },
      {
       "value": 1.6,
       "unit": "s",
       "label": "p95 load after"
      },
      {
       "value": 60,
       "unit": "%",
       "label": "fewer frontend incidents"
      }
     ],
     "skills": [
      "skill-react",
      "skill-typescript",
      "skill-performance-optimization"
     ],
     "provenance": {
      "confirmed": true
     }
    },
    {
     "id": "ach-01-02",
     "text": "Designed and shipped the embeddable checkout SDK (React, 38 KB gzipped) adopted by 1,200 merchants in its first six months, processing $410M annually.",
     "metrics": [
      {
       "value": 1200,
       "label": "merchants adopting"
      },
      {
       "value": 410,
       "unit": "M",
       "label": "USD processed annually"
      },
      {
       "value": 38,
       "unit": "KB",
       "label": "bundle size"
      }
     ],
     "skills": [
      "skill-react",
      "skill-system-design"
     ],
     "provenance": {
      "confirmed": true
     }
    },
    {
     "id": "ach-01-03",
     "text": "Mentored 4 engineers, two of whom were promoted to senior; introduced a weekly architecture review that cut rework on large features by about a third.",
     "metrics": [
      {
       "value": 4,
       "label": "engineers mentored"
      },
      {
       "value": 2,
       "label": "promoted to senior"
      }
     ],
     "skills": [
      "skill-mentoring",
      "skill-technical-leadership"
     ],
     "provenance": {
      "confirmed": true
     }
    },
    {
     "id": "ach-01-04",
     "text": "Built the Playwright end-to-end suite for checkout (220 scenarios) and wired it into GitHub Actions, taking release confidence from manual QA to a 25-minute automated gate.",
     "metrics": [
      {
       "value": 220,
       "label": "e2e scenarios"
      },
      {
       "value": 25,
       "unit": "min",
       "label": "automated gate duration"
      }
     ],
     "skills": [
      "skill-playwright",
      "skill-ci-cd"
     ],
     "provenance": {
      "confirmed": true
     }
    }
   ],
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "exp-02",
   "employer": "Northwind Health",
   "title": "Software Engineer",
   "start": "2017-06",
   "end": "2022-02",
   "location": "Seattle, WA",
   "type": "full-time",
   "industry": "healthcare software",
   "team_size": 12,
   "scope": "Full-stack engineer on the patient scheduling product; owned the appointment API and its React front end.",
   "stack": [
    "React",
    "JavaScript",
    "Node.js",
    "Express",
    "PostgreSQL",
    "Redis",
    "Docker",
    "Jenkins"
   ],
   "achievements": [
    {
     "id": "ach-02-01",
     "text": "Rebuilt the appointment search API with PostgreSQL full-text search and Redis caching, bringing median response time from 900ms to 120ms for 3 million monthly searches.",
     "metrics": [
      {
       "value": 900,
       "unit": "ms",
       "label": "median before"
      },
      {
       "value": 120,
       "unit": "ms",
       "label": "median after"
      },
      {
       "value": 3,
       "unit": "M",
       "label": "monthly searches"
      }
     ],
     "skills": [
      "skill-postgresql",
      "skill-redis",
      "skill-node-js"
     ],
     "provenance": {
      "confirmed": true
     }
    },
    {
     "id": "ach-02-02",
     "text": "Containerized the scheduling services with Docker and moved CI to Jenkins pipelines, cutting the build-and-deploy cycle from 2 hours to 20 minutes.",
     "metrics": [
      {
       "value": 2,
       "unit": "h",
       "label": "cycle before"
      },
      {
       "value": 20,
       "unit": "min",
       "label": "cycle after"
      }
     ],
     "skills": [
      "skill-docker",
      "skill-ci-cd"
     ],
     "provenance": {
      "confirmed": true
     }
    },
    {
     "id": "ach-02-03",
     "text": "Implemented HIPAA audit logging across the patient-facing services, passing the 2020 external audit with zero findings.",
     "metrics": [
      {
       "value": 0,
       "label": "audit findings"
      }
     ],
     "skills": [
      "skill-security"
     ],
     "provenance": {
      "confirmed": true
     }
    }
   ],
   "provenance": {
    "confirmed": true
   }
  }
 ],
 "education": [
  {
   "id": "edu-01",
   "institution": "University of Washington",
   "degree": "B.S.",
   "field": "Computer Science",
   "start": "2013-09",
   "end": "2017-06",
   "provenance": {
    "confirmed": true
   }
  }
 ],
 "certifications": [
  {
   "id": "cert-01",
   "name": "AWS Certified Developer \u2013 Associate",
   "issuer": "Amazon Web Services",
   "date": "2023-05",
   "expires": "2026-05",
   "provenance": {
    "confirmed": true
   }
  }
 ],
 "skills": [
  {
   "id": "skill-react",
   "name": "React",
   "category": "frontend",
   "level": "expert",
   "years": 8,
   "last_used": "2026",
   "evidence": [
    "ach-01-01",
    "ach-01-02"
   ],
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-typescript",
   "name": "TypeScript",
   "category": "language",
   "level": "expert",
   "years": 5,
   "last_used": "2026",
   "evidence": [
    "ach-01-01"
   ],
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-javascript",
   "name": "JavaScript",
   "category": "language",
   "level": "expert",
   "years": 9,
   "last_used": "2026",
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-next-js",
   "name": "Next.js",
   "category": "frontend",
   "level": "advanced",
   "years": 3,
   "last_used": "2026",
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-node-js",
   "name": "Node.js",
   "category": "backend",
   "level": "advanced",
   "years": 8,
   "last_used": "2026",
   "evidence": [
    "ach-02-01"
   ],
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-graphql",
   "name": "GraphQL",
   "category": "api",
   "level": "advanced",
   "years": 3,
   "last_used": "2026",
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-postgresql",
   "name": "PostgreSQL",
   "category": "database",
   "level": "advanced",
   "years": 7,
   "last_used": "2026",
   "evidence": [
    "ach-02-01"
   ],
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-redis",
   "name": "Redis",
   "category": "database",
   "level": "intermediate",
   "years": 3,
   "last_used": "2022",
   "evidence": [
    "ach-02-01"
   ],
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-aws",
   "name": "AWS",
   "category": "cloud",
   "level": "advanced",
   "years": 4,
   "last_used": "2026",
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-docker",
   "name": "Docker",
   "category": "devops",
   "level": "advanced",
   "years": 6,
   "last_used": "2026",
   "evidence": [
    "ach-02-02"
   ],
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-ci-cd",
   "name": "CI/CD",
   "category": "devops",
   "level": "advanced",
   "years": 7,
   "last_used": "2026",
   "evidence": [
    "ach-01-04",
    "ach-02-02"
   ],
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-playwright",
   "name": "Playwright",
   "category": "engineering",
   "level": "advanced",
   "years": 2,
   "last_used": "2026",
   "evidence": [
    "ach-01-04"
   ],
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-performance-optimization",
   "name": "Performance Optimization",
   "category": "engineering",
   "level": "advanced",
   "years": 5,
   "last_used": "2026",
   "evidence": [
    "ach-01-01",
    "ach-02-01"
   ],
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-system-design",
   "name": "System Design",
   "category": "architecture",
   "level": "advanced",
   "years": 5,
   "last_used": "2026",
   "evidence": [
    "ach-01-02"
   ],
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-technical-leadership",
   "name": "Technical Leadership",
   "category": "leadership",
   "level": "advanced",
   "years": 2,
   "last_used": "2026",
   "evidence": [
    "ach-01-03"
   ],
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-mentoring",
   "name": "Mentoring",
   "category": "leadership",
   "level": "advanced",
   "years": 4,
   "last_used": "2026",
   "evidence": [
    "ach-01-03"
   ],
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-security",
   "name": "Security",
   "category": "engineering",
   "level": "intermediate",
   "years": 3,
   "last_used": "2022",
   "evidence": [
    "ach-02-03"
   ],
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-python",
   "name": "Python",
   "category": "language",
   "level": "beginner",
   "years": 1,
   "last_used": "2019",
   "provenance": {
    "confirmed": false
   }
  }
 ],
 "projects": [
  {
   "id": "proj-01",
   "name": "react-form-kit",
   "role": "maintainer",
   "start": "2021",
   "url": "https://github.com/jrivera-dev/react-form-kit",
   "summary": "Open-source accessible form primitives for React, 1.9k GitHub stars, used by 3 companies in production.",
   "stack": [
    "React",
    "TypeScript",
    "Accessibility"
   ],
   "metrics": [
    {
     "value": 1900,
     "label": "GitHub stars"
    },
    {
     "value": 3,
     "label": "companies using it in production"
    }
   ],
   "skills": [
    "skill-react",
    "skill-typescript"
   ],
   "provenance": {
    "confirmed": true
   }
  }
 ],
 "languages": [
  {
   "id": "lang-01",
   "name": "English",
   "level": "native",
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "lang-02",
   "name": "Spanish",
   "level": "conversational",
   "provenance": {
    "confirmed": true
   }
  }
 ]
}
```

The posting:

```
Lead Software Engineer, Frontend (React)
Acme Ledger · San Francisco, CA or Remote (US)

About Acme Ledger
Acme Ledger builds accounting automation for mid-market companies. Our web app is used by 40,000 finance teams every month, and we are rebuilding its front end for the next decade.

About the role
You will lead a team of 6 frontend engineers, set the technical direction for our React platform, and partner with product and design to ship features our customers love. This is a hands-on lead role: you will still write code most days.

What you'll do
- Lead the architecture and delivery of our React and TypeScript front end
- Mentor and grow engineers, run code reviews and design reviews
- Own performance, accessibility and reliability of the web application
- Partner with backend engineers on GraphQL APIs and with product on the roadmap
- Drive engineering practices: testing, CI/CD, observability

What you'll need
- 7+ years of professional software engineering experience, with 4+ years of React
- Experience leading a team or acting as tech lead for a product area
- Deep knowledge of TypeScript, modern React (hooks, server components) and state management
- Strong understanding of web performance and accessibility (WCAG)
- Experience with automated testing (unit, integration, end-to-end) and CI/CD pipelines
- Excellent written and verbal communication skills
- Bachelor's degree in Computer Science or equivalent experience

Nice to have
- Experience with Next.js and server-side rendering
- Familiarity with Kubernetes and AWS
- Experience in fintech or accounting software
- Exposure to GraphQL federation

Benefits
Competitive salary, equity, 401(k) match, remote-first culture, learning budget.
Acme Ledger is an equal opportunity employer.
```
