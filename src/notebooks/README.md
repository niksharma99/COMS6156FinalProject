# `src/notebooks/` — Evaluation notebooks & replication guide

This folder holds the two Jupyter notebooks that produce every number reported in the writeup, plus a JSON dump of the latest run for reproducibility.

```
notebooks/
├── baseline_eval.ipynb        # Qwen2.5-3B-Instruct, no retrieval — the alternative system
├── rag_eval.ipynb             # Claude (claude-sonnet-4-6) + ChromaDB + LLM-judge — FinVerify
└── results/
    ├── baseline_Qwen2.5-3B-Instruct/  # 156-item baseline output
    │   ├── all.json                   # full run, one row per question
    │   ├── <dataset>.json             # sharded by dataset
    │   ├── by_topic/<dataset>__<topic>.json
    │   └── type_{multiple_choice, open_ended}.json
    ├── baseline_Qwen2.5-3B-Instruct_all.json    # checkpoint file (same content as all.json)
    ├── rag_claude-sonnet-4-6/         # 156-item RAG output (same shape)
    └── rag_claude-sonnet-4-6_all.json
```

Both notebooks evaluate against the **156-item dataset in [`../../dataset/`](../../dataset/)** (42 standard MC + open-ended, 42 hard open-ended, 72 Reddit-sourced questions). The two notebooks are designed to be run end-to-end and produce JSON files with identical schemas so they can be diffed.

---

## What the alternative system is

The repository ships **the alternative system as a first-class artifact, not a link**: [`baseline_eval.ipynb`](baseline_eval.ipynb) runs `Qwen/Qwen2.5-3B-Instruct` (open-weights, ~3B parameters, no retrieval) on the same dataset using the same scoring pipeline. The RAG result claims in the writeup are computed against this baseline's `results/baseline_Qwen2.5-3B-Instruct/all.json`, which is committed to the repo.

This is a deliberate choice over a leaderboard URL: a single repo with both systems' outputs makes per-item diffing (e.g. "does the new prompt fix this specific Reddit question?") trivial and reproducible.

---

## How to replicate the evaluation

You can run the notebooks either in **Google Colab** (recommended for the RAG notebook — Claude is hosted) or **locally** (recommended for the baseline notebook — Qwen runs faster on a local M-series Mac with MPS than on Colab CPU).

### Option A — Colab (zero local setup)

Both notebooks open with a Colab-aware setup cell that:
1. Detects `google.colab`,
2. Clones this repo (`git clone --depth 1 --branch add-evaluation-dataset …`) into `/content/`,
3. `chdir`s into the clone, and
4. Loads `ANTHROPIC_API_KEY` from a `.env` file or shell env.

In Colab:
1. Open `baseline_eval.ipynb` or `rag_eval.ipynb` directly from the GitHub UI ("Open in Colab" extension or the `colab.research.google.com/github/…` URL).
2. **Runtime → Change runtime type → GPU (T4)** for the baseline notebook (Qwen-3B inference). Not needed for `rag_eval.ipynb`.
3. Set `ANTHROPIC_API_KEY` in Colab Secrets *or* paste `os.environ["ANTHROPIC_API_KEY"] = "sk-ant-..."` into a cell before the setup cell.
4. **Runtime → Run all**.

### Option B — Local

```bash
git clone https://github.com/niksharma99/COMS6156FinalProject.git
cd COMS6156FinalProject
pip install -r requirements.txt
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

jupyter lab src/notebooks/
```

Open the notebook and run top-to-bottom. The setup cell finds the repo root automatically by walking up to find `dataset/`.

System requirements:
- Python 3.10+ (3.12 tested)
- ~8 GB RAM, ~6 GB disk (Qwen weights + KB sources + Chroma)
- Optional: Apple Silicon MPS or CUDA GPU for the baseline notebook (CPU works but slow — full 156-item run is ~15 min on M1, hours on CPU)
- An Anthropic API key for `rag_eval.ipynb` (~$2–4 for a full 156-item run including the judge)

---

## Reproducing the published numbers

The committed `results/` JSONs are the raw output of the most recent run. To regenerate from scratch:

### 1. Baseline (`baseline_eval.ipynb`)

Set the eval-set mode and run all cells:

```python
MODE = "all"   # "all" = 156 items (every question); "sample" = stratified 5/dataset = 15
N_PER_DATASET = 5
```

The run loop **checkpoints to disk after every item**. If the kernel restarts mid-run, completed `id`s are skipped on the next run. Section 8 then shards the output:

- `results/baseline_Qwen2.5-3B-Instruct/all.json` — full run
- `results/baseline_Qwen2.5-3B-Instruct/<dataset>.json` — per dataset
- `results/baseline_Qwen2.5-3B-Instruct/by_topic/<dataset>__<topic>.json` — per (dataset, topic)
- `results/baseline_Qwen2.5-3B-Instruct/type_{multiple_choice,open_ended}.json` — per type

Sections 6a/6b/6c add **`mc_correct`**, **`embed_cosine`**, and **`judge`** in-place to the in-memory `results` list, so re-run section 8 after them to persist the scored output.

### 2. RAG (`rag_eval.ipynb`)

Same `MODE = "all"` toggle. The KB-build cell (§1b) runs `../knowledge_base/ingest.py` automatically if `vector_store/` is empty — no manual step required.

The run loop has the same resume-safe checkpointing as the baseline plus an exponential-backoff retry loop (`call_claude_with_retry`) for transient `RateLimitError` / `APIConnectionError` / `APIStatusError`. Set `FORCE_REDO = True` to wipe the checkpoint and regenerate everything (e.g. after changing the system prompt).

