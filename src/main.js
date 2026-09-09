import "./style.css";
import { translate, isOnDeviceModelLoaded } from "./engines/translate.js";
import { loadSettings } from "./engines/settings-store.js";
import { renderResult, renderError } from "./ui/result-view.js";
import { renderSettingsPanel } from "./ui/settings-panel.js";

const tabButtons = document.querySelectorAll(".tab-btn");
const panels = document.querySelectorAll(".tab-panel");
const settingsPanel = document.querySelector('[data-panel="settings"]');

let settingsRendered = false;

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
    panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === tab));
    if (tab === "settings" && !settingsRendered) {
      renderSettingsPanel(settingsPanel);
      settingsRendered = true;
    }
  });
});

function wireTranslatePanel(direction) {
  const panel = document.querySelector(`[data-panel="${direction}"]`);
  const input = panel.querySelector("[data-input]");
  const btn = panel.querySelector("[data-translate-btn]");
  const status = panel.querySelector("[data-status]");
  const result = panel.querySelector("[data-result]");

  btn.addEventListener("click", async () => {
    const text = input.value.trim();
    if (!text) return;

    btn.disabled = true;
    result.innerHTML = "";

    const settings = loadSettings();
    const usingOnDevice = settings.engine !== "gemini" || !settings.geminiApiKey;

    if (usingOnDevice && !isOnDeviceModelLoaded()) {
      status.textContent = "내장 모델을 처음 준비하는 중입니다 (최대 1GB 다운로드, Wi-Fi 권장)…";
    } else {
      status.textContent = "번역 중…";
    }

    const onProgress = (info) => {
      if (info?.status === "progress" && info.file) {
        const pct = info.total ? Math.round((info.loaded / info.total) * 100) : null;
        status.textContent = pct !== null
          ? `모델 다운로드 중: ${info.file} (${pct}%)`
          : `모델 다운로드 중: ${info.file}`;
      } else if (info?.status === "ready" || info?.status === "done") {
        status.textContent = "번역 중…";
      }
    };

    try {
      const parsed = await translate(direction, text, settings, onProgress);
      renderResult(result, parsed, direction);
      status.textContent = "";
    } catch (err) {
      console.error(err);
      renderError(result, err.message || "번역 중 오류가 발생했습니다.");
      status.textContent = "";
    } finally {
      btn.disabled = false;
    }
  });
}

wireTranslatePanel("jp-ko");
wireTranslatePanel("ko-jp");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true }));
  });
}
