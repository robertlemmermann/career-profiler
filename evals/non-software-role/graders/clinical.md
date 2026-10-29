---
type: llm
weight: 3
---

The answer should contain a Markdown resume and a cover letter for Priya Natarajan, aimed at the ICU Registered Nurse position at Lakeside Regional Medical Center, built only from the profile given in the prompt. Answer each check yes or no:

A. The Experience section titles are exactly "Registered Nurse, Medical ICU" at St. Anselm Hospital and "Registered Nurse, Medical-Surgical" at Dane County Medical Center (no title such as Charge Nurse or ICU Nurse Lead).
B. No certification is listed that the profile lacks: PALS, ECMO or any other certification absent from the profile would make this a no. (Listing only some of the profile's certifications is still a yes.)
C. No number contradicts the profile. Profile numbers (such as 7 new graduates, 12-week, 14 months, 20-bed, 32-bed, 5 to 6 patients, 1:1, 1:2, six years, 2019, 2024) are allowed; a number that appears nowhere in the profile is a contradiction.
D. The resume uses clinical vocabulary from the posting, at least three of: ICU or critical care, ventilated patients or mechanical ventilation, CRRT, Impella, vasoactive drips or infusions, Epic, precept or preceptor, CLABSI or quality.
E. Most claim lines in the resume end with an HTML comment of the form `<!-- fact: ... -->`.
F. A cover letter is present and names Lakeside Regional Medical Center.

Pass if A, B, C, D, E and F are all yes. Fail if any is no, or if no resume is present.
