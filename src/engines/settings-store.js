const STORAGE_KEY = "jp-ko-app:settings";

const defaults = {
  // Qwen2.5-1.5B crashed (WASM OOM) on-device on the phones tested so far,
  // so Gemini is the default/primary engine for now; on-device stays as an
  // opt-in experiment for lighter models / more capable devices later.
  engine: "gemini", // 'on-device' | 'gemini'
  geminiApiKey: "",
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export async function getCacheUsageMB() {
  if (!navigator.storage?.estimate) return null;
  const { usage } = await navigator.storage.estimate();
  return usage ? Math.round(usage / (1024 * 1024)) : 0;
}

export async function clearModelCache() {
  const keys = await caches.keys();
  await Promise.all(
    keys.filter((k) => k.startsWith("transformers-cache")).map((k) => caches.delete(k)),
  );
}
