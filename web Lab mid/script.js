'use strict';

/* =========================================================
   Typing Challenge  -  Bubbles + KeyMagnet
   One page, no reloads. Screens are shown/hidden with JS.
   ========================================================= */

const $ = (sel) => document.querySelector(sel);

/* ---------------------------------------------------------
   1. SCREEN NAVIGATION
   --------------------------------------------------------- */
let currentScreen = 'home';
let lastMode = null; // 'bubbles' or 'magnet' (used by "Play Again")

function showScreen(name) {
  // Always stop any running game when we leave its screen
  // (prevents timers / animation loops from running in background)
  if (currentScreen === 'bubbles' && name !== 'bubbles') Bubbles.reset();
  if (currentScreen === 'magnet' && name !== 'magnet') Magnet.reset();

  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  $('#screen-' + name).classList.add('active');
  currentScreen = name;
  if (name === 'bubbles' || name === 'magnet') lastMode = name;
}

document.querySelectorAll('[data-go]').forEach((btn) => {
  btn.addEventListener('click', () => showScreen(btn.dataset.go));
});

$('#start-bubbles-card').addEventListener('click', () => { showScreen('bubbles'); Bubbles.start(); });
$('#start-magnet-card').addEventListener('click', () => { showScreen('magnet'); Magnet.start(); });

/* ---------------------------------------------------------
   2. RESULTS SCREEN (shared by both modes)
   --------------------------------------------------------- */
function showResults(title, subtitle, items) {
  $('#results-title').textContent = title;
  $('#results-sub').textContent = subtitle;
  $('#results-grid').innerHTML = items
    .map((it) => `<div class="result-item ${it.big ? 'big' : ''}"><span>${it.label}</span><b>${it.value}</b></div>`)
    .join('');
  const prevMode = currentScreen; // 'bubbles' or 'magnet'
  showScreen('results');
  lastMode = prevMode;
}

$('#results-again').addEventListener('click', () => {
  const mode = lastMode;
  showScreen(mode);
  mode === 'bubbles' ? Bubbles.start() : Magnet.start();
});
$('#results-home').addEventListener('click', () => showScreen('home'));

/* small helper: flash a CSS class for a short time */
function flash(el, cls, ms = 220) {
  el.classList.remove('flash-good', 'flash-bad', 'good', 'bad', 'hit-good', 'hit-bad');
  void el.offsetWidth; // restart CSS animation
  el.classList.add(cls);
  clearTimeout(el._flashTimer);
  el._flashTimer = setTimeout(() => el.classList.remove(cls), ms);
}

function setFeedback(el, text, type) {
  el.textContent = text;
  el.className = 'feedback' + (type ? ' ' + type : '');
}

/* =========================================================
   MODE A : BUBBLES
   ========================================================= */
