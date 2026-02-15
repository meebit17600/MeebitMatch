#!/usr/bin/env python3
"""
Meebits Metadata Aggregation & Rule Derivation (v3 - Comprehensive)
Processes 20,000 Meebits into a unified database and derives trait
compatibility rules, with inferred gender controlling for male/female
trait splits to distinguish real generation rules from gender artifacts.

v3 adds: per-type value pools, type-exclusive values, color-element mappings,
per-type exclusions, jersey number analysis, tattoo structure analysis,
near-exclusions, comprehensive all-pairs biases, three-way interactions,
and deterministic rules.
"""

import json
import csv
import os
import sys
from collections import defaultdict, Counter
from itertools import combinations
import math

INPUT_DIR = "metadata_raw/meebits_metadata_as_IPFS"
DATABASE_PATH = "meebits_database.json"
OUTPUT_DIR = "."

# All known trait categories based on the task spec
TRAIT_CATEGORIES = [
    "hair_style", "hair_color", "hat", "hat_color",
    "beard", "beard_color", "glasses", "glasses_color",
    "earring", "necklace", "shirt", "shirt_color",
    "overshirt", "overshirt_color", "pants", "pants_color",
    "shoes", "shoes_color", "tattoo", "tattoo_motif",
    "jersey_number"
]

# Element-level trait categories (no colors)
ELEMENT_CATS = ["hair_style", "hat", "beard", "glasses", "earring",
                "necklace", "shirt", "overshirt", "pants", "shoes", "tattoo"]

# Element-to-color category pairs
ELEMENT_COLOR_PAIRS = [
    ("hair_style", "hair_color"),
    ("hat", "hat_color"),
    ("beard", "beard_color"),
    ("glasses", "glasses_color"),
    ("shirt", "shirt_color"),
    ("overshirt", "overshirt_color"),
    ("pants", "pants_color"),
    ("shoes", "shoes_color"),
    ("tattoo", "tattoo_motif"),
]

ALL_TYPES = ["Human", "Pig", "Elephant", "Robot", "Skeleton", "Visitor", "Dissected"]


# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------

def chi_squared_pvalue(observed, expected):
    """Approximate p-value for a single-cell chi-squared test (1 df)."""
    if expected <= 0:
        return 1.0
    chi2 = ((observed - expected) ** 2) / expected
    # Approximate using the complementary error function (1 df)
    p = 1.0 - math.erf(math.sqrt(chi2 / 2.0))
    return max(p, 1e-300)


def parse_trait_key(trait_str):
    """Parse 'category=value' into (category, value)."""
    parts = trait_str.split("=", 1)
    return (parts[0], parts[1]) if len(parts) == 2 else (parts[0], "")


def parse_meebit(filepath, token_id):
    """Parse a single meebit JSON file into a flat dict."""
    with open(filepath, 'r') as f:
        data = json.load(f)

    record = {"token_id": token_id, "type": data.get("type", "")}

    # Map nested trait objects to flat columns
    trait_map = {
        "hair": ("hair_style", "hair_color"),
        "hat": ("hat", "hat_color"),
        "beard": ("beard", "beard_color"),
        "glasses": ("glasses", "glasses_color"),
        "earring": ("earring", None),
        "necklace": ("necklace", None),
        "shirt": ("shirt", "shirt_color"),
        "overshirt": ("overshirt", "overshirt_color"),
        "pants": ("pants", "pants_color"),
        "shoes": ("shoes", "shoes_color"),
        "tattoo": ("tattoo", "tattoo_motif"),
    }

    for key, (elem_col, style_col) in trait_map.items():
        val = data.get(key)
        if val is None:
            record[elem_col] = None
            if style_col:
                record[style_col] = None
        elif isinstance(val, dict):
            elem = val.get("element", "")
            style = val.get("style", "")
            record[elem_col] = elem if elem else None
            if style_col:
                record[style_col] = style if style else None
        elif isinstance(val, str):
            # Some traits might be plain strings
            record[elem_col] = val if val else None
            if style_col:
                record[style_col] = None

    # Handle jerseyNumber separately
    jn = data.get("jerseyNumber")
    record["jersey_number"] = str(jn) if jn is not None else None

    return record


def load_all_meebits():
    """Load all 20,000 meebit files."""
    records = []
    for i in range(1, 20001):
        filename = f"meebit_{i:05d}.json"
        filepath = os.path.join(INPUT_DIR, filename)
        if not os.path.exists(filepath):
            print(f"Warning: {filepath} not found, skipping")
            continue
        record = parse_meebit(filepath, i)
        records.append(record)
        if i % 5000 == 0:
            print(f"  Loaded {i}/20000...")
    return records


def load_from_database():
    """Load records from the existing meebits_database.json."""
    db_path = os.path.join(OUTPUT_DIR, DATABASE_PATH)
    with open(db_path, 'r') as f:
        records = json.load(f)
    return records


def infer_gender(records):
    """
    Infer gender for Human meebits using beard as the anchor trait.

    Strategy:
    1. Any human with a beard = male (beards are definitively male-only)
    2. Use beard co-occurrence to classify all other trait values as male-only,
       female-only, or unisex
    3. Classify each human based on their trait values voting on gender
    4. Non-human types get gender=None
    """
    humans = [r for r in records if r["type"] == "Human"]

    # Step 1: Find all bearded humans (definitively male)
    bearded_ids = set()
    for r in humans:
        if r.get("beard") is not None:
            bearded_ids.add(r["token_id"])

    # Step 2: For each trait value, compute what fraction appears on bearded humans
    # vs non-bearded. This tells us male vs female affinity.
    trait_gender_scores = {}  # {(cat, value): (with_beard_count, without_beard_count)}

    for cat in ELEMENT_CATS:
        if cat == "beard":
            continue
        val_with_beard = Counter()
        val_without_beard = Counter()
        for r in humans:
            v = r.get(cat)
            if v is None:
                continue
            if r["token_id"] in bearded_ids:
                val_with_beard[v] += 1
            else:
                val_without_beard[v] += 1

        for v in set(list(val_with_beard.keys()) + list(val_without_beard.keys())):
            wb = val_with_beard.get(v, 0)
            wob = val_without_beard.get(v, 0)
            trait_gender_scores[(cat, v)] = (wb, wob)

    # Step 3: Classify trait values
    # Beard rate among all humans: bearded / total
    beard_rate = len(bearded_ids) / len(humans) if humans else 0

    trait_classification = {}  # {(cat, value): "male" | "female" | "unisex"}
    male_traits = set()
    female_traits = set()

    for (cat, v), (wb, wob) in trait_gender_scores.items():
        total = wb + wob
        if total < 5:
            trait_classification[(cat, v)] = "unisex"
            continue

        beard_affinity = wb / total
        # Expected beard rate if trait were unisex
        # If beard_affinity >> beard_rate, trait is male-leaning
        # If beard_affinity << beard_rate, trait is female-leaning
        # If beard_affinity == 0, trait is definitively female

        if wb == 0 and total >= 10:
            trait_classification[(cat, v)] = "female"
            female_traits.add((cat, v))
        elif beard_affinity > beard_rate * 1.8:
            trait_classification[(cat, v)] = "male"
            male_traits.add((cat, v))
        elif beard_affinity < beard_rate * 0.2:
            trait_classification[(cat, v)] = "female"
            female_traits.add((cat, v))
        else:
            trait_classification[(cat, v)] = "unisex"

    # Step 4: Classify each human by voting
    gender_map = {}  # token_id -> "male" | "female"

    for r in humans:
        if r["token_id"] in bearded_ids:
            gender_map[r["token_id"]] = "male"
            continue

        male_votes = 0
        female_votes = 0
        for cat in ELEMENT_CATS:
            if cat == "beard":
                continue
            v = r.get(cat)
            if v is None:
                continue
            cls = trait_classification.get((cat, v), "unisex")
            if cls == "male":
                male_votes += 1
            elif cls == "female":
                female_votes += 1

        if male_votes > female_votes:
            gender_map[r["token_id"]] = "male"
        elif female_votes > male_votes:
            gender_map[r["token_id"]] = "female"
        else:
            # Tie-break: use the most distinctive trait
            # Default to male if beardless but all unisex traits
            gender_map[r["token_id"]] = "male"

    # Step 5: Apply gender to records
    for r in records:
        if r["type"] == "Human":
            r["gender"] = gender_map.get(r["token_id"])
        else:
            r["gender"] = None

    # Build gender stats
    gender_counts = Counter(r["gender"] for r in records if r["type"] == "Human")

    # Build per-gender trait value lists
    gender_trait_values = {"male": defaultdict(Counter), "female": defaultdict(Counter)}
    for r in records:
        if r["type"] != "Human" or r.get("gender") is None:
            continue
        g = r["gender"]
        for cat in ELEMENT_CATS:
            v = r.get(cat)
            if v is not None:
                gender_trait_values[g][cat][v] += 1

    return records, gender_counts, trait_classification, gender_trait_values


def export_database(records):
    """Export meebits_database.json and meebits_database.csv."""
    # JSON
    json_path = os.path.join(OUTPUT_DIR, "meebits_database.json")
    with open(json_path, 'w') as f:
        json.dump(records, f, indent=2)
    print(f"Wrote {json_path} ({len(records)} records)")

    # CSV - now includes gender column
    csv_path = os.path.join(OUTPUT_DIR, "meebits_database.csv")
    columns = ["token_id", "type", "gender"] + TRAIT_CATEGORIES
    with open(csv_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction='ignore')
        writer.writeheader()
        for r in records:
            writer.writerow(r)
    print(f"Wrote {csv_path}")


