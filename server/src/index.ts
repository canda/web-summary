import http from "node:http";

const PORT = Number.parseInt(process.env.PORT ?? "3001", 10);
const AI_MODEL_URL = process.env.AI_MODEL_URL;
const AI_MODEL_NAME = process.env.AI_MODEL_NAME;
const MAX_BODY_SIZE = 1024 * 1024;
const MAX_CONTENT_CHARS = 18000;

type JsonRecord = Record<string, unknown>;

type WebsiteContent = {
  url: string;
  title: string;
  description: string;
  text: string;
};

type OpenAIStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
};

function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res: http.ServerResponse, statusCode: number, payload: JsonRecord): void {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeUrl(input: unknown): string {
  const raw = String(input ?? "").trim();
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(raw) ? raw : `https://${raw}`;
  const parsed = new URL(withProtocol);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http and https URLs are supported.");
  }

  return parsed.toString();
}

async function readJsonBody(req: http.IncomingMessage): Promise<JsonRecord> {
  let body = "";

  for await (const chunk of req) {
    body += chunk.toString();

    if (Buffer.byteLength(body, "utf8") > MAX_BODY_SIZE) {
      throw new Error("Request body is too large.");
    }
  }

  if (!body) {
    return {};
  }

  return JSON.parse(body) as JsonRecord;
}

function decodeHtmlEntities(text: string): string {
  const entityMap: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\""
  };

  return text.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (_, entity: string) => {
    if (entity.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }

    if (entity.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }

    return entityMap[entity] ?? " ";
  });
}

function matchFirst(pattern: RegExp, text: string): string {
  const match = text.match(pattern);
  return match?.[1] ? decodeHtmlEntities(match[1].replace(/\s+/g, " ").trim()) : "";
}

function extractWebsiteContent(html: string, requestedUrl: string): WebsiteContent {
  const withoutNoise = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
    .replace(/<template\b[^<]*(?:(?!<\/template>)<[^<]*)*<\/template>/gi, " ");

  const title =
    matchFirst(/<title[^>]*>([\s\S]*?)<\/title>/i, withoutNoise) ||
    matchFirst(/<meta[^>]+property=["']og:title["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i, withoutNoise);

  const description =
    matchFirst(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i, withoutNoise) ||
    matchFirst(/<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i, withoutNoise);

  const bodyMatch = withoutNoise.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = bodyMatch?.[1] ?? withoutNoise;
  const collapsed = decodeHtmlEntities(
    bodyHtml
      .replace(/<(br|hr)\s*\/?>/gi, "\n")
      .replace(/<\/(address|article|aside|blockquote|div|figcaption|figure|footer|form|h[1-6]|header|li|main|nav|ol|p|pre|section|table|tr|ul)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  return {
    url: requestedUrl,
    title,
    description,
    text: collapsed.slice(0, MAX_CONTENT_CHARS)
  };
}

async function fetchWebsite(url: string): Promise<{ finalUrl: string; html: string }> {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "web-summary/1.0 (+local)"
    }
  });

  if (!response.ok) {
    throw new Error(`Website request failed with ${response.status} ${response.statusText}.`);
  }

  return {
    finalUrl: response.url || url,
    html: await response.text()
  };
}

function buildMessages(content: WebsiteContent): Array<{ role: "system" | "user"; content: string }> {
  return [
    {
      role: "system",
      content:
        "You summarize webpages for busy readers. Return plain text only. Start with a short headline on its own line. Then provide 3 to 6 concise bullet points. End with a brief paragraph titled Why it matters. If the page looks incomplete or heavily script-rendered, say so briefly and still summarize whatever is available."
    },
    {
      role: "user",
      content: [
        `URL: ${content.url}`,
        `Title: ${content.title || "Unknown"}`,
        `Description: ${content.description || "Unknown"}`,
        "",
        "Extracted page text:",
        content.text || "No readable text was extracted from the page."
      ].join("\n")
    }
  ];
}

async function pipeModelStream(modelResponse: Response, res: http.ServerResponse): Promise<void> {
  const reader = modelResponse.body?.getReader();

  if (!reader) {
    throw new Error("The model response did not include a readable stream.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  const handleEvent = (eventText: string): boolean => {
    for (const rawLine of eventText.split(/\r?\n/)) {
      const line = rawLine.trim();

      if (!line.startsWith("data:")) {
        continue;
      }

      const payload = line.slice(5).trim();

      if (!payload) {
        continue;
      }

      if (payload === "[DONE]") {
        return true;
      }

      const parsed = JSON.parse(payload) as OpenAIStreamChunk;
      const token = parsed.choices?.[0]?.delta?.content;

      if (typeof token === "string" && token.length > 0) {
        res.write(token);
      }
    }

    return false;
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    buffer = buffer.replace(/\r\n/g, "\n");

    let separatorIndex = buffer.indexOf("\n\n");

    while (separatorIndex !== -1) {
      const eventText = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);

      if (handleEvent(eventText)) {
        return;
      }

      separatorIndex = buffer.indexOf("\n\n");
    }

    if (done) {
      break;
    }
  }

  if (buffer.trim()) {
    handleEvent(buffer);
  }
}

async function handleSummarize(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!AI_MODEL_URL || !AI_MODEL_NAME) {
    sendJson(res, 500, { error: "The model endpoint is not configured." });
    return;
  }

  let requestUrl = "";

  try {
    const body = await readJsonBody(req);
    requestUrl = normalizeUrl(body.url);

    if (!isHttpUrl(requestUrl)) {
      sendJson(res, 400, { error: "Please provide a valid URL." });
      return;
    }
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : "Invalid request body." });
    return;
  }

  try {
    const website = await fetchWebsite(requestUrl);
    const extracted = extractWebsiteContent(website.html, website.finalUrl);
    const upstream = await fetch(`${AI_MODEL_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: AI_MODEL_NAME,
        stream: true,
        messages: buildMessages(extracted)
      })
    });

    if (!upstream.ok) {
      throw new Error(`Model request failed with ${upstream.status}: ${await upstream.text()}`);
    }

    res.writeHead(200, {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Source-Url": extracted.url
    });

    await pipeModelStream(upstream, res);
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to summarize the website.";

    if (res.headersSent) {
      res.write(`\n\n[Stream interrupted: ${message}]`);
      res.end();
      return;
    }

    sendJson(res, 502, { error: message });
  }
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, {
      ok: true,
      model: AI_MODEL_NAME ?? null
    });
    return;
  }

  if (req.method === "POST" && req.url === "/api/summarize") {
    await handleSummarize(req, res);
    return;
  }

  sendJson(res, 404, { error: "Not found." });
});

server.listen(PORT, () => {
  console.log(`Streaming summary API listening on http://localhost:${PORT}`);
});
