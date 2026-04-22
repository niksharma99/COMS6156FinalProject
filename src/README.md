# FinVerify — source layout

Two notebooks and the supporting plumbing for evaluating a baseline LLM vs. a RAG-augmented LLM on our personal-finance question sets in [`../dataset/`](../dataset/).

```
src/
  notebooks/
    baseline_eval.ipynb    # Qwen2.5-3B-Instruct, no retrieval
    rag_eval.ipynb         # Claude (claude-sonnet-4-6) + ChromaDB retrieval
    results/               # per-run JSON (gitignored)
  knowledge_base/
    ingest.py              # fetch → chunk → embed → persist Chroma
    sources/               # raw downloaded PDFs/HTML (IRS, CFPB, SEC, SSA, HC.gov)
    vector_store/          # persisted Chroma index (gitignored)
  eval/
    sampling.py            # stratified per-topic sampler
    metrics.py             # MC grader, embedding cosine, Claude judge rubric
```

## Model choices

| Role | Model | Why |
| --- | --- | --- |
| Baseline | `Qwen/Qwen2.5-3B-Instruct` (HF, open weights) | Runs locally on Mac/MPS, strong enough to answer, weak enough that RAG+frontier clearly wins |
| Implementation | Anthropic `claude-sonnet-4-6` + RAG | Better long-context handling for retrieved passages, higher-quality grounded answers, easy to reuse as judge |
| Embeddings | `BAAI/bge-small-en-v1.5` | Small, fast, high-quality; used both for KB index and answer-vs-reference similarity |
| Judge | `claude-sonnet-4-6` | Consistent 1–5 rubric across factuality, completeness, advice quality |

Using Claude (frontier) as the RAG generator and a small open model as the baseline is deliberate: a single-variable comparison would require running Claude *without* retrieval too, which we provide as an optional cell at the bottom of `baseline_eval.ipynb`. That second baseline isolates the contribution of retrieval itself.

## Setup

```bash
python -m pip install transformers accelerate torch sentence-transformers anthropic \
                      chromadb pypdf beautifulsoup4 requests pandas

export ANTHROPIC_API_KEY=sk-ant-...      # required for RAG + LLM judge

# Build the knowledge base once (downloads ~15 MB of PDFs/HTML):
python src/knowledge_base/ingest.py
```

## Running the evaluations

Open the notebooks in VS Code / Jupyter and run top-to-bottom:

1. **`baseline_eval.ipynb`** — samples 5 questions from each of `standard_questions`, `open_ended_hard`, `reddit_questions` (15 total, stratified across topics with `seed=7`), runs Qwen2.5-3B on each, and scores with MC accuracy, embedding similarity vs. the reference, and the Claude judge rubric. Saves results to `src/notebooks/results/baseline_*.json`.
2. **`rag_eval.ipynb`** — samples the *same 15 questions* (`seed=7`), retrieves top-5 chunks from the Chroma store per question filtered by topic, generates with Claude + inline citations, and scores with the same three signals plus a citation-coverage metric. Saves to `src/notebooks/results/rag_*.json` and prints a side-by-side summary.

## Metrics for the demo

- **Multiple-choice accuracy** — exact letter match.
- **Embedding cosine similarity** — fast, model-agnostic proxy for answer fidelity against the reference.
- **LLM-as-judge (1–5 rubric)** — `factuality`, `completeness`, `advice_quality`. The mean of the three is reported per question and aggregated per dataset.
- **Citation coverage** (RAG only) — fraction of retrieved passages the model actually cites. Low values flag "retrieval happened but wasn't used"; high values indicate genuinely grounded answers.

## Knowledge base sources

Downloaded by `ingest.py` into `src/knowledge_base/sources/`:

- IRS Pubs 525, 550, 560, 590-A, 590-B, 969, 970
- CFPB: emergency fund guide, debt-to-income, credit reports & scores, mortgage basics
- SEC investor.gov: diversification, index funds, asset allocation
- SSA Pub 05-10035 (Retirement Benefits)
- HealthCare.gov: plan categories, deductible, out-of-pocket maximum

These are authoritative, publicly available, and align with the topics covered by our question sets. Add more by appending to the `SOURCES` list in [`knowledge_base/ingest.py`](knowledge_base/ingest.py).
