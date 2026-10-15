import { levels } from '../game/levels.js';
import { generateLevel } from '../game/generator.js';
import { replay, scoreRun, VERSION } from '../game/engine.js';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function validateFinish(level, moves, elapsedMs) {
  const result = replay(level, moves);
  // Small network allowance; it never adds time bonus.
  const complete = result.complete && elapsedMs <= level.seconds * 1000 + 3000;
  return { score:scoreRun(result.merges, result.mistakes, level.seconds * 1000 - elapsedMs, complete), complete };
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const headers = { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'Vary':'Origin' };
    if (origin === env.ALLOWED_ORIGIN) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'Content-Type';
    }
    const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers});
    if (request.method === 'OPTIONS') return new Response(null, {status:204, headers});
    if (origin !== env.ALLOWED_ORIGIN) return json({error:'Origin not allowed'},403);
    const url = new URL(request.url), now = Date.now();
    try {
      if (request.method === 'GET' && url.pathname === '/scores') {
        const level = Number(url.searchParams.get('level'));
        if (!Number.isInteger(level) || !levels[level]) return json({error:'Invalid level'},400);
        const result = await env.DB.prepare('SELECT name, score FROM scores WHERE level = ? ORDER BY score DESC, created_at ASC LIMIT 20').bind(level).all();
        return json({scores:result.results});
      }
      if (request.method !== 'POST' || !['/start','/finish','/publish'].includes(url.pathname)) return json({error:'Not found'},404);
      if (Number(request.headers.get('Content-Length')) > 16384) return json({error:'Request too large'},413);
      const raw = await request.text();
      if (raw.length > 16384) return json({error:'Request too large'},413);
      let body;
      try { body = JSON.parse(raw); } catch { return json({error:'Invalid JSON'},400); }
      if (!body || typeof body !== 'object') return json({error:'Invalid body'},400);
      if (url.pathname === '/start') {
        const level = body.level;
        if (!Number.isInteger(level) || level < 1 || !levels[level] || body.version !== VERSION || !UUID.test(body.player)) return json({error:'Invalid level or game version'},400);
        const ip = request.headers.get('CF-Connecting-IP') || 'local';
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
        const ipHash = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2,'0')).join('');
        const runId = crypto.randomUUID();
        const puzzle = generateLevel(level, crypto.getRandomValues(new Uint32Array(1))[0]);
        const started = Date.now();
        const result = await env.DB.prepare('INSERT INTO runs (id, player, level, ip_hash, started_at, definition) SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM runs WHERE ip_hash = ? AND started_at > ?) < 60').bind(runId,body.player,level,ipHash,started,JSON.stringify(puzzle),ipHash,now - 3600000).run();
        if (!result.meta.changes) return json({error:'Too many runs; try again later'},429);
        await env.DB.prepare('DELETE FROM runs WHERE started_at < ?').bind(now - 86400000).run();
        return json({runId, puzzle});
      }
      if (!UUID.test(body.runId)) return json({error:'Invalid run'},400);
      const run = await env.DB.prepare('SELECT * FROM runs WHERE id = ?').bind(body.runId).first();
      if (!run) return json({error:'Run expired'},404);
      if (url.pathname === '/finish') {
        if (run.finished_at !== null) return json({score:run.score,complete:Boolean(run.complete)});
        let result;
        try { result = validateFinish(JSON.parse(run.definition),body.moves,now - run.started_at); }
        catch { return json({error:'Invalid replay'},400); }
        await env.DB.prepare('UPDATE runs SET finished_at = ?, score = ?, complete = ? WHERE id = ? AND finished_at IS NULL').bind(now,result.score,Number(result.complete),run.id).run();
        const saved = await env.DB.prepare('SELECT score, complete FROM runs WHERE id = ?').bind(run.id).first();
        return json({score:saved.score,complete:Boolean(saved.complete)});
      }
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (name.length < 1 || name.length > 18 || /[\x00-\x1f\x7f<>]/.test(name)) return json({error:'Use a name of 1–18 characters without angle brackets'},400);
      if (run.finished_at === null || !run.complete) return json({error:'Finish the level before posting'},400);
      // Atomic claim: publishing the same run twice cannot rewrite its name or score.
      await env.DB.batch([
        env.DB.prepare('INSERT INTO scores (player, level, name, score, created_at) SELECT player, level, ?, score, ? FROM runs WHERE id = ? AND published = 0 ON CONFLICT(player, level) DO UPDATE SET name = excluded.name, score = excluded.score, created_at = excluded.created_at WHERE excluded.score > scores.score').bind(name,now,run.id),
        env.DB.prepare('UPDATE runs SET published = 1 WHERE id = ?').bind(run.id),
      ]);
      return json({ok:true});
    } catch {
      return json({error:'Leaderboard temporarily unavailable'},503);
    }
  }
};
