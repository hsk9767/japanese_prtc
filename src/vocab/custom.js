const KEY = "jlpt:customWords";

const JAPANESE_RE = /[぀-ヿ一-龯㐀-䶿]/;
const KANJI_RE = /[一-龯㐀-䶿]/;
const FURIGANA_RE = /([一-龯㐀-䶿]+)[（(]([^）)]*)[）)]/g;
const PAREN_RE = /[（(][^）)]*[）)]/g;

/**
 * Pulls vocabulary out of a pasted Claude answer. Lines look like
 * "東京(とうきょう): 도쿄" or "吹(ふ)いている: 불고 있다"; label lines such as
 * "히라가나: …" are skipped because their left side holds no Japanese.
 */
export function parseWordLines(text) {
  const found = [];
  const seen = new Set();

  for (const rawLine of String(text ?? "").split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^[-*•·]\s*/, "");
    const match = line.match(/^(.{1,30}?)\s*[:：]\s*(.+)$/);
    if (!match) continue;

    const left = match[1].trim();
    const right = match[2].trim();
    if (!JAPANESE_RE.test(left) || !right) continue;

    const surface = left.replace(PAREN_RE, "").trim();
    const reading = left.replace(FURIGANA_RE, "$2").replace(PAREN_RE, "").trim();
    if (!surface || !reading) continue;

    const key = `${surface}|${reading}`;
    if (seen.has(key)) continue;
    seen.add(key);

    found.push({
      reading,
      kanji: KANJI_RE.test(surface) ? surface : null,
      means: right
        .split(/[,;]/)
        .map((m) => m.trim())
        .filter(Boolean),
    });
  }

  return found;
}

export function loadCustomWords() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function wordKey(word) {
  return `${word.kanji ?? ""}|${word.reading}`;
}

/** Adds words, skipping ones already saved. Returns how many were new. */
export function addCustomWords(words) {
  const existing = loadCustomWords();
  const seen = new Set(existing.map(wordKey));
  const added = [];

  for (const word of words) {
    if (seen.has(wordKey(word))) continue;
    seen.add(wordKey(word));
    added.push({
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      reading: word.reading,
      kanji: word.kanji ?? null,
      means: word.means ?? [],
      parts: [],
      custom: true,
      at: new Date().toISOString(),
    });
  }

  if (added.length) {
    localStorage.setItem(KEY, JSON.stringify([...added, ...existing]));
  }
  return added.length;
}

export function removeCustomWord(id) {
  localStorage.setItem(KEY, JSON.stringify(loadCustomWords().filter((w) => w.id !== id)));
}

export function clearCustomWords() {
  localStorage.removeItem(KEY);
}
