"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useEntries, formatDate } from "@/lib/useEntries";
import type { Entry } from "@/lib/types";

type MetaphorAgg = {
  key: string;
  text: string;
  entries: Entry[];
  avgEff: number | null;
};

type Group = { tag: string; metaphors: MetaphorAgg[] };

function buildGroups(entries: Entry[]): Group[] {
  const byTag = new Map<string, Map<string, MetaphorAgg>>();
  for (const e of entries) {
    const tag = e.goal_tag || "untagged";
    if (!byTag.has(tag)) byTag.set(tag, new Map());
    const bucket = byTag.get(tag)!;
    for (const m of e.metaphors) {
      const key = m.trim().toLowerCase();
      if (!key) continue;
      if (!bucket.has(key)) bucket.set(key, { key, text: m, entries: [], avgEff: null });
      bucket.get(key)!.entries.push(e);
    }
  }
  const groups: Group[] = [];
  for (const [tag, bucket] of byTag) {
    const metaphors = Array.from(bucket.values()).map((m) => {
      const effs = m.entries
        .map((e) => e.effectiveness)
        .filter((x): x is number => x != null);
      return {
        ...m,
        avgEff: effs.length
          ? Math.round((effs.reduce((a, b) => a + b, 0) / effs.length) * 10) / 10
          : null,
      };
    });
    // Best first; metaphors with no score sink to the bottom.
    metaphors.sort((a, b) => (b.avgEff ?? -1) - (a.avgEff ?? -1));
    groups.push({ tag, metaphors });
  }
  groups.sort((a, b) => b.metaphors.length - a.metaphors.length);
  return groups;
}

export default function MetaphorsPage() {
  const { entries, error } = useEntries();
  const [open, setOpen] = useState<string | null>(null);

  const groups = useMemo(() => buildGroups(entries ?? []), [entries]);

  return (
    <main className="page">
      <h1 className="page-title">Metaphor Bank</h1>
      <p className="page-sub">
        Every metaphor you&rsquo;ve used, by goal — best performers first.
      </p>
      {error && <p className="error-text">{error}</p>}
      {entries && groups.length === 0 && (
        <p className="muted">No metaphors logged yet.</p>
      )}
      {groups.map((g) => (
        <section key={g.tag} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, marginBottom: 10, textTransform: "capitalize" }}>
            {g.tag}
          </h2>
          {g.metaphors.map((m) => {
            const id = `${g.tag}::${m.key}`;
            const isOpen = open === id;
            return (
              <div key={id} className="card" style={{ marginBottom: 8, padding: 12 }}>
                <div
                  style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}
                  onClick={() => setOpen(isOpen ? null : id)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{m.text}</div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      used {m.entries.length}×
                      {" · "}
                      {m.entries.map((e) => formatDate(e.date)).join(", ")}
                    </div>
                  </div>
                  {m.avgEff != null && (
                    <span className="badge badge-eff">{m.avgEff}</span>
                  )}
                </div>
                {isOpen && (
                  <div style={{ marginTop: 10, borderTop: "1px solid var(--surface-2)", paddingTop: 8 }}>
                    {m.entries.map((e) => (
                      <Link
                        key={e.id}
                        href={`/history/${e.id}`}
                        style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}
                      >
                        <span>
                          {formatDate(e.date)}
                          {e.who ? ` · ${e.who}` : ""}
                        </span>
                        {e.effectiveness != null && (
                          <span className="badge badge-eff">{e.effectiveness}</span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </main>
  );
}
