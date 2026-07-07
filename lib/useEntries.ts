"use client";

import { useEffect, useState } from "react";
import type { Entry } from "./types";

export function useEntries() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/entries")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load entries.");
        setEntries((await res.json()) as Entry[]);
      })
      .catch((e) => setError((e as Error).message));
  }, []);
  return { entries, error };
}

export function entryMatchesSearch(e: Entry, q: string): boolean {
  const hay = [
    e.who,
    e.location,
    e.goal,
    e.goal_tag,
    e.technique,
    e.notes,
    e.language,
    e.raw_dump,
    ...e.metaphors,
  ]
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term));
}

export function formatDate(d: string): string {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
