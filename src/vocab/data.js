import { candidateForms } from "./deconjugate.js";

export const LEVELS = [5, 4, 3, 2, 1];
export const DEFAULT_LEVEL = 3;

const cache = new Map();
let kanjiMap = null;
let allWords = null;

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

/** Every JLPT word across all levels, each tagged with the level it came from. */
export async function loadAllWords() {
  if (allWords) return allWords;
  const perLevel = await Promise.all(
    LEVELS.map(async (level) => (await loadLevel(level)).map((w) => ({ ...w, level }))),
  );
  allWords = perLevel.flat();
  return allWords;
}

function matchRank(word, query) {
  const kanji = word.kanji ?? "";
  const reading = word.reading ?? "";
  if (kanji === query || reading === query) return 0;
  if (kanji.startsWith(query) || reading.startsWith(query)) return 1;
  if (kanji.includes(query) || reading.includes(query)) return 2;
  if ((word.means ?? []).some((m) => m.includes(query))) return 3;
  return Infinity;
}

function collect(pool, query, limit) {
  const hits = [];
  for (const word of pool) {
    const rank = matchRank(word, query);
    if (rank !== Infinity) hits.push({ word, rank });
  }
  hits.sort((a, b) => a.rank - b.rank || a.word.reading.length - b.word.reading.length);
  return hits.slice(0, limit).map((h) => h.word);
}

/**
 * Offline lookup over the bundled dictionary plus hand-added words.
 * Accepts kana, kanji (even a single character) or a Korean meaning.
 *
 * Subtitles show conjugated forms (吹いている) while the dictionary only holds
 * the plain form (吹く), so when nothing matches we retry on ever shorter
 * prefixes until the stem hits something, and report which stem was used.
 */
export async function searchWords(query, extraWords = [], limit = 40) {
  const q = String(query ?? "").trim();
  if (!q) return { words: [], usedQuery: q, exact: true };

  const pool = [...extraWords, ...(await loadAllWords())];

  // the word as typed, then de-conjugated guesses (吹いている -> 吹く)
  for (const form of candidateForms(q)) {
    const hits = collect(pool, form, limit);
    if (hits.length) return { words: hits, usedQuery: form, exact: form === q };
  }

  // last resort: shave characters off the end until something matches
  for (let len = q.length - 1; len >= 1; len--) {
    const stem = q.slice(0, len);
    const hits = collect(pool, stem, limit);
    if (hits.length) return { words: hits, usedQuery: stem, exact: false };
  }

  return { words: [], usedQuery: q, exact: true };
}
