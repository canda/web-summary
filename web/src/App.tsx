import { startTransition, useEffect, useRef, useState, type FormEvent } from "react";
import styled, { createGlobalStyle, keyframes } from "styled-components";

const STORAGE_KEY = "web-summary-history";

type SummaryItem = {
  id: string;
  url: string;
  summary: string;
  createdAt: string;
};

function loadHistory(): SummaryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as SummaryItem[]) : [];
  } catch {
    return [];
  }
}

function normalizeUrl(input: string): string {
  const raw = input.trim();
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(raw) ? raw : `https://${raw}`;
  return new URL(withProtocol).toString();
}

function createId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
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
    return payload.error ?? "The summary request failed.";
  }

  return (await response.text()) || "The summary request failed.";
}

function SummaryBody({ text }: { text: string }) {
  const blocks = splitSummary(text);

  return (
    <SummaryBodyWrap>
      {blocks.map((block, index) => {
        const lines = block
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        const isBulletBlock = lines.length > 1 && lines.every((line) => /^[-*•]/.test(line));

        if (index === 0 && lines.length === 1 && lines[0].length <= 90) {
          return <SummaryTitle key={`${block}-${index}`}>{lines[0]}</SummaryTitle>;
        }

        if (isBulletBlock) {
          return (
            <SummaryList key={`${block}-${index}`}>
              {lines.map((line) => (
                <li key={line}>{line.replace(/^[-*•]\s*/, "")}</li>
              ))}
            </SummaryList>
          );
        }

        return <SummaryParagraph key={`${block}-${index}`}>{block}</SummaryParagraph>;
      })}
    </SummaryBodyWrap>
  );
}

