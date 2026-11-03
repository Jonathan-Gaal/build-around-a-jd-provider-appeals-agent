# Cleaned behavioral-health appeal datasets

Built 2026-11-03. Rebuild any time with `python scripts/clean_appeals_data.py`.

```
data/
  raw/         original downloads (the CA CSV is gzipped to fit GitHub)
  processed/   the cleaned files the app reads
```

- `processed/ny_bh_appeals.csv`: **1,526 cases** from the New York DFS external appeal search export (`peasadata.xlsx`), decided 2019 to 2026.
- `processed/ca_bh_appeals.csv`: **2,154 cases** from California DMHC Independent Medical Review data (`independent-medical-review-imr-determinations-trends.csv`, covering 2001 to 2026). Only cases from 2019 on are kept.

Both files have the same columns, so the app can load them the same way. Never combine their overturn rates.

## Raw sources

The original downloads are in `data/raw/`. The California CSV is gzipped (`.csv.gz`) to stay under GitHub's file-size limit, and pandas reads it directly. To unzip it: `gunzip -k data/raw/*.csv.gz`.

- `peasadata.xlsx`: export from the [NY DFS external appeal search](https://www.dfs.ny.gov/public-appeal/search)
- `independent-medical-review-imr-determinations-trends.csv`: [California DMHC IMR data](https://data.chhs.ca.gov/dataset/b79b3447-4c10-4ae6-84e2-1076f83bb24e/resource/3340c5d7-4054-4d03-90e0-5f44290ed095/download/independent-medical-review-imr-determinations-trends.csv) ([data dictionary](https://data.chhs.ca.gov/dataset/b79b3447-4c10-4ae6-84e2-1076f83bb24e/resource/2c5c2144-138f-4feb-b2af-a1176995e1b1/download/imrdatadictionary.pdf))

## What was kept

Only medical-necessity decisions about a behavioral-health level of care.

**Removed:**
- Experimental or investigational denials.
- Drugs, surgery, imaging, tests and equipment.
- TMS.
- California urgent-care reimbursements.
- Duplicates.
- California cases before 2019.

## Columns

| Column | Meaning |
| --- | --- |
| case_id | The source's case number (NY) or reference ID (CA) |
| state | NY or CA |
| year | Decision year (NY) or report year (CA) |
| diagnosis | Diagnosis category |
| diagnosis_detail | CA only: diagnosis subcategory (for example Depression, Substance Use Disorder) |
| treatment_raw | The source's treatment label |
| care_level | Normalized level of care: Inpatient SUD/detox, Inpatient psych, Residential MH, Residential SUD, PHP, IOP, Outpatient MH, Outpatient SUD, Other |
| health_plan | NY only. Some plans still appear under two names (for example "Fidelis Care" and "Fidelis Care New York") |
| coverage_type | NY only: Medicaid, HMO, PPO and so on |
| decision | Overturned, Upheld, or Partly overturned (NY only). Don't count partly overturned cases as full wins |
| age_range, gender | As given by the source |
| summary | Reviewer's reasoning (NY: Summary 1 to 4 joined; CA: Findings) |
| references | NY only: the reviewer's cited references, joined |
| after_the_fact | True when the request was for care already given. In CA, this means "reimbursement" is mentioned without "prospective". NY summaries rarely say this, so the NY column is all false |
| criteria_cited | Criteria named in the text: ASAM, LOCUS, CALOCUS, LOCADTR, InterQual, MCG, APA |
| holdout_packet | True for the 5 NY cases behind the synthetic patient packets. Remove each from the search when testing its packet |

## Counts by care level

| Care level | NY | CA |
| --- | --- | --- |
| Inpatient SUD/detox | 743 | 6 |
| Inpatient psych | 439 | 53 |
| Residential MH | 110 | 846 |
| Residential SUD | 60 | 712 |
| PHP | 0 | 140 |
| IOP | 0 | 204 |
| Outpatient MH | 150 | 128 |
| Outpatient SUD | 18 | 1 |
| Other | 6 | 64 |

**Decisions:**
- NY: 879 overturned, 592 upheld, 55 partly overturned.
- CA: 1,651 overturned, 503 upheld.
