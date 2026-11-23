/**
 * app.js
 * ------
 * Shared state for the Report Explorer.
 *
 * Every part of the page (network, panel tabs, header controls)
 * reads the same state and reacts to the same events. That is what keeps
 * them linked: selecting a person anywhere highlights them everywhere.
 *
 * Events (d3.dispatch):
 *   "selection"   the selected person or report changed
 *   "history"     the undo history changed (an undoable step was added or undone)
 */

const App = (function () {
  "use strict";

  const data = NETWORK_DATA;          // from data/network.js
  const personById = new Map(data.nodes.map((n) => [n.id, n]));
  const reportById = new Map(data.reports.map((r) => [r.id, r]));

  const state = {
    selection: null,      // {type: "person"|"report", id} or null
  };

  const events = d3.dispatch("selection", "history");

  // ---------------------------------------------------------------------
  // Selection and undo
  //
  // Every change to the selection goes through select(), which first saves
  // the previous selection. undo() restores it. Moving around the interface
  // (tabs, zoom, expanding cards) is not undoable.
  // ---------------------------------------------------------------------

  const MAX_UNDO = 50;
  const undoStack = [];   // earlier selections, newest last

  function sameSelection(a, b) {
    return a === b || Boolean(a && b && a.type === b.type && a.id === b.id);
  }

  /** Change the selection (null = nothing selected). Re-selecting is ignored. */
  function select(selection) {
    if (sameSelection(state.selection, selection)) return;
    undoStack.push(state.selection);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    state.selection = selection;
    events.call("selection");
    events.call("history");
  }

  function clearSelection() {
    select(null);
  }

  /** Go back to the selection before the last change. */
  function undo() {
    if (!undoStack.length) return;
    state.selection = undoStack.pop();
    events.call("selection");
    events.call("history");
  }

  const canUndo = () => undoStack.length > 0;

  // ---------------------------------------------------------------------
  // What the current selection refers to
  // ---------------------------------------------------------------------

  /**
   * IDs of people related to the current selection, or null: for a person,
   * themselves and everyone named in their reports; for a report, the people
   * it names.
   */
  function focusedPeople() {
    const sel = state.selection;
    if (!sel) return null;
    if (sel.type === "report") return new Set(reportById.get(sel.id).person_ids);
    const ids = new Set([sel.id]);
    for (const reportId of personById.get(sel.id).reports) {
      reportById.get(reportId).person_ids.forEach((id) => ids.add(id));
    }
    return ids;
  }

  /** IDs of reports related to the current selection, or null. */
  function focusedReports() {
    const sel = state.selection;
    if (!sel) return null;
    if (sel.type === "person") return new Set(personById.get(sel.id).reports);
    return new Set([sel.id]);
  }

  // ---------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------

  /** "1 report" / "3 reports". */
  function plural(count, word, pluralWord = word + "s") {
    return `${count} ${count === 1 ? word : pluralWord}`;
  }

  /** Reports in date order (oldest first). */
  function byDate(reportIds) {
    return [...reportIds].map((id) => reportById.get(id))
      .sort((a, b) => a.date_key.localeCompare(b.date_key) || a.id.localeCompare(b.id));
  }

  return {
    data, personById, reportById, state, events,
    select, clearSelection, undo, canUndo,
    focusedPeople, focusedReports,
    plural, byDate,
  };
})();
