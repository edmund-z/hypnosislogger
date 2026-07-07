import { NextRequest, NextResponse } from "next/server";
import { deleteEntry, getEntry, updateEntry, NewEntry } from "@/lib/db";
import { computeMissing } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const entry = await getEntry(id).catch(() => null);
  if (!entry) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(entry);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: Partial<NewEntry>;
  try {
    body = (await req.json()) as Partial<NewEntry>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    const existing = await getEntry(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const merged = { ...existing, ...body };
    const updated = await updateEntry(id, {
      ...body,
      incomplete: computeMissing(merged).length > 0,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("update entry failed:", err);
    return NextResponse.json({ error: "Database error." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const ok = await deleteEntry(id);
    if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("delete entry failed:", err);
    return NextResponse.json({ error: "Database error." }, { status: 500 });
  }
}
