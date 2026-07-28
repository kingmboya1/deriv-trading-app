import { NextRequest, NextResponse } from "next/server";
import { readBots, addBot, deleteBot } from "@/lib/bots-store";

// Simple password check from env
function isAuthorized(req: NextRequest): boolean {
  const password = req.headers.get("x-admin-password") ?? "";
  const expected = process.env.ADMIN_PASSWORD ?? "changeme";
  return password === expected;
}

// GET /api/admin/bots — list all bots including strategy
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const bots = await readBots();
  return NextResponse.json(bots);
}

// POST /api/admin/bots — add a new bot
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as {
    name?: string;
    winRate?: number;
    description?: string;
    strategy?: string;
  };
  if (!body.name || body.winRate === undefined) {
    return NextResponse.json({ error: "name and winRate required" }, { status: 400 });
  }
  const bot = await addBot({
    name: body.name,
    winRate: Number(body.winRate),
    description: body.description ?? "",
    strategy: body.strategy ?? "",
  });
  return NextResponse.json(bot, { status: 201 });
}

// DELETE /api/admin/bots?id=xxx
export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  await deleteBot(id);
  return NextResponse.json({ ok: true });
}
