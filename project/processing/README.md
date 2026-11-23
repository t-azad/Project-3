# processing

Python scripts that turn the original dataset into the data the web page
loads. Standard library only. Run everything in order with:

```
python3 processing/run_all.py
```

| Step | Script | Reads | Writes |
|------|--------|-------|--------|
| 1 | `step1_parse_reports.py` | `data/input/dataset.txt` | `data/generated/reports_raw.json` |
| 2 | `step2_person_candidates.py` | `data/generated/reports_raw.json` | prints suggested same-person name pairs (no file) |
| 3 | `step3_resolve_persons.py` | `reports_raw.json` + `data/manual/person_review.json` | `data/generated/reports_resolved.json`, `data/generated/persons.json` |
| 4 | `step4_build_network.py` | `reports_resolved.json` + `persons.json` | `web/data/network.js` |
| 5 | `step5_build_ai_summaries.py` | `persons.json` + `data/manual/ai_summaries/` | `web/data/ai_summaries.js` |

- **Step 2** is a helper for the person review: a person reads its
  suggestions and records decisions in `data/manual/person_review.json`.
  `run_all.py` does not run it on its own, but step 3 uses it to report any
  suggestion that was never decided.
- `js_output.py` is a small helper used by steps 4 and 5: it writes data as a
  JavaScript file (`const NAME = {...};`) so the page works when opened
  straight from disk.

Each script can also be run on its own; its usage line is at the top of the
file.
