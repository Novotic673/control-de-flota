import { prisma } from "./db";
import { DEFAULT_SETTINGS, type AppSettings } from "./domain/settings-defaults";

const KEY = "app";
let cache: { value: AppSettings; at: number } | null = null;

export async function getSettings(): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  const value = { ...DEFAULT_SETTINGS, ...((row?.value as Partial<AppSettings>) ?? {}) };
  cache = { value, at: Date.now() };
  return value;
}

export async function saveSettings(value: AppSettings) {
  await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
  cache = null;
}
