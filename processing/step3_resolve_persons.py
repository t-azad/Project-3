"""
step3_resolve_persons.py
------------------------
Step 3 of the data-processing pipeline: entity resolution for persons.

Applies the reviewed decisions in person_review.json to the parsed reports:

  * One person, many names: names in the same review group are merged into a
    single identity (e.g. 'Satam Derwish', 'Ronald', 'R. Derwish').
  * Two people, one name: a 'split' turns one name into several identities.
    The name maps to a default identity, and 'report_overrides' say which
    identities a specific report refers to (e.g. FBI_18 mentions both men
    named Abdul al Nami).
  * Possible links (not merged) are attached to the identities so the GUI can
    show them as suggestions for the analyst to accept or ignore.

Before writing anything, the script checks the review file for mistakes
(misspelled names, a name in two groups) and reports every candidate pair from
step2_person_candidates.py that was not explicitly decided, so nothing is skipped
silently.

Usage:
    python3 step3_resolve_persons.py <reports_raw.json> <person_review.json> <out_dir>

Outputs (in out_dir):
    persons.json            one record per identity, with aliases and evidence
    reports_resolved.json   the reports with a 'person_ids' list added
"""

import json
import os
import re
import sys
from collections import defaultdict

from step2_person_candidates import find_candidates


def make_id(name):
    """Stable, readable identity ID, e.g. 'p_abdul_al_nami_562_fenkell_ave'."""
    return "p_" + re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def build_identities(review, all_names):
    """
    Create identity records and a name -> default identity ID lookup.

    Returns (identities, name_to_id) where identities maps ID -> record.
    Raises ValueError for review entries that do not match the data.
    """
    identities, name_to_id = {}, {}

    def add_identity(display_name):
        identity_id = make_id(display_name)
        identities[identity_id] = {"id": identity_id, "name": display_name,
                                   "aliases": [], "reports": [],
                                   "possible_links": []}
        return identity_id

    def assign(name, identity_id, member):
        if name not in all_names:
            raise ValueError(f"Review names {name!r}, which is not in the data")
        if name in name_to_id:
            raise ValueError(f"{name!r} is assigned to two identities")
        name_to_id[name] = identity_id
        identities[identity_id]["aliases"].append(
            {"name": name, "status": member.get("status", "primary"),
             "source": member.get("source"), "evidence": member.get("evidence")})

    # Merged groups: one identity, many names.
    for group in review["groups"]:
        identity_id = add_identity(group["name"])
        for member in group["members"]:
            assign(member["name"], identity_id, member)

    # Splits: one name, several identities.
    for split in review["splits"]:
        for entry in split["identities"]:
            identity_id = add_identity(entry["name"])
            if entry["default"]:
                assign(split["name"], identity_id, {"status": "primary"})
            else:
                # Record the shared name for display only; lookups by this
                # name go to the default identity unless a report overrides.
                identities[identity_id]["aliases"].append(
                    {"name": split["name"], "status": "primary",
                     "source": None, "evidence": split["_note"]})
            for member in entry["extra_members"]:
                assign(member["name"], identity_id, member)

    # Every remaining name is its own identity.
    for name in sorted(all_names - set(name_to_id)):
        assign(name, add_identity(name), {"status": "primary"})

    return identities, name_to_id


def resolve_report(report, name_to_id, overrides_by_report, identity_ids_by_name):
    """Return the identity IDs a report refers to, without duplicates."""
    overrides = overrides_by_report.get(report["id"], {})
    person_ids = []
    for name in report["persons"]:
        if name in overrides:
            ids = [identity_ids_by_name[n] for n in overrides[name]]
        else:
            ids = [name_to_id[name]]
        person_ids.extend(i for i in ids if i not in person_ids)
    return person_ids


def lookup_identity(name, name_to_id, identities):
    """Find an identity by one of its raw names or by its display name."""
    if name in name_to_id:
        return name_to_id[name]
    for identity in identities.values():
        if identity["name"] == name:
            return identity["id"]
    raise ValueError(f"Unknown name in review: {name!r}")


def check_coverage(candidates, name_to_id, identities, review):
    """
    List candidate pairs that were neither merged nor explicitly decided.
    These are treated as different people by default.

    Pairs are compared by identity, so a decision about 'Abdillah Zinedine'
    also covers a candidate pair that uses his alias 'Abu Hafs'.
    """
    def identity_pair(name_a, name_b):
        return frozenset((lookup_identity(name_a, name_to_id, identities),
                          lookup_identity(name_b, name_to_id, identities)))

    decided = {identity_pair(d["a"], d["b"])
               for d in review["possible"] + review["rejected_notes"]}
    undecided = []
    for name_a, name_b, rule in candidates:
        pair = identity_pair(name_a, name_b)
        if len(pair) > 1 and pair not in decided:
            undecided.append((name_a, name_b, rule))
    return undecided


def main(reports_path, review_path, out_dir):
    with open(reports_path, encoding="utf-8") as handle:
        reports = json.load(handle)
    with open(review_path, encoding="utf-8") as handle:
        review = json.load(handle)

    all_names = {name for r in reports for name in r["persons"]}
    identities, name_to_id = build_identities(review, all_names)

    # Report-level overrides for split names, keyed by report ID then name.
    identity_ids_by_name = {i["name"]: i["id"] for i in identities.values()}
    overrides_by_report = defaultdict(dict)
    for split in review["splits"]:
        for report_id, names in split["report_overrides"].items():
            overrides_by_report[report_id][split["name"]] = names

    # Attach resolved identity IDs to every report, and reports to identities.
    for report in reports:
        report["person_ids"] = resolve_report(
            report, name_to_id, overrides_by_report, identity_ids_by_name)
        for identity_id in report["person_ids"]:
            identities[identity_id]["reports"].append(report["id"])

    # Possible (unmerged) links are stored on both identities.
    for link in review["possible"]:
        id_a = lookup_identity(link["a"], name_to_id, identities)
        id_b = lookup_identity(link["b"], name_to_id, identities)
        for this_id, other_id in ((id_a, id_b), (id_b, id_a)):
            identities[this_id]["possible_links"].append(
                {"id": other_id, "source": link["source"],
                 "evidence": link["evidence"]})

    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "persons.json"), "w", encoding="utf-8") as out:
        json.dump(sorted(identities.values(), key=lambda i: i["name"]),
                  out, indent=2, ensure_ascii=False)
    with open(os.path.join(out_dir, "reports_resolved.json"), "w",
              encoding="utf-8") as out:
        json.dump(reports, out, indent=2, ensure_ascii=False)

    # Summary for the developer.
    _, candidates = find_candidates(reports)
    merged = [i for i in identities.values() if len(i["aliases"]) > 1]
    print(f"{len(all_names)} raw names -> {len(identities)} identities")
    print(f"{len(merged)} identities merge several names; "
          f"{sum(len(s['identities']) for s in review['splits'])} identities "
          f"come from split names; {len(review['possible'])} possible links kept")
    undecided = check_coverage(candidates, name_to_id, identities, review)
    print(f"{len(candidates)} candidate pairs; {len(undecided)} treated as "
          f"different people by default (no specific evidence):")
    for name_a, name_b, rule in undecided:
        print(f"   {rule:22} {name_a} ~ {name_b}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit("Usage: python3 step3_resolve_persons.py <reports_raw.json> "
                 "<person_review.json> <out_dir>")
    main(*sys.argv[1:])
