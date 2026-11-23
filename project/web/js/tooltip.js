/**
 * tooltip.js
 * ----------
 * One shared hover tooltip for all views.
 */

const Tooltip = (function () {
  "use strict";

  const box = d3.select("body").append("div").attr("id", "tooltip").style("display", "none");

  function show(event, text) {
    box.style("display", "block").text(text)
      .style("left", event.clientX + 12 + "px")
      .style("top", event.clientY + 12 + "px");
  }

  function hide() {
    box.style("display", "none");
  }

  return { show, hide };
})();
