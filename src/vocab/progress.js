const key = (level) => `jlpt:studied:N${level}`;

export function getStudiedIds(level) {
  try {
    const raw = localStorage.getItem(key(level));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function addStudied(level, ids) {
  const set = getStudiedIds(level);
  for (const id of ids) set.add(id);
  try {
    localStorage.setItem(key(level), JSON.stringify([...set]));
  } catch {
    /* storage full or blocked — progress just won't persist */
  }
}

export function clearStudied(level) {
  localStorage.removeItem(key(level));
}
