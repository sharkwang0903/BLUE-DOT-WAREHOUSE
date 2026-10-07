'use strict';
// Exercise the actual game controller with a small DOM/clock harness, without dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../engine.js');
const sources = require('../levels.js');
const key = 'blue-dot-warehouse:company:v1';
const lastRoom = sources.length - 1;
const originalKey = 'blue-dot-warehouse:v1';
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
function boot(storage = new Map(), reduced = false, changeSolutions) {
  let time = 0, raf;
  const timers = new Map(), elements = new Map(), listeners = {};
  let timerID = 0;
  const context = { fillRect() {}, clearRect() {} };
  function element() {
    const handlers = {}, attributes = {}, children = [];
    return {
      textContent: '', innerHTML: '', hidden: true, open: false, disabled: false, width: 288, height: 288,
      dataset: {}, classList: { toggle() {}, add() {}, remove() {} }, children,
      setAttribute(k, v) { attributes[k] = v; }, getAttribute(k) { return attributes[k]; },
      append(child) { children.push(child); }, replaceChildren(...items) { children.splice(0, children.length, ...items); },
      addEventListener(k, fn) { handlers[k] = fn; },
      click() { if (!this.disabled && handlers.click) handlers.click({ detail: 0 }); },
      emit(type, event) { if (handlers[type]) handlers[type](event); }, setPointerCapture() {},
      showModal() { this.open = true; }, close() { this.open = false; if (handlers.close) handlers.close(); },
      querySelector() { return get('info-label'); }, getContext() { return context; },
      focus() { document.activeElement = this; if (handlers.focus) handlers.focus(); },
      closest(selector) { return selector === 'button' && [get('next'), get('replay')].includes(this) ? this : null; }
    };
  }
  function get(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }
  const document = {
    hidden: false, getElementById: get, createElement: element,
    querySelector: () => get('inventory'), addEventListener(k, fn) { listeners[k] = fn; }
  };
  const sandbox = {
    window: { BlueBoxEngine: E, BlueBoxLevels: sources, addEventListener() {} }, document,
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
    matchMedia: () => ({ matches: reduced }), performance: { now: () => time },
    requestAnimationFrame: fn => { raf = fn; },
    setTimeout(fn, delay) { timers.set(++timerID, { fn, at: time + delay }); return timerID; },
    clearTimeout: id => timers.delete(id)
  };
  vm.createContext(sandbox); vm.runInContext(source('solutions.js'), sandbox);
  if (changeSolutions) changeSolutions(sandbox.window.BlueBoxSolutions);
  vm.runInContext(source('game.js'), sandbox);
  const advance = (ms = 500) => {
    time += ms; raf(time);
    for (const [id, t] of [...timers]) if (t.at <= time) { timers.delete(id); t.fn(); }
  };
  const read = () => JSON.parse(storage.get(key));
  const press = (k, repeat = false) => {
    listeners.keydown({ key: k, repeat, preventDefault() {}, target: document.activeElement || { closest() { return null; } } });
    listeners.keyup({ key: k });
  };
  const play = solution => {
    for (const k of solution) { advance(); press({ U: 'ArrowUp', R: 'ArrowRight', D: 'ArrowDown', L: 'ArrowLeft' }[k]); }
    advance();
  };
  const finish = () => { for (let i = 0; i < 300 && get('restart').disabled; i++) advance(); assert.equal(get('restart').disabled, false); advance(); };
  return { get, read, press, play, finish, advance, storage, document, solutions: sandbox.window.BlueBoxSolutions };
}

