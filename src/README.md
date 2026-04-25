# `src/` — FinVerify source layout

```
src/
├── notebooks/          # Two Jupyter notebooks: baseline + RAG eval
│   ├── baseline_eval.ipynb
│   ├── rag_eval.ipynb
│   ├── results/        # JSON output (committed for reproducibility)
│   └── README.md       # ← FULL EVALUATION REPLICATION GUIDE
├── knowledge_base/     # Authoritative source corpus + Chroma vector store builder
│   ├── ingest.py
│   ├── sources/        # Raw IRS/CFPB/SEC/SSA/HC.gov downloads
│   ├── vector_store/   # Persisted Chroma index (gitignored — built by ingest.py)
│   └── README.md
├── eval/               # Shared Python helpers used by both notebooks
│   ├── sampling.py     # Stratified per-topic sampler over dataset/
│   ├── metrics.py      # MC grader · cosine · Claude judge rubric
│   └── README.md
└── demo/               # Vite + React demo site
    ├── src/
    └── README.md       # ← BUILD / DEPLOY / RUN GUIDE for the website
```

For setup, build, and run instructions, see the README inside each folder. The two most important entry points are:

- **[`notebooks/README.md`](notebooks/README.md)** — how to reproduce every number in the writeup.
- **[`demo/README.md`](demo/README.md)** — how to build and serve the demo website.

The top-level [`README.md`](../README.md) covers project purpose, repo map, and the external artifacts FinVerify builds on.
