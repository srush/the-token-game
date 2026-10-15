import { levels } from './levels.js';
import { hardLevels } from './hard-levels.js';
import { solution } from './engine.js';

// Start from a valid difficulty template, then alter the board while keeping
// the entire sequence unambiguous. Bounded work avoids long rejection loops.
export function generateLevel(index, seed, mode = 'easy') {
  if (!Number.isSafeInteger(index) || index < 0) throw new Error('Invalid level');
  const templates = mode === 'hard' && index !== 0 ? hardLevels : levels;
  const template = templates[Math.min(index, templates.length - 1)];
  let state = seed >>> 0;
  const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const pick = n => Math.floor(random() * n);
  const colors = index === 0 ? 2 : index < 3 ? 3 : 4;
  let rows = template.rows.map(row => [...row]);
  for (let attempt = 0; attempt < 64; attempt++) {
    const candidate = rows.map(row => [...row]);
    const r = pick(rows.length), c = pick(rows[r].length);
    if (random() < .7) candidate[r][c] = pick(colors);
    else {
      const r2 = pick(rows.length), c2 = pick(rows[r2].length);
      [candidate[r][c], candidate[r2][c2]] = [candidate[r2][c2], candidate[r][c]];
    }
    const steps = solution({ ...template, rows:candidate });
    if (steps && steps[0].gap >= 3 && (index !== 0 || steps[0].key[0] !== steps[0].key[2])) rows = candidate;
  }
  const shuffle = values => {
    for (let i = values.length - 1; i > 0; i--) {
      const j = pick(i + 1);
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  };
  const palette = shuffle(Array.from({length:colors}, (_, i) => i));
  rows = shuffle(rows).map(row => row.map(color => palette[color]));
  return { ...template, id:index, rows };
}
