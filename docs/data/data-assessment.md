# Data assessment

We don't need more case data. The two files already cover the core UR task: showing why similar denials were overturned and which criteria the reviewers cited. What's missing is the patient's own chart (intake, treatment plan, notes), the denial letter and the payer's own criteria, and none of those are public. We make them synthetic (see [synthetic patients](synthetic-patients.md)) and say in the presentation that plans' internal criteria are out of scope.

Files, columns and cleaning rules are documented in [`../../data/README.md`](../../data/README.md).

## What we have

After cleaning: **1,526 NY cases and 2,154 CA cases**, all medical-necessity decisions about a behavioral-health level of care, from 2019 on, decided by independent external reviewers.

| | New York (DFS external appeals) | California (DMHC IMR) |
| --- | --- | --- |
| Cases | 1,526 | 2,154 |
| Decisions | 879 overturned, 592 upheld, 55 partly overturned | 1,651 overturned, 503 upheld |
| Overturned | 58% (60% excluding partial) | 77% |
| Strongest care types | Inpatient SUD/detox (743), inpatient psych (439) | Residential MH (846), residential SUD (712), IOP (204), PHP (140) |
| Weakest care types | No IOP or PHP | Detox (6), inpatient psych (53) |
| Patients | Adults, mostly 30 to 59; Medicaid-heavy | Younger; ages 11 to 20 is the largest group |
| Cases per year lately | About 80 to 100 | About 250 to 350 |
| Names the health plan and coverage type | Yes | No |
| Criteria cited | Yes, in the references (LOCADTR, ASAM, LOCUS, APA) | Yes, inside the findings text (about 90% of cases) |
| Reviewer's reasoning | Summary, median about 3,200 characters | Findings paragraph |
| Care already given (reimbursement) | Not stated | 918 cases, tagged `after_the_fact` |

## Keep both, but don't mix them

The two files barely overlap in care types, so each covers the other's gaps. Keeping both makes the product stronger, as long as three rules hold:

1. **Every case shows its state.** Case Match labels each match "New York" or "California."
2. **Match within the same care type, and prefer the same state.** Detox cases come from New York and residential cases from California, because that's where the data is.
3. **Never pool the overturn rates.** The states run different review systems, with different laws and patients. Report each state's rate on its own.

If we had to keep just one, it would be New York. It has the plan names, Medicaid coverage and cited criteria that the Ritten JD needs. We'd lose most residential, IOP and PHP examples, though, and those are levels of care Ritten lists.

## Records left out

Anything that isn't a medical-necessity decision about a behavioral-health level of care:

| Left out | New York | California | Why |
| --- | --- | --- | --- |
| Experimental or investigational denials | 15 | 63 | A different argument: whether the treatment works, not whether this patient needs it |
| Drugs, surgery, imaging, tests, equipment | none (filtered by treatment type) | about 520, including 181 pharmacy and 154 surgical, mostly gender-affirming procedures | Not utilization review of a level of care |
| TMS and other device treatments | none | 31 | A procedure, not a level of care |
| Urgent-care reimbursement | none | 7 | Emergency billing, not authorization |
| Duplicates | 25 | 5 | They would double-count in matches and overturn rates |
| Cases before 2019 | none | about 3,400 | Criteria and parity rules have changed. California's law on which criteria plans must use changed in 2021 |

Kept but labeled:

- **Partly overturned** (55 in NY), for example some days approved and others denied. Good examples, but don't count them as full wins.
- **Reimbursement requests** (918 in CA), where the care already happened. The arguments still apply, but the agent must not mistake them for prior-authorization cases.

Also hold out the 5 source cases behind the synthetic patient packets when testing each packet (`holdout_packet` column).

## Where the data succeeds

It is strong at one thing: showing what a winning argument looks like for a given level of care.

1. **Find similar overturned cases.** A Medicaid patient with opioid use disorder has an inpatient detox stay denied after day 3. The agent returns case 201908-120030 (Fidelis Care, Medicaid, 2019), which was overturned. The reviewer wrote that the patient had recently started injecting, had withdrawal symptoms that "worsened during her stay," and lived in a "social environment [that] was not conducive to detoxification," so care "could not have been safely or effectively provided at a lower level of care."
2. **Show what loses.** Case 201908-119701 (Fidelis Care, Medicaid, 2019) was also inpatient detox, but upheld: CIWA 2, COWS 0, an "uncomplicated" course. Next to the winning case, the agent can say: "Overturned cases at this level cite worsening withdrawal and an unsafe home environment. Your notes record neither. Add them if they're true."
3. **Name the right criteria.** NY references show which criteria reviewers actually cite per care type: LOCADTR and ASAM for detox, LOCUS for mental-health levels of care. A CA IOP case (MN25-45967, depression, 2025, overturned) quotes LOCUS's six dimensions directly.
4. **Estimate the odds.** Overturn rates by care type give a starting estimate, for example NY inpatient detox 61%, CA IOP 80%. Label it "overturn rate at external review," never "chance of winning."
5. **Track denial trends by payer.** New York only, since it names the plan. Ritten's JD asks for this.

## Where it fails

Every case here reached an independent external reviewer, the last step. Most of a UR specialist's day comes before that.

| Gap | What it looks like in the demo | Fix |
| --- | --- | --- |
| No patient chart | The agent knows what wins but has no intake, plan or notes to check | Write 5 synthetic patient packets |
| No denial letters | The agent can't answer the plan's stated reason point by point | Write synthetic denial letters modeled on NY reasons |
| Payers' own criteria aren't public | Plans use InterQual or MCG, which are paid products | Use public criteria (LOCUS, ASAM summary, LOCADTR) and say so on a slide |
| Only the last appeal stage | No internal appeals, peer-to-peer outcomes or prior-auth approvals | Treat odds as a ceiling, and frame the agent as helping write a stronger first request and appeal |
| Thin recent NY data | About 80 to 100 cases a year since 2024; outpatient SUD has 18 cases | Fall back to CA for that care type, and show "few similar cases" when matches are thin |
| No Medicare | Neither file covers it, and Ritten lists it | Scope it out on a slide |
| One-sided overturn rates | Only cases patients chose to take to external review | Label as "overturn rate at external review" |
| Messy text | Plan names repeat with spelling variants ("Healthfirst Inc." and "Healthfirst, Inc.") | Normalize once before building |

## What to add

Both written by us, no download needed:

1. **Synthetic patient packets** (see [synthetic-patients.md](synthetic-patients.md)).
2. **A one-page summary of the public criteria:** LOCUS's six dimensions, ASAM's six dimensions and the levels of care each maps to. The Payer Policy agent checks the chart against it.

**Presentation demo:** a denied detox packet. The agent pulls up 201908-120030 (overturned) next to 201908-119701 (upheld), flags what the chart is missing, and drafts the appeal using the ASAM dimensions. The clinician reviews and approves it.

## Sources

- [New York DFS external appeal search](https://www.dfs.ny.gov/public-appeal/search), exported as `peasadata.xlsx`
- [California DMHC Independent Medical Review data](https://catalog-beta.data.gov/dataset/independent-medical-review-imr-determinations-trend), CSV
- [Ritten Authorization (UR) Specialist posting](https://www.ritten.io/jobs/authorization-ur-specialist)
