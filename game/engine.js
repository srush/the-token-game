export const COLORS = ['coral', 'blue', 'gold', 'mint'];
export const VERSION = '2';
export const pairKey = (a, b) => `${a.key}|${b.key}`;
export function makeBoard(rows) {
  let id = 0;
  return rows.map(row => row.map(color => ({ id: id++, key: String(color), colors: [color], children: [] })));
}
export function frequencies(board) {
  const counts = new Map();
  for (const row of board) for (let i = 0; i < row.length - 1; i++) {
    const key = pairKey(row[i], row[i + 1]);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}
export function winner(board) {
  const counts = frequencies(board);
  return counts[0] && counts[0].count >= 2 && counts[0].count > (counts[1]?.count || 0) ? counts[0] : null;
}
export function mergePair(board, key) {
  let id = Math.max(...board.flat().map(token => token.id)) + 1;
  const merged = [];
  const rows = board.map(row => {
    const next = [];
    for (let i = 0; i < row.length; i++) {
      if (i + 1 < row.length && pairKey(row[i], row[i + 1]) === key) {
        const a = row[i], b = row[++i];
        const token = { id: id++, key: a.key + b.key, colors: [...a.colors, ...b.colors], children: [a, b] };
        next.push(token);
        merged.push(token);
      } else next.push(row[i]);
    }
    return next;
  });
  return { board: rows, merged };
}
export function solution(level) {
  let board = makeBoard(level.rows);
  const steps = [];
  for (let i = 0; i < level.rounds; i++) {
    const best = winner(board);
    if (!best) return null;
    const result = mergePair(board, best.key);
    steps.push({ ...best, gap: best.count - (frequencies(board)[1]?.count || 0), merges: result.merged.length });
    board = result.board;
  }
  return steps;
}
export function scoreRun(merges, mistakes, remainingMs, complete) {
  return Math.max(0, merges * 100 - mistakes * 75 + (complete ? 500 + Math.floor(Math.max(0, remainingMs) / 1000) * 10 : 0));
}
// Replays every submitted click. Scores are derived, never accepted from a client.
export function replay(level, moves) {
  if (!Array.isArray(moves) || moves.length > 250) throw new Error('Invalid moves');
  let board = makeBoard(level.rows), rounds = 0, merges = 0, mistakes = 0;
  for (const move of moves) {
    if (rounds === level.rounds || !Array.isArray(move) || move.length !== 2) throw new Error('Invalid move');
    const [r, c] = move;
    if (!Number.isInteger(r) || !Number.isInteger(c) || !board[r]?.[c]) throw new Error('Invalid position');
    const row = board[r], best = winner(board);
    const key = row[c + 1] ? pairKey(row[c], row[c + 1]) : '';
    if (!best || key !== best.key) { mistakes++; continue; }
    const result = mergePair(board, key);
    board = result.board; merges += result.merged.length; rounds++;
  }
  return { board, rounds, merges, mistakes, complete: rounds === level.rounds };
}

// Complete only the remaining level rules, without changing the player's board.
export function completeAnswer(board, roundsLeft) {
  let answer = board;
  const missing = new Set();
  for (let i = 0; i < roundsLeft; i++) {
    const best = winner(answer);
    if (!best) throw new Error('Level has no unique next answer');
    const result = mergePair(answer, best.key);
    result.merged.forEach(token => missing.add(token.key));
    answer = result.board;
  }
  return { board: answer, missing };
}
