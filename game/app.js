import { COLORS, makeBoard, pairKey, winner, mergePair, scoreRun, completeAnswer } from './engine.js';
import { generateLevel } from './generator.js';
import { read, write, localScore } from './storage.js';

const $ = selector => document.querySelector(selector);
const app = $('#app');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const icons = {
  cup: '<path d="M8 4h8v6a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 2v5m-4 1h8"/>',
  sound: '<path d="m11 5-5 4H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="m11 5-5 4H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  retry: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const dots = colors => colors.map(c => `<i class="dot ${COLORS[c]}"></i>`).join('');
const label = colors => colors.map(c => COLORS[c]).join(' ');
let sound = read('sound', false), audio, state;
let mode = read('mode', 'easy') === 'hard' ? 'hard' : 'easy';

function announce(text) { $('#announcer').textContent = text; }
function tone(success) {
  if (!sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    [0, .07, .14].slice(0, success ? 3 : 1).forEach((delay, i) => {
      const osc = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime + delay;
      osc.frequency.value = success ? [523.25, 659.25, 783.99][i] : 155;
      gain.gain.setValueAtTime(.0001, t);
      gain.gain.exponentialRampToValueAtTime(.055, t + .01);
      gain.gain.exponentialRampToValueAtTime(.0001, t + .16);
      osc.connect(gain); gain.connect(audio.destination); osc.start(t); osc.stop(t + .18);
    });
  } catch { /* Sound is optional. */ }
}
function header() {
  return `<header class="topbar"><button class="brand home-button" data-action="home" aria-label="Home, choose difficulty"><span class="brand-mark">${dots([0, 1, 2, 3])}</span></button><div class="top-actions"><button class="icon-button" data-action="sound" aria-label="${sound ? 'Mute' : 'Enable'} sound" aria-pressed="${sound}">${icon(sound ? 'sound' : 'muted')}</button><button class="icon-button" data-action="leaderboard" aria-label="Leaderboard">${icon('cup')}</button></div></header>`;
}
function gridPreview(rows) {
  const pattern = [0, 1, 2, 0, 1, 3, 2, 1, 3, 0, 1, 1, 2, 3, 0, 2, 1, 2, 0, 3, 0, 1, 3, 2, 2, 0, 3, 1, 0, 2, 1, 3];
  return `<span class="grid-preview" aria-hidden="true">${Array.from({length:rows * 4}, (_, i) => dots([pattern[(i * 7 + Math.floor(i / 4)) % pattern.length]])).join('')}</span>`;
}
function showHome() {
  if (state) state.done = true;
  state = null;
  document.querySelectorAll('.finish-fireworks, .spark').forEach(el => el.remove());
  app.innerHTML = `${header()}<section class="home-screen"><div class="home-dots" aria-hidden="true">${dots([0,1,2,3])}</div><h1>The Token Game</h1><div class="mode-choices"><button class="mode-choice" data-mode="easy" aria-label="Play with a smaller grid">${gridPreview(4)}</button><button class="mode-choice" data-mode="hard" aria-label="Play with eight rows">${gridPreview(8)}</button></div></section>`;
  window.scrollTo(0, 0);
}
function remaining() { return state.deadline === null ? state.level.seconds * 1000 : Math.max(0, state.deadline - performance.now()); }
function currentScore() { return scoreRun(state.merges, state.mistakes, 0, false); }
function renderPlay() {
  app.innerHTML = `${header()}${state.level.id === 0 ? '<p class="tutorial-intro">This is a game about <a href="https://en.wikipedia.org/wiki/Byte-pair_encoding" target="_blank" rel="noopener noreferrer">tokenization</a>.<br>Click the most common tile pair.</p>' : ''}<section class="play-screen"><div class="hud"><div></div><div class="score-stat"><div id="score" aria-label="Score">0</div></div></div><div class="timer-track" role="progressbar" aria-label="Time left" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><div id="timer-fill"></div></div><div id="board" class="board" role="group" aria-label="Token board; tap the first tile of the most common pair. Pairs run left to right within each row."></div><div id="merge-countdown" class="merge-countdown" role="img" aria-label="${state.level.rounds} merges remaining">${Array.from({ length: state.level.rounds }, () => '<span class="remaining-dot" aria-hidden="true"></span>').join('')}</div>${state.level.id === 0 ? '<button class="text-button skip-tutorial" data-action="skip-tutorial">Skip tutorial</button>' : ''}</section>`;
  renderBoard();
}
function renderBoard(merged = []) {
  const tutorial = state.level.id === 0 && state.round === 0 && state.mistakes === 0;
  const best = winner(state.board);
  $('#board').innerHTML = state.board.map((row, r) => `<div class="board-row" style="--columns:${state.level.rows[r].length}">${row.map((token, c) => {
    const hint = tutorial && row[c + 1] && pairKey(token, row[c + 1]) === best.key;
    const partner = tutorial && c > 0 && pairKey(row[c - 1], token) === best.key;
    return `<button class="token ${hint ? 'hint-first' : ''} ${partner ? 'hint-second' : ''} ${merged.includes(token.id) ? 'born' : ''}" data-row="${r}" data-col="${c}" data-id="${token.id}" style="--span:${token.colors.length}" aria-label="Row ${r + 1}, tile ${c + 1}: ${label(token.colors)}; merge with next tile">${dots(token.colors)}${hint ? '<span class="tap-indicator" aria-hidden="true"></span>' : ''}</button>`;
  }).join('')}</div>`).join('');
}
function burst(element) {
  if (reduced) return;
  const rect = element.getBoundingClientRect();
  for (let i = 0; i < 5; i++) {
    const spark = document.createElement('i'); spark.className = `spark ${COLORS[i % 4]}`;
    spark.style.cssText = `left:${rect.left + rect.width / 2}px;top:${rect.top + rect.height / 2}px;--dx:${Math.cos(i * 2.4) * 25}px;--dy:${Math.sin(i * 2.4) * 23 - 8}px;--spin:${i * 70}deg`;
    document.body.append(spark); spark.addEventListener('animationend', () => spark.remove(), {once:true});
  }
}
function celebrateFinish() {
  if (reduced) return;
  const fireworks = document.createElement('div');
  fireworks.className = 'finish-fireworks';
  fireworks.setAttribute('aria-hidden', 'true');
  const spread = Math.min(window.innerWidth * .45, 260);
  for (let i = 0; i < 64; i++) {
    const spark = document.createElement('i');
    spark.className = `finish-spark ${COLORS[i % 4]}`;
    const angle = Math.random() * Math.PI * 2;
    const radius = .4 + Math.random() * .6;
    spark.style.cssText = `--dx:${Math.cos(angle) * spread * radius}px;--dy:${Math.sin(angle) * 220 * radius - 90}px;--fall:${140 + Math.random() * 130}px;--spin:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * .18}s`;
    fireworks.append(spark);
  }
  document.body.append(fireworks);
  setTimeout(() => fireworks.remove(), 1700);
}
async function choose(r, c) {
  const s = state;
  if (s.done || s.busy || !s.board[r]?.[c]) return;
  if (s.deadline === null) s.deadline = performance.now() + s.level.seconds * 1000;
  if (remaining() <= 0) { finish(false); return; }
  s.moves.push([r, c]);
  const row = s.board[r], best = winner(s.board);
  const key = row[c + 1] ? pairKey(row[c], row[c + 1]) : '';
  if (key !== best?.key) {
    s.mistakes++;
    document.querySelectorAll('.hint-first, .hint-second').forEach(el => el.classList.remove('hint-first', 'hint-second'));
    document.querySelectorAll('.tap-indicator').forEach(el => el.remove());
    let correct;
    s.board.forEach(tokens => tokens.forEach((token, ci) => {
      if (tokens[ci + 1] && pairKey(token, tokens[ci + 1]) === best.key) {
        correct ||= [token.colors, tokens[ci + 1].colors];
      }
    }));
    s.errors.push({ chosen: row.slice(c, c + 2).map(token => token.colors), correct });
    const wrongTiles = new Set();
    if (key) {
      s.board.forEach((tokens, ri) => tokens.forEach((token, ci) => {
        if (tokens[ci + 1] && pairKey(token, tokens[ci + 1]) === key) {
          [ci, ci + 1].forEach(index => wrongTiles.add($(`[data-row="${ri}"][data-col="${index}"]`)));
        }
      }));
    } else {
      // A row-end click has no pair to match elsewhere.
      wrongTiles.add($(`[data-row="${r}"][data-col="${c}"]`));
    }
    document.querySelectorAll('.wrong').forEach(el => el.classList.remove('wrong'));
    void $('#board').offsetWidth;
    wrongTiles.forEach(el => el?.classList.add('wrong'));
    announce('Incorrect pair. Minus 75 points.');
    $('#score').textContent = currentScore().toLocaleString();
    tone(false); return;
  }
  s.busy = true;
  const result = mergePair(s.board, key);
  for (const token of result.merged) for (const child of token.children) $(`[data-id="${child.id}"]`)?.classList.add('joining');
  tone(true);
  await new Promise(resolve => setTimeout(resolve, reduced ? 0 : 180));
  if (state !== s || s.done) return;
  s.board = result.board; s.round++; s.merges += result.merged.length;
  renderBoard(result.merged.map(t => t.id));
  const countdown = $('#merge-countdown');
  countdown.setAttribute('aria-label', `${s.level.rounds - s.round} merges remaining`);
  [...countdown.children].forEach((dot, index) => dot.classList.toggle('spent', index < s.round));
  result.merged.forEach(token => burst($(`[data-id="${token.id}"]`)));
  $('#score').textContent = currentScore().toLocaleString();
  $('#score').classList.remove('score-pop'); void $('#score').offsetWidth; $('#score').classList.add('score-pop');
  announce(`${result.merged.length} pairs merged. ${s.level.rounds - s.round} rules remaining.`);
  s.busy = false;
  if (s.round === s.level.rounds) finish(true);
  else $(`[data-row="${r}"][data-col="${Math.min(c, s.board[r].length - 1)}"]`)?.focus({preventScroll:true});
}
function treeSVG(token, missing = new Set()) {
  const depthOf = node => node.children.length ? 1 + Math.max(...node.children.map(depthOf)) : 0;
  const depth = depthOf(token);
  const width = token.colors.length * 36 + 24;
  const height = depth * 58 + 48;
  let edges = '', nodes = '';
  function draw(node, left) {
    const x = left + node.colors.length * 18;
    const y = 24 + (depth - depthOf(node)) * 58;
    let childLeft = left;
    for (const child of node.children) {
      const point = draw(child, childLeft);
      edges += `<path d="M${x},${y + 14} V${y + 29} H${point.x} V${point.y - 14}"/>`;
      childLeft += child.colors.length * 36;
    }
    const tileWidth = node.colors.length * 16 + 14;
    nodes += `<rect class="${missing.has(node.key) ? 'missing-merge' : ''}" x="${x - tileWidth / 2}" y="${y - 14}" width="${tileWidth}" height="28" rx="7"/>`;
    nodes += node.colors.map((color, i) => `<circle class="fill-${COLORS[color]}" cx="${x + (i - (node.colors.length - 1) / 2) * 16}" cy="${y}" r="5.5"/>`).join('');
    return { x, y };
  }
  draw(token, 12);
  return `<svg class="tree token-derivation" viewBox="0 0 ${width} ${height}" style="width:${width}px" role="img" aria-label="Derivation of final token ${label(token.colors)}: each parent is made by merging its two children."><g class="tree-edges">${edges}</g><g class="tree-nodes">${nodes}</g></svg>`;
}
function finalTokenTrees(board, missing) {
  // Display the learned vocabulary's final token types, not corpus positions.
  const tokens = [...new Map(board.flat().map(token => [token.key, token])).values()];
  return tokens.map(token => treeSVG(token, missing)).join('');
}

function finish(complete) {
  if (state.done) return;
  const s = state;
  s.done = true; s.complete = complete; s.remainingMs = remaining();
  if (complete) celebrateFinish();
  else {
    $('.play-screen')?.classList.add('level-failed');
    tone(false);
    announce('Time is up.');
  }
  s.score = scoreRun(s.merges, s.mistakes, s.remainingMs, complete);
  s.answer = completeAnswer(s.board, s.level.rounds - s.round);
  s.entryId = crypto.randomUUID();
  localScore({id:s.entryId, mode, level:s.level.id, score:s.score, complete, date:Date.now()});
  setTimeout(() => {
    if (state !== s) return;
    if (s.level.id === 0) showHome();
    else renderResult();
  }, reduced ? 0 : complete ? 650 : 850);
}
function mistakeReview(errors) {
  if (!errors.length) return '';
  const pair = tokens => tokens.map(colors => `<span class="mini-token">${dots(colors)}</span>`).join('');
  return `<div class="mistake-review" aria-label="Incorrect choices and their correct answers">${errors.map(error => `<div class="mistake-row"><span class="review-pair incorrect" aria-label="Incorrect: ${error.chosen.map(label).join(' then ')}">${icon('close')}${pair(error.chosen)}</span><span class="review-arrow">${icon('arrow')}</span><span class="review-pair correct" aria-label="Correct: ${error.correct.map(label).join(' then ')}">${icon('check')}${pair(error.correct)}</span></div>`).join('')}</div>`;
}
function renderResult() {
  const s = state;
  app.innerHTML = `${header()}<section class="results ${s.complete ? '' : 'failed-result'}"><div class="hud"><div><div class="result-time-bar"><div style="width:${s.remainingMs / (s.level.seconds * 1000) * 100}%"></div></div></div><div class="score-stat"><div class="result-score" aria-label="Score">${s.score.toLocaleString()}</div></div></div>${s.complete ? '' : `<div class="failure-mark" role="img" aria-label="Level not completed">${icon('close')}</div>`}<section class="tree-section" aria-label="Derivations of the final token types"><div class="tree-forest">${finalTokenTrees(s.answer.board, s.answer.missing)}</div></section>${mistakeReview(s.errors)}<div class="result-actions"><button class="primary" data-action="next" aria-label="New level">${icon('arrow')}</button></div></section>`;
  window.scrollTo({top:0, behavior:reduced ? 'instant' : 'smooth'});
  announce(s.complete ? `Level complete. ${s.score} points.` : `Time is up. ${s.score} points. The completed answer is shown. Green outlines mark merges you did not finish.`);
}
function start(index) {
  document.querySelectorAll('.finish-fireworks').forEach(el => el.remove());
  if (state) state.done = true;
  const level = generateLevel(index, crypto.getRandomValues(new Uint32Array(1))[0], mode);
  state = {level, board:makeBoard(level.rows), round:0, merges:0, mistakes:0, moves:[], errors:[], deadline:null, done:false, busy:false};
  if (index > 0) state.deadline = performance.now() + level.seconds * 1000;
  renderPlay(); window.scrollTo(0, 0);
}
function showLeaderboard() {
  const dialog = $('#leaderboard');
  dialog.innerHTML = `<div class="dialog-heading"><div><span class="eyebrow">ON THIS DEVICE</span><h2>Your scores</h2><span class="leader-mode">${mode === 'hard' ? 'Hard' : 'Easy'}</span></div><button class="icon-button" data-close aria-label="Close leaderboard">${icon('close')}</button></div><div id="score-list" class="score-list"></div><p class="leader-note">Saved on this device.</p>`;
  if (!dialog.open) dialog.showModal();
  const load = () => {
    const entries = read('scores', []).filter(e => e.level > 0 && (e.mode ?? 'easy') === mode && e.complete).slice(0, 10);
    $('#score-list').innerHTML = entries.length ? entries.map((e,i) => `<div class="leader-row"><span class="rank">${String(i+1).padStart(2,'0')}</span><span>${new Date(e.date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span><strong>${e.score.toLocaleString()}</strong></div>`).join('') : '<div class="empty-scores">No scores yet.</div>';
  };
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  load();
}
app.addEventListener('click', event => {
  const choice = event.target.closest('[data-mode]');
  if (choice) {
    mode = choice.dataset.mode === 'hard' ? 'hard' : 'easy';
    write('mode', mode);
    start(1);
    return;
  }

  const token = event.target.closest('[data-row]');
  if (token) { choose(Number(token.dataset.row), Number(token.dataset.col)); return; }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  if (button.dataset.action === 'sound') { sound = !sound; write('sound',sound); button.innerHTML = icon(sound ? 'sound' : 'muted'); button.setAttribute('aria-label',`${sound ? 'Mute' : 'Enable'} sound`); button.setAttribute('aria-pressed',String(sound)); tone(true); }
  if (button.dataset.action === 'home') showHome();
  if (button.dataset.action === 'leaderboard') showLeaderboard();
  if (button.dataset.action === 'skip-tutorial' && state.level.id === 0) showHome();
  if (button.dataset.action === 'next' && state.done) start(state.level.id + 1);
});
setInterval(() => {
  if (!state || state.done || !$('#timer-fill')) return;
  const ms = remaining();
  $('.timer-track').setAttribute('aria-valuenow', String(Math.ceil(ms / (state.level.seconds * 1000) * 100)));
  $('#timer-fill').style.width = `${ms / (state.level.seconds * 1000) * 100}%`;
  $('#timer-fill').classList.toggle('urgent', ms <= 10000);
  if (!ms && !state.busy) finish(false);
}, 100);
// Existing players have already encountered the tutorial in earlier versions.
const tutorialSeen = read('tutorialSeen', false) || read('scores', []).length > 0;
write('tutorialSeen', true);
if (tutorialSeen) showHome();
else {
  mode = 'easy';
  start(0);
}
