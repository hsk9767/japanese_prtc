import "./style.css";
import { LEVELS, DEFAULT_LEVEL, loadLevel, loadKanjiMap, pickRandom } from "./vocab/data.js";
import { getStudiedIds, addStudied, clearStudied } from "./vocab/progress.js";
import { loadBatches, saveBatch, clearBatches, formatBatchTime } from "./vocab/batches.js";
import { renderWordList } from "./vocab/view.js";

const LEVEL_KEY = "jlpt:level";
const BATCH_SIZE = 10;

const levelRow = document.getElementById("level-row");
const progressEl = document.getElementById("progress");
const statusEl = document.getElementById("vocab-status");
const listEl = document.getElementById("word-list");
const newWordsBtn = document.getElementById("new-words-btn");
const testBtn = document.getElementById("test-btn");
const historyPanel = document.querySelector('[data-panel="history"]');
const settingsPanel = document.querySelector('[data-panel="settings"]');

let currentLevel = Number(localStorage.getItem(LEVEL_KEY)) || DEFAULT_LEVEL;

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
    document
      .querySelectorAll(".tab-panel")
      .forEach((p) => p.classList.toggle("active", p.dataset.panel === tab));
    if (tab === "history") renderHistory();
    if (tab === "settings") renderSettings();
  });
});

function renderLevelRow() {
  levelRow.innerHTML = LEVELS.map(
    (lv) =>
      `<button class="level-chip ${lv === currentLevel ? "active" : ""}" data-level="${lv}">N${lv}</button>`,
  ).join("");
  levelRow.querySelectorAll(".level-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      currentLevel = Number(chip.dataset.level);
      localStorage.setItem(LEVEL_KEY, String(currentLevel));
      renderLevelRow();
      listEl.innerHTML = "";
      statusEl.textContent = "";
      updateProgress();
    });
  });
}

async function updateProgress() {
  try {
    const words = await loadLevel(currentLevel);
    const studied = getStudiedIds(currentLevel);
    progressEl.textContent = `N${currentLevel} · 학습한 단어 ${studied.size} / ${words.length}`;
  } catch (err) {
    progressEl.textContent = err.message;
  }
}

async function withBusy(fn) {
  newWordsBtn.disabled = true;
  testBtn.disabled = true;
  try {
    await fn();
  } catch (err) {
    console.error(err);
    statusEl.textContent = err.message || "오류가 발생했습니다.";
  } finally {
    newWordsBtn.disabled = false;
    testBtn.disabled = false;
  }
}

newWordsBtn.addEventListener("click", () =>
  withBusy(async () => {
    statusEl.textContent = "단어를 불러오는 중…";
    const [words] = await Promise.all([loadLevel(currentLevel), loadKanjiMap()]);
    const studied = getStudiedIds(currentLevel);
    const fresh = words.filter((w) => !studied.has(w.id));

    if (!fresh.length) {
      statusEl.textContent = `N${currentLevel}의 모든 단어를 학습했습니다. 설정에서 기록을 초기화할 수 있어요.`;
      listEl.innerHTML = "";
      return;
    }

    const picked = pickRandom(fresh, BATCH_SIZE);
    addStudied(
      currentLevel,
      picked.map((w) => w.id),
    );
    saveBatch(currentLevel, picked);
    statusEl.textContent = "";
    renderWordList(listEl, picked, { heading: `새 단어 ${picked.length}개` });
    updateProgress();
  }),
);

testBtn.addEventListener("click", () =>
  withBusy(async () => {
    statusEl.textContent = "테스트를 준비하는 중…";
    const [words] = await Promise.all([loadLevel(currentLevel), loadKanjiMap()]);
    const studied = getStudiedIds(currentLevel);
    const learned = words.filter((w) => studied.has(w.id));

    if (!learned.length) {
      statusEl.textContent = "먼저 [새 단어]로 단어를 학습해주세요.";
      listEl.innerHTML = "";
      return;
    }

    const picked = pickRandom(learned, BATCH_SIZE);
    statusEl.textContent = "";
    renderWordList(listEl, picked, { heading: `테스트 ${picked.length}문제` });
  }),
);

