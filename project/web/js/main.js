/**
 * main.js
 * -------
 * Wires the header controls (search, Undo, Reset) to the shared
 * App state and starts the views. Loaded last, after all view modules.
 */

(function () {
  "use strict";

  const { data, state } = App;

  // ---------------------------------------------------------------------
  // Search: suggestions for every name and alias (recognition, not recall)
  // ---------------------------------------------------------------------

  function setUpSearch() {
    const options = [];
    for (const person of data.nodes) {
      options.push({ label: person.name, id: person.id });
      for (const alias of person.aliases) options.push({ label: alias.name, id: person.id });
    }
    const lookup = new Map(options.map((o) => [o.label.toLowerCase(), o.id]));

    d3.select("#person-names").selectAll("option")
      .data(options.sort((a, b) => a.label.localeCompare(b.label)))
      .join("option").attr("value", (o) => o.label);

    const search = d3.select("#search");
    const runSearch = () => {
      const query = search.property("value").trim().toLowerCase();
      if (!query) return;
      // Exact name first, then the first name containing the query.
      let id = lookup.get(query);
      if (!id) {
        const partial = options.find((o) => o.label.toLowerCase().includes(query));
        id = partial && partial.id;
      }
      if (id) {
        App.select({ type: "person", id });
        App.network.centerOn(id);
      } else {
        d3.select("#search-message")
          .text(`No person matches "${search.property("value")}". Try part of a name.`);
      }
    };
    search.on("change", runSearch);
    search.on("keydown", (event) => { if (event.key === "Enter") runSearch(); });
  }

  // ---------------------------------------------------------------------
  // Undo and Reset
  // ---------------------------------------------------------------------

  /**
   * Back to the starting view: no selection and the whole network in view.
   * Clearing the selection is one undoable step.
   */
  function resetView() {
    App.clearSelection();
    App.network.resetZoom();
  }

  /**
   * Ctrl+Z / Cmd+Z undoes, except while typing in a text field (there it
   * keeps its normal meaning).
   */
  function isTyping(event) {
    return event.target.matches("input[type=search], input[type=text], textarea, [contenteditable]");
  }

  function setUpControls() {
    d3.select("#reset").on("click", resetView);
    d3.select("#undo").on("click", App.undo);
    d3.select(window).on("keydown.main", (event) => {
      if (event.key === "Escape") resetView();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" &&
          !event.shiftKey && !isTyping(event)) {
        event.preventDefault();
        App.undo();
      }
    });

    // A new selection clears any old "no person matches" message.
    App.events.on("selection.main", () => d3.select("#search-message").text(""));

    // The Undo button is only active when there is something to undo.
    App.events.on("history.main", () => {
      d3.select("#undo").property("disabled", !App.canUndo())
        .attr("title", App.canUndo() ? "Undo the last selection change (Ctrl+Z)" : "Nothing to undo yet");
    });
  }

  // ---------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------

  setUpSearch();
  setUpControls();
  App.network.render();
  App.panel.render();
  // Center the network once the layout has had a moment to settle.
  setTimeout(App.network.resetZoom, 50);
})();
