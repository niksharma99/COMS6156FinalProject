"""Scoring helpers for evaluating model answers.

Two signals per open-ended item:
  1. Semantic similarity between the candidate answer and the reference
     `correct_answer`, computed from sentence-transformer embeddings.
  2. LLM-as-judge rubric score (factuality / completeness / advice_quality,
     each 1-5) using the Anthropic API.

MC items are graded by exact-match on the answer letter.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, asdict
from typing import Optional

import numpy as np


# ---------- MC grading -------------------------------------------------------

_LETTER_RE = re.compile(r"\b([A-D])\b")


def extract_mc_letter(text: str) -> Optional[str]:
    """Pull the first standalone A/B/C/D from a model answer."""
    m = _LETTER_RE.search(text.strip().upper())
    return m.group(1) if m else None


def grade_mc(candidate: str, correct_letter: str) -> dict:
    picked = extract_mc_letter(candidate)
    return {"picked": picked, "correct": correct_letter, "is_correct": picked == correct_letter}


# ---------- Embedding similarity --------------------------------------------

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    a = np.asarray(a, dtype=np.float32)
    b = np.asarray(b, dtype=np.float32)
    denom = (np.linalg.norm(a) * np.linalg.norm(b)) or 1.0
    return float(np.dot(a, b) / denom)


# ---------- LLM judge --------------------------------------------------------

JUDGE_SYSTEM = """You are a careful grader for personal-finance question answering.
You will be given a question, a reference answer, and a candidate answer.
Score the candidate on three 1-5 axes:
  - factuality: are the specific financial claims correct and consistent with the reference?
  - completeness: does it cover the main points the reference hits?
  - advice_quality: is the advice actionable, well-framed, and free of obvious misconceptions?
Penalize confident misinformation. Reward nuance on tradeoffs.
Respond with ONLY a compact JSON object:
{"factuality": int, "completeness": int, "advice_quality": int, "rationale": "one short sentence"}
"""

JUDGE_USER_TEMPLATE = """Question:
{question}

Reference answer:
{reference}

Candidate answer:
{candidate}
"""


@dataclass
class JudgeScore:
    factuality: int
    completeness: int
    advice_quality: int
    rationale: str

    @property
    def mean(self) -> float:
        return (self.factuality + self.completeness + self.advice_quality) / 3.0

    def to_dict(self) -> dict:
        d = asdict(self)
        d["mean"] = self.mean
        return d


def judge_with_claude(
    question: str,
    reference: str,
    candidate: str,
    model: str = "claude-sonnet-4-6",
    client=None,
) -> JudgeScore:
    """Grade an open-ended answer using Claude.

    Falls back gracefully if the response is not parseable JSON — returns
    zeros with the raw text as rationale so bad judgments are visible, not
    silently discarded.
    """
    if client is None:
        import anthropic
        client = anthropic.Anthropic()

    resp = client.messages.create(
        model=model,
        max_tokens=400,
        system=JUDGE_SYSTEM,
        messages=[{
            "role": "user",
            "content": JUDGE_USER_TEMPLATE.format(
                question=question, reference=reference, candidate=candidate,
            ),
        }],
    )
    text = resp.content[0].text.strip()
    # Strip any fence the model may have added
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    try:
        data = json.loads(text)
        return JudgeScore(
            factuality=int(data["factuality"]),
            completeness=int(data["completeness"]),
            advice_quality=int(data["advice_quality"]),
            rationale=str(data.get("rationale", ""))[:300],
        )
    except Exception:
        return JudgeScore(0, 0, 0, f"UNPARSEABLE: {text[:200]}")