const Bubbles = (() => {
  // ---- configuration ----
  const CONFIG = {
    easy:   { speed: 55,  maxBubbles: 5, spawnMs: 900, missLimit: 8 },
    medium: { speed: 80,  maxBubbles: 6, spawnMs: 750, missLimit: 6 },
    hard:   { speed: 110, maxBubbles: 7, spawnMs: 600, missLimit: 5 },
  };
  const SIZE = 58;          // bubble size in px (same as CSS)
  const POINTS = 10;        // score for a correct key
  const PENALTY = 5;        // score lost for a wrong key
  const LEVEL_EVERY = 5;    // level up after every 5 correct
  const MAX_BUBBLES_CAP = 10;
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // ---- elements ----
  const area = $('#bubble-area');
  const feedback = $('#bubbles-feedback');
  const diffSelect = $('#bubbles-difficulty');
  const startBtn = $('#bubbles-start');

  // ---- state ----
  let s = freshState();
  function freshState() {
    return {
      running: false, score: 0, correct: 0, wrong: 0, misses: 0, level: 1,
      bubbles: [],       // {el, letter, x, y}
      rafId: null,       // requestAnimationFrame id (only ONE loop allowed)
      lastTs: 0, sinceSpawn: 0,
      cfg: CONFIG[diffSelect.value],
      diff: diffSelect.value,
    };
  }

  // ---- helpers ----
  const currentSpeed = () => s.cfg.speed * (1 + 0.12 * (s.level - 1));
  const currentMax = () =>
    Math.min(s.cfg.maxBubbles + Math.floor((s.level - 1) / 2), MAX_BUBBLES_CAP);

  function updateStatus() {
    $('#b-score').textContent = s.score;
    $('#b-misses').textContent = `${s.misses} / ${s.cfg.missLimit}`;
    $('#b-level').textContent = s.level;
    $('#b-speed').textContent = Math.round(currentSpeed());
    $('#b-correct').textContent = s.correct;
    $('#b-wrong').textContent = s.wrong;
  }

  function randomLetter() {
    // avoid duplicate letters on screen so a key press is unambiguous
    const used = s.bubbles.map((b) => b.letter);
    const free = LETTERS.split('').filter((l) => !used.includes(l));
    return free[Math.floor(Math.random() * free.length)];
  }

  function spawnBubble(y) {
    const el = document.createElement('div');
    el.className = 'bubble';
    const letter = randomLetter();
    el.textContent = letter;
    const maxX = Math.max(0, area.clientWidth - SIZE);
    const x = Math.random() * maxX;
    const b = { el, letter, x, y };
    el.style.transform = `translate(${x}px, ${y}px)`;
    // tapping a bubble = pressing its letter (helps on mobile)
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); handleLetter(letter); });
    area.appendChild(el);
    s.bubbles.push(b);
  }

  // ---- main animation loop ----
  function loop(ts) {
    if (!s.running) return;
    const dt = Math.min((ts - s.lastTs) / 1000, 0.05); // clamp big gaps (tab switch)
    s.lastTs = ts;
    const speed = currentSpeed();

    // move bubbles upward
    for (const b of s.bubbles) {
      b.y -= speed * dt;
      b.el.style.transform = `translate(${b.x}px, ${b.y}px)`;
    }

    // bubbles that reached the top = misses
    const missed = s.bubbles.filter((b) => b.y <= 0);
    if (missed.length) {
      missed.forEach((b) => b.el.remove());
      s.bubbles = s.bubbles.filter((b) => b.y > 0);
      s.misses += missed.length;
      flash(area, 'flash-bad');
      setFeedback(feedback, `💨 Missed! (${s.misses}/${s.cfg.missLimit})`, 'bad');
      updateStatus();
      if (s.misses >= s.cfg.missLimit) { end(); return; }
    }

    // keep enough bubbles on screen
    s.sinceSpawn += dt * 1000;
    if (s.bubbles.length < currentMax() && s.sinceSpawn >= s.cfg.spawnMs) {
      spawnBubble(area.clientHeight);
      s.sinceSpawn = 0;
    }

    s.rafId = requestAnimationFrame(loop);
  }

  // ---- key handling ----
  function handleLetter(letter) {
    if (!s.running) return;
    // if two share a letter (shouldn't), pick the one closest to the top
    const candidates = s.bubbles.filter((b) => b.letter === letter).sort((a, b) => a.y - b.y);
    if (candidates.length) {
      const hit = candidates[0];
      hit.el.classList.add('pop');
      setTimeout(() => hit.el.remove(), 200);
      s.bubbles = s.bubbles.filter((b) => b !== hit);
      s.score += POINTS;
      s.correct++;
      flash(area, 'flash-good');
      let msg = `✔ Correct! +${POINTS}`;
      const newLevel = 1 + Math.floor(s.correct / LEVEL_EVERY);
      if (newLevel > s.level) { s.level = newLevel; msg += `  ·  ⬆ Level ${s.level}!`; }
      setFeedback(feedback, msg, 'good');
    } else {
      s.score = Math.max(0, s.score - PENALTY);
      s.wrong++;
      flash(area, 'flash-bad');
      setFeedback(feedback, `✘ Wrong key "${letter}"  −${PENALTY}`, 'bad');
    }
    updateStatus();
  }

  // ---- controls ----
  function stopLoop() {
    s.running = false;
    if (s.rafId !== null) { cancelAnimationFrame(s.rafId); s.rafId = null; }
  }

  function start() {
    if (s.running) return;           // never start a second loop
    reset();                         // clean state first
    s.cfg = CONFIG[diffSelect.value];
    s.diff = diffSelect.value;
    s.running = true;
    diffSelect.disabled = true;
    startBtn.disabled = true;
    if (document.activeElement) document.activeElement.blur();

    // initial bubbles spread over the lower part of the area
    const H = area.clientHeight;
    for (let i = 0; i < s.cfg.maxBubbles; i++) {
      spawnBubble(H - 20 - i * ((H * 0.7) / s.cfg.maxBubbles));
    }
    setFeedback(feedback, 'Go! Type the letters before they reach the top.', '');
    updateStatus();
    s.lastTs = performance.now();
    s.rafId = requestAnimationFrame(loop);
  }

  function reset() {
    stopLoop();
    area.innerHTML = '';
    s = freshState();
    diffSelect.disabled = false;
    startBtn.disabled = false;
    setFeedback(feedback, 'Press Start, then type the letters you see.', '');
    updateStatus();
  }

  function restart() {
    reset();
    start();
  }

  function end() {
    stopLoop();
    const total = s.correct + s.wrong;
    const acc = total ? Math.round((s.correct / total) * 100) : 0;
    const stats = [
      { label: 'Final Score', value: s.score, big: true },
      { label: 'Difficulty', value: s.diff.toUpperCase() },
      { label: 'Level reached', value: s.level },
      { label: 'Bubbles popped', value: s.correct },
      { label: 'Wrong key presses', value: s.wrong },
      { label: 'Misses', value: `${s.misses} / ${s.cfg.missLimit}` },
      { label: 'Accuracy', value: acc + '%' },
    ];
    diffSelect.disabled = false;
    startBtn.disabled = false;
    showResults('Game Over 🫧', 'Too many bubbles escaped!', stats);
    // clear the field after results are shown
    area.innerHTML = '';
    s.bubbles = [];
  }

  // ---- button wiring ----
  startBtn.addEventListener('click', start);
  $('#bubbles-restart').addEventListener('click', restart);
  $('#bubbles-reset').addEventListener('click', reset);
  diffSelect.addEventListener('change', () => { s.cfg = CONFIG[diffSelect.value]; updateStatus(); });

  updateStatus();
  return { start, reset, handleLetter };
})();

