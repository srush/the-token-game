import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker, { validateFinish } from '../leaderboard/worker.js';
import { levels } from '../game/levels.js';
import { makeBoard, winner, pairKey, mergePair, VERSION } from '../game/engine.js';
function movesFor(level) {
  let board=makeBoard(level.rows); const moves=[];
  for(let i=0;i<level.rounds;i++) {
    const key=winner(board).key;
    const r=board.findIndex(row=>row.some((t,c)=>row[c+1]&&pairKey(t,row[c+1])===key));
    const c=board[r].findIndex((t,c)=>board[r][c+1]&&pairKey(t,board[r][c+1])===key);
    moves.push([r,c]); board=mergePair(board,key).board;
  }
  return moves;
}
function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../leaderboard/schema.sql',import.meta.url),'utf8'));
  return {sql,prepare(query) {let args=[]; const stmt=sql.prepare(query); return { bind(...a){args=a;return this;}, async first(){return stmt.get(...args)??null;}, async all(){return {results:stmt.all(...args)};},async run(){return {meta:{changes:Number(stmt.run(...args).changes)}};} };},async batch(statements){sql.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
}
const origin='https://game.example';
const request=(path,body,from=origin)=>new Request('https://scores.example'+path,{method:body?'POST':'GET',headers:{Origin:from,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
test('leaderboard validates moves, derives scores, and stores only one best score per player',async()=>{
  const DB=database(), env={DB,ALLOWED_ORIGIN:origin};
  const call=async(path,body)=>{const r=await worker.fetch(request(path,body),env);return {status:r.status,...await r.json()};};
  const player=crypto.randomUUID();
  const run=await call('/start',{level:1,version:VERSION,player});
  assert.equal(run.status,200);
  const invalid=await call('/finish',{runId:run.runId,moves:[[999,0]],score:9999999});
  assert.equal(invalid.status,400);
  const finish=await call('/finish',{runId:run.runId,moves:movesFor(run.puzzle),score:9999999});
  assert.equal(finish.status,200); assert.ok(finish.complete); assert.ok(finish.score<10000);
  assert.equal((await call('/publish',{runId:run.runId,name:'Ada'})).status,200);
  await call('/publish',{runId:run.runId,name:'Different'});
  const board=await call('/scores?level=1');
  assert.equal(board.scores.length,1);assert.equal(board.scores[0].name,'Ada');assert.equal(board.scores[0].score,finish.score);
  const second=await call('/start',{level:1,version:VERSION,player});
  DB.sql.prepare('UPDATE runs SET started_at = started_at - 20000, definition = ? WHERE id = ?').run(JSON.stringify(run.puzzle), second.runId);
  await call('/finish',{runId:second.runId,moves:movesFor(run.puzzle)});
  await call('/publish',{runId:second.runId,name:'Lower'});
  assert.equal((await call('/scores?level=1')).scores[0].name,'Ada');
  assert.equal((await worker.fetch(request('/scores?level=1',null,'https://wrong.example'),env)).status,403);
  DB.sql.close();
});
test('late or incomplete runs cannot receive a completion or time bonus',()=>{
  const level=levels[1];
  const valid=validateFinish(level,movesFor(level),10000);
  const late=validateFinish(level,movesFor(level),level.seconds*1000+4000);
  assert.ok(valid.complete);assert.equal(late.complete,false);assert.ok(late.score<valid.score);
  const partial=validateFinish(level,[],1000);assert.deepEqual(partial,{score:0,complete:false});
});
