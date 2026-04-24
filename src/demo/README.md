# FinVerify Demo

A Vite + React app that presents the FinVerify project as four tabs:

- **Architecture** — real pipeline: Qwen2.5-3B-Instruct baseline vs. Claude Sonnet 4.6 + BGE + ChromaDB RAG, with LLM-as-judge verification.
- **Dataset** — loads every JSON under `dataset/` (standard MC, open-ended hard, Reddit) with dataset/topic filters. Counts and metadata are computed live from the repo's dataset files.
- **Live Demo** — pick any question from the dataset, pick a simulated baseline persona, and run both pipelines live. Stages animate as each step executes (embed → retrieve → generate → judge), then judge scores and retrieved citations are shown side-by-side. Calls Claude directly from the browser using the repo-root `.env` key.
- **Comparison** — preliminary side-by-side of baseline vs. FinVerify responses. Real responses will be swapped in once the notebooks finish running.
- **Metrics** — placeholder charts for MC accuracy, judge rubric means, cosine similarity, and citation coverage. Real values will load from `src/notebooks/results/`.

## Run

```bash
cd src/demo
npm install
npm run dev
```

The dev server opens at `http://localhost:5173`.

## Live demo notes (hacky on purpose)

The Live Demo tab makes real Claude API calls from the browser. Requirements:

1. `ANTHROPIC_API_KEY` must be set in the **repo-root** `.env` (not inside `src/demo/`). `vite.config.js` reads it and exposes it as `VITE_ANTHROPIC_API_KEY`.
2. Restart `npm run dev` after changing the key — Vite only reads `.env` at boot.

Under the hood:

- **Baseline personas** (Qwen-3B, GPT-3.5-class, Claude Haiku no-retrieval) all run on Claude Haiku 4.5 with restrictive system prompts that simulate the failure modes of smaller/older models (outdated facts, confident hallucination, no tradeoffs). This avoids shipping a local model into the browser and keeps the demo snappy.
- **RAG retrieval** uses `src/kb.js` — a curated in-memory version of the real ChromaDB knowledge base (IRS, CFPB, SEC, SSA, HealthCare.gov). In-browser retrieval is a simple lexical overlap + topic boost; the notebook uses BGE embeddings + Chroma.
- **FinVerify generation** runs the real prompt from `src/notebooks/rag_eval.ipynb` on Claude Sonnet 4.6.
- **Judge** runs on Claude Sonnet 4.6 with the same 1–5 rubric as the notebook.

Do not reuse this browser-side API key pattern in production — for a real app, proxy through a backend.

## How data is loaded

`src/data.js` uses Vite's `import.meta.glob("../../../dataset/*/*.json", { eager: true })` to inline every dataset file at build time. Nothing is fetched at runtime — the demo works fully offline.

`vite.config.js` widens `server.fs.allow` so Vite can read from the repo root.

## What's real vs. placeholder

| Tab           | Status                                                                 |
| ------------- | ---------------------------------------------------------------------- |
| Architecture  | Real — matches `src/notebooks/*.ipynb` and `src/knowledge_base/`       |
| Dataset       | Real — pulls from `dataset/` at build time                             |
| Comparison    | Placeholder — wired to real question IDs; responses are mocked         |
| Metrics       | Placeholder — banner makes this explicit; swap once eval runs finish   |

## Swapping in real results

When `src/notebooks/results/baseline_*.json` and `rag_*.json` exist, update `src/data.js` to also glob those files and replace the placeholders in `ComparisonTab` / `MetricsTab` in `src/App.jsx`.
