import { NextRequest, NextResponse } from "next/server";
import { createEntry, listEntries, NewEntry } from "@/lib/db";
import { computeMissing } from "@/lib/types";

export async function GET() {
  try {
    return NextResponse.json(await listEntries());
  } catch (err) {
    console.error("list entries failed:", err);
    return NextResponse.json({ error: "Database error." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: Partial<NewEntry>;
  try {
    body = (await req.json()) as Partial<NewEntry>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.raw_dump || !String(body.raw_dump).trim()) {
    return NextResponse.json({ error: "raw_dump is required." }, { status: 400 });
  }
  const entry: NewEntry = {
    date: body.date || new Date().toISOString().slice(0, 10),
    location: body.location ?? null,
    who: body.who ?? null,
    language: body.language || "English",
    goal: body.goal ?? null,
    goal_tag: body.goal_tag ?? null,
    metaphors: Array.isArray(body.metaphors) ? body.metaphors : [],
    technique: body.technique ?? null,
    effectiveness: body.effectiveness ?? null,
    notes: body.notes ?? null,
    raw_dump: String(body.raw_dump),
    incomplete: computeMissing({
      goal: body.goal ?? null,
      metaphors: Array.isArray(body.metaphors) ? body.metaphors : [],
      technique: body.technique ?? null,
      effectiveness: body.effectiveness ?? null,
    }).length > 0,
  };
  try {
    const created = await createEntry(entry);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("create entry failed:", err);
    return NextResponse.json({ error: "Database error." }, { status: 500 });
  }
}
