# FinVerify

**COMS 6156 Final Project — Nikhil Sharma (ns3942)**

FinVerify is a hybrid RAG + LLM-as-judge framework for evaluating personal-finance advice from large language models. It compares a small open-weights baseline (`Qwen2.5-3B-Instruct`, no retrieval) against a frontier model with retrieval (`claude-sonnet-4-6` + ChromaDB over IRS / CFPB / SEC / SSA / HealthCare.gov), grading both with multiple-choice accuracy, embedding cosine similarity, an LLM-as-judge rubric (factuality / completeness / advice quality), and citation coverage.

## Where to find what

| Path | Contents | README |
|---|---|---|
| [`dataset/`](dataset/) | 156 personal-finance questions across 6 topics × 3 question sets (standard MC, hard open-ended, real Reddit) | [`dataset/README.md`](dataset/README.md) |
| [`src/notebooks/`](src/notebooks/) | The two evaluation notebooks (baseline + RAG) and replication instructions | [`src/notebooks/README.md`](src/notebooks/README.md) |
| [`src/knowledge_base/`](src/knowledge_base/) | Ingest script + Chroma vector store builder for the authoritative source corpus | [`src/knowledge_base/README.md`](src/knowledge_base/README.md) |
| [`src/eval/`](src/eval/) | Shared eval helpers (stratified sampler, MC grader, cosine, Claude judge) | [`src/eval/README.md`](src/eval/README.md) |
| [`src/demo/`](src/demo/) | Vite + React demo site that visualizes architecture, dataset, comparison, and live metrics from the latest eval run | [`src/demo/README.md`](src/demo/README.md) |
| [`milestones/`](milestones/) | Submitted milestone PDFs: project proposal, progress report, and final report | [`milestones/README.md`](milestones/README.md) |
| [`src/README.md`](src/README.md) | Source-tree map + cross-references | — |

Each subfolder has its own README explaining what's inside, how to set it up, and how to run it. **Start with [`src/notebooks/README.md`](src/notebooks/README.md) to replicate the evaluation.** Additional links and writeup material will be added here later.

## Quick start

```bash
git clone https://github.com/niksharma99/COMS6156FinalProject.git
cd COMS6156FinalProject
pip install -r requirements.txt
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
```

Then either:

- **Replicate the evaluation** → follow [`src/notebooks/README.md`](src/notebooks/README.md).
- **Run the demo site** → follow [`src/demo/README.md`](src/demo/README.md).

## External artifacts we build on

FinVerify is a thin wrapper around several standard open-source artifacts. None of these are forked or modified.

| Artifact | Role | License / link |
|---|---|---|
| [Qwen2.5-3B-Instruct](https://huggingface.co/Qwen/Qwen2.5-3B-Instruct) (Alibaba) | Open-weights baseline model | Apache 2.0 |
| [Anthropic Claude (`claude-sonnet-4-6`)](https://docs.anthropic.com/) | RAG generator + LLM judge | Hosted API |
| [BAAI/bge-small-en-v1.5](https://huggingface.co/BAAI/bge-small-en-v1.5) | Embedding model for KB + answer-vs-reference similarity | MIT |
| [ChromaDB](https://github.com/chroma-core/chroma) | Persistent vector store for retrieval | Apache 2.0 |
| [HuggingFace Transformers](https://github.com/huggingface/transformers) | Baseline model loading / generation | Apache 2.0 |
| [sentence-transformers](https://www.sbert.net/) | BGE embedding wrapper | Apache 2.0 |
| [Anthropic Python SDK](https://github.com/anthropics/anthropic-sdk-python) | Claude API client (notebooks) | MIT |
| [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) | Claude API client (demo site) | MIT |
| [PersonalFinance_v2 (HF)](https://huggingface.co/datasets/Akhil-Theerthala/PersonalFinance_v2) | Source for the 72 Reddit-derived questions in `dataset/reddit_questions/` | See dataset card |
| Authoritative source corpus | KB grounding | IRS, CFPB, SEC, SSA, HealthCare.gov — all public-domain U.S. government / regulator material |
| [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + [Recharts](https://recharts.org/) | Demo site | MIT / BSD |

## License

Academic project; not licensed for production use. The dataset is a derivative of public-domain U.S. government material (IRS / CFPB / SEC / SSA / HealthCare.gov) and CC-licensed Reddit content surfaced through PersonalFinance_v2.
