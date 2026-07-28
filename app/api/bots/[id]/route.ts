import { NextRequest, NextResponse } from "next/server";
import { readBots } from "@/lib/bots-store";

// GET /api/bots/:id/strategy — returns strategy XML for a specific bot
// Only called client-side after user clicks "Load Bot"
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const bots = await readBots();
  const bot = bots.find((b) => b.id === params.id);
  if (!bot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }
  return NextResponse.json({ id: bot.id, name: bot.name, strategy: bot.strategy });
}
