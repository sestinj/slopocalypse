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

import { Resvg } from "@resvg/resvg-js";
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

// ── Submit handler (creates a GitHub issue) ─────────────────────────

const GITHUB_REPO = "sestinj/slopocalypse";

async function handleSubmit(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req);
    const title = (body.title ?? "").trim();
    if (!title) {
      json(res, 400, { error: "Title is required" });
      return;
    }

    const issueTitle = `[Submission] ${title}`;
    const issueBody = [
      `**Software:** ${body.software || "N/A"}`,
      `**Vendor:** ${body.vendor || "N/A"}`,
      `**Severity:** ${body.severity || "N/A"}`,
      `**Source URL:** ${body.source_url || "N/A"}`,
      `**Source Name:** ${body.source_name || "N/A"}`,
      "",
      "**Description:**",
      body.description || "No description provided.",
      "",
      "---",
      "*Submitted via the Slopocalypse website.*",
    ].join("\n");

    const ghToken = process.env.GITHUB_TOKEN;
    if (!ghToken) {
      console.warn("GITHUB_TOKEN not set — logging submission locally");
      console.log(`[SUBMISSION] ${issueTitle}\n${issueBody}`);
      json(res, 200, { ok: true, note: "Logged locally (no GITHUB_TOKEN)" });
      return;
    }

    const ghRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ghToken}`,
        "Content-Type": "application/json",
        "User-Agent": "slopocalypse-server",
      },
      body: JSON.stringify({ title: issueTitle, body: issueBody, labels: ["submission"] }),
    });

    if (!ghRes.ok) {
      const err = await ghRes.text();
      console.error("GitHub API error:", ghRes.status, err);
      json(res, 502, { error: "Failed to create issue" });
      return;
    }

    const issue = await ghRes.json() as { html_url: string };
    console.log(`[${new Date().toISOString()}] Issue created: ${issue.html_url}`);
    json(res, 200, { ok: true, issue_url: issue.html_url });
  } catch {
    json(res, 400, { error: "Bad request" });
  }
}

// ── OG card SVG ─────────────────────────────────────────────────────

function serveSvg(res: ServerResponse) {
  const count = readDataFile().length;
  const svg = generateOgSvg(count);
  res.writeHead(200, {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=3600",
  });
  res.end(svg);
}

function servePng(res: ServerResponse) {
  const count = readDataFile().length;
  const svg = generateOgSvg(count);
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
  const png = resvg.render().asPng();
  res.writeHead(200, {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=3600",
  });
  res.end(png);
}

function generateOgSvg(incidentCount: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <pattern id="tape" patternUnits="userSpaceOnUse" width="40" height="40" patternTransform="rotate(-45)">
      <rect width="20" height="40" fill="#e8a308"/>
      <rect x="20" width="20" height="40" fill="#1a1a1c"/>
    </pattern>
    <filter id="glow">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <linearGradient id="barGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#e8a308"/>
      <stop offset="100%" stop-color="#d4890a"/>
    </linearGradient>
    <radialGradient id="bgGlow" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#1a1508" stop-opacity="1"/>
      <stop offset="100%" stop-color="#0b0b0d" stop-opacity="1"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGlow)"/>

  <!-- Caution tape borders -->
  <rect x="0" y="0" width="1200" height="10" fill="url(#tape)"/>
  <rect x="0" y="620" width="1200" height="10" fill="url(#tape)"/>
  <rect x="0" y="0" width="10" height="630" fill="url(#tape)"/>
  <rect x="1190" y="0" width="10" height="630" fill="url(#tape)"/>

  <!-- Decorative grid lines -->
  <g opacity="0.04" stroke="#e8a308" stroke-width="1">
    <line x1="0" y1="160" x2="1200" y2="160"/>
    <line x1="0" y1="320" x2="1200" y2="320"/>
    <line x1="0" y1="480" x2="1200" y2="480"/>
    <line x1="300" y1="0" x2="300" y2="630"/>
    <line x1="600" y1="0" x2="600" y2="630"/>
    <line x1="900" y1="0" x2="900" y2="630"/>
  </g>

  <!-- Glitch decoration lines -->
  <rect x="80" y="180" width="140" height="2" fill="#e8a308" opacity="0.15"/>
  <rect x="980" y="420" width="100" height="2" fill="#ef4444" opacity="0.15"/>
  <rect x="60" y="450" width="80" height="1" fill="#e8a308" opacity="0.1"/>

  <!-- Warning icon -->
  <g transform="translate(600, 155)" filter="url(#glow)">
    <polygon points="0,-55 50,35 -50,35" fill="none" stroke="#e8a308" stroke-width="3" opacity="0.7"/>
    <text y="14" text-anchor="middle" font-family="monospace" font-size="36" font-weight="800" fill="#e8a308" dominant-baseline="auto">!</text>
  </g>

  <!-- Title -->
  <text x="600" y="280" text-anchor="middle" font-family="'SF Mono','Fira Code','Courier New',monospace" font-size="72" font-weight="800" letter-spacing="10" fill="#e8a308" filter="url(#glow)">SLOPOCALYPSE</text>

  <!-- Subtitle -->
  <text x="600" y="330" text-anchor="middle" font-family="'SF Mono','Fira Code','Courier New',monospace" font-size="18" fill="#7a7468" letter-spacing="2">TRACKING BUGGY SOFTWARE AND OUTAGES CAUSED BY AI</text>

  <!-- Divider line -->
  <line x1="400" y1="365" x2="800" y2="365" stroke="#252528" stroke-width="1"/>

  <!-- Stats boxes -->
  <g transform="translate(310, 400)">
    <rect x="0" y="0" width="180" height="80" rx="2" fill="#111113" stroke="#252528"/>
    <text x="90" y="40" text-anchor="middle" font-family="monospace" font-size="32" font-weight="800" fill="#f0f0f0">${incidentCount}</text>
    <text x="90" y="62" text-anchor="middle" font-family="monospace" font-size="10" fill="#5a554c" letter-spacing="2">INCIDENTS</text>
  </g>

  <g transform="translate(510, 400)">
    <rect x="0" y="0" width="180" height="80" rx="2" fill="#111113" stroke="#252528"/>
    <text x="90" y="40" text-anchor="middle" font-family="monospace" font-size="32" font-weight="800" fill="#ef4444">LIVE</text>
    <text x="90" y="62" text-anchor="middle" font-family="monospace" font-size="10" fill="#5a554c" letter-spacing="2">MONITORING</text>
  </g>

  <g transform="translate(710, 400)">
    <rect x="0" y="0" width="180" height="80" rx="2" fill="#111113" stroke="#252528"/>
    <text x="90" y="40" text-anchor="middle" font-family="monospace" font-size="32" font-weight="800" fill="#e8a308">OPEN</text>
    <text x="90" y="62" text-anchor="middle" font-family="monospace" font-size="10" fill="#5a554c" letter-spacing="2">TO SUBMISSIONS</text>
  </g>

  <!-- Bottom tagline -->
  <text x="600" y="555" text-anchor="middle" font-family="monospace" font-size="12" fill="#3a3836" letter-spacing="1">slopocalypse.sh</text>

  <!-- Scan line effect -->
  <rect x="0" y="0" width="1200" height="630" fill="url(#tape)" opacity="0.008"/>
</svg>`;
}

// ── Site HTML ────────────────────────────────────────────────────────

function renderSite(): string {
  return readFileSync(join(PUBLIC_DIR, "index.html"), "utf-8");
}

// ── Server ───────────────────────────────────────────────────────────

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = (req.url ?? "/").split("?")[0];
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
  } else if (method === "POST" && url === "/api/submit") {
    await handleSubmit(req, res);
  } else if (method === "GET" && url === "/og.svg") {
    serveSvg(res);
  } else if (method === "GET" && url === "/og.png") {
    servePng(res);
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
  console.log(`    POST /api/submit    — submit incident (creates GitHub issue)`);
  console.log(`    GET  /og.svg        — OG social card`);
  console.log(`    GET  /health        — health check\n`);
});
