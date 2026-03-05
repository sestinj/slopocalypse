<p align="center">
  <a href="https://continue.dev">
    <img src=".github/assets/continue-banner.png" width="800" alt="Continue" />
  </a>
</p>

<h1 align="center">Slopocalypse</h1>

<p align="center">Track buggy software releases as evidence of AI-accelerated quality decline</p>

<p align="center"><em>An autonomous codebase built by the <a href="https://continue.dev/blueprint">Continue Software Factory</a></em></p>

---

## Why?

As AI-assisted coding tools become ubiquitous, there is growing concern that software quality may be declining — more bugs shipped, more incidents, more "slop." Slopocalypse tracks and visualizes real-world buggy software releases to provide data-driven evidence of this trend.

## How It Works

Slopocalypse monitors software releases and incidents using [Parallel Web](https://www.npmjs.com/package/parallel-web) monitors. When a buggy release is detected, it is recorded and displayed on the site.

### Architecture

- **Server** (`src/server.ts`) — HTTP server serving the site, API, and webhook endpoint
- **Monitor** (`src/monitor.ts`) — Creates and manages Parallel Web monitors to track incidents
- **Webhook** (`src/webhook-server.ts`) — Receives webhook events from monitors
- **Store** (`src/store.ts`) — Persists incident data to Vercel Blob storage
- **Public** (`public/`) — Static HTML/CSS for the site

### API Routes

| Method | Path              | Description                          |
| ------ | ----------------- | ------------------------------------ |
| GET    | `/`               | The site (HTML)                      |
| GET    | `/api/incidents`  | JSON incident data                   |
| POST   | `/api/webhook`    | Parallel Monitor webhook receiver    |
| GET    | `/health`         | Health check                         |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Parallel Web](https://www.npmjs.com/package/parallel-web) API key (set as `PARALLEL_API_KEY`)

### Installation

```bash
npm install
```

### Development

```bash
# Start the dev server
npm run dev

# Backfill historical data
npm run backfill

# Create monitors
npm run monitor:create

# Poll monitors
npm run monitor:poll
```

### Environment Variables

Copy `.env` and configure:

- `PARALLEL_API_KEY` — API key for Parallel Web monitors
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob storage token
- `PORT` — Server port (default: 3456)

## Deployment

The project is configured for deployment on [Vercel](https://vercel.com). See `vercel.json` for configuration.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute.

## License

Apache-2.0 — see [LICENSE](LICENSE) for details.

Copyright (c) 2025 Continue Dev, Inc.
