/**
 * panel.js
 * --------
 * Right-hand panel with two tabs:
 *   Details   the evidence for the current selection (a person or a report)
 *   Dates tab: dates mentioned in the reports (new_tab.js)
 *
 * Any new selection switches back to the Details tab, so the analyst always
 * sees the result of a click (visibility of system status).
 */

(function () {
  "use strict";

  const { data, personById, reportById, state, plural } = App;
  const panel = d3.select("#panel");
  const tabBar = panel.append("nav").attr("class", "panel-tabs");
  const body = panel.append("div").attr("class", "panel-body");

  let activeTab = "details";

  // ---------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------

  function allTabs() {
    return [{ id: "details", label: "Details", render: renderDetails }, App.newTab];
  }

  // Scroll position of each tab, so returning to a long tab lands where
  // the analyst left it.
  const scrollByTab = {};

  function showTab(id) {
    scrollByTab[activeTab] = body.node().scrollTop;
    activeTab = id;
    render();
    if (id !== "details") body.node().scrollTop = scrollByTab[id] || 0;
  }

  /** Redraw the panel. Scrolls to the top unless `keepScroll` is true. */
  function render(keepScroll = false) {
    const scroll = body.node().scrollTop;
    const tabs = allTabs();
    tabBar.selectAll("button")
      .data(tabs, (t) => t.id)
      .join("button")
      .attr("type", "button")
      .attr("class", (t) => "tab" + (t.id === activeTab ? " active" : ""))
      .text((t) => t.label)
      .on("click", (event, t) => showTab(t.id));

    body.html("");
    const tab = tabs.find((t) => t.id === activeTab) || tabs[0];
    tab.render(body);
    body.node().scrollTop = keepScroll ? scroll : 0;
  }

  // ---------------------------------------------------------------------
  // Details tab
  // ---------------------------------------------------------------------

  function renderDetails(container) {
    const sel = state.selection;
    if (!sel) renderOverview(container);
    else if (sel.type === "person") renderPerson(container, personById.get(sel.id));
    else renderReport(container, reportById.get(sel.id));
  }

  /** Shown when nothing is selected: how to use the tool, and a start list. */
  function renderOverview(container) {
    container.append("h2").text("Report Explorer Instructions");
    container.append("p").attr("class", "meta")
      .text(`${data.nodes.length} people named across ${data.reports.length} reports.`);
    const help = container.append("ul").attr("class", "help");
    help.html(
      "<li>Click a person to see a summary of what they did, their other names, " +
      "connections and reports. Their reports are also highlighted in the network.</li>" +
      "<li>A person's reports is initially collapsed to a short summary, click a report to read it in full.</li>" +
      "<li>Click a report icon (or a line to it) to open that report and see who it names.</li>" +
      "<li>In a full report, <mark class=\"person\">names</mark> are highlighted in yellow " +
      "(click one to jump to that person) and <mark class=\"place\">places</mark> in green.</li>" +
      "<li>The <b>Dates</b> tab lists every date the reports mention and checks whether it falls " +
      "before or after the day the report was written. Dates that appear after the report was written, " +
      "may be planned events. Click a row to open its report.</li>" +
      "<li>Dashed lines mark names that may belong to the same person.</li>" +
      "<li>Click a selected person or report again< to deselect it.</li>" +
      "<li><b>Undo</b> button goes back to the previous selection.</li>" +
      "<li><b>Reset view</b> button clears the selection and shows the whole network.</li>" +
      "<li>Person summaries are AI-written and may be missing other details. " +
      "Check the full reports for more information.</li>");

    container.append("h3").text("Most-mentioned people");
    const top = [...data.nodes].sort((a, b) => b.report_count - a.report_count).slice(0, 12);
    chipList(container, top.map((p) => ({ id: p.id, label: p.name, count: p.report_count })));
  }

  function renderPerson(container, person) {
    container.append("h2").text(person.name);
    const neighbors = neighborCounts(person.id);
    container.append("p").attr("class", "meta").text(
      `Named in ${plural(person.report_count, "report")} · ` +
      `connected to ${plural(neighbors.length, "person", "people")}`);

    App.summaries.renderOverall(container, person.id);

    if (person.aliases.length) {
      container.append("h3").text("Also known as");
      for (const alias of person.aliases) {
        const row = container.append("div").attr("class", "alias");
        row.append("span").text(alias.name);
        if (alias.status !== "primary") {
          row.append("span").attr("class", "badge " + alias.status).text(alias.status);
        }
        if (alias.evidence) container.append("p").attr("class", "evidence").text(alias.evidence);
      }
    }

    const possible = data.possible_links.filter((l) => l.source === person.id || l.target === person.id);
    if (possible.length) {
      container.append("h3").text("Possibly the same person as");
      for (const link of possible) {
        const otherId = link.source === person.id ? link.target : link.source;
        chipList(container, [{ id: otherId, label: personById.get(otherId).name }]);
        container.append("p").attr("class", "evidence").text(link.evidence);
      }
    }

    if (neighbors.length) {
      container.append("h3").text("Connected people (shared reports)");
      chipList(container, neighbors);
    }

    container.append("h3").text("Reports, oldest first");
    reportList(container, person.reports, new Set([person.id]), { summaryFor: person.id });
  }

  function renderReport(container, report) {
    container.append("h2").text(`Report ${report.id}`);
    container.append("h3").text("People in this report");
    if (report.person_ids.length) {
      chipList(container, report.person_ids.map((id) => ({ id, label: personById.get(id).name })));
    } else {
      container.append("p").attr("class", "meta").text("No people are named in this report.");
    }
    reportList(container, [report.id], new Set());
  }

  /** People connected to `id`, with the number of shared reports. */
  function neighborCounts(id) {
    const result = [];
    for (const l of data.links) {
      if (l.source === id) result.push({ id: l.target, count: l.weight });
      if (l.target === id) result.push({ id: l.source, count: l.weight });
    }
    return result
      .map((r) => ({ ...r, label: personById.get(r.id).name }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  // ---------------------------------------------------------------------
  // Building blocks
  // ---------------------------------------------------------------------

  /** Clickable person chips; clicking one selects that person. */
  function chipList(container, items) {
    const list = container.append("div").attr("class", "chip-list");
    for (const item of items) {
      const chip = list.append("span").attr("class", "chip").text(item.label)
        .on("click", () => App.select({ type: "person", id: item.id }));
      if (item.count !== undefined) chip.append("span").attr("class", "count").text(item.count);
    }
    return list;
  }

  /** A clickable report ID that selects the report. */
  function reportLink(container, reportId) {
    return container.append("a").attr("class", "ref").text(reportId)
      .on("click", () => App.select({ type: "report", id: reportId }));
  }

  // Cards the analyst has expanded (cleared when the selection changes).
  const expanded = new Set();

  /**
   * Report cards in date order, with person names highlighted.
   *
   * With options.summaryFor = a person ID, cards start collapsed: they show
   * a short summary of what that person does in the report, and clicking
   * the card header (or "Show full report") reveals the full text.
   */
  function reportList(container, reportIds, focusIds, options = {}) {
    const collapsible = Boolean(options.summaryFor);
    const reports = App.byDate(reportIds);

    if (collapsible && reports.length > 1) {
      const allOpen = reports.every((r) => expanded.has(r.id));
      container.append("button").attr("type", "button").attr("class", "small link expand-all")
        .text(allOpen ? "Collapse all" : "Expand all")
        .on("click", () => {
          reports.forEach((r) => (allOpen ? expanded.delete(r.id) : expanded.add(r.id)));
          render(true);
        });
    }

    for (const report of reports) {
      const open = !collapsible || expanded.has(report.id);
      const card = container.append("div").attr("class", "report")
        .classed("collapsible", collapsible);
      const header = card.append("div").attr("class", "report-header");
      const title = header.append("strong");
      if (collapsible) {
        title.append("span").attr("class", "chevron").text(open ? "\u25be " : "\u25b8 ");
        header.attr("role", "button").attr("tabindex", 0)
          .attr("aria-expanded", open)
          .attr("title", open ? "Hide the full report" : "Show the full report")
          .on("click", () => toggle(report.id))
          .on("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(report.id); }
          });
      }
      title.append("span").text(report.id);
      header.append("span").text(`${report.date} · ${report.source || "source not given"}`);

      if (collapsible) App.summaries.renderCard(card, report.id, options.summaryFor);

      if (open) {
        const full = card.append("div").attr("class", "full-report");
        if (collapsible) full.append("div").attr("class", "full-label").text("Full report");
        full.append("p").attr("class", "report-text").html(highlightText(report, focusIds));
        if (report.reference_ids.length) {
          const refs = full.append("p").attr("class", "refs").text("Refers to: ");
          report.reference_ids.forEach((refId, i) => {
            if (i > 0) refs.append("span").text(", ");
            reportLink(refs, refId);
          });
        }
      } else {
        card.append("button").attr("type", "button").attr("class", "small link show-full")
          .text("Show full report \u25b8").on("click", () => toggle(report.id));
      }
    }
    // Names in the text are links to that person.
    container.selectAll("mark.person").on("click", function () {
      App.select({ type: "person", id: this.dataset.person });
    });
  }

  function toggle(reportId) {
    if (expanded.has(reportId)) expanded.delete(reportId); else expanded.add(reportId);
    render(true);
  }

  /**
   * Return the report text as HTML with person names wrapped in
   * <mark class="person"> (clickable; the focused people get a stronger
   * highlight) and places wrapped in <mark class="place">.
   */
  function highlightText(report, focusIds) {
    const lookup = new Map();   // lowercase text -> {person: id} or {place: true}
    // Places first, so a person's name wins if the same words are both.
    for (const term of report.place_terms) lookup.set(term.toLowerCase(), { place: true });
    for (const [personId, names] of Object.entries(report.mentions)) {
      for (const name of names) lookup.set(name.toLowerCase(), { person: personId });
    }
    const text = escapeHtml(report.description);
    const keys = [...lookup.keys()].filter((k) => k.length > 1).sort((a, b) => b.length - a.length);
    if (!keys.length) return text;

    const pattern = new RegExp(
      "(^|[^A-Za-z])(" + keys.map((k) => escapeRegExp(escapeHtml(k))).join("|") + ")(?![A-Za-z])", "gi");
    return text.replace(pattern, (match, before, found) => {
      const hit = lookup.get(unescapeHtml(found).toLowerCase());
      if (!hit) return match;
      if (hit.place) return `${before}<mark class="place" title="Place">${found}</mark>`;
      const cls = focusIds.has(hit.person) ? "person focus" : "person";
      return `${before}<mark class="${cls}" data-person="${hit.person}">${found}</mark>`;
    });
  }

  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function unescapeHtml(text) {
    return text.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<").replace(/&amp;/g, "&");
  }

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // ---------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------

  App.events.on("selection.panel", () => {
    scrollByTab[activeTab] = body.node().scrollTop;
    activeTab = "details";
    expanded.clear();
    render();
  });

  App.panel = { render };
})();
