import { useMemo, useState } from "react";
import { ALL_QUESTIONS, DATASET_LABELS, TOPIC_LABELS } from "./data.js";
import { retrieve } from "./kb.js";
import {
  BASELINE_PERSONAS, runBaseline, runRAG, runJudge, API_KEY_PRESENT,
} from "./api.js";

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

// Stage status: idle | running | done | error
const INITIAL_BASELINE_STAGES = [
  { key: "persona", label: "Load persona system prompt", detail: "" },
  { key: "gen", label: "Generate answer (no retrieval)", detail: "" },
];
const INITIAL_RAG_STAGES = [
  { key: "embed", label: "Embed query (BGE-like, lexical fallback in browser)", detail: "" },
  { key: "retrieve", label: "Retrieve top-5 passages from KB", detail: "" },
  { key: "generate", label: "Claude Sonnet 4.6 — grounded generation with [n] citations", detail: "" },
];
const INITIAL_JUDGE_STAGES = [
  { key: "judgeB", label: "LLM-as-judge: score baseline", detail: "" },
  { key: "judgeR", label: "LLM-as-judge: score FinVerify", detail: "" },
];

function StageRow({ status, label, detail, accent }) {
  const color =
    status === "done" ? palette.accent :
    status === "running" ? palette.warn :
    status === "error" ? palette.danger :
    palette.textMuted;
  const dot =
    status === "done" ? "●" :
    status === "running" ? "◐" :
    status === "error" ? "✕" : "○";
  return (
    <div style={{
      display: "flex", gap: 10, alignItems: "flex-start",
      padding: "8px 12px", borderRadius: 8,
      background: status === "running" ? palette.warnDim : "transparent",
      borderLeft: `2px solid ${status === "running" ? palette.warn : palette.border}`,
      marginBottom: 6,
    }}>
      <div style={{ fontSize: 13, color, fontFamily: mono, width: 16, textAlign: "center", animation: status === "running" ? "pulse 1.2s ease-in-out infinite" : "none" }}>{dot}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: palette.text, fontFamily: mono }}>{label}</div>
        {detail && <div style={{ fontSize: 11, color: palette.textMuted, marginTop: 2, lineHeight: 1.45 }}>{detail}</div>}
      </div>
    </div>
  );
}

