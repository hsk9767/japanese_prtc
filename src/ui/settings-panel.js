import { detectWebGPU } from "../engines/translate.js";
import { loadSettings, saveSettings, getCacheUsageMB, clearModelCache } from "../engines/settings-store.js";

export function renderSettingsPanel(container) {
  const settings = loadSettings();

  container.innerHTML = `
    <section class="settings-block">
      <h3>번역 엔진</h3>
      <label class="radio-row">
        <input type="radio" name="engine" value="gemini" ${settings.engine === "gemini" ? "checked" : ""} />
        Gemini API (기본값, 안정적/고품질, API 키 필요)
      </label>
      <input
        type="password"
        id="gemini-key"
        placeholder="Gemini API 키 (aistudio.google.com에서 발급)"
        value="${settings.geminiApiKey ? escapeAttr(settings.geminiApiKey) : ""}"
      />
      <p class="hint">키는 이 기기의 브라우저에만 저장되고 외부로 전송되지 않습니다.</p>
      <label class="radio-row">
        <input type="radio" name="engine" value="on-device" ${settings.engine === "on-device" ? "checked" : ""} />
        내장 모델 (실험적, 100% 폰에서 처리·무료·오프라인)
      </label>
      <p class="hint">0.5B 모델을 폰 GPU/CPU로 직접 돌립니다. 기기에 따라 메모리 부족으로 실패할 수 있어요.</p>
    </section>

    <section class="settings-block">
      <h3>기기 상태</h3>
      <p id="webgpu-status">WebGPU: <strong>확인 중…</strong></p>
      <p id="cache-usage">캐시 용량 확인 중…</p>
      <button id="clear-cache-btn" class="secondary-btn">모델 캐시 삭제</button>
    </section>
  `;

  container.querySelectorAll('input[name="engine"]').forEach((el) => {
    el.addEventListener("change", (e) => {
      const s = loadSettings();
      s.engine = e.target.value;
      saveSettings(s);
    });
  });

  const keyInput = container.querySelector("#gemini-key");
  keyInput.addEventListener("change", () => {
    const s = loadSettings();
    s.geminiApiKey = keyInput.value.trim();
    saveSettings(s);
  });

  container.querySelector("#clear-cache-btn").addEventListener("click", async () => {
    await clearModelCache();
    await refreshCacheUsage(container);
    alert("모델 캐시를 삭제했습니다. 다음 사용 시 다시 다운로드됩니다.");
  });

  refreshCacheUsage(container);
  refreshWebGPUStatus(container);
}

async function refreshWebGPUStatus(container) {
  const el = container.querySelector("#webgpu-status");
  if (!el) return;
  const usable = await detectWebGPU();
  el.innerHTML = usable
    ? "WebGPU: <strong>지원됨 (빠름)</strong>"
    : "WebGPU: <strong>미지원 (WASM으로 대체, 느릴 수 있음)</strong>";
}

async function refreshCacheUsage(container) {
  const el = container.querySelector("#cache-usage");
  if (!el) return;
  const mb = await getCacheUsageMB();
  el.textContent = mb === null ? "캐시 용량: 확인 불가" : `캐시 용량: 약 ${mb}MB`;
}

function escapeAttr(str) {
  return str.replace(/"/g, "&quot;");
}
