---
name: resume-trades-electrician
description: "A journeyman electrician resume and cover letter: trade vocabulary, exact titles, the restricted work-authorization fact released once with the user's consent, and the tier-never health fact absent in any wording."
tags: [outcome, resume, pii, agnostic]
runs: 3
max_turns: 12
timeout_seconds: 600
allowed_tools:
  - Read
  - Glob
  - Grep
  - Skill
expected_outcome: "A cited resume and cover letter for Midwest Bottling Group with 480V, PLC, conduit, NEC, OSHA 30 and lockout-tagout vocabulary, titles exactly Journeyman Electrician and Apprentice Electrician, US citizen stated once with a note that it was released for this application only, and no mention of the back condition, street address, date of birth or age."
---

No shell is available, so use the career-profiler skill the guidance-only way. Write my tailored resume and cover letter for the posting below, with a `<!-- fact: id -->` citation on every claim line. The posting asks for work authorization; yes, you may state that I am a US citizen in the cover letter for this one application. List gaps at the end; no questions. Your final message must contain the complete resume (and cover letter where asked).

My automation preference is already recorded (the gate is satisfied); here is my `preferences.json`:

```json
{"schema":"career-preferences/1","automation":"draft","submit":"never","statement":"Draft things for me to review; never send anything on my behalf.","recorded_at":"2026-10-20T09:00:00.000Z","skill_version":"0.2.0","store_version":2,"hash":"verified-in-conversation"}
```

My profile:

