import styled, { createGlobalStyle, keyframes } from "styled-components";

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

export const GlobalStyle = createGlobalStyle`
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;700&display=swap");

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

export const AppShell = styled.div`
  min-height: 100vh;
  display: grid;
  grid-template-columns: 320px 1fr;
  background:
    radial-gradient(
      circle at 60% 50%,
      rgba(173, 94, 255, 0.22),
      transparent 23%
    ),
    radial-gradient(
      circle at 18% 100%,
      rgba(159, 85, 255, 0.16),
      transparent 28%
    ),
    linear-gradient(180deg, rgba(5, 5, 7, 0.98), rgba(10, 7, 16, 0.98));

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

export const Sidebar = styled.aside`
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 24px 24px 28px;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(180deg, rgba(4, 4, 6, 0.96), rgba(8, 6, 13, 0.92)),
    radial-gradient(
      circle at 50% 100%,
      rgba(165, 93, 255, 0.14),
      transparent 38%
    );
  backdrop-filter: blur(18px);

  @media (max-width: 960px) {
    min-height: 230px;
    border-right: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
`;

export const BrandRow = styled.div`
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
  transition:
    transform 180ms ease,
    background 180ms ease,
    border-color 180ms ease;

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

export const BrandMark = styled.div`
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  color: #fff;

  svg {
    width: 100%;
    height: 100%;
  }
`;

export const GhostIcon = styled(CircleButton)``;

export const HistoryList = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
`;

export const EmptyState = styled.p`
  margin: auto 0;
  color: rgba(255, 255, 255, 0.48);
  text-align: center;
`;

export const HistoryItem = styled.button<{ $active: boolean }>`
  width: 100%;
  padding: 16px 18px;
  border-radius: 18px;
  text-align: left;
  font-family: "Inter Variable", "Inter", "Segoe UI", sans-serif;
  font-weight: 400;
  font-size: 13px;
  line-height: 16px;
  letter-spacing: 0;
  font-variant-numeric: lining-nums tabular-nums;
  color: rgba(255, 255, 255, 0.84);
  background: ${({ $active }) =>
    $active ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.05)"};
  border: 1px solid
    ${({ $active }) => ($active ? "rgba(255, 255, 255, 0.1)" : "transparent")};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const PrimaryPill = styled.button`
  min-height: 64px;
  padding: 0 28px;
  border-radius: 999px;
  font-family: "Inter Variable", "Inter", "Segoe UI", sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 140%;
  letter-spacing: 0;
  font-variant-numeric: lining-nums tabular-nums;
  color: #fff;
  background: linear-gradient(
    135deg,
    rgba(216, 194, 255, 0.38),
    rgba(149, 92, 238, 0.42)
  );
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 18px 38px rgba(108, 58, 179, 0.25);
`;

export const HeroSubmitButton = styled(PrimaryPill)``;

export const ContentPanel = styled.main`
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

export const AmbientTop = styled(AmbientOrb)`
  top: 15%;
  left: 45%;
  width: 380px;
  height: 220px;
  background: rgba(176, 93, 255, 0.16);
  animation: ${float} 8s ease-in-out infinite;
`;

export const AmbientBottom = styled(AmbientOrb)`
  bottom: -10%;
  left: 15%;
  width: 520px;
  height: 220px;
  background: rgba(144, 84, 255, 0.2);
  animation: ${float} 10s ease-in-out infinite reverse;
`;

export const Hero = styled.section`
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

export const HeroCopy = styled.div`
  h1 {
    margin: 8px 0 12px;
    font-family: "Inter Variable", "Inter", "Segoe UI", sans-serif;
    font-weight: 600;
    font-size: 24px;
    line-height: 32px;
    letter-spacing: -0.25px;
    text-align: center;
    font-variant-numeric: lining-nums tabular-nums;
  }

  p {
    margin: 0;
    font-family: "Inter Variable", "Inter", "Segoe UI", sans-serif;
    font-weight: 400;
    font-size: 18px;
    line-height: 24px;
    letter-spacing: 0;
    text-align: center;
    font-variant-numeric: lining-nums tabular-nums;
    color: rgba(255, 255, 255, 0.66);
  }
`;

export const Eyebrow = styled.span`
  display: inline-block;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-size: 0.72rem;
  color: rgba(221, 202, 255, 0.7);
`;

export const HeroForm = styled.form`
  width: min(100%, 640px);
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

export const UrlField = styled.label`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px;
  min-height: 64px;
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.12),
    rgba(171, 109, 255, 0.12)
  );
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 20px 50px rgba(112, 61, 188, 0.18);

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

export const ErrorMessage = styled.p`
  margin: 0;
  color: #ffb8cf;
`;

export const SummaryPanel = styled.section`
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

export const SummaryScroll = styled.div`
  overflow: auto;
  padding-right: 12px;
`;

export const SummaryHeader = styled.div`
  h2 {
    margin: 10px 0 0;
    font-size: clamp(1.4rem, 2vw, 2.1rem);
    word-break: break-word;
  }
`;

export const SummaryBodyWrap = styled.div`
  max-width: 760px;
  padding: 22px 0 40px;
`;

export const SummaryTitle = styled.h1`
  margin: 0 0 24px;
  font-family: "Inter Variable", "Inter", "Segoe UI", sans-serif;
  font-weight: 600;
  font-size: 28px;
  line-height: 32px;
  letter-spacing: -0.25px;
  font-variant-numeric: lining-nums tabular-nums;
`;

export const SummaryParagraph = styled.p`
  margin: 0 0 28px;
  font-family: "Inter Variable", "Inter", "Segoe UI", sans-serif;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  line-height: 160%;
  letter-spacing: 0;
  font-variant-numeric: lining-nums tabular-nums;
`;

export const SummaryList = styled.ul`
  margin: 0 0 28px;
  padding-left: 20px;
  font-family: "Inter Variable", "Inter", "Segoe UI", sans-serif;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  line-height: 160%;
  letter-spacing: 0;
  font-variant-numeric: lining-nums tabular-nums;
`;

export const SummaryToolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;

  @media (max-width: 720px) {
    padding-bottom: 12px;
  }
`;

export const ToolbarUrl = styled.div`
  flex: 1 1 320px;
  min-height: 56px;
  display: flex;
  align-items: center;
  padding: 0 22px;
  border-radius: 999px;
  font-family: "Inter Variable", "Inter", "Segoe UI", sans-serif;
  font-weight: 400;
  font-size: 14px;
  line-height: 140%;
  letter-spacing: 0;
  font-variant-numeric: lining-nums tabular-nums;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.1),
    rgba(164, 99, 245, 0.14)
  );
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.86);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  @media (max-width: 720px) {
    flex-basis: 100%;
  }
`;

export const IconButton = styled(CircleButton)`
  width: 56px;
  height: 56px;
`;

export const StopButton = styled(PrimaryPill)`
  min-height: 56px;
  padding: 0 22px;
`;

export const InlineErrorMessage = styled(ErrorMessage)`
  margin-top: -8px;
`;