def analyze_type_level_rules(records):
    """Which trait categories can each type have?"""
    type_traits = defaultdict(lambda: defaultdict(int))
    type_counts = Counter()

    for r in records:
        t = r["type"]
        type_counts[t] += 1
        for cat in TRAIT_CATEGORIES:
            if r.get(cat) is not None:
                type_traits[t][cat] += 1

    return dict(type_traits), dict(type_counts)


def analyze_exclusion_rules(records):
    """Find trait category pairs that NEVER co-occur."""
    # For each pair of trait categories, check if they ever both have values
    cooccurrence = defaultdict(int)
    category_counts = defaultdict(int)

    for r in records:
        present = [cat for cat in TRAIT_CATEGORIES if r.get(cat) is not None]
        for cat in present:
            category_counts[cat] += 1
        for a, b in combinations(present, 2):
            key = tuple(sorted([a, b]))
            cooccurrence[key] += 1

    # Find pairs that never co-occur (both categories have instances but never together)
    never_cooccur = []
    for a, b in combinations(TRAIT_CATEGORIES, 2):
        key = tuple(sorted([a, b]))
        if category_counts[a] > 0 and category_counts[b] > 0 and cooccurrence[key] == 0:
            never_cooccur.append({
                "categories": list(key),
                "count_a": category_counts[a],
                "count_b": category_counts[b],
                "co_occurrences": 0,
                "confidence": "absolute"
            })

    return never_cooccur, dict(cooccurrence), dict(category_counts)


def analyze_value_exclusions(records):
    """Find specific trait VALUE pairs that never co-occur."""
    # Build value-level co-occurrence data
    # Focus on element-level traits (not colors which have too many combos)
    element_cats = ["hair_style", "hat", "beard", "glasses", "earring",
                    "necklace", "shirt", "overshirt", "pants", "shoes", "tattoo"]

    # Collect all values per category
    cat_values = defaultdict(set)
    for r in records:
        for cat in element_cats:
            v = r.get(cat)
            if v is not None:
                cat_values[cat].add(v)

    # For each pair of categories that DO co-occur, find specific value pairs that never appear together
    value_exclusions = []

    for cat_a, cat_b in combinations(element_cats, 2):
        if not cat_values[cat_a] or not cat_values[cat_b]:
            continue

        # Build co-occurrence matrix for these two categories
        pair_counts = defaultdict(int)
        a_counts = defaultdict(int)
        b_counts = defaultdict(int)
        both_present = 0

        for r in records:
            va = r.get(cat_a)
            vb = r.get(cat_b)
            if va is not None and vb is not None:
                both_present += 1
                pair_counts[(va, vb)] += 1
                a_counts[va] += 1
                b_counts[vb] += 1

        if both_present == 0:
            continue

        # Find value pairs that never co-occur but both appear when the other category is present
        for va in a_counts:
            for vb in b_counts:
                if pair_counts[(va, vb)] == 0:
                    # Only report if both values are reasonably common (>= 10 occurrences)
                    if a_counts[va] >= 10 and b_counts[vb] >= 10:
                        value_exclusions.append({
                            "trait_a": f"{cat_a}={va}",
                            "trait_b": f"{cat_b}={vb}",
                            "count_a_when_b_present": a_counts[va],
                            "count_b_when_a_present": b_counts[vb],
                            "total_both_present": both_present,
                            "confidence": "absolute"
                        })

    return value_exclusions


def analyze_dependency_rules(records):
    """Find traits that always or nearly always co-occur."""
    dependencies = []

    element_cats = ["hair_style", "hat", "beard", "glasses", "earring",
                    "necklace", "shirt", "overshirt", "pants", "shoes",
                    "tattoo", "jersey_number"]

    # Check if trait A always implies trait B
    for cat_a in element_cats:
        for cat_b in element_cats:
            if cat_a == cat_b:
                continue

            # Count occurrences
            a_count = 0
            a_and_b = 0
            a_values_with_b = defaultdict(lambda: defaultdict(int))

            for r in records:
                va = r.get(cat_a)
                vb = r.get(cat_b)
                if va is not None:
                    a_count += 1
                    if vb is not None:
                        a_and_b += 1
                        a_values_with_b[va][vb] += 1

            if a_count == 0:
                continue

            ratio = a_and_b / a_count
            if ratio >= 0.95:
                dependencies.append({
                    "if_present": cat_a,
                    "then_present": cat_b,
                    "count_a": a_count,
                    "count_both": a_and_b,
                    "ratio": round(ratio, 4),
                    "strength": "always" if ratio == 1.0 else "nearly_always"
                })

    # Also check specific value dependencies (e.g., jersey_number -> shirt=Jersey)
    value_dependencies = []
    for r in records:
        pass  # We'll do this differently

    # Check jersey_number -> shirt value
    jn_shirt = Counter()
    jn_count = 0
    for r in records:
        if r.get("jersey_number") is not None:
            jn_count += 1
            shirt = r.get("shirt")
            if shirt:
                jn_shirt[shirt] += 1

    if jn_count > 0:
        for shirt_val, count in jn_shirt.most_common():
            value_dependencies.append({
                "if_trait": "jersey_number (any)",
                "then_trait": f"shirt={shirt_val}",
                "count": count,
                "total": jn_count,
                "ratio": round(count / jn_count, 4)
            })

    return dependencies, value_dependencies


def analyze_conditional_probabilities(records):
    """Find notable biases in trait co-occurrence beyond random chance."""
    results = []

    # Focus on meaningful pairs: hat+hat_color, shirt+shirt_color, etc.
    style_pairs = [
        ("hat", "hat_color"),
        ("shirt", "shirt_color"),
        ("overshirt", "overshirt_color"),
        ("pants", "pants_color"),
        ("shoes", "shoes_color"),
        ("hair_style", "hair_color"),
        ("beard", "beard_color"),
    ]

    for elem_cat, color_cat in style_pairs:
        # Build distribution
        elem_color_counts = defaultdict(lambda: defaultdict(int))
        color_totals = defaultdict(int)
        elem_totals = defaultdict(int)
        total = 0

        for r in records:
            e = r.get(elem_cat)
            c = r.get(color_cat)
            if e is not None and c is not None:
                elem_color_counts[e][c] += 1
                color_totals[c] += 1
                elem_totals[e] += 1
                total += 1

        if total == 0:
            continue

        # Calculate expected vs observed for each (elem, color) pair
        biases = []
        for e in elem_color_counts:
            for c in elem_color_counts[e]:
                observed = elem_color_counts[e][c]
                expected = (elem_totals[e] * color_totals[c]) / total if total > 0 else 0
                if expected > 0 and observed >= 5:
                    ratio = observed / expected
                    if ratio > 2.0 or ratio < 0.3:
                        biases.append({
                            "element": e,
                            "color": c,
                            "observed": observed,
                            "expected": round(expected, 1),
                            "ratio": round(ratio, 2),
                            "direction": "overrepresented" if ratio > 1 else "underrepresented"
                        })

        if biases:
            biases.sort(key=lambda x: x["ratio"], reverse=True)
            results.append({
                "category_pair": f"{elem_cat} + {color_cat}",
                "total_records": total,
                "biases": biases[:30]  # Top biases
            })

    # Cross-category biases (e.g., hat style vs shirt style)
    cross_pairs = [
        ("hat", "shirt"),
        ("hat", "overshirt"),
        ("glasses", "hat"),
        ("beard", "hat"),
        ("hair_style", "hat"),
    ]

    for cat_a, cat_b in cross_pairs:
        ab_counts = defaultdict(lambda: defaultdict(int))
        a_totals = defaultdict(int)
        b_totals = defaultdict(int)
        total = 0

        for r in records:
            va = r.get(cat_a)
            vb = r.get(cat_b)
            if va is not None and vb is not None:
                ab_counts[va][vb] += 1
                a_totals[va] += 1
                b_totals[vb] += 1
                total += 1

        if total == 0:
            continue

        biases = []
        for va in ab_counts:
            for vb in ab_counts[va]:
                observed = ab_counts[va][vb]
                expected = (a_totals[va] * b_totals[vb]) / total if total > 0 else 0
                if expected > 0 and observed >= 5:
                    ratio = observed / expected
                    if ratio > 2.0 or ratio < 0.3:
                        biases.append({
                            "trait_a": f"{cat_a}={va}",
                            "trait_b": f"{cat_b}={vb}",
                            "observed": observed,
                            "expected": round(expected, 1),
                            "ratio": round(ratio, 2),
                            "direction": "overrepresented" if ratio > 1 else "underrepresented"
                        })

        if biases:
            biases.sort(key=lambda x: x["ratio"], reverse=True)
            results.append({
                "category_pair": f"{cat_a} + {cat_b}",
                "total_records": total,
                "biases": biases[:20]
            })

    return results


