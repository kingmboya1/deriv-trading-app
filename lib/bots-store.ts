/**
 * bots-store.ts
 * Server-side helpers for reading and writing the bots JSON file.
 * The file lives at /data/bots.json (created on first write).
 * On Hugging Face Spaces this is in-process memory — for persistence
 * across restarts store the JSON in an env var or use HF Datasets API.
 */

import { promises as fs } from "fs";
import path from "path";

export interface BotEntry {
  id: string;
  name: string;
  winRate: number;       // 0-100
  description: string;
  strategy: string;      // XML / JSON content as a string
  createdAt: string;     // ISO date
}

const DATA_DIR  = path.join(process.cwd(), "data");
const BOTS_FILE = path.join(DATA_DIR, "bots.json");

export async function readBots(): Promise<BotEntry[]> {
  try {
    const raw = await fs.readFile(BOTS_FILE, "utf-8");
    return JSON.parse(raw) as BotEntry[];
  } catch {
    return [];
  }
}

export async function writeBots(bots: BotEntry[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(BOTS_FILE, JSON.stringify(bots, null, 2), "utf-8");
}

export async function addBot(bot: Omit<BotEntry, "id" | "createdAt">): Promise<BotEntry> {
  const bots = await readBots();
  const newBot: BotEntry = {
    ...bot,
    id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  bots.push(newBot);
  await writeBots(bots);
  return newBot;
}

export async function deleteBot(id: string): Promise<void> {
  const bots = await readBots();
  await writeBots(bots.filter((b) => b.id !== id));
}
