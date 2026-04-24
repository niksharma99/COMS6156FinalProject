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
