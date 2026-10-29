---
name: gap-asks-before-writing
description: "With an inline nurse profile and a posting that requires ECMO and PALS, which the profile lacks, the agent asks about the gaps before writing rather than listing them."
tags: [outcome, resume, interview]
runs: 3
max_turns: 10
timeout_seconds: 600
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "A gap analysis that names ECMO and PALS as missing and asks the user about them, with the resume held back or explicitly written without those terms."
---

No shell is available, so use the guidance-only path of the career-profiler skill. Here is my
career profile and a posting. Tell me how well I match and what you need from me before you write
the resume. Do not write the resume yet.

My profile:

```json
{
 "schema": "career-profile/1",
 "identity": {
  "name": "Priya Natarajan",
  "headline": "Critical care registered nurse",
  "email": "priya.n@example.com",
  "phone": "+1 608 555 0117",
  "location": {
   "city": "Madison",
   "region": "WI",
   "country": "USA"
  },
  "provenance": {
   "confirmed": true
  }
 },
 "targets": {
  "roles": [
   "ICU Registered Nurse",
   "Charge Nurse"
  ],
  "industries": [
   "hospital"
  ],
  "seniority": "senior",
  "locations": [
   "Madison, WI"
  ],
  "provenance": {
   "confirmed": true
  }
 },
 "summary": {
  "pitch": "Registered nurse with six years of adult critical care experience in a 20-bed mixed ICU, CCRN-certified, precepting new graduates since 2023.",
  "strengths": [
   "hemodynamic monitoring",
   "precepting",
   "family communication"
  ],
  "provenance": {
   "confirmed": true
  }
 },
 "experience": [
  {
   "id": "exp-01",
   "employer": "St. Anselm Hospital",
   "title": "Registered Nurse, Medical ICU",
   "start": "2020-08",
   "end": null,
   "location": "Milwaukee, WI",
   "type": "full-time",
   "industry": "hospital",
   "team_size": 34,
   "scope": "Night-shift staff nurse in a 20-bed medical ICU; relief charge nurse since 2024; preceptor for new graduate nurses.",
   "stack": [
    "Epic",
    "mechanical ventilation",
    "CRRT",
    "vasoactive infusions",
    "Impella"
   ],
   "achievements": [
    {
     "id": "ach-01-01",
     "text": "Precepted 7 new graduate nurses through the 12-week ICU orientation program; all 7 completed orientation and remained on the unit at one year.",
     "metrics": [
      {
       "value": 7,
       "label": "new graduates precepted"
      },
      {
       "value": 12,
       "unit": "weeks",
       "label": "orientation length"
      }
     ],
     "provenance": {
      "confirmed": true
     }
    },
    {
     "id": "ach-01-02",
     "text": "Led the unit's CLABSI bundle audit project as a member of the quality council, contributing to 14 months without a central line infection on the unit.",
     "metrics": [
      {
       "value": 14,
       "unit": "months",
       "label": "without a CLABSI"
      }
     ],
     "provenance": {
      "confirmed": true
     }
    },
    {
     "id": "ach-01-03",
     "text": "Manage 1:1 and 1:2 assignments of ventilated patients on CRRT and multiple vasoactive drips, including Impella support, documenting in Epic.",
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
   "employer": "Dane County Medical Center",
   "title": "Registered Nurse, Medical-Surgical",
   "start": "2018-06",
   "end": "2020-07",
   "location": "Madison, WI",
   "type": "full-time",
   "industry": "hospital",
   "stack": [
    "Cerner",
    "telemetry"
   ],
   "achievements": [
    {
     "id": "ach-02-01",
     "text": "Cared for 5 to 6 telemetry patients per shift on a 32-bed medical-surgical unit; recognized with the 2019 DAISY award nomination for family communication.",
     "metrics": [
      {
       "value": 32,
       "label": "unit beds"
      }
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
   "institution": "University of Wisconsin\u2013Madison",
   "degree": "BSN",
   "field": "Nursing",
   "start": "2014-09",
   "end": "2018-05",
   "provenance": {
    "confirmed": true
   }
  }
 ],
 "certifications": [
  {
   "id": "cert-01",
   "name": "Registered Nurse license, Wisconsin",
   "issuer": "Wisconsin Board of Nursing",
   "date": "2018-06",
   "expires": "2027-02",
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "cert-02",
   "name": "CCRN",
   "issuer": "AACN",
   "date": "2022-09",
   "expires": "2028-09",
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "cert-03",
   "name": "ACLS",
   "issuer": "American Heart Association",
   "date": "2024-03",
   "expires": "2028-03",
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "cert-04",
   "name": "BLS",
   "issuer": "American Heart Association",
   "date": "2024-03",
   "expires": "2028-03",
   "provenance": {
    "confirmed": true
   }
  }
 ],
 "skills": [
  {
   "id": "skill-critical-care",
   "name": "Critical Care",
   "category": "clinical",
   "level": "expert",
   "years": 6,
   "last_used": "2026",
   "evidence": [
    "ach-01-03"
   ],
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-ventilator-management",
   "name": "Ventilator Management",
   "category": "clinical",
   "level": "expert",
   "years": 6,
   "evidence": [
    "ach-01-03"
   ],
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-crrt",
   "name": "CRRT",
   "category": "clinical",
   "level": "advanced",
   "years": 4,
   "aliases": [
    "continuous renal replacement therapy"
   ],
   "evidence": [
    "ach-01-03"
   ],
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-ehr",
   "name": "EHR",
   "category": "systems",
   "level": "advanced",
   "years": 8,
   "aliases": [
    "Epic",
    "Cerner"
   ],
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-medication-administration",
   "name": "Medication Administration",
   "category": "clinical",
   "level": "expert",
   "years": 8,
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-patient-care",
   "name": "Patient Care",
   "category": "clinical",
   "level": "expert",
   "years": 8,
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-training",
   "name": "Training",
   "category": "leadership",
   "level": "advanced",
   "years": 3,
   "aliases": [
    "precepting",
    "preceptor"
   ],
   "evidence": [
    "ach-01-01"
   ],
   "provenance": {
    "confirmed": true
   }
  },
  {
   "id": "skill-communication",
   "name": "Communication",
   "category": "general",
   "level": "advanced",
   "years": 8,
   "evidence": [
    "ach-02-01"
   ],
   "provenance": {
    "confirmed": true
   }
  }
 ]
}
```

The posting:

```
Registered Nurse – Cardiothoracic ICU (Days)
Mercy Heart Institute – Milwaukee, WI

Requirements
- Current Wisconsin RN license; BSN required
- 3+ years of ICU experience; cardiothoracic or cardiac surgery ICU strongly preferred
- ECMO specialist training required (or willingness to complete within 6 months)
- PALS required; CCRN preferred
- Experience with Impella, IABP and CRRT
- Epic EHR

Responsibilities
- Care for post-operative cardiac surgery patients 1:1 and 1:2
- Participate in ECMO cannulation and management as part of the ECMO team
- Precept new staff and participate in unit quality initiatives
```
