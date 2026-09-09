import { pipeline } from "@huggingface/transformers";

// 1.5B crashed with a WASM OOM RuntimeError on the phones tested so far;
// 0.5B is roughly a third of the params/memory footprint.
const MODEL_ID = "onnx-community/Qwen2.5-0.5B-Instruct";

let generatorPromise = null;
let webgpuUsable = null; // cached tri-state: null = not probed yet

/** Sync presence check only — the API can exist but still fail to produce a real adapter. */
export function hasWebGPUApi() {
  return typeof navigator !== "undefined" && !!navigator.gpu;
}

/** Actually requests a GPU adapter to confirm WebGPU is usable, not just present. Cached. */
export async function detectWebGPU() {
  if (webgpuUsable !== null) return webgpuUsable;
  if (!hasWebGPUApi()) {
    webgpuUsable = false;
    return false;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    webgpuUsable = !!adapter;
  } catch {
    webgpuUsable = false;
  }
  return webgpuUsable;
}

/**
 * Lazily loads (and caches) the on-device text-generation pipeline.
 * Probes WebGPU first; if the adapter request or the pipeline load itself
 * fails (some phones expose navigator.gpu but can't actually get an
 * adapter), falls back to the WASM backend automatically.
 */
export function loadOnDeviceModel(onProgress) {
  if (generatorPromise) return generatorPromise;

  const load = async () => {
    const useWebGPU = await detectWebGPU();
    try {
      return await pipeline("text-generation", MODEL_ID, {
        device: useWebGPU ? "webgpu" : "wasm",
        // q4f16 (int4 weights + fp16 compute) is the combo transformers.js
        // documents as correct for the WebGPU backend; plain "q4" is for wasm.
        dtype: useWebGPU ? "q4f16" : "q4",
        progress_callback: onProgress,
      });
    } catch (err) {
      if (!useWebGPU) throw err;
      console.warn("WebGPU load failed, falling back to WASM:", err);
      webgpuUsable = false;
      return pipeline("text-generation", MODEL_ID, {
        device: "wasm",
        dtype: "q4",
        progress_callback: onProgress,
      });
    }
  };

  generatorPromise = load().catch((err) => {
    generatorPromise = null; // allow retrying on the next call instead of caching a rejection
    throw err;
  });
  return generatorPromise;
}

export function isOnDeviceModelLoaded() {
  return generatorPromise !== null;
}

function buildSystemPrompt(direction) {
  if (direction === "jp-ko") {
    return `너는 일본어-한국어 번역 및 일본어 학습 도우미야. 사용자가 일본어 문장을 주면 아래 형식을 반드시 그대로 지켜서 한국어로 답해:
[번역]
(자연스러운 한국어 번역 한두 줄)
[단어]
- 한자/단어(요미가나): 한국어 뜻
(핵심 단어 2~5개, 없으면 "- 없음")
[문법]
- 문법 포인트: 한국어로 간단 설명
(1~3개, 없으면 "- 없음")
형식 외의 다른 말은 절대 덧붙이지 마.`;
  }
  return `너는 한국어-일본어 번역 및 일본어 학습 도우미야. 사용자가 한국어 문장을 주면 아래 형식을 반드시 그대로 지켜서 답해:
[번역]
(자연스러운 일본어 번역. 모든 한자는 반드시 <ruby>한자<rt>よみがな</rt></ruby> 형식으로 표기)
[단어]
- 한자/단어(요미가나): 한국어 뜻
(핵심 단어 2~5개, 없으면 "- 없음")
[문법]
- 문법 포인트: 한국어로 간단 설명
(1~3개, 없으면 "- 없음")
형식 외의 다른 말은 절대 덧붙이지 마.`;
}

function buildMessages(direction, text) {
  return [
    { role: "system", content: buildSystemPrompt(direction) },
    { role: "user", content: text },
  ];
}

/** Splits the model's raw reply into translation / vocab / grammar sections. */
export function parseResponse(raw) {
  const clean = (raw ?? "").trim();
  const grab = (label, nextLabels) => {
    const stops = nextLabels.map((l) => `\\[${l}\\]`).join("|");
    const re = new RegExp(`\\[${label}\\]([\\s\\S]*?)(?=${stops || "$"}|$)`, "i");
    const m = clean.match(re);
    return m ? m[1].trim() : "";
  };
  const translation = grab("번역", ["단어", "문법"]);
  const vocabRaw = grab("단어", ["문법"]);
  const grammarRaw = grab("문법", []);
  const toList = (block) =>
    block
      .split("\n")
      .map((l) => l.replace(/^[-*]\s*/, "").trim())
      .filter((l) => l && l !== "없음");
  return {
    translation: translation || clean,
    vocab: toList(vocabRaw),
    grammar: toList(grammarRaw),
  };
}

async function runGeneration(generator, direction, text) {
  const messages = buildMessages(direction, text);
  const output = await generator(messages, { max_new_tokens: 512, do_sample: false });
  const reply = output[0].generated_text;
  const last = Array.isArray(reply) ? reply.at(-1) : null;
  const raw = last ? last.content : String(reply);
  return parseResponse(raw);
}

export async function translateOnDevice(direction, text, onProgress) {
  try {
    const generator = await loadOnDeviceModel(onProgress);
    return await runGeneration(generator, direction, text);
  } catch (err) {
    // A WebGPU failure can also surface only once real inference runs
    // (not just at pipeline-load time). Force WASM and retry once.
    if (webgpuUsable === false) throw err;
    console.warn("On-device generation failed, retrying on WASM:", err);
    webgpuUsable = false;
    generatorPromise = null;
    const generator = await loadOnDeviceModel(onProgress);
    return runGeneration(generator, direction, text);
  }
}

export async function translateGemini(direction, text, apiKey, model = "gemini-3.6-flash") {
  const system = buildSystemPrompt(direction);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text }] }],
      }),
    },
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini API 오류 (${res.status}): ${errText}`);
  }
  const data = await res.json();
  const raw = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  return parseResponse(raw);
}

/**
 * Unified entry point. `settings` = { engine: 'on-device' | 'gemini', geminiApiKey }
 */
export async function translate(direction, text, settings, onProgress) {
  if (settings.engine === "gemini") {
    if (!settings.geminiApiKey) {
      throw new Error("설정 탭에서 Gemini API 키를 먼저 입력해주세요.");
    }
    return translateGemini(direction, text, settings.geminiApiKey);
  }
  return translateOnDevice(direction, text, onProgress);
}
