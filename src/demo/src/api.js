import Anthropic from "@anthropic-ai/sdk";

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
export const API_KEY_PRESENT = !!API_KEY;

// NOTE: this demo calls Claude directly from the browser for convenience. Fine for
// a class demo — never do this in production. Use a thin backend proxy instead.
const client = API_KEY
  ? new Anthropic({ apiKey: API_KEY, dangerouslyAllowBrowser: true })
  : null;

async function call(model, system, user, max_tokens = 600) {
  if (!client) throw new Error("ANTHROPIC_API_KEY not loaded — check repo-root .env.");
  const resp = await client.messages.create({
    model,
    max_tokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return resp.content.map((b) => b.text || "").join("").trim();
}

// ── Baseline personas ─────────────────────────────────────────────────────────
// All run on Claude Haiku 4.5 with prompts that restrict capability. This is the
// "hacky on the backend" part: we approximate a weaker model's failure modes
// (outdated facts, shallow reasoning, no tradeoffs) without spinning up Qwen.

export const BASELINE_PERSONAS = {
  qwen3b: {
    label: "Qwen2.5-3B-Instruct (simulated)",
    description: "Small open-weights model. Answers concisely, often with outdated figures (2023 knowledge) and no nuance.",
    model: "claude-haiku-4-5-20251001",
    system:
      "You are simulating a small open-weights language model (~3B parameters, Qwen2.5-3B) with no retrieval and a knowledge cutoff of late 2023. " +
      "Answer the user's personal-finance question in 3-5 sentences. Be direct and confident. " +
      "Prefer simple, round numbers. Do NOT mention recent (2024 or 2025) updates. " +
      "Do not cite sources. Do not mention tradeoffs unless the question specifically demands it. " +
      "If there is a 2024 or 2025 figure you do not know, confidently state the 2023 figure instead.",
  },
  gpt_small: {
    label: "GPT-3.5-class (simulated)",
    description: "Older hosted model. Fluent but frequently hallucinates specific numbers.",
    model: "claude-haiku-4-5-20251001",
    system:
      "You are simulating a GPT-3.5-class language model from early 2023 with no retrieval. " +
      "Answer the user's personal-finance question in 3-5 sentences. Sound confident and authoritative. " +
      "If the question asks for a specific dollar amount, percentage, or limit, give a specific number even if you are unsure. " +
      "Do not hedge, do not say 'approximately', do not cite sources, do not say you might be wrong. " +
      "Prefer figures from 2021-2022 ranges when uncertain.",
  },
  claude_naive: {
    label: "Claude Haiku (no retrieval)",
    description: "Modern hosted model without RAG. Stronger than the others but still no grounded citations.",
    model: "claude-haiku-4-5-20251001",
    system:
      "You are a general-purpose assistant with no retrieval tools. Answer the user's personal-finance question in 3-6 sentences. " +
      "Do not cite sources. Do not reference specific publications. Just answer from general knowledge.",
  },
};

export async function runBaseline(question, personaKey) {
  const p = BASELINE_PERSONAS[personaKey];
  return call(p.model, p.system, question, 400);
}

// ── FinVerify RAG ─────────────────────────────────────────────────────────────
const RAG_SYSTEM =
  "You are FinVerify, a careful personal-finance assistant. " +
  "Answer using ONLY the provided passages when they are relevant. " +
  "Cite sources inline as bracketed indices like [1], [2] after each claim they support. " +
  "If the passages are insufficient, say so rather than fabricating. " +
  "Acknowledge tradeoffs when they exist. Keep your answer to 4-7 sentences.";

export async function runRAG(question, passages) {
  const ctx = passages
    .map((p, i) => `[${i + 1}] (${p.publisher} — ${p.title})\n${p.text}`)
    .join("\n\n");
  const user =
    `Context:\n${ctx}\n\n` +
    `Question: ${question}\n\n` +
    `Answer in 4-7 sentences. Cite passages as [n] after every substantive claim.`;
  return call("claude-sonnet-4-6", RAG_SYSTEM, user, 700);
}

// ── LLM-as-judge ──────────────────────────────────────────────────────────────
const JUDGE_SYSTEM =
  "You are a strict grader for personal-finance answers. Given a question, a reference answer, and a candidate answer, " +
  "score the candidate on three axes from 1 to 5:\n" +
  "- factuality: does the candidate state things that are consistent with the reference and generally-accepted facts?\n" +
  "- completeness: does it cover the key points in the reference?\n" +
  "- advice_quality: is it specific, appropriately nuanced, and actionable (no false certainty)?\n" +
  "Respond with ONLY a JSON object: {\"factuality\": n, \"completeness\": n, \"advice_quality\": n, \"rationale\": \"one sentence\"}";

export async function runJudge(question, reference, candidate) {
  const user =
    `Question: ${question}\n\n` +
    `Reference answer:\n${reference}\n\n` +
    `Candidate answer:\n${candidate}\n\n` +
    `Respond with JSON only.`;
  const raw = await call("claude-sonnet-4-6", JUDGE_SYSTEM, user, 300);
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    return { factuality: 0, completeness: 0, advice_quality: 0, rationale: raw.slice(0, 120) };
  }
  try {
    const obj = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    const mean = (Number(obj.factuality) + Number(obj.completeness) + Number(obj.advice_quality)) / 3;
    return { ...obj, mean };
  } catch {
    return { factuality: 0, completeness: 0, advice_quality: 0, rationale: "parse error", mean: 0 };
  }
}
