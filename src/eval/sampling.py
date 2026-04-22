"""Stratified sampling helpers for picking a small evaluation subset.

We want representative coverage across the six topic files without blowing up
runtime. `sample_from_dataset` returns N items from a given dataset directory
(e.g. standard_questions/), distributing picks across topics as evenly as
possible.
"""
from __future__ import annotations

import json
import random
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DATASET_DIR = REPO_ROOT / "dataset"

TOPICS = [
    "budgeting",
    "credit_and_debt",
    "insurance",
    "investing",
    "retirement",
    "tax",
]


def load_dataset(name: str) -> dict[str, list[dict]]:
    """Load all topic files for a dataset (e.g. 'standard_questions')."""
    base = DATASET_DIR / name
    return {t: json.loads((base / f"{t}.json").read_text()) for t in TOPICS}


def sample_from_dataset(name: str, n: int, seed: int = 7) -> list[dict]:
    """Stratified sample of n items across the six topic files.

    Spreads picks as evenly as possible; each item is annotated with its
    dataset and topic so downstream scoring can report per-topic breakdowns.
    """
    rng = random.Random(seed)
    data = load_dataset(name)

    # Base allocation + remainder distributed over topics
    base, rem = divmod(n, len(TOPICS))
    order = TOPICS[:]
    rng.shuffle(order)
    allocation = {t: base + (1 if i < rem else 0) for i, t in enumerate(order)}

    picked: list[dict] = []
    for topic in TOPICS:
        pool = data[topic][:]
        rng.shuffle(pool)
        for item in pool[: allocation[topic]]:
            picked.append({**item, "_dataset": name, "_topic": topic})
    return picked


if __name__ == "__main__":
    for ds in ("standard_questions", "open_ended_hard", "reddit_questions"):
        rows = sample_from_dataset(ds, 5)
        print(f"{ds}: {len(rows)} items")
        for r in rows:
            print(f"  [{r['_topic']}] {r['id']} — {r['question'][:70]}")
