const KANJI_RE = /[\u4e00-\u9faf\u3400-\u4dbf]/;
const HANJA_SEARCH = "https://hanja.dict.naver.com/#/search?query=";

function esc(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

/** Renders a kanji string with each CJK character individually tappable. */
function kanjiHtml(kanji) {
  return [...kanji]
    .map((ch) =>
      KANJI_RE.test(ch)
        ? `<a class="kanji-char" href="${HANJA_SEARCH}${encodeURIComponent(ch)}" target="_blank" rel="noopener">${esc(ch)}</a>`
        : `<span class="kana-char">${esc(ch)}</span>`,
    )
    .join("");
}

function meansHtml(means) {
  if (!means.length) return '<p class="muted">뜻 정보 없음</p>';
  const items = means
    .map((m) => `<li>${esc(m.replace(/;/g, " · "))}</li>`)
    .join("");
  return `<ul class="means">${items}</ul>`;
}

function detailHtml(word) {
  const kanjiBlock = word.kanji
    ? `<div class="detail-row">
         <span class="detail-label">한자</span>
         <span class="kanji-line">${kanjiHtml(word.kanji)}</span>
       </div>
       <p class="hint">한자를 누르면 네이버 한자사전이 열립니다.</p>`
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
      (word, index) => `
        <article class="word-card" data-index="${index}">
          <button class="word-front" type="button">
            <span class="word-text">${esc(frontText(word))}</span>
            <span class="chevron">▾</span>
          </button>
          <div class="word-detail" hidden>${detailHtml(word)}</div>
        </article>
      `,
    )
    .join("");

  container.innerHTML = `${heading ? `<h2 class="list-heading">${esc(heading)}</h2>` : ""}${cards}`;

  container.querySelectorAll(".word-card").forEach((card) => {
    const front = card.querySelector(".word-front");
    const detail = card.querySelector(".word-detail");
    front.addEventListener("click", () => {
      detail.hidden = !detail.hidden;
      card.classList.toggle("open", !detail.hidden);
    });
  });
}
