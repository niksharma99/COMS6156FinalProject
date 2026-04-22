"""Download authoritative personal-finance documents, chunk them, embed them,
and persist a Chroma vector store for retrieval.

Run this once (or whenever sources change) before opening rag_eval.ipynb:

    python src/knowledge_base/ingest.py

Sources are intentionally limited to public, authoritative publications
(IRS, CFPB, SEC, SSA, HealthCare.gov). Each source is labeled so retrieved
chunks carry metadata the RAG notebook can show in citations.
"""
from __future__ import annotations

import io
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import requests

THIS_DIR = Path(__file__).resolve().parent
SOURCES_DIR = THIS_DIR / "sources"
VECTOR_DIR = THIS_DIR / "vector_store"
SOURCES_DIR.mkdir(parents=True, exist_ok=True)
VECTOR_DIR.mkdir(parents=True, exist_ok=True)

EMBED_MODEL = "BAAI/bge-small-en-v1.5"
COLLECTION = "finverify_kb"
CHUNK_CHARS = 800
CHUNK_OVERLAP = 100

HEADERS = {"User-Agent": "FinVerify-KB-Ingest/0.1 (academic project)"}


# ---------- Source catalog ---------------------------------------------------

@dataclass
class Source:
    slug: str          # filename stem
    url: str
    kind: str          # "pdf" | "html"
    topic: str         # one of the six project topics
    title: str
    publisher: str


SOURCES: list[Source] = [
    # IRS publications (PDF)
    Source("irs_pub_590a_iras_contributions", "https://www.irs.gov/pub/irs-pdf/p590a.pdf",
           "pdf", "retirement", "Pub 590-A: Contributions to IRAs", "IRS"),
    Source("irs_pub_590b_iras_distributions", "https://www.irs.gov/pub/irs-pdf/p590b.pdf",
           "pdf", "retirement", "Pub 590-B: Distributions from IRAs", "IRS"),
    Source("irs_pub_560_retirement_plans_small_biz", "https://www.irs.gov/pub/irs-pdf/p560.pdf",
           "pdf", "retirement", "Pub 560: Retirement Plans for Small Business", "IRS"),
    Source("irs_pub_970_education_tax_benefits", "https://www.irs.gov/pub/irs-pdf/p970.pdf",
           "pdf", "tax", "Pub 970: Tax Benefits for Education", "IRS"),
    Source("irs_pub_969_hsa_fsa", "https://www.irs.gov/pub/irs-pdf/p969.pdf",
           "pdf", "insurance", "Pub 969: HSAs and Other Tax-Favored Health Plans", "IRS"),
    Source("irs_pub_525_taxable_nontaxable_income", "https://www.irs.gov/pub/irs-pdf/p525.pdf",
           "pdf", "tax", "Pub 525: Taxable and Nontaxable Income", "IRS"),
    Source("irs_pub_550_investment_income", "https://www.irs.gov/pub/irs-pdf/p550.pdf",
           "pdf", "investing", "Pub 550: Investment Income and Expenses", "IRS"),

    # CFPB (HTML)
    Source("cfpb_emergency_fund_guide",
           "https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/",
           "html", "budgeting", "An essential guide to building an emergency fund", "CFPB"),
    Source("cfpb_debt_to_income_ratio",
           "https://www.consumerfinance.gov/ask-cfpb/what-is-a-debt-to-income-ratio-en-1791/",
           "html", "credit_and_debt", "What is a debt-to-income ratio?", "CFPB"),
    Source("cfpb_credit_reports_and_scores",
           "https://www.consumerfinance.gov/consumer-tools/credit-reports-and-scores/",
           "html", "credit_and_debt", "Credit reports and scores", "CFPB"),
    Source("cfpb_mortgage_basics",
           "https://www.consumerfinance.gov/owning-a-home/",
           "html", "credit_and_debt", "Owning a home: mortgage basics", "CFPB"),

    # SEC / investor.gov (HTML)
    Source("sec_diversification_basics",
           "https://www.investor.gov/introduction-investing/investing-basics/glossary/diversification",
           "html", "investing", "Diversification", "SEC Investor.gov"),
    Source("sec_index_funds",
           "https://www.investor.gov/introduction-investing/investing-basics/investment-products/mutual-funds-and-exchange-traded-3",
           "html", "investing", "Index Funds", "SEC Investor.gov"),
    Source("sec_asset_allocation",
           "https://www.investor.gov/additional-resources/general-resources/publications-research/info-sheets/beginners-guide-asset",
           "html", "investing", "Beginner's Guide to Asset Allocation, Diversification, and Rebalancing", "SEC Investor.gov"),

    # SSA (PDF — the HTML page 403s without a browser UA)
    Source("ssa_retirement_benefits", "https://www.ssa.gov/pubs/EN-05-10035.pdf",
           "pdf", "retirement", "Retirement Benefits (SSA Pub 05-10035)", "SSA"),

    # HealthCare.gov (HTML)
    Source("hcgov_plan_categories",
           "https://www.healthcare.gov/choose-a-plan/plans-categories/",
           "html", "insurance", "Health plan categories (Bronze/Silver/Gold/Platinum)", "HealthCare.gov"),
    Source("hcgov_deductible",
           "https://www.healthcare.gov/glossary/deductible/",
           "html", "insurance", "Deductible", "HealthCare.gov"),
    Source("hcgov_out_of_pocket_max",
           "https://www.healthcare.gov/glossary/out-of-pocket-maximum-limit/",
           "html", "insurance", "Out-of-pocket maximum / limit", "HealthCare.gov"),
]


