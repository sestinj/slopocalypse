/**
 * Simple file-based storage for bug incidents and monitor state.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { type BugIncident } from "./schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
export const DATA_FILE = join(DATA_DIR, "incidents.json");
const MONITOR_STATE_FILE = join(DATA_DIR, "monitor-state.json");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

/** Read all incidents from the data file. */
export function readDataFile(): BugIncident[] {
  ensureDataDir();
  if (!existsSync(DATA_FILE)) return [];
  const raw = readFileSync(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}

function normalizeUrl(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    u.hash = "";
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.host}${path}${u.search}`.toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/+$/, "");
  }
}

function dedup(incidents: BugIncident[]): BugIncident[] {
  const seen = new Set<string>();
  return incidents.filter((i) => {
    const key = normalizeUrl(i.source_url);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Append incidents to the data file, deduplicating by normalized source_url. */
export function appendToDataFile(incidents: BugIncident[]) {
  const existing = readDataFile();
  const merged = dedup([...existing, ...incidents]);
  const added = merged.length - existing.length;

  if (added <= 0) {
    console.log("No new unique incidents to add.");
    return;
  }

  ensureDataDir();
  writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2));
  console.log(`Added ${added} new incidents (${merged.length} total).`);
}

/** Read monitor state (persisted monitor ID, etc.) */
export function readMonitorState(): Record<string, any> | null {
  ensureDataDir();
  if (!existsSync(MONITOR_STATE_FILE)) return null;
  const raw = readFileSync(MONITOR_STATE_FILE, "utf-8");
  return JSON.parse(raw);
}

/** Write monitor state. */
export function writeMonitorState(state: Record<string, any>) {
  ensureDataDir();
  writeFileSync(MONITOR_STATE_FILE, JSON.stringify(state, null, 2));
}
