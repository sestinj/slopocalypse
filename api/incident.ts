import { readIncidents, type BugIncident } from "./_store.js";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function renderPage(incident: BugIncident, slug: string): string {
  const sevColor =
    incident.severity === "critical"
      ? "#ef4444"
      : incident.severity === "major"
        ? "#e8a308"
        : "#a09888";
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(incident.title)} — Slopocalypse</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚠️</text></svg>">
<meta property="og:title" content="${esc(incident.title)}">
<meta property="og:description" content="${esc(incident.description)}">
<meta property="og:image" content="https://www.slopocalypse.sh/card.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:type" content="article">
<meta property="og:url" content="https://www.slopocalypse.sh/${esc(slug)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(incident.title)}">
<meta name="twitter:description" content="${esc(incident.description)}">
<meta name="twitter:image" content="https://www.slopocalypse.sh/card.png">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  min-height: 100vh; line-height: 1.6;
  font-family: "SF Mono", "Fira Code", "Cascadia Code", "Courier New", monospace;
  background: #0b0b0d; color: #e0d9cc;
}
.container { max-width: 700px; margin: 0 auto; padding: 2rem 1.5rem; }
a { color: #e8a308; }
.back { font-size: 0.7rem; display: inline-block; margin-bottom: 2rem; color: #7a7468; text-decoration: none; }
.back:hover { color: #e8a308; }
.badge {
  display: inline-block; font-size: 0.6rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; padding: 0.25rem 0.6rem; border-radius: 2px; margin-bottom: 1rem;
  background: ${sevColor}22; color: ${sevColor};
}
h1 { font-size: clamp(1.1rem, 4vw, 1.6rem); color: #e8a308; font-weight: 800; line-height: 1.3; margin-bottom: 1rem; }
.meta { font-size: 0.7rem; color: #5a554c; margin-bottom: 1.5rem; display: flex; flex-wrap: wrap; gap: 0.3rem; }
.meta span:not(:last-child)::after { content: "\\00b7"; margin: 0 0.4rem; color: #3a3836; }
.desc {
  font-size: 0.85rem; line-height: 1.8; color: #a09888; margin-bottom: 2rem;
  padding: 1.25rem; background: #111113; border: 1px solid #252528; border-radius: 2px;
}
.source-link {
  display: inline-block; padding: 0.5rem 1rem; font-size: 0.7rem; font-weight: 600;
  font-family: inherit; text-decoration: none; border-radius: 2px;
  background: rgba(232,163,8,0.1); border: 1px solid #e8a308; color: #e8a308;
}
.source-link:hover { background: rgba(232,163,8,0.2); }
footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid #1a1a1e; font-size: 0.65rem; color: #3a3836; }
</style>
</head>
<body>
<div class="container">
  <a href="/" class="back">&larr; Back to all incidents</a>
  <span class="badge">${esc(incident.severity)}</span>
  <h1>${esc(incident.title)}</h1>
  <div class="meta">
    <span>${esc(incident.vendor)}</span>
    <span>${esc(incident.software)}</span>
    <span>${esc(incident.date_reported)}</span>
    <span>${esc(incident.source_name)}</span>
  </div>
  <div class="desc">${esc(incident.description)}</div>
  ${incident.source_url ? `<a href="${esc(incident.source_url)}" target="_blank" rel="noopener" class="source-link">Read original source &rarr;</a>` : ""}
  <footer>
    <a href="/">Slopocalypse</a> — Tracking buggy software and outages caused by AI.
  </footer>
</div>
</body>
</html>`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? "";

  if (!slug) {
    return new Response("Not found", { status: 404 });
  }

  const incidents = await readIncidents();
  const incident = incidents.find((i) => slugify(i.title) === slug);

  if (!incident) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(renderPage(incident, slug), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
