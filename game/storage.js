export function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(`token-game:${key}`)) ?? fallback; } catch { return fallback; }
}
export function write(key, value) {
  try { localStorage.setItem(`token-game:${key}`, JSON.stringify(value)); } catch { /* Private browsing may disable storage. */ }
}
export function localScore(entry) {
  const scores = read('scores', []);
  const next = scores.filter(s => s.id !== entry.id);
  next.push(entry);
  write('scores', next.sort((a, b) => b.score - a.score).slice(0, 100));
}
