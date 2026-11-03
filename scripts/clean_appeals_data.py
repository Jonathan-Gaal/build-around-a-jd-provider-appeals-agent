"""Rebuild data/processed/*.csv from the raw source files in data/raw/.

Usage (from the repo root):
    pip install pandas openpyxl
    python scripts/clean_appeals_data.py

Raw inputs (committed; see data/README.md for where they came from):
    data/raw/peasadata.xlsx                                            NY DFS external appeal export
    data/raw/independent-medical-review-imr-determinations-trends.csv.gz  CA DMHC IMR data, gzipped
"""
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"

# NY cases behind the synthetic patient packets; hold each out when testing its packet.
HOLDOUT = {"202012-133135", "201908-119701", "202012-133712", "202012-133533", "202101-134221"}
CRITERIA = ["ASAM", "LOCUS", "CALOCUS", "LOCADTR", "InterQual", "MCG", "APA"]
SUD = r"Substance|Alcohol|ETOH"


def criteria_cited(text: str) -> str:
    return ";".join(k for k in CRITERIA if re.search(rf"\b{k}\b", text))


def join_cols(row, cols):
    return "\n\n".join(str(row[c]) for c in cols if pd.notna(row[c]))


def build_ny() -> pd.DataFrame:
    d = pd.read_excel(RAW / "peasadata.xlsx")
    bh = d[d["Treatment"].astype(str).str.contains("Mental Health|Substance", case=False)]
    bh = bh[bh["Denial Reason"] == "Medical necessity"].drop_duplicates("Case Number").copy()
    levels = {
        "Substance Abuse: Inpatient": "Inpatient SUD/detox",
        "Mental Health: Inpatient": "Inpatient psych",
        "Mental Health: Outpatient": "Outpatient MH",
        "Mental Health: Residential": "Residential MH",
        "Substance Abuse Treatment: Residential": "Residential SUD",
        "Substance Abuse: Outpatient": "Outpatient SUD",
    }
    ny = pd.DataFrame({
        "case_id": bh["Case Number"],
        "state": "NY",
        "year": bh["Decision Year"].astype(int),
        "diagnosis": bh["Diagnosis"].str.strip("[]"),
        "diagnosis_detail": "",
        "treatment_raw": bh["Treatment"].str.strip("[]"),
        "care_level": bh["Treatment"].map(lambda t: levels.get(t.strip("[]").split(",")[0].strip(), "Other")),
        "health_plan": bh["Health Plan"].str.replace(r"\s+", " ", regex=True).str.replace(",", "")
                          .str.replace(r"\.$", "", regex=True).str.strip(),
        "coverage_type": bh["Coverage Type"],
        "decision": bh["Appeal Decision"].map({"Overturned": "Overturned", "Upheld": "Upheld",
                                               "Overturned in Part": "Partly overturned"}),
        "age_range": bh["Age Range"],
        "gender": bh["Gender"],
        "summary": bh.apply(lambda r: join_cols(r, [f"Summary {i}" for i in range(1, 5)]), axis=1),
        "references": bh.apply(lambda r: join_cols(r, [f"References {i}" for i in range(1, 5)]), axis=1),
    })
    ny["after_the_fact"] = ny["summary"].str.contains(r"retrospective|retro-", case=False)
    ny["criteria_cited"] = (ny["summary"] + " " + ny["references"]).map(criteria_cited)
    ny["holdout_packet"] = ny["case_id"].isin(HOLDOUT)
    return ny


def ca_level(row) -> str:
    t = str(row.TreatmentSubCategory)
    kind = "SUD" if re.search(SUD, str(row.DiagnosisSubCategory)) else "MH"
    if t.startswith("RTC"):
        return f"Residential {kind}"
    if t.startswith("Acute Psych") or t == "Inpt Admission":
        return "Inpatient psych" if kind == "MH" else "Inpatient SUD/detox"
    if t == "Partial Hospital":
        return "PHP"
    if t == "Intensive Outpt Prog":
        return "IOP"
    if t in ("Individ Counsel", "Psychotherapy", "Behavioral Therapy", "Psychological Evaluation",
             "Group Counsel", "Family Counsel"):
        return f"Outpatient {kind}"
    return "Other"


def build_ca() -> pd.DataFrame:
    c = pd.read_csv(RAW / "independent-medical-review-imr-determinations-trends.csv.gz")
    m = c[(c["DiagnosisCategory"] == "Mental Disorder")
          | c["DiagnosisSubCategory"].astype(str).str.contains(SUD)]
    r = m[(m["ReportYear"] >= 2019) & (m["Type"] == "Medical Necessity")
          & m["TreatmentCategory"].isin(["Mental Health", "Alcohol Drug Tmt"])]
    r = r[r["TreatmentSubCategory"] != "TMS"].drop_duplicates("Findings").copy()
    ca = pd.DataFrame({
        "case_id": r["ReferenceID"],
        "state": "CA",
        "year": r["ReportYear"].astype(int),
        "diagnosis": r["DiagnosisCategory"],
        "diagnosis_detail": r["DiagnosisSubCategory"],
        "treatment_raw": r["TreatmentCategory"] + ": " + r["TreatmentSubCategory"].astype(str),
        "care_level": r.apply(ca_level, axis=1),
        "health_plan": "",
        "coverage_type": "",
        "decision": r["Determination"].map({"Overturned Decision of Health Plan": "Overturned",
                                            "Upheld Decision of Health Plan": "Upheld"}),
        "age_range": r["AgeRange"],
        "gender": r["PatientGender"],
        "summary": r["Findings"],
        "references": "",
    })
    s = ca["summary"].str.lower()
    ca["after_the_fact"] = s.str.contains("reimbursement") & ~s.str.contains("prospective")
    ca["criteria_cited"] = ca["summary"].map(criteria_cited)
    ca["holdout_packet"] = False
    return ca


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, df in (("ny_bh_appeals.csv", build_ny()), ("ca_bh_appeals.csv", build_ca())):
        df.to_csv(OUT / name, index=False)
        print(f"{name}: {len(df)} rows")
