# `src/eval/` — shared evaluation helpers

Two small Python modules that both notebooks import. Kept dependency-light so they can run in Colab without extra installs beyond `requirements.txt`.

```
eval/
├── sampling.py    # Stratified per-topic sampler over dataset/
├── metrics.py     # MC grader · cosine · LLM-as-judge rubric
└── __init__.py
```

## `sampling.py`

```python
from eval.sampling import sample_from_dataset

# 5 questions per dataset, evenly distributed across 6 topics, seeded.
rows = sample_from_dataset("standard_questions", n=5, seed=7)
# Each row is the original question dict plus _dataset and _topic fields.
```

Used by both notebooks when `MODE = "sample"` to pick a stratified subset (default 5 per dataset = 15 items). The same `seed=7` is used in both notebooks so the baseline and RAG runs evaluate the exact same questions.

When `MODE = "all"`, the notebook bypasses this and loads every JSON file in `dataset/<dataset>/<topic>.json` directly — see the build-the-eval-set cell in either notebook.

## `metrics.py`

Three scoring helpers used in §6a / §6b / §6c of both notebooks.

### `grade_mc(candidate, reference) -> dict`

Exact letter match for multiple-choice. Returns `{"is_correct": bool, "picked": "A"|"B"|"C"|"D"|None}`. Uses `extract_mc_letter` to find the first standalone capital letter in the candidate string.

### `cosine_similarity(a, b) -> float`

Dot product of two normalized embedding vectors. Used with `BAAI/bge-small-en-v1.5` (loaded in the notebooks via `sentence-transformers`) to compute answer-vs-reference similarity for open-ended items.

### `judge_with_claude(question, reference, candidate, client=None) -> JudgeScore`

Sends the (question, reference, candidate) triple to `claude-sonnet-4-6` with a strict 1–5 rubric across `factuality`, `completeness`, `advice_quality`, plus a one-sentence `rationale`. Returns a `JudgeScore` dataclass with a `.to_dict()` method that includes the mean.

Defaults:
- Model: `claude-sonnet-4-6` (override with `model=...`)
- `max_tokens`: 300
- Returns zeros + a `parse error` rationale on JSON parse failure rather than raising — keeps long runs alive.

The judge system prompt and JSON schema live at the top of `metrics.py`; rubric definitions are documented inline.

## How the notebooks use these

```python
from eval.sampling import sample_from_dataset
from eval.metrics import grade_mc, cosine_similarity, judge_with_claude, extract_mc_letter
```

Both notebooks insert `src/` onto `sys.path` in their setup cell so `from eval.…` works without an editable install. See [`../notebooks/README.md`](../notebooks/README.md) for the full setup story.
