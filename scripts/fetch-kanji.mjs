// Resolves every kanji used by the word lists to its Naver hanja dictionary
// entry id, so tapping a character can open the entry page directly instead
// of a search results page.
import { readFile, writeFile, appendFile } from "node:fs/promises";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36";
const DELAY_MS = 100;
const REQUEST_TIMEOUT_MS = 15000;
const KANJI_RE = /[\u4e00-\u9faf\u3400-\u4dbf]/;
const STATUS_FILE = "public/data/.kanji-progress.log";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const note = (line) => appendFile(STATUS_FILE, `${new Date().toISOString()} ${line}\n`, "utf8");

async function collectKanji() {
  const chars = new Set();
  for (const level of [1, 2, 3, 4, 5]) {
    const data = JSON.parse(await readFile(`public/data/jlpt-N${level}.json`, "utf8"));
    for (const word of data.words) {
      if (!word.kanji) continue;
      for (const ch of word.kanji) if (KANJI_RE.test(ch)) chars.add(ch);
    }
  }
  return [...chars];
}

async function resolve(ch, attempt = 1) {
  const url = `https://hanja.dict.naver.com/api3/ccko/search?query=${encodeURIComponent(ch)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Referer: "https://hanja.dict.naver.com/" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const items = json.searchResultMap?.searchResultListMap?.LETTER?.items ?? [];
    const exact = items.find((it) => it.matchType === "exact:entry") ?? items[0];
    return exact?.entryId ?? null;
  } catch (err) {
    if (attempt >= 4) {
      await note(`give up ${ch}: ${err.message}`);
      return null;
    }
    await sleep(600 * attempt);
    return resolve(ch, attempt + 1);
  }
}

const chars = await collectKanji();
await note(`start: ${chars.length} unique kanji`);

const map = {};
let missing = 0;
for (let i = 0; i < chars.length; i++) {
  const id = await resolve(chars[i]);
  if (id) map[chars[i]] = id;
  else missing++;
  if ((i + 1) % 200 === 0) await note(`${i + 1}/${chars.length} (missing ${missing})`);
  await sleep(DELAY_MS);
}

await writeFile("public/data/kanji-entries.json", JSON.stringify(map), "utf8");
await note(`DONE: ${Object.keys(map).length} resolved, ${missing} missing`);
console.log(`DONE: ${Object.keys(map).length} resolved, ${missing} missing`);
