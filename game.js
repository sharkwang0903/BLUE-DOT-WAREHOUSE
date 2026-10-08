/* BLUE DOT company demo — offline item-assisted playback. */
(function () {
  'use strict';
  const E = window.BlueBoxEngine;
  const levels = window.BlueBoxLevels.map(E.parseLevel);
  const $ = id => document.getElementById(id);
  const canvas = $('board'), ctx = canvas.getContext('2d', { alpha: false });
  const frame = $('stage-frame');
  const clearChoices = [$('next'), $('replay')];
  let clearChoice = 0;
  const storageKey = 'blue-dot-warehouse:company:v1';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const number = n => String(n).padStart(3, '0');
  const fingerprint = level => level.map.join('/') + JSON.stringify([level.player, level.boxes]);
  let saved;
  try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch (_) { saved = null; }

  function validState(level, value) {
    if (!value || !Number.isInteger(value.player) || !Array.isArray(value.boxes) || value.boxes.length !== level.goals.length) return false;
    const positions = [value.player, ...value.boxes];
    return new Set(positions).size === positions.length && positions.every(pos =>
      Number.isInteger(pos) && pos >= 0 && pos < level.tiles.length && level.tiles[pos] !== '#');
  }
  function fresh(level) { return { state: E.copy(level.initial), steps: 0, pushes: 0, history: [], assisted: false, rewarded: false }; }
  const records = levels.map((level, i) => {
    const r = saved && saved.records && saved.records[i];
    if (!r || r.fingerprint !== fingerprint(level) || !validState(level, r.state) ||
        !Number.isInteger(r.steps) || !Number.isInteger(r.pushes) || r.steps < 0 || r.pushes < 0 || r.pushes > r.steps ||
        !Array.isArray(r.history) || r.history.length !== r.steps ||
        !r.history.every(h => h && validState(level, h.state) && Number.isInteger(h.steps) && Number.isInteger(h.pushes))) return fresh(level);
    return { state: E.copy(r.state), steps: r.steps, pushes: r.pushes, history: r.history, assisted: r.assisted === true, rewarded: r.rewarded === true };
  });
  let ppaCount = saved && Number.isSafeInteger(saved.ppaCount) && saved.ppaCount >= 0 ? saved.ppaCount : 3;
  let autopilot = null;
  let itemMessage = '卡關時，給思考一點幫助。';
  const bests = levels.map((level, i) => {
    const b = saved && saved.bests && saved.bests[i];
    return b && b.fingerprint === fingerprint(level) && Number.isInteger(b.pushes) && Number.isInteger(b.steps) && b.pushes >= 0 && b.steps >= b.pushes
      ? { pushes: b.pushes, steps: b.steps } : null;
  });
  const cleared = levels.map((level, i) => !!bests[i] || !!(saved && saved.cleared && saved.cleared[i] === fingerprint(level)));
  // Completion is a contiguous chain; corrupt storage cannot open a later room.
  let unlocked = 0;
  while (unlocked < levels.length - 1 && cleared[unlocked]) unlocked++;
  let current = saved && Number.isInteger(saved.current) ? Math.max(0, Math.min(unlocked, saved.current)) : 0;
  let facing = 1, animation = null, particles = [], clearTimer = null;
  let held = null, audio = null, soundOn = !saved || saved.soundOn !== false;
  let lastBump = 0, lastRender = 0;
  const colors = {
    ground: '#253129', groundDark: '#202a23', groundLight: '#334135',
    wallDark: '#6e6442', wall: '#af9967', wallLight: '#cbb783', mortar: '#85754f',
    boxEdge: '#653f2c', box: '#cc8555', boxLight: '#edb178', boxDark: '#a66a42',
    mint: '#bbd6a1', mintDark: '#4d6b48', blue: '#55adff', blueDark: '#2772b2',
    ice: '#3b6263', iceLight: '#7cb4ad', gate: '#d293a3', gateDark: '#695260'
  };
  const roomButtons = levels.map((level, i) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'room-button';
    button.textContent = String(i + 1).padStart(2, '0');
    button.addEventListener('click', () => selectRoom(i));
    $('room-grid').append(button); return button;
  });

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        current, soundOn, ppaCount, cleared: cleared.map((done, i) => done ? fingerprint(levels[i]) : null),
        records: records.map((r, i) => ({ ...r, fingerprint: fingerprint(levels[i]) })),
        bests: bests.map((b, i) => b && ({ ...b, fingerprint: fingerprint(levels[i]) }))
      }));
    } catch (_) { /* Private mode or a full disk should never stop play. */ }
  }
  function sound(kind) {
    if (!soundOn) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      if (!audio) audio = new Audio();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const now = audio.currentTime;
      const note = (freq, delay, length, volume, end) => {
        const oscillator = audio.createOscillator(), gain = audio.createGain();
        oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(freq, now + delay);
        if (end) oscillator.frequency.exponentialRampToValueAtTime(end, now + delay + length);
        gain.gain.setValueAtTime(0, now + delay);
        gain.gain.linearRampToValueAtTime(volume, now + delay + .006);
        gain.gain.exponentialRampToValueAtTime(.0001, now + delay + length);
        oscillator.connect(gain); gain.connect(audio.destination);
        oscillator.start(now + delay); oscillator.stop(now + delay + length + .015);
      };
      if (kind === 'step') note(220, 0, .035, .025, 155);
      if (kind === 'push') { note(130, 0, .085, .065, 75); note(260, .012, .045, .02); }
      if (kind === 'ice') note(630, 0, .19, .025, 230);
      if (kind === 'goal') { note(523, 0, .10, .055); note(784, .075, .14, .04); }
      if (kind === 'gate') { note(293, 0, .06, .035); note(440, .06, .07, .035); }
      if (kind === 'undo') note(330, 0, .085, .03, 165);
      if (kind === 'bump') note(80, 0, .03, .02);
      if (kind === 'room') { note(330, 0, .10, .035); note(440, .07, .13, .025); }
      if (kind === 'win') [523, 659, 784, 1047].forEach((freq, i) => note(freq, i * .1, .24, .035));
    } catch (_) { /* Audio is optional. */ }
  }
  function updateSound() {
    $('sound').setAttribute('aria-pressed', String(soundOn));
    $('sound').setAttribute('aria-label', soundOn ? '關閉音效' : '開啟音效');
    $('sound-label').textContent = soundOn ? 'SOUND ON' : 'SOUND OFF';
  }

  function syncUI() {
    const level = levels[current], record = records[current], state = record.state;
    const complete = E.won(level, state), filled = level.goals.filter(g => state.boxes.includes(g)).length;
    $('room-number').textContent = String(current + 1).padStart(2, '0');
    $('room-name').textContent = level.name;
    $('room-codename').textContent = level.codename;
    const hasTurns = level.tiles.some((_, pos) => E.turnAt(level, pos));
    $('mechanism-guide').hidden = !hasTurns;
    document.querySelector('.shell').classList.toggle('has-turns', hasTurns);
    $('coordinates').textContent = `${level.width} × ${level.height}`;
    $('stage-status').textContent = autopilot ? 'PPA AUTO PLAY' : complete ? 'ROOM CLEAR' : 'IN PROGRESS';
    $('steps').textContent = number(record.steps);
    $('pushes').textContent = number(record.pushes);
    $('best').textContent = bests[current] ? `${bests[current].pushes} / ${bests[current].steps}` : '—';
    $('best').title = bests[current] ? `${bests[current].pushes} 次推箱，${bests[current].steps} 步` : '尚未通關';
    $('undo').disabled = !!autopilot || record.assisted || record.history.length === 0;
    $('mobile-undo').disabled = $('undo').disabled;
    $('mobile-restart').disabled = !!autopilot;
    for (const id of ['move-up', 'move-right', 'move-down', 'move-left']) $(id).disabled = !!autopilot || complete;
    $('mobile-room').textContent = `${String(current + 1).padStart(2, '0')} · ${level.name}`;
    $('mobile-count').textContent = `PPA ×${ppaCount}`;
    $('mobile-stats').textContent = autopilot ? 'PPA 解題中 · 請觀看演示' : `${number(record.steps)} 步 · ${number(record.pushes)} 次推箱`;
    $('restart').disabled = !!autopilot;
    $('replay').disabled = !!autopilot;
    $('next').disabled = !!autopilot;
    $('ppa-count').textContent = ppaCount;
    $('ppa-use').disabled = !!autopilot || ppaCount === 0 || complete;
    $('ppa-status').textContent = autopilot ? `PPA 解題中 · ${record.steps} / ${autopilot.moves.length} 步，請觀看演示。` : itemMessage;
    document.querySelector('.inventory').setAttribute('aria-busy', String(!!autopilot));
    frame.classList.toggle('is-assisted', !!autopilot);
    $('progress').textContent = `${cleared.filter(Boolean).length} / ${levels.length}`;
    $('goal-dots').replaceChildren(...level.goals.map(pos => {
      const dot = document.createElement('span'); dot.className = 'goal-dot' + (state.boxes.includes(pos) ? ' filled' : '');
      dot.setAttribute('aria-hidden', 'true'); return dot;
    }));
    $('goal-dots').setAttribute('aria-label', `${filled} / ${level.goals.length} 個目標已完成`);
    roomButtons.forEach((button, i) => {
      button.disabled = !!autopilot || i > unlocked;
      button.classList.toggle('complete', cleared[i]);
      button.setAttribute('aria-current', i === current ? 'true' : 'false');
      button.setAttribute('aria-label', `房間 ${i + 1}：${levels[i].name}${i > unlocked ? '，尚未開啟' : cleared[i] ? '，已通關' : ''}`);
    });
    frame.classList.toggle('is-clear', complete);
    canvas.dataset.room = String(current + 1);
    canvas.dataset.player = String(state.player);
    canvas.dataset.boxes = state.boxes.join(',');
    canvas.dataset.complete = String(complete);
    canvas.setAttribute('aria-label', `房間 ${current + 1}，${level.name}。玩家位於第 ${state.player % level.width + 1} 欄、第 ${Math.floor(state.player / level.width) + 1} 列。${filled} / ${level.goals.length} 個目標。${record.steps} 步，${record.pushes} 次推箱。`);
  }
  function hideClear() {
    clearTimeout(clearTimer); clearTimer = null; $('completion').hidden = true;
  }
  function selectClearChoice(index, focus = true) {
    clearChoice = index;
    clearChoices.forEach((button, i) => button.classList.toggle('is-selected', i === index));
    if (focus) clearChoices[index].focus({ preventScroll: true });
  }
  clearChoices.forEach((button, i) => {
    button.addEventListener('focus', () => selectClearChoice(i, false));
  });
  function showClear() {
    const record = records[current];
    if (!E.won(levels[current], record.state)) return;
    const final = current === levels.length - 1;
    $('completion-eyebrow').textContent = final ? 'ALL SIXTEEN. ALL YOURS.' : 'ROOM CLEAR';
    $('completion-title').textContent = final ? '倉庫，安靜了。' : '房間已清空';
    $('completion-detail').textContent = `${record.steps} 步  ·  ${record.pushes} 次推箱${final ? `  ·  ${levels.length} / ${levels.length}` : ''}${record.assisted ? '  ·  PPA 協助通關' : '  ·  自行破關，獲得 PPA 乳霜 ×1'}`;
    $('next').innerHTML = final ? '回到第一個房間 <span aria-hidden="true">↗</span>' : '下一個房間 <span aria-hidden="true">→</span>';
    $('completion').hidden = false;
    held = null;
    selectClearChoice(0);
    $('announcement').textContent = final ? `${levels.length} 個房間全部通關。` : `房間 ${current + 1} 通關。下一個房間已開啟。`;
    draw(performance.now());
  }
  function awardClear() {
    const record = records[current], old = bests[current];
    if (!record.assisted && (!old || record.pushes < old.pushes || record.pushes === old.pushes && record.steps < old.steps)) {
      bests[current] = { pushes: record.pushes, steps: record.steps };
    }
    cleared[current] = true;
    if (!record.assisted && !record.rewarded) {
      ppaCount++; record.rewarded = true;
      itemMessage = '自行破關！獲得 PPA 乳霜 ×1。';
    } else if (record.assisted) itemMessage = 'PPA 協助通關完成。本次不發道具獎勵。';
    unlocked = Math.max(unlocked, Math.min(levels.length - 1, current + 1));
    held = null; persist();
    clearTimer = setTimeout(() => { showClear(); sound('win'); }, reducedMotion ? 0 : 470);
  }
  function selectRoom(i) {
    if (autopilot || i < 0 || i > unlocked) return;
    if ($('mobile-panel').open) $('mobile-panel').close();
    hideClear(); current = i; facing = 1; held = null; animation = null; particles = [];
    syncUI(); persist(); draw(performance.now()); sound('room'); canvas.focus({ preventScroll: true });
    if (E.won(levels[current], records[current].state)) showClear();
  }
  function restart() {
    if (autopilot) return;
    if ($('mobile-panel').open) $('mobile-panel').close();
    hideClear(); records[current] = fresh(levels[current]);
    held = null; animation = null; particles = []; facing = 1;
    syncUI(); persist(); draw(performance.now()); sound('undo'); canvas.focus({ preventScroll: true });
  }
  function undo() {
    if (autopilot || records[current].assisted) return;
    const record = records[current], previous = record.history.pop();
    if (!previous) return;
    hideClear(); record.state = previous.state; record.steps = previous.steps; record.pushes = previous.pushes;
    held = null; animation = null; particles = [];
    syncUI(); persist(); draw(performance.now()); sound('undo'); canvas.focus({ preventScroll: true });
  }
  function burst(pos, time) {
    const c = position(pos);
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI * 2 / 10;
      particles.push({ x: c.x + 16, y: c.y + 15, vx: Math.cos(angle) * (13 + i % 3 * 4), vy: Math.sin(angle) * 16, born: time });
    }
  }
  function tryMove(direction, now = performance.now(), automatic = false) {
    if (autopilot && !automatic) return;
    const level = levels[current], record = records[current];
    if (E.won(level, record.state) || animation && now < animation.until) return;
    facing = direction;
    const result = E.move(level, record.state, direction);
    if (!result) {
      if (now - lastBump > 180) { sound('bump'); lastBump = now; }
      draw(now); return;
    }
    const old = record.state;
    record.history.push({ state: E.copy(old), steps: record.steps, pushes: record.pushes });
    record.state = result.state; record.steps++; if (result.pushed) record.pushes++;
    const duration = reducedMotion ? 0 : result.path.length > 2 ? Math.min(result.turns ? 560 : 300, 110 + result.path.length * 32) : result.pushed ? 110 : 82;
    animation = { from: old.player, to: result.state.player, boxFrom: result.from, boxTo: result.to, path: result.path, start: now, until: now + duration };
    if (result.pushed && level.goals.includes(result.to) && !level.goals.includes(result.from)) {
      burst(result.to, now); sound('goal');
    } else sound(result.path.length > 2 ? 'ice' : result.pushed ? 'push' : 'step');
    if (E.gatesOpen(level, old.boxes) !== E.gatesOpen(level, result.state.boxes)) sound('gate');
    if (E.won(level, record.state)) awardClear();
    syncUI(); persist(); draw(now);
  }

  // Validate the full solution before consuming an item, including its level fingerprint.
  function solutionMoves(level) {
    const entry = window.BlueBoxSolutions && window.BlueBoxSolutions[current];
    if (!entry || entry.fingerprint !== fingerprint(level)) throw new Error('Solution is out of date.');
    const moves = [...entry.solution].map(key => E.DIRS.findIndex(dir => dir.key === key));
    let state = E.copy(level.initial);
    for (const dir of moves) {
      const result = dir >= 0 && E.move(level, state, dir);
      if (!result) throw new Error('Invalid solution.');
      state = result.state;
    }
    if (!E.won(level, state)) throw new Error('Incomplete solution.');
    return moves;
  }
  function usePpa() {
    if (autopilot || ppaCount <= 0 || E.won(levels[current], records[current].state)) return;
    let moves;
    try { moves = solutionMoves(levels[current]); }
    catch (_) { itemMessage = '本關解法尚未準備好，乳霜未扣除。'; syncUI(); return; }
    if ($('mobile-panel').open) $('mobile-panel').close();
    hideClear(); ppaCount--; records[current] = fresh(levels[current]);
    records[current].assisted = true;
    autopilot = { moves, cursor: 0, next: performance.now() + 700 };
    held = null; animation = null; particles = []; facing = 1;
    $('announcement').textContent = '已使用 PPA 乳霜，回復關卡初始狀態。程式解題中，玩家操作暫停。';
    syncUI(); persist(); draw(performance.now()); sound('room');
  }
  function resumePpa() {
    const record = records[current];
    if (!record.assisted || E.won(levels[current], record.state)) return;
    try {
      const moves = solutionMoves(levels[current]);
      // Always reconstruct the trusted prefix when resuming after a refresh.
      const steps = Math.min(record.steps, moves.length);
      records[current] = fresh(levels[current]); records[current].assisted = true;
      for (const dir of moves.slice(0, steps)) {
        const r = records[current], result = E.move(levels[current], r.state, dir);
        r.history.push({ state: E.copy(r.state), steps: r.steps, pushes: r.pushes });
        r.state = result.state; r.steps++; if (result.pushed) r.pushes++;
      }
      autopilot = { moves, cursor: steps, next: performance.now() + 700 };
    } catch (_) {
      // A changed level/solution should leave the player able to play and refund the interrupted use.
      records[current] = fresh(levels[current]); ppaCount++;
      itemMessage = '解法已更新，中斷的乳霜已退回，請重新使用。';
    }
    persist();
  }

  // Each terrain cell is 32 real pixels. CSS only scales this tiny framebuffer.
  function position(pos) {
    const level = levels[current];
    return { x: (288 - level.width * 32) / 2 + pos % level.width * 32, y: (288 - level.height * 32) / 2 + Math.floor(pos / level.width) * 32 };
  }
  function rect(color, x, y, w, h) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  function target(x, y, done, time) {
    const color = done ? colors.mint : '#8ba977';
    rect(color, x + 15, y + 10, 2, 2); rect(color, x + 12, y + 12, 2, 2); rect(color, x + 18, y + 12, 2, 2);
    rect(color, x + 10, y + 14, 2, 4); rect(color, x + 20, y + 14, 2, 4);
    rect(color, x + 12, y + 18, 2, 2); rect(color, x + 18, y + 18, 2, 2); rect(color, x + 15, y + 20, 2, 2);
    if (done) rect(colors.mint, x + 14, y + 14, 4, 4);
  }
  function wall(x, y, pos) {
    rect(colors.wallDark, x, y, 32, 32);
    rect(colors.wall, x + 1, y + 1, 30, 27);
    rect(colors.wallLight, x + 1, y + 1, 30, 2);
    rect('#988253', x + 1, y + 26, 30, 2);
    rect(colors.mortar, x + 1, y + 14, 30, 1);
    const seam = pos % 2 ? 11 : 20;
    rect(colors.mortar, x + seam, y + 3, 1, 11);
    rect(colors.mortar, x + (seam + 13) % 29 + 1, y + 15, 1, 11);
    rect('#a58e5d', x + 4 + pos % 7, y + 7, 3, 1);
    rect('#c0aa76', x + 19 - pos % 5, y + 20, 3, 1);
    rect('#786a47', x + 2, y + 29, 28, 2);
  }
  function plate(x, y, active) {
    rect('#19251f', x + 5, y + 8, 22, 19);
    rect(active ? '#85874d' : '#70593a', x + 7, y + 9, 18, 15);
    rect(active ? '#dbc784' : '#b79b67', x + 8, y + 9, 16, 2);
    rect(active ? '#f0dfa4' : '#96774b', x + 11, y + 13, 10, 8);
    rect(active ? '#fbebba' : '#c2aa72', x + 14, y + 15, 4, 4);
    rect(active ? '#dcc485' : '#5c4b34', x + 8, y + 24, 16, 2);
  }
  function gate(x, y, open, occupied) {
    rect(colors.gateDark, x + 3, y + 1, 26, 3); rect(colors.gateDark, x + 3, y + 28, 26, 3);
    rect(colors.gate, x + 4, y + 1, 3, 3); rect(colors.gate, x + 25, y + 28, 3, 3);
    if (open || occupied) {
      rect('#5c8067', x + 6, y + 7, 1, 17); rect('#5c8067', x + 25, y + 7, 1, 17);
      rect(colors.mint, x + 14, y + 1, 4, 2);
    } else {
      for (let dx = 6; dx < 28; dx += 6) {
        rect('#6f5862', x + dx, y + 5, 3, 23); rect(colors.gate, x + dx, y + 5, 1, 22);
      }
      rect('#a77585', x + 4, y + 13, 24, 3);
    }
  }
  function ice(x, y, pos) {
    rect(colors.ice, x + 1, y + 1, 30, 30);
    rect('#456e6b', x + 2, y + 2, 28, 1); rect('#294b4c', x + 2, y + 30, 28, 1);
    rect(colors.iceLight, x + 6, y + 19, 2, 2); rect(colors.iceLight, x + 8, y + 17, 2, 2);
    rect('#628e88', x + 10, y + 15, 4, 2); rect('#628e88', x + 17, y + 22, 5, 1);
    rect('#679b94', x + 21, y + 8 + pos % 3, 3, 1);
  }
  function turningIce(x, y, turn) {
    // Mirrored circular arrows express a relative turn from any entry direction.
    const pixels = ['00111100','01100110','11000011','10000011','10001011','11001111','01100110','00100000'];
    const color = turn > 0 ? '#d3f1f2' : '#f5d995';
    rect('#29494d', x + 6, y + 6, 20, 20);
    pixels.forEach((row, dy) => [...row].forEach((p, dx) => {
      if (p === '1') rect(color, x + 8 + (turn > 0 ? dx : 7 - dx) * 2, y + 8 + dy * 2, 2, 2);
    }));
  }
  function box(x, y, done, onPlate) {
    rect('#15231b', x + 5, y + 8, 23, 23);
    rect(done ? '#496449' : colors.boxEdge, x + 5, y + 5, 22, 23);
    rect(done ? '#8faf79' : colors.box, x + 6, y + 6, 20, 19);
    rect(done ? '#c1d8a6' : colors.boxLight, x + 7, y + 6, 18, 2);
    rect(done ? '#627e58' : colors.boxDark, x + 7, y + 23, 18, 2);
    rect(done ? '#587850' : '#a66a42', x + 9, y + 9, 14, 12);
    const brace = done ? '#b7cd9c' : '#e2a16a';
    for (let i = 0; i < 10; i += 2) rect(brace, x + 10 + i, y + 10 + i, 3, 3);
    for (const dx of [8, 23]) for (const dy of [9, 22]) rect(done ? '#435940' : '#71503a', x + dx, y + dy, 1, 1);
    if (done) { rect('#e1e7bf', x + 14, y + 13, 5, 5); rect('#8baa77', x + 15, y + 14, 3, 3); }
    if (onPlate) rect('#e4d6a1', x + 12, y + 27, 8, 1);
  }
  function player(x, y, time, moving) {
    const blink = !moving && time % 4800 > 4620;
    const bob = reducedMotion || moving ? 0 : Math.floor(time / 700) % 2;
    rect('#17271e', x + 8, y + 25, 16, 3);
    y -= bob;
    rect('#235986', x + 11, y + 7, 10, 20); rect('#235986', x + 7, y + 11, 18, 12);
    rect(colors.blueDark, x + 9, y + 8, 14, 17); rect(colors.blueDark, x + 6, y + 13, 20, 9);
    rect(colors.blue, x + 11, y + 6, 10, 18); rect(colors.blue, x + 8, y + 9, 16, 13); rect(colors.blue, x + 6, y + 13, 20, 6);
    rect('#99d3ff', x + 11, y + 8, 7, 2); rect('#99d3ff', x + 9, y + 10, 2, 2);
    const eyeY = y + (facing === 0 ? 12 : facing === 2 ? 15 : 13);
    const eyeX = x + (facing === 3 ? 8 : facing === 1 ? 11 : 9);
    for (const shift of [0, 7]) {
      rect('#eff3e4', eyeX + shift, eyeY, 4, blink ? 1 : 6);
      if (!blink) rect('#18354a', eyeX + shift + (facing === 3 ? 0 : facing === 1 ? 2 : 1), eyeY + (facing === 0 ? 0 : facing === 2 ? 3 : 2), 2, 3);
    }
  }
  function draw(time) {
    const level = levels[current], state = records[current].state;
    const open = E.gatesOpen(level, state.boxes);
    ctx.imageSmoothingEnabled = false;
    rect('#101a13', 0, 0, 288, 288);
    for (let x = 12; x < 288; x += 24) for (let y = 12; y < 288; y += 24) rect('#233123', x, y, 1, 1);
    for (let pos = 0; pos < level.tiles.length; pos++) {
      const tile = level.tiles[pos], { x, y } = position(pos);
      if (tile === '#') { wall(x, y, pos); continue; }
      rect(colors.ground, x, y, 32, 32);
      rect(colors.groundDark, x, y + 31, 32, 1); rect(colors.groundDark, x + 31, y, 1, 32);
      rect(colors.groundLight, x + 4 + pos * 3 % 21, y + 5 + pos * 7 % 19, 1, 1);
      if (E.isIce(level, pos)) ice(x, y, pos);
      if (E.turnAt(level, pos)) turningIce(x, y, E.turnAt(level, pos));
      if (level.plates.includes(pos)) plate(x, y, state.boxes.includes(pos));
      if (level.goals.includes(pos)) target(x, y, state.boxes.includes(pos), time);
      if (tile === '|') gate(x, y, open, state.player === pos || state.boxes.includes(pos));
    }
    const moving = animation && animation.until > time;
    const progress = moving ? Math.max(0, Math.min(1, (time - animation.start) / (animation.until - animation.start))) : 1;
    for (const pos of state.boxes) {
      let { x, y } = position(pos);
      if (moving && pos === animation.boxTo) {
        const s = progress * (animation.path.length - 1), i = Math.min(animation.path.length - 2, Math.floor(s));
        const a = position(animation.path[i]), b = position(animation.path[i + 1]), f = s - i;
        x = a.x + (b.x - a.x) * f; y = a.y + (b.y - a.y) * f;
      }
      box(x, y, level.goals.includes(pos) && (!moving || pos !== animation.boxTo || progress > .85), level.plates.includes(pos));
    }
    let p = position(state.player);
    if (moving) {
      const a = position(animation.from), b = position(animation.to), f = 1 - Math.pow(1 - progress, 2);
      p = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
    player(p.x, p.y, time, moving);
    if (!reducedMotion) for (const particle of particles) {
      const age = (time - particle.born) / 1000;
      if (age >= 0 && age < .4) rect(age < .22 ? colors.mint : '#759167', particle.x + particle.vx * age, particle.y + particle.vy * age + age * age * 23, 2, 2);
    }
    particles = particles.filter(p => time - p.born < 500);
  }

  function drawWordmark() {
    const font = {
      B: ['11110','10001','10001','11110','10001','10001','11110'],
      L: ['10000','10000','10000','10000','10000','10000','11111'],
      U: ['10001','10001','10001','10001','10001','10001','01110'],
      E: ['11111','10000','10000','11110','10000','10000','11111'],
      D: ['11110','10001','10001','10001','10001','10001','11110'],
      O: ['01110','10001','10001','10001','10001','10001','01110'],
      T: ['11111','00100','00100','00100','00100','00100','00100'],
      '.': ['0','0','0','0','0','1','1']
    };
    const logo = $('wordmark'), c = logo.getContext('2d');
    c.clearRect(0, 0, logo.width, logo.height);
    let x = 0;
    for (const letter of 'BLUE DOT.') {
        if (letter === ' ') { x += 14; continue; }
        c.fillStyle = x < 112 ? '#e8ead9' : '#64b5fc';
        font[letter].forEach((row, y) => [...row].forEach((bit, dx) => { if (bit === '1') c.fillRect(x + dx * 4, y * 4, 4, 4); }));
        x += letter === '.' ? 8 : 28;
    }
  }
  const bindings = { ArrowUp: 0, w: 0, ArrowRight: 1, d: 1, ArrowDown: 2, s: 2, ArrowLeft: 3, a: 3 };
  document.addEventListener('keydown', event => {
    if ($('ppa-dialog').open || $('mobile-panel').open) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (autopilot && (Object.hasOwn(bindings, key) || ['z', 'r', 'Enter'].includes(key))) { event.preventDefault(); return; }
    if (!$('completion').hidden) {
      if (Object.hasOwn(bindings, key)) {
        event.preventDefault();
        if (!event.repeat) {
          const delta = bindings[key] === 0 || bindings[key] === 3 ? -1 : 1;
          selectClearChoice((clearChoice + delta + clearChoices.length) % clearChoices.length);
        }
        return;
      }
      if (key === 'Enter' && (!event.target.closest('button') || clearChoices.includes(event.target.closest('button')))) {
        event.preventDefault();
        if (!event.repeat) clearChoices[clearChoice].click();
        return;
      }
    }
    if (Object.hasOwn(bindings, key)) {
      event.preventDefault(); if (event.repeat) return;
      canvas.focus({ preventScroll: true });
      const now = performance.now(); held = { key, dir: bindings[key], next: now + 260 };
      tryMove(bindings[key], now);
    } else if (key === 'z') { event.preventDefault(); if (!event.repeat) undo(); }
    else if (key === 'r') { event.preventDefault(); if (!event.repeat) restart(); }
    else if (key === 'm' && !event.repeat) toggleSound();
  });
  document.addEventListener('keyup', event => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (held && held.key === key) held = null;
  });
  window.addEventListener('blur', () => { held = null; });
  document.addEventListener('visibilitychange', () => { held = null; if (document.hidden) persist(); });
  function nextRoom() { selectRoom(current === levels.length - 1 ? 0 : current + 1); }
  function toggleSound() { soundOn = !soundOn; updateSound(); persist(); if (soundOn) sound('room'); }
  $('undo').addEventListener('click', undo); $('restart').addEventListener('click', restart);
  $('replay').addEventListener('click', restart); $('next').addEventListener('click', nextRoom);
  $('sound').addEventListener('click', toggleSound);
  $('mobile-undo').addEventListener('click', undo);
  $('mobile-restart').addEventListener('click', restart);
  $('mobile-menu').addEventListener('click', () => {
    held = null; $('mobile-panel').showModal();
  });
  $('mobile-panel-close').addEventListener('click', () => $('mobile-panel').close());
  $('mobile-panel').addEventListener('close', () => { held = null; });
  // Pointer capture stops a held direction even when the finger leaves the button.
  let touchPointer = null;
  const directionButtons = ['move-up', 'move-right', 'move-down', 'move-left'].map($);
  function releaseTouch(event) {
    if (!touchPointer || event && event.pointerId !== touchPointer.id) return;
    touchPointer.button.classList.remove('is-held');
    touchPointer = null;
    if (held && held.key === 'touch') held = null;
  }
  directionButtons.forEach((button, dir) => {
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0 || button.disabled || touchPointer || $('ppa-dialog').open || $('mobile-panel').open) return;
      event.preventDefault();
      const now = performance.now();
      touchPointer = { id: event.pointerId, button };
      button.setPointerCapture(event.pointerId); button.classList.add('is-held');
      held = { key: 'touch', dir, next: now + 260 };
      tryMove(dir, now);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, releaseTouch);
    // Keyboard/screen-reader activation has detail 0; pointer clicks already moved on pointerdown.
    button.addEventListener('click', event => {
      if (event.detail === 0 && !button.disabled && !$('ppa-dialog').open && !$('mobile-panel').open) tryMove(dir);
    });
    button.addEventListener('contextmenu', event => event.preventDefault());
  });
  window.addEventListener('blur', () => releaseTouch());
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseTouch(); });
  $('ppa-use').addEventListener('click', usePpa);
  $('ppa-info').addEventListener('click', () => {
    held = null;
    $('ppa-dialog').showModal();
    $('ppa-info').setAttribute('aria-expanded', 'true');
  });
  $('ppa-close').addEventListener('click', () => $('ppa-dialog').close());
  $('ppa-dialog').addEventListener('close', () => {
    held = null;
    $('ppa-info').setAttribute('aria-expanded', 'false');
    $('ppa-info').focus({ preventScroll: true });
  });
  canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
  function tick(now) {
    if (!document.hidden && !$('ppa-dialog').open && !$('mobile-panel').open) {
      if (autopilot && now >= autopilot.next && (!animation || now >= animation.until)) {
        if (autopilot.cursor < autopilot.moves.length) {
          tryMove(autopilot.moves[autopilot.cursor++], now, true);
          autopilot.next = Math.max(now + 220, animation ? animation.until + 90 : now + 220);
        } else {
          autopilot = null; held = null; syncUI(); persist();
        }
      }
      if (held && now >= held.next) { tryMove(held.dir, now); if (held) held.next = now + 115; }
      if (now - lastRender >= 32) { draw(now); lastRender = now; }
    }
    requestAnimationFrame(tick);
  }
  resumePpa(); drawWordmark(); updateSound(); syncUI(); draw(performance.now());
  if (E.won(levels[current], records[current].state)) showClear();
  requestAnimationFrame(tick);
})();
