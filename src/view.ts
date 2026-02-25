/**
 * View collected incidents from the data file.
 *
 * Usage:
 *   npx tsx src/view.ts          # summary
 *   npx tsx src/view.ts --json   # raw JSON
 */

import { readDataFile } from "./store.js";

const incidents = readDataFile();

if (incidents.length === 0) {
  console.log("No incidents collected yet. Run `npm run backfill` first.");
  process.exit(0);
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(incidents, null, 2));
  process.exit(0);
}

// Summary view
console.log(`\n=== SLOPOCALYPSE TRACKER ===`);
console.log(`Total incidents: ${incidents.length}\n`);

// Group by vendor
const byVendor = new Map<string, number>();
for (const inc of incidents) {
  byVendor.set(inc.vendor, (byVendor.get(inc.vendor) ?? 0) + 1);
}
console.log("By vendor:");
[...byVendor.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([vendor, count]) => console.log(`  ${vendor}: ${count}`));

// Group by severity
const bySeverity = new Map<string, number>();
for (const inc of incidents) {
  bySeverity.set(inc.severity, (bySeverity.get(inc.severity) ?? 0) + 1);
}
console.log("\nBy severity:");
for (const sev of ["critical", "major", "minor"]) {
  console.log(`  ${sev}: ${bySeverity.get(sev) ?? 0}`);
}

// Recent entries
console.log("\nMost recent incidents:");
incidents
  .sort((a, b) => b.date_reported.localeCompare(a.date_reported))
  .slice(0, 10)
  .forEach((inc, i) => {
    console.log(
      `  ${i + 1}. [${inc.severity}] ${inc.title} (${inc.vendor} - ${inc.software})`
    );
    console.log(`     ${inc.date_reported} | ${inc.source_name}`);
    console.log(`     ${inc.source_url}\n`);
  });
