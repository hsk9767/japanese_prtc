// Stroke-based kanji recognition, so a character you can't read (and so
// can't type) can just be drawn. Runs fully offline via KanjiCanvas:
// https://github.com/asdfjkl/kanjicanvas
const BASE = "./vendor/kanjicanvas";
const CANVAS_ID = "hw-canvas";

let loader = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("손글씨 인식기를 불러오지 못했습니다."));
    document.head.appendChild(el);
  });
}

/** The stroke pattern database is ~6.7MB, so it only loads on first use. */
function loadRecognizer() {
  if (!loader) {
    // kanji-canvas defines the namespace that ref-patterns then fills in
    loader = loadScript(`${BASE}/kanji-canvas.min.js`)
      .then(() => loadScript(`${BASE}/ref-patterns.js`))
      .catch((err) => {
        loader = null; // let the next attempt retry
        throw err;
      });
  }
  return loader;
}

function candidatesFrom(result) {
  return String(result ?? "")
    .split(/\s+/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 12);
}

/**
 * Draws the pad into `container`. `onPick` receives a single character
 * whenever one of the recognised candidates is tapped.
 */
export async function renderHandwritingPad(container, onPick) {
  container.innerHTML = `
    <div class="hw-pad">
      <p class="status hw-status">손글씨 인식기를 준비하는 중… (처음 한 번만 다운로드)</p>
    </div>`;

  const status = container.querySelector(".hw-status");

  try {
    await loadRecognizer();
  } catch (err) {
    status.textContent = err.message;
    return;
  }

  container.innerHTML = `
    <div class="hw-pad">
      <canvas id="${CANVAS_ID}" class="hw-canvas" width="320" height="320"></canvas>
      <div class="hw-actions">
        <button class="secondary-btn small" type="button" data-hw="undo">한 획 취소</button>
        <button class="secondary-btn small" type="button" data-hw="clear">지우기</button>
        <button class="secondary-btn small" type="button" data-hw="recognize">인식</button>
      </div>
      <div class="hw-candidates"></div>
      <p class="status hw-status">칸 안에 한자를 그린 뒤 [인식]을 누르세요.</p>
      <p class="hint">인식 엔진: <a href="https://github.com/asdfjkl/kanjicanvas" target="_blank" rel="noopener">KanjiCanvas</a> (Dominik Klein)</p>
    </div>`;

  const canvas = container.querySelector(`#${CANVAS_ID}`);
  const candidateBox = container.querySelector(".hw-candidates");
  const liveStatus = container.querySelector(".hw-status");

  window.KanjiCanvas.init(CANVAS_ID);

  const recognize = () => {
    const found = candidatesFrom(window.KanjiCanvas.recognize(CANVAS_ID));
    if (!found.length) {
      candidateBox.innerHTML = "";
      liveStatus.textContent = "인식하지 못했습니다. 획순대로 다시 그려보세요.";
      return;
    }
    liveStatus.textContent = "비슷한 한자입니다. 눌러서 검색창에 넣으세요.";
    candidateBox.innerHTML = found
      .map((ch) => `<button class="hw-candidate" type="button">${ch}</button>`)
      .join("");
    candidateBox.querySelectorAll(".hw-candidate").forEach((btn) => {
      btn.addEventListener("click", () => onPick(btn.textContent));
    });
  };

  container.querySelectorAll("[data-hw]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.hw;
      if (action === "undo") window.KanjiCanvas.deleteLast(CANVAS_ID);
      if (action === "clear") {
        window.KanjiCanvas.erase(CANVAS_ID);
        candidateBox.innerHTML = "";
        liveStatus.textContent = "칸 안에 한자를 그린 뒤 [인식]을 누르세요.";
      }
      if (action === "recognize") recognize();
    });
  });

  // drawing with a finger shouldn't scroll the page
  canvas.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
}
