# Parallax Desktop

This is the front-end for the Parallax AI agent. It hooks into the local `parallax-cli` daemon to show you exactly what your agent is thinking and doing in real time.

We built this because terminal output gets messy when agents start executing huge file diffs and deep reasoning chains. The web UI gives you collapsible reasoning blocks, side-by-side file patching, and session management, all wrapped in a brutalist, data-first aesthetic.

## Getting Started

You need the `parallax-cli` backend running first. If you don't have that up, the UI won't have anything to connect to.

Once your daemon is running, start the Electron app:

```bash
pnpm dev
```

We're working on a packaged executable.

Open `http://localhost:3000`. It will automatically connect to the backend's Server-Sent Events (SSE) stream.

## What's actually in here

- **Live Reasoning:** The agent's thought process streams in real-time, tucked into collapsible blocks so it doesn't blow up your chat history.
- **Diff Viewer:** If the agent rewrites a file, you get an inline patch viewer. You can see exact line additions and deletions before approving the tool call.
- **YOLO Mode:** A toggle for when you trust the agent enough to let it run file operations completely headless.
- **Icon Routing:** Every tool call gets its own specific Phosphor icon, so a web search looks visually distinct from a system command or a file edit.

## Architecture

It's a Next.js 16 app. We use React 19, Tailwind CSS, and a custom SSE parser to handle the raw stream from the CLI. You don't need to configure a database—the UI pulls session history straight from your local Parallax workspace files.
