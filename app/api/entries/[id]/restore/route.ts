import { NextRequest, NextResponse } from "next/server";
import { restoreEntry } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const ok = await restoreEntry(id);
    if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("restore failed:", err);
    return NextResponse.json({ error: "Database error." }, { status: 500 });
  }
}