def analyze_gender_exclusions(records):
    """
    Find value-level exclusion rules WITHIN each gender.
    These are real generation constraints, not gender artifacts.
    Also identify cross-gender-only exclusions (gender artifacts).
    """
    real_exclusions = []
    gender_artifact_exclusions = []

    for gender in ["male", "female"]:
        subset = [r for r in records if r.get("gender") == gender]
        if not subset:
            continue

        # Build value co-occurrence within this gender
        for cat_a, cat_b in combinations(ELEMENT_CATS, 2):
            pair_counts = defaultdict(int)
            a_counts = defaultdict(int)
            b_counts = defaultdict(int)
            both_present = 0

            for r in subset:
                va = r.get(cat_a)
                vb = r.get(cat_b)
                if va is not None and vb is not None:
                    both_present += 1
                    pair_counts[(va, vb)] += 1
                    a_counts[va] += 1
                    b_counts[vb] += 1

            if both_present == 0:
                continue

            for va in a_counts:
                for vb in b_counts:
                    if pair_counts[(va, vb)] == 0:
                        if a_counts[va] >= 10 and b_counts[vb] >= 10:
                            real_exclusions.append({
                                "trait_a": f"{cat_a}={va}",
                                "trait_b": f"{cat_b}={vb}",
                                "gender": gender,
                                "count_a": a_counts[va],
                                "count_b": b_counts[vb],
                                "total_both_present": both_present,
                                "confidence": "absolute",
                                "type": "real_constraint"
                            })

    # Now compare with the all-population exclusions to find gender artifacts
    # An exclusion that exists in the all-population but NOT within either gender
    # is a gender artifact
    all_pop_exclusions = set()
    all_pair_counts = defaultdict(int)
    all_a_counts = defaultdict(lambda: defaultdict(int))
    all_b_counts = defaultdict(lambda: defaultdict(int))
    all_both = defaultdict(int)

    humans = [r for r in records if r["type"] == "Human"]

    for cat_a, cat_b in combinations(ELEMENT_CATS, 2):
        for r in humans:
            va = r.get(cat_a)
            vb = r.get(cat_b)
            if va is not None and vb is not None:
                key = (cat_a, cat_b)
                all_pair_counts[(cat_a, cat_b, va, vb)] += 1
                all_a_counts[key][va] += 1
                all_b_counts[key][vb] += 1
                all_both[key] += 1

    # Real within-gender exclusion keys
    real_keys = set()
    for ex in real_exclusions:
        real_keys.add((ex["trait_a"], ex["trait_b"], ex["gender"]))

    for cat_a, cat_b in combinations(ELEMENT_CATS, 2):
        key = (cat_a, cat_b)
        if all_both[key] == 0:
            continue
        for va in all_a_counts[key]:
            for vb in all_b_counts[key]:
                if all_pair_counts[(cat_a, cat_b, va, vb)] == 0:
                    if all_a_counts[key][va] >= 10 and all_b_counts[key][vb] >= 10:
                        ta = f"{cat_a}={va}"
                        tb = f"{cat_b}={vb}"
                        # Is this a within-gender exclusion for either gender?
                        is_real = ((ta, tb, "male") in real_keys or
                                   (ta, tb, "female") in real_keys)
                        if not is_real:
                            gender_artifact_exclusions.append({
                                "trait_a": ta,
                                "trait_b": tb,
                                "count_a": all_a_counts[key][va],
                                "count_b": all_b_counts[key][vb],
                                "reason": "cross-gender: traits belong to different genders",
                                "type": "gender_artifact"
                            })

    return real_exclusions, gender_artifact_exclusions


def analyze_gender_conditional_probs(records):
    """
    Conditional probability analysis controlling for gender.
    Runs the same analysis but within male-only and female-only populations.
    """
    results = []

    cross_pairs = [
        ("hat", "shirt"),
        ("hat", "overshirt"),
        ("glasses", "hat"),
        ("hair_style", "hat"),
        ("hair_style", "glasses"),
        ("hair_style", "shirt"),
        ("glasses", "shirt"),
        ("earring", "necklace"),
        ("hat", "glasses"),
        ("shirt", "pants"),
        ("pants", "shoes"),
    ]

    for gender in ["male", "female"]:
        subset = [r for r in records if r.get("gender") == gender]
        if not subset:
            continue

        for cat_a, cat_b in cross_pairs:
            ab_counts = defaultdict(lambda: defaultdict(int))
            a_totals = defaultdict(int)
            b_totals = defaultdict(int)
            total = 0

            for r in subset:
                va = r.get(cat_a)
                vb = r.get(cat_b)
                if va is not None and vb is not None:
                    ab_counts[va][vb] += 1
                    a_totals[va] += 1
                    b_totals[vb] += 1
                    total += 1

            if total == 0:
                continue

            biases = []
            for va in ab_counts:
                for vb in ab_counts[va]:
                    observed = ab_counts[va][vb]
                    expected = (a_totals[va] * b_totals[vb]) / total if total > 0 else 0
                    if expected > 0 and observed >= 5:
                        ratio = observed / expected
                        if ratio > 2.0 or ratio < 0.3:
                            biases.append({
                                "trait_a": f"{cat_a}={va}",
                                "trait_b": f"{cat_b}={vb}",
                                "observed": observed,
                                "expected": round(expected, 1),
                                "ratio": round(ratio, 2),
                                "direction": "overrepresented" if ratio > 1 else "underrepresented"
                            })

            if biases:
                biases.sort(key=lambda x: x["ratio"], reverse=True)
                results.append({
                    "category_pair": f"{cat_a} + {cat_b}",
                    "gender": gender,
                    "total_records": total,
                    "biases": biases[:20]
                })

    # Also do style pairs within gender
    style_pairs = [
        ("hat", "hat_color"),
        ("shirt", "shirt_color"),
        ("pants", "pants_color"),
        ("shoes", "shoes_color"),
        ("hair_style", "hair_color"),
    ]

    for gender in ["male", "female"]:
        subset = [r for r in records if r.get("gender") == gender]
        if not subset:
            continue

        for elem_cat, color_cat in style_pairs:
            elem_color_counts = defaultdict(lambda: defaultdict(int))
            color_totals = defaultdict(int)
            elem_totals = defaultdict(int)
            total = 0

            for r in subset:
                e = r.get(elem_cat)
                c = r.get(color_cat)
                if e is not None and c is not None:
                    elem_color_counts[e][c] += 1
                    color_totals[c] += 1
                    elem_totals[e] += 1
                    total += 1

            if total == 0:
                continue

            biases = []
            for e in elem_color_counts:
                for c in elem_color_counts[e]:
                    observed = elem_color_counts[e][c]
                    expected = (elem_totals[e] * color_totals[c]) / total if total > 0 else 0
                    if expected > 0 and observed >= 5:
                        ratio = observed / expected
                        if ratio > 2.0 or ratio < 0.3:
                            biases.append({
                                "element": e,
                                "color": c,
                                "observed": observed,
                                "expected": round(expected, 1),
                                "ratio": round(ratio, 2),
                                "direction": "overrepresented" if ratio > 1 else "underrepresented"
                            })

            if biases:
                biases.sort(key=lambda x: x["ratio"], reverse=True)
                results.append({
                    "category_pair": f"{elem_cat} + {color_cat}",
                    "gender": gender,
                    "total_records": total,
                    "biases": biases[:20]
                })

    return results


# ===========================================================================
# NEW ANALYSIS MODULES (v3)
# ===========================================================================

def analyze_per_type_value_pools(records):
    """Module 1: For each type, enumerate every trait value with counts."""
    type_value_pools = defaultdict(lambda: defaultdict(Counter))
    for r in records:
        t = r["type"]
        for cat in TRAIT_CATEGORIES:
            v = r.get(cat)
            if v is not None:
                type_value_pools[t][cat][v] += 1
    # Convert to plain dicts for JSON serialization
    result = {}
    for t in type_value_pools:
        result[t] = {}
        for cat in type_value_pools[t]:
            result[t][cat] = dict(type_value_pools[t][cat].most_common())
    return result


def analyze_type_exclusive_values(type_value_pools):
    """Module 2: Identify trait values exclusive to certain types."""
    # For each (category, value), track which types have it
    value_types = defaultdict(lambda: defaultdict(set))
    for t in type_value_pools:
        for cat in type_value_pools[t]:
            for v in type_value_pools[t][cat]:
                value_types[cat][v].add(t)

    exclusive = []
    for cat in sorted(value_types.keys()):
        for v in sorted(value_types[cat].keys()):
            types_with = value_types[cat][v]
            types_without = set(ALL_TYPES) - types_with
            # Only interesting if not universal across all types that CAN have this category
            if len(types_with) < len(ALL_TYPES):
                exclusive.append({
                    "category": cat,
                    "value": v,
                    "available_types": sorted(types_with),
                    "excluded_types": sorted(types_without),
                    "num_types": len(types_with)
                })
    return exclusive


def analyze_color_element_mappings(records):
    """Module 3: For each element value, determine if color is always/never/sometimes present."""
    results = {}

    for elem_cat, color_cat in ELEMENT_COLOR_PAIRS:
        elem_stats = defaultdict(lambda: {
            "with_color": 0, "without_color": 0, "color_dist": Counter()
        })
        for r in records:
            e = r.get(elem_cat)
            if e is None:
                continue
            c = r.get(color_cat)
            if c is not None:
                elem_stats[e]["with_color"] += 1
                elem_stats[e]["color_dist"][c] += 1
            else:
                elem_stats[e]["without_color"] += 1

        mappings = []
        for val in sorted(elem_stats.keys()):
            s = elem_stats[val]
            total = s["with_color"] + s["without_color"]
            color_rate = s["with_color"] / total if total > 0 else 0
            if color_rate == 1.0:
                classification = "always_has_color"
            elif color_rate == 0.0:
                classification = "never_has_color"
            else:
                classification = "sometimes_has_color"
            entry = {
                "value": val,
                "total": total,
                "with_color": s["with_color"],
                "without_color": s["without_color"],
                "color_rate": round(color_rate, 4),
                "classification": classification,
            }
            if s["with_color"] > 0:
                entry["color_distribution"] = dict(s["color_dist"].most_common())
            mappings.append(entry)

        results[f"{elem_cat} -> {color_cat}"] = mappings

    return results


