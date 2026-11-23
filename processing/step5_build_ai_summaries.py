"""
step5_build_ai_summaries.py
---------------------------
Step 5 of the data-processing pipeline: copy the AI-written person summaries
into the web page's data folder.

The summaries in data/manual/ai_summaries/*.json were written in advance by an AI
assistant (Claude, Anthropic) from the report text: one line per person and
report, plus an overall summary for every person named in two or more
reports. This script merges the files, checks them against the resolved data
(unknown people or reports, missing lines), and writes them as JavaScript so
the page works when opened from disk.

Usage:
    python3 step5_build_ai_summaries.py <persons.json> <ai_summaries_folder> <out.js>
"""

import json
import os
import sys

from js_output import write_js


def load_ai_summaries(folder):
    """Merge every *.json file in the folder into one dict."""
    merged = {"about": "", "persons": {}}
    for name in sorted(os.listdir(folder)):
        if not name.endswith(".json"):
            continue
        with open(os.path.join(folder, name), encoding="utf-8") as handle:
            part = json.load(handle)
        merged["about"] = merged["about"] or part.get("_about", "")
        merged["persons"].update(part["persons"])
    return merged


def check(ai, persons):
    """Print coverage and warn about summaries that do not match the data."""
    by_id = {p["id"]: p for p in persons}
    unknown = []
    for person_id, entry in ai["persons"].items():
        if person_id not in by_id:
            unknown.append(person_id)
            continue
        unknown += [f"{person_id}/{r}" for r in entry.get("reports", {})
                    if r not in by_id[person_id]["reports"]]
    missing = [f"{p['id']}/{r}" for p in persons for r in p["reports"]
               if r not in ai["persons"].get(p["id"], {}).get("reports", {})]
    no_overall = [p["id"] for p in persons
                  if len(p["reports"]) > 1 and not ai["persons"].get(p["id"], {}).get("overall")]

    print(f"{len(ai['persons'])} people, "
          f"{sum(len(e.get('reports', {})) for e in ai['persons'].values())} report lines, "
          f"{sum(1 for e in ai['persons'].values() if e.get('overall'))} overall summaries")
    for label, items in (("Unknown people/reports", unknown),
                         ("Person-report pairs without a line", missing),
                         ("People in 2+ reports without an overall summary", no_overall)):
        if items:
            print(f"   WARNING: {label}: {items}")


def main(persons_path, folder, out_path):
    with open(persons_path, encoding="utf-8") as handle:
        persons = json.load(handle)
    ai = load_ai_summaries(folder)
    check(ai, persons)
    write_js(out_path, "AI_SUMMARY_DATA", ai, "step5_build_ai_summaries.py")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit("Usage: python3 step5_build_ai_summaries.py <persons.json> <ai_summaries_folder> <out.js>")
    main(*sys.argv[1:])
