/**
 * new_tab.js
 * ----------
 * An empty tab in the right-hand panel, kept for a team member to decide
 * what to put here.
 *
 *   *** TODO: choose what this tab shows, give it a name (change `label`
 *   *** below), and rename this file to match (also in index.html).
 *
 * How the tab works:
 *   The panel (panel.js) shows a "New tab" button next to "Details". When
 *   the analyst opens the tab, or the selection changes while it is open,
 *   the panel calls render(container) with an empty container to draw into.
 *
 * What you can use (all from js/app.js):
 *   App.data.nodes           every person: .id, .name, .aliases, .reports
 *   App.data.reports         every report: .id, .date, .source, .description,
 *                            .places, .person_ids, .reference_ids
 *   App.personById.get(id)   one person
 *   App.reportById.get(id)   one report
 *   App.state.selection      {type: "person" | "report", id} or null
 *   App.focusedReports()     IDs of the reports related to the selection
 *   App.select({type, id})   select a person or report (always use this:
 *                            it keeps every view linked and Undo working)
 *   App.byDate(reportIds)    the reports in date order
 *   App.plural(3, "report")  "3 reports" / "1 report"
 *   App.panel.render(true)   redraw the panel, keeping the scroll position
 *                            (for example after a button inside the tab)
 *
 * If the tab needs data the page does not have yet, add a processing step
 * in processing/ (see DEVELOPER.md, "Where to change what").
 */

(function () {
  "use strict";

  App.newTab = {
    id: "new",
    label: "New tab",   // TODO: rename

    /** Draw the tab into `container` (a D3 selection, emptied by the panel). */
    render(container) {
      container.append("h2").text("New tab");
      container.append("p").attr("class", "placeholder")
        .text("Empty.");
      // TODO: build the tab's content here.
    },
  };
})();
