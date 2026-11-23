# Report Explorer

Interactive tool for exploring 111 intelligence reports (HCI course project).
It helps an analyst answer: who are the important suspects, what did they
plan, and when and where were the events scheduled.

## Run the tool

Open `index.html` (in the main project folder) in a web browser (Chrome, Firefox, Edge or Safari).
No server or internet connection is needed: D3.js is bundled in `web/lib/`
and all data is pre-built in `web/data/`.

## What the tool offers

- **Network** of people and reports: a person icon per person (aliases
  merged; size = number of reports) and a document icon per report, with a
  line from each person to each report that names them. Dashed lines join
  names that may be the same person. Reports that name no one (20) are not
  drawn; they can still be opened from a "Refers to" link.
  Search and zoom; click a selected
  person or report again to deselect it; Reset view (or Esc) clears the
  selection and shows the whole network.
- **Details panel**: for a person, an AI-written summary, their other
  names with evidence, connections, and their reports collapsed to one-line
  summaries (click a report to read it in full). For a report, the people it
  names and its full text.
- **New tab** (*empty for now*): a second panel tab kept for a team
  member to decide on; see "Task: the new tab" in `DEVELOPER.md`.
- **Undo** (or Ctrl+Z / Cmd+Z) goes back to the previous selection.

All views are linked: selecting a person or report in one place
highlights it in the others.

## Rebuild the data

Only needed if the dataset or the hand-written decisions change. Requires
Python 3 (standard library only). From the project folder:

```
python3 processing/run_all.py
```

This runs every processing step in order (see `processing/README.md`). To see
the automatically suggested same-person name pairs used when writing
`person_review.json`:

```
python3 processing/step2_person_candidates.py data/generated/reports_raw.json
```

## Project layout

Team members changing the code: start with `DEVELOPER.md`.


```
data/
  input/       the original dataset from the instructor
  manual/      files written by hand, used as instructions by the scripts
  generated/   files produced by the scripts (do not edit; rerun instead)
processing/    the data-processing scripts, numbered in the order they run
index.html     the page: open this to run the tool
web/           what the page loads: styles, JavaScript, D3, page data
```

| Path | Purpose |
|------|---------|
| `data/input/dataset.txt` | Original reports from the instructor |
| `data/manual/person_review.json` | Reviewed decisions about aliases and shared names, with evidence |
| `data/manual/ai_summaries/` | AI-written person summaries (see "Existing work and AI use") |
| `data/generated/reports_raw.json` | The reports as structured data (step 1) |
| `data/generated/reports_resolved.json` | The reports with resolved person IDs (step 3) |
| `data/generated/persons.json` | One record per person, with aliases and evidence (step 3) |
| `processing/run_all.py` | Runs the whole pipeline |
| `processing/step1_parse_reports.py` | Raw text to structured JSON |
| `processing/step2_person_candidates.py` | Suggest names that may be the same person |
| `processing/step3_resolve_persons.py` | Apply reviewed decisions (merge aliases, split shared names) |
| `processing/step4_build_network.py` | Network data for the page |
| `processing/step5_build_ai_summaries.py` | Checks the AI-written summaries and copies them for the page |
| `processing/js_output.py` | Helper: writes processed data as JavaScript for the page |
| `index.html` | The page; open this to run the tool |
| `web/data/` | Data the page loads (made by steps 4 and 5) |
| `web/js/app.js` | Shared state, undo history and events that link the views |
| `web/js/tooltip.js` | The hover tooltip |
| `web/js/network.js` | The people-and-reports network |
| `web/js/summaries.js` | AI-written person summaries in the Details tab |
| `web/js/new_tab.js` | An empty panel tab for a team member to fill in |
| `web/js/panel.js` | The right-hand panel and its Details tab |
| `web/js/main.js` | Header controls (search, Undo, Reset) and start-up |
| `DEVELOPER.md` | Guide for team members changing the code |

## Design history

During development five versions were built and compared, each with a
different way of supporting the question "what did they plan": threat
categories, distinctive words (TF-IDF), automatic topics (LDA), similar
reports and an evidence board, in different combinations. Summaries were
also compared in three forms: computed (extractive), AI-written, and both.
The AI-written summaries were kept; the other features, including the
threat categories and the evidence board, were later removed. The network
was compared in two forms, people only (people linked when named in the
same report) and people and reports; the final tool uses people and
reports, which shows which report connects people. An earlier timeline view
(report dates and mentioned dates on a time axis) was replaced by a Dates
tab, a readable list of the same dates; that tab was later removed and its
place left empty for a team member to design.