function App() {
  const initialHistoryRef = useRef<SummaryItem[]>(loadHistory());
  const [history, setHistory] = useState<SummaryItem[]>(initialHistoryRef.current);
  const [activeId, setActiveId] = useState<string | null>(initialHistoryRef.current[0]?.id ?? null);
  const [urlInput, setUrlInput] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const [error, setError] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const activeItem = history.find((item) => item.id === activeId) ?? null;
  const showingDraft = isStreaming || (!activeItem && draftSummary.length > 0);
  const contentUrl = showingDraft ? draftUrl : activeItem?.url ?? "";
  const contentText = showingDraft ? draftSummary : activeItem?.summary ?? "";

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

      const nextItem: SummaryItem = {
        id: createId(),
        url: normalizedUrl,
        summary: fullText.trim(),
        createdAt: new Date().toISOString()
      };

      setHistory((current) => [nextItem, ...current]);
      setActiveId(nextItem.id);
      setUrlInput("");
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") {
        setError("Streaming stopped.");
      } else {
        setError(requestError instanceof Error ? requestError.message : "Something went wrong.");
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

  function handleDelete(): void {
    if (!activeItem) {
      return;
    }

    setHistory((current) => {
      const remaining = current.filter((item) => item.id !== activeItem.id);
      setActiveId(remaining[0]?.id ?? null);
      return remaining;
    });
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
      <GlobalStyle />
      <AppShell>
        <Sidebar>
          <BrandRow>
            <BrandMark aria-hidden="true">
              <SparkIcon />
            </BrandMark>
            <GhostIcon type="button" onClick={handleNewSummary} aria-label="Start a new summary">
              <PlusIcon />
            </GhostIcon>
          </BrandRow>

          <HistoryList>
            {history.length === 0 ? (
              <EmptyState>No summaries yet</EmptyState>
            ) : (
              history.map((item) => (
                <HistoryItem
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
                </HistoryItem>
              ))
            )}
          </HistoryList>

          <PrimaryPill type="button" onClick={handleNewSummary}>
            New summary
          </PrimaryPill>
        </Sidebar>

        <ContentPanel>
          <AmbientTop />
          <AmbientBottom />

          {!contentText && !isStreaming ? (
            <Hero>
              <HeroCopy>
                <Eyebrow>Website intelligence</Eyebrow>
                <h1>Let&apos;s get to it</h1>
                <p>Paste a URL to summarize and understand any page instantly.</p>
              </HeroCopy>

              <HeroForm onSubmit={handleSubmit}>
                <UrlField>
                  <LinkIcon />
                  <input
                    type="text"
                    inputMode="url"
                    placeholder="https://example.com"
                    value={urlInput}
                    onChange={(event) => setUrlInput(event.target.value)}
                  />
                </UrlField>

                <PrimaryPill type="submit">Summarize</PrimaryPill>
              </HeroForm>

              {error ? <ErrorMessage>{error}</ErrorMessage> : null}
            </Hero>
          ) : (
            <SummaryPanel>
              <SummaryScroll>
                <SummaryHeader>
                  <Eyebrow>{isStreaming ? "Streaming summary" : "Saved summary"}</Eyebrow>
                  <h2>{contentUrl}</h2>
                </SummaryHeader>

                <SummaryBody text={contentText || "Preparing summary..."} />
              </SummaryScroll>

              <SummaryToolbar>
                <ToolbarUrl>{contentUrl}</ToolbarUrl>
                {isStreaming ? (
                  <StopButton type="button" onClick={handleStop}>
                    Stop
                  </StopButton>
                ) : (
                  <>
                    <IconButton type="button" onClick={handleCopy} aria-label="Copy summary">
                      <CopyIcon />
                    </IconButton>
                    <IconButton type="button" onClick={handleDownload} aria-label="Download summary">
                      <DownloadIcon />
                    </IconButton>
                    <DeleteButton type="button" onClick={handleDelete} aria-label="Delete summary">
                      <TrashIcon />
                    </DeleteButton>
                  </>
                )}
              </SummaryToolbar>

              {error ? <InlineErrorMessage>{error}</InlineErrorMessage> : null}
            </SummaryPanel>
          )}
        </ContentPanel>
      </AppShell>
    </>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5 4.5 6.8v10.4l7.5 4.3 7.5-4.3V6.8Z" fill="currentColor" opacity="0.2" />
      <path d="m12 4.6 5.6 3.2v7.4L12 18.4l-5.6-3.2V7.8Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="m9.5 13.5 2-5 1.2 3 2.8.2-4.5 2.8Z" fill="currentColor" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10.7 13.3a3.4 3.4 0 0 0 4.8 0l2.6-2.6a3.4 3.4 0 0 0-4.8-4.8L12 7.1m0 9.8-1.3 1.2a3.4 3.4 0 1 1-4.8-4.8l2.6-2.6a3.4 3.4 0 0 1 4.8 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="9" width="10" height="10" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15 9V7a2 2 0 0 0-2-2H7A2 2 0 0 0 5 7v6a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 18.5h14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 7.5h15M9.5 11.2v5.4m5-5.4v5.4M8 7.5l.8-2h6.4l.8 2m-9 0 1 10.2a2 2 0 0 0 2 1.8h4.9a2 2 0 0 0 2-1.8l1-10.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5.5v13M5.5 12h13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

const float = keyframes`
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }

  50% {
    transform: translate3d(0, -12px, 0);
  }
`;

const rise = keyframes`
  from {
    opacity: 0;
    transform: translate3d(0, 16px, 0);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
`;

const GlobalStyle = createGlobalStyle`
  @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap");

  :root {
    color-scheme: dark;
    font-family: "Space Grotesk", "Avenir Next", "Segoe UI", sans-serif;
    background:
      radial-gradient(circle at 60% 50%, rgba(151, 77, 255, 0.2), transparent 28%),
      radial-gradient(circle at 25% 100%, rgba(137, 77, 255, 0.18), transparent 34%),
      linear-gradient(180deg, #050507 0%, #09070f 45%, #120a1f 100%);
    color: rgba(247, 240, 255, 0.94);
  }

  * {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    min-height: 100%;
    margin: 0;
  }

  body {
    min-height: 100vh;
    background: #050507;
  }

  button,
  input {
    font: inherit;
  }

  button {
    border: 0;
    cursor: pointer;
  }
`;

const AppShell = styled.div`
  min-height: 100vh;
  display: grid;
  grid-template-columns: 320px 1fr;
  background:
    radial-gradient(circle at 60% 50%, rgba(173, 94, 255, 0.22), transparent 23%),
    radial-gradient(circle at 18% 100%, rgba(159, 85, 255, 0.16), transparent 28%),
    linear-gradient(180deg, rgba(5, 5, 7, 0.98), rgba(10, 7, 16, 0.98));

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

const Sidebar = styled.aside`
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 24px 24px 28px;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(180deg, rgba(4, 4, 6, 0.96), rgba(8, 6, 13, 0.92)),
    radial-gradient(circle at 50% 100%, rgba(165, 93, 255, 0.14), transparent 38%);
  backdrop-filter: blur(18px);

  @media (max-width: 960px) {
    min-height: 230px;
    border-right: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
`;

const BrandRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
`;

const CircleButton = styled.button`
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.86);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: transform 180ms ease, background 180ms ease, border-color 180ms ease;

  &:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.18);
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

const BrandMark = styled.div`
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(138, 87, 237, 0.18));
  box-shadow: 0 10px 30px rgba(140, 88, 255, 0.25);

  svg {
    width: 18px;
    height: 18px;
  }
`;

const GhostIcon = styled(CircleButton)``;

const HistoryList = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
`;

const EmptyState = styled.p`
  margin: auto 0;
  color: rgba(255, 255, 255, 0.48);
  text-align: center;
`;

const HistoryItem = styled.button<{ $active: boolean }>`
  width: 100%;
  padding: 16px 18px;
  border-radius: 18px;
  text-align: left;
  color: rgba(255, 255, 255, 0.84);
  background: ${({ $active }) => ($active ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.05)")};
  border: 1px solid ${({ $active }) => ($active ? "rgba(255, 255, 255, 0.1)" : "transparent")};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PrimaryPill = styled.button`
  min-height: 64px;
  padding: 0 28px;
  border-radius: 999px;
  color: #fff;
  background: linear-gradient(135deg, rgba(216, 194, 255, 0.38), rgba(149, 92, 238, 0.42));
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 18px 38px rgba(108, 58, 179, 0.25);
`;

const ContentPanel = styled.main`
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;

  @media (max-width: 960px) {
    padding: 28px 20px;
  }
`;

const AmbientOrb = styled.div`
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
  filter: blur(40px);
  opacity: 0.8;
`;

const AmbientTop = styled(AmbientOrb)`
  top: 15%;
  left: 45%;
  width: 380px;
  height: 220px;
  background: rgba(176, 93, 255, 0.16);
  animation: ${float} 8s ease-in-out infinite;
`;

const AmbientBottom = styled(AmbientOrb)`
  bottom: -10%;
  left: 15%;
  width: 520px;
  height: 220px;
  background: rgba(144, 84, 255, 0.2);
  animation: ${float} 10s ease-in-out infinite reverse;
`;

const Hero = styled.section`
  position: relative;
  z-index: 1;
  width: min(100%, 980px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  text-align: center;
  animation: ${rise} 500ms ease;
`;

const HeroCopy = styled.div`
  h1 {
    margin: 8px 0 12px;
    font-size: clamp(2.2rem, 4vw, 3.7rem);
    line-height: 1;
  }

  p {
    margin: 0;
    font-size: 1.1rem;
    color: rgba(255, 255, 255, 0.66);
  }
`;

const Eyebrow = styled.span`
  display: inline-block;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-size: 0.72rem;
  color: rgba(221, 202, 255, 0.7);
`;

const HeroForm = styled.form`
  width: min(100%, 640px);
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const UrlField = styled.label`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px;
  min-height: 64px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(171, 109, 255, 0.12));
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 20px 50px rgba(112, 61, 188, 0.18);

  svg {
    width: 18px;
    height: 18px;
  }

  input {
    flex: 1;
    background: transparent;
    border: 0;
    outline: none;
    color: #fff;
  }

  input::placeholder {
    color: rgba(255, 255, 255, 0.36);
  }
`;

const ErrorMessage = styled.p`
  margin: 0;
  color: #ffb8cf;
`;

const SummaryPanel = styled.section`
  position: relative;
  z-index: 1;
  width: min(100%, 980px);
  height: calc(100vh - 80px);
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 24px;
  animation: ${rise} 500ms ease;

  @media (max-width: 960px) {
    height: auto;
    min-height: calc(100vh - 230px);
  }
`;

const SummaryScroll = styled.div`
  overflow: auto;
  padding-right: 12px;
`;

const SummaryHeader = styled.div`
  h2 {
    margin: 10px 0 0;
    font-size: clamp(1.4rem, 2vw, 2.1rem);
    word-break: break-word;
  }
`;

const SummaryBodyWrap = styled.div`
  max-width: 760px;
  padding: 22px 0 40px;
`;

const SummaryTitle = styled.h1`
  margin: 0 0 24px;
  font-size: clamp(2rem, 3vw, 3rem);
  line-height: 1.05;
`;

const SummaryParagraph = styled.p`
  margin: 0 0 28px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.05rem;
  line-height: 1.8;
`;

const SummaryList = styled.ul`
  margin: 0 0 28px;
  padding-left: 20px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.05rem;
  line-height: 1.8;
`;

const SummaryToolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;

  @media (max-width: 720px) {
    padding-bottom: 12px;
  }
`;

const ToolbarUrl = styled.div`
  flex: 1 1 320px;
  min-height: 56px;
  display: flex;
  align-items: center;
  padding: 0 22px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(164, 99, 245, 0.14));
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.86);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  @media (max-width: 720px) {
    flex-basis: 100%;
  }
`;

const IconButton = styled(CircleButton)`
  width: 56px;
  height: 56px;
`;

const StopButton = styled(PrimaryPill)`
  min-height: 56px;
  padding: 0 22px;
`;

const DeleteButton = styled(IconButton)`
  background: linear-gradient(180deg, rgba(255, 112, 153, 0.5), rgba(210, 65, 115, 0.55));
`;

const InlineErrorMessage = styled(ErrorMessage)`
  margin-top: -8px;
`;

export default App;
