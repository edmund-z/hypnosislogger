import type { Entry } from "./types";

// Database adapter: uses Postgres via DATABASE_URL when set (production),
// otherwise falls back to an embedded PGlite database (local dev / preview).
type QueryResult = { rows: Record<string, unknown>[] };
type QueryFn = (text: string, params?: unknown[]) => Promise<QueryResult>;
type DB = { query: QueryFn; vectorEnabled: boolean };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS entries (
  id uuid PRIMARY KEY,
  date date NOT NULL,
  location text,
  who text,
  language text NOT NULL DEFAULT 'English',
  goal text,
  goal_tag text,
  metaphors jsonb NOT NULL DEFAULT '[]',
  technique text,
  effectiveness int,
  notes text,
  raw_dump text NOT NULL,
  incomplete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS entries_date_idx ON entries (date DESC, created_at DESC);
ALTER TABLE entries ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE TABLE IF NOT EXISTS entry_versions (
  id uuid PRIMARY KEY,
  entry_id uuid NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS entry_versions_entry_idx ON entry_versions (entry_id, created_at DESC);
`;

// Semantic search (optional): pgvector extension + embedding column. Applied
// separately so environments without pgvector still run everything else.
const VECTOR_SCHEMA = `
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS embedding vector(1024);
`;

declare global {
  // eslint-disable-next-line no-var
  var __hlDb: Promise<DB> | undefined;
}

async function createDb(): Promise<DB> {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL;
  let query: QueryFn;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: url,
      max: 3,
      ssl: url.includes("localhost") || url.includes("127.0.0.1")
        ? undefined
        : { rejectUnauthorized: false },
    });
    query = (text, params) => pool.query(text, params as never[]);
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { vector } = await import("@electric-sql/pglite/vector");
    const { mkdirSync } = await import("node:fs");
    // Prefer ./.data (persists across restarts in local dev). On serverless
    // the project dir is read-only, so fall back to /tmp — EPHEMERAL storage,
    // good enough to preview the app before DATABASE_URL is configured.
    let dir = "./.data/pglite";
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      dir = "/tmp/hl-pglite";
      mkdirSync(dir, { recursive: true });
      console.warn(
        "DATABASE_URL is not set — using ephemeral /tmp storage. Entries will NOT survive. Configure DATABASE_URL for real use."
      );
    }
    const db = new PGlite(dir, { extensions: { vector } });
    query = (text, params) => db.query(text, params as never[]);
  }
  for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
    await query(stmt);
  }
  let vectorEnabled = true;
  try {
    for (const stmt of VECTOR_SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
      await query(stmt);
    }
  } catch (err) {
    vectorEnabled = false;
    console.warn("pgvector unavailable — semantic search disabled:", err);
  }
  return { query, vectorEnabled };
}

function getDb(): Promise<DB> {
  // Cached on globalThis so hot reload / multiple route modules share one pool.
  if (!globalThis.__hlDb) globalThis.__hlDb = createDb();
  return globalThis.__hlDb;
}

function toEntry(row: Record<string, unknown>): Entry {
  const rawDate = row.date;
  const date =
    rawDate instanceof Date
      ? rawDate.toISOString().slice(0, 10)
      : String(rawDate).slice(0, 10);
  const metaphors =
    typeof row.metaphors === "string"
      ? (JSON.parse(row.metaphors) as string[])
      : ((row.metaphors as string[]) ?? []);
  const createdAt = row.created_at;
  const deletedAt = row.deleted_at;
  return {
    id: String(row.id),
    date,
    location: (row.location as string) ?? null,
    who: (row.who as string) ?? null,
    language: (row.language as string) || "English",
    goal: (row.goal as string) ?? null,
    goal_tag: (row.goal_tag as string) ?? null,
    metaphors,
    technique: (row.technique as string) ?? null,
    effectiveness: row.effectiveness == null ? null : Number(row.effectiveness),
    notes: (row.notes as string) ?? null,
    raw_dump: String(row.raw_dump ?? ""),
    incomplete: Boolean(row.incomplete),
    created_at:
      createdAt instanceof Date ? createdAt.toISOString() : String(createdAt),
    deleted_at:
      deletedAt == null
        ? null
        : deletedAt instanceof Date
          ? deletedAt.toISOString()
          : String(deletedAt),
  };
}

const ENTRY_COLS =
  "id, date, location, who, language, goal, goal_tag, metaphors, technique, effectiveness, notes, raw_dump, incomplete, created_at, deleted_at";

export async function listEntries(): Promise<Entry[]> {
  const { query } = await getDb();
  const res = await query(
    `SELECT ${ENTRY_COLS} FROM entries WHERE deleted_at IS NULL ORDER BY date DESC, created_at DESC`
  );
  return res.rows.map(toEntry);
}

export async function listTrash(): Promise<Entry[]> {
  const { query } = await getDb();
  const res = await query(
    `SELECT ${ENTRY_COLS} FROM entries WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`
  );
  return res.rows.map(toEntry);
}

export async function getEntry(id: string): Promise<Entry | null> {
  const { query } = await getDb();
  const res = await query(
    `SELECT ${ENTRY_COLS} FROM entries WHERE id = $1`,
    [id]
  );
  return res.rows[0] ? toEntry(res.rows[0]) : null;
}

export type NewEntry = Omit<Entry, "id" | "created_at" | "deleted_at">;

export async function createEntry(e: NewEntry): Promise<Entry> {
  const { query } = await getDb();
  const id = crypto.randomUUID();
  const res = await query(
    `INSERT INTO entries
       (id, date, location, who, language, goal, goal_tag, metaphors,
        technique, effectiveness, notes, raw_dump, incomplete)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING ${ENTRY_COLS}`,
    [
      id,
      e.date,
      e.location,
      e.who,
      e.language || "English",
      e.goal,
      e.goal_tag,
      JSON.stringify(e.metaphors ?? []),
      e.technique,
      e.effectiveness,
      e.notes,
      e.raw_dump,
      e.incomplete,
    ]
  );
  return toEntry(res.rows[0]);
}

export async function updateEntry(
  id: string,
  e: Partial<NewEntry>
): Promise<Entry | null> {
  const existing = await getEntry(id);
  if (!existing) return null;
  const { query } = await getDb();
  // Every edit snapshots the prior state — nothing is ever silently lost.
  await query(
    "INSERT INTO entry_versions (id, entry_id, snapshot) VALUES ($1, $2, $3)",
    [crypto.randomUUID(), id, JSON.stringify(existing)]
  );
  const merged = { ...existing, ...e };
  const res = await query(
    `UPDATE entries SET
       date=$2, location=$3, who=$4, language=$5, goal=$6, goal_tag=$7,
       metaphors=$8, technique=$9, effectiveness=$10, notes=$11,
       raw_dump=$12, incomplete=$13
     WHERE id=$1 RETURNING ${ENTRY_COLS}`,
    [
      id,
      merged.date,
      merged.location,
      merged.who,
      merged.language || "English",
      merged.goal,
      merged.goal_tag,
      JSON.stringify(merged.metaphors ?? []),
      merged.technique,
      merged.effectiveness,
      merged.notes,
      merged.raw_dump,
      merged.incomplete,
    ]
  );
  return res.rows[0] ? toEntry(res.rows[0]) : null;
}

export async function listVersions(
  entryId: string
): Promise<{ id: string; snapshot: Entry; created_at: string }[]> {
  const { query } = await getDb();
  const res = await query(
    "SELECT id, snapshot, created_at FROM entry_versions WHERE entry_id = $1 ORDER BY created_at DESC",
    [entryId]
  );
  return res.rows.map((r) => ({
    id: String(r.id),
    snapshot:
      typeof r.snapshot === "string"
        ? (JSON.parse(r.snapshot) as Entry)
        : (r.snapshot as Entry),
    created_at:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
  }));
}

// Delete = move to trash. Restorable until purged.
export async function trashEntry(id: string): Promise<boolean> {
  const { query } = await getDb();
  const res = await query(
    "UPDATE entries SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id",
    [id]
  );
  return res.rows.length > 0;
}

export async function restoreEntry(id: string): Promise<boolean> {
  const { query } = await getDb();
  const res = await query(
    "UPDATE entries SET deleted_at = NULL WHERE id = $1 RETURNING id",
    [id]
  );
  return res.rows.length > 0;
}

export async function purgeEntry(id: string): Promise<boolean> {
  const { query } = await getDb();
  await query("DELETE FROM entry_versions WHERE entry_id = $1", [id]);
  const res = await query("DELETE FROM entries WHERE id = $1 RETURNING id", [id]);
  return res.rows.length > 0;
}

export async function listGoalTags(): Promise<string[]> {
  const { query } = await getDb();
  const res = await query(
    "SELECT DISTINCT goal_tag FROM entries WHERE goal_tag IS NOT NULL AND deleted_at IS NULL ORDER BY goal_tag"
  );
  return res.rows.map((r) => String(r.goal_tag));
}

// Every distinct metaphor ever logged (first-seen wording kept as canonical).
// Fed to the parser so conceptually-identical metaphors get canonicalized to
// one wording and count as reuses in the Metaphor Bank.
export async function listMetaphors(): Promise<string[]> {
  const { metaphorKey } = await import("./types");
  const { query } = await getDb();
  const res = await query(
    "SELECT metaphors FROM entries WHERE deleted_at IS NULL"
  );
  const seen = new Map<string, string>();
  for (const row of res.rows) {
    const list =
      typeof row.metaphors === "string"
        ? (JSON.parse(row.metaphors) as string[])
        : ((row.metaphors as string[]) ?? []);
    for (const m of list) {
      const key = metaphorKey(m);
      if (key && !seen.has(key)) seen.set(key, m);
    }
  }
  return Array.from(seen.values());
}

// ---------- semantic search (pgvector) ----------

export async function vectorAvailable(): Promise<boolean> {
  return (await getDb()).vectorEnabled;
}

export async function setEmbedding(id: string, vec: number[]): Promise<void> {
  const { query, vectorEnabled } = await getDb();
  if (!vectorEnabled) return;
  await query("UPDATE entries SET embedding = $2::vector WHERE id = $1", [
    id,
    JSON.stringify(vec),
  ]);
}

export async function listMissingEmbeddings(
  limit: number
): Promise<Entry[]> {
  const { query, vectorEnabled } = await getDb();
  if (!vectorEnabled) return [];
  const res = await query(
    `SELECT ${ENTRY_COLS} FROM entries WHERE embedding IS NULL AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return res.rows.map(toEntry);
}

export async function semanticSearch(
  vec: number[],
  limit: number
): Promise<Entry[]> {
  const { query, vectorEnabled } = await getDb();
  if (!vectorEnabled) return [];
  const res = await query(
    `SELECT ${ENTRY_COLS} FROM entries
     WHERE deleted_at IS NULL AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [JSON.stringify(vec), limit]
  );
  return res.rows.map(toEntry);
}
