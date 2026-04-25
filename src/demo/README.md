# `src/demo/` — FinVerify demo website

A Vite + React 18 single-page app that visualizes the FinVerify project. It reads the latest `src/notebooks/results/*.json` at build time so every metric and comparison case shown is real (no mocked numbers).

## Tabs

- **Architecture** — the real pipeline diagram: Qwen2.5-3B baseline (no retrieval) vs. Claude Sonnet 4.6 + BGE-small + ChromaDB RAG, with LLM-as-judge.
- **Dataset** — loads every JSON under [`../../dataset/`](../../dataset/) at build time. Filterable by dataset / topic; counts and metadata are computed live.
- **Live Demo** — pick any question from the dataset, pick a baseline persona, and run **both pipelines live in the browser**, calling Claude directly. Stages animate (embed → retrieve → generate → judge) and judge scores + retrieved citations are shown side-by-side. Requires an Anthropic API key.
- **Comparison** — automatically picks the top items where Claude + RAG beat the Qwen baseline by the largest LLM-judge margin (one MC flip + four open-ended wins). Each card shows the actual generated answers, real judge rationales, and the actual retrieved KB chunks.
- **Metrics** — real charts computed from the latest `results/baseline_*` and `results/rag_*` shards: MC accuracy, judge mean by topic and by dataset, cosine, citation coverage.

## Build

```bash
cd src/demo
npm install        # one-time; pulls React, Vite, Recharts, @anthropic-ai/sdk
npm run build      # production build → dist/
```

`npm run build` outputs a static bundle in `dist/`. The build inlines:
- All 156 dataset questions from `../../dataset/{standard_questions,open_ended_hard,reddit_questions}/*.json`.
- The latest eval results from `../../src/notebooks/results/baseline_*/all.json` and `rag_*/all.json` if they exist (the Comparison and Metrics tabs gracefully fall back to a curated set + a warning banner if results are missing).

The build is **fully static** — nothing is fetched at runtime, the demo works offline, and you can drop `dist/` on any static host (Vercel, Netlify, GitHub Pages, S3+CloudFront).

## Run (development)

```bash
cd src/demo
npm install        # if you haven't yet
npm run dev
```

Vite serves at **http://localhost:5173** and opens it automatically. Hot-reload is enabled — edits to `src/` files refresh instantly. If you regenerate the eval results while the server is running, refresh the browser tab to pick them up.

## Run (production)

```bash
cd src/demo
npm run build
npm run preview    # serves dist/ at http://localhost:4173 for local sanity check
```

To deploy:

```bash
# Drop dist/ on any static host. Examples:
npx serve dist                  # ad-hoc local server
vercel --prod ./dist            # Vercel
netlify deploy --prod -d dist   # Netlify
```

There is no backend — the demo site does not need a server, a database, or any Python runtime. The Live Demo tab makes Claude API calls directly from the browser.

## Live Demo configuration (Anthropic API key)

The Live Demo tab calls Claude directly from the browser. This is fine for an academic demo but **must not be used in production** (the key would be exposed to anyone visiting the site). To enable the tab:

1. Put your key in the **repo-root** `.env` (not inside `src/demo/`):
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
2. Restart `npm run dev`. Vite reads `.env` at boot via the loader in [`vite.config.js`](vite.config.js) and exposes the key as `VITE_ANTHROPIC_API_KEY` to the browser bundle.

If the key is missing, the Live Demo tab still loads but generation buttons surface a clear error. The other four tabs are key-free.

### Simulated baseline personas

The Live Demo offers three baseline personas (Qwen2.5-3B-Instruct simulated, GPT-3.5-class simulated, Claude Haiku no-retrieval). Under the hood **all three run on `claude-haiku-4-5` with restrictive system prompts** that simulate the failure modes of smaller / older models (outdated facts, confident hallucination, no tradeoffs). This avoids shipping a 6 GB local model into the browser. The "real" Qwen-3B baseline lives in [`../notebooks/baseline_eval.ipynb`](../notebooks/baseline_eval.ipynb) and is what every Comparison-tab card and Metrics-tab number is computed from.

## File layout

```
demo/
├── index.html
├── package.json
├── vite.config.js          # repo-root .env loader + fs.allow widened to repo root
├── src/
│   ├── main.jsx
│   ├── App.jsx             # All five tabs
│   ├── DemoTab.jsx         # Live demo (question picker + persona + animated stages)
│   ├── api.js              # Browser-side Anthropic SDK calls (RAG, baseline, judge)
│   ├── data.js             # Build-time globs of dataset/ AND notebooks/results/
│   └── kb.js               # Curated in-memory copy of the KB for the Live Demo
└── dist/                   # Production build output (gitignored)
```

## How real results are wired in

[`src/data.js`](src/data.js) uses `import.meta.glob` (eager) to inline:

- `../../../dataset/{standard_questions,open_ended_hard,reddit_questions}/*.json`
- `../../../src/notebooks/results/baseline_*/all.json`
- `../../../src/notebooks/results/rag_*/all.json`

It then exposes:

- `ALL_QUESTIONS`, `DATASETS`, `TOPICS` — for the Dataset tab.
- `BASELINE_RESULTS`, `RAG_RESULTS`, `BASELINE_MODEL`, `RAG_MODEL`, `HAS_RESULTS` — raw arrays + which model slug each came from.
- `computeMetrics()`, `metricsByTopic()`, `metricsByDataset()` — aggregated for the Metrics tab.
- `topComparisonWins(limit)`, `topMcFlip()` — picks the highest-Δ-judge cases for the Comparison tab.

If new results land in `src/notebooks/results/`, just rebuild (`npm run build`) or hot-reload the dev server — no code changes needed.

## External artifacts

- [Vite 5](https://vitejs.dev/) (MIT) — dev server + bundler
- [React 18](https://react.dev/) (MIT) — UI
- [Recharts](https://recharts.org/) (MIT) — bar charts in the Metrics tab
- [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) (MIT) — browser-side Claude calls in the Live Demo tab

See the top-level [`README.md`](../../README.md) for the full external-artifacts list across the project.
