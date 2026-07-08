import { NextRequest, NextResponse } from "next/server";
import { listVersions } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    return NextResponse.json(await listVersions(id));
  } catch (err) {
    console.error("list versions failed:", err);
    return NextResponse.json({ error: "Database error." }, { status: 500 });
  }
}
