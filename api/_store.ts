/**
 * Blob-backed storage for incidents.
 * Prefixed with _ so Vercel doesn't deploy it as an endpoint.
 */

import { put, get } from "@vercel/blob";

export interface BugIncident {
  title: string;
  software: string;
  vendor: string;
  description: string;
  severity: "critical" | "major" | "minor";
  date_reported: string;
  source_url: string;
  source_name: string;
}

const BLOB_PATH = "slopocalypse/incidents.json";

export async function readIncidents(): Promise<BugIncident[]> {
  try {
    const result = await get(BLOB_PATH, { access: "public" });
    if (!result) return [];
    const text = await new Response(result.stream).text();
    return JSON.parse(text);
  } catch {
    return [];
  }
}

/** Deduplicate by source_url, keeping the first occurrence. */
function dedup(incidents: BugIncident[]): BugIncident[] {
  const seen = new Set<string>();
  return incidents.filter((i) => {
    const key = normalizeUrl(i.source_url);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Strip trailing slashes, fragments, and common tracking params for URL comparison. */
function normalizeUrl(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    u.hash = "";
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    // Remove trailing slash
    let path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.host}${path}${u.search}`.toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/+$/, "");
  }
}

export async function writeIncidents(incidents: BugIncident[]): Promise<void> {
  const deduplicated = dedup(incidents);
  await put(BLOB_PATH, JSON.stringify(deduplicated), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

export async function appendIncidents(
  newIncidents: BugIncident[]
): Promise<{ added: number; total: number }> {
  const existing = await readIncidents();
  const merged = dedup([...existing, ...newIncidents]);
  const added = merged.length - existing.length;

  if (added <= 0) {
    return { added: 0, total: existing.length };
  }

  await put(BLOB_PATH, JSON.stringify(merged), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
  return { added, total: merged.length };
}
