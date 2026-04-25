// Eagerly pull every dataset JSON at build time.
// Vite walks `../../../dataset/` (the repo-root `dataset/`) and inlines the JSON.
const modules = import.meta.glob(
  [
    "../../../dataset/standard_questions/*.json",
    "../../../dataset/open_ended_hard/*.json",
    "../../../dataset/reddit_questions/*.json",
  ],
  { eager: true, import: "default" }
);

const TOPIC_LABELS = {
  budgeting: "Budgeting",
  credit_and_debt: "Credit & Debt",
  insurance: "Insurance",
  investing: "Investing",
  retirement: "Retirement",
  tax: "Tax",
};

const DATASET_LABELS = {
  standard_questions: "Standard (MC)",
  open_ended_hard: "Open-Ended (Hard)",
  reddit_questions: "Reddit (r/personalfinance)",
};

function parsePath(p) {
  // Example: "../../../dataset/standard_questions/retirement.json"
  const parts = p.split("/");
  const file = parts[parts.length - 1];
  const dataset = parts[parts.length - 2];
  const topic = file.replace(/\.json$/, "");
  return { dataset, topic };
}

function normalizeDifficulty(raw, datasetKey) {
  if (datasetKey === "open_ended_hard") return "Advanced";
  if (!raw) return "Basic";
  const s = String(raw).toLowerCase();
  if (s.includes("hard") || s.includes("advanced")) return "Advanced";
  if (s.includes("intermediate")) return "Intermediate";
  return "Basic";
}

function shortAnswer(text, datasetKey) {
  if (!text) return "";
  // Reddit reference answers are long multi-paragraph essays; trim for display.
  if (datasetKey === "reddit_questions") {
    const plain = String(text).replace(/\s+/g, " ").trim();
    return plain.length > 260 ? plain.slice(0, 260).trimEnd() + "…" : plain;
  }
  return text;
}

const QUESTIONS = [];
let auto = 0;
for (const [path, data] of Object.entries(modules)) {
  const { dataset, topic } = parsePath(path);
  if (!Array.isArray(data)) continue;
  for (const q of data) {
    auto += 1;
    QUESTIONS.push({
      uid: `${dataset}/${topic}/${q.id || auto}`,
      id: q.id || `q-${auto}`,
      dataset,
      datasetLabel: DATASET_LABELS[dataset] || dataset,
      topic,
      topicLabel: TOPIC_LABELS[topic] || topic,
      type: q.type || "open_ended",
      difficulty: normalizeDifficulty(q.difficulty, dataset),
      question: q.question,
      options: q.options || null,
      correctAnswer: q.correct_answer,
      displayAnswer: shortAnswer(q.correct_answer, dataset),
      explanation: q.explanation || "",
      source: q.source || "",
      sourceUrl: q.source_url || "",
      tags: q.tags || [],
    });
  }
}

export const ALL_QUESTIONS = QUESTIONS;
export const DATASETS = [...new Set(QUESTIONS.map((q) => q.dataset))];
export const TOPICS = [...new Set(QUESTIONS.map((q) => q.topic))];
export { DATASET_LABELS, TOPIC_LABELS };

export function countsByDataset() {
  const out = {};
  for (const q of QUESTIONS) out[q.dataset] = (out[q.dataset] || 0) + 1;
  return out;
}

export function countsByTopic() {
  const out = {};
  for (const q of QUESTIONS) out[q.topic] = (out[q.topic] || 0) + 1;
  return out;
}

// ── Eval results (baseline + RAG) ────────────────────────────────────────────
// We glob the all.json shard from each model directory. If a run hasn't been
// done yet, the import simply returns no matches and downstream code falls
// back to the placeholder UI.
const baselineModules = import.meta.glob(
  "../../../src/notebooks/results/baseline_*/all.json",
  { eager: true, import: "default" }
);
const ragModules = import.meta.glob(
  "../../../src/notebooks/results/rag_*/all.json",
  { eager: true, import: "default" }
);

function firstValue(modules) {
  const vals = Object.values(modules);
  return vals.length ? vals[0] : null;
}
function firstKey(modules) {
  const keys = Object.keys(modules);
  return keys.length ? keys[0] : null;
}

function modelSlugFromPath(p) {
  // ".../results/baseline_Qwen2.5-3B-Instruct/all.json" -> "Qwen2.5-3B-Instruct"
  if (!p) return null;
  const m = p.match(/results\/(baseline|rag)_([^/]+)\/all\.json$/);
  return m ? m[2] : null;
}

export const BASELINE_RESULTS = firstValue(baselineModules) || [];
export const RAG_RESULTS = firstValue(ragModules) || [];
export const BASELINE_MODEL = modelSlugFromPath(firstKey(baselineModules));
export const RAG_MODEL = modelSlugFromPath(firstKey(ragModules));
export const HAS_RESULTS =
  BASELINE_RESULTS.length > 0 && RAG_RESULTS.length > 0;

function indexById(rows) {
  const out = {};
  for (const r of rows) out[r.id] = r;
  return out;
}
const B_BY_ID = indexById(BASELINE_RESULTS);
const R_BY_ID = indexById(RAG_RESULTS);

