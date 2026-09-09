const ALLOWED_TAGS = new Set(["ruby", "rt", "br"]);

/**
 * Keeps only <ruby>/<rt>/<br> (no attributes) from model output and
 * HTML-escapes everything else, so we can safely use innerHTML for furigana.
 */
function sanitizeFurigana(text) {
  let out = "";
  let i = 0;
  const escapeChar = (ch) => {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    return ch;
  };
  while (i < text.length) {
    const ch = text[i];
    if (ch === "<") {
      const close = text.indexOf(">", i);
      if (close === -1) {
        out += escapeChar(ch);
        i += 1;
        continue;
      }
      const tagContent = text.slice(i + 1, close);
      const tagMatch = tagContent.match(/^\/?\s*([a-zA-Z]+)\s*$/);
      const tagName = tagMatch ? tagMatch[1].toLowerCase() : null;
      if (tagName && ALLOWED_TAGS.has(tagName)) {
        out += `<${tagContent.trim()}>`;
      }
      i = close + 1;
      continue;
    }
    out += escapeChar(ch);
    i += 1;
  }
  return out;
}

function listToHtml(items) {
  if (!items.length) return '<p class="muted">없음</p>';
  return `<ul>${items.map((i) => `<li>${sanitizeFurigana(i)}</li>`).join("")}</ul>`;
}

export function renderResult(container, result, direction) {
  const translationHtml =
    direction === "ko-jp" ? sanitizeFurigana(result.translation) : escapeText(result.translation);

  container.innerHTML = `
    <section class="result-block">
      <h3>번역</h3>
      <p class="translation">${translationHtml}</p>
    </section>
    <section class="result-block">
      <h3>단어</h3>
      ${listToHtml(result.vocab)}
    </section>
    <section class="result-block">
      <h3>문법</h3>
      ${listToHtml(result.grammar)}
    </section>
  `;
}

function escapeText(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

export function renderError(container, message) {
  container.innerHTML = `<p class="error">${escapeText(message)}</p>`;
}

/**
 * Best-effort human-readable dump of a caught error, for phones where
 * checking the JS console isn't practical. Handles Error instances,
 * DOMException/WebGPU errors that carry name+message, plain strings,
 * and anything else that doesn't fit those shapes.
 */
export function formatErrorDetail(err) {
  if (!err) return "알 수 없는 오류가 발생했습니다.";
  if (typeof err === "string") return err;
  const parts = [];
  if (err.name) parts.push(err.name);
  if (err.message) parts.push(err.message);
  if (parts.length) return parts.join(": ");
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