def analyze_per_type_exclusions(records):
    """Module 4: Value exclusion analysis within each non-tiny type."""
    results = {}

    for type_name in ALL_TYPES:
        subset = [r for r in records if r["type"] == type_name]
        if len(subset) < 30:
            continue

        min_count = max(3, len(subset) // 50)
        exclusions = []

        for cat_a, cat_b in combinations(ELEMENT_CATS, 2):
            pair_counts = defaultdict(int)
            a_counts = defaultdict(int)
            b_counts = defaultdict(int)
            both_present = 0

            for r in subset:
                va = r.get(cat_a)
                vb = r.get(cat_b)
                if va is not None and vb is not None:
                    both_present += 1
                    pair_counts[(va, vb)] += 1
                    a_counts[va] += 1
                    b_counts[vb] += 1

            if both_present == 0:
                continue

            for va in a_counts:
                for vb in b_counts:
                    if pair_counts[(va, vb)] == 0:
                        if a_counts[va] >= min_count and b_counts[vb] >= min_count:
                            exclusions.append({
                                "trait_a": f"{cat_a}={va}",
                                "trait_b": f"{cat_b}={vb}",
                                "count_a": a_counts[va],
                                "count_b": b_counts[vb],
                                "total_both_present": both_present,
                            })

        if exclusions:
            results[type_name] = exclusions

    return results


def analyze_jersey_number_rules(records):
    """Module 5: Comprehensive jersey number analysis."""
    jn_records = [r for r in records if r.get("jersey_number") is not None]
    non_jn = [r for r in records if r.get("jersey_number") is None]

    # Jersey shirt names (shirts associated with jerseys)
    jersey_shirt_names = {"Jersey", "Classic Jersey", "Basketball Jersey", "Snoutz Jersey"}

    # Bidirectional check: shirts with jersey name but no number
    shirts_no_number = 0
    for r in non_jn:
        if r.get("shirt") in jersey_shirt_names:
            shirts_no_number += 1

    # Numbers with non-jersey shirts
    non_jersey_shirts_with_number = 0
    for r in jn_records:
        if r.get("shirt") not in jersey_shirt_names:
            non_jersey_shirts_with_number += 1

    analysis = {
        "total_with_jersey_number": len(jn_records),
        "total_without_jersey_number": len(non_jn),
        "number_distribution": dict(Counter(r["jersey_number"] for r in jn_records).most_common()),
        "by_type": {},
        "by_gender": {},
        "shirt_distribution_with_jn": dict(Counter(r.get("shirt") for r in jn_records).most_common()),
        "shirt_color_distribution_with_jn": dict(Counter(
            r.get("shirt_color") for r in jn_records if r.get("shirt_color") is not None
        ).most_common()),
        "bidirectional_check": {
            "jersey_shirts_without_number": shirts_no_number,
            "non_jersey_shirts_with_number": non_jersey_shirts_with_number,
            "is_bidirectional": shirts_no_number == 0 and non_jersey_shirts_with_number == 0,
        },
    }

    # By type
    for t in ALL_TYPES:
        type_jn = [r for r in jn_records if r["type"] == t]
        if type_jn:
            analysis["by_type"][t] = {
                "count": len(type_jn),
                "numbers": dict(Counter(r["jersey_number"] for r in type_jn).most_common()),
                "shirts": dict(Counter(r.get("shirt") for r in type_jn).most_common()),
            }

    # By gender (humans only)
    for g in ["male", "female"]:
        g_jn = [r for r in jn_records if r.get("gender") == g]
        if g_jn:
            analysis["by_gender"][g] = {
                "count": len(g_jn),
                "shirts": dict(Counter(r.get("shirt") for r in g_jn).most_common()),
            }

    return analysis


def analyze_tattoo_structure(records):
    """Module 6: Decode tattoo encoding scheme and structural rules."""
    tattoo_records = [r for r in records if r.get("tattoo") is not None]

    comma_sep = []
    single_seg = []

    for r in tattoo_records:
        code = r["tattoo"]
        if "," in code:
            comma_sep.append(r)
        else:
            single_seg.append(r)

    # Comma-separated analysis
    comma_chars = Counter()
    comma_halves_identical = 0
    comma_lengths = Counter()
    for r in comma_sep:
        code = r["tattoo"]
        parts = code.split(",")
        if len(parts) == 2 and parts[0] == parts[1]:
            comma_halves_identical += 1
        for ch in code.replace(",", ""):
            comma_chars[ch] += 1
        comma_lengths[len(parts[0])] += 1

    # Single-segment analysis
    single_chars = Counter()
    single_palindromic = 0
    single_lengths = Counter()
    for r in single_seg:
        code = r["tattoo"]
        if code == code[::-1]:
            single_palindromic += 1
        for ch in code:
            single_chars[ch] += 1
        single_lengths[len(code)] += 1

    analysis = {
        "total_tattooed": len(tattoo_records),
        "by_type": dict(Counter(r["type"] for r in tattoo_records).most_common()),
        "by_gender": dict(Counter(r.get("gender") for r in tattoo_records if r.get("gender")).most_common()),
        "families": {
            "comma_separated": {
                "count": len(comma_sep),
                "halves_identical": comma_halves_identical,
                "halves_identical_pct": round(comma_halves_identical / max(1, len(comma_sep)) * 100, 1),
                "alphabet": sorted(comma_chars.keys()),
                "char_counts": dict(comma_chars.most_common()),
                "half_length_distribution": dict(comma_lengths.most_common()),
            },
            "single_segment": {
                "count": len(single_seg),
                "palindromic": single_palindromic,
                "palindromic_pct": round(single_palindromic / max(1, len(single_seg)) * 100, 1),
                "alphabet": sorted(single_chars.keys()),
                "char_counts": dict(single_chars.most_common()),
                "length_distribution": dict(single_lengths.most_common()),
            },
        },
        "by_type_and_family": {},
        "by_gender_and_family": {},
    }

    # Per-type family breakdown
    for r in tattoo_records:
        t = r["type"]
        if t not in analysis["by_type_and_family"]:
            analysis["by_type_and_family"][t] = {"comma_separated": 0, "single_segment": 0}
        family = "comma_separated" if "," in r["tattoo"] else "single_segment"
        analysis["by_type_and_family"][t][family] += 1

    # Per-gender family breakdown
    for r in tattoo_records:
        g = r.get("gender")
        if g is None:
            continue
        if g not in analysis["by_gender_and_family"]:
            analysis["by_gender_and_family"][g] = {"comma_separated": 0, "single_segment": 0}
        family = "comma_separated" if "," in r["tattoo"] else "single_segment"
        analysis["by_gender_and_family"][g][family] += 1

    return analysis


def analyze_near_exclusions(records):
    """Module 7: Find near-exclusions (soft rules) - pairs that almost never co-occur."""
    near_exclusions = []

    for cat_a, cat_b in combinations(ELEMENT_CATS, 2):
        pair_counts = defaultdict(int)
        a_counts = defaultdict(int)
        b_counts = defaultdict(int)
        both_present = 0

        for r in records:
            va = r.get(cat_a)
            vb = r.get(cat_b)
            if va is not None and vb is not None:
                both_present += 1
                pair_counts[(va, vb)] += 1
                a_counts[va] += 1
                b_counts[vb] += 1

        if both_present == 0:
            continue

        for va in a_counts:
            for vb in b_counts:
                observed = pair_counts[(va, vb)]
                expected = (a_counts[va] * b_counts[vb]) / both_present
                # Near-exclusion: observed is 1-5 but expected is much higher
                if expected >= 5 and 0 < observed <= 5 and observed / expected < 0.1:
                    near_exclusions.append({
                        "trait_a": f"{cat_a}={va}",
                        "trait_b": f"{cat_b}={vb}",
                        "observed": observed,
                        "expected": round(expected, 1),
                        "ratio": round(observed / expected, 4),
                    })

    near_exclusions.sort(key=lambda x: x["ratio"])
    return near_exclusions


def analyze_comprehensive_biases(records):
    """Module 8: All-pairs bias analysis with significance testing."""
    results = []

    all_pairs = list(combinations(ELEMENT_CATS, 2))

    for cat_a, cat_b in all_pairs:
        ab_counts = defaultdict(lambda: defaultdict(int))
        a_totals = defaultdict(int)
        b_totals = defaultdict(int)
        total = 0

        for r in records:
            va = r.get(cat_a)
            vb = r.get(cat_b)
            if va is not None and vb is not None:
                ab_counts[va][vb] += 1
                a_totals[va] += 1
                b_totals[vb] += 1
                total += 1

        if total == 0:
            continue

        biases = []
        for va in ab_counts:
            for vb in ab_counts[va]:
                observed = ab_counts[va][vb]
                expected = (a_totals[va] * b_totals[vb]) / total
                if expected > 0 and observed >= 3:
                    ratio = observed / expected
                    p_val = chi_squared_pvalue(observed, expected)
                    if p_val < 0.001 and (ratio > 1.5 or ratio < 0.67):
                        biases.append({
                            "trait_a": f"{cat_a}={va}",
                            "trait_b": f"{cat_b}={vb}",
                            "observed": observed,
                            "expected": round(expected, 1),
                            "ratio": round(ratio, 2),
                            "direction": "overrepresented" if ratio > 1 else "underrepresented",
                        })

        if biases:
            biases.sort(key=lambda x: x["ratio"], reverse=True)
            results.append({
                "category_pair": f"{cat_a} + {cat_b}",
                "total_records": total,
                "num_biases": len(biases),
                "biases": biases[:30],
            })

    return results


def analyze_three_way_interactions(records, comprehensive_biases):
    """Module 9: Detect three-way interactions by stratifying pairwise biases."""
    # Collect the strongest pairwise biases as seeds
    seed_biases = []
    for cp in comprehensive_biases:
        for b in cp["biases"][:5]:  # Top 5 per pair
            if b["ratio"] > 3.0 or b["ratio"] < 0.3:
                seed_biases.append(b)

    seed_biases.sort(key=lambda x: abs(math.log(max(x["ratio"], 0.01))), reverse=True)
    seed_biases = seed_biases[:80]  # Cap at 80 seeds

    three_way = []

    for bias in seed_biases:
        cat_a, val_a = parse_trait_key(bias["trait_a"])
        cat_b, val_b = parse_trait_key(bias["trait_b"])

        for cat_c in ELEMENT_CATS:
            if cat_c in (cat_a, cat_b):
                continue

            # Stratify by cat_c values
            strata = defaultdict(lambda: {"ab": 0, "a": 0, "b": 0, "total": 0})
            for r in records:
                va = r.get(cat_a)
                vb = r.get(cat_b)
                vc = r.get(cat_c)
                if va is not None and vb is not None and vc is not None:
                    s = strata[vc]
                    s["total"] += 1
                    if va == val_a:
                        s["a"] += 1
                    if vb == val_b:
                        s["b"] += 1
                    if va == val_a and vb == val_b:
                        s["ab"] += 1

            # Check if the bias varies significantly across strata
            stratum_ratios = []
            for vc, s in strata.items():
                if s["total"] < 20 or s["a"] < 3 or s["b"] < 3:
                    continue
                expected = (s["a"] * s["b"]) / s["total"]
                if expected >= 1:
                    ratio = s["ab"] / expected
                    stratum_ratios.append({
                        "stratum": f"{cat_c}={vc}",
                        "observed": s["ab"],
                        "expected": round(expected, 1),
                        "ratio": round(ratio, 2),
                        "n": s["total"],
                    })

            if len(stratum_ratios) < 2:
                continue

            # Is there meaningful variation across strata?
            ratios = [sr["ratio"] for sr in stratum_ratios]
            max_ratio = max(ratios)
            min_ratio = min(ratios)

            # Significant if the ratio range spans a 3x difference
            # or if some strata flip direction
            if max_ratio > 0 and min_ratio > 0:
                spread = max_ratio / max(min_ratio, 0.01)
            else:
                spread = 9999.0

            if spread >= 3.0:
                three_way.append({
                    "pair": f"{bias['trait_a']} + {bias['trait_b']}",
                    "overall_ratio": bias["ratio"],
                    "stratified_by": cat_c,
                    "spread": round(spread, 2),
                    "strata": sorted(stratum_ratios, key=lambda x: x["ratio"], reverse=True)[:10],
                })

    three_way.sort(key=lambda x: x["spread"], reverse=True)
    return three_way[:100]


def analyze_deterministic_rules(records):
    """Module 10: Find cases where one trait value perfectly determines another."""
    deterministic = []

    for cat_a in TRAIT_CATEGORIES:
        for cat_b in TRAIT_CATEGORIES:
            if cat_a == cat_b:
                continue

            a_to_b = defaultdict(Counter)
            for r in records:
                va = r.get(cat_a)
                vb = r.get(cat_b)
                if va is not None and vb is not None:
                    a_to_b[va][vb] += 1

            for va, b_counts in a_to_b.items():
                total = sum(b_counts.values())
                if total < 10:
                    continue
                top_value, top_count = b_counts.most_common(1)[0]
                ratio = top_count / total
                if ratio >= 0.95:
                    deterministic.append({
                        "if_trait": f"{cat_a}={va}",
                        "then_trait": f"{cat_b}={top_value}",
                        "count": top_count,
                        "total": total,
                        "ratio": round(ratio, 4),
                        "type": "deterministic" if ratio == 1.0 else "near_deterministic",
                    })

    deterministic.sort(key=lambda x: (-x["ratio"], -x["total"]))
    return deterministic


def build_rules_json(type_traits, type_counts, exclusions, value_exclusions,
                     dependencies, value_dependencies, conditional_probs,
                     gender_counts=None, trait_classification=None,
                     gender_trait_values=None, real_exclusions=None,
                     gender_artifacts=None, gender_cond_probs=None,
                     # v3 additions
                     per_type_pools=None, type_exclusive=None,
                     color_mappings=None, per_type_excl=None,
                     jersey_analysis=None, tattoo_analysis=None,
                     near_excl=None, comp_biases=None,
                     three_way=None, deterministic=None):
    """Build the machine-readable rules file."""
    rules = {
        "metadata": {
            "total_meebits": 20000,
            "types": dict(type_counts),
            "trait_categories": TRAIT_CATEGORIES,
            "gender_counts": dict(gender_counts) if gender_counts else None
        },
        "type_level_rules": {},
        "category_exclusion_rules": exclusions,
        "value_exclusion_rules_all_population": value_exclusions[:200],
        "dependency_rules": dependencies,
        "value_dependency_rules": value_dependencies,
        "conditional_probability_biases_all_population": conditional_probs,
    }

    # Gender-aware rules
    if trait_classification:
        gender_traits = {"male_only": [], "female_only": [], "unisex": []}
        for (cat, v), cls in sorted(trait_classification.items()):
            gender_traits[f"{cls}_only" if cls != "unisex" else "unisex"].append(
                {"category": cat, "value": v}
            )
        rules["gender_trait_classification"] = gender_traits

    if gender_trait_values:
        rules["gender_trait_catalogs"] = {}
        for g in ["male", "female"]:
            rules["gender_trait_catalogs"][g] = {
                cat: dict(vals.most_common()) for cat, vals in gender_trait_values[g].items()
            }

    if real_exclusions is not None:
        rules["value_exclusion_rules_within_gender"] = real_exclusions[:300]
        rules["value_exclusion_rules_gender_artifacts"] = gender_artifacts[:200]
        rules["exclusion_summary"] = {
            "total_all_population": len(value_exclusions),
            "total_real_within_gender": len(real_exclusions),
            "total_gender_artifacts": len(gender_artifacts),
        }

    if gender_cond_probs is not None:
        rules["conditional_probability_biases_by_gender"] = gender_cond_probs

    for t in type_counts:
        rules["type_level_rules"][t] = {
            "count": type_counts[t],
            "available_traits": {cat: type_traits[t].get(cat, 0) for cat in TRAIT_CATEGORIES},
            "never_has": [cat for cat in TRAIT_CATEGORIES if type_traits[t].get(cat, 0) == 0]
        }

    # v3 additions
    if per_type_pools is not None:
        rules["per_type_value_pools"] = per_type_pools
    if type_exclusive is not None:
        rules["type_exclusive_values"] = type_exclusive
    if color_mappings is not None:
        rules["color_element_mappings"] = color_mappings
    if per_type_excl is not None:
        rules["per_type_exclusion_rules"] = per_type_excl
    if jersey_analysis is not None:
        rules["jersey_number_analysis"] = jersey_analysis
    if tattoo_analysis is not None:
        rules["tattoo_structure_analysis"] = tattoo_analysis
    if near_excl is not None:
        rules["near_exclusion_rules"] = near_excl[:200]
    if comp_biases is not None:
        rules["comprehensive_pairwise_biases"] = comp_biases
    if three_way is not None:
        rules["three_way_interactions"] = three_way
    if deterministic is not None:
        rules["deterministic_rules"] = deterministic

    return rules


def build_report(records, type_traits, type_counts, exclusions, value_exclusions,
                 dependencies, value_dependencies, conditional_probs,
                 cooccurrence, category_counts,
                 gender_counts=None, trait_classification=None,
                 gender_trait_values=None, real_exclusions=None,
                 gender_artifacts=None, gender_cond_probs=None,
                 # v3 additions
                 per_type_pools=None, type_exclusive=None,
                 color_mappings=None, per_type_excl=None,
                 jersey_analysis=None, tattoo_analysis=None,
                 near_excl=None, comp_biases=None,
                 three_way=None, deterministic=None):
    """Build the human-readable report."""
    lines = []
    lines.append("# Meebits Trait Rules Report (v3 - Comprehensive)")
    lines.append("")
    lines.append(f"Analysis of {len(records):,} Meebits across {len(type_counts)} types.")
    lines.append("")
    lines.append("> **Key insight**: Humans have an inferred male/female split (~58%/42%). "
                 "Many apparent trait exclusions are simply gender artifacts — traits that "
                 "belong to different genders and therefore never co-occur. This report "
                 "separates real generation constraints from gender artifacts.")
    lines.append("")

    # Type distribution
    lines.append("## Type Distribution")
    lines.append("")
    lines.append("| Type | Count | Percentage |")
    lines.append("|------|-------|------------|")
    for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
        lines.append(f"| {t} | {c:,} | {c/len(records)*100:.1f}% |")
    lines.append("")

    # Type-level rules
    lines.append("## Type-Level Trait Availability")
    lines.append("")
    lines.append("Which trait categories can each type have?")
    lines.append("")

    for t in sorted(type_counts.keys()):
        lines.append(f"### {t} ({type_counts[t]:,} Meebits)")
        lines.append("")
        has = []
        never = []
        for cat in TRAIT_CATEGORIES:
            count = type_traits[t].get(cat, 0)
            if count > 0:
                pct = count / type_counts[t] * 100
                has.append(f"- **{cat}**: {count:,} ({pct:.1f}%)")
            else:
                never.append(cat)
        lines.append("**Has:**")
        for h in has:
            lines.append(h)
        if never:
            lines.append("")
            lines.append(f"**Never has:** {', '.join(never)}")
        lines.append("")

    # Gender analysis
    if gender_counts:
        lines.append("## Gender Distribution (Inferred)")
        lines.append("")
        lines.append("Gender inferred using beard as anchor (beard = definitively male), "
                     "then classifying all other trait values by co-occurrence with bearded humans.")
        lines.append("")
        lines.append("| Gender | Count | Percentage |")
        lines.append("|--------|-------|------------|")
        total_humans = sum(gender_counts.values())
        for g in ["male", "female"]:
            c = gender_counts.get(g, 0)
            lines.append(f"| {g} | {c:,} | {c/total_humans*100:.1f}% |")
        lines.append("")

    if trait_classification:
        lines.append("## Trait Gender Classification")
        lines.append("")
        lines.append("Each trait value classified as male-only, female-only, or unisex "
                     "based on co-occurrence with beards.")
        lines.append("")

        for cls_label, cls_key in [("Male-Only", "male"), ("Female-Only", "female"), ("Unisex", "unisex")]:
            traits_in_cls = [(cat, v) for (cat, v), c in sorted(trait_classification.items())
                             if c == cls_key]
            if not traits_in_cls:
                continue
            lines.append(f"### {cls_label} Traits ({len(traits_in_cls)})")
            lines.append("")

            by_cat = defaultdict(list)
            for cat, v in traits_in_cls:
                by_cat[cat].append(v)

            for cat in ELEMENT_CATS:
                if cat in by_cat:
                    vals = sorted(by_cat[cat])
                    lines.append(f"- **{cat}**: {', '.join(vals)}")
            lines.append("")

    if gender_trait_values:
        lines.append("## Gender Trait Catalogs")
        lines.append("")
        for g in ["male", "female"]:
            lines.append(f"### {g.title()} Trait Values")
            lines.append("")
            for cat in ELEMENT_CATS:
                if cat in gender_trait_values[g]:
                    vals = gender_trait_values[g][cat]
                    total_cat = sum(vals.values())
                    lines.append(f"**{cat}** ({total_cat:,} {g}s with this category):")
                    lines.append("")
                    lines.append("| Value | Count |")
                    lines.append("|-------|-------|")
                    for v, c in vals.most_common():
                        lines.append(f"| {v} | {c:,} |")
                    lines.append("")

    # Category exclusion rules
    lines.append("## Category-Level Exclusion Rules")
    lines.append("")
    lines.append("Trait category pairs that NEVER co-occur across all 20,000 Meebits:")
    lines.append("")
    if exclusions:
        lines.append("| Category A | Category B | Count A | Count B | Confidence |")
        lines.append("|-----------|-----------|---------|---------|------------|")
        for ex in exclusions:
            lines.append(f"| {ex['categories'][0]} | {ex['categories'][1]} | {ex['count_a']:,} | {ex['count_b']:,} | {ex['confidence']} |")
    else:
        lines.append("No category-level exclusions found (all category pairs co-occur at least once).")
    lines.append("")

    # Value exclusion rules (top examples)
    lines.append("## Value-Level Exclusion Rules")
    lines.append("")
    lines.append(f"Found {len(value_exclusions):,} specific trait value pairs that never co-occur.")
    lines.append("Top examples (both values appear >= 10 times when the other category is present):")
    lines.append("")
    if value_exclusions:
        lines.append("| Trait A | Trait B | Count A | Count B | Confidence |")
        lines.append("|---------|---------|---------|---------|------------|")
        for ex in value_exclusions[:50]:
            lines.append(f"| {ex['trait_a']} | {ex['trait_b']} | {ex['count_a_when_b_present']:,} | {ex['count_b_when_a_present']:,} | {ex['confidence']} |")
    lines.append("")

    # Gender-aware exclusion rules
    if real_exclusions is not None:
        lines.append("## Gender-Aware Exclusion Analysis")
        lines.append("")
        lines.append(f"Of the {len(value_exclusions):,} value-level exclusions found in the total population:")
        lines.append(f"- **{len(real_exclusions):,}** are real constraints (hold within a single gender)")
        lines.append(f"- **{len(gender_artifacts):,}** are gender artifacts (traits from different genders)")
        lines.append("")

        lines.append("### Real Within-Gender Exclusions")
        lines.append("")
        lines.append("These trait pairs never co-occur even within the same gender — "
                     "these are genuine generation constraints, not gender effects.")
        lines.append("")

        if real_exclusions:
            # Group by gender
            for g in ["male", "female"]:
                g_excl = [e for e in real_exclusions if e["gender"] == g]
                if g_excl:
                    lines.append(f"#### {g.title()} ({len(g_excl)} exclusions)")
                    lines.append("")
                    lines.append("| Trait A | Trait B | Count A | Count B |")
                    lines.append("|---------|---------|---------|---------|")
                    for ex in g_excl[:40]:
                        lines.append(f"| {ex['trait_a']} | {ex['trait_b']} | {ex['count_a']:,} | {ex['count_b']:,} |")
                    if len(g_excl) > 40:
                        lines.append(f"| ... | ... | ... | ... |")
                        lines.append(f"| _{len(g_excl) - 40} more_ | | | |")
                    lines.append("")

        lines.append("### Gender Artifact Exclusions (Sample)")
        lines.append("")
        lines.append("These trait pairs never co-occur in the total population BUT "
                     "only because they belong to different genders. They are NOT real constraints.")
        lines.append("")
        if gender_artifacts:
            lines.append("| Trait A | Trait B | Count A | Count B | Reason |")
            lines.append("|---------|---------|---------|---------|--------|")
            for ex in gender_artifacts[:30]:
                lines.append(f"| {ex['trait_a']} | {ex['trait_b']} | {ex['count_a']:,} | {ex['count_b']:,} | {ex['reason']} |")
            if len(gender_artifacts) > 30:
                lines.append(f"| ... | ... | ... | ... | ... |")
                lines.append(f"| _{len(gender_artifacts) - 30} more_ | | | | |")
        lines.append("")

    # Gender-aware conditional probabilities
    if gender_cond_probs:
        lines.append("## Gender-Aware Conditional Probability Biases")
        lines.append("")
        lines.append("These biases are computed WITHIN each gender, removing gender as a confound.")
        lines.append("")

        for cp in gender_cond_probs:
            lines.append(f"### {cp['category_pair']} — {cp['gender']} (n={cp['total_records']:,})")
            lines.append("")
            if cp["biases"]:
                lines.append("| Combo | Observed | Expected | Ratio | Direction |")
                lines.append("|-------|----------|----------|-------|-----------|")
                for b in cp["biases"][:15]:
                    if "element" in b:
                        combo = f"{b['element']} + {b['color']}"
                    else:
                        combo = f"{b['trait_a']} + {b['trait_b']}"
                    lines.append(f"| {combo} | {b['observed']:,} | {b['expected']} | {b['ratio']} | {b['direction']} |")
            lines.append("")

    # Dependency rules
    lines.append("## Trait Dependency Rules")
    lines.append("")
    lines.append("Traits that always (or nearly always) imply the presence of another trait:")
    lines.append("")
    if dependencies:
        lines.append("| If Present | Then Present | Count | Both | Ratio | Strength |")
        lines.append("|-----------|-------------|-------|------|-------|----------|")
        for dep in sorted(dependencies, key=lambda x: -x["ratio"]):
            lines.append(f"| {dep['if_present']} | {dep['then_present']} | {dep['count_a']:,} | {dep['count_both']:,} | {dep['ratio']} | {dep['strength']} |")
    lines.append("")

    if value_dependencies:
        lines.append("### Value-Level Dependencies")
        lines.append("")
        lines.append("| If Trait | Then Trait | Count | Total | Ratio |")
        lines.append("|---------|-----------|-------|-------|-------|")
        for vd in value_dependencies:
            lines.append(f"| {vd['if_trait']} | {vd['then_trait']} | {vd['count']:,} | {vd['total']:,} | {vd['ratio']} |")
    lines.append("")

    # Conditional probability patterns
    lines.append("## Conditional Probability Biases")
    lines.append("")
    lines.append("Notable biases where trait combinations appear more or less often than random chance would suggest.")
    lines.append("Ratio > 2.0 = strongly overrepresented, ratio < 0.3 = strongly underrepresented.")
    lines.append("")

    for cp in conditional_probs:
        lines.append(f"### {cp['category_pair']} (n={cp['total_records']:,})")
        lines.append("")
        if cp["biases"]:
            lines.append("| Combo | Observed | Expected | Ratio | Direction |")
            lines.append("|-------|----------|----------|-------|-----------|")
            for b in cp["biases"][:15]:
                if "element" in b:
                    combo = f"{b['element']} + {b['color']}"
                else:
                    combo = f"{b['trait_a']} + {b['trait_b']}"
                lines.append(f"| {combo} | {b['observed']:,} | {b['expected']} | {b['ratio']} | {b['direction']} |")
        lines.append("")

    # Trait value catalogs
    lines.append("## Trait Value Catalogs")
    lines.append("")
    for cat in TRAIT_CATEGORIES:
        vals = Counter()
        for r in records:
            v = r.get(cat)
            if v is not None:
                vals[v] += 1
        if vals:
            lines.append(f"### {cat} ({sum(vals.values()):,} Meebits)")
            lines.append("")
            lines.append("| Value | Count |")
            lines.append("|-------|-------|")
            for v, c in vals.most_common():
                lines.append(f"| {v} | {c:,} |")
            lines.append("")

    # ===================================================================
    # v3 SECTIONS
    # ===================================================================

    # Per-type value pools
    if per_type_pools:
        lines.append("## Per-Type Trait Value Pools")
        lines.append("")
        lines.append("Which specific trait values are available for each type.")
        lines.append("")
        for t in sorted(per_type_pools.keys()):
            pool = per_type_pools[t]
            type_count = type_counts.get(t, 0)
            lines.append(f"### {t} ({type_count:,} Meebits)")
            lines.append("")
            for cat in TRAIT_CATEGORIES:
                if cat in pool and pool[cat]:
                    vals = pool[cat]
                    lines.append(f"**{cat}** ({sum(vals.values()):,}):")
                    lines.append("")
                    lines.append("| Value | Count | % of Type |")
                    lines.append("|-------|-------|-----------|")
                    for v, c in sorted(vals.items(), key=lambda x: -x[1]):
                        pct = c / type_count * 100 if type_count > 0 else 0
                        lines.append(f"| {v} | {c:,} | {pct:.1f}% |")
                    lines.append("")
            lines.append("---")
            lines.append("")

    # Type-exclusive values
    if type_exclusive:
        lines.append("## Type-Exclusive Trait Values")
        lines.append("")
        lines.append("Trait values that are NOT available across all 7 types.")
        lines.append("")

        # Group by category
        by_cat = defaultdict(list)
        for item in type_exclusive:
            by_cat[item["category"]].append(item)

        for cat in sorted(by_cat.keys()):
            items = by_cat[cat]
            # Show values exclusive to 1 type first, then 2, etc.
            items.sort(key=lambda x: (x["num_types"], x["value"]))
            lines.append(f"### {cat}")
            lines.append("")
            lines.append("| Value | Available Types | # Types |")
            lines.append("|-------|----------------|---------|")
            for item in items:
                types_str = ", ".join(item["available_types"])
                lines.append(f"| {item['value']} | {types_str} | {item['num_types']} |")
            lines.append("")

    # Color-element mappings
    if color_mappings:
        lines.append("## Color-Element Mandatory Mappings")
        lines.append("")
        lines.append("For each element value, whether its corresponding color is always present, "
                     "never present, or sometimes present.")
        lines.append("")

        for pair_key in sorted(color_mappings.keys()):
            mappings = color_mappings[pair_key]
            lines.append(f"### {pair_key}")
            lines.append("")
            lines.append("| Element Value | Total | With Color | Color Rate | Classification |")
            lines.append("|--------------|-------|------------|------------|----------------|")
            for m in mappings:
                lines.append(f"| {m['value']} | {m['total']:,} | {m['with_color']:,} | "
                           f"{m['color_rate']*100:.1f}% | {m['classification']} |")
            lines.append("")

    # Per-type exclusion rules
    if per_type_excl:
        lines.append("## Per-Type Value Exclusion Rules")
        lines.append("")
        lines.append("Value pairs that never co-occur within each type (computed separately per type).")
        lines.append("")

        for t in sorted(per_type_excl.keys()):
            excls = per_type_excl[t]
            lines.append(f"### {t} ({len(excls)} exclusions)")
            lines.append("")
            if excls:
                lines.append("| Trait A | Trait B | Count A | Count B |")
                lines.append("|---------|---------|---------|---------|")
                for ex in excls[:50]:
                    lines.append(f"| {ex['trait_a']} | {ex['trait_b']} | "
                               f"{ex['count_a']:,} | {ex['count_b']:,} |")
                if len(excls) > 50:
                    lines.append(f"| ... | ... | ... | ... |")
                    lines.append(f"| _{len(excls) - 50} more_ | | | |")
            lines.append("")

    # Near-exclusion rules
    if near_excl:
        lines.append("## Near-Exclusion Rules (Soft Constraints)")
        lines.append("")
        lines.append(f"Found {len(near_excl)} trait pairs that almost never co-occur "
                     "(observed/expected < 0.1, with 1-5 actual occurrences).")
        lines.append("")
        if near_excl:
            lines.append("| Trait A | Trait B | Observed | Expected | Ratio |")
            lines.append("|---------|---------|----------|----------|-------|")
            for ex in near_excl[:60]:
                lines.append(f"| {ex['trait_a']} | {ex['trait_b']} | "
                           f"{ex['observed']} | {ex['expected']} | {ex['ratio']:.4f} |")
            if len(near_excl) > 60:
                lines.append(f"| ... | ... | ... | ... | ... |")
                lines.append(f"| _{len(near_excl) - 60} more_ | | | | |")
        lines.append("")

    # Deterministic rules
    if deterministic:
        lines.append("## Deterministic Rules (Perfect Correlations)")
        lines.append("")
        lines.append("Cases where one trait value determines another (95%+ correlation).")
        lines.append("")
        # Separate 100% from near-100%
        perfect = [d for d in deterministic if d["type"] == "deterministic"]
        near_perfect = [d for d in deterministic if d["type"] == "near_deterministic"]

        if perfect:
            lines.append(f"### 100% Deterministic ({len(perfect)} rules)")
            lines.append("")
            lines.append("| If Trait | Then Trait | Count | Total |")
            lines.append("|---------|-----------|-------|-------|")
            for d in perfect[:80]:
                lines.append(f"| {d['if_trait']} | {d['then_trait']} | "
                           f"{d['count']:,} | {d['total']:,} |")
            if len(perfect) > 80:
                lines.append(f"| ... | ... | ... | ... |")
                lines.append(f"| _{len(perfect) - 80} more_ | | | |")
            lines.append("")

        if near_perfect:
            lines.append(f"### Near-Deterministic 95-99% ({len(near_perfect)} rules)")
            lines.append("")
            lines.append("| If Trait | Then Trait | Count | Total | Ratio |")
            lines.append("|---------|-----------|-------|-------|-------|")
            for d in near_perfect[:40]:
                lines.append(f"| {d['if_trait']} | {d['then_trait']} | "
                           f"{d['count']:,} | {d['total']:,} | {d['ratio']} |")
            if len(near_perfect) > 40:
                lines.append(f"| ... | ... | ... | ... | ... |")
                lines.append(f"| _{len(near_perfect) - 40} more_ | | | | |")
            lines.append("")

    # Jersey number analysis
    if jersey_analysis:
        lines.append("## Jersey Number Analysis")
        lines.append("")
        jn = jersey_analysis
        lines.append(f"Total with jersey number: {jn['total_with_jersey_number']:,}")
        lines.append("")

        bid = jn.get("bidirectional_check", {})
        lines.append(f"**Bidirectional mapping:** {'YES' if bid.get('is_bidirectional') else 'NO'}")
        lines.append(f"- Jersey-named shirts without number: {bid.get('jersey_shirts_without_number', '?')}")
        lines.append(f"- Non-jersey shirts with number: {bid.get('non_jersey_shirts_with_number', '?')}")
        lines.append("")

        lines.append("### Number Distribution")
        lines.append("")
        lines.append("| Number | Count |")
        lines.append("|--------|-------|")
        for num, cnt in sorted(jn.get("number_distribution", {}).items()):
            lines.append(f"| {num} | {cnt:,} |")
        lines.append("")

        lines.append("### Shirt Types with Jersey Numbers")
        lines.append("")
        lines.append("| Shirt | Count |")
        lines.append("|-------|-------|")
        for s, cnt in jn.get("shirt_distribution_with_jn", {}).items():
            lines.append(f"| {s} | {cnt:,} |")
        lines.append("")

        if jn.get("by_type"):
            lines.append("### By Type")
            lines.append("")
            lines.append("| Type | Count | Shirts |")
            lines.append("|------|-------|--------|")
            for t, info in sorted(jn["by_type"].items()):
                shirts = ", ".join(f"{s}({c})" for s, c in info["shirts"].items())
                lines.append(f"| {t} | {info['count']:,} | {shirts} |")
            lines.append("")

    # Tattoo structure analysis
    if tattoo_analysis:
        lines.append("## Tattoo Code Structure Analysis")
        lines.append("")
        ta = tattoo_analysis
        lines.append(f"Total tattooed Meebits: {ta['total_tattooed']:,}")
        lines.append("")

        fam = ta.get("families", {})
        cs = fam.get("comma_separated", {})
        ss = fam.get("single_segment", {})

        lines.append("### Two Tattoo Families")
        lines.append("")
        lines.append("| Family | Count | Key Feature | Alphabet |")
        lines.append("|--------|-------|-------------|----------|")
        lines.append(f"| Comma-separated (X,X) | {cs.get('count', 0):,} | "
                    f"{cs.get('halves_identical_pct', 0)}% halves identical | "
                    f"{', '.join(cs.get('alphabet', []))} |")
        lines.append(f"| Single-segment | {ss.get('count', 0):,} | "
                    f"{ss.get('palindromic_pct', 0)}% palindromic | "
                    f"{', '.join(ss.get('alphabet', []))} |")
        lines.append("")

        if ta.get("by_type"):
            lines.append("### Tattoos by Type")
            lines.append("")
            lines.append("| Type | Count |")
            lines.append("|------|-------|")
            for t, cnt in sorted(ta["by_type"].items(), key=lambda x: -x[1]):
                lines.append(f"| {t} | {cnt:,} |")
            lines.append("")

        if ta.get("by_gender_and_family"):
            lines.append("### Tattoo Families by Gender")
            lines.append("")
            lines.append("| Gender | Comma-separated | Single-segment |")
            lines.append("|--------|----------------|----------------|")
            for g in ["male", "female"]:
                if g in ta["by_gender_and_family"]:
                    gf = ta["by_gender_and_family"][g]
                    lines.append(f"| {g} | {gf.get('comma_separated', 0):,} | "
                               f"{gf.get('single_segment', 0):,} |")
            lines.append("")

    # Comprehensive pairwise biases
    if comp_biases:
        lines.append("## Comprehensive Pairwise Statistical Biases")
        lines.append("")
        lines.append(f"All {len(comp_biases)} element category pairs with statistically "
                     "significant biases (p < 0.001).")
        lines.append("")

        for cp in comp_biases:
            lines.append(f"### {cp['category_pair']} (n={cp['total_records']:,}, "
                        f"{cp['num_biases']} biases)")
            lines.append("")
            if cp["biases"]:
                lines.append("| Trait A | Trait B | Observed | Expected | Ratio | Direction |")
                lines.append("|---------|---------|----------|----------|-------|-----------|")
                for b in cp["biases"][:15]:
                    lines.append(f"| {b['trait_a']} | {b['trait_b']} | "
                               f"{b['observed']:,} | {b['expected']} | "
                               f"{b['ratio']} | {b['direction']} |")
                if len(cp["biases"]) > 15:
                    lines.append(f"| ... | ... | ... | ... | ... | ... |")
                    lines.append(f"| _{cp['num_biases'] - 15} more_ | | | | | |")
            lines.append("")

    # Three-way interactions
    if three_way:
        lines.append("## Three-Way Trait Interactions")
        lines.append("")
        lines.append(f"Found {len(three_way)} cases where a pairwise bias changes significantly "
                     "when stratified by a third trait (spread >= 3x).")
        lines.append("")

        for tw in three_way[:20]:
            lines.append(f"### {tw['pair']} stratified by {tw['stratified_by']} "
                        f"(overall ratio={tw['overall_ratio']}, spread={tw['spread']}x)")
            lines.append("")
            lines.append("| Stratum | Observed | Expected | Ratio | N |")
            lines.append("|---------|----------|----------|-------|---|")
            for s in tw["strata"][:8]:
                lines.append(f"| {s['stratum']} | {s['observed']} | {s['expected']} | "
                           f"{s['ratio']} | {s['n']:,} |")
            lines.append("")

    return "\n".join(lines)


def main():
    print("=" * 60)
    print("Meebits Metadata Aggregation & Rule Derivation (v3 - Comprehensive)")
    print("=" * 60)

    # Step 1: Load records (from raw files or existing database)
    if os.path.isdir(INPUT_DIR):
        print("\n[1/18] Loading all 20,000 Meebit files from raw metadata...")
        records = load_all_meebits()
    else:
        print(f"\n[1/18] Raw metadata not found. Loading from {DATABASE_PATH}...")
        records = load_from_database()
    print(f"  Loaded {len(records)} records")

    # Step 2: Infer gender
    print("\n[2/18] Inferring gender for Human meebits...")
    records, gender_counts, trait_classification, gender_trait_values = infer_gender(records)
    for g in ["male", "female"]:
        print(f"  {g}: {gender_counts.get(g, 0):,}")
    male_traits = sum(1 for v in trait_classification.values() if v == "male")
    female_traits = sum(1 for v in trait_classification.values() if v == "female")
    unisex_traits = sum(1 for v in trait_classification.values() if v == "unisex")
    print(f"  Trait values: {male_traits} male-only, {female_traits} female-only, {unisex_traits} unisex")

    # Step 3: Export database (now with gender)
    print("\n[3/18] Exporting unified database with gender...")
    export_database(records)

    # Step 4: Type-level rules
    print("\n[4/18] Analyzing type-level rules...")
    type_traits, type_counts = analyze_type_level_rules(records)
    for t in sorted(type_counts.keys()):
        cats = [c for c in TRAIT_CATEGORIES if type_traits[t].get(c, 0) > 0]
        print(f"  {t}: {type_counts[t]} Meebits, {len(cats)} trait categories")

    # Step 5: Per-type value pools (NEW)
    print("\n[5/18] Analyzing per-type trait value pools...")
    per_type_pools = analyze_per_type_value_pools(records)
    for t in sorted(per_type_pools.keys()):
        n_cats = len(per_type_pools[t])
        n_vals = sum(len(v) for v in per_type_pools[t].values())
        print(f"  {t}: {n_cats} categories, {n_vals} unique values")

    # Step 6: Type-exclusive values (NEW)
    print("\n[6/18] Analyzing type-exclusive trait values...")
    type_exclusive = analyze_type_exclusive_values(per_type_pools)
    single_type = sum(1 for x in type_exclusive if x["num_types"] == 1)
    print(f"  Found {len(type_exclusive)} non-universal values, {single_type} exclusive to 1 type")

    # Step 7: Color-element mappings (NEW)
    print("\n[7/18] Analyzing color-element mandatory mappings...")
    color_mappings = analyze_color_element_mappings(records)
    for pair_key, mappings in color_mappings.items():
        always = sum(1 for m in mappings if m["classification"] == "always_has_color")
        never = sum(1 for m in mappings if m["classification"] == "never_has_color")
        sometimes = sum(1 for m in mappings if m["classification"] == "sometimes_has_color")
        print(f"  {pair_key}: {always} always, {never} never, {sometimes} sometimes")

    # Step 8: Exclusion rules (all-population)
    print("\n[8/18] Analyzing exclusion rules (all population)...")
    exclusions, cooccurrence, category_counts = analyze_exclusion_rules(records)
    print(f"  Found {len(exclusions)} category-level exclusion rules")

    value_exclusions = analyze_value_exclusions(records)
    print(f"  Found {len(value_exclusions)} value-level exclusion rules (all population)")

    # Step 9: Gender-aware exclusion rules
    print("\n[9/18] Analyzing gender-aware exclusion rules...")
    real_exclusions, gender_artifacts = analyze_gender_exclusions(records)
    print(f"  Found {len(real_exclusions)} real within-gender exclusions")
    print(f"  Found {len(gender_artifacts)} gender artifact exclusions")

    # Step 10: Per-type exclusion rules (NEW)
    print("\n[10/18] Analyzing per-type value exclusion rules...")
    per_type_excl = analyze_per_type_exclusions(records)
    for t, excls in per_type_excl.items():
        print(f"  {t}: {len(excls)} exclusions")

    # Step 11: Near-exclusion rules (NEW)
    print("\n[11/18] Analyzing near-exclusion rules (soft constraints)...")
    near_excl = analyze_near_exclusions(records)
    print(f"  Found {len(near_excl)} near-exclusion rules")

    # Step 12: Dependency rules
    print("\n[12/18] Analyzing dependency rules...")
    dependencies, value_dependencies = analyze_dependency_rules(records)
    print(f"  Found {len(dependencies)} category dependency rules")
    print(f"  Found {len(value_dependencies)} value dependency rules")

    # Step 13: Deterministic rules (NEW)
    print("\n[13/18] Analyzing deterministic rules (perfect correlations)...")
    deterministic = analyze_deterministic_rules(records)
    perfect = sum(1 for d in deterministic if d["type"] == "deterministic")
    near = sum(1 for d in deterministic if d["type"] == "near_deterministic")
    print(f"  Found {perfect} deterministic + {near} near-deterministic rules")

    # Step 14: Jersey number analysis (NEW)
    print("\n[14/18] Analyzing jersey number patterns...")
    jersey_analysis = analyze_jersey_number_rules(records)
    bid = jersey_analysis["bidirectional_check"]
    print(f"  Total with jersey number: {jersey_analysis['total_with_jersey_number']}")
    print(f"  Bidirectional mapping: {bid['is_bidirectional']}")

    # Step 15: Tattoo structure analysis (NEW)
    print("\n[15/18] Analyzing tattoo code structure...")
    tattoo_analysis = analyze_tattoo_structure(records)
    fam = tattoo_analysis["families"]
    print(f"  Comma-separated: {fam['comma_separated']['count']}, "
          f"Single-segment: {fam['single_segment']['count']}")
    print(f"  Comma alphabet: {fam['comma_separated']['alphabet']}")
    print(f"  Single alphabet: {fam['single_segment']['alphabet']}")

    # Step 16: Conditional probabilities (existing)
    print("\n[16/18] Analyzing conditional probability patterns...")
    conditional_probs = analyze_conditional_probabilities(records)
    total_biases = sum(len(cp["biases"]) for cp in conditional_probs)
    print(f"  Found {total_biases} all-population biases")

    gender_cond_probs = analyze_gender_conditional_probs(records)
    gender_biases = sum(len(cp["biases"]) for cp in gender_cond_probs)
    print(f"  Found {gender_biases} within-gender biases across {len(gender_cond_probs)} category pairs")

    # Step 17: Comprehensive all-pairs biases (NEW)
    print("\n[17/18] Analyzing comprehensive pairwise biases (all 55 pairs)...")
    comp_biases = analyze_comprehensive_biases(records)
    total_comp = sum(cp["num_biases"] for cp in comp_biases)
    print(f"  Found {total_comp} significant biases across {len(comp_biases)} category pairs")

    # Step 18: Three-way interactions (NEW)
    print("\n[18/18] Analyzing three-way trait interactions...")
    three_way = analyze_three_way_interactions(records, comp_biases)
    print(f"  Found {len(three_way)} three-way interactions")

    # Build and export rules
    print("\nExporting rules...")
    rules = build_rules_json(
        type_traits, type_counts, exclusions, value_exclusions,
        dependencies, value_dependencies, conditional_probs,
        gender_counts=gender_counts,
        trait_classification=trait_classification,
        gender_trait_values=gender_trait_values,
        real_exclusions=real_exclusions,
        gender_artifacts=gender_artifacts,
        gender_cond_probs=gender_cond_probs,
        per_type_pools=per_type_pools,
        type_exclusive=type_exclusive,
        color_mappings=color_mappings,
        per_type_excl=per_type_excl,
        jersey_analysis=jersey_analysis,
        tattoo_analysis=tattoo_analysis,
        near_excl=near_excl,
        comp_biases=comp_biases,
        three_way=three_way,
        deterministic=deterministic,
    )
    rules_path = os.path.join(OUTPUT_DIR, "meebits_rules.json")
    with open(rules_path, 'w') as f:
        json.dump(rules, f, indent=2)
    print(f"  Wrote {rules_path}")

    report = build_report(
        records, type_traits, type_counts, exclusions, value_exclusions,
        dependencies, value_dependencies, conditional_probs,
        cooccurrence, category_counts,
        gender_counts=gender_counts,
        trait_classification=trait_classification,
        gender_trait_values=gender_trait_values,
        real_exclusions=real_exclusions,
        gender_artifacts=gender_artifacts,
        gender_cond_probs=gender_cond_probs,
        per_type_pools=per_type_pools,
        type_exclusive=type_exclusive,
        color_mappings=color_mappings,
        per_type_excl=per_type_excl,
        jersey_analysis=jersey_analysis,
        tattoo_analysis=tattoo_analysis,
        near_excl=near_excl,
        comp_biases=comp_biases,
        three_way=three_way,
        deterministic=deterministic,
    )
    report_path = os.path.join(OUTPUT_DIR, "meebits_rules_report.md")
    with open(report_path, 'w') as f:
        f.write(report)
    print(f"  Wrote {report_path}")

    print("\nDone!")


if __name__ == "__main__":
    main()