const storage = new Map([[originalKey, 'original-save-untouched']]);
const navigation = boot();
navigation.play(navigation.solutions[0].solution);
assert.equal(navigation.get('completion').hidden, false);
assert.equal(navigation.document.activeElement, navigation.get('next'), 'Completion focuses the default choice.');
const completed = navigation.read();
navigation.press('ArrowDown');
assert.equal(navigation.document.activeElement, navigation.get('replay'), 'Down selects replay.');
navigation.press('ArrowDown', true);
assert.equal(navigation.document.activeElement, navigation.get('replay'), 'Holding an arrow cannot skip choices.');
navigation.advance();
assert.deepEqual(navigation.read(), completed, 'Choice navigation cannot move the board or change the save.');
navigation.press('Enter', true);
assert.deepEqual(navigation.read(), completed, 'A repeated Enter cannot activate a choice.');
navigation.press('Enter');
assert.equal(navigation.read().current, 0, 'Enter on replay stays in the same room.');
assert.equal(navigation.read().records[0].steps, 0, 'Enter on replay resets the room.');
assert.equal(navigation.get('completion').hidden, true);
assert.equal(navigation.document.activeElement, navigation.get('board'), 'Replay returns focus to the board.');
navigation.play(navigation.solutions[0].solution);
navigation.get('room-grid').children[0].click();
assert.equal(navigation.document.activeElement, navigation.get('next'), 'Reopening a completed room resets the choice.');
for (const arrow of ['ArrowUp', 'ArrowRight', 'ArrowLeft', 'ArrowDown']) {
  navigation.press(arrow);
  assert.equal(navigation.document.activeElement, navigation.get('replay'), `${arrow} reaches replay.`);
  navigation.press(arrow);
  assert.equal(navigation.document.activeElement, navigation.get('next'), `${arrow} wraps back to next.`);
}
navigation.get('replay').focus();
navigation.press('Enter');
assert.equal(navigation.read().records[0].steps, 0, 'Tab/native focus on replay also controls Enter.');
navigation.play(navigation.solutions[0].solution);
const restored = boot(navigation.storage);
assert.equal(restored.document.activeElement, restored.get('next'), 'Restoring a completed save focuses next.');
restored.press('s');
restored.press('w');
restored.press('Enter');
assert.equal(restored.read().current, 1, 'WASD navigation and Enter can advance to the next room.');
assert.equal(restored.get('completion').hidden, true);
restored.press({ U: 'ArrowUp', R: 'ArrowRight', D: 'ArrowDown', L: 'ArrowLeft' }[restored.solutions[1].solution[0]]);
assert.equal(restored.read().records[1].steps, 1, 'Direction keys resume normal movement after the menu closes.');
const touch = boot();
const pointer = id => ({ button: 0, pointerId: id, preventDefault() {} });
touch.get('move-right').emit('pointerdown', pointer(1));
assert.equal(touch.read().records[0].steps, 1, 'Touch press moves immediately.');
touch.get('move-down').emit('pointerdown', pointer(2));
assert.equal(touch.read().records[0].steps, 1, 'A second finger cannot change the held direction.');
touch.advance(300); assert.equal(touch.read().records[0].steps, 2, 'Holding a direction repeats.');
touch.get('move-right').emit('pointercancel', pointer(1));
touch.advance(200);
touch.get('move-down').emit('pointerdown', pointer(3));
touch.get('move-down').emit('pointerup', pointer(3));
const stopped = touch.read(); touch.advance(500);
assert.deepEqual(touch.read(), stopped, 'Releasing stops repetition.');
touch.get('mobile-undo').click(); assert.equal(touch.read().records[0].steps, 2);
touch.get('mobile-restart').click(); assert.equal(touch.read().records[0].steps, 0);
touch.get('mobile-menu').click(); touch.press('ArrowRight');
assert.equal(touch.read().records[0].steps, 0, 'Mobile panel blocks keyboard movement.');
touch.get('ppa-use').click();
assert.equal(touch.get('mobile-panel').open, false, 'PPA use closes the panel to show the board.');
assert.equal(touch.get('move-right').disabled, true);
touch.get('move-right').emit('pointerdown', pointer(4));
assert.equal(touch.read().records[0].steps, 0, 'Touch movement is locked during PPA.');
touch.finish();
let app = boot(storage);
assert.equal(app.get('ppa-count').textContent, 3);
app.get('ppa-info').click(); assert.equal(app.get('ppa-dialog').open, true);
app.press('ArrowRight'); assert.equal(app.get('steps').textContent, '000', 'Reading the modal blocks game input.');
app.get('ppa-close').click(); assert.equal(app.get('ppa-dialog').open, false);
assert.equal(app.get('ppa-info').getAttribute('aria-expanded'), 'false');
app.press('ArrowRight'); app.get('ppa-use').click();
assert.equal(app.read().ppaCount, 2);
assert.equal(app.read().records[0].steps, 0, 'Using PPA resets the board.');
assert.deepEqual(app.read().records[0].state, E.parseLevel(sources[0]).initial);
const before = app.read();
for (const k of ['ArrowRight', 'r', 'z', 'Enter']) app.press(k);
for (const id of ['restart', 'undo', 'replay', 'next', 'ppa-use']) app.get(id).click();
app.get('room-grid').children[0].click();
assert.deepEqual(app.read(), before, 'All player controls are locked during playback.');
app.advance(800); const partial = app.read();
assert.ok(partial.records[0].steps > 0 && partial.records[0].steps < 5, 'Playback is incremental.');
app.get('ppa-info').click(); app.advance(1000);
assert.deepEqual(app.read(), partial, 'The info modal pauses automated playback.');
app.get('ppa-close').click();
app = boot(storage); assert.equal(app.get('restart').disabled, true, 'Refresh resumes the lock.');
assert.equal(app.read().ppaCount, 2, 'Refresh does not consume a second item.');
app.finish();
assert.equal(app.read().ppaCount, 2, 'Assisted clear does not reward.');
assert.equal(app.read().bests[0], null, 'Assisted clear does not set a manual best.');
assert.equal(app.get('room-grid').children[1].disabled, false, 'Assisted clear unlocks the next room.');
assert.equal(app.get('undo').disabled, true, 'Assisted moves cannot be undone into manual rewards.');
app.get('restart').click(); app.play(app.solutions[0].solution);
assert.equal(app.read().ppaCount, 3);
app.get('undo').click(); app.advance(); app.press('ArrowUp'); app.advance();
assert.equal(app.read().ppaCount, 3, 'Undo/reclear cannot duplicate the same reward.');
app.get('restart').click(); app.play(app.solutions[0].solution);
assert.equal(app.read().ppaCount, 4, 'A fresh manual replay earns a reward.');
assert.equal(storage.get(originalKey), 'original-save-untouched');

