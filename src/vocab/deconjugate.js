// Subtitles show conjugated forms (吹いている) but the dictionary only stores
// plain forms (吹く). This walks a word back toward its plain form well enough
// for everyday dialogue — it is a heuristic, not a morphological analyser.

// Auxiliary tails, longest first so "ていました" is stripped before "ます".
const AUXILIARIES = [
  "ていました", "ていません", "てしまった", "てしまう", "ちゃった",
  "ています", "ていた", "ている", "ておいた", "ておく", "てあった", "てある",
  "ていく", "てきた", "てくる", "てみた", "てみる", "てた", "てる", "てます",
  "でいました", "でいません", "でしまった", "でしまう", "じゃった",
  "でいます", "でいた", "でいる", "でおいた", "でおく", "であった",
  "でいく", "できた", "でくる", "でみた", "でみる", "でた", "でる", "でます",
  "ませんでした", "ましょう", "ました", "ません", "まして", "ます",
  "させられる", "られました", "させる", "させた", "られる", "られた", "れる", "れた",
  "なかった", "なくて", "ない", "なく", "ず",
  "たかった", "たくない", "たい", "たく",
  "すぎる", "すぎた", "ながら", "そうだ", "そう",
];

// て/た forms back to the plain ending (euphonic changes).
const TE_TA_RULES = [
  ["いて", ["く"]],
  ["いで", ["ぐ"]],
  ["して", ["す"]],
  ["って", ["う", "つ", "る"]],
  ["んで", ["ぬ", "ぶ", "む"]],
  ["いた", ["く"]],
  ["いだ", ["ぐ"]],
  ["した", ["す"]],
  ["った", ["う", "つ", "る"]],
  ["んだ", ["ぬ", "ぶ", "む"]],
];

// masu-stem (い row) back to the dictionary ending (う row): のみ -> のむ
const I_TO_U = {
  き: "く", ぎ: "ぐ", し: "す", ち: "つ", に: "ぬ",
  ひ: "ふ", び: "ぶ", み: "む", り: "る", い: "う",
};

function stripAuxiliaries(word) {
  const stems = [];
  let current = word;
  for (let round = 0; round < 4; round++) {
    const hit = AUXILIARIES.find((aux) => current.length > aux.length && current.endsWith(aux));
    if (!hit) break;
    current = current.slice(0, -hit.length);
    // ている strips the て too, but the te-form is what reveals the plain
    // form (ふいて -> ふく). It goes first because reversing the te-form is
    // far more reliable than guessing from the bare stem (ふい -> ふう).
    if (hit.startsWith("て") || hit.startsWith("で")) stems.push(current + hit[0]);
    stems.push(current);
  }
  return stems;
}

function plainForms(stem) {
  const forms = [];

  for (const [tail, endings] of TE_TA_RULES) {
    if (stem.length > tail.length && stem.endsWith(tail)) {
      const base = stem.slice(0, -tail.length);
      for (const ending of endings) forms.push(base + ending);
    }
  }

  // bare て/た after a stem is the ichidan pattern: たべて -> たべる
  if (stem.length > 1 && /[てた]$/.test(stem)) forms.push(`${stem.slice(0, -1)}る`);

  // i-adjective adverbial form: 高く(ない) -> 高い
  if (stem.length > 1 && stem.endsWith("く")) forms.push(`${stem.slice(0, -1)}い`);

  // leftover masu-stem: たべ -> たべる, のみ -> のむ
  if (stem.length > 1) {
    forms.push(`${stem}る`);
    const last = stem.at(-1);
    if (I_TO_U[last]) forms.push(stem.slice(0, -1) + I_TO_U[last]);
  }

  return forms;
}

/**
 * Ordered dictionary-form guesses for a (possibly conjugated) word,
 * most likely first. Always starts with the word exactly as typed.
 */
export function candidateForms(word) {
  const query = String(word ?? "").trim();
  if (!query) return [];

  const candidates = [query];
  const stems = [query, ...stripAuxiliaries(query)];

  for (const stem of stems) {
    for (const form of plainForms(stem)) candidates.push(form);
  }
  // a stripped stem can itself be the word (e.g. 元気 from 元気です)
  for (const stem of stems.slice(1)) candidates.push(stem);

  return [...new Set(candidates)].filter(Boolean);
}
