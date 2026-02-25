import { readIncidents } from "./_store.js";

export async function GET() {
  const incidents = await readIncidents();
  return Response.json(incidents, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
