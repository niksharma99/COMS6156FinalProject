// Curated excerpts that mirror the real ChromaDB knowledge base used by rag_eval.ipynb.
// The full KB (IRS pubs, CFPB, SEC, SSA, HealthCare.gov) lives in src/knowledge_base/.
// Here we ship a small in-memory version so the live demo can do client-side retrieval
// without a Python backend.

export const KB_PASSAGES = [
  // ── Retirement / IRS ────────────────────────────────────────────────────────
  {
    id: "irs-560-401k-2025",
    publisher: "IRS",
    title: "401(k) contribution limit for 2025 (Notice 2024-80)",
    topic: "retirement",
    text: "For 2025, the IRS increased the elective deferral limit for employees who participate in 401(k), 403(b), and most 457 plans to $23,500 (up from $23,000 in 2024). The catch-up contribution limit for employees aged 50 and over remains $7,500. A new, higher catch-up contribution of $11,250 applies to employees aged 60-63.",
  },
  {
    id: "irs-590a-roth-age",
    publisher: "IRS",
    title: "Publication 590-A — Roth IRA age rules",
    topic: "retirement",
    text: "There is no age limit on contributions to a Roth IRA. A taxpayer can contribute to a Roth IRA at any age as long as they have earned income (compensation) and their modified AGI is below the phase-out thresholds. The SECURE Act of 2019 also removed the age 70½ limit for traditional IRA contributions.",
  },
  {
    id: "irs-590a-trad-income",
    publisher: "IRS",
    title: "Publication 590-A — Traditional IRA income rules",
    topic: "retirement",
    text: "There is no income limit for contributing to a traditional IRA. Anyone with earned income may contribute up to the annual limit. However, the deductibility of the contribution may be reduced or eliminated if the taxpayer (or spouse) is covered by a workplace retirement plan and MAGI exceeds the IRS-published thresholds.",
  },
  {
    id: "ira-diff-roth-trad",
    publisher: "IRS",
    title: "Traditional vs. Roth IRA",
    topic: "retirement",
    text: "A traditional IRA generally allows pre-tax contributions (if deductible) and taxes withdrawals as ordinary income in retirement. A Roth IRA uses after-tax contributions; qualified withdrawals (after age 59½ and 5-year rule) are tax-free. For 2025 the combined contribution limit across traditional and Roth IRAs is $7,000 ($8,000 if age 50 or over).",
  },

  // ── Tax / IRS ───────────────────────────────────────────────────────────────
  {
    id: "irs-409-capgains",
    publisher: "IRS",
    title: "Topic No. 409 — Capital Gains and Losses",
    topic: "tax",
    text: "Gains from assets held more than one year are generally long-term capital gains, taxed at 0%, 15%, or 20% depending on taxable income. Assets held one year or less are short-term and taxed at ordinary income rates. For 2024-2025 the 15% LTCG bracket covers most middle and upper-middle earners; the 20% rate kicks in at very high incomes.",
  },
  {
    id: "irs-970-slid-mfs",
    publisher: "IRS",
    title: "Publication 970 — Student Loan Interest Deduction",
    topic: "tax",
    text: "A taxpayer cannot claim the student loan interest deduction if their filing status is married filing separately. The deduction (up to $2,500) is available only for single, head of household, qualifying surviving spouse, or married filing jointly filers, and phases out at higher MAGI.",
  },
  {
    id: "irs-559-gifts",
    publisher: "IRS",
    title: "Publication 559 — Gift tax",
    topic: "tax",
    text: "Gifts are generally not taxable income to the recipient. The donor may be required to file Form 709 if the gift to any one recipient exceeds the annual exclusion ($18,000 for 2024, $19,000 for 2025). Amounts above the annual exclusion count against the donor's lifetime gift and estate tax exemption but rarely trigger actual tax.",
  },

  // ── Credit & Debt / CFPB ────────────────────────────────────────────────────
  {
    id: "cfpb-fico-factors",
    publisher: "CFPB / FICO",
    title: "FICO score factor weights",
    topic: "credit_and_debt",
    text: "The FICO credit score is computed from five categories with approximate weights: payment history ~35%, amounts owed (credit utilization) ~30%, length of credit history ~15%, new credit ~10%, and credit mix ~10%. Payment history is the single largest factor.",
  },
  {
    id: "cfpb-soft-hard",
    publisher: "CFPB",
    title: "Soft vs. hard credit inquiries",
    topic: "credit_and_debt",
    text: "Checking your own credit score or report is a soft inquiry and does not affect your credit score. Hard inquiries, from lenders evaluating a credit application, can cause a small temporary drop in your score and typically remain on the report for up to two years.",
  },
  {
    id: "cfpb-bankruptcy",
    publisher: "FTC / Experian",
    title: "Bankruptcy on credit reports",
    topic: "credit_and_debt",
    text: "A Chapter 7 bankruptcy can remain on a consumer credit report for up to 10 years from the filing date. A Chapter 13 bankruptcy generally remains for 7 years from the filing date. Both significantly reduce credit scores but impact lessens with time and new positive history.",
  },

  // ── Investing / SEC ─────────────────────────────────────────────────────────
  {
    id: "sec-sipc",
    publisher: "SEC",
    title: "SIPC protection",
    topic: "investing",
    text: "The Securities Investor Protection Corporation (SIPC) protects investors if a brokerage firm fails, up to $500,000 per customer, including a $250,000 limit for cash. SIPC does NOT protect against investment losses due to market movements, bad advice, or fraud by the issuer of a security.",
  },
  {
    id: "sec-dca",
    publisher: "SEC",
    title: "Dollar-cost averaging",
    topic: "investing",
    text: "Dollar-cost averaging (DCA) is the strategy of investing a fixed amount at regular intervals regardless of the asset price. It reduces the risk of investing a lump sum right before a downturn and smooths the average cost per share over time. It does not guarantee a profit or protect against losses in declining markets.",
  },
  {
    id: "sec-diversification",
    publisher: "SEC",
    title: "Diversification and risk",
    topic: "investing",
    text: "Diversification spreads risk across asset classes, sectors, and geographies, which reduces idiosyncratic (single-asset) risk but cannot eliminate systematic (market-wide) risk. A diversified portfolio can still lose value during broad market declines.",
  },

  // ── Insurance / HealthCare.gov ──────────────────────────────────────────────
  {
    id: "hc-hmo-ppo",
    publisher: "HealthCare.gov",
    title: "HMO vs. PPO",
    topic: "insurance",
    text: "An HMO (Health Maintenance Organization) typically requires choosing a primary care physician and obtaining referrals for specialists, and generally only covers in-network care except for emergencies. A PPO (Preferred Provider Organization) offers more flexibility — specialist visits without referrals and partial out-of-network coverage — but usually has higher premiums and higher out-of-pocket costs.",
  },
  {
    id: "hc-deductible",
    publisher: "HealthCare.gov",
    title: "Deductible vs. out-of-pocket maximum",
    topic: "insurance",
    text: "The deductible is the amount the insured pays before the plan starts paying for most services. The out-of-pocket maximum caps total annual spending on covered in-network services; once reached, the plan pays 100% for the rest of the plan year.",
  },

  // ── Budgeting ───────────────────────────────────────────────────────────────
  {
    id: "budget-503020",
    publisher: "Consumer education",
    title: "50/30/20 budgeting rule",
    topic: "budgeting",
    text: "The 50/30/20 rule suggests allocating after-tax income as 50% to needs (rent, utilities, groceries, insurance, minimum debt payments), 30% to wants (dining out, subscriptions, hobbies), and 20% to savings and extra debt repayment. The rule was popularized by Senator Elizabeth Warren in the book 'All Your Worth.'",
  },
  {
    id: "budget-emergency",
    publisher: "CFPB",
    title: "Emergency fund guidance",
    topic: "budgeting",
    text: "A common guideline is to build an emergency fund equal to 3-6 months of essential expenses, kept in a liquid account such as a high-yield savings account. Larger buffers are appropriate for variable-income earners, single-income households, or higher job-loss risk.",
  },
  {
    id: "budget-irregular",
    publisher: "Consumer education",
    title: "Budgeting with irregular income",
    topic: "budgeting",
    text: "With irregular income (freelance, commission, seasonal work) the standard percentage rules are hard to apply month-to-month. A common adaptation is to compute a baseline from the lowest-earning months, prioritize fixed needs first, build a larger emergency buffer (6-12 months), and smooth savings by treating each paycheck as contributing a percentage to a 'pay-yourself-first' account.",
  },
];

// Very small lexical retriever: tokenize, overlap count with optional topic bonus.
export function retrieve(query, k = 5, topic = null) {
  const qTerms = tokenize(query);
  const scored = KB_PASSAGES.map((p) => {
    const pTerms = tokenize(p.title + " " + p.text);
    let overlap = 0;
    for (const t of qTerms) if (pTerms.has(t)) overlap += 1;
    const topicBoost = topic && p.topic === topic ? 3 : 0;
    return { ...p, score: overlap + topicBoost };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

const STOPWORDS = new Set(
  "a an and are as at be but by for from have has how i if in is it of on or that the their to was we what when where which who why will with you your".split(" ")
);
function tokenize(s) {
  const out = new Set();
  for (const raw of String(s).toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw && raw.length > 2 && !STOPWORDS.has(raw)) out.add(raw);
  }
  return out;
}
