# Developer guide

A short guide for team members who want to change the Report Explorer.

## The big picture

The project has two halves that never run at the same time:

1. **Processing (Python, run once).** Scripts in `processing/` read
   `data/input/dataset.txt`, clean it up and write the page's data into
   `web/data/`. Run them again only when the dataset or a file in
   `data/manual/` changes.
2. **The page (JavaScript, runs in the browser).** `index.html` (in the main folder) loads
   the data from `web/data/` and draws the interface. No server is needed:
   open the file in a browser.

```
dataset.txt ──► processing/run_all.py ──► web/data/*.js ──► index.html
                  (steps 1 to 5)            (data files)      (the tool)
                      ▲
     data/manual/ (decisions made by hand: aliases, AI summaries)
```

## Processing: what each step does

| Step | Reads | Writes | In one sentence |
|------|-------|--------|-----------------|
| 1 `step1_parse_reports.py` | `dataset.txt` | `reports_raw.json` | Splits the text into reports with fields (date, people, places, text). |
| 2 `step2_person_candidates.py` | (used by step 3) | nothing | Suggests names that might be the same person. |
| 3 `step3_resolve_persons.py` | step 1 output, `person_review.json` | `persons.json`, `reports_resolved.json` | Applies the reviewed decisions: merges aliases, splits a shared name. |
| 4 `step4_build_network.py` | step 3 output | `web/data/network.js` | People, reports (with the dates each one mentions) and the links between them. |
| 5 `step5_build_ai_summaries.py` | `data/manual/ai_summaries/` | `web/data/ai_summaries.js` | Checks that every person has a summary and copies them for the page. |

Rebuild everything with `python3 processing/run_all.py` (standard library
only, nothing to install). Never edit files in `data/generated/` or
`web/data/` by hand: they are overwritten on every run.

## The page: how the files work together

The scripts load in this order (see the bottom of `index.html`). Each file
only uses files loaded before it.

| File | Job | Adds to `App` |
|------|-----|---------------|
| `web/lib/d3.min.js` | The D3 library | |
| `web/data/*.js` | The data, as constants `NETWORK_DATA`, `AI_SUMMARY_DATA` | |
| `web/js/app.js` | **Shared state.** The current selection, the undo history, events | creates `App` |
| `web/js/tooltip.js` | The hover box | (creates `Tooltip`) |
| `web/js/network.js` | The people-and-reports network on the left | `App.network` |
| `web/js/summaries.js` | The AI-written summary boxes | `App.summaries` |
| `web/js/new_tab.js` | The Dates tab: lists the dates mentioned in reports and whether each is past or planned | `App.newTab` |
| `web/js/panel.js` | The right-hand panel and its Details tab | `App.panel` |
| `web/js/main.js` | Search box, Undo, Reset, keyboard shortcuts; starts everything | |

### The one rule: change the selection only through `App.select`

Everything that is "selected" lives in one place, `App.state.selection`
(`{type: "person" | "report", id}` or `null`). Parts of the page never talk
to each other directly. Instead:

```
a click anywhere ──► App.select({type, id})
                         │  saves the old selection for Undo
                         ▼
                 "selection" event
            ┌────────────┼─────────────┐
            ▼            ▼             ▼
       network.js    panel.js       main.js
     (highlights)  (redraws the   (clears the search
                    Details tab)    message)
```

This is the "brushing and linking" from the lectures: one click updates
every view. Undo works because `App.select` remembers every previous
selection; `App.undo()` restores the last one and fires the same event.

To react to a selection in new code, listen for the event (the part after
the dot is just a unique name for your listener):

```js
App.events.on("selection.myPart", () => {
  const sel = App.state.selection;   // what is selected now
  // ... update your view ...
});
```

## Where to change what

| I want to... | Change |
|--------------|--------|
| Change colors, sizes or fonts | `web/css/style.css` |
| Change the help text shown when nothing is selected | `renderOverview` in `panel.js` |
| Change what a person's Details view shows | `renderPerson` in `panel.js` |
| Change how report cards look or expand | `reportList` in `panel.js` |
| Change the person or report icons | `drawPerson` / `drawReport` in `network.js` |
| Change the network layout (spacing, forces) | the simulation set-up in `network.js` |
| Change the Dates tab | `new_tab.js` |
| Change a summary text | the JSON in `data/manual/ai_summaries/`, then rerun `run_all.py` |
| Merge or split names | `data/manual/person_review.json`, then rerun `run_all.py` |
| Add a field the page needs | `step4_build_network.py` (or a new step), then rerun `run_all.py` |
| Change how a date counts as past, planned or unclear | `relation()` in `new_tab.js` |
| Add more date information to the page | `step4_build_network.py` (the "dates" field), then rerun `run_all.py` |

## The Dates tab

`web/js/new_tab.js` draws the Dates tab. It gets its data from the `dates`
field that `step4_build_network.py` writes for each report (the raw text,
a sortable `YYYY-MM-DD` key and the precision: year, month or day).

For each date, `relation()` compares it with the date the report was
written, using only the part that BOTH dates state (a report dated only
"4/ /2003" is compared by month, even with a full day):

- earlier than the report date: "past" (already happened)
- later than the report date: "planned" (not yet happened when written)
- the exact same day: "same" (same day as the report)
- equal as far as both dates go, but not two exact days: "unclear"

Step 4 keeps each date once per report (`unique_dates`), because the
dataset sometimes lists the same date twice.

Rows are sorted planned first. Clicking a row calls `App.select`, so the
network, Details tab and Undo stay linked. The tab shows all of a report's
places next to each date, because the data does not link a date to one
specific place.

## Coding conventions

- Every file starts with a comment block: what it does and what it exposes.
- JavaScript files wrap their code in `(function () { ... })();` so their
  helper functions stay private. Anything other files need is added to `App`.
- Use full, meaningful names (`reportById`, not `rb`).
- Put a short comment above each function saying what it does, and why
  when it isn't obvious.
- After a change, open the page, try a few clicks (select a person, open a
  report, open the Dates tab, Undo, Esc) and check the browser console has no errors.
