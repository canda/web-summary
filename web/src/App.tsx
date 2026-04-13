import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type FormEvent
} from "react";
import * as S from "./App.styled";
import {
  CopyIcon,
  DownloadIcon,
  LinkIcon,
  PlusIcon,
  ProfoundLogo
} from "./icons";

type SummaryItem = {
  id: string;
  url: string;
  summary: string;
  createdAt: string;
};

function normalizeUrl(input: string): string {
  const raw = input.trim();
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(raw)
    ? raw
    : `https://${raw}`;
  return new URL(withProtocol).toString();
}

function splitSummary(summary: string): string[] {
  return summary
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

async function getErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? "The request failed.";
  }

  return (await response.text()) || "The request failed.";
}

function SummaryBody({ text }: { text: string }) {
  const blocks = splitSummary(text);

  return (
    <S.SummaryBodyWrap>
      {blocks.map((block, index) => {
        const lines = block
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        const isBulletBlock =
          lines.length > 1 && lines.every((line) => /^[-*•]/.test(line));

        if (index === 0 && lines.length === 1 && lines[0].length <= 90) {
          return (
            <S.SummaryTitle key={`${block}-${index}`}>
              {lines[0]}
            </S.SummaryTitle>
          );
        }

        if (isBulletBlock) {
          return (
            <S.SummaryList key={`${block}-${index}`}>
              {lines.map((line) => (
                <li key={line}>{line.replace(/^[-*•]\s*/, "")}</li>
              ))}
            </S.SummaryList>
          );
        }

        return (
          <S.SummaryParagraph key={`${block}-${index}`}>
            {block}
          </S.SummaryParagraph>
        );
      })}
    </S.SummaryBodyWrap>
  );
}

function App() {
  const [history, setHistory] = useState<SummaryItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const [error, setError] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        await refreshHistory();
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load saved summaries."
        );
        setIsLoadingHistory(false);
      }
    })();
  }, []);

  const activeItem = history.find((item) => item.id === activeId) ?? null;
  const showingDraft = isStreaming || (!activeItem && draftSummary.length > 0);
  const contentUrl = showingDraft ? draftUrl : (activeItem?.url ?? "");
  const contentText = showingDraft ? draftSummary : (activeItem?.summary ?? "");

  async function refreshHistory(
    preferredId?: string | null
  ): Promise<SummaryItem[]> {
    const response = await fetch("/api/summaries");

    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }

    const items = (await response.json()) as SummaryItem[];
    setHistory(items);
    setActiveId((current) => {
      const nextChoice = preferredId ?? current;

      if (nextChoice && items.some((item) => item.id === nextChoice)) {
        return nextChoice;
      }

      return items[0]?.id ?? null;
    });
    setIsLoadingHistory(false);

    return items;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    let normalizedUrl = "";

    try {
      normalizedUrl = normalizeUrl(urlInput);
    } catch {
      setError("Please enter a valid URL.");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setIsStreaming(true);
    setDraftUrl(normalizedUrl);
    setDraftSummary("");
    setActiveId(null);

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: normalizedUrl }),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        throw new Error(await getErrorMessage(response));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        startTransition(() => {
          setDraftSummary((current) => current + chunk);
        });
      }

      if (!fullText.trim()) {
        throw new Error("The model returned an empty summary.");
      }

      await refreshHistory();
      setUrlInput("");
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") {
        setError("Streaming stopped.");
      } else {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Something went wrong."
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  function handleNewSummary(): void {
    abortRef.current?.abort();
    setActiveId(null);
    setDraftUrl("");
    setDraftSummary("");
    setError("");
  }

  async function handleCopy(): Promise<void> {
    if (!contentText) {
      return;
    }

    await navigator.clipboard.writeText(contentText);
  }

  function handleDownload(): void {
    if (!contentText) {
      return;
    }

    const blob = new Blob([contentText], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "summary.txt";
    anchor.click();
    URL.revokeObjectURL(href);
  }

  function handleStop(): void {
    abortRef.current?.abort();
  }

  return (
    <>
      <S.GlobalStyle />
      <S.AppShell>
        <S.Sidebar>
          <S.BrandRow>
            <S.BrandMark aria-hidden="true">
              <ProfoundLogo />
            </S.BrandMark>
            <S.GhostIcon
              type="button"
              onClick={handleNewSummary}
              aria-label="Start a new summary"
            >
              <PlusIcon />
            </S.GhostIcon>
          </S.BrandRow>

          <S.HistoryList>
            {isLoadingHistory ? (
              <S.EmptyState>Loading saved summaries...</S.EmptyState>
            ) : history.length === 0 ? (
              <S.EmptyState>No summaries yet</S.EmptyState>
            ) : (
              history.map((item) => (
                <S.HistoryItem
                  key={item.id}
                  type="button"
                  $active={item.id === activeId}
                  onClick={() => {
                    setActiveId(item.id);
                    setDraftSummary("");
                    setDraftUrl("");
                  }}
                >
                  <span>{item.url}</span>
                </S.HistoryItem>
              ))
            )}
          </S.HistoryList>

          <S.PrimaryPill type="button" onClick={handleNewSummary}>
            New summary
          </S.PrimaryPill>
        </S.Sidebar>

        <S.ContentPanel>
          <S.AmbientTop />
          <S.AmbientBottom />

          {!contentText && !isStreaming ? (
            <S.Hero>
              <S.HeroCopy>
                <h1>Let&apos;s get to it</h1>
                <p>
                  Paste a URL to summarize and understand any content instantly.
                </p>
              </S.HeroCopy>

              <S.HeroForm onSubmit={handleSubmit}>
                <S.UrlField>
                  <LinkIcon />
                  <input
                    type="text"
                    inputMode="url"
                    placeholder="https://example.com"
                    value={urlInput}
                    onChange={(event) => setUrlInput(event.target.value)}
                  />
                </S.UrlField>

                <S.HeroSubmitButton type="submit">Summarize</S.HeroSubmitButton>
              </S.HeroForm>

              {error ? <S.ErrorMessage>{error}</S.ErrorMessage> : null}
            </S.Hero>
          ) : (
            <S.SummaryPanel>
              <S.SummaryScroll>
                <S.SummaryHeader>
                  <S.Eyebrow>
                    {isStreaming ? "Streaming summary" : "Saved summary"}
                  </S.Eyebrow>
                  <h2>{contentUrl}</h2>
                </S.SummaryHeader>

                <SummaryBody text={contentText || "Preparing summary..."} />
              </S.SummaryScroll>

              <S.SummaryToolbar>
                <S.ToolbarUrl>{contentUrl}</S.ToolbarUrl>
                {isStreaming ? (
                  <S.StopButton type="button" onClick={handleStop}>
                    Stop
                  </S.StopButton>
                ) : (
                  <>
                    <S.IconButton
                      type="button"
                      onClick={handleCopy}
                      aria-label="Copy summary"
                    >
                      <CopyIcon />
                    </S.IconButton>
                    <S.IconButton
                      type="button"
                      onClick={handleDownload}
                      aria-label="Download summary"
                    >
                      <DownloadIcon />
                    </S.IconButton>
                  </>
                )}
              </S.SummaryToolbar>

              {error ? (
                <S.InlineErrorMessage>{error}</S.InlineErrorMessage>
              ) : null}
            </S.SummaryPanel>
          )}
        </S.ContentPanel>
      </S.AppShell>
    </>
  );
}
export default App;
