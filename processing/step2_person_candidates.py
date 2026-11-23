"""
step2_person_candidates.py
--------------------------
Step 2 of the data-processing pipeline: find person names that MIGHT refer
to the same individual.

The reports name people inconsistently ("Boris Bugarov", "B. Bugarov",
"Bugarov"; "Ralph Bean" vs "Ralph bean"). This module compares every pair of
distinct names and flags a pair when one of these rules fires:

    same_text      identical after normalization (case, hyphens, titles)
    subset         every word of the shorter name appears in the longer one
                   ("Bugarov" / "Boris Bugarov")
    initials       a name written with initials fits the other name
                   ("A. Somad" / "Abu Somad", "S. H." / "Saeed Hasham")
    same_surname   different first names but the same last name
                   ("Khaled Jehani" / "Fahd Jehani")

The rules are deliberately generous: they produce candidates for a person to
review, not final decisions. 'same_surname' pairs are usually DIFFERENT
people; they are flagged so that the review records that explicitly.

Usage (prints the candidate list):
    python3 step2_person_candidates.py <reports_raw.json>
"""

import json
import re
import sys
from collections import defaultdict
from itertools import combinations

# Words that are titles or ranks rather than part of a person's name.
TITLES = {"dr", "fr", "mr", "ms", "mrs", "maj", "gen"}

# Arabic name particles; too common to count as a match on their own.
PARTICLES = {"al", "abu", "el", "bin", "ibn"}

# Phrases that signal, in the report text, that two names belong to one
# person ("Satam [alias Ronald] Derwish", "traveling under ... the name").
ALIAS_CUES = re.compile(
    r"alias|in the name|under the name|using the name|identified as|"
    r"posing as|knew him as|known him as|calling himself|subsequently identified",
    re.I)


def normalize(name):
    """
    Reduce a raw name to lowercase words without titles or noise.

    'J. T., Detroit' -> ['j', 't']        (location suffix removed)
    'Hafs or Halfs'  -> ['hafs', 'halfs'] (alternative spellings kept)
    'Mahmud al-Dahab' -> ['mahmud', 'al', 'dahab']
    """
    name = name.split(",")[0]                  # drop ', Detroit' style suffix
    name = name.lower().replace("-", " ").replace(" or ", " ")
    words = re.findall(r"[a-z']+", name)
    return [w for w in words if w not in TITLES]


def is_initial(word, raw_name):
    """True when the word is written as an initial ('A.') in the raw name."""
    return re.search(r"\b" + re.escape(word) + r"\.", raw_name, re.I) is not None


def significant(words):
    """Words that carry identity (not particles like 'al' or 'abu')."""
    return [w for w in words if w not in PARTICLES]


def initials_match(short_raw, long_raw):
    """
    True when short_raw uses initials that fit long_raw, e.g.
    'A. Somad' ~ 'Abu Somad', 'Khalid S.' ~ 'Khalid Shamrani',
    'S. H.' ~ 'Saeed Hasham'. Word order must be the same.
    """
    short, long_ = normalize(short_raw), normalize(long_raw)
    if not any(is_initial(w, short_raw) for w in short):
        return False
    long_sig = significant(long_)
    short_sig = [w for w in short if w not in PARTICLES or is_initial(w, short_raw)]
    if len(short_sig) != len(long_sig):
        return False
    for s_word, l_word in zip(short_sig, long_sig):
        if is_initial(s_word, short_raw):
            if not l_word.startswith(s_word):
                return False
        elif s_word != l_word:
            return False
    return True


def compare(name_a, name_b):
    """Return the rule that links two names, or None if no rule fires."""
    words_a, words_b = normalize(name_a), normalize(name_b)
    sig_a, sig_b = set(significant(words_a)), set(significant(words_b))

    if words_a == words_b:
        return "same_text"
    if initials_match(name_a, name_b) or initials_match(name_b, name_a):
        return "initials"
    if sig_a and sig_b and (sig_a <= sig_b or sig_b <= sig_a):
        return "subset"
    surname_a, surname_b = significant(words_a)[-1:], significant(words_b)[-1:]
    if len(sig_a) > 1 and len(sig_b) > 1 and surname_a == surname_b \
            and not is_initial(surname_a[0], name_a) \
            and not is_initial(surname_b[0], name_b):
        return "same_surname"
    return None


def mentioned_in(name, sentence):
    """
    True when a listed person name is mentioned in a sentence, either in full
    or by its last significant word ('Derwish' for 'Satam Derwish').
    """
    text = sentence.lower()
    words = significant(normalize(name))
    if not words:
        return False
    if name.split(",")[0].lower() in text:
        return True
    surname = words[-1]
    return len(surname) > 2 and re.search(r"\b" + re.escape(surname) + r"\b", text)


def find_text_cue_pairs(report):
    """
    Look for alias statements in a report's description.

    For each sentence containing an alias cue phrase, every pair of the
    report's listed persons mentioned in that sentence OR the sentence before
    it becomes a candidate. The previous sentence is included because alias
    statements often refer back with a pronoun ("He has been using the alias
    'Jose Ramirez'"). Returns a set of (name_a, name_b) pairs, alphabetically
    ordered.
    """
    pairs = set()
    sentences = re.split(r"(?<=[.!?])\s+", report["description"])
    for index, sentence in enumerate(sentences):
        if not ALIAS_CUES.search(sentence):
            continue
        window = " ".join(sentences[max(index - 1, 0):index + 1])
        present = sorted(n for n in report["persons"] if mentioned_in(n, window))
        pairs.update(combinations(present, 2))
    return pairs


def find_candidates(reports):
    """
    Compare every pair of distinct names in the reports.

    Returns (name_to_reports, candidates) where candidates is a list of
    (name_a, name_b, rule) tuples, sorted for stable output.
    """
    name_to_reports = defaultdict(list)
    for report in reports:
        for name in report["persons"]:
            name_to_reports[name].append(report["id"])

    # Technique 1: compare the names themselves.
    found = {}
    for name_a, name_b in combinations(sorted(name_to_reports), 2):
        rule = compare(name_a, name_b)
        if rule:
            found[(name_a, name_b)] = rule

    # Technique 2: alias statements in the report text. A pair already found
    # by a name rule keeps that rule, with the text cue added to its label.
    for report in reports:
        for pair in find_text_cue_pairs(report):
            rule = found.get(pair)
            if rule is None:
                found[pair] = "text_cue"
            elif "text_cue" not in rule:   # same pair in several reports: label it once
                found[pair] = f"{rule}+text_cue"

    candidates = sorted((a, b, rule) for (a, b), rule in found.items())
    return dict(name_to_reports), candidates


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python3 step2_person_candidates.py <reports_raw.json>")
    with open(sys.argv[1], encoding="utf-8") as handle:
        all_reports = json.load(handle)
    names, pairs = find_candidates(all_reports)
    print(f"{len(names)} distinct names, {len(pairs)} candidate pairs\n")
    for name_a, name_b, rule in pairs:
        print(f"{rule:13} {name_a!r:26} {names[name_a]}  ~  "
              f"{name_b!r:26} {names[name_b]}")
