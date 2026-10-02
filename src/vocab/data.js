export const LEVELS = [5, 4, 3, 2, 1];
export const DEFAULT_LEVEL = 3;

const cache = new Map();
let kanjiMap = null;

/** Loads one JLPT level's word list (scraped from Naver, shipped as static JSON). */
export async function loadLevel(level) {
  if (cache.has(level)) return cache.get(level);
  const res = await fetch(`./data/jlpt-N${level}.json`);
  if (!res.ok) throw new Error(`N${level} 단어 데이터를 불러오지 못했습니다.`);
  const data = await res.json();
  cache.set(level, data.words);
  return data.words;
}

/** kanji character -> Naver hanja dictionary entry id. */
export async function loadKanjiMap() {
  if (kanjiMap) return kanjiMap;
  try {
    const res = await fetch("./data/kanji-entries.json");
    kanjiMap = res.ok ? await res.json() : {};
  } catch {
    kanjiMap = {}; // links fall back to the hanja search page
  }
  return kanjiMap;
}

export function kanjiEntryId(ch) {
  return kanjiMap?.[ch] ?? null;
}

export function pickRandom(words, count) {
  const pool = [...words];
  const picked = [];
  while (pool.length > 0 && picked.length < count) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}
