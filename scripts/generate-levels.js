import { writeFileSync } from 'node:fs';
import { solution } from '../game/engine.js';
let state = 181230;
const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const levels = [];
for (let index = 0; index < 12; index++) {
  const colors = index === 0 ? 2 : index < 3 ? 3 : 4;
  const rowCount = index === 0 ? 3 : index < 5 ? 4 : index < 7 ? 5 : 7;
  const width = index === 0 ? 6 : 7;
  const rounds = index === 0 ? 2 : 5;
  let found;
  for (let attempt = 0; attempt < 1000000; attempt++) {
    const rows = Array.from({ length: rowCount }, () => Array.from({ length: width }, () => Math.floor(random() ** 3 * colors)));
    const level = { id: index, rows, rounds, seconds: index === 0 ? 90 : Math.max(40, 70 - index * 2) };
    const steps = solution(level);
    // Avoid an overlapping same-color opening in the tutorial.
    if (steps && steps[0].gap >= 3 && (index !== 0 || steps[0].key[0] !== steps[0].key[2])) { found = level; break; }
  }
  if (!found) throw new Error(`No valid level ${index}`);
  levels.push(found);
}
writeFileSync(new URL('../game/levels.js', import.meta.url), `// Generated deterministically; every offered move has one most-common pair.\nexport const levels = ${JSON.stringify(levels, null, 2)};\n`);
console.log('Generated', levels.length, 'validated levels');
