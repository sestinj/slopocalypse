/**
 * Minimal webhook receiver for Parallel Monitor events.
 *
 * Run this to receive real-time push notifications when the monitor
 * detects new articles about buggy software.
 *
 * Usage:
 *   npx tsx src/webhook-server.ts
 *
 * Then expose it with ngrok or similar:
 *   ngrok http 3456
 *
 * And pass the ngrok URL as WEBHOOK_URL when creating the monitor.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { type BugIncident } from "./schema.js";
import { appendToDataFile, DATA_FILE } from "./store.js";

const PORT = parseInt(process.env.PORT ?? "3456", 10);

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
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

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // Webhook endpoint
  if (req.method === "POST" && req.url === "/webhook") {
    try {
      const body = await parseBody(req);
      console.log(
        `\n[${new Date().toISOString()}] Webhook received: ${body.type}`
      );

      if (body.type === "monitor.event.detected") {
        const event = body.data?.event ?? {};
        console.log(`  Monitor: ${body.data?.monitor_id}`);
        console.log(`  Event Group: ${event.event_group_id}`);

        const data = event.data ?? event;
        const incident: BugIncident = {
          title: data.title ?? "Monitor detection",
          software: data.software ?? "Unknown",
          vendor: data.vendor ?? "Unknown",
          description: data.description ?? "",
          severity: data.severity ?? "major",
          date_reported:
            data.date_reported ?? new Date().toISOString().split("T")[0],
          source_url: data.source_url ?? data.url ?? "",
          source_name: data.source_name ?? "",
        };

        appendToDataFile([incident]);
        console.log(`  Saved: ${incident.title}`);
      } else if (body.type === "monitor.execution.completed") {
        console.log("  Monitor run completed (no new events).");
      } else if (body.type === "monitor.execution.failed") {
        console.error("  Monitor run FAILED:", body.data?.event?.message);
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ received: true }));
    } catch (err) {
      console.error("  Error processing webhook:", err);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Bad request" }));
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Webhook server listening on http://localhost:${PORT}`);
  console.log(`  POST /webhook  — receives monitor events`);
  console.log(`  GET  /health   — health check`);
  console.log(`\nData file: ${DATA_FILE}`);
  console.log(
    "\nTip: expose this with `ngrok http ${PORT}` and use the URL when creating the monitor."
  );
});
