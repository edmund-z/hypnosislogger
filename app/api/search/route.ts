import { NextRequest, NextResponse } from "next/server";
import { semanticSearch, vectorAvailable } from "@/lib/db";
import {
  backfillEmbeddings,
  embed,
  embeddingsConfigured,
} from "@/lib/embeddings";

export const maxDuration = 60;

// Semantic ("deep") search: finds entries by meaning, not keywords.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "Empty query." }, { status: 400 });
  if (!embeddingsConfigured()) {
    return NextResponse.json(
      {
        error:
          "Semantic search is not configured — set VOYAGE_API_KEY (free at voyageai.com).",
      },
      { status: 501 }
    );
  }
  if (!(await vectorAvailable())) {
    return NextResponse.json(
      { error: "This database does not support pgvector." },
      { status: 501 }
    );
  }
  try {
    // Opportunistically index any entries that predate embeddings.
    await backfillEmbeddings(60);
    const vecs = await embed([q], "query");
    if (!vecs?.[0]) {
      return NextResponse.json(
        { error: "Embedding the query failed — try again." },
        { status: 502 }
      );
    }
    const results = await semanticSearch(vecs[0], 20);
    return NextResponse.json(results);
  } catch (err) {
    console.error("semantic search failed:", err);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