Output goes to `results/rag_claude-sonnet-4-6/…` with the identical sharded layout.

### 3. Compare

The summary cell at the bottom of `rag_eval.ipynb` reads the latest baseline shards from `results/baseline_*/all.json` and prints a side-by-side table grouped by dataset.

For richer per-topic / per-difficulty / per-axis breakdowns, the demo site ([`../demo/`](../demo/)) reads these same JSONs at build time. Open the **Comparison** and **Metrics** tabs to see them visualized.

---

## Pipeline contract (what each row in `all.json` looks like)

```jsonc
{
  "id": "ret-001",
  "dataset": "standard_questions",
  "topic": "retirement",
  "type": "multiple_choice",            // "multiple_choice" | "open_ended"
  "difficulty": "intermediate",
  "question": "...",
  "reference": "D",                     // letter for MC; full reference text for OE
  "candidate": "D",                     // model output

  // Added by §6a (MC items only)
  "mc_correct": true,
  "mc_picked":  "D",

  // Added by §6b (OE items only)
  "embed_cosine": 0.92,                 // BGE-small cosine vs reference

  // Added by §6c (OE items only)
  "judge": {
    "factuality": 5, "completeness": 4, "advice_quality": 5,
    "rationale": "...", "mean": 4.67
  },

  // RAG only — added by §6d
  "n_citations": 3,
  "citation_coverage": 0.6,             // unique [n] cited / k retrieved
  "retrieved": [
    {"title": "...", "publisher": "IRS", "source_slug": "irs_pub_590a", "distance": 0.18}
  ],

  "latency_sec": 2.4
}
```

---

## Metrics

| Metric | Where computed | Range | Notes |
|---|---|---|---|
| **MC accuracy** | §6a, [`../eval/metrics.py:grade_mc`](../eval/metrics.py) | 0–1 | Exact letter match (A/B/C/D). MC items only exist in `standard_questions`. |
| **Embedding cosine** | §6b, `BAAI/bge-small-en-v1.5` | 0–1 | Answer ↔ reference. Mostly a topic-overlap signal; not a great factuality proxy on its own. |
| **LLM judge** | §6c, [`../eval/metrics.py:judge_with_claude`](../eval/metrics.py) | 1–5 | Three axes (`factuality`, `completeness`, `advice_quality`) plus their mean, scored by `claude-sonnet-4-6` against the reference answer. |
| **Citation coverage** | §6d (RAG only) | 0–1 | `unique_indices_cited_in_answer / k_retrieved`. Detects "retrieval happened but wasn't used". |
| **Latency** | wall clock per item | sec | Captured for both pipelines. |

The judge prompt and rubric are in [`../eval/metrics.py`](../eval/metrics.py); the model is configurable but defaults to `claude-sonnet-4-6` for self-consistency with the RAG generator.

---

## Datasets used

All three are in [`../../dataset/`](../../dataset/) and are loaded directly from JSON — no Hugging Face download at run time.

| Set | Size | Source | Grading |
|---|---|---|---|
| `standard_questions/` | 42 (30 MC + 12 OE) | Hand-authored against IRS / CFPB / SEC / SSA / HealthCare.gov | MC: exact letter. OE: cosine + judge. |
| `open_ended_hard/` | 42 (all OE) | Hand-authored, targets nuance / tradeoffs / misconceptions | Cosine + judge. |
| `reddit_questions/` | 72 (all OE) | Sampled from [`PersonalFinance_v2`](https://huggingface.co/datasets/Akhil-Theerthala/PersonalFinance_v2) on HF, mapped to the same six topics | Cosine + judge against the source response. |

Stratified sampling across topics (when `MODE = "sample"`) is implemented in [`../eval/sampling.py`](../eval/sampling.py); fixed `seed=7` keeps the baseline and RAG samples identical.

For external benchmarks the dataset cross-references but does not duplicate, see [`../../dataset/README.md`](../../dataset/README.md) (FinanceBench, FinQA).

---

## Re-running just a slice

To re-run only specific items without restarting from scratch:

```python
# In rag_eval.ipynb, after the load-existing-results cell:
ids_to_redo = {"tax-r-009", "ret-002", "ins-r-010"}
results = [r for r in results if r["id"] not in ids_to_redo]
RESULTS_PATH.write_text(json.dumps(results, indent=2))
# Then re-run the generation loop — it will fill in just those ids.
```

Same pattern works in `baseline_eval.ipynb`.

---

## Troubleshooting

- **`ModuleNotFoundError: No module named 'eval'`** — the setup cell in Colab clones the repo and inserts `src/` onto `sys.path`. If you're running locally outside the repo root, run from `src/notebooks/` or set `cd /path/to/COMS6156FinalProject` before launching Jupyter.
- **`AttributeError` on `model.generate`** — newer Transformers returns a `BatchEncoding` from `apply_chat_template`. The `generate()` helper in `baseline_eval.ipynb` uses `return_dict=True` and unpacks `input_ids`/`attention_mask` explicitly. If you see this error, you're on an old version of the notebook — pull latest.
- **Qwen generation hangs on Apple Silicon** — fp16 triggers CPU fallbacks on MPS for some Qwen kernels. The notebook forces `bfloat16` on MPS and runs a 5-token warmup to amortize kernel compilation. If a single OE item still takes more than ~30 s after warmup, switch to CUDA or CPU.
- **Claude rate-limit during RAG run** — the run loop already retries with exponential backoff. If you hit a sustained 429, just re-run the cell; resume picks up where it left off.
- **`ingest.py` fails to download a source** — the IRS/CFPB occasionally rate-limit. Re-run; downloads are cached under `../knowledge_base/sources/`.
