"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useEntries, entryMatchesSearch, formatDate } from "@/lib/useEntries";

const EFF_RANGES = [
  { label: "1–4", min: 1, max: 4 },
  { label: "5–7", min: 5, max: 7 },
  { label: "8–10", min: 8, max: 10 },
];

const DATE_RANGES = [
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "This year", days: 366 },
];

export default function HistoryPage() {
  const { entries, error } = useEntries();
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [lang, setLang] = useState<string | null>(null);
  const [eff, setEff] = useState<number>(-1);
  const [dateRange, setDateRange] = useState<number>(-1);

  const tags = useMemo(
    () =>
      Array.from(
        new Set((entries ?? []).map((e) => e.goal_tag).filter(Boolean))
      ).sort() as string[],
    [entries]
  );
  const langs = useMemo(
    () =>
      Array.from(new Set((entries ?? []).map((e) => e.language))).sort(),
    [entries]
  );

  const filtered = useMemo(() => {
    let list = entries ?? [];
    if (q.trim()) list = list.filter((e) => entryMatchesSearch(e, q));
    if (tag) list = list.filter((e) => e.goal_tag === tag);
    if (lang) list = list.filter((e) => e.language === lang);
    if (eff >= 0) {
      const r = EFF_RANGES[eff];
      list = list.filter(
        (e) =>
          e.effectiveness != null &&
          e.effectiveness >= r.min &&
          e.effectiveness <= r.max
      );
    }
    if (dateRange >= 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - DATE_RANGES[dateRange].days);
      const c = cutoff.toISOString().slice(0, 10);
      list = list.filter((e) => e.date >= c);
    }
    return list;
  }, [entries, q, tag, lang, eff, dateRange]);

  return (
    <main className="page">
      <h1 className="page-title">History</h1>
      <p className="page-sub">
        {entries ? `${entries.length} sessions logged` : "Loading…"}
      </p>
      <input
        className="search-input"
        placeholder="Search people, goals, metaphors, notes…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {tags.length > 0 && (
        <div className="chip-row">
          {tags.map((t) => (
            <button
              key={t}
              className={`chip ${tag === t ? "active" : ""}`}
              onClick={() => setTag(tag === t ? null : t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      <div className="chip-row">
        {langs.length > 1 &&
          langs.map((l) => (
            <button
              key={l}
              className={`chip ${lang === l ? "active" : ""}`}
              onClick={() => setLang(lang === l ? null : l)}
            >
              {l}
            </button>
          ))}
        {EFF_RANGES.map((r, i) => (
          <button
            key={r.label}
            className={`chip ${eff === i ? "active" : ""}`}
            onClick={() => setEff(eff === i ? -1 : i)}
          >
            ★ {r.label}
          </button>
        ))}
        {DATE_RANGES.map((r, i) => (
          <button
            key={r.label}
            className={`chip ${dateRange === i ? "active" : ""}`}
            onClick={() => setDateRange(dateRange === i ? -1 : i)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}
      {entries && filtered.length === 0 && (
        <p className="muted" style={{ marginTop: 20 }}>
          No sessions match.
        </p>
      )}
      {filtered.map((e) => (
        <Link key={e.id} href={`/history/${e.id}`} className="entry-row">
          <div className="entry-row-main">
            <div className="entry-row-date">
              {formatDate(e.date)}
              {e.who ? ` · ${e.who}` : ""}
              {e.incomplete ? " · " : ""}
              {e.incomplete && (
                <span className="badge badge-incomplete">incomplete</span>
              )}
            </div>
            <div className="entry-row-title">{e.goal || "(no goal)"}</div>
          </div>
          {e.effectiveness != null && (
            <span className="badge badge-eff">{e.effectiveness}</span>
          )}
        </Link>
      ))}
    </main>
  );
}
