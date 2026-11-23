"""
step4_build_network.py
----------------------
Step 4 of the data-processing pipeline: build the data for the network view.

Nodes are people (the resolved identities from step3_resolve_persons.py). Two people
are connected when they are named in the same report; the link's weight is
the number of reports they share. "Possible same-person" links from the
review are included separately so the GUI can draw them differently.

The output is written as a JavaScript file (not plain JSON) so that the web
page can be opened directly from disk: browsers block fetch() for local
files, but they allow loading a <script>.

Usage:
    python3 step4_build_network.py <reports_resolved.json> <persons.json> <out.js>
"""

import json
import sys
from collections import Counter, defaultdict
from itertools import combinations

from js_output import write_js


def sort_key(date):
    """Sortable 'YYYY-MM-DD' string; unknown parts become 00."""
    return f"{date['year'] or 0:04d}-{date['month'] or 0:02d}-{date['day'] or 0:02d}"


def build_links(reports):
    """
    Count shared reports for every pair of people.

    Returns a list of {source, target, weight, reports} dicts.
    """
    shared = defaultdict(list)
    for report in reports:
        for id_a, id_b in combinations(sorted(set(report["person_ids"])), 2):
            shared[(id_a, id_b)].append(report["id"])
    return [{"source": a, "target": b, "weight": len(ids), "reports": ids}
            for (a, b), ids in sorted(shared.items())]


def build_possible_links(persons):
    """Collect possible same-person links once per pair."""
    seen, links = set(), []
    for person in persons:
        for link in person["possible_links"]:
            pair = tuple(sorted((person["id"], link["id"])))
            if pair not in seen:
                seen.add(pair)
                links.append({"source": pair[0], "target": pair[1],
                              "evidence": link["evidence"]})
    return links


def build_nodes(persons):
    """One node per person: name, other names and the reports naming them."""
    return [{"id": p["id"], "name": p["name"],
             "aliases": [a for a in p["aliases"] if a["name"] != p["name"]],
             "reports": p["reports"],
             "report_count": len(p["reports"])}
            for p in persons]


def place_names(report):
    """
    Short display names for a report's places: the city if given, otherwise
    the country, without duplicates. Spellings are kept as in the data.
    """
    names = []
    for place in report["places"]:
        parts = [x.strip() for x in place["raw"].split("/")]
        # City slot; for odd 5-part entries the city is third from the end.
        name = place.get("city") or (parts[-3] if len(parts) >= 3 else "") or parts[-1]
        if name and name not in names:
            names.append(name)
    return names


def build_report_records(reports, persons):
    """Report fields the detail panel needs, sorted by report date."""
    # Every raw name that refers to each identity, for highlighting in text.
    # Longest first so that 'Ronald Derwish' is matched before 'Ronald';
    # ties are sorted alphabetically so the output is the same on every run.
    names_by_id = {p["id"]: sorted({a["name"].split(",")[0] for a in p["aliases"]},
                                   key=lambda name: (-len(name), name))
                   for p in persons}
    records = []
    for r in reports:
        records.append({
            "id": r["id"], "source": r["source"],
            "date": r["report_date"]["raw"], "date_key": sort_key(r["report_date"]),
            "description": r["description"],
            "reference_ids": r["reference_ids"],
            "person_ids": r["person_ids"],
            "places": place_names(r),
            "mentions": {pid: names_by_id[pid] for pid in r["person_ids"]},
        })
    return sorted(records, key=lambda rec: (rec["date_key"], rec["id"]))


def main(reports_path, persons_path, out_path):
    with open(reports_path, encoding="utf-8") as handle:
        reports = json.load(handle)
    with open(persons_path, encoding="utf-8") as handle:
        persons = json.load(handle)

    links = build_links(reports)
    data = {
        "nodes": build_nodes(persons),
        "links": links,
        "possible_links": build_possible_links(persons),
        "reports": build_report_records(reports, persons),
    }
    write_js(out_path, "NETWORK_DATA", data, "step4_build_network.py")

    connected = {pid for link in links for pid in (link["source"], link["target"])}
    isolated = sum(1 for n in data["nodes"] if n["id"] not in connected)
    print(f"{len(data['nodes'])} people ({isolated} with no connections), "
          f"{len(links)} connections, {len(data['possible_links'])} possible "
          f"same-person links, {len(data['reports'])} reports")
    weights = Counter(link["weight"] for link in links)
    print("Connections by number of shared reports:", dict(sorted(weights.items())))


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit("Usage: python3 step4_build_network.py <reports_resolved.json> "
                 "<persons.json> <out.js>")
    main(*sys.argv[1:])
