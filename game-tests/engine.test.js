import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBoard, frequencies, winner, mergePair, solution, replay, scoreRun, pairKey } from '../game/engine.js';
import { levels } from '../game/levels.js';

export function solve(level) {
  let board = makeBoard(level.rows);
  const moves = [];
  for (let round = 0; round < level.rounds; round++) {
    const best = winner(board);
    let position;
    board.forEach((row,r) => row.forEach((token,c) => { if (!position && row[c+1] && pairKey(token,row[c+1]) === best.key) position = [r,c]; }));
    moves.push(position); board = mergePair(board,best.key).board;
  }
  return moves;
}
const leaves = token => token.children.length ? token.children.flatMap(leaves) : token.colors;

test('all 12 levels have a unique winner at every offered step and an opening lead of at least three', () => {
  assert.equal(levels.length,12);
  for (const level of levels) {
    const steps = solution(level);
    assert.equal(steps.length,level.rounds);
    assert.ok(steps[0].gap >= 3);
    assert.ok(steps.every(step => step.gap >= 1 && step.count >= 2));
    const result = replay(level,solve(level));
    assert.ok(result.complete);
    assert.equal(result.mistakes,0);
    result.board.forEach((row,i) => assert.deepEqual(row.flatMap(leaves),level.rows[i]));
    assert.equal(result.merges,level.rows.flat().length - result.board.flat().length);
  }
});
test('counts overlapping bigrams but merges left to right without sharing a dot', () => {
  const board = makeBoard([[0,0,0,0,0],[1,2]]);
  assert.equal(winner(board).count,4);
  const result = mergePair(board,'0|0');
  assert.equal(result.merged.length,2);
  assert.deepEqual(result.board[0].map(t => t.colors),[[0,0],[0,0],[0]]);
});
test('pairs do not cross row boundaries; tied maxima are not a winner', () => {
  const board = makeBoard([[0,1],[0,1],[2,3],[2,3]]);
  assert.equal(winner(board),null);
  assert.deepEqual(frequencies(board).map(x => x.key),['0|1','2|3']);
});
test('wrong clicks are penalized and do not alter the board or valid replay', () => {
  const level = levels[1], solutionMoves = solve(level);
  const moves = [[0,level.rows[0].length-1],...solutionMoves];
  const result = replay(level,moves);
  assert.ok(result.complete); assert.equal(result.mistakes,1);
  assert.equal(scoreRun(10,1,12000,true),1545);
  assert.equal(scoreRun(0,5,10000,false),0);
  assert.throws(() => replay(level,[[100,0]]));
  assert.throws(() => replay(level,[...solutionMoves,[0,0]]));
});

test('timeout answer completes all remaining rules without changing the player board', async () => {
  const { completeAnswer } = await import('../game/engine.js');
  for (const level of levels) {
    const moves = solve(level);
    const partial = replay(level, moves.slice(0, 1));
    const snapshot = JSON.stringify(partial.board);
    const answer = completeAnswer(partial.board, level.rounds - 1);
    const completed = replay(level, moves);
    assert.deepEqual(answer.board, completed.board);
    assert.equal(JSON.stringify(partial.board), snapshot);
    assert.ok(answer.missing.size > 0);
    assert.equal(completeAnswer(completed.board, 0).missing.size, 0);
  }
});


test('random boards stay solvable with a clear opening and vary across attempts', async () => {
  const { generateLevel } = await import('../game/generator.js');
  for (let index = 0; index < levels.length; index++) {
    const unique = new Set();
    for (let seed = 1; seed <= 20; seed++) {
      const level = generateLevel(index, seed);
      const steps = solution(level);
      assert.equal(steps.length, level.rounds);
      assert.equal(level.rounds, index === 0 ? 2 : 5);
      assert.ok(level.rows.every(row => row.length === (index === 0 ? 6 : 7)));
      assert.ok(steps[0].gap >= 3);
      assert.ok(steps.every(step => step.gap > 0));
      assert.ok(replay(level, solve(level)).complete);
      unique.add(JSON.stringify(level.rows));
      assert.deepEqual(generateLevel(index, seed), level);
    }
    assert.ok(unique.size >= 18, `Level ${index} only produced ${unique.size} boards`);
  }
});


test('hard mode uses eight rows except for the small tutorial and preserves unique winners', async () => {
  const { generateLevel } = await import('../game/generator.js');
  for (let index = 0; index < levels.length; index++) {
    for (let seed = 1; seed <= 10; seed++) {
      const level = generateLevel(index, seed, 'hard');
      assert.equal(level.rows.length, index === 0 ? 3 : 8);
      const steps = solution(level);
      assert.equal(steps.length, level.rounds);
      assert.equal(level.rounds, index === 0 ? 2 : 5);
      assert.ok(level.rows.every(row => row.length === (index === 0 ? 6 : 7)));
      assert.ok(steps[0].gap >= 3);
      assert.ok(steps.every(step => step.gap > 0));
      assert.ok(replay(level, solve(level)).complete);
    }
  }
});


test('new boards continue beyond the original catalog in both modes', async () => {
  const { generateLevel } = await import('../game/generator.js');
  for (const mode of ['easy', 'hard']) {
    for (const index of [12, 13, 100, 10000]) {
      const level = generateLevel(index, index * 7231, mode);
      assert.equal(level.id, index);
      assert.ok(solution(level)[0].gap >= 3);
      assert.ok(replay(level, solve(level)).complete);
      if (mode === 'hard') assert.equal(level.rows.length, 8);
      assert.notDeepEqual(generateLevel(index, index * 7231 + 1, mode).rows, level.rows);
    }
  }
});
