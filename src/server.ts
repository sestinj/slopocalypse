/**
 * Slopocalypse server: serves the site, API, and webhook endpoint.
 *
 * Routes:
 *   GET  /              — the site (HTML)
 *   GET  /api/incidents — JSON data
 *   POST /api/webhook   — Parallel Monitor webhook receiver
 *   GET  /health        — health check
 *
 * Usage:
 *   PORT=3456 npx tsx src/server.ts
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { type BugIncident } from "./schema.js";
import { appendToDataFile, readDataFile } from "./store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

const PORT = parseInt(process.env.PORT ?? "3456", 10);

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

function html(res: ServerResponse, content: string) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(content);
}

// ── Webhook handler ──────────────────────────────────────────────────

async function handleWebhook(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req);
    console.log(`[${new Date().toISOString()}] Webhook: ${body.type}`);

    if (body.type === "monitor.event.detected") {
      const event = body.data?.event ?? {};
      const data = event.data ?? event;
      const incident: BugIncident = {
        title: data.title ?? "Monitor detection",
        software: data.software ?? "Unknown",
        vendor: data.vendor ?? "Unknown",
        description: data.description ?? "",
        severity: data.severity ?? "major",
        date_reported: data.date_reported ?? new Date().toISOString().split("T")[0],
        source_url: data.source_url ?? data.url ?? "",
        source_name: data.source_name ?? "",
      };
      appendToDataFile([incident]);
      console.log(`  Saved: ${incident.title}`);
    }

    json(res, 200, { received: true });
  } catch {
    json(res, 400, { error: "Bad request" });
  }
}

// ── Site HTML ────────────────────────────────────────────────────────

function renderSite(): string {
  return readFileSync(join(PUBLIC_DIR, "index.html"), "utf-8");
}

// ── Server ───────────────────────────────────────────────────────────

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = req.url ?? "/";
  const method = req.method ?? "GET";

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (method === "GET" && url === "/") {
    html(res, renderSite());
  } else if (method === "GET" && url === "/api/incidents") {
    json(res, 200, readDataFile());
  } else if (method === "POST" && url === "/api/webhook") {
    await handleWebhook(req, res);
  } else if (method === "GET" && url === "/health") {
    json(res, 200, { status: "ok", incidents: readDataFile().length });
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`\n  Slopocalypse server running at http://localhost:${PORT}\n`);
  console.log(`  Routes:`);
  console.log(`    GET  /              — the site`);
  console.log(`    GET  /api/incidents — JSON data`);
  console.log(`    POST /api/webhook   — monitor webhook`);
  console.log(`    GET  /health        — health check\n`);
});
