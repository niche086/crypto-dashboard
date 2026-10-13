"use strict";

// Public Binance endpoint verified reachable by the user in their Chrome browser.
// Both coins are requested together; no account or API key is required.
const API_URL = "https://api.binance.com/api/v3/ticker/24hr?symbols=" +
  encodeURIComponent(JSON.stringify(["BTCUSDT", "ETHUSDT"]));
const REFRESH_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;
const symbols = ["BTCUSDT", "ETHUSDT"];
const refreshButton = document.querySelector("#refresh-button");
const statusLabel = document.querySelector("#connection-status");
const errorMessage = document.querySelector("#error-message");
const numberFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let loading = false;
let lastSuccess = null;
let nextRefresh = Date.now() + REFRESH_MS;

function validateTicker(data) {
  if (!Array.isArray(data)) throw new Error("INVALID_DATA");
  return symbols.map((symbol) => {
    const ticker = data.find((item) => item && item.symbol === symbol);
    const fields = ["lastPrice", "priceChangePercent", "volume", "quoteVolume"];
    if (!ticker || fields.some((field) =>
      !["number", "string"].includes(typeof ticker[field]) ||
      String(ticker[field]).trim() === "" || !Number.isFinite(Number(ticker[field]))
    )) throw new Error("INVALID_DATA");
    if (Number(ticker.lastPrice) <= 0 || Number(ticker.volume) < 0 || Number(ticker.quoteVolume) < 0) {
      throw new Error("INVALID_DATA");
    }
    return ticker;
  });
}

function renderTicker(ticker) {
  const card = document.getElementById(ticker.symbol);
  const field = (name) => card.querySelector(`[data-field="${name}"]`);
  field("price").textContent = numberFormat.format(Number(ticker.lastPrice));
  field("volume").textContent = numberFormat.format(Number(ticker.volume));
  field("quoteVolume").textContent = numberFormat.format(Number(ticker.quoteVolume));
  const change = Number(ticker.priceChangePercent);
  field("change").textContent = `${change > 0 ? "+" : ""}${change.toFixed(2)}%`;
  field("change").className = `change ${change > 0 ? "positive" : change < 0 ? "negative" : ""}`;
  card.classList.remove("stale");
}

async function refreshPrices() {
  if (loading) return;
  loading = true;
  refreshButton.disabled = true;
  statusLabel.textContent = "시세 갱신 중";
  statusLabel.className = "status";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(API_URL, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    // Validate both coins before changing the screen to avoid a partial update.
    validateTicker(await response.json()).forEach(renderTicker);
    lastSuccess = new Date();
    const time = document.querySelector("#last-updated");
    time.dateTime = lastSuccess.toISOString();
    time.textContent = lastSuccess.toLocaleString("ko-KR", { hour12: false });
    errorMessage.hidden = true;
    statusLabel.textContent = "최신 시세 연결됨";
    statusLabel.className = "status live";
  } catch (error) {
    let reason = "이 브라우저에서 API 요청이 실패했습니다. 인터넷 연결을 확인하고, 자세한 원인은 README의 연결 점검 방법을 참고해 주세요.";
    if (error.name === "AbortError") reason = "응답 시간이 길어 연결을 종료했습니다.";
    if (["HTTP_429", "HTTP_418"].includes(error.message)) reason = "바이낸스 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.";
    if (error.message === "INVALID_DATA" || error instanceof SyntaxError) reason = "바이낸스에서 올바른 시세 데이터를 받지 못했습니다.";
    errorMessage.textContent = `시세를 불러오지 못했습니다. ${reason} 30초 후 자동으로 다시 시도합니다.${lastSuccess ? " 현재 표시된 값은 마지막으로 성공한 시세이며 최신 정보가 아닙니다." : " 새로고침 버튼으로 다시 시도할 수도 있습니다."}`;
    errorMessage.hidden = false;
    statusLabel.textContent = lastSuccess ? "갱신 지연 · 이전 시세" : "연결 확인 필요";
    statusLabel.className = "status offline";
    if (lastSuccess) symbols.forEach((symbol) => document.getElementById(symbol).classList.add("stale"));
  } finally {
    clearTimeout(timeout);
    loading = false;
    refreshButton.disabled = false;
    nextRefresh = Date.now() + REFRESH_MS;
    updateCountdown();
  }
}

function updateCountdown() {
  document.querySelector("#next-update").textContent = loading ? "갱신 중…" : `· ${Math.max(0, Math.ceil((nextRefresh - Date.now()) / 1000))}초 후`;
}

refreshButton.addEventListener("click", refreshPrices);
setInterval(() => {
  if (!loading && Date.now() >= nextRefresh) refreshPrices();
  updateCountdown();
}, 1000);
// Refresh promptly when returning to a tab whose timers were paused by the browser.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && Date.now() >= nextRefresh) refreshPrices();
});
refreshPrices();
