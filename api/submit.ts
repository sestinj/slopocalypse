const GITHUB_REPO = "sestinj/slopocalypse";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = (body.title ?? "").trim();
    if (!title) {
      return Response.json({ error: "Title is required" }, { status: 400 });
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
      return Response.json({ ok: true, note: "No GITHUB_TOKEN configured" });
    }

    const ghRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ghToken}`,
          "Content-Type": "application/json",
          "User-Agent": "slopocalypse-server",
        },
        body: JSON.stringify({
          title: issueTitle,
          body: issueBody,
          labels: ["submission"],
        }),
      }
    );

    if (!ghRes.ok) {
      return Response.json(
        { error: "Failed to create issue" },
        { status: 502 }
      );
    }

    const issue = (await ghRes.json()) as { html_url: string };
    return Response.json({ ok: true, issue_url: issue.html_url });
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
}