// Mean helper that ignores undefined.
function mean(xs) {
  const ys = xs.filter((x) => typeof x === "number" && !Number.isNaN(x));
  return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 0;
}

function judgeMean(rows) {
  return mean(rows.map((r) => r?.judge?.mean));
}

function citationCoverage(rows) {
  return mean(rows.map((r) => r?.citation_coverage));
}

function cosineMean(rows) {
  return mean(
    rows.filter((r) => r.type !== "multiple_choice").map((r) => r?.embed_cosine)
  );
}

function mcAccuracy(rows) {
  const mc = rows.filter((r) => r.type === "multiple_choice");
  if (!mc.length) return null;
  const correct = mc.filter((r) => r.mc_correct).length;
  return correct / mc.length;
}

export function computeMetrics() {
  if (!HAS_RESULTS) return null;
  const B = BASELINE_RESULTS;
  const R = RAG_RESULTS;
  return {
    n: B.length,
    mc: { baseline: mcAccuracy(B), rag: mcAccuracy(R) },
    judge: { baseline: judgeMean(B), rag: judgeMean(R) },
    cosine: { baseline: cosineMean(B), rag: cosineMean(R) },
    citationCoverage: { baseline: 0, rag: citationCoverage(R) },
    latency: {
      baseline: mean(B.map((r) => r.latency_sec)),
      rag: mean(R.map((r) => r.latency_sec)),
    },
  };
}

export function metricsByTopic() {
  if (!HAS_RESULTS) return [];
  const out = {};
  for (const t of TOPICS) out[t] = { baseline: [], rag: [] };
  for (const r of BASELINE_RESULTS) out[r.topic]?.baseline.push(r);
  for (const r of RAG_RESULTS) out[r.topic]?.rag.push(r);
  return TOPICS.map((t) => ({
    topic: t,
    topicLabel: TOPIC_LABELS[t] || t,
    baselineJudge: judgeMean(out[t].baseline),
    ragJudge: judgeMean(out[t].rag),
    baselineMc: mcAccuracy(out[t].baseline),
    ragMc: mcAccuracy(out[t].rag),
    n: out[t].baseline.length,
  }));
}

export function metricsByDataset() {
  if (!HAS_RESULTS) return [];
  const out = {};
  for (const ds of DATASETS) out[ds] = { baseline: [], rag: [] };
  for (const r of BASELINE_RESULTS) out[r.dataset]?.baseline.push(r);
  for (const r of RAG_RESULTS) out[r.dataset]?.rag.push(r);
  return DATASETS.map((ds) => ({
    dataset: ds,
    datasetLabel: DATASET_LABELS[ds] || ds,
    baselineJudge: judgeMean(out[ds].baseline),
    ragJudge: judgeMean(out[ds].rag),
    n: out[ds].baseline.length,
  }));
}

// Find OE comparison cases where RAG meaningfully outperformed baseline.
// Returns up to `limit` rows, sorted by judge-mean delta desc, with both rows
// and the question's metadata attached.
export function topComparisonWins(limit = 5, { onlyOpenEnded = true } = {}) {
  if (!HAS_RESULTS) return [];
  const cases = [];
  for (const b of BASELINE_RESULTS) {
    if (onlyOpenEnded && b.type === "multiple_choice") continue;
    const r = R_BY_ID[b.id];
    if (!r) continue;
    const bJ = b?.judge?.mean;
    const rJ = r?.judge?.mean;
    if (typeof bJ !== "number" || typeof rJ !== "number") continue;
    cases.push({
      id: b.id,
      dataset: b.dataset,
      topic: b.topic,
      datasetLabel: DATASET_LABELS[b.dataset] || b.dataset,
      topicLabel: TOPIC_LABELS[b.topic] || b.topic,
      type: b.type,
      question: b.question,
      reference: b.reference,
      baselineCandidate: b.candidate,
      ragCandidate: r.candidate,
      baselineJudge: b.judge,
      ragJudge: r.judge,
      retrieved: r.retrieved || [],
      nCitations: r.n_citations ?? 0,
      citationCoverage: r.citation_coverage ?? 0,
      delta: rJ - bJ,
    });
  }
  cases.sort((a, b) => b.delta - a.delta);
  return cases.slice(0, limit);
}

// Find one strong MC case: baseline wrong, RAG right.
export function topMcFlip() {
  if (!HAS_RESULTS) return null;
  for (const b of BASELINE_RESULTS) {
    if (b.type !== "multiple_choice") continue;
    const r = R_BY_ID[b.id];
    if (!r) continue;
    if (!b.mc_correct && r.mc_correct) {
      return {
        id: b.id,
        dataset: b.dataset,
        topic: b.topic,
        datasetLabel: DATASET_LABELS[b.dataset] || b.dataset,
        topicLabel: TOPIC_LABELS[b.topic] || b.topic,
        type: "multiple_choice",
        question: b.question,
        reference: b.reference,
        baselineCandidate: b.candidate,
        ragCandidate: r.candidate,
        baselinePicked: b.mc_picked,
        ragPicked: r.mc_picked,
        retrieved: r.retrieved || [],
        nCitations: r.n_citations ?? 0,
        citationCoverage: r.citation_coverage ?? 0,
      };
    }
  }
  return null;
}