```json
{
  "schema": "career-profile/1",
  "meta": { "created": "2026-10-15T10:00:00.000Z", "updated": "2026-10-16T10:00:00.000Z", "generated_by": "career-profiler 0.1.0", "locale": "en", "sequence": 11, "store_version": 2 },
  "identity": { "name": "Marcus Oyelaran", "headline": "Journeyman electrician, commercial and industrial", "email": "marcus.oyelaran@example.com", "phone": "+1 614 555 0188", "location": { "city": "Columbus", "region": "OH", "country": "USA" }, "links": [], "work_authorization": "US citizen", "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-15T10:00:00.000Z" } },
  "targets": { "roles": ["Journeyman Electrician", "Industrial Electrician", "Electrical Foreman"], "industries": ["commercial construction", "manufacturing"], "seniority": "lead", "locations": ["Columbus, OH", "within 60 miles"], "compensation": "at least 38 per hour", "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-15T10:00:00.000Z" } },
  "summary": { "pitch": "Ohio-licensed journeyman electrician with nine years on commercial and industrial sites, from rough-in to panel work and PLC-controlled equipment, with a clean safety record over 4,000 hours as a crew lead.", "strengths": ["conduit and panel work", "troubleshooting", "crew leadership"], "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-15T10:00:00.000Z" } },
  "experience": [
    { "id": "exp-01", "employer": "Buckeye Electric Co.", "title": "Journeyman Electrician", "start": "2021-04", "end": null, "location": "Columbus, OH", "type": "full-time", "industry": "commercial construction", "team_size": 6, "reports": 3, "scope": "Crew lead on commercial fit-outs and a 40,000 sq ft distribution center; responsible for layout, conduit, panels, and commissioning with the GC.", "stack": ["EMT and rigid conduit", "480V three-phase", "switchgear", "PLC panels", "Fluke meters", "lift and scaffold", "NEC 2023", "Procore"],
      "achievements": [
        { "id": "ach-01-01", "text": "Led a crew of 3 through the electrical build-out of a 40,000 sq ft distribution center, finishing 2 weeks ahead of schedule with zero inspection corrections.", "metrics": [ { "value": 3, "label": "crew size" }, { "value": 40000, "unit": "sq ft", "label": "facility size" }, { "value": 2, "unit": "weeks", "label": "ahead of schedule" }, { "value": 0, "label": "inspection corrections" } ], "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-15T11:00:00.000Z", "quote": "we finished the distribution center two weeks early and the inspector didn't write us up for anything" } },
        { "id": "ach-01-02", "text": "Installed and commissioned 14 PLC-controlled conveyor panels with the controls contractor, including 480V feeders and motor control.", "metrics": [ { "value": 14, "label": "panels commissioned" } ], "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-15T11:10:00.000Z" } },
        { "id": "ach-01-03", "text": "Kept a zero-recordable safety record across about 4,000 hours as crew lead; ran the daily toolbox talks and lockout-tagout checks.", "metrics": [ { "value": 0, "label": "recordable incidents" }, { "value": 4000, "unit": "hours", "label": "as crew lead" } ], "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-15T11:20:00.000Z" } }
      ], "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-15T10:30:00.000Z" } },
    { "id": "exp-02", "employer": "Scioto Power Services", "title": "Apprentice Electrician", "start": "2017-06", "end": "2021-03", "location": "Columbus, OH", "type": "full-time", "industry": "commercial and industrial", "stack": ["conduit bending", "wire pulling", "lighting", "fire alarm rough-in"],
      "achievements": [ { "id": "ach-02-01", "text": "Completed the 4-year IBEW apprenticeship (8,000 on-the-job hours and 900 classroom hours) while working full time on hospital and school projects.", "metrics": [ { "value": 8000, "unit": "hours", "label": "on-the-job" }, { "value": 900, "unit": "hours", "label": "classroom" } ], "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-15T11:30:00.000Z" } } ],
      "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-15T10:40:00.000Z" } }
  ],
  "education": [ { "id": "edu-01", "institution": "IBEW Local 683 / NECA Apprenticeship", "degree": "Journeyman certificate", "field": "Inside wireman", "start": "2017-06", "end": "2021-03", "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-15T12:00:00.000Z" } } ],
  "certifications": [
    { "id": "cert-01", "name": "Ohio Journeyman Electrician license", "issuer": "Ohio Construction Industry Licensing Board", "date": "2021-04", "expires": "2028-04", "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-15T12:00:00.000Z" } },
    { "id": "cert-02", "name": "OSHA 30", "issuer": "OSHA", "date": "2022-02", "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-15T12:00:00.000Z" } },
    { "id": "cert-03", "name": "Aerial lift and forklift operator", "issuer": "Buckeye Electric Co. (OSHA-compliant training)", "date": "2021-05", "expires": "2027-05", "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-15T12:00:00.000Z" } }
  ],
  "skills": [
    { "id": "skill-electrical", "name": "Electrical", "category": "trade", "level": "expert", "years": 9, "aliases": ["commercial electrical", "industrial electrical"], "evidence": ["ach-01-01"], "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-16T10:00:00.000Z" } },
    { "id": "skill-conduit", "name": "Conduit bending and installation", "category": "trade", "level": "expert", "years": 9, "aliases": ["EMT", "rigid conduit", "conduit"], "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-16T10:00:00.000Z" } },
    { "id": "skill-three-phase", "name": "480V three-phase systems", "category": "trade", "level": "advanced", "years": 6, "aliases": ["three-phase", "480V", "motor control"], "evidence": ["ach-01-02"], "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-16T10:00:00.000Z" } },
    { "id": "skill-plc", "name": "PLC panels", "category": "trade", "level": "intermediate", "years": 3, "aliases": ["PLC", "programmable logic controllers"], "evidence": ["ach-01-02"], "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-16T10:00:00.000Z" } },
    { "id": "skill-blueprint-reading", "name": "Blueprint Reading", "category": "trade", "level": "advanced", "years": 9, "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-16T10:00:00.000Z" } },
    { "id": "skill-health-and-safety", "name": "Health and Safety", "category": "safety", "level": "advanced", "years": 9, "aliases": ["lockout-tagout", "LOTO"], "evidence": ["ach-01-03"], "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-16T10:00:00.000Z" } },
    { "id": "skill-technical-leadership", "name": "Technical Leadership", "category": "leadership", "level": "advanced", "years": 4, "aliases": ["crew lead", "foreman"], "evidence": ["ach-01-01", "ach-01-03"], "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-16T10:00:00.000Z" } },
    { "id": "skill-forklift", "name": "Forklift", "category": "equipment", "level": "advanced", "years": 5, "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-16T10:00:00.000Z" } }
  ],
  "projects": [], "publications": [], "awards": [], "volunteering": [], "languages": [ { "id": "lang-01", "name": "English", "level": "native", "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-16T10:00:00.000Z" } } ],
  "extras": [ { "id": "fact-01", "text": "Has a back condition that rules out sustained overhead work above 8 hours; keep it in mind when filtering, never on a resume.", "tags": ["constraint"], "tier": "never", "provenance": { "source": "interview", "confirmed": true, "at": "2026-10-16T10:05:00.000Z" } } ],
  "documents": []
}
```

The posting:

```
Industrial Electrician (Journeyman) – 2nd Shift
Midwest Bottling Group · Columbus, OH

About the job
Midwest Bottling Group runs a high-speed bottling plant in Columbus. We are hiring a journeyman industrial electrician for second shift to keep our lines running and support capital projects.

Responsibilities
- Troubleshoot and repair 480V three-phase equipment, motor controls, VFDs and PLC-controlled conveyors
- Perform preventive maintenance on switchgear, panels and lighting
- Install conduit, wiring and panels for line upgrades per NEC
- Follow lockout-tagout and plant safety procedures; lead toolbox talks
- Read electrical blueprints and one-line diagrams; update as-builts

Requirements
- Ohio journeyman electrician license required
- 5+ years of industrial or commercial electrical experience
- Hands-on experience with 480V three-phase systems, motor control and PLC panels
- OSHA 10 or OSHA 30
- Forklift or aerial lift certification
- Ability to work second shift (2pm to 10:30pm)
- Must be authorized to work in the US

Preferred
- Allen-Bradley PLC troubleshooting experience
- Experience in food, beverage or packaging plants
- Crew lead or foreman experience

Pay $36 to $42 per hour plus shift differential. Equal opportunity employer.
```
