import { kanjiEntryId } from "./data.js";

const KANJI_RE = /[\u4e00-\u9faf\u3400-\u4dbf]/;
const HANJA_ENTRY = "https://hanja.dict.naver.com/#/entry/ccko/";
const HANJA_SEARCH = "https://hanja.dict.naver.com/#/search?query=";
const JAKO_ENTRY = "https://ja.dict.naver.com/#/entry/jako/";

function esc(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function hanjaUrl(ch) {
  const id = kanjiEntryId(ch);
  return id ? `${HANJA_ENTRY}${id}` : `${HANJA_SEARCH}${encodeURIComponent(ch)}`;
}

/** Renders a kanji string with each CJK character individually tappable. */
function kanjiHtml(kanji) {
  return [...kanji]
    .map((ch) =>
      KANJI_RE.test(ch)
        ? `<a class="kanji-char" href="${hanjaUrl(ch)}" target="_blank" rel="noopener">${esc(ch)}</a>`
        : `<span class="kana-char">${esc(ch)}</span>`,
    )
    .join("");
}

function meansHtml(means) {
  if (!means.length) return '<p class="muted">뜻 정보 없음</p>';
  const items = means.map((m) => `<li>${esc(m.replace(/;/g, " · "))}</li>`).join("");
  return `<ul class="means">${items}</ul>`;
}

function detailHtml(word) {
  const kanjiBlock = word.kanji
    ? `<div class="detail-row">
         <span class="detail-label">한자</span>
         <span class="kanji-line">${kanjiHtml(word.kanji)}</span>
       </div>`
    : "";
  const partsBlock = word.parts?.length
    ? `<div class="detail-row"><span class="detail-label">품사</span><span>${esc(word.parts.join(", "))}</span></div>`
    : "";

  return `
    <div class="detail">
      <div class="detail-row">
        <span class="detail-label">읽기</span>
        <span class="reading">${esc(word.reading)}</span>
      </div>
      ${kanjiBlock}
      ${partsBlock}
      <div class="detail-row detail-means">
        <span class="detail-label">뜻</span>
        ${meansHtml(word.means ?? [])}
      </div>
      <p class="hint">단어를 누르면 네이버 일본어사전, 한자를 누르면 네이버 한자사전이 열립니다.</p>
    </div>
  `;
}

/** Collapsed face: kanji when the word has one, otherwise its kana reading. */
function frontText(word) {
  return word.kanji || word.reading;
}

export function renderWordList(container, words, { heading } = {}) {
  if (!words.length) {
    container.innerHTML = '<p class="muted">표시할 단어가 없습니다.</p>';
    return;
  }

  const cards = words
    .map(
      (word) => `
        <article class="word-card">
          <div class="word-front">
            <a class="word-text" href="${JAKO_ENTRY}${encodeURIComponent(word.id)}" target="_blank" rel="noopener">${esc(frontText(word))}</a>
            <span class="chevron">▾</span>
          </div>
          <div class="word-detail" hidden>${detailHtml(word)}</div>
        </article>
      `,
    )
    .join("");

  container.innerHTML = `${heading ? `<h2 class="list-heading">${esc(heading)}</h2>` : ""}${cards}`;

  container.querySelectorAll(".word-card").forEach((card) => {
    const front = card.querySelector(".word-front");
    const detail = card.querySelector(".word-detail");
    front.addEventListener("click", (event) => {
      // Once the card is open the word itself becomes a dictionary link;
      // anywhere else on the header keeps toggling the card.
      if (!detail.hidden && event.target.closest(".word-text")) return;
      event.preventDefault();
      detail.hidden = !detail.hidden;
      card.classList.toggle("open", !detail.hidden);
    });
  });
}