function Pipeline({ title, stages, accent }) {
  return (
    <div style={{
      background: palette.surface, border: `1px solid ${palette.border}`,
      borderLeft: `3px solid ${accent}`, borderRadius: 12, padding: "14px 16px",
    }}>
      <div style={{ fontSize: 12, fontFamily: mono, color: accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{title}</div>
      {stages.map((s) => <StageRow key={s.key} {...s} />)}
    </div>
  );
}

function AnswerCard({ title, accent, answer, elapsed, passages, judge }) {
  return (
    <div style={{
      background: palette.surface, border: `1px solid ${accent}`,
      borderRadius: 12, padding: 16, marginTop: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontFamily: mono, color: accent, textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</div>
        {elapsed != null && (
          <div style={{ fontSize: 11, fontFamily: mono, color: palette.textMuted }}>{elapsed.toFixed(1)}s</div>
        )}
      </div>
      <div style={{ fontSize: 13, color: palette.text, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
        {answer || <span style={{ color: palette.textMuted }}>(pending)</span>}
      </div>
      {passages && passages.length > 0 && (
        <div style={{ marginTop: 12, background: palette.surfaceAlt, borderRadius: 8, padding: "8px 12px" }}>
          <div style={{ fontSize: 10, fontFamily: mono, color: palette.textMuted, textTransform: "uppercase", marginBottom: 6 }}>retrieved passages</div>
          {passages.map((p, i) => (
            <div key={p.id} style={{ fontSize: 11, color: palette.textMuted, marginBottom: 3 }}>
              <span style={{ color: palette.accent, fontFamily: mono }}>[{i + 1}]</span> {p.publisher} — {p.title} <span style={{ color: palette.borderLight }}>(score {p.score})</span>
            </div>
          ))}
        </div>
      )}
      {judge && (
        <div style={{ marginTop: 12, background: palette.accentDim, borderRadius: 8, padding: "8px 12px", fontFamily: mono }}>
          <div style={{ fontSize: 10, color: palette.accent, textTransform: "uppercase", marginBottom: 4 }}>llm judge</div>
          <div style={{ fontSize: 12, color: palette.text }}>
            factuality: <b>{judge.factuality}</b> · completeness: <b>{judge.completeness}</b> · advice: <b>{judge.advice_quality}</b>
            {judge.mean != null && <>  · mean: <b>{judge.mean.toFixed(2)}</b></>}
          </div>
          {judge.rationale && <div style={{ fontSize: 11, color: palette.textMuted, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>{judge.rationale}</div>}
        </div>
      )}
    </div>
  );
}

export default function DemoTab() {
  const [questionUid, setQuestionUid] = useState(ALL_QUESTIONS[0]?.uid || "");
  const [search, setSearch] = useState("");
  const [personaKey, setPersonaKey] = useState("qwen3b");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const [baselineStages, setBaselineStages] = useState(
    INITIAL_BASELINE_STAGES.map((s) => ({ ...s, status: "idle" }))
  );
  const [ragStages, setRagStages] = useState(
    INITIAL_RAG_STAGES.map((s) => ({ ...s, status: "idle" }))
  );
  const [judgeStages, setJudgeStages] = useState(
    INITIAL_JUDGE_STAGES.map((s) => ({ ...s, status: "idle" }))
  );

  const [baselineAnswer, setBaselineAnswer] = useState("");
  const [baselineElapsed, setBaselineElapsed] = useState(null);
  const [baselineJudge, setBaselineJudge] = useState(null);
  const [ragAnswer, setRagAnswer] = useState("");
  const [ragElapsed, setRagElapsed] = useState(null);
  const [ragJudge, setRagJudge] = useState(null);
  const [retrievedPassages, setRetrievedPassages] = useState([]);

  const filteredQs = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return ALL_QUESTIONS.slice(0, 120);
    return ALL_QUESTIONS.filter((q) => q.question.toLowerCase().includes(s)).slice(0, 120);
  }, [search]);

  const question = ALL_QUESTIONS.find((q) => q.uid === questionUid);

  function reset() {
    setBaselineStages(INITIAL_BASELINE_STAGES.map((s) => ({ ...s, status: "idle" })));
    setRagStages(INITIAL_RAG_STAGES.map((s) => ({ ...s, status: "idle" })));
    setJudgeStages(INITIAL_JUDGE_STAGES.map((s) => ({ ...s, status: "idle" })));
    setBaselineAnswer(""); setBaselineElapsed(null); setBaselineJudge(null);
    setRagAnswer(""); setRagElapsed(null); setRagJudge(null);
    setRetrievedPassages([]);
    setError(null);
  }

  function patchStage(setter, key, patch) {
    setter((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function run() {
    if (!question || running) return;
    reset();
    setRunning(true);
    try {
      const t0 = performance.now();
      // Fire baseline + RAG in parallel so the user sees both pipelines animate at once.
      const baselinePromise = (async () => {
        const bt = performance.now();
        patchStage(setBaselineStages, "persona", { status: "running", detail: BASELINE_PERSONAS[personaKey].label });
        await sleep(200);
        patchStage(setBaselineStages, "persona", { status: "done" });
        patchStage(setBaselineStages, "gen", { status: "running", detail: "calling Claude Haiku with restricted persona prompt…" });
        const answer = await runBaseline(question.question, personaKey);
        const elapsed = (performance.now() - bt) / 1000;
        patchStage(setBaselineStages, "gen", { status: "done", detail: `${answer.length} chars generated` });
        setBaselineAnswer(answer);
        setBaselineElapsed(elapsed);
        return answer;
      })();

      const ragPromise = (async () => {
        const rt = performance.now();
        patchStage(setRagStages, "embed", { status: "running" });
        await sleep(350);
        patchStage(setRagStages, "embed", { status: "done", detail: "query vectorized (simulated in-browser)" });
        patchStage(setRagStages, "retrieve", { status: "running" });
        const hits = retrieve(question.question, 5, question.topic);
        await sleep(300);
        setRetrievedPassages(hits);
        patchStage(setRagStages, "retrieve", { status: "done", detail: `${hits.length} passages · top: ${hits[0]?.title || "—"}` });
        patchStage(setRagStages, "generate", { status: "running", detail: "Claude Sonnet 4.6 streaming grounded answer…" });
        const answer = await runRAG(question.question, hits);
        const elapsed = (performance.now() - rt) / 1000;
        patchStage(setRagStages, "generate", { status: "done", detail: `${answer.length} chars · ${(answer.match(/\[\d+\]/g) || []).length} inline citations` });
        setRagAnswer(answer);
        setRagElapsed(elapsed);
        return answer;
      })();

      const [bAns, rAns] = await Promise.all([baselinePromise, ragPromise]);

      // Judge both answers in parallel.
      patchStage(setJudgeStages, "judgeB", { status: "running" });
      patchStage(setJudgeStages, "judgeR", { status: "running" });
      const [bJ, rJ] = await Promise.all([
        runJudge(question.question, question.correctAnswer, bAns),
        runJudge(question.question, question.correctAnswer, rAns),
      ]);
      setBaselineJudge(bJ);
      setRagJudge(rJ);
      patchStage(setJudgeStages, "judgeB", { status: "done", detail: `mean ${bJ.mean?.toFixed(2) ?? "?"}` });
      patchStage(setJudgeStages, "judgeR", { status: "done", detail: `mean ${rJ.mean?.toFixed(2) ?? "?"}` });

      console.log(`Total demo run: ${((performance.now() - t0) / 1000).toFixed(1)}s`);
    } catch (e) {
      console.error(e);
      setError(e.message || String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }`}</style>

      {!API_KEY_PRESENT && (
        <div style={{ background: palette.dangerDim, border: `1px solid ${palette.danger}`, borderRadius: 10, padding: "10px 14px", color: palette.danger, fontSize: 12, fontFamily: mono, marginBottom: 16 }}>
          ⚠ ANTHROPIC_API_KEY not loaded. Make sure the repo-root .env has it set, then restart `npm run dev`.
        </div>
      )}

      {/* Question picker */}
      <div style={{ background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontFamily: mono, color: palette.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>1 · Pick a question</div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions…"
          style={{
            width: "100%", boxSizing: "border-box", padding: "8px 12px",
            borderRadius: 8, border: `1px solid ${palette.border}`,
            background: palette.bg, color: palette.text, fontSize: 13, marginBottom: 10,
            fontFamily: "'DM Sans', sans-serif",
          }}
        />
        <select
          value={questionUid}
          onChange={(e) => setQuestionUid(e.target.value)}
          disabled={running}
          style={{
            width: "100%", boxSizing: "border-box", padding: "8px 12px",
            borderRadius: 8, border: `1px solid ${palette.border}`,
            background: palette.bg, color: palette.text, fontSize: 13,
            fontFamily: "'DM Sans', sans-serif",
          }}>
          {filteredQs.map((q) => (
            <option key={q.uid} value={q.uid}>
              [{DATASET_LABELS[q.dataset] || q.dataset} / {TOPIC_LABELS[q.topic] || q.topic}] {q.id} — {q.question.slice(0, 90)}
            </option>
          ))}
        </select>
        {question && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: palette.surfaceAlt, borderRadius: 8 }}>
            <div style={{ fontSize: 14, color: palette.text, lineHeight: 1.5, marginBottom: 6 }}>{question.question}</div>
            <div style={{ fontSize: 12, fontFamily: mono, color: palette.accent }}>✓ {question.displayAnswer}</div>
          </div>
        )}
      </div>

      {/* Baseline selector + run */}
      <div style={{ background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontFamily: mono, color: palette.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>2 · Pick a baseline</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {Object.entries(BASELINE_PERSONAS).map(([key, p]) => (
            <button key={key} onClick={() => setPersonaKey(key)} disabled={running} style={{
              flex: "1 1 220px", textAlign: "left", cursor: running ? "default" : "pointer",
              background: personaKey === key ? palette.accentDim : palette.surfaceAlt,
              border: `1px solid ${personaKey === key ? palette.accent : palette.border}`,
              color: palette.text, padding: "10px 14px", borderRadius: 8,
              fontFamily: "'DM Sans', sans-serif", fontSize: 13,
            }}>
              <div style={{ fontWeight: 600, color: personaKey === key ? palette.accent : palette.text, marginBottom: 3 }}>{p.label}</div>
              <div style={{ fontSize: 11, color: palette.textMuted, lineHeight: 1.45 }}>{p.description}</div>
            </button>
          ))}
        </div>
        <button onClick={run} disabled={!question || running || !API_KEY_PRESENT} style={{
          background: running ? palette.surfaceAlt : palette.accent,
          color: running ? palette.textMuted : palette.bg,
          border: "none", borderRadius: 8, padding: "10px 22px",
          fontSize: 13, fontWeight: 700, cursor: running || !API_KEY_PRESENT ? "default" : "pointer",
          fontFamily: mono,
        }}>
          {running ? "Running…" : "▶ Run both pipelines"}
        </button>
        {error && <div style={{ marginTop: 10, color: palette.danger, fontSize: 12, fontFamily: mono }}>Error: {error}</div>}
      </div>

      {/* Side-by-side pipelines */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <Pipeline title={`Baseline · ${BASELINE_PERSONAS[personaKey].label}`} stages={baselineStages} accent={palette.danger} />
          <AnswerCard
            title="Baseline answer"
            accent={palette.danger}
            answer={baselineAnswer}
            elapsed={baselineElapsed}
            judge={baselineJudge}
          />
        </div>
        <div>
          <Pipeline title="FinVerify · Claude Sonnet 4.6 + RAG" stages={ragStages} accent={palette.accent} />
          <AnswerCard
            title="FinVerify answer"
            accent={palette.accent}
            answer={ragAnswer}
            elapsed={ragElapsed}
            passages={retrievedPassages}
            judge={ragJudge}
          />
        </div>
      </div>

      {/* Judge stages */}
      <div style={{ marginTop: 14 }}>
        <Pipeline title="Verification · LLM-as-judge" stages={judgeStages} accent={palette.blue} />
      </div>

      {/* Verdict */}
      {baselineJudge && ragJudge && (
        <div style={{
          marginTop: 14, background: palette.surface, border: `1px solid ${palette.border}`,
          borderRadius: 12, padding: 16,
        }}>
          <div style={{ fontSize: 11, fontFamily: mono, color: palette.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Verdict</div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13, color: palette.text }}>
            <div>Δ judge_mean: <b style={{ color: (ragJudge.mean - baselineJudge.mean) >= 0 ? palette.accent : palette.danger, fontFamily: mono }}>
              {(ragJudge.mean - baselineJudge.mean).toFixed(2)}
            </b></div>
            <div>Δ latency: <b style={{ fontFamily: mono, color: palette.textMuted }}>
              {((ragElapsed ?? 0) - (baselineElapsed ?? 0)).toFixed(1)}s
            </b></div>
            <div>Retrieved citations used: <b style={{ fontFamily: mono, color: palette.blue }}>
              {(ragAnswer.match(/\[\d+\]/g) || []).length}
            </b></div>
          </div>
        </div>
      )}
    </div>
  );
}