// Reach each room manually, then test its PPA sequence with both animation preferences.
for (let i = 0; i < sources.length; i++) {
  if (i > 0) { app.get('next').click(); app.play(app.solutions[i].solution); }
  const saved = app.read();
  assert.equal(app.get('progress').textContent, `${i + 1} / ${sources.length}`);
  if (i === 7) {
    // A real eight-room save must keep its records and inventory, and open room 9.
    const legacy = { ...saved, current: 7, records: saved.records.slice(0, 8), bests: saved.bests.slice(0, 8), cleared: saved.cleared.slice(0, 8) };
    const migrated = boot(new Map([[key, JSON.stringify(legacy)]]));
    assert.equal(migrated.get('room-grid').children.length, 12);
    assert.equal(migrated.get('progress').textContent, '8 / 12');
    migrated.get('room-grid').children[7].click();
    assert.equal(migrated.read().records.length, 12);
    assert.deepEqual(migrated.read().records.slice(0, 8), legacy.records);
    assert.deepEqual(migrated.read().bests.slice(0, 8), legacy.bests);
    assert.deepEqual(migrated.read().cleared.slice(0, 8), legacy.cleared);
    assert.equal(migrated.read().ppaCount, legacy.ppaCount);
    assert.equal(migrated.get('room-grid').children[8].disabled, false);
    assert.equal(migrated.get('room-grid').children[9].disabled, true);
    assert.match(migrated.get('next').innerHTML, /下一個房間/);
    migrated.press('Enter');
    assert.equal(migrated.read().current, 8, 'The old final-room save continues into room 9.');
    assert.deepEqual(migrated.read().records[8].state, E.parseLevel(sources[8]).initial);
  }
  for (const reduced of [false, true]) {
    const copy = new Map([[key, JSON.stringify(saved)]]), test = boot(copy, reduced);
    test.get('restart').click(); test.get('ppa-use').click(); test.finish();
    const result = test.read();
    assert.ok(E.won(E.parseLevel(sources[i]), result.records[i].state), `PPA must solve room ${i + 1}.`);
    assert.equal(result.ppaCount, saved.ppaCount - 1);
    assert.deepEqual(result.bests[i], saved.bests[i], 'PPA preserves manual bests.');
  }
}

app.press('ArrowDown');
app.press('Enter');
assert.equal(app.read().current, lastRoom, 'Replay also stays in the final room.');
assert.equal(app.read().records[lastRoom].steps, 0);
app.play(app.solutions[lastRoom].solution);
assert.match(app.get('completion-detail').textContent, /12 \/ 12/);
app.press('Enter');
assert.equal(app.read().current, 0, 'The final room default choice returns to the first room.');

let empty = boot(new Map([[key, JSON.stringify({ ppaCount: 0 })]]));
assert.equal(empty.get('ppa-use').disabled, true); empty.get('ppa-use').click();
assert.equal(empty.get('steps').textContent, '000');
const invalid = boot(undefined, false, entries => { entries[0].solution = 'U'; });
invalid.get('ppa-use').click(); assert.equal(invalid.get('ppa-count').textContent, 3);
assert.equal(invalid.get('restart').disabled, false);
const interrupted = boot(); interrupted.get('ppa-use').click(); interrupted.advance(800);
const recovered = boot(interrupted.storage, false, entries => { entries[0].fingerprint = 'outdated'; });
assert.equal(recovered.read().ppaCount, 3, 'Invalid interrupted solution refunds the item.');
assert.equal(recovered.get('restart').disabled, false);
console.log('PASS: Completion arrows/WASD, Enter, focus, repeat protection, completed-room reopen/restore, final-room choices, touch press/hold/release/cancel, multiple pointers, mobile actions/panel, twelve animated PPA solutions, eight-room save migration, reduced motion, input lock, reset, refresh resume, inventory, manual rewards, undo protection, replay, bests, original save isolation, empty inventory and invalid-solution recovery.');
