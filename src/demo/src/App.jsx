import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  ALL_QUESTIONS, DATASETS, TOPICS, DATASET_LABELS, TOPIC_LABELS,
  countsByDataset, countsByTopic,
  HAS_RESULTS, BASELINE_MODEL, RAG_MODEL,
  computeMetrics, metricsByTopic, metricsByDataset,
  topComparisonWins, topMcFlip,
} from "./data.js";
import DemoTab from "./DemoTab.jsx";
import { KB_PASSAGES } from "./kb.js";

// ── Palette (kept from original demo) ─────────────────────────────────────────
const palette = {
  bg: "#0a0f1a", surface: "#111827", surfaceAlt: "#1a2236",
  border: "#1e2a42", borderLight: "#2a3a5c",
  text: "#e2e8f0", textMuted: "#8896b3",
  accent: "#22d3a7", accentDim: "rgba(34,211,167,0.12)",
  danger: "#f87171", dangerDim: "rgba(248,113,113,0.12)",
  warn: "#fbbf24", warnDim: "rgba(251,191,36,0.12)",
  blue: "#60a5fa", blueDim: "rgba(96,165,250,0.12)",
};
const mono = "'JetBrains Mono', monospace";
const display = "'Space Grotesk', sans-serif";

// ── Shared bits ───────────────────────────────────────────────────────────────
function Badge({ children, color, bg }) {
  return (
    <span style={{
      display: "inline-block", fontSize: 11, fontWeight: 600, color, background: bg,
      borderRadius: 6, padding: "3px 10px", letterSpacing: "0.04em", fontFamily: mono,
    }}>{children}</span>
  );
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: palette.surface, border: `1px solid ${palette.border}`,
      borderRadius: 12, padding: "20px 24px", flex: "1 1 180px", minWidth: 160,
    }}>
      <div style={{ fontSize: 12, color: palette.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontFamily: mono }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: color || palette.text, fontFamily: display, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: palette.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function PlaceholderBanner({ text }) {
  return (
    <div style={{
      background: palette.warnDim, border: `1px solid ${palette.warn}`, borderRadius: 10,
      padding: "10px 14px", color: palette.warn, fontSize: 12, fontFamily: mono, marginBottom: 20,
    }}>
      ⚠ {text}
    </div>
  );
}

function difficultyColor(d) {
  return d === "Advanced" ? palette.danger : d === "Intermediate" ? palette.warn : palette.accent;
}
function difficultyBg(d) {
  return d === "Advanced" ? palette.dangerDim : d === "Intermediate" ? palette.warnDim : palette.accentDim;
}

// ── Tab: Architecture ─────────────────────────────────────────────────────────
function PipelineTab() {
  const baselineSteps = [
    { label: "User Query", desc: "e.g. \"What is the 401(k) contribution limit for 2025?\"", icon: "💬", color: palette.blue },
    { label: "Qwen2.5-3B-Instruct (Baseline)", desc: "Open-weights model, run locally via HuggingFace Transformers. No retrieval, no tools — greedy decoding with a system prompt that asks for careful personal-finance answers.", icon: "🤖", color: palette.textMuted },
    { label: "Baseline Answer", desc: "Returned directly; graded by MC letter match, embedding cosine vs. reference, and an LLM-as-judge rubric.", icon: "↩️", color: palette.textMuted },
  ];
  const ragSteps = [
    { label: "User Query", desc: "Same input as the baseline.", icon: "💬", color: palette.blue },
    { label: "BGE Embedding", desc: "`BAAI/bge-small-en-v1.5` encodes the query into a normalized dense vector.", icon: "🧬", color: palette.warn },
    { label: "Chroma Retrieval (k=5)", desc: "Queries the persistent ChromaDB store at src/knowledge_base/vector_store/, optionally filtered by the question's topic. KB contents: IRS Pubs 525/550/560/590-A/590-B/969/970, CFPB consumer guides, SEC investor.gov, SSA Pub 05-10035, HealthCare.gov.", icon: "🔎", color: palette.warn },
    { label: "Claude Sonnet 4.6 (Grounded Generation)", desc: "Retrieved chunks are injected with [1]…[k] indices. System prompt instructs Claude to cite sources inline and refuse when evidence is insufficient.", icon: "🤖", color: palette.accent },
    { label: "LLM-as-Judge (Claude Sonnet 4.6)", desc: "Second Claude call scores the answer 1–5 on factuality, completeness, and advice_quality. Same judge is applied to the baseline for apples-to-apples comparison.", icon: "⚖️", color: palette.accent },
    { label: "Verified Response", desc: "Inline [n] citations + retrieved source metadata returned to the user.", icon: "✅", color: palette.accent },
  ];

  return (
    <div>
      <div style={{
        background: palette.blueDim, border: `1px solid ${palette.blue}`, borderRadius: 10,
        padding: "10px 14px", color: palette.blue, fontSize: 12, fontFamily: mono, marginBottom: 20,
      }}>
        ◆ Diagram reflects the current implementation in <code>src/eval/</code>, <code>src/knowledge_base/</code>, and <code>src/notebooks/</code>. Metrics shown elsewhere are initial results from this week's runs; a full-dataset evaluation is scheduled for this weekend.
      </div>

      <div style={{ fontSize: 13, color: palette.textMuted, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Baseline path — src/notebooks/baseline_eval.ipynb</div>
      <PipelineColumn steps={baselineSteps} />

      <div style={{ height: 24 }} />
      <div style={{ fontSize: 13, color: palette.textMuted, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>FinVerify (RAG + Verification) — src/notebooks/rag_eval.ipynb</div>
      <PipelineColumn steps={ragSteps} />

      <div style={{ marginTop: 28, background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 12, padding: "16px 20px" }}>
        <div style={{ fontSize: 13, color: palette.textMuted, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Knowledge base sources</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, fontSize: 13, color: palette.text }}>
          {[
            ["IRS", "Pubs 525, 550, 560, 590-A, 590-B, 969, 970"],
            ["CFPB", "Consumer credit, debt, mortgage guides"],
            ["SEC", "investor.gov beginner guides, asset allocation"],
            ["SSA", "Publication 05-10035 (retirement benefits)"],
            ["HealthCare.gov", "HMO/PPO, marketplace basics"],
          ].map(([pub, desc]) => (
            <div key={pub} style={{ background: palette.surfaceAlt, borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ color: palette.accent, fontFamily: mono, fontSize: 12, marginBottom: 2 }}>{pub}</div>
              <div style={{ color: palette.textMuted, fontSize: 12 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PipelineColumn({ steps }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, alignItems: "center" }}>
      {steps.map((step, i) => (
        <div key={i} style={{ width: "100%", maxWidth: 640 }}>
          <div style={{
            background: palette.surface, border: `1px solid ${palette.border}`,
            borderLeft: `3px solid ${step.color}`, borderRadius: 12,
            padding: "14px 22px", display: "flex", gap: 16, alignItems: "flex-start",
          }}>
            <div style={{ fontSize: 26, flexShrink: 0, lineHeight: 1 }}>{step.icon}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: palette.text, marginBottom: 4 }}>{step.label}</div>
              <div style={{ fontSize: 12, color: palette.textMuted, lineHeight: 1.55 }}>{step.desc}</div>
            </div>
          </div>
          {i < steps.length - 1 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 0" }}>
              <div style={{ width: 2, height: 14, background: palette.borderLight }} />
              <div style={{ fontSize: 14, color: palette.borderLight, lineHeight: 1 }}>▼</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Tab: Dataset ──────────────────────────────────────────────────────────────
function DatasetTab() {
  const [datasetFilter, setDatasetFilter] = useState("all");
  const [topicFilter, setTopicFilter] = useState("all");

  const filtered = useMemo(() => {
    return ALL_QUESTIONS.filter(
      (q) =>
        (datasetFilter === "all" || q.dataset === datasetFilter) &&
        (topicFilter === "all" || q.topic === topicFilter)
    );
  }, [datasetFilter, topicFilter]);

  const dsCounts = countsByDataset();
  const topicCounts = countsByTopic();

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
        <MetricCard label="Total Questions" value={ALL_QUESTIONS.length} sub={`${DATASETS.length} subsets · ${TOPICS.length} topics`} />
        {DATASETS.map((d) => (
          <MetricCard key={d} label={DATASET_LABELS[d] || d} value={dsCounts[d] || 0} sub="items" color={palette.blue} />
        ))}
      </div>

      <FilterRow label="DATASET" options={[["all", "All"], ...DATASETS.map((d) => [d, DATASET_LABELS[d] || d])]} value={datasetFilter} onChange={setDatasetFilter} />
      <FilterRow label="TOPIC" options={[["all", "All"], ...TOPICS.map((t) => [t, `${TOPIC_LABELS[t] || t} (${topicCounts[t]})`])]} value={topicFilter} onChange={setTopicFilter} />

      <div style={{ fontSize: 12, color: palette.textMuted, fontFamily: mono, marginBottom: 10 }}>
        Showing {filtered.length} of {ALL_QUESTIONS.length} questions
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 720, overflowY: "auto", paddingRight: 6 }}>
        {filtered.slice(0, 200).map((q) => (
          <div key={q.uid} style={{
            background: palette.surface, border: `1px solid ${palette.border}`,
            borderRadius: 12, padding: "14px 18px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, color: palette.text, fontWeight: 500, lineHeight: 1.5, flex: "1 1 300px" }}>{q.question}</span>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                <Badge color={palette.textMuted} bg={palette.surfaceAlt}>{q.datasetLabel}</Badge>
                <Badge color={palette.blue} bg={palette.blueDim}>{q.topicLabel}</Badge>
                <Badge color={difficultyColor(q.difficulty)} bg={difficultyBg(q.difficulty)}>{q.difficulty}</Badge>
                <Badge color={palette.textMuted} bg={palette.surfaceAlt}>{q.type === "multiple_choice" ? "MC" : "OE"}</Badge>
              </div>
            </div>
            {q.options && (
              <div style={{ fontSize: 12, color: palette.textMuted, marginBottom: 6, lineHeight: 1.6 }}>
                {q.options.map((o) => <div key={o}>{o}</div>)}
              </div>
            )}
            <div style={{ fontSize: 13, color: palette.accent, fontFamily: mono, lineHeight: 1.55 }}>
              ✓ {q.displayAnswer}
            </div>
            {(q.source || q.tags?.length) && (
              <div style={{ fontSize: 11, color: palette.textMuted, marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
                {q.source && <span>Source: {q.source}</span>}
                {q.tags?.length > 0 && <span>Tags: {q.tags.slice(0, 5).join(", ")}</span>}
              </div>
            )}
          </div>
        ))}
        {filtered.length > 200 && (
          <div style={{ color: palette.textMuted, fontSize: 12, textAlign: "center", padding: 10 }}>
            +{filtered.length - 200} more (refine filters to see the rest)
          </div>
        )}
      </div>
    </div>
  );
}

function FilterRow({ label, options, value, onChange }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: palette.textMuted, marginBottom: 6, fontFamily: mono }}>{label}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {options.map(([val, lbl]) => (
          <button key={val} onClick={() => onChange(val)} style={{
            background: value === val ? palette.accent : palette.surfaceAlt,
            color: value === val ? palette.bg : palette.textMuted,
            border: `1px solid ${value === val ? palette.accent : palette.border}`,
            borderRadius: 8, padding: "5px 14px", fontSize: 12, fontWeight: 600,
            cursor: "pointer", fontFamily: mono, transition: "all 0.15s",
          }}>{lbl}</button>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Comparison — curated 5 cases showing grounding win ──────────────────
const COMPARISON_CASES = [
  {
    lookup: { dataset: "standard_questions", topic: "retirement", id: "ret-001" },
    fallbackQuestion: "What is the maximum 401(k) employee elective deferral limit for 2025 for someone under age 50?",
    fallbackReference: "D — $23,500",
    kind: "MC",
    baseline: {
      answer: "B — $22,500. The 401(k) employee contribution limit for 2025 is $22,500 for workers under 50.",
      issue: "Repeats the 2023 figure. The model's training data predates IRS Notice 2024-80 which raised the limit to $23,500 for 2025.",
      verdict: "INCORRECT",
    },
    passages: ["irs-560-401k-2025"],
    finverify: {
      answer:
        "D — $23,500. For 2025 the IRS raised the 401(k) employee elective deferral limit to $23,500 for participants under age 50, up from $23,000 in 2024 [1]. The standard age-50 catch-up contribution remains $7,500, and a new higher catch-up of $11,250 applies to employees aged 60–63 [1].",
      verdict: "CORRECT",
      winNote: "Retrieved passage [1] contains the exact 2025 figure. Without retrieval, the baseline had no way to know the limit was updated.",
    },
  },
  {
    lookup: { dataset: "standard_questions", topic: "tax", id: "tax-002" },
    fallbackQuestion: "What is the capital gains tax rate for someone in the 32% income bracket who sells stock held for 14 months?",
    fallbackReference: "B — 15% long-term capital gains rate",
    kind: "MC",
    baseline: {
      answer: "C — 32%. Since the investor is in the 32% ordinary income bracket, the gain is taxed at that rate.",
      issue: "Fails to apply the one-year holding-period rule. 14 months > 1 year, so the gain is long-term, not short-term.",
      verdict: "INCORRECT",
    },
    passages: ["irs-409-capgains"],
    finverify: {
      answer:
        "B — 15%. Gains on assets held more than one year are long-term capital gains, taxed at 0%, 15%, or 20% depending on taxable income, not ordinary income rates [1]. For a single filer in the 32% ordinary bracket the applicable long-term rate is 15% [1]. The 20% rate only applies at much higher incomes.",
      verdict: "CORRECT",
      winNote: "Retrieval surfaced IRS Topic 409. The citation makes the holding-period rule and bracket mapping explicit — the baseline never accessed this.",
    },
  },
  {
    lookup: { dataset: "standard_questions", topic: "retirement", id: "ret-002" },
    fallbackQuestion: "Can a 72-year-old with earned income contribute to a Roth IRA?",
    fallbackReference: "C — Yes, as long as they have earned income and meet income limits",
    kind: "MC",
    baseline: {
      answer: "A — No. Individuals over 70½ generally cannot contribute to IRAs.",
      issue: "Two errors: Roth IRAs never had an age limit, and the SECURE Act (2019) removed the age 70½ cap for traditional IRAs as well.",
      verdict: "INCORRECT",
    },
    passages: ["irs-590a-roth-age"],
    finverify: {
      answer:
        "C — Yes. There is no age limit on Roth IRA contributions; the only requirements are earned income and MAGI below the phase-out thresholds [1]. The SECURE Act of 2019 also removed the age 70½ limit on traditional IRA contributions [1].",
      verdict: "CORRECT",
      winNote: "IRS Pub 590-A is the authoritative source. Retrieving it directly prevents the common SECURE-Act omission seen in pre-2020 training data.",
    },
  },
  {
    lookup: { dataset: "open_ended_hard", topic: "investing", id: "inv-004" },
    fallbackQuestion: "Why can diversification reduce risk without guaranteeing that an investor won't lose money?",
    fallbackReference:
      "Diversification reduces idiosyncratic (asset-specific) risk but cannot eliminate systematic (market-wide) risk. In broad downturns, correlated assets all fall.",
    kind: "OE",
    baseline: {
      answer:
        "Diversification reduces risk by spreading investments across different assets. If one stock does badly, others might do well, which protects your overall portfolio. A well-diversified portfolio shouldn't lose much money over time.",
      issue: "Conflates idiosyncratic and systematic risk, and implicitly overstates the protective effect — in a broad-market crash diversified portfolios still decline substantially.",
      verdict: "INCOMPLETE",
    },
    passages: ["sec-diversification"],
    finverify: {
      answer:
        "Diversification spreads exposure across asset classes, sectors, and geographies, which lowers idiosyncratic (single-asset) risk — a bad outcome for any one holding is diluted by the rest of the portfolio [1]. However, it cannot remove systematic (market-wide) risk: events that move the entire market, such as recessions or global rate shocks, can push correlated assets down together [1]. So a diversified portfolio is robust to firm-specific shocks but still exposed to market-level drawdowns.",
      verdict: "CORRECT",
      winNote: "The SEC investor.gov definition draws the exact idiosyncratic-vs-systematic distinction. Baseline omitted it and ended up overselling diversification.",
    },
  },
  {
    lookup: { dataset: "open_ended_hard", topic: "budgeting", id: "bud-008" },
    fallbackQuestion:
      "If someone gets paid irregularly as a freelancer, is the standard 50/30/20 advice useful or misleading, and why?",
    fallbackReference:
      "It's partially useful but misleading applied month-to-month. Freelancers should budget off a conservative baseline (lowest-earning months), build a larger emergency buffer (6–12 months), and smooth savings via pay-yourself-first transfers.",
    kind: "OE",
    baseline: {
      answer:
        "The 50/30/20 rule works for anyone — 50% needs, 30% wants, 20% savings. Freelancers just need to apply it to each paycheck as it comes in.",
      issue: "Treats irregular-income budgeting identically to salaried-income budgeting. Ignores the need for a larger buffer and the month-to-month variability that makes strict percentage rules brittle.",
      verdict: "INCOMPLETE",
    },
    passages: ["budget-503020", "budget-irregular", "budget-emergency"],
    finverify: {
      answer:
        "The 50/30/20 rule — 50% needs, 30% wants, 20% savings and extra debt repayment — is a useful starting heuristic [1], but applied literally month-to-month it becomes misleading for freelancers. A common adaptation is to compute the baseline budget from the lowest-earning months, prioritize fixed needs first, and use a 'pay-yourself-first' transfer to smooth savings [2]. Freelancers should also target a larger emergency fund — 6–12 months of essential expenses rather than the typical 3–6 — because income volatility compounds job-loss risk [2][3]. In short, the ratios are a useful frame; the brittle part is applying them to every paycheck instead of to a conservative income baseline.",
      verdict: "CORRECT",
      winNote: "Three complementary KB passages were retrieved. The answer cites each one for a distinct claim, and tradeoffs get surfaced that the baseline skipped.",
    },
  },
];

function highlightCitations(text) {
  const parts = String(text).split(/(\[\d+\])/g);
  return parts.map((p, i) => /^\[\d+\]$/.test(p) ? (
    <span key={i} style={{ background: palette.accentDim, color: palette.accent, padding: "0 6px", borderRadius: 5, fontFamily: mono, fontSize: 12, fontWeight: 600 }}>{p}</span>
  ) : (
    <span key={i}>{p}</span>
  ));
}

function ComparisonTab() {
  const realCases = useMemo(() => {
    if (!HAS_RESULTS) return [];
    const oeWins = topComparisonWins(4);
    const mcFlip = topMcFlip();
    const out = [];
    if (mcFlip) out.push(mcFlip);
    out.push(...oeWins);
    return out;
  }, []);

  // Fallback to the curated cases if results haven't been generated yet.
  const fallbackCases = useMemo(() => {
    return COMPARISON_CASES.map((c) => {
      const q = ALL_QUESTIONS.find(
        (x) => x.dataset === c.lookup.dataset && x.topic === c.lookup.topic && x.id === c.lookup.id
      );
      const passages = c.passages
        .map((pid) => KB_PASSAGES.find((p) => p.id === pid))
        .filter(Boolean);
      return {
        ...c,
        kind: "curated",
        question: q?.question || c.fallbackQuestion,
        reference: q?.displayAnswer || c.fallbackReference,
        datasetLabel: DATASET_LABELS[c.lookup.dataset] || c.lookup.dataset,
        topicLabel: TOPIC_LABELS[c.lookup.topic] || c.lookup.topic,
        difficulty: q?.difficulty || (c.lookup.dataset === "open_ended_hard" ? "Advanced" : "Intermediate"),
        passages,
      };
    });
  }, []);

  const useReal = realCases.length > 0;
  const cases = useReal ? realCases : fallbackCases;

  return (
    <div>
      <div style={{
        background: useReal ? palette.accentDim : palette.warnDim,
        border: `1px solid ${useReal ? palette.accent : palette.warn}`,
        borderRadius: 10, padding: "10px 14px",
        color: useReal ? palette.accent : palette.warn,
        fontSize: 12, fontFamily: mono, marginBottom: 20,
      }}>
        {useReal ? (
          <>
            ★ Real results from <code>src/notebooks/results/</code>: top {cases.length} items where Claude 4.6 + RAG outperformed the Qwen2.5-3B baseline by the largest LLM-judge margin (one MC flip + open-ended wins). Each card shows the actual generated answers, the actual retrieved KB chunks, and the actual judge scores.
          </>
        ) : (
          <>
            ⚠ No <code>results/baseline_*</code> or <code>results/rag_*</code> files found yet — falling back to curated examples. Run <code>baseline_eval.ipynb</code> and <code>rag_eval.ipynb</code> to populate this tab with real data.
          </>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {cases.map((c, i) =>
          useReal
            ? <RealComparisonCase key={c.id || i} c={c} idx={i} />
            : <ComparisonCase key={i} c={c} idx={i} />
        )}
      </div>
    </div>
  );
}

function RealComparisonCase({ c, idx }) {
  const isMc = c.type === "multiple_choice";
  return (
    <div style={{ background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 12, padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          <Badge color={palette.textMuted} bg={palette.surfaceAlt}>#{idx + 1}</Badge>
          <Badge color={palette.textMuted} bg={palette.surfaceAlt}>{c.id}</Badge>
          <Badge color={palette.textMuted} bg={palette.surfaceAlt}>{c.datasetLabel}</Badge>
          <Badge color={palette.blue} bg={palette.blueDim}>{c.topicLabel}</Badge>
          <Badge color={palette.textMuted} bg={palette.surfaceAlt}>{isMc ? "MC" : "OE"}</Badge>
          {!isMc && (
            <Badge color={palette.accent} bg={palette.accentDim}>
              Δ judge +{c.delta?.toFixed(2) ?? "—"}
            </Badge>
          )}
        </div>
        <div style={{ fontSize: 15, color: palette.text, fontWeight: 600, lineHeight: 1.5 }}>{c.question}</div>
        <div style={{ fontSize: 12, color: palette.accent, marginTop: 6, fontFamily: mono, lineHeight: 1.5 }}>
          Reference: {String(c.reference || "").slice(0, 320)}{(c.reference || "").length > 320 ? "…" : ""}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 12 }}>
        {/* Baseline */}
        <div style={{ background: palette.bg, border: `1px solid ${palette.danger}`, borderRadius: 10, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontFamily: mono, color: palette.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Baseline · {BASELINE_MODEL || "Qwen-3B"}
            </span>
            {isMc ? (
              <Badge color={palette.danger} bg={palette.dangerDim}>
                picked {c.baselinePicked || "—"} · INCORRECT
              </Badge>
            ) : (
              <Badge color={palette.danger} bg={palette.dangerDim}>
                judge {c.baselineJudge?.mean?.toFixed(2) ?? "—"}
              </Badge>
            )}
          </div>
          <div style={{ fontSize: 13, color: palette.text, lineHeight: 1.6, marginBottom: 10, whiteSpace: "pre-wrap" }}>
            {c.baselineCandidate}
          </div>
          {!isMc && c.baselineJudge?.rationale && (
            <div style={{
              background: palette.dangerDim, borderLeft: `3px solid ${palette.danger}`,
              borderRadius: 6, padding: "8px 10px", fontSize: 11, color: palette.danger, fontFamily: mono, lineHeight: 1.55,
            }}>
              ⚠ Judge: {c.baselineJudge.rationale}
            </div>
          )}
        </div>

        {/* FinVerify */}
        <div style={{ background: palette.bg, border: `1px solid ${palette.accent}`, borderRadius: 10, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontFamily: mono, color: palette.accent, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              FinVerify · {RAG_MODEL || "Claude 4.6"} + RAG
            </span>
            {isMc ? (
              <Badge color={palette.accent} bg={palette.accentDim}>
                picked {c.ragPicked || "—"} · CORRECT
              </Badge>
            ) : (
              <Badge color={palette.accent} bg={palette.accentDim}>
                judge {c.ragJudge?.mean?.toFixed(2) ?? "—"}
              </Badge>
            )}
          </div>
          <div style={{ fontSize: 13, color: palette.text, lineHeight: 1.65, marginBottom: 10, whiteSpace: "pre-wrap" }}>
            {highlightCitations(c.ragCandidate)}
          </div>
          {!isMc && c.ragJudge?.rationale && (
            <div style={{
              background: palette.accentDim, borderLeft: `3px solid ${palette.accent}`,
              borderRadius: 6, padding: "8px 10px", fontSize: 11, color: palette.accent, fontFamily: mono, lineHeight: 1.55,
            }}>
              🔍 Judge: {c.ragJudge.rationale}
            </div>
          )}
        </div>
      </div>

      {/* Retrieved KB chunks (real, from results) */}
      {c.retrieved && c.retrieved.length > 0 && (
        <div style={{
          background: palette.surfaceAlt, borderRadius: 10, padding: "12px 14px",
          border: `1px dashed ${palette.borderLight}`,
        }}>
          <div style={{ fontSize: 10, fontFamily: mono, color: palette.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Retrieved from KB ({c.retrieved.length} chunks · {c.nCitations} cited · coverage {(c.citationCoverage * 100).toFixed(0)}%)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {c.retrieved.map((p, i) => (
              <div key={i} style={{
                background: palette.surface, borderLeft: `3px solid ${palette.accent}`,
                borderRadius: 6, padding: "6px 12px",
              }}>
                <div style={{ fontSize: 11, fontFamily: mono, color: palette.accent }}>
                  [{i + 1}] {p.publisher} — {p.title}
                </div>
                <div style={{ fontSize: 10, fontFamily: mono, color: palette.textMuted }}>
                  source: {p.source_slug || "?"} · distance {p.distance?.toFixed?.(3) ?? "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ComparisonCase({ c, idx }) {
  const baselineBad = c.baseline.verdict !== "CORRECT";
  return (
    <div style={{ background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 12, padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          <Badge color={palette.textMuted} bg={palette.surfaceAlt}>#{idx + 1}</Badge>
          <Badge color={palette.textMuted} bg={palette.surfaceAlt}>{c.datasetLabel}</Badge>
          <Badge color={palette.blue} bg={palette.blueDim}>{c.topicLabel}</Badge>
          <Badge color={difficultyColor(c.difficulty)} bg={difficultyBg(c.difficulty)}>{c.difficulty}</Badge>
          <Badge color={palette.textMuted} bg={palette.surfaceAlt}>{c.kind}</Badge>
        </div>
        <div style={{ fontSize: 15, color: palette.text, fontWeight: 600, lineHeight: 1.5 }}>{c.question}</div>
        <div style={{ fontSize: 12, color: palette.accent, marginTop: 6, fontFamily: mono }}>
          Reference: {c.reference}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 12 }}>
        <div style={{
          background: palette.bg, border: `1px solid ${baselineBad ? palette.danger : palette.accent}`,
          borderRadius: 10, padding: 14,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontFamily: mono, color: palette.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Baseline (no retrieval)</span>
            <Badge color={baselineBad ? palette.danger : palette.accent} bg={baselineBad ? palette.dangerDim : palette.accentDim}>{c.baseline.verdict}</Badge>
          </div>
          <div style={{ fontSize: 13, color: palette.text, lineHeight: 1.6, marginBottom: 10 }}>{c.baseline.answer}</div>
          <div style={{
            background: palette.dangerDim, borderLeft: `3px solid ${palette.danger}`,
            borderRadius: 6, padding: "8px 10px", fontSize: 11, color: palette.danger, fontFamily: mono, lineHeight: 1.55,
          }}>
            ⚠ {c.baseline.issue}
          </div>
        </div>

        <div style={{
          background: palette.bg, border: `1px solid ${palette.accent}`,
          borderRadius: 10, padding: 14,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontFamily: mono, color: palette.accent, textTransform: "uppercase", letterSpacing: "0.08em" }}>FinVerify · Claude 4.6 + RAG</span>
            <Badge color={palette.accent} bg={palette.accentDim}>{c.finverify.verdict}</Badge>
          </div>
          <div style={{ fontSize: 13, color: palette.text, lineHeight: 1.65, marginBottom: 10 }}>
            {highlightCitations(c.finverify.answer)}
          </div>
          <div style={{
            background: palette.accentDim, borderLeft: `3px solid ${palette.accent}`,
            borderRadius: 6, padding: "8px 10px", fontSize: 11, color: palette.accent, fontFamily: mono, lineHeight: 1.55,
          }}>
            🔍 {c.finverify.winNote}
          </div>
        </div>
      </div>

      <div style={{
        background: palette.surfaceAlt, borderRadius: 10, padding: "12px 14px",
        border: `1px dashed ${palette.borderLight}`,
      }}>
        <div style={{ fontSize: 10, fontFamily: mono, color: palette.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          Retrieved from knowledge base — these passages ground the FinVerify answer
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {c.passages.map((p, i) => (
            <div key={p.id} style={{
              background: palette.surface, borderLeft: `3px solid ${palette.accent}`,
              borderRadius: 6, padding: "8px 12px",
            }}>
              <div style={{ fontSize: 11, fontFamily: mono, color: palette.accent, marginBottom: 3 }}>
                [{i + 1}] {p.publisher} — {p.title}
              </div>
              <div style={{ fontSize: 12, color: palette.textMuted, lineHeight: 1.55 }}>{p.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Metrics — real numbers computed from src/notebooks/results/ ─────────
function MetricsTab() {
  const m = useMemo(() => computeMetrics(), []);
  const topicRows = useMemo(() => metricsByTopic(), []);
  const datasetRows = useMemo(() => metricsByDataset(), []);

  if (!m) {
    return (
      <div style={{
        background: palette.warnDim, border: `1px solid ${palette.warn}`, borderRadius: 10,
        padding: "12px 16px", color: palette.warn, fontSize: 13, fontFamily: mono,
      }}>
        ⚠ No eval results found at <code>src/notebooks/results/</code>. Run <code>baseline_eval.ipynb</code> and <code>rag_eval.ipynb</code> to populate this tab.
      </div>
    );
  }

  const pct = (x) => (x == null ? "—" : `${(x * 100).toFixed(0)}%`);
  const num2 = (x) => (x == null ? "—" : x.toFixed(2));

  const judgeChartData = topicRows.map((r) => ({
    topic: r.topicLabel,
    "Qwen Baseline": r.baselineJudge,
    "Claude + RAG": r.ragJudge,
  }));

  const datasetChartData = datasetRows.map((r) => ({
    dataset: r.datasetLabel,
    "Qwen Baseline": r.baselineJudge,
    "Claude + RAG": r.ragJudge,
  }));

  return (
    <div>
      <div style={{
        background: palette.accentDim, border: `1px solid ${palette.accent}`, borderRadius: 10,
        padding: "10px 14px", color: palette.accent, fontSize: 12, fontFamily: mono, marginBottom: 20,
      }}>
        ★ Live from <code>src/notebooks/results/</code> · n={m.n} questions ·
        baseline = <b>{BASELINE_MODEL || "?"}</b> · RAG = <b>{RAG_MODEL || "?"}</b>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
        <MetricCard label="Dataset" value={m.n} sub={`${DATASETS.length} subsets`} />
        <MetricCard label="Baseline MC" value={pct(m.mc.baseline)} sub="Qwen2.5-3B" color={palette.danger} />
        <MetricCard label="FinVerify MC" value={pct(m.mc.rag)} sub="Claude + RAG" color={palette.accent} />
        <MetricCard label="Citation Coverage" value={num2(m.citationCoverage.rag)} sub="cited / retrieved (RAG)" color={palette.blue} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
        <ChartCard title="LLM Judge Mean by Topic (1–5)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={judgeChartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
              <XAxis dataKey="topic" tick={{ fill: palette.textMuted, fontSize: 11 }} axisLine={{ stroke: palette.border }} tickLine={false} />
              <YAxis domain={[0, 5]} tick={{ fill: palette.textMuted, fontSize: 11 }} axisLine={{ stroke: palette.border }} tickLine={false} />
              <Tooltip contentStyle={{ background: palette.surfaceAlt, border: `1px solid ${palette.border}`, borderRadius: 8, color: palette.text, fontSize: 12 }} formatter={(v) => v?.toFixed?.(2) ?? v} />
              <Legend wrapperStyle={{ fontSize: 11, color: palette.textMuted }} />
              <Bar dataKey="Qwen Baseline" fill={palette.danger} radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="Claude + RAG" fill={palette.accent} radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="LLM Judge Mean by Dataset (1–5)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={datasetChartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
              <XAxis dataKey="dataset" tick={{ fill: palette.textMuted, fontSize: 11 }} axisLine={{ stroke: palette.border }} tickLine={false} />
              <YAxis domain={[0, 5]} tick={{ fill: palette.textMuted, fontSize: 11 }} axisLine={{ stroke: palette.border }} tickLine={false} />
              <Tooltip contentStyle={{ background: palette.surfaceAlt, border: `1px solid ${palette.border}`, borderRadius: 8, color: palette.text, fontSize: 12 }} formatter={(v) => v?.toFixed?.(2) ?? v} />
              <Legend wrapperStyle={{ fontSize: 11, color: palette.textMuted }} />
              <Bar dataKey="Qwen Baseline" fill={palette.danger} radius={[4, 4, 0, 0]} barSize={24} />
              <Bar dataKey="Claude + RAG" fill={palette.accent} radius={[4, 4, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <MetricCard label="Judge mean — base" value={num2(m.judge.baseline)} sub="all OE items, 1–5" color={palette.danger} />
        <MetricCard label="Judge mean — RAG" value={num2(m.judge.rag)} sub="all OE items, 1–5" color={palette.accent} />
        <MetricCard label="Cosine — base" value={num2(m.cosine.baseline)} sub="BGE-small vs reference" color={palette.danger} />
        <MetricCard label="Cosine — RAG" value={num2(m.cosine.rag)} sub="BGE-small vs reference" color={palette.accent} />
      </div>

      <div style={{ background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 12, padding: "16px 20px" }}>
        <div style={{ fontSize: 13, color: palette.textMuted, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Evaluation signals</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: palette.text, fontSize: 13, lineHeight: 1.7 }}>
          <li><b>Multiple-choice accuracy</b> — exact letter match (A/B/C/D) for <code>standard_questions</code>.</li>
          <li><b>Embedding cosine</b> — <code>BAAI/bge-small-en-v1.5</code> similarity between answer and reference for open-ended items.</li>
          <li><b>LLM-as-judge</b> — Claude Sonnet 4.6 scores factuality / completeness / advice_quality on a 1–5 scale.</li>
          <li><b>Citation coverage</b> — fraction of retrieved chunks the FinVerify answer actually cites (RAG-only).</li>
        </ul>
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{ background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 12, padding: 18 }}>
      <div style={{ fontSize: 12, color: palette.textMuted, fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
const TABS = [
  { key: "pipeline", label: "Architecture" },
  { key: "dataset", label: "Dataset" },
  { key: "demo", label: "Live Demo" },
  { key: "compare", label: "Comparison" },
  { key: "metrics", label: "Metrics" },
];

export default function App() {
  const [tab, setTab] = useState("pipeline");

  return (
    <div style={{ minHeight: "100vh", background: palette.bg, color: palette.text, fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet" />

      <div style={{ borderBottom: `1px solid ${palette.border}`, padding: "20px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${palette.accent}, ${palette.blue})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 16, color: palette.bg, fontFamily: display,
          }}>FV</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: display, letterSpacing: "-0.02em" }}>FinVerify</div>
            <div style={{ fontSize: 11, color: palette.textMuted, fontFamily: mono }}>Hybrid Verification for LLM Financial Advisors</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: palette.textMuted, fontFamily: mono }}>
          COMS 6156 · Nikhil Sharma · ns3942
        </div>
      </div>

      <div style={{ borderBottom: `1px solid ${palette.border}`, padding: "0 32px", display: "flex" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: "none", border: "none",
            borderBottom: tab === t.key ? `2px solid ${palette.accent}` : "2px solid transparent",
            padding: "14px 20px", fontSize: 13, fontWeight: 600,
            color: tab === t.key ? palette.accent : palette.textMuted, cursor: "pointer",
            fontFamily: mono, transition: "all 0.15s",
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>
        {tab === "pipeline" && <PipelineTab />}
        {tab === "dataset" && <DatasetTab />}
        {tab === "demo" && <DemoTab />}
        {tab === "compare" && <ComparisonTab />}
        {tab === "metrics" && <MetricsTab />}
      </div>
    </div>
  );
}