/* =========================================================
   MODE B : KEYMAGNET
   ========================================================= */
const Magnet = (() => {
  // ---- configuration ----
  const KEYSETS = {
    home:   ['A', 'S', 'D', 'F', 'J', 'K', 'L'],
    top:    'QWERTYUIOP'.split(''),
    bottom: 'ZXCVBNM'.split(''),
    all:    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  };
  const KEYSET_NAMES = { home: 'Home row', top: 'Top row', bottom: 'Bottom row', all: 'All letters' };
  const DIFFS = {
    easy:   { time: 60, goal: 20, perTarget: 0 },     // no per-target limit
    medium: { time: 45, goal: 25, perTarget: 3000 },  // 3 s per target
    hard:   { time: 30, goal: 30, perTarget: 1800 },  // 1.8 s per target
  };
  const POINTS = 10, BONUS = 5, FAST_MS = 1000, PENALTY = 5;
  const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

  // ---- elements ----
  const targetEl = $('#magnet-target');
  const feedback = $('#magnet-feedback');
  const diffSelect = $('#magnet-difficulty');
  const setSelect = $('#magnet-keyset');
  const startBtn = $('#magnet-start');
  const kb = $('#keyboard');

  // ---- build the on-screen keyboard once ----
  const keyEls = {};
  ROWS.forEach((row) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'kb-row';
    row.split('').forEach((ch) => {
      const k = document.createElement('div');
      k.className = 'key';
      k.textContent = ch;
      k.addEventListener('pointerdown', (e) => { e.preventDefault(); handleLetter(ch); });
      keyEls[ch] = k;
      rowEl.appendChild(k);
    });
    kb.appendChild(rowEl);
  });

  function markKeySet() {
    const set = KEYSETS[setSelect.value];
    Object.entries(keyEls).forEach(([ch, el]) => el.classList.toggle('in-set', set.includes(ch)));
  }

  // ---- state ----
  let s = freshState();
  function freshState() {
    return {
      running: false, score: 0, correct: 0, wrong: 0, timeouts: 0,
      target: null, targetShownAt: 0, startedAt: 0, timeLeft: 0,
      times: [],          // response times (ms) of correct answers
      timerId: null,      // setInterval id (only ONE timer allowed)
      cfg: DIFFS[diffSelect.value], diff: diffSelect.value, setKey: setSelect.value,
    };
  }

  const avg = () => (s.times.length ? Math.round(s.times.reduce((a, b) => a + b, 0) / s.times.length) : null);

  function updateStatus() {
    $('#m-score').textContent = s.score;
    $('#m-time').textContent = Math.ceil(s.timeLeft) + 's';
    $('#m-progress').textContent = `${s.correct} / ${s.cfg.goal}`;
    $('#m-correct').textContent = s.correct;
    $('#m-wrong').textContent = s.wrong + s.timeouts;
    $('#m-avg').textContent = avg() === null ? '–' : avg() + ' ms';
  }

  function nextTarget() {
    const set = KEYSETS[s.setKey];
    let k;
    do { k = set[Math.floor(Math.random() * set.length)]; } while (k === s.target && set.length > 1);
    s.target = k;
    s.targetShownAt = performance.now();
    targetEl.textContent = k;
    Object.values(keyEls).forEach((el) => el.classList.remove('target-key'));
    keyEls[k].classList.add('target-key');
  }

  // ---- ticking (one single interval for time + per-target limit) ----
  function tick() {
    if (!s.running) return;
    const now = performance.now();
    s.timeLeft = Math.max(0, s.cfg.time - (now - s.startedAt) / 1000);

    // per-target time limit (Medium / Hard)
    if (s.cfg.perTarget && now - s.targetShownAt > s.cfg.perTarget) {
      s.timeouts++;
      s.score = Math.max(0, s.score - PENALTY);
      flash(targetEl, 'bad');
      setFeedback(feedback, `⏱ Too slow!  −${PENALTY}`, 'bad');
      nextTarget();
    }
    updateStatus();
    if (s.timeLeft <= 0) end('Time is up ⏰');
  }

  // ---- key handling ----
  function handleLetter(letter) {
    if (!s.running) return;
    const now = performance.now();
    if (letter === s.target) {
      const rt = Math.round(now - s.targetShownAt);
      s.times.push(rt);
      s.correct++;
      let pts = POINTS;
      if (rt < FAST_MS) pts += BONUS;
      s.score += pts;
      flash(keyEls[letter], 'hit-good', 200);
      flash(targetEl, 'good');
      setFeedback(feedback, `✔ Correct! +${pts}  (${rt} ms)`, 'good');
      updateStatus();
      if (s.correct >= s.cfg.goal) { end('Challenge completed 🎉'); return; }
      nextTarget();
    } else {
      s.wrong++;
      s.score = Math.max(0, s.score - PENALTY);
      flash(keyEls[letter], 'hit-bad', 200);
      flash(targetEl, 'bad');
      setFeedback(feedback, `✘ Wrong key "${letter}"  −${PENALTY}`, 'bad');
      updateStatus();
    }
  }

  // ---- controls ----
  function stopTimer() {
    s.running = false;
    if (s.timerId !== null) { clearInterval(s.timerId); s.timerId = null; }
  }

  function start() {
    if (s.running) return;
    reset();
    s.cfg = DIFFS[diffSelect.value];
    s.diff = diffSelect.value;
    s.setKey = setSelect.value;
    s.running = true;
    s.startedAt = performance.now();
    s.timeLeft = s.cfg.time;
    diffSelect.disabled = true;
    setSelect.disabled = true;
    startBtn.disabled = true;
    if (document.activeElement) document.activeElement.blur();
    setFeedback(feedback, 'Go! Press the highlighted key.', '');
    nextTarget();
    updateStatus();
    s.timerId = setInterval(tick, 100);
  }

  function reset() {
    stopTimer();
    s = freshState();
    s.timeLeft = s.cfg.time;
    targetEl.textContent = '?';
    targetEl.classList.remove('good', 'bad');
    Object.values(keyEls).forEach((el) => el.classList.remove('target-key', 'hit-good', 'hit-bad'));
    diffSelect.disabled = false;
    setSelect.disabled = false;
    startBtn.disabled = false;
    markKeySet();
    setFeedback(feedback, 'Press Start to get your first target key.', '');
    updateStatus();
  }

  function restart() { reset(); start(); }

  function end(reason) {
    stopTimer();
    const total = s.correct + s.wrong;
    const acc = total ? Math.round((s.correct / total) * 100) : 0;
    const best = s.times.length ? Math.min(...s.times) + ' ms' : '–';
    const stats = [
      { label: 'Final Score', value: s.score, big: true },
      { label: 'Difficulty', value: s.diff.toUpperCase() },
      { label: 'Key set', value: KEYSET_NAMES[s.setKey] },
      { label: 'Correct responses', value: `${s.correct} / ${s.cfg.goal}` },
      { label: 'Incorrect responses', value: s.wrong },
      { label: 'Too slow (timeouts)', value: s.timeouts },
      { label: 'Accuracy', value: acc + '%' },
      { label: 'Avg response time', value: avg() === null ? '–' : avg() + ' ms' },
      { label: 'Best response time', value: best },
    ];
    diffSelect.disabled = false;
    setSelect.disabled = false;
    startBtn.disabled = false;
    showResults(reason, 'KeyMagnet session finished', stats);
  }

  // ---- button wiring ----
  startBtn.addEventListener('click', start);
  $('#magnet-restart').addEventListener('click', restart);
  $('#magnet-reset').addEventListener('click', reset);
  diffSelect.addEventListener('change', () => { s.cfg = DIFFS[diffSelect.value]; s.timeLeft = s.cfg.time; updateStatus(); });
  setSelect.addEventListener('change', markKeySet);

  markKeySet();
  updateStatus();
  return { start, reset, handleLetter };
})();

/* ---------------------------------------------------------
   3. GLOBAL KEYBOARD LISTENER
   --------------------------------------------------------- */
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (!/^[a-zA-Z]$/.test(e.key)) return;
  const letter = e.key.toUpperCase();
  if (currentScreen === 'bubbles') Bubbles.handleLetter(letter);
  else if (currentScreen === 'magnet') Magnet.handleLetter(letter);
});