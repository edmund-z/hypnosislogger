import type { Entry } from "./types";

// Database adapter: uses Postgres via DATABASE_URL when set (production),
// otherwise falls back to an embedded PGlite database in ./.data (local dev).
type QueryResult = { rows: Record<string, unknown>[] };
type QueryFn = (text: string, params?: unknown[]) => Promise<QueryResult>;

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
`;

declare global {
  // eslint-disable-next-line no-var
  var __hlQuery: Promise<QueryFn> | undefined;
}

async function createQueryFn(): Promise<QueryFn> {
  const url = process.env.DATABASE_URL;
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
    const db = new PGlite(dir);
    query = (text, params) => db.query(text, params as never[]);
  }
  for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
    await query(stmt);
  }
  return query;
}

function getQuery(): Promise<QueryFn> {
  // Cached on globalThis so hot reload / multiple route modules share one pool.
  if (!globalThis.__hlQuery) globalThis.__hlQuery = createQueryFn();
  return globalThis.__hlQuery;
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
  };
}

export async function listEntries(): Promise<Entry[]> {
  const query = await getQuery();
  const res = await query(
    "SELECT * FROM entries ORDER BY date DESC, created_at DESC"
  );
  return res.rows.map(toEntry);
}

export async function getEntry(id: string): Promise<Entry | null> {
  const query = await getQuery();
  const res = await query("SELECT * FROM entries WHERE id = $1", [id]);
  return res.rows[0] ? toEntry(res.rows[0]) : null;
}

export type NewEntry = Omit<Entry, "id" | "created_at">;

export async function createEntry(e: NewEntry): Promise<Entry> {
  const query = await getQuery();
  const id = crypto.randomUUID();
  const res = await query(
    `INSERT INTO entries
       (id, date, location, who, language, goal, goal_tag, metaphors,
        technique, effectiveness, notes, raw_dump, incomplete)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
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
  const merged = { ...existing, ...e };
  const query = await getQuery();
  const res = await query(
    `UPDATE entries SET
       date=$2, location=$3, who=$4, language=$5, goal=$6, goal_tag=$7,
       metaphors=$8, technique=$9, effectiveness=$10, notes=$11,
       raw_dump=$12, incomplete=$13
     WHERE id=$1 RETURNING *`,
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

export async function deleteEntry(id: string): Promise<boolean> {
  const query = await getQuery();
  const res = await query("DELETE FROM entries WHERE id = $1 RETURNING id", [id]);
  return res.rows.length > 0;
}

export async function listGoalTags(): Promise<string[]> {
  const query = await getQuery();
  const res = await query(
    "SELECT DISTINCT goal_tag FROM entries WHERE goal_tag IS NOT NULL ORDER BY goal_tag"
  );
  return res.rows.map((r) => String(r.goal_tag));
}
