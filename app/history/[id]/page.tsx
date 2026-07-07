"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import EntryCard, { EditableEntry } from "@/components/EntryCard";
import type { Entry } from "@/lib/types";
import { formatDate } from "@/lib/useEntries";

export default function EntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditableEntry | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/entries/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Entry not found.");
        setEntry((await res.json()) as Entry);
      })
      .catch((e) => setError((e as Error).message));
  }, [id]);

  async function saveEdits() {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/entries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error("Save failed.");
      setEntry((await res.json()) as Entry);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this entry? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/entries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed.");
      router.push("/history");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!entry) {
    return (
      <main className="page">
        <p className="muted">{error || "Loading…"}</p>
      </main>
    );
  }

  const rows: [string, string | null][] = [
    ["Date", formatDate(entry.date)],
    ["Who", entry.who],
    ["Location", entry.location],
    ["Language", entry.language],
    ["Goal", entry.goal],
    ["Goal tag", entry.goal_tag],
    [
      "Metaphors",
      entry.metaphors.length ? entry.metaphors.map((m) => `• ${m}`).join("\n") : null,
    ],
    ["Technique", entry.technique],
    ["Effectiveness", entry.effectiveness != null ? `${entry.effectiveness} / 10` : null],
    ["Notes", entry.notes],
  ];

  return (
    <main className="page">
      <h1 className="page-title">
        {entry.goal || "Session"}{" "}
        {entry.incomplete && <span className="badge badge-incomplete">incomplete</span>}
      </h1>
      <p className="page-sub">
        {formatDate(entry.date)}
        {entry.who ? ` · ${entry.who}` : ""}
      </p>

      {editing && draft ? (
        <>
          <EntryCard entry={draft} onChange={setDraft} />
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button className="btn btn-accent" onClick={saveEdits} disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="card">
            {rows.map(([label, value]) => (
              <div key={label} className="field-row" style={{ cursor: "default" }}>
                <span className="field-label">{label}</span>
                <span
                  className={`field-value ${value ? "" : "empty"}`}
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {value || "—"}
                </span>
              </div>
            ))}
          </div>

          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 14 }}
            onClick={() => setShowRaw(!showRaw)}
          >
            {showRaw ? "Hide original" : "Show original"}
          </button>
          {showRaw && (
            <div className="card" style={{ marginTop: 10 }}>
              <span className="field-label">Original voice dump</span>
              <p style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{entry.raw_dump}</p>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button
              className="btn btn-accent"
              onClick={() => {
                setDraft({ ...entry });
                setEditing(true);
              }}
            >
              Edit
            </button>
            <button className="btn btn-danger" onClick={remove} disabled={busy}>
              Delete
            </button>
          </div>
        </>
      )}
      {error && <p className="error-text">{error}</p>}
    </main>
  );
}
