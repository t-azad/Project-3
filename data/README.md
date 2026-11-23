# data

| Folder | What it holds | Who makes it |
|--------|---------------|--------------|
| `input/` | `dataset.txt`, the original 111 reports from the instructor | Given; never changed |
| `manual/` | Decisions written by hand that the scripts follow | A person (or AI), by hand |
| `generated/` | Files produced by the scripts | `processing/run_all.py`; do not edit, rerun instead |

## manual/

- `person_review.json`: which names belong to the same person (`groups`),
  which shared name belongs to two people (`splits`), pairs that might be the
  same person but were not merged (`possible`, shown as dashed lines), and
  similar names that are different people (`rejected_notes`). Each decision
  cites the report that supports it. Written by checking the suggestions
  from `processing/step2_person_candidates.py` against the report text.
- `ai_summaries/`: summaries written by an AI assistant (Claude) from the
  report text. One line per person and report, plus an overall summary for
  everyone named in two or more reports. Split into three files by how many
  reports a person appears in:
  `part1_main_people.json` (3 or more), `part2_two_reports.json` (2),
  `part3_one_report.json` (1).

## generated/

- `reports_raw.json` (step 1): the reports split into fields (id, date,
  text, persons, dates, places, ...). Nothing is corrected yet.
- `reports_resolved.json` (step 3): the same reports, each with a
  `person_ids` list pointing to the resolved people.
- `persons.json` (step 3): one record per person (139 raw names become
  103 people), with their other names, the evidence for each, and their
  reports.
