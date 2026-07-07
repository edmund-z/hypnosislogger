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
};

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
