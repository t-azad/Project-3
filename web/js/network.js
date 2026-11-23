/**
 * network.js
 * ----------
 * People-and-reports network (a bipartite graph).
 *
 * People and reports are both nodes: a person icon (size = number of
 * reports) and a document icon per report. A line runs from a person to
 * each report that names them. Two people are therefore never linked
 * directly; they are linked through the report that names them both, which
 * shows WHICH report connects them and avoids the false "everyone knows
 * everyone" cliques that a report naming many people would otherwise create.
 *
 * Dashed lines join names that may belong to the same person (from the
 * person review). Reacts to App "selection" events (highlighting) and
 * Exposes App.network.render / centerOn / resetZoom.
 */

(function () {
  "use strict";

  const { data, state } = App;

  /** People named in at least this many reports always show their label. */
  const ALWAYS_LABELED = 4;
  const REPORT_SIZE = 15;   // height of a report icon

  // ---------------------------------------------------------------------
  // SVG setup: zoomable container with line and node layers
  // ---------------------------------------------------------------------

  const svg = d3.select("#network");
  const zoomLayer = svg.append("g");
  const linkLayer = zoomLayer.append("g");
  const possibleLayer = zoomLayer.append("g");
  const nodeLayer = zoomLayer.append("g");

  const zoom = d3.zoom()
    .scaleExtent([0.2, 5])
    .on("zoom", (event) => zoomLayer.attr("transform", event.transform));
  // Zoom only with the mouse wheel. D3's default double-click zoom is turned
  // off: clicking a node twice quickly (select, then deselect) would
  // otherwise count as a double-click and zoom in unexpectedly.
  svg.call(zoom).on("dblclick.zoom", null);

  // Clicking empty space clears the selection.
  svg.on("click", (event) => {
    if (event.target === svg.node()) App.select(null);
  });

  const radius = (person) => 4 + 3 * Math.sqrt(person.report_count);

  // D3 mutates nodes during layout, so it works on copies of the data.
  const personNodes = data.nodes.map((n) => ({ ...n, kind: "person" }));
  const personNodeById = new Map(personNodes.map((n) => [n.id, n]));
  const reportNodes = data.reports.map((r) => ({ id: "r:" + r.id, kind: "report", report: r }));
  const reportNodeById = new Map(reportNodes.map((n) => [n.report.id, n]));
  const possibleLinks = data.possible_links.map((l) => ({ ...l }));

  // One line from each report to each person it names. These never change.
  const reportLinks = reportNodes.flatMap((node) => node.report.person_ids.map((personId) =>
    ({ source: personId, target: node.id, personId, reportId: node.report.id })));

  const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id((d) => d.id).distance(45))
    .force("charge", d3.forceManyBody().strength(-80))
    .force("collide", d3.forceCollide().radius((d) => (d.kind === "report" ? 11 : radius(d) + 3)))
    .force("x", d3.forceX().strength(0.05))
    .force("y", d3.forceY().strength(0.05))
    .on("tick", onTick);

  let visibleIds = new Set();  // node IDs drawn by the last render()
  let nodeSel = nodeLayer.selectAll("g.node");
  let linkSel = linkLayer.selectAll("line.link");
  let possibleSel = possibleLayer.selectAll("line.possible");

  // ---------------------------------------------------------------------
  // Icons
  // ---------------------------------------------------------------------

  /** Person icon (head and shoulders) scaled to the node's radius. */
  function drawPerson(g, r) {
    g.append("circle").attr("class", "hit").attr("r", r);
    const icon = g.append("g").attr("class", "icon");
    icon.append("circle").attr("cy", -0.42 * r).attr("r", 0.38 * r);
    icon.append("path").attr("d",
      `M${-0.82 * r},${0.9 * r} Q${-0.82 * r},${0.02 * r} 0,${0.02 * r} ` +
      `Q${0.82 * r},${0.02 * r} ${0.82 * r},${0.9 * r} Z`);
  }

  /** Report icon: a page with a folded corner and three text lines. */
  function drawReport(g) {
    const h = REPORT_SIZE, w = 0.78 * h, fold = 0.3 * w;
    g.append("rect").attr("class", "hit").attr("x", -w / 2 - 3).attr("y", -h / 2 - 3)
      .attr("width", w + 6).attr("height", h + 6);
    const icon = g.append("g").attr("class", "icon");
    icon.append("path").attr("d",
      `M${-w / 2},${-h / 2} H${w / 2 - fold} L${w / 2},${-h / 2 + fold} V${h / 2} H${-w / 2} Z`);
    icon.append("path").attr("class", "fold")
      .attr("d", `M${w / 2 - fold},${-h / 2} V${-h / 2 + fold} H${w / 2}`);
    icon.append("path").attr("class", "lines")
      .attr("d", `M${-w / 4},${-h / 8} H${w / 4} M${-w / 4},${h / 8} H${w / 4} M${-w / 4},${3 * h / 8} H${w / 8}`);
  }

  // ---------------------------------------------------------------------
  // Filtering: which nodes and lines are visible
  // ---------------------------------------------------------------------

  /** D3 replaces link endpoints with node objects; this reads either form. */
  function idOf(end) {
    return typeof end === "object" ? end.id : end;
  }

  function isSelected(type, id) {
    return Boolean(state.selection && state.selection.type === type && state.selection.id === id);
  }

  /**
   * Everything to draw: every person, every report that names someone, a
   * line from each report to each person it names, and the possible
   * same-person links. A report that names no one has no lines, so it is
   * only drawn while it is selected (for example, opened from a "Refers to" link).
   */
  function visibleElements() {
    const reports = reportNodes.filter((n) =>
      n.report.person_ids.length > 0 || isSelected("report", n.report.id));
    return { nodes: personNodes.concat(reports), links: reportLinks, possible: possibleLinks };
  }

  // ---------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------

  /** Draw the network (again when a hidden node must be shown). */
  function render() {
    const { nodes, links, possible } = visibleElements();
    visibleIds = new Set(nodes.map((n) => n.id));
    placeNewReports(nodes, links);

    linkSel = linkLayer.selectAll("line.link")
      .data(links, (l) => l.personId + "|" + l.reportId)
      .join("line")
      .attr("class", "link")
      .on("click", (event, l) => {
        event.stopPropagation();
        App.select({ type: "report", id: l.reportId });
      })
      .on("mousemove", (event, l) => Tooltip.show(event,
        `${App.personById.get(l.personId).name} is named in ${l.reportId}`))
      .on("mouseleave", Tooltip.hide);

    possibleSel = possibleLayer.selectAll("line.possible")
      .data(possible, (l) => idOf(l.source) + "|" + idOf(l.target))
      .join("line")
      .attr("class", "possible")
      .on("mousemove", (event, l) => Tooltip.show(event, "Possibly the same person: " + l.evidence))
      .on("mouseleave", Tooltip.hide);

    nodeSel = nodeLayer.selectAll("g.node")
      .data(nodes, (n) => n.id)
      .join((enter) => {
        const g = enter.append("g").attr("class", (n) => "node " + n.kind);
        g.filter((n) => n.kind === "person").each(function (n) { drawPerson(d3.select(this), radius(n)); });
        g.filter((n) => n.kind === "report").each(function () { drawReport(d3.select(this)); });
        g.append("text").attr("text-anchor", "middle")
          .attr("dy", (n) => (n.kind === "report" ? REPORT_SIZE / 2 + 12 : -radius(n) - 3))
          .text((n) => (n.kind === "report" ? n.report.id : n.name));
        return g;
      })
      .on("click", (event, n) => {
        event.stopPropagation();
        // Clicking the selected node again deselects it (a toggle).
        const target = n.kind === "report" ? { type: "report", id: n.report.id } : { type: "person", id: n.id };
        App.select(isSelected(target.type, target.id) ? null : target);
      })
      .on("mousemove", (event, n) => Tooltip.show(event, n.kind === "report"
        ? `${n.report.id} · ${n.report.date} · names ${App.plural(n.report.person_ids.length, "person", "people")}`
        : `${n.name}: ${App.plural(n.report_count, "report")}`))
      .on("mouseleave", Tooltip.hide)
      .call(dragBehavior());

    // Person-report lines and possible links pull nodes together.
    simulation.nodes(nodes);
    simulation.force("link").links(links.concat(possible.map((l) => ({ ...l }))));
    simulation.alpha(0.6).restart();

    updateHighlight();
    updateStatus(nodes);
  }

  /** Start a newly shown report next to the people it names, not at random. */
  function placeNewReports(nodes, links) {
    const peopleOf = d3.group(links, (l) => l.reportId);
    for (const node of nodes) {
      if (node.kind !== "report" || node.x !== undefined) continue;
      const people = (peopleOf.get(node.report.id) || [])
        .map((l) => personNodeById.get(l.personId)).filter((p) => p.x !== undefined);
      if (people.length) {
        node.x = d3.mean(people, (p) => p.x) + (Math.random() - 0.5) * 20;
        node.y = d3.mean(people, (p) => p.y) + (Math.random() - 0.5) * 20;
      }
    }
  }

  function updateStatus(nodes) {
    const people = nodes.filter((n) => n.kind === "person").length;
    const reports = nodes.length - people;
    const unnamed = reportNodes.length - reports;   // reports that name no one
    d3.select("#status").text(`Showing ${people} people and ${App.plural(reports, "report")}` +
      (unnamed ? ` (${unnamed} reports that name no one are not drawn)` : "") +
      ". Scroll to zoom, drag to pan.");
  }

  function onTick() {
    linkSel
      .attr("x1", (l) => l.source.x).attr("y1", (l) => l.source.y)
      .attr("x2", (l) => l.target.x).attr("y2", (l) => l.target.y);
    possibleSel
      .attr("x1", (l) => personNodeById.get(idOf(l.source)).x)
      .attr("y1", (l) => personNodeById.get(idOf(l.source)).y)
      .attr("x2", (l) => personNodeById.get(idOf(l.target)).x)
      .attr("y2", (l) => personNodeById.get(idOf(l.target)).y);
    nodeSel.attr("transform", (n) => `translate(${n.x},${n.y})`);
  }

  /** Let the analyst drag nodes to untangle the layout. */
  function dragBehavior() {
    return d3.drag()
      .on("start", (event, n) => {
        if (!event.active) simulation.alphaTarget(0.2).restart();
        n.fx = n.x; n.fy = n.y;
      })
      .on("drag", (event, n) => { n.fx = event.x; n.fy = event.y; })
      .on("end", (event, n) => {
        if (!event.active) simulation.alphaTarget(0);
        n.fx = null; n.fy = null;
      });
  }

  // ---------------------------------------------------------------------
  // Highlighting for the current selection
  // ---------------------------------------------------------------------

  /**
   * Selecting a person highlights their reports and everyone named in them;
   * selecting a report highlights the people it names. Everything else fades.
   */
  function updateHighlight() {
    const people = App.focusedPeople();
    const reports = App.focusedReports();
    const sel = state.selection;
    const inFocus = (n) => (n.kind === "report" ? reports.has(n.report.id) : people.has(n.id));

    nodeSel
      .classed("faded", (n) => people !== null && !inFocus(n))
      .classed("selected", (n) => (n.kind === "report"
        ? isSelected("report", n.report.id) : isSelected("person", n.id)))
      .classed("related", (n) => n.kind === "report" && sel && sel.type === "person" && inFocus(n))
      // Report IDs are shown for the reports related to the selection.
      .classed("label-hidden", (n) => (n.kind === "report"
        ? !(reports && reports.has(n.report.id))
        : n.report_count < ALWAYS_LABELED && !(people && people.has(n.id))));

    const touchesSelection = (l) => Boolean(sel) &&
      ((sel.type === "person" && l.personId === sel.id) || (sel.type === "report" && l.reportId === sel.id));
    linkSel
      .classed("highlighted", touchesSelection)
      .classed("faded", (l) => people !== null && !touchesSelection(l) &&
        !(people.has(l.personId) && reports.has(l.reportId)));

    possibleSel.classed("faded", (l) =>
      people !== null && !(people.has(idOf(l.source)) && people.has(idOf(l.target))));
  }

  // ---------------------------------------------------------------------
  // Zoom helpers used by the search box and Reset button
  // ---------------------------------------------------------------------

  /** Pan and zoom so the given person is in the middle of the view. */
  function centerOn(id) {
    const node = personNodeById.get(id);
    if (!node || node.x === undefined) return;
    const { width, height } = svg.node().getBoundingClientRect();
    svg.transition().duration(600).call(zoom.transform,
      d3.zoomIdentity.translate(width / 2, height / 2).scale(1.6).translate(-node.x, -node.y));
  }

  function resetZoom() {
    const { width, height } = svg.node().getBoundingClientRect();
    svg.transition().duration(600).call(zoom.transform,
      d3.zoomIdentity.translate(width / 2, height / 2).scale(0.85));
  }

  // ---------------------------------------------------------------------
  // React to shared events
  // ---------------------------------------------------------------------

  App.events.on("selection.network", () => {
    // A selected node must be visible, even a report that names no one
    // (normally not drawn, but it can be opened from a "Refers to" link).
    // Only redraw in that case, so the layout does not
    // move on every click.
    const sel = state.selection;
    const hidden = sel && !visibleIds.has(sel.type === "report" ? reportNodeById.get(sel.id).id : sel.id);
    if (hidden) render();
    else updateHighlight();
  });

  App.network = { render, centerOn, resetZoom };
})();
