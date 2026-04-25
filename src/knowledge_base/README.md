# `src/knowledge_base/` — authoritative source corpus + Chroma index

The grounding layer for the RAG pipeline. `ingest.py` downloads public-domain U.S. government / regulator publications, chunks them, embeds them with `BAAI/bge-small-en-v1.5`, and persists a Chroma vector store that `rag_eval.ipynb` queries at retrieval time.

```
knowledge_base/
├── ingest.py        # Download → parse → chunk → embed → persist
├── sources/         # Raw PDFs/HTML (committed, ~10 MB)
└── vector_store/    # Persisted Chroma collection "finverify_kb" (gitignored)
```

## Build

The vector store is a build artifact and is **gitignored** (~tens of MB of binary index files). It must be built once before running `rag_eval.ipynb`.

```bash
# From the repo root, after pip install -r requirements.txt:
python src/knowledge_base/ingest.py
```

This:
1. Downloads each source in the `SOURCES` catalog (skips files already in `sources/`).
2. Parses PDFs with `pypdf` and HTML with `BeautifulSoup`.
3. Chunks each document into ~800-character passages with 100-character overlap.
4. Embeds chunks with `BAAI/bge-small-en-v1.5` via `sentence-transformers`.
5. Persists a Chroma collection named `finverify_kb` to `vector_store/`.

First run takes ~3–5 minutes (model download + downloads + embedding). Subsequent runs are no-ops if `sources/` is populated and you delete `vector_store/` to rebuild.

**You don't usually need to run this manually** — `rag_eval.ipynb` has a §1b cell that runs it automatically if `vector_store/` is empty.

## Sources catalog

Defined as the `SOURCES` list in [`ingest.py`](ingest.py). Add new sources by appending a `Source(slug, url, publisher, title, topic)` entry.

| Slug | Publisher | Topic |
|---|---|---|
| `irs_pub_590a_iras_contributions` | IRS | retirement |
| `irs_pub_590b_iras_distributions` | IRS | retirement |
| `irs_pub_560_retirement_plans_small_biz` | IRS | retirement |
| `irs_pub_970_education_tax_benefits` | IRS | tax |
| `irs_pub_969_hsa_fsa` | IRS | insurance |
| `irs_pub_525_taxable_nontaxable_income` | IRS | tax |
| `irs_pub_550_investment_income` | IRS | tax |
| `cfpb_emergency_fund_guide` | CFPB | budgeting |
| `cfpb_debt_to_income_ratio` | CFPB | credit_and_debt |
| `cfpb_credit_reports_and_scores` | CFPB | credit_and_debt |
| `cfpb_mortgage_basics` | CFPB | credit_and_debt |
| `sec_diversification_basics` | SEC | investing |
| `sec_index_funds` | SEC | investing |
| `sec_asset_allocation` | SEC | investing |
| `ssa_retirement_benefits` | SSA | retirement |
| `hcgov_plan_categories` | HealthCare.gov | insurance |
| `hcgov_deductible` | HealthCare.gov | insurance |
| `hcgov_out_of_pocket_max` | HealthCare.gov | insurance |

All material is public-domain U.S. government / regulator content; nothing is paywalled or licensed.

## Chroma collection schema

Each row in the `finverify_kb` collection has:

```jsonc
{
  "embedding": [...],                 // BGE-small (384-d, normalized)
  "document":  "raw chunk text",
  "metadata": {
    "publisher":   "IRS",
    "title":       "Publication 590-A — IRA Contributions",
    "topic":       "retirement",
    "source_slug": "irs_pub_590a_iras_contributions",
    "chunk_index": 7
  }
}
```

`rag_eval.ipynb` queries with topic-filtered nearest-neighbor search:

```python
res = coll.query(
    query_embeddings=[q_emb],
    n_results=5,
    where={"topic": item["_topic"]},
)
```

## Querying outside the notebook

```python
import chromadb
from sentence_transformers import SentenceTransformer

client = chromadb.PersistentClient(path="src/knowledge_base/vector_store")
coll = client.get_collection("finverify_kb")
emb = SentenceTransformer("BAAI/bge-small-en-v1.5")

q = "What is the 2025 401(k) contribution limit?"
res = coll.query(query_embeddings=[emb.encode([q], normalize_embeddings=True)[0].tolist()], n_results=5)
for doc, meta in zip(res["documents"][0], res["metadatas"][0]):
    print(meta["publisher"], "—", meta["title"])
    print(doc[:200])
```

## Demo-site fallback

The Vite + React demo in [`../demo/`](../demo/) cannot embed Python or Chroma in the browser. For the **Live Demo** tab it ships a curated in-memory copy of the most useful KB passages in [`../demo/src/kb.js`](../demo/src/kb.js) and uses a simple lexical retriever. Real evaluation always runs through Chroma in the notebook.
