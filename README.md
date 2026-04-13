# Web Summary

A three-part local project for summarizing any webpage:

- the Docker model configured through Compose
- a Node streaming API that fetches website HTML and relays the model stream
- a React frontend for entering URLs and reading saved summaries

## Stack

- Node.js `v24.14.1` LTS
- React + Vite + TypeScript
- TypeScript Node HTTP server with streaming `fetch`
- `styled-components`
- OpenAI-compatible chat completions API

## Run it

```bash
docker compose up
```

Then open `http://localhost:5173`.

The frontend sends `POST /api/summarize` requests to the Node service, which:

1. fetches the target website HTML
2. extracts readable text from the page
3. calls the configured model with `stream: true`
4. streams the plain-text summary back to the browser

Saved summaries are persisted in `server/data/summaries.json`, and the frontend history list is loaded from that server-side file.

## Services

- `web`: Vite React app on port `5173`
- `api`: Node streaming API on port `3001`
- `llm`: configured through the Compose `models` section and injected into `api` as `AI_MODEL_URL` and `AI_MODEL_NAME`

## Local Node

Use the pinned version from [.nvmrc](/Users/javiercandalaft/projects/canda/web-summary/.nvmrc).
