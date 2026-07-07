"use client";

import { useState } from "react";
import { metaphorKey } from "@/lib/types";

export type EditableEntry = {
  date: string;
  location: string | null;
  who: string | null;
  language: string;
  goal: string | null;
  goal_tag: string | null;
  metaphors: string[];
  technique: string | null;
  effectiveness: number | null;
  notes: string | null;
};

type FieldKey = keyof EditableEntry;

const FIELDS: { key: FieldKey; label: string; kind: "text" | "date" | "number" | "list" | "multiline" }[] = [
  { key: "date", label: "Date", kind: "date" },
  { key: "who", label: "Who", kind: "text" },
  { key: "location", label: "Location", kind: "text" },
  { key: "language", label: "Language", kind: "text" },
  { key: "goal", label: "Goal", kind: "text" },
  { key: "goal_tag", label: "Goal tag", kind: "text" },
  { key: "metaphors", label: "Metaphors", kind: "list" },
  { key: "technique", label: "Technique", kind: "text" },
  { key: "effectiveness", label: "Effectiveness (1–10)", kind: "number" },
  { key: "notes", label: "Notes", kind: "multiline" },
];

// Tap a field to edit it inline; blur or Enter commits.
export default function EntryCard({
  entry,
  onChange,
  reusedMetaphors,
}: {
  entry: EditableEntry;
  onChange: (e: EditableEntry) => void;
  // Metaphors that matched an existing bank entry — marked "↺ reused".
  reusedMetaphors?: string[];
}) {
  const reusedKeys = new Set((reusedMetaphors ?? []).map(metaphorKey));
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [draft, setDraft] = useState("");

  function beginEdit(key: FieldKey, kind: string) {
    const v = entry[key];
    if (kind === "list") setDraft(((v as string[]) ?? []).join("\n"));
    else setDraft(v == null ? "" : String(v));
    setEditing(key);
  }

  function commit(key: FieldKey, kind: string) {
    const next = { ...entry };
    const t = draft.trim();
    if (kind === "list") {
      next.metaphors = draft
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (kind === "number") {
      const n = parseInt(t, 10);
      next.effectiveness =
        Number.isFinite(n) && n >= 1 && n <= 10 ? n : null;
    } else if (key === "language") {
      next.language = t || "English";
    } else if (key === "date") {
      next.date = t || entry.date;
    } else {
      (next as Record<string, unknown>)[key] = t || null;
    }
    setEditing(null);
    onChange(next);
  }

  function display(key: FieldKey, kind: string): string {
    const v = entry[key];
    if (kind === "list") {
      const list = (v as string[]) ?? [];
      return list.length ? list.map((m) => `• ${m}`).join("\n") : "";
    }
    return v == null ? "" : String(v);
  }

  return (
    <div className="card">
      {FIELDS.map((f) => (
        <div
          key={f.key}
          className="field-row"
          onClick={() => editing !== f.key && beginEdit(f.key, f.kind)}
        >
          <span className="field-label">{f.label}</span>
          {editing === f.key ? (
            f.kind === "list" || f.kind === "multiline" ? (
              <textarea
                className="field-input"
                rows={f.kind === "list" ? 4 : 3}
                value={draft}
                autoFocus
                placeholder={f.kind === "list" ? "One metaphor per line" : ""}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commit(f.key, f.kind)}
              />
            ) : (
              <input
                className="field-input"
                type={f.kind === "date" ? "date" : f.kind === "number" ? "number" : "text"}
                min={f.kind === "number" ? 1 : undefined}
                max={f.kind === "number" ? 10 : undefined}
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commit(f.key, f.kind)}
                onKeyDown={(e) => e.key === "Enter" && commit(f.key, f.kind)}
              />
            )
          ) : f.key === "metaphors" && entry.metaphors.length > 0 ? (
            <span className="field-value">
              {entry.metaphors.map((m, i) => (
                <span key={i} style={{ display: "block" }}>
                  • {m}
                  {reusedKeys.has(metaphorKey(m)) && (
                    <span className="reused-tag">↺ reused</span>
                  )}
                </span>
              ))}
            </span>
          ) : (
            <span
              className={`field-value ${display(f.key, f.kind) ? "" : "empty"}`}
              style={{ whiteSpace: "pre-wrap" }}
            >
              {display(f.key, f.kind) || "tap to add"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
