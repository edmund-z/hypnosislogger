"use client";

import { useMemo, useState } from "react";
import { useEntries } from "@/lib/useEntries";
import { metaphorKey, type Entry } from "@/lib/types";

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function monthKey(d: string): string {
  return d.slice(0, 7);
}

function computeStats(entries: Entry[]) {
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);

  const effs = entries
    .map((e) => e.effectiveness)
    .filter((x): x is number => x != null);

  // Trend: average effectiveness of the 10 most recent scored sessions vs the
  // 10 before them.
  const scored = entries.filter((e) => e.effectiveness != null);
  const recent = avg(scored.slice(0, 10).map((e) => e.effectiveness!));
  const prior = avg(scored.slice(10, 20).map((e) => e.effectiveness!));

  const byLang = new Map<string, number>();
  const byTag = new Map<string, number>();
  for (const e of entries) {
    byLang.set(e.language, (byLang.get(e.language) ?? 0) + 1);
    const tag = e.goal_tag || "untagged";
    byTag.set(tag, (byTag.get(tag) ?? 0) + 1);
  }

  const metaphorMap = new Map<string, { text: string; count: number; effs: number[] }>();
  for (const e of entries) {
    for (const m of e.metaphors) {
      const key = metaphorKey(m);
      if (!key) continue;
      if (!metaphorMap.has(key)) metaphorMap.set(key, { text: m, count: 0, effs: [] });
      const agg = metaphorMap.get(key)!;
      agg.count += 1;
      if (e.effectiveness != null) agg.effs.push(e.effectiveness);
    }
  }
  const topMetaphors = Array.from(metaphorMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Longest streak of consecutive days with at least one session.
  const days = Array.from(new Set(entries.map((e) => e.date))).sort();
  let streak = 0;
  let best = 0;
  for (let i = 0; i < days.length; i++) {
    if (i > 0) {
      const prev = new Date(days[i - 1] + "T00:00:00");
      prev.setDate(prev.getDate() + 1);
      streak = prev.toISOString().slice(0, 10) === days[i] ? streak + 1 : 1;
    } else {
      streak = 1;
    }
    best = Math.max(best, streak);
  }

  return {
    total: entries.length,
    thisMonthCount: entries.filter((e) => monthKey(e.date) === thisMonth).length,
    lastMonthCount: entries.filter((e) => monthKey(e.date) === lastMonth).length,
    avgEff: avg(effs),
    recent,
    prior,
    byLang: Array.from(byLang.entries()).sort((a, b) => b[1] - a[1]),
    byTag: Array.from(byTag.entries()).sort((a, b) => b[1] - a[1]),
    topMetaphors,
    daysActive: days.length,
    bestStreak: best,
  };
}

function Bars({ data, max }: { data: [string, number][]; max: number }) {
  return (
    <>
      {data.map(([label, count]) => (
        <div key={label} className="bar-row">
          <span className="bar-label">{label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="bar-count">{count}</span>
        </div>
      ))}
    </>
  );
}

export default function StatsPage() {
  const { entries, error } = useEntries();
  const s = useMemo(() => (entries ? computeStats(entries) : null), [entries]);
  const [backupMsg, setBackupMsg] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);

  async function backupNow() {
    setBackupBusy(true);
    setBackupMsg("");
    try {
      const res = await fetch("/api/backup");
      const data = await res.json();
      setBackupMsg(
        data.ok
          ? `Backed up ${data.entries} entries to ${data.file} ✓`
          : data.error || "Backup failed."
      );
    } catch {
      setBackupMsg("Backup failed — network error.");
    } finally {
      setBackupBusy(false);
    }
  }

  return (
    <main className="page">
      <h1 className="page-title">Stats</h1>
      <p className="page-sub">The record of the practice.</p>
      {error && <p className="error-text">{error}</p>}
      {!s ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <div className="stat-grid">
            <div className="card">
              <div className="stat-num">{s.total}</div>
              <div className="stat-label">Total sessions</div>
            </div>
            <div className="card">
              <div className="stat-num">{s.avgEff ?? "—"}</div>
              <div className="stat-label">
                Avg effectiveness
                {s.recent != null && s.prior != null && (
                  <> {s.recent >= s.prior ? "↑" : "↓"} trend</>
                )}
              </div>
            </div>
            <div className="card">
              <div className="stat-num">
                {s.thisMonthCount}
                <span style={{ fontSize: 16, color: "var(--ink-soft)" }}>
                  {" "}
                  vs {s.lastMonthCount}
                </span>
              </div>
              <div className="stat-label">This month vs last</div>
            </div>
            <div className="card">
              <div className="stat-num">{s.daysActive}</div>
              <div className="stat-label">
                Days active · best streak {s.bestStreak}
              </div>
            </div>
          </div>

          {s.byLang.length > 0 && (
            <div className="card" style={{ marginBottom: 10 }}>
              <h2 style={{ fontSize: 18, marginBottom: 8 }}>By language</h2>
              <Bars data={s.byLang} max={s.byLang[0][1]} />
            </div>
          )}

          {s.byTag.length > 0 && (
            <div className="card" style={{ marginBottom: 10 }}>
              <h2 style={{ fontSize: 18, marginBottom: 8 }}>By goal</h2>
              <Bars data={s.byTag} max={s.byTag[0][1]} />
            </div>
          )}

          {s.topMetaphors.length > 0 && (
            <div className="card" style={{ marginBottom: 10 }}>
              <h2 style={{ fontSize: 18, marginBottom: 8 }}>Most-used metaphors</h2>
              {s.topMetaphors.map((m) => {
                const a = avg(m.effs);
                return (
                  <div key={m.text} className="bar-row">
                    <span style={{ flex: 1 }}>{m.text}</span>
                    <span className="muted">{m.count}×</span>
                    {a != null && <span className="badge badge-eff">{a}</span>}
                  </div>
                );
              })}
            </div>
          )}

          <a href="/api/export" className="btn btn-ghost" style={{ width: "100%", marginTop: 8 }}>
            Export all data as JSON
          </a>
          <button
            className="btn btn-ghost"
            style={{ width: "100%", marginTop: 8 }}
            onClick={backupNow}
            disabled={backupBusy}
          >
            {backupBusy ? "Backing up…" : "Back up to GitHub now"}
          </button>
          {backupMsg && (
            <p className="muted" style={{ marginTop: 8, textAlign: "center" }}>
              {backupMsg}
            </p>
          )}
        </>
      )}
    </main>
  );
}
