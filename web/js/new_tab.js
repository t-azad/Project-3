
/**
 * new_tab.js
 * ----------
 * The Dates tab in the right-hand panel. It lists every date mentioned in
 * a report, compared with the date the report was written, so the analyst
 * can see which events had already happened and which were still planned.
 *
 * How the tab works:
 *   The panel (panel.js) shows a "Dates" button next to "Details". When the
 *   analyst opens the tab, or the selection changes while it is open, the
 *   panel calls render(container) with an empty container to draw into.
 *
 * What it uses (from js/app.js):
 *   App.data.reports       every report, including .date_key, .dates,
 *                          .person_ids and .places
 *   App.personById         look up a person's name
 *   App.focusedReports()   reports related to the selection (others are dimmed)
 *   App.select({type, id}) select a report (keeps every view linked and Undo working)
 *
 * Dates come from the "dates" field written by processing/step4_build_network.py.
 */

(function () {
  "use strict";

  // How many characters of a "YYYY-MM-DD" key a date really states.
  const PRECISION_LENGTH = { year: 4, month: 7, day: 10 };

  // Order of the groups in the list: planned events first.
  const RELATION_ORDER = { planned: 0, unclear: 1, past: 2 };
  const RELATION_LABEL = {
    planned: "Planned (after report)",
    unclear: "Unclear",
    past: "Already happened",
  };

  /**
   * Compare a date mentioned in a report with the date the report was
   * written: "past", "planned" or "unclear". Only the part of the date the
   * report actually states is compared, so a year-only date such as 2003
   * in a report written in 2003 is "unclear", not "past".
   */
  function relation(date, reportKey) {
    const length = PRECISION_LENGTH[date.precision];
    const mentioned = date.key.slice(0, length);
    const written = reportKey.slice(0, length);
    if (mentioned < written) return "past";
    if (mentioned > written) return "planned";
    return "unclear";
  }

  /** One row per date mentioned in any report, planned first, then by date. */
  function buildRows() {
    const rows = App.data.reports.flatMap((report) =>
      report.dates.map((date) => ({ report, date, relation: relation(date, report.date_key) })));
    return rows.sort((a, b) =>
      RELATION_ORDER[a.relation] - RELATION_ORDER[b.relation] ||
      a.date.key.localeCompare(b.date.key) ||
      a.report.id.localeCompare(b.report.id));
  }

  App.newTab = {
    id: "dates",
    label: "Dates",

    /** Draw the tab into `container` (a D3 selection, emptied by the panel). */
    render(container) {
      const rows = buildRows();
      const counts = { planned: 0, unclear: 0, past: 0 };
      rows.forEach((row) => counts[row.relation]++);

      container.append("h2").text("Dates");
      container.append("p").attr("class", "dates-intro")
        .text("Every date mentioned in a report, compared with the date the report " +
              "was written. A date after the report date is probably a planned event.");
      container.append("p").attr("class", "dates-counts")
        .text(`${counts.planned} planned, ${counts.unclear} unclear, ${counts.past} already happened`);

      // Dim rows unrelated to the current selection (if any).
      const focused = App.focusedReports();

      const list = container.append("div").attr("class", "dates-list");
      const row = list.selectAll("div.dates-row")
        .data(rows)
        .join("div")
        .attr("class", (d) => `dates-row dates-${d.relation}` +
          (focused && !focused.has(d.report.id) ? " dimmed" : ""))
        .attr("role", "button")
        .attr("tabindex", 0)
        .on("click", (event, d) => App.select({ type: "report", id: d.report.id }))
        .on("keydown", (event, d) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            App.select({ type: "report", id: d.report.id });
          }
        });

      const head = row.append("div").attr("class", "dates-head");
      head.append("span").attr("class", "dates-date").text((d) => d.date.raw);
      head.append("span").attr("class", "dates-badge").text((d) => RELATION_LABEL[d.relation]);

      row.append("div").attr("class", "dates-meta")
        .text((d) => `${d.report.id} (written ${d.report.date})`);
      row.append("div").attr("class", "dates-people")
        .text((d) => "People: " + (d.report.person_ids.length
          ? d.report.person_ids.map((id) => App.personById.get(id).name).join(", ")
          : "none named"));
      row.append("div").attr("class", "dates-places")
        .text((d) => "Places: " + (d.report.places.length ? d.report.places.join(", ") : "none"));
    },
  };
})();