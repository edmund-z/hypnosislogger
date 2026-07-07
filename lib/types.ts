export type Entry = {
  id: string;
  date: string; // YYYY-MM-DD
  location: string | null;
  who: string | null;
  language: string;
  goal: string | null;
  goal_tag: string | null;
  metaphors: string[];
  technique: string | null;
  effectiveness: number | null;
  notes: string | null;
  raw_dump: string;
  incomplete: boolean;
  created_at: string;
};

export type RequiredField = "effectiveness" | "goal" | "metaphors" | "technique";

// Follow-up question order when required fields are missing (spec §3).
export const FOLLOWUP_ORDER: RequiredField[] = [
  "effectiveness",
  "goal",
  "metaphors",
  "technique",
];

export type ParsedEntry = {
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
  missing_required: RequiredField[];
  // Metaphors that matched an existing bank entry (computed server-side by
  // key lookup, not model self-reporting) — shown as "reused" on review.
  reused_metaphors?: string[];
};

// Normalized grouping key for a metaphor: case-, punctuation- and
// whitespace-insensitive, so trivial wording variants ("knob - turn" vs
// "knob — turn") still count as the same metaphor. Conceptual matching
// (truly different wording, same metaphor) is handled at parse time by
// giving Claude the existing bank to canonicalize against.
export function metaphorKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function computeMissing(e: {
  goal: string | null;
  metaphors: string[];
  technique: string | null;
  effectiveness: number | null;
}): RequiredField[] {
  const missing: RequiredField[] = [];
  if (e.effectiveness == null) missing.push("effectiveness");
  if (!e.goal || !e.goal.trim()) missing.push("goal");
  if (!e.metaphors || e.metaphors.length === 0) missing.push("metaphors");
  if (!e.technique || !e.technique.trim()) missing.push("technique");
  return missing;
}
