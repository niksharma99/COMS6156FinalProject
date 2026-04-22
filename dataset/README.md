# FinVerify Evaluation Dataset

A curated dataset of personal finance questions for evaluating LLM-based financial advisors, organized by topic and difficulty.

## Structure

The dataset is organized into three question sets, each split into the same six topic files so they can be evaluated side-by-side:

```
standard_questions/       # Authored baseline set — mix of MC and open-ended, basic → advanced
  retirement.json         # 401(k), IRA, Social Security, pensions
  tax.json                # Income tax, deductions, credits, filing
  investing.json          # Stocks, bonds, funds, strategies
  credit_and_debt.json    # Credit scores, loans, bankruptcy
  insurance.json          # Health, life, auto, disability
  budgeting.json          # Budgeting rules, emergency funds, savings

open_ended_hard/          # Authored hard open-ended set — nuance, tradeoffs, misconception-correction
  retirement.json
  tax.json
  investing.json
  credit_and_debt.json
  insurance.json
  budgeting.json

reddit_questions/         # Real user questions sampled from the PersonalFinance_v2 HF dataset
  retirement.json         # ~12 per topic (72 total), open-ended, evaluated via LLM judge
  tax.json
  investing.json
  credit_and_debt.json
  insurance.json
  budgeting.json

metadata/
  sources.json            # All authoritative sources referenced
```

### Question sets

- **`standard_questions/`** — Hand-authored questions grounded in authoritative sources (IRS, CFPB, SEC, SSA, etc.). Mix of `multiple_choice` and `open_ended`. Difficulties span `basic`, `intermediate`, and `advanced`. This is the primary accuracy benchmark.
- **`open_ended_hard/`** — Hand-authored open-ended questions targeting nuance, tradeoffs, and common misconceptions (e.g. marginal vs. average tax rates, diversification limits, refund framing). All are `difficulty: "hard"`. Intended to discriminate between models that merely recall facts and models that reason through tradeoffs. Grade with an LLM judge against the reference `correct_answer`.
- **`reddit_questions/`** — Real, open-ended user questions sampled from [Akhil-Theerthala/PersonalFinance_v2](https://huggingface.co/datasets/Akhil-Theerthala/PersonalFinance_v2) on Hugging Face, mapped to the same six topics. Each item includes the dataset's accepted response as `correct_answer` plus a `reasoning_trace` field. Grade with an LLM judge, comparing the candidate model and a baseline against the reference response for factuality and advice quality.

### Schema

Each question file is a JSON array of objects. The base schema is shared across all three sets; some fields only appear in certain sets:

```json
{
  "id": "ret-001",
  "question": "...",
  "type": "multiple_choice | open_ended",
  "options": ["A", "B", "C", "D"],        // multiple_choice only
  "correct_answer": "...",                // for reddit_questions, this is the reference response
  "explanation": "...",                   // commentary / grading notes
  "reasoning_trace": "...",               // reddit_questions only — chain-of-thought from the source dataset
  "difficulty": "basic | intermediate | advanced | hard",
  "source": "IRS Publication 590-A",
  "source_url": "https://...",
  "tags": ["ira", "contribution_limits"]
}
```

`difficulty: "hard"` is used exclusively by `open_ended_hard/`. The `reasoning_trace` field only appears in `reddit_questions/`.

## Sources

Questions are authored based on publicly available information from:

- **FINRA National Financial Capability Study** — https://www.finra.org/financial_literacy_quiz
- **IRS Publications** — https://www.irs.gov/publications
  - Pub 590-A/B (IRAs), Pub 560 (Retirement Plans), Pub 970 (Education), Topic 409 (Capital Gains)
- **CFPB (Consumer Financial Protection Bureau)** — https://www.consumerfinance.gov
- **SEC Investor Education** — https://www.investor.gov
- **Healthcare.gov** — https://www.healthcare.gov
- **SSA (Social Security Administration)** — https://www.ssa.gov

The `reddit_questions/` set is sampled from:
- **PersonalFinance_v2** (Akhil Theerthala) — https://huggingface.co/datasets/Akhil-Theerthala/PersonalFinance_v2

For evaluation against existing benchmarks, see also:
- **FinanceBench** (Patronus AI) — https://huggingface.co/datasets/PatronusAI/financebench
- **FinQA** (Chen et al., EMNLP 2021) — https://github.com/czyssrs/FinQA

## Usage

These questions are designed to be consumed by the FinVerify evaluation framework. The three question sets serve complementary roles:

- `standard_questions/` — closed-ended accuracy on well-defined facts (MC items can be auto-graded; open-ended items via LLM judge).
- `open_ended_hard/` — reasoning and misconception-correction under harder prompts, LLM-judged against the reference answer.
- `reddit_questions/` — realistic, messy user queries for comparing a candidate model against a baseline, LLM-judged against the reference response.

External datasets are referenced by URL and not duplicated here.