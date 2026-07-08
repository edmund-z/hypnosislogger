import type { Entry } from "./types";
import { listMissingEmbeddings, setEmbedding } from "./db";

// Semantic search embeddings via Voyage AI (Anthropic's recommended
// embeddings partner). Optional: without VOYAGE_API_KEY the app runs
// normally and semantic search reports itself as not configured.
const MODEL = "voyage-3.5-lite"; // 1024 dims — matches the vector column

export function embeddingsConfigured(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}

export async function embed(
  texts: string[],
  inputType: "document" | "query"
): Promise<number[][] | null> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key || texts.length === 0) return null;
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model: MODEL, input: texts, input_type: inputType }),
  });
  if (!res.ok) {
    console.error("voyage embeddings failed:", res.status, await res.text());
    return null;
  }
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data.map((d) => d.embedding);
}

// The text an entry is embedded as — everything searchable about a session.
export function entryText(e: Entry): string {
  return [
    e.who && `person: ${e.who}`,
    e.location && `location: ${e.location}`,
    e.language !== "English" && `language: ${e.language}`,
    e.goal && `goal: ${e.goal}`,
    e.goal_tag && `category: ${e.goal_tag}`,
    e.metaphors.length && `metaphors: ${e.metaphors.join("; ")}`,
    e.technique && `technique: ${e.technique}`,
    e.notes && `notes: ${e.notes}`,
    `session description: ${e.raw_dump.slice(0, 4000)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// Embed one entry; failures are logged but never block a save.
export async function embedEntry(e: Entry): Promise<void> {
  try {
    const vecs = await embed([entryText(e)], "document");
    if (vecs?.[0]) await setEmbedding(e.id, vecs[0]);
  } catch (err) {
    console.error("embedding entry failed:", err);
  }
}

// Backfill entries that predate embeddings (or whose embed call failed).
export async function backfillEmbeddings(limit = 50): Promise<number> {
  if (!embeddingsConfigured()) return 0;
  const missing = await listMissingEmbeddings(limit);
  if (missing.length === 0) return 0;
  const vecs = await embed(missing.map(entryText), "document");
  if (!vecs) return 0;
  await Promise.all(missing.map((e, i) => setEmbedding(e.id, vecs[i])));
  return missing.length;
}
