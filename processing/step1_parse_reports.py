"""
step1_parse_reports.py
----------------------
Step 1 of the data-processing pipeline.

Reads the raw intelligence-report text file and converts it into structured
JSON (one object per report). This step parses the file faithfully: it does
NOT merge aliases or fix spellings. Cleaning is handled in a later step so
that each transformation can be explained and checked on its own.

Input format (one block per report, blocks separated by a blank line):

    REPORT
    ID: FBI_1
    REPORTDATE: 4/28/2003
    REFERENCEID: CIA_7
    REPORTSOURCE: ...
    REPORTDESCRIPTION: ...
    PERSONS: name;name;...
    DATES: m/d/yyyy;...          (parts may be blank, e.g. " / /1999")
    PLACES: address/city/state/country;...
    ORGANIZATIONS: name;name;...

Usage:
    python3 step1_parse_reports.py <input.txt> <output.json>
"""

import json
import re
import sys
from collections import Counter

# Field names exactly as they appear in the raw file, mapped to JSON keys.
FIELD_MAP = {
    "ID": "id",
    "REPORTDATE": "report_date",
    "REFERENCEID": "reference_ids",
    "REPORTSOURCE": "source",
    "REPORTDESCRIPTION": "description",
    "PERSONS": "persons",
    "DATES": "dates",
    "PLACES": "places",
    "ORGANIZATIONS": "organizations",
}

# Matches a "KEY: value" line where KEY is one of the known field names.
FIELD_LINE = re.compile(r"^(" + "|".join(FIELD_MAP) + r"):\s?(.*)$")


def split_list(value):
    """Split a ';'-separated field into a list, dropping blanks and whitespace."""
    return [item.strip() for item in value.split(";") if item.strip()]


def parse_date(raw):
    """
    Parse a date string such as '4/2/2003', '4/ /2003' or ' / /1999'.

    Returns a dict with the original text, the numeric parts that are present
    (None when blank) and a 'precision' label: 'day', 'month', 'year' or
    'unknown'. Keeping the precision lets the GUI show vague dates
    differently from exact ones.
    """
    parts = [p.strip() for p in raw.split("/")]
    month, day, year = (parts + [None, None, None])[:3]

    def to_int(text):
        return int(text) if text and text.isdigit() else None

    month, day, year = to_int(month), to_int(day), to_int(year)

    if year and month and day:
        precision = "day"
    elif year and month:
        precision = "month"
    elif year:
        precision = "year"
    else:
        precision = "unknown"

    return {"raw": raw.strip(), "year": year, "month": month, "day": day,
            "precision": precision}


def parse_place(raw):
    """
    Split a place string 'address/city/state/country' into its parts.

    The raw file is inconsistent (some entries have 3 or 5 parts, or parts
    in the wrong slot), so the original text and the part count are kept.
    Normalization happens in the cleaning step.
    """
    parts = [p.strip() for p in raw.split("/")]
    place = {"raw": raw.strip(), "n_parts": len(parts)}
    if len(parts) == 4:
        place.update(address=parts[0] or None, city=parts[1] or None,
                     state=parts[2] or None, country=parts[3] or None)
    return place


def parse_block(lines):
    """Turn the lines of one REPORT block into a report dict."""
    report = {key: "" for key in FIELD_MAP.values()}
    for line in lines:
        match = FIELD_LINE.match(line)
        if match:
            report[FIELD_MAP[match.group(1)]] = match.group(2).strip()

    # Convert list-valued fields from strings into lists / structured objects.
    report["reference_ids"] = split_list(report["reference_ids"])
    report["persons"] = split_list(report["persons"])
    report["organizations"] = split_list(report["organizations"])
    report["dates"] = [parse_date(d) for d in split_list(report["dates"])]
    report["places"] = [parse_place(p) for p in split_list(report["places"])]
    report["report_date"] = parse_date(report["report_date"])
    report["agency"] = report["id"].split("_")[0]   # e.g. 'FBI' from 'FBI_12'
    return report


def parse_file(path):
    """Read the raw file and return a list of report dicts."""
    with open(path, encoding="utf-8") as handle:
        lines = handle.read().splitlines()

    reports, current = [], None
    for line in lines:
        if line.strip() == "REPORT":          # start of a new report block
            if current:
                reports.append(parse_block(current))
            current = []
        elif current is not None and line.strip():
            current.append(line)
    if current:
        reports.append(parse_block(current))
    return reports


def print_summary(reports):
    """Print counts and data-quality warnings so problems are visible early."""
    print(f"Parsed {len(reports)} reports")
    print("By agency:", dict(Counter(r["agency"] for r in reports)))

    ids = [r["id"] for r in reports]
    duplicates = [i for i, n in Counter(ids).items() if n > 1]
    unknown_refs = sorted({ref for r in reports for ref in r["reference_ids"]
                           if ref not in ids})
    odd_places = [(r["id"], p["raw"]) for r in reports for p in r["places"]
                  if p["n_parts"] != 4]
    vague_dates = sum(d["precision"] != "day" for r in reports for d in r["dates"])

    print("Duplicate IDs:", duplicates or "none")
    print("References to missing reports:", unknown_refs or "none")
    print("Reports with empty description:",
          [r["id"] for r in reports if not r["description"]] or "none")
    print("Report dates not exact to the day:",
          [r["id"] for r in reports if r["report_date"]["precision"] != "day"])
    print(f"Entity mentions: {sum(len(r['persons']) for r in reports)} persons, "
          f"{sum(len(r['places']) for r in reports)} places, "
          f"{sum(len(r['organizations']) for r in reports)} organizations, "
          f"{sum(len(r['dates']) for r in reports)} dates "
          f"({vague_dates} not exact to the day)")
    print(f"Places without 4 parts ({len(odd_places)}):")
    for report_id, raw in odd_places:
        print(f"   {report_id}: {raw}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Usage: python3 step1_parse_reports.py <input.txt> <output.json>")
    parsed = parse_file(sys.argv[1])
    with open(sys.argv[2], "w", encoding="utf-8") as out:
        json.dump(parsed, out, indent=2, ensure_ascii=False)
    print_summary(parsed)
