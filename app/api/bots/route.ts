import { NextResponse } from "next/server";
import { readBots } from "@/lib/bots-store";

// GET /api/bots — public list (no strategy content exposed)
export async function GET() {
  const bots = await readBots();
  const safe = bots.map(({ strategy: _s, ...rest }) => rest);
  return NextResponse.json(safe);
}
