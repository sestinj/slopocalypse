/**
 * Push local incidents.json to the deployed Vercel site's blob storage.
 *
 * Usage:
 *   DEPLOY_URL=https://slopocalypse.vercel.app npx tsx src/seed-vercel.ts
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataFile = join(__dirname, "..", "data", "incidents.json");

const deployUrl = process.env.DEPLOY_URL;
if (!deployUrl) {
  console.error("Set DEPLOY_URL to your Vercel deployment URL.");
  process.exit(1);
}

const incidents = JSON.parse(readFileSync(dataFile, "utf-8"));
console.log(`Seeding ${incidents.length} incidents to ${deployUrl}/api/seed ...`);

const res = await fetch(`${deployUrl}/api/seed`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(incidents),
});

const result = await res.json();
console.log("Result:", result);
