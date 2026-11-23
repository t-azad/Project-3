/**
 * summaries.js
 * ------------
 * Person summaries in the Details panel.
 *
 * The summaries were written in advance by an AI assistant (Claude) from the
 * report text and are stored in data/manual/ai_summaries/ (copied to the page by
 * processing/step5_build_ai_summaries.py). They are fixed text, not computed by
 * the tool, and are labeled as AI-written so the analyst knows to check them
 * against the reports.
 *
 * Exposes App.summaries with:
 *   renderOverall(container, personId)          overall summary of a person
 *   renderCard(container, reportId, personId)   what the person does in one report
 */

(function () {
  "use strict";

  const ai = AI_SUMMARY_DATA;   // from data/ai_summaries.js
  const AI_NOTE = "Written in advance by an AI assistant (Claude) from the report text. " +
    "Not computed by the tool; may contain errors or over-interpretation. Check the reports.";

  /** Overall summary block at the top of a person's Details view. */
  function renderOverall(container, personId) {
    container.append("h3").text("Summary");
    const box = container.append("div").attr("class", "summary-box ai");
    box.append("div").attr("class", "source-label").attr("title", AI_NOTE)
      .text("AI-written in advance (may contain errors)");

    // People in a single report have no separate overall summary: use that report's line.
    const entry = ai.persons[personId] || {};
    const reportLines = Object.values(entry.reports || {});
    const text = entry.overall || (reportLines.length === 1 ? reportLines[0] : "");
    box.append("p").text(text || "No summary for this person.");
  }

  /** One-line summary shown on a collapsed report card. */
  function renderCard(container, reportId, personId) {
    const line = ((ai.persons[personId] || {}).reports || {})[reportId];
    container.append("div").attr("class", "card-summary")
      .attr("title", AI_NOTE)
      .append("p").text(line || "No summary for this report.");
  }

  App.summaries = { renderOverall, renderCard };
})();
