/**
 * One-time endpoint to seed blob storage from local data.
 * POST /api/seed with JSON body of incidents array.
 */

import { writeIncidents, readIncidents, type BugIncident } from "./_store.js";

export async function POST(request: Request) {
  try {
    const body: BugIncident[] = await request.json();

    if (!Array.isArray(body)) {
      return Response.json({ error: "Expected an array" }, { status: 400 });
    }

    await writeIncidents(body);
    const stored = await readIncidents();
    return Response.json({ received: body.length, stored: stored.length });
  } catch (err: any) {
    return Response.json(
      { error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const incidents = await readIncidents();
    return Response.json({ count: incidents.length });
  } catch (err: any) {
    return Response.json(
      { error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}