function escapeText(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

async function renderHistory() {
  const batches = loadBatches();
  if (!batches.length) {
    historyPanel.innerHTML = `
      <section class="settings-block">
        <h3>새 단어 기록</h3>
        <p class="muted">아직 기록이 없습니다. [새 단어]를 누르면 그때 뽑힌 10개가 여기에 쌓입니다.</p>
      </section>`;
    return;
  }

  await loadKanjiMap();

  const byLevel = new Map();
  for (const lv of new Set(batches.map((b) => b.level))) {
    const words = await loadLevel(lv).catch(() => []);
    byLevel.set(lv, new Map(words.map((w) => [w.id, w])));
  }

  const wordsOf = (batch) => {
    const lookup = byLevel.get(batch.level) ?? new Map();
    return batch.wordIds.map((id) => lookup.get(id)).filter(Boolean);
  };

  const items = batches
    .map((batch) => {
      const words = wordsOf(batch);
      const preview = words
        .slice(0, 4)
        .map((w) => w.kanji || w.reading)
        .join(" · ");
      return `
        <article class="batch" data-id="${batch.id}">
          <button class="batch-head" type="button">
            <span class="batch-info">
              <span class="batch-meta">N${batch.level} · ${escapeText(formatBatchTime(batch.at))} · ${words.length}단어</span>
              <span class="batch-preview">${escapeText(preview)}${words.length > 4 ? " …" : ""}</span>
            </span>
            <span class="chevron">▾</span>
          </button>
          <div class="batch-body" hidden></div>
        </article>`;
    })
    .join("");

  historyPanel.innerHTML = `
    <section class="settings-block">
      <div class="settings-row">
        <h3>새 단어 기록 (${batches.length})</h3>
        <button class="secondary-btn small" id="clear-batches">전체 삭제</button>
      </div>
      <div class="batch-list">${items}</div>
    </section>`;

  historyPanel.querySelector("#clear-batches").addEventListener("click", () => {
    clearBatches();
    renderHistory();
  });

  historyPanel.querySelectorAll(".batch").forEach((el) => {
    const head = el.querySelector(".batch-head");
    const body = el.querySelector(".batch-body");
    head.addEventListener("click", () => {
      const opening = body.hidden;
      // one batch expanded at a time keeps the list scannable
      historyPanel.querySelectorAll(".batch").forEach((other) => {
        other.classList.remove("open");
        other.querySelector(".batch-body").hidden = true;
      });
      if (!opening) return;

      const batch = batches.find((b) => b.id === el.dataset.id);
      renderWordList(body, wordsOf(batch));
      body.hidden = false;
      el.classList.add("open");
    });
  });
}

async function renderSettings() {
  const rows = await Promise.all(
    LEVELS.map(async (lv) => {
      const studied = getStudiedIds(lv).size;
      let total = "?";
      try {
        total = (await loadLevel(lv)).length;
      } catch {
        /* level data not loadable — show counts we do have */
      }
      return `
        <div class="settings-row">
          <span>N${lv} · ${studied} / ${total}</span>
          <button class="secondary-btn small" data-reset="${lv}">초기화</button>
        </div>`;
    }),
  );

  settingsPanel.innerHTML = `
    <section class="settings-block">
      <h3>학습 기록</h3>
      ${rows.join("")}
      <p class="hint">초기화하면 해당 레벨에서 학습한 단어 기록이 지워지고, [새 단어]에 다시 등장합니다.</p>
    </section>
    <section class="settings-block">
      <h3>단어 데이터</h3>
      <p class="hint">JLPT 등급별 단어·뜻은 네이버 일본어사전의 JLPT 단어 목록을 기반으로 합니다.</p>
    </section>
  `;

  settingsPanel.querySelectorAll("[data-reset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lv = Number(btn.dataset.reset);
      clearStudied(lv);
      renderSettings();
      if (lv === currentLevel) updateProgress();
    });
  });
}

renderLevelRow();
updateProgress();
loadKanjiMap();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true }));
  });
}
