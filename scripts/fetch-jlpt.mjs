// Scrapes Naver's JLPT word lists into static JSON so the PWA can ship the
// data offline (the browser can't call Naver directly — no CORS headers).
import { writeFile, appendFile } from "node:fs/promises";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36";
const PART_ALL = encodeURIComponent("전체");
const DELAY_MS = 120;
const REQUEST_TIMEOUT_MS = 15000;
const STATUS_FILE = "public/data/.progress.log";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const note = (line) => appendFile(STATUS_FILE, `${new Date().toISOString()} ${line}\n`, "utf8");

async function fetchPage(level, page, attempt = 1) {
  const url = `https://ja.dict.naver.com/api/jako/getJLPTList?level=${level}&part=${PART_ALL}&page=${page}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Referer: "https://ja.dict.naver.com/" },
      // Node's fetch has no default timeout; without this a dropped
      // connection stalls the whole run forever.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 5) throw new Error(`level ${level} page ${page}: ${err.message}`);
    await note(`retry L${level} p${page} attempt ${attempt}: ${err.message}`);
    await sleep(800 * attempt);
    return fetchPage(level, page, attempt + 1);
  }
}

function normalize(item) {
  const reading = decodeURIComponent(item.entry ?? "");
  const kanji = item.pron && item.pron.trim() ? item.pron.trim() : null;
  return {
    id: item.entry_id,
    reading,
    display: item.show_entry ?? reading,
    kanji,
    means: Array.isArray(item.means) ? item.means.filter(Boolean) : [],
    parts: Array.isArray(item.parts) ? item.parts.filter(Boolean) : [],
  };
}

async function fetchLevel(level) {
  const first = await fetchPage(level, 1);
  const totalPage = first.m_totalPage;
  const words = first.m_items.map(normalize);
  await note(`N${level} start: ${totalPage} pages, ${first.m_total} words`);

  for (let page = 2; page <= totalPage; page++) {
    await sleep(DELAY_MS);
    const data = await fetchPage(level, page);
    words.push(...data.m_items.map(normalize));
    if (page % 25 === 0) await note(`N${level} ${page}/${totalPage}`);
  }

  const seen = new Set();
  const unique = words.filter((w) => {
    const key = `${w.reading}|${w.kanji ?? ""}`;
    if (!w.reading || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await writeFile(`public/data/jlpt-N${level}.json`, JSON.stringify({ level, count: unique.length, words: unique }), "utf8");
  await note(`N${level} DONE: ${unique.length} words`);
  return unique.length;
}

const levels = [5, 4, 3, 2, 1];
const counts = {};
for (const level of levels) {
  counts[`N${level}`] = await fetchLevel(level);
}
await note(`ALL DONE ${JSON.stringify(counts)}`);
console.log("ALL DONE", JSON.stringify(counts));
