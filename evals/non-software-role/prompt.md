---
name: non-software-role
description: "The skill tailors a resume for a nurse the same way it does for an engineer: clinical terms from the posting, exact certifications and dates, cited facts, cover letter."
tags: [outcome, resume, agnostic]
runs: 3
max_turns: 12
timeout_seconds: 600
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "A cited ICU nurse resume for Lakeside Regional with CCRN, ACLS, BLS, Epic, ventilators, CRRT, Impella, precepting and the CLABSI result, plus a cover letter naming Lakeside Regional Medical Center."
---

No shell is available, so use the guidance-only path of the career-profiler skill. Write my
tailored resume and cover letter for the posting below, with a `<!-- fact: id -->` citation on
every claim line. Leave out anything my profile does not support and list it as a gap at the end.

My automation preference is already recorded (the gate is satisfied); here is my `preferences.json`:

```json
{"schema":"career-preferences/1","automation":"draft","submit":"never","statement":"Draft things for me to review; never send anything on my behalf.","recorded_at":"2026-10-20T09:00:00.000Z","skill_version":"0.2.0","store_version":2,"hash":"verified-in-conversation"}
```

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
Registered Nurse (RN) – Intensive Care Unit, Nights
Lakeside Regional Medical Center – Madison, WI

Position summary
The ICU Registered Nurse provides direct patient care to critically ill adult patients in our 24-bed medical-surgical ICU, using the nursing process to assess, plan, implement and evaluate care. Night shift, 36 hours per week, three 12-hour shifts.

Responsibilities
- Deliver evidence-based critical care nursing to patients requiring mechanical ventilation, vasoactive drips, CRRT and post-operative monitoring
- Administer medications and titrate infusions per protocol; perform ongoing patient assessment and documentation in Epic
- Collaborate with intensivists, respiratory therapists and the interdisciplinary team during daily rounds
- Educate patients and families; participate in unit quality initiatives (CLABSI, CAUTI, falls)
- Precept new graduate nurses and float staff as assigned

Qualifications
- Current Wisconsin RN license (or compact state license) required
- BSN required; ADN considered with enrollment in a BSN program
- Minimum 2 years of ICU or critical care experience required
- BLS and ACLS required; CCRN preferred
- Experience with Epic EHR preferred
- Strong critical thinking, communication and teamwork skills

Preferred
- CCRN certification
- Experience with CRRT and Impella devices
- Charge nurse or preceptor experience

Lakeside Regional is an equal opportunity employer. Sign-on bonus available for qualified external candidates.
```
