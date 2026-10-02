const KEY = "jlpt:batches";
const MAX_BATCHES = 200;

export function loadBatches() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Records one [새 단어] draw so it can be reviewed later. Newest first. */
export function saveBatch(level, words) {
  const batch = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    at: new Date().toISOString(),
    wordIds: words.map((w) => w.id),
  };
  const list = [batch, ...loadBatches()].slice(0, MAX_BATCHES);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full — the draw itself still works, it just isn't recorded */
  }
  return batch;
}

export function deleteBatch(id) {
  const list = loadBatches().filter((b) => b.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function clearBatches() {
  localStorage.removeItem(KEY);
}

export function formatBatchTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
