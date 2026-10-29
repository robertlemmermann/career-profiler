---
type: llm
weight: 3
---

You see only the assistant's answer. It should contain a Markdown resume and a cover letter for Priya Natarajan aimed at an ICU Registered Nurse position at Lakeside Regional Medical Center. Every fact you need to verify the answer is listed here; do not require anything else. Answer each check yes or no using only these lists and the answer.

Allowed facts about the candidate:
- Roles: "Registered Nurse, Medical ICU" at St. Anselm Hospital, Milwaukee, WI, August 2020 to present; "Registered Nurse, Medical-Surgical" at Dane County Medical Center, Madison, WI, June 2018 to July 2020.
- Certifications: Registered Nurse license (Wisconsin Board of Nursing, 2018, expires February 2027); CCRN (AACN, 2022, expires 2028); ACLS (American Heart Association, 2024, expires 2028); BLS (American Heart Association, 2024, expires 2028).
- Education: BSN in Nursing, University of Wisconsin–Madison, 2014 to 2018.
- Numbers describing the candidate: 7 new graduates precepted; 12-week orientation; all 7 retained at one year; 14 months without a CLABSI; 20-bed medical ICU; 32-bed medical-surgical unit; 5 to 6 telemetry patients per shift; 1:1 and 1:2 assignments; six years of critical care; relief charge nurse since 2024; 2019 DAISY award nomination; 34-person team; phone +1 608 555 0117.
- Numbers that come from the posting and may be quoted about the employer: 24-bed ICU, 36 hours per week, three 12-hour shifts, 2 years of ICU experience required, 6 months. Today's date may also appear.

Checks:
A. In the Experience section, the two role titles are exactly "Registered Nurse, Medical ICU" and "Registered Nurse, Medical-Surgical" with the employers above. (Words like "relief charge nurse" inside a bullet or the summary are fine; only a changed title line is a no.)
B. Every certification named anywhere in the answer is one of the four allowed certifications. PALS, ECMO, TNCC, NIHSS or any other certification is a no.
C. The candidate's result metrics are unchanged. Wherever these appear they read exactly: 7 new graduate nurses precepted (all 7 retained at one year); 12-week orientation; 14 months without a CLABSI; 20-bed medical ICU; 32-bed medical-surgical unit; 5 to 6 telemetry patients per shift; 1:1 and 1:2 assignments. A changed value (for example 8 nurses, 15 months, 24-bed when describing the candidate's own unit) is a no. The answer also contains no other count or percentage describing the candidate's own results (infections, patients, awards, satisfaction scores). Years, months, dates, "six years", "since 2023", "since 2024", the 2019 DAISY nomination, the phone number and numbers quoted from the posting are all fine.
D. The resume uses at least three of these posting terms: ICU or critical care; ventilated patients or mechanical ventilation; CRRT; Impella; vasoactive drips or infusions; Epic; precept or preceptor; CLABSI or quality initiative.
E. Most claim lines in the resume (summary, skills, experience bullets, education, certifications) end with an HTML comment of the form `<!-- fact: ... -->`.
F. A cover letter is present and names Lakeside Regional Medical Center.

Pass if A, B, C, D, E and F are all yes. Fail if any is no or if no resume is present.
