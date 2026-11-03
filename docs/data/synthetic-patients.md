# Synthetic patient packets

Each synthetic patient is based on a real New York case. We expand the reviewer's summary into the chart the provider would have written. The case's real outcome becomes the answer key, so we can test whether the agent's call matches what the reviewer actually decided.

**Rule:** remove the source case from the search when testing its packet. Otherwise the agent finds its own source and looks smarter than it is. These cases have `holdout_packet = True` in `data/processed/ny_bh_appeals.csv`.

| Packet | Source case | Care type | Plan, coverage | Real outcome | What the demo shows |
| --- | --- | --- | --- | --- | --- |
| A | 202012-133135 (2021) | Inpatient detox, alcohol and benzodiazepines, man in his 60s | MetroPlus, HMO | Overturned | A strong appeal. The agent finds similar wins and drafts the appeal using ASAM dimensions |
| B | 201908-119701 (2019) | Inpatient detox, heroin, Xanax and alcohol | Fidelis, Medicaid | Upheld | Honest advice. Withdrawal scores were minimal (CIWA 2, COWS 0), so the agent says the appeal is weak unless the notes show more risk |
| C | 202012-133712 (2021) | Inpatient psych, anorexia with depression, woman in her 20s | Affinity, Medicaid | Overturned | Mental health, with LOCUS instead of ASAM |
| D | 202012-133533 (2021) | Residential mental health, schizoaffective disorder and bulimia, woman in her 20s | Oxford, EPO | Overturned | Commercial coverage and a residential level of care |
| E | 202101-134221 (2021) | Residential substance-use rehab, man in his 50s | Empire, Medicaid | Upheld | The documentation-gap check. Leave out the discharge plan and why a lower level of care failed, and the agent flags both |

## What each packet contains

Five short documents, with fake names and dates:

1. **Denial letter.** The plan, the service, the dates denied, and a one-line reason such as "does not meet criteria for continued stay at this level of care."
2. **Intake assessment.** History, substance use or symptoms, risk (suicide, withdrawal, medical), home environment, and earlier treatment.
3. **Treatment plan.** Goals, the level of care and why, the expected length of stay, and the discharge plan (left out on purpose in packet E).
4. **Two or three progress notes** covering the denied dates, with the details reviewers weigh: withdrawal scores, vital signs, mood and engagement.
5. **Answer key.** Not shown to the agent: the source case number, the real outcome and the reviewer's key reasons.
