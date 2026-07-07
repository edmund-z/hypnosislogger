"use client";

import { useEffect, useState } from "react";
import EntryCard, { EditableEntry } from "@/components/EntryCard";
import {
  FOLLOWUP_ORDER,
  ParsedEntry,
  RequiredField,
  computeMissing,
} from "@/lib/types";

const QUESTIONS: Record<RequiredField, string> = {
  effectiveness: "How effective was it, 1 to 10?",
  goal: "What did they want out of the session?",
  metaphors: "What metaphor or visualization did you use?",
  technique: "What induction or technique did you use?",
};

const PENDING_KEY = "hl_pending_dumps";

function loadPending(): string[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}
function savePending(dumps: string[]) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(dumps));
}

type Phase = "dump" | "parsing" | "review";

export default function LogPage() {
  const [phase, setPhase] = useState<Phase>("dump");
  const [dump, setDump] = useState("");
  const [entry, setEntry] = useState<EditableEntry | null>(null);
  const [missing, setMissing] = useState<RequiredField[]>([]);
  const [skipped, setSkipped] = useState<RequiredField[]>([]);
  const [answer, setAnswer] = useState("");
  const [merging, setMerging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    setPendingCount(loadPending().length);
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function callParse(body: object): Promise<ParsedEntry> {
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Parse failed (${res.status}).`);
    return data as ParsedEntry;
  }

  async function handleParse(text?: string) {
    const d = (text ?? dump).trim();
    if (!d) return;
    setError("");
    setPhase("parsing");
    try {
      const parsed = await callParse({ dump: d });
      setDump(d);
      setEntry(parsed);
      setMissing(parsed.missing_required);
      setSkipped([]);
      setPhase("review");
    } catch (err) {
      // Never lose a dump: stash it locally as pending and let the user retry.
      const pending = loadPending();
      if (!pending.includes(d)) {
        pending.push(d);
        savePending(pending);
        setPendingCount(pending.length);
      }
      setError(
        (err as Error).message +
          " Your dump was saved locally as pending — retry when you're back online."
      );
      setPhase("dump");
    }
  }

  const currentQuestion = FOLLOWUP_ORDER.find(
    (f) => missing.includes(f) && !skipped.includes(f)
  );

  async function submitAnswer() {
    if (!entry || !currentQuestion || !answer.trim()) return;
    setMerging(true);
    setError("");
    try {
      const parsed = await callParse({
        dump,
        entry,
        answers: [{ field: currentQuestion, answer: answer.trim() }],
      });
      setEntry(parsed);
      setMissing(parsed.missing_required);
      setAnswer("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setMerging(false);
    }
  }

  function onEntryEdited(e: EditableEntry) {
    setEntry(e);
    setMissing(computeMissing(e));
  }

  async function save() {
    if (!entry) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...entry, raw_dump: dump }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed.");
      }
      // Clear this dump from pending if it was there.
      const pending = loadPending().filter((p) => p !== dump);
      savePending(pending);
      setPendingCount(pending.length);
      setDump("");
      setEntry(null);
      setMissing([]);
      setSkipped([]);
      setPhase("dump");
      showToast("Saved ✓");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const stillMissing = entry ? computeMissing(entry) : [];
  const blocked = stillMissing.length > 0;

  if (phase === "review" && entry) {
    return (
      <main className="page">
        <h1 className="page-title">Review</h1>
        <p className="page-sub">Tap any field to correct it.</p>
        {stillMissing.length > 0 && (
          <p className="muted" style={{ marginBottom: 10 }}>
            <span className="badge badge-incomplete">incomplete</span>{" "}
            Missing: {stillMissing.join(", ")}
          </p>
        )}
        <EntryCard entry={entry} onChange={onEntryEdited} />

        {currentQuestion && (
          <div className="followup">
            <div className="followup-q">{QUESTIONS[currentQuestion]}</div>
            <input
              className="field-input"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAnswer()}
              placeholder="Answer by voice or type… "
              disabled={merging}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                className="btn btn-gold btn-sm"
                onClick={submitAnswer}
                disabled={merging || !answer.trim()}
              >
                {merging ? "Updating…" : "Answer"}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setSkipped([...skipped, currentQuestion])}
                disabled={merging}
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving || blocked}>
            {saving ? "Saving…" : "Save"}
          </button>
          {blocked && (
            <button className="btn btn-ghost" onClick={save} disabled={saving}>
              Save anyway (marked incomplete)
            </button>
          )}
          <button
            className="btn btn-ghost"
            onClick={() => {
              setPhase("dump");
              setEntry(null);
            }}
          >
            Back to dump
          </button>
        </div>
        {toast && <div className="toast">{toast}</div>}
      </main>
    );
  }

  return (
    <main className="page">
      <h1 className="page-title">Log a session</h1>
      <p className="page-sub">One voice dump. The rest is handled.</p>
      <textarea
        className="dump-area"
        placeholder="Talk about the session…"
        value={dump}
        onChange={(e) => setDump(e.target.value)}
        disabled={phase === "parsing"}
      />
      <div style={{ marginTop: 14 }}>
        <button
          className="btn btn-primary"
          onClick={() => handleParse()}
          disabled={phase === "parsing" || !dump.trim()}
        >
          {phase === "parsing" ? "Parsing…" : "Parse"}
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}

      {pendingCount > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <p className="muted" style={{ marginBottom: 10 }}>
            {pendingCount} pending dump{pendingCount > 1 ? "s" : ""} saved
            offline.
          </p>
          {loadPending().map((p, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <span
                className="muted"
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {p}
              </span>
              <button className="btn btn-gold btn-sm" onClick={() => handleParse(p)}>
                Retry
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const rest = loadPending().filter((x) => x !== p);
                  savePending(rest);
                  setPendingCount(rest.length);
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
