# Fixtures (synthetic)

**Everything in this folder is fictional.** No real patients, providers or plans. The denial packets are modeled on public NY external appeal summaries (case numbers in each `answer-key.md`), with all details rewritten and invented.

| Folder | What it is |
| --- | --- |
| `criteria/` | One-page public criteria summary (ASAM, LOCUS) used by the Payer Policy agent |
| `ur-1042/` | The concurrent-review demo case from the PRD: Payer North, authorized Nov 1–3, requested Nov 4–6, Nov 2 note missing |
| `ur-1042/late-arrival/` | The Nov 2 note, held back so the demo can "receive" it and trigger reruns |
| `packets/a` to `packets/e` | Denial packets: denial letter, intake, treatment plan, progress notes, answer key |

Rules:
- `answer-key.md` files are **never** loaded into agent prompts. The eval script reads them.
- When testing a packet, exclude its source case from Case Match (`holdout_packet` in the appeal data).
- Each `case.json` is what the seed script loads into `cases`, `authorizations`, `review_periods` and `denials`. Every other `.md` file becomes a `documents` row of the type in its front matter.
