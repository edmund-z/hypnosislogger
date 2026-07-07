import { NextRequest, NextResponse } from "next/server";
import { listGoalTags, listMetaphors } from "@/lib/db";
import { parseDump, ParseRequest } from "@/lib/parse";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: ParseRequest;
  try {
    body = (await req.json()) as ParseRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.dump || !body.dump.trim()) {
    return NextResponse.json({ error: "Empty dump." }, { status: 400 });
  }
  try {
    const [tags, metaphors] = await Promise.all([
      listGoalTags(),
      listMetaphors(),
    ]);
    const parsed = await parseDump(body, tags, metaphors);
    return NextResponse.json(parsed);
  } catch (err) {
    const e = err as Error & { status?: number };
    console.error("parse failed:", e);
    return NextResponse.json(
      { error: e.message || "Parse failed." },
      { status: e.status ?? 502 }
    );
  }
}
