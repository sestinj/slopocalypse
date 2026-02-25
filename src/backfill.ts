/**
 * Backfill: discover historical articles about buggy software releases.
 *
 * Uses Parallel's Task Group API to run many research tasks in parallel,
 * each searching for buggy software incidents from a specific company/category.
 * Returns structured JSON matching the BugIncident schema.
 *
 * Usage:
 *   PARALLEL_API_KEY=pk_... npx tsx src/backfill.ts
 */

import Parallel from "parallel-web";
import { BUG_INCIDENT_JSON_SCHEMA, type BugIncident } from "./schema.js";
import { appendToDataFile, DATA_FILE } from "./store.js";

const client = new Parallel({ apiKey: process.env.PARALLEL_API_KEY });

// Each query targets a different company/category for broad coverage.
const SEARCH_QUERIES = [
  "Find recent news articles (2024-2025) about Microsoft Windows 11 updates that shipped with major bugs, crashes, or issues that affected users. Include specific update version numbers and what went wrong.",
  "Find recent news articles (2024-2025) about Apple iOS or macOS updates that shipped with significant bugs, glitches, or quality issues affecting iPhone, iPad, or Mac users.",
  "Find recent news articles (2024-2025) about Google Android, Chrome, or Google Cloud bugs and outages that shipped and caused problems for users.",
  "Find recent news articles (2024-2025) about the CrowdStrike Falcon update that caused a massive global IT outage, bricking millions of Windows machines.",
  "Find recent news articles (2024-2025) about Adobe software updates (Creative Cloud, Acrobat, etc.) that shipped with bugs or caused data loss or workflow disruptions.",
  "Find recent news articles (2024-2025) about Tesla software updates (Autopilot, Full Self-Driving, infotainment) that had bugs, crashes, or safety recalls.",
  "Find recent news articles (2024-2025) about Samsung Galaxy phone or TV software updates that shipped with bugs, performance issues, or bricked devices.",
  "Find recent news articles (2024-2025) about major cloud service outages or bugs from AWS, Azure, or Google Cloud that were caused by bad code deployments or software defects.",
  "Find recent news articles (2024-2025) about video game launches that were extremely buggy, crashed frequently, or were widely criticized for poor quality at launch.",
  "Find recent news articles (2024-2025) about enterprise software bugs — Salesforce, SAP, Oracle, Zoom, Slack, or Teams updates that shipped with significant issues.",
  "Find recent news articles (2024-2025) about AI product failures, bugs, or quality issues — ChatGPT, Gemini, Copilot, or other AI tools shipping incorrect, hallucinated, or broken features.",
  "Find recent news articles (2024-2025) about cybersecurity vulnerabilities that were introduced by buggy software updates — zero-days, patch-related regressions, or security bugs in shipped software.",
];

const OUTPUT_SCHEMA = {
  type: "json" as const,
  json_schema: {
    type: "object",
    properties: {
      incidents: {
        type: "array",
        description:
          "List of distinct bug incidents found. Each should be a separate, specific incident.",
        items: BUG_INCIDENT_JSON_SCHEMA,
      },
    },
    required: ["incidents"],
    additionalProperties: false,
  },
};

async function runBackfill() {
  console.log("Starting backfill with Parallel Task Group API...");
  console.log(`Launching ${SEARCH_QUERIES.length} parallel research tasks.\n`);

  // Step 1: Create a task group
  const group = await client.beta.taskGroup.create({});
  const groupId = group.taskgroup_id;
  console.log(`Task Group created: ${groupId}`);

  // Step 2: Add all research tasks
  const inputs = SEARCH_QUERIES.map((query) => ({
    input: query,
    processor: "base",
    task_spec: { output_schema: OUTPUT_SCHEMA },
  }));

  const addResult = await client.beta.taskGroup.addRuns(groupId, { inputs });
  console.log(
    `Added ${addResult.run_ids.length} tasks. Run IDs: ${addResult.run_ids.slice(0, 3).join(", ")}...`
  );

  // Step 3: Stream events until all tasks complete
  console.log("\nWaiting for tasks to complete...\n");

  const allIncidents: BugIncident[] = [];
  let completedCount = 0;

  const stream = await client.beta.taskGroup.events(groupId);
  for await (const event of stream) {
    if (event.type === "task_group_status") {
      const s = event.status;
      const counts = s.task_run_status_counts;
      console.log(
        `  Group: ${s.status_message ?? "active"} | Completed: ${counts["completed"] ?? 0} | Running: ${counts["running"] ?? 0} | Queued: ${counts["queued"] ?? 0} | Failed: ${counts["failed"] ?? 0}`
      );

      if (!s.is_active) {
        console.log("\nAll tasks finished.");
        break;
      }
    } else if (event.type === "task_run.state") {
      const run = event.run;
      if (run.status === "completed" && event.output) {
        completedCount++;
        if (event.output.type === "json") {
          const content = event.output.content as { incidents?: BugIncident[] };
          const incidents = content.incidents ?? [];
          console.log(
            `  Task ${completedCount} completed: found ${incidents.length} incidents`
          );
          allIncidents.push(...incidents);
        } else {
          console.log(
            `  Task ${completedCount} completed (text output, skipping)`
          );
        }
      } else if (run.status === "failed") {
        console.log(`  Task failed: ${run.error?.message ?? "unknown error"}`);
      }
    } else if (event.type === "error") {
      console.error(`  Stream error: ${event.error.message}`);
    }
  }

  // If streaming didn't include outputs, fetch them individually
  if (allIncidents.length === 0 && completedCount === 0) {
    console.log("Fetching results from completed runs...");
    const runs = await client.beta.taskGroup.getRuns(groupId, {
      include_output: true,
      status: "completed",
    });
    for await (const runEvent of runs) {
      if (runEvent.type === "task_run.state" && runEvent.output?.type === "json") {
        const content = runEvent.output.content as { incidents?: BugIncident[] };
        allIncidents.push(...(content.incidents ?? []));
      }
    }
  }

  console.log(`\nTotal incidents collected: ${allIncidents.length}`);

  // Step 4: Save results
  appendToDataFile(allIncidents);
  console.log(`Data saved to ${DATA_FILE}`);

  // Show sample
  console.log("\nSample entries:");
  allIncidents.slice(0, 8).forEach((inc, i) => {
    console.log(`  ${i + 1}. [${inc.severity}] ${inc.title}`);
    console.log(`     ${inc.vendor} - ${inc.software}`);
    console.log(`     ${inc.source_url}\n`);
  });
}

runBackfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
