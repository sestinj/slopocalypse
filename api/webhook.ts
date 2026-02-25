import { appendIncidents, type BugIncident } from "./_store.js";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.type === "monitor.event.detected") {
      const event = body.data?.event ?? {};
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

      const result = await appendIncidents([incident]);
      return Response.json({
        received: true,
        added: result.added,
        total: result.total,
      });
    }

    return Response.json({ received: true, type: body.type });
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
}

export function GET() {
  return Response.json({ status: "ok", endpoint: "webhook" });
}
