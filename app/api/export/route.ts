import { NextResponse } from "next/server";
import { listEntries } from "@/lib/db";

export async function GET() {
  try {
    const entries = await listEntries();
    const body = JSON.stringify(
      { exported_at: new Date().toISOString(), count: entries.length, entries },
      null,
      2
    );
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="hypnosis-log-${new Date()
          .toISOString()
          .slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    console.error("export failed:", err);
    return NextResponse.json({ error: "Database error." }, { status: 500 });
  }
}
