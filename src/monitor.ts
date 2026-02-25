/**
 * Monitor: continuously watch for new articles about buggy software releases.
 *
 * Uses Parallel's Monitor API (v1alpha) to set up an always-on watch for new
 * incidents, with webhook delivery for real-time updates.
 *
 * The Monitor API uses raw HTTP methods on the client since it's in alpha.
 *
 * Usage:
 *   # Create the monitor
 *   PARALLEL_API_KEY=pk_... npx tsx src/monitor.ts create
 *
 *   # Poll for recent events (if not using webhooks)
 *   PARALLEL_API_KEY=pk_... npx tsx src/monitor.ts poll
 *
 *   # Delete the monitor
 *   PARALLEL_API_KEY=pk_... npx tsx src/monitor.ts delete <monitor_id>
 */

import Parallel from "parallel-web";
import { type BugIncident } from "./schema.js";
import {
  appendToDataFile,
  DATA_FILE,
  readMonitorState,
  writeMonitorState,
} from "./store.js";

const client = new Parallel({ apiKey: process.env.PARALLEL_API_KEY });

const MONITOR_QUERY =
  "New reports of major software bugs, crashes, or quality issues in shipped products. " +
  "Software updates that cause crashes, data loss, bricked devices, or widespread user complaints. " +
  "Buggy releases from companies like Microsoft, Apple, Google, Adobe, CrowdStrike, Tesla, Samsung, " +
  "and others. Include coverage from tech news sites like ZDNet, The Verge, Ars Technica, " +
  "TechCrunch, Wired, and BleepingComputer.";

async function createMonitor() {
  const webhookUrl = process.env.WEBHOOK_URL;

  const body: Record<string, any> = {
    query: MONITOR_QUERY,
    cadence: "daily",
  };

  if (webhookUrl) {
    body.webhook = {
      url: webhookUrl,
      event_types: [
        "monitor.event.detected",
        "monitor.execution.completed",
        "monitor.execution.failed",
      ],
    };
    console.log(`Webhook configured: ${webhookUrl}`);
  } else {
    console.log(
      "No WEBHOOK_URL set — you can poll for events manually with `poll` command."
    );
  }

  const res = (await client.post("/v1alpha/monitors", { body })) as any;
  const monitorId = res.monitor_id;

  writeMonitorState({ monitor_id: monitorId });

  console.log(`\nMonitor created successfully!`);
  console.log(`  Monitor ID: ${monitorId}`);
  console.log(`  Cadence:    daily`);
  console.log(`  Query:      ${MONITOR_QUERY.slice(0, 80)}...`);
  console.log(`\nMonitor ID saved to data/monitor-state.json`);
}

async function pollEvents() {
  const state = readMonitorState();
  if (!state?.monitor_id) {
    console.error(
      "No monitor found. Run `create` first, or set monitor_id in data/monitor-state.json."
    );
    process.exit(1);
  }

  const monitorId = state.monitor_id;
  console.log(`Polling events for monitor: ${monitorId}\n`);

  // List recent events (flattened, reverse chronological)
  const res = (await client.get(
    `/v1alpha/monitors/${monitorId}/events`
  )) as any;
  const eventList = res.events ?? res.data ?? [];

  if (!Array.isArray(eventList) || eventList.length === 0) {
    console.log("No events found yet. The monitor runs on a daily cadence.");
    return;
  }

  console.log(`Found ${eventList.length} event(s):\n`);

  const incidents: BugIncident[] = [];
  for (const event of eventList) {
    console.log(`  Event Group: ${event.event_group_id ?? "N/A"}`);
    console.log(`  Type: ${event.type}`);

    if (event.type === "error") {
      console.log(`  Error: ${event.message ?? "unknown"}\n`);
      continue;
    }

    const data = event.data ?? event;
    const incident: BugIncident = {
      title: data.title ?? data.name ?? "Monitor event",
      software: data.software ?? "Unknown",
      vendor: data.vendor ?? "Unknown",
      description: data.description ?? data.summary ?? "",
      severity: data.severity ?? "major",
      date_reported:
        data.date_reported ?? new Date().toISOString().split("T")[0],
      source_url: data.source_url ?? data.url ?? "",
      source_name: data.source_name ?? "",
    };

    incidents.push(incident);
    console.log(`  Title: ${incident.title}`);
    console.log(`  URL: ${incident.source_url}\n`);
  }

  if (incidents.length > 0) {
    appendToDataFile(incidents);
    console.log(`\nAppended ${incidents.length} incidents to ${DATA_FILE}`);
  }
}

async function deleteMonitor(monitorId: string) {
  await client.delete(`/v1alpha/monitors/${monitorId}`);
  writeMonitorState({});
  console.log(`Monitor ${monitorId} deleted.`);
}

// --- CLI ---

const command = process.argv[2];

switch (command) {
  case "create":
    createMonitor().catch(die);
    break;

  case "poll":
    pollEvents().catch(die);
    break;

  case "delete": {
    const id = process.argv[3];
    if (!id) {
      console.error("Usage: monitor.ts delete <monitor_id>");
      process.exit(1);
    }
    deleteMonitor(id).catch(die);
    break;
  }

  default:
    console.log("Usage: monitor.ts <create|poll|delete> [monitor_id]");
    process.exit(1);
}

function die(err: Error) {
  console.error("Monitor command failed:", err);
  process.exit(1);
}
