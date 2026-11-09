# Fixtures (synthetic)

**Everything in this folder is fictional.** No real patients, providers or plans. The denial packets are modeled on public NY external appeal summaries (case numbers in each `answer-key.md`), with all details rewritten and invented.

| Folder | What it is |
| --- | --- |
| `criteria/` | One-page public criteria summary (ASAM, LOCUS) used by the Payer Policy agent |
| `ur-1042/` | The concurrent-review demo case from the PRD: Payer North, authorized Nov 1–3, requested Nov 4–6, Nov 2 note missing |
| `ur-1042/late-arrival/` | The Nov 2 note, held back so the demo can "receive" it and trigger reruns |
| `ur-1042/payer-responses/` | Four alternate payer replies after submission: request for info (asks for the Nov 2 note), full approval, partial approval (Nov 4–5 approved, Nov 6 denied) and denial (PHP offered, expedited appeal). `expected-fields.json` holds the correct parsed fields for letter-parser evals |
| `packets/a` to `packets/e` | Denial packets: denial letter, intake, treatment plan, progress notes, answer key |
| `replay/` | Reviewed agent recordings for the UR-1042 demo (synthetic, model output only), recorded live on Haiku 5.5 on 2026-11-05 for case-assembly 1.3.0, clinical-documentation 1.5.0 and independent-quality 1.3.0. The hosted demo replays them with `AGENT_REPLAY_DIR=fixtures/replay`. A prompt change makes them miss; re-record and replace them in a PR |
| `demo/` | Demo mode's recordings (synthetic): every API response the screens saw while each role's script ran on a fresh local database with the `replay/` agents. `/demo` plays them with no login, database or model. Re-record with `npm run demo:record` after a screen, seed or replay change; `npm run test:demo` fails if a story no longer plays to the end |
| `packets/*/appeal-history/` | The appeal chain after each denial: internal appeal decision (upheld) and external review decision (the real case's outcome), plus `expected-fields.json` |

Rules:
- `answer-key.md` files are **never** loaded into agent prompts. The eval script reads them.
- `appeal-history/` letters reveal the real outcome, so they are never loaded while testing that packet's matching or drafting. They are for status-tracking demos and letter-parser evals.
- `expected-fields.json` files are answer keys for the letter parser; never load them into prompts.
- When testing a packet, exclude its source case from Case Match (`holdout_packet` in the appeal data).
- Each `case.json` is what the seed script loads into `cases`, `authorizations`, `review_periods`, `payer_letters` and `appeals`. Every other `.md` file becomes a `documents` row of the type in its front matter.