# ---------- Fetch + extract --------------------------------------------------

def fetch(src: Source) -> Path:
    """Download the raw source to sources/, skip if already present."""
    ext = ".pdf" if src.kind == "pdf" else ".html"
    out = SOURCES_DIR / f"{src.slug}{ext}"
    if out.exists() and out.stat().st_size > 0:
        return out
    print(f"  fetching {src.slug} ...", flush=True)
    r = requests.get(src.url, headers=HEADERS, timeout=60)
    r.raise_for_status()
    out.write_bytes(r.content)
    time.sleep(0.5)  # be polite to the origin
    return out


def extract_text(path: Path, kind: str) -> str:
    if kind == "pdf":
        from pypdf import PdfReader
        reader = PdfReader(str(path))
        parts = []
        for page in reader.pages:
            try:
                parts.append(page.extract_text() or "")
            except Exception:
                continue
        text = "\n".join(parts)
    else:
        from bs4 import BeautifulSoup
        html = path.read_text(encoding="utf-8", errors="ignore")
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()
        text = soup.get_text("\n")
    # Normalize whitespace
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ---------- Chunking ---------------------------------------------------------

def chunk_text(text: str, size: int = CHUNK_CHARS, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Simple paragraph-aware sliding window. Good enough for a demo corpus."""
    text = text.strip()
    if not text:
        return []
    chunks, i = [], 0
    while i < len(text):
        end = min(i + size, len(text))
        # Try to break at a paragraph or sentence boundary within the last 150 chars
        window = text[i:end]
        if end < len(text):
            for sep in ("\n\n", "\n", ". "):
                j = window.rfind(sep, max(0, len(window) - 200))
                if j > 0:
                    end = i + j + len(sep)
                    window = text[i:end]
                    break
        chunks.append(window.strip())
        if end == len(text):
            break
        i = max(end - overlap, i + 1)
    return [c for c in chunks if len(c) > 80]


# ---------- Build vector store ----------------------------------------------

def build_store():
    import chromadb
    from sentence_transformers import SentenceTransformer

    client = chromadb.PersistentClient(path=str(VECTOR_DIR))
    # Wipe + recreate so re-runs are deterministic
    try:
        client.delete_collection(COLLECTION)
    except Exception:
        pass
    coll = client.create_collection(COLLECTION, metadata={"hnsw:space": "cosine"})

    embedder = SentenceTransformer(EMBED_MODEL)
    print(f"Embedding with {EMBED_MODEL}")

    total_chunks = 0
    for src in SOURCES:
        try:
            path = fetch(src)
        except Exception as e:
            print(f"  !! skip {src.slug}: {e}")
            continue
        try:
            text = extract_text(path, src.kind)
        except Exception as e:
            print(f"  !! extract failed for {src.slug}: {e}")
            continue
        chunks = chunk_text(text)
        if not chunks:
            print(f"  !! no chunks for {src.slug}")
            continue
        ids = [f"{src.slug}::chunk{i:04d}" for i in range(len(chunks))]
        metas = [{
            "source_slug": src.slug,
            "title": src.title,
            "publisher": src.publisher,
            "topic": src.topic,
            "url": src.url,
            "chunk_index": i,
        } for i in range(len(chunks))]
        embeddings = embedder.encode(chunks, normalize_embeddings=True, show_progress_bar=False)
        coll.add(ids=ids, documents=chunks, metadatas=metas, embeddings=embeddings.tolist())
        total_chunks += len(chunks)
        print(f"  {src.slug}: {len(chunks)} chunks")

    print(f"\nDone. {total_chunks} chunks indexed into {VECTOR_DIR}")


if __name__ == "__main__":
    build_store()
