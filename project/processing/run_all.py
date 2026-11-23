"""
run_all.py
----------
Runs the whole data-processing pipeline in order, from the original dataset
to the data files the web page loads:

    data/input/dataset.txt
      step 1  parse the reports              -> data/generated/reports_raw.json
      step 3  resolve person identities      -> data/generated/reports_resolved.json
              (applies data/manual/person_review.json)  data/generated/persons.json
      step 4  build the network data         -> web/data/network.js
      step 5  copy the AI-written summaries  -> web/data/ai_summaries.js
              (from data/manual/ai_summaries/)

Step 2 (step2_person_candidates.py) is not run here: it prints suggested
same-person name pairs for a human to review when person_review.json is
being written. Step 3 uses it to check that every suggestion was decided.

Usage (from any folder; needs Python 3 only):
    python3 processing/run_all.py
"""

import os
import subprocess
import sys

PROCESSING = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(PROCESSING)


def path(*parts):
    """Absolute path inside the project folder."""
    return os.path.join(ROOT, *parts)


STEPS = [
    ("Step 1: parse the reports", "step1_parse_reports.py",
     [path("data", "input", "dataset.txt"), path("data", "generated", "reports_raw.json")]),
    ("Step 3: resolve person identities", "step3_resolve_persons.py",
     [path("data", "generated", "reports_raw.json"), path("data", "manual", "person_review.json"),
      path("data", "generated")]),
    ("Step 4: build the network data", "step4_build_network.py",
     [path("data", "generated", "reports_resolved.json"), path("data", "generated", "persons.json"),
      path("web", "data", "network.js")]),
    ("Step 5: copy the AI-written summaries", "step5_build_ai_summaries.py",
     [path("data", "generated", "persons.json"), path("data", "manual", "ai_summaries"),
      path("web", "data", "ai_summaries.js")]),
]


def main():
    os.makedirs(path("data", "generated"), exist_ok=True)
    for title, script, args in STEPS:
        print(f"\n=== {title} ({script}) ===")
        result = subprocess.run([sys.executable, os.path.join(PROCESSING, script), *args], cwd=PROCESSING)
        if result.returncode != 0:
            sys.exit(f"Stopped: {script} failed.")
    print("\nDone. Open web/index.html to use the tool.")


if __name__ == "__main__":
    main()
