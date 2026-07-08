import { NextRequest, NextResponse } from "next/server";
import { listEntries, listTrash } from "@/lib/db";
import { backfillEmbeddings } from "@/lib/embeddings";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";

export const maxDuration = 60;

// Off-site backup: pushes a dated JSON snapshot of the whole log to a private
// GitHub repo (BACKUP_GITHUB_REPO = "owner/repo", BACKUP_GITHUB_TOKEN = a
// fine-grained PAT with Contents read/write on that repo). Runs daily via
// Vercel cron and on demand from the Stats screen.
//
// Middleware lets this path through; auth happens here: either the Vercel
// cron secret or a logged-in session.
async function authorized(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`) {
    return true;
  }
  return isValidToken(req.cookies.get(AUTH_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const repo = process.env.BACKUP_GITHUB_REPO;
  const token = process.env.BACKUP_GITHUB_TOKEN;
  if (!repo || !token) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Backups not configured. Create a PRIVATE GitHub repo, then set BACKUP_GITHUB_REPO (owner/repo) and BACKUP_GITHUB_TOKEN (fine-grained PAT with Contents read/write).",
      },
      { status: 501 }
    );
  }

  try {
    // The daily cron also keeps the semantic index fresh — cheap housekeeping.
    await backfillEmbeddings(60).catch(() => 0);

    const [entries, trash] = await Promise.all([listEntries(), listTrash()]);
    const snapshot = JSON.stringify(
      {
        backed_up_at: new Date().toISOString(),
        entry_count: entries.length,
        trash_count: trash.length,
        entries,
        trash,
      },
      null,
      2
    );

    const date = new Date().toISOString().slice(0, 10);
    const path = `backups/hypnosis-log-${date}.json`;
    const api = `https://api.github.com/repos/${repo}/contents/${path}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };

    // If today's file already exists, we need its sha to overwrite it.
    let sha: string | undefined;
    const existing = await fetch(api, { headers });
    if (existing.ok) {
      sha = ((await existing.json()) as { sha: string }).sha;
    }

    const put = await fetch(api, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: `Backup ${date} (${entries.length} entries)`,
        content: Buffer.from(snapshot, "utf8").toString("base64"),
        ...(sha ? { sha } : {}),
      }),
    });
    if (!put.ok) {
      const detail = await put.text();
      console.error("backup push failed:", put.status, detail);
      return NextResponse.json(
        { ok: false, error: `GitHub rejected the backup (${put.status}). Check the token's permissions.` },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, file: path, entries: entries.length });
  } catch (err) {
    console.error("backup failed:", err);
    return NextResponse.json({ ok: false, error: "Backup failed." }, { status: 500 });
  }
}
