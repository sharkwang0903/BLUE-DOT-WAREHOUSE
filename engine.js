/* Shared rules: the browser and the offline verifier run exactly the same moves. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BlueBoxEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DIRS = Object.freeze([
    { x: 0, y: -1, key: 'U' }, { x: 1, y: 0, key: 'R' },
    { x: 0, y: 1, key: 'D' }, { x: -1, y: 0, key: 'L' }
  ]);

  function parseLevel(source) {
    const height = source.map.length;
    const width = source.map[0].length;
    if (width > 8 || height > 8 || source.map.some(row => row.length !== width)) {
      throw new Error('Every room must be rectangular and at most 8 × 8.');
    }
    const tiles = source.map.join('').split('');
    const goals = [];
    const plates = [];
    const gates = [];
    tiles.forEach((tile, pos) => {
      if (tile === '.' || tile === '*' || tile === '+') goals.push(pos);
      if (tile === 'o' || tile === '+') plates.push(pos);
      if (tile === '|') gates.push(pos);
    });
    const index = ([x, y]) => y * width + x;
    const level = { ...source, width, height, tiles, goals, plates, gates };
    level.initial = { player: index(source.player), boxes: source.boxes.map(index).sort((a, b) => a - b) };
    if (level.initial.boxes.length !== goals.length) throw new Error('Box / goal count differs.');
    if (new Set(level.initial.boxes).size !== level.initial.boxes.length || level.initial.boxes.includes(level.initial.player)) {
      throw new Error('Overlapping starting objects.');
    }
    for (const pos of [level.initial.player, ...level.initial.boxes]) {
      if (pos < 0 || pos >= tiles.length || tiles[pos] === '#') throw new Error('Invalid starting position.');
    }
    return level;
  }

  function neighbor(level, pos, dir) {
    const x = pos % level.width + dir.x;
    const y = Math.floor(pos / level.width) + dir.y;
    return x < 0 || y < 0 || x >= level.width || y >= level.height ? -1 : y * level.width + x;
  }
  function gatesOpen(level, boxes) {
    return level.plates.length > 0 && level.plates.every(pos => boxes.includes(pos));
  }
  function passable(level, pos, open) {
    return pos >= 0 && level.tiles[pos] !== '#' && (level.tiles[pos] !== '|' || open);
  }
  function turnAt(level, pos) { return level.tiles[pos] === 'r' ? 1 : level.tiles[pos] === 'l' ? -1 : 0; }
  function isIce(level, pos) { return level.tiles[pos] === '~' || level.tiles[pos] === '*' || turnAt(level, pos) !== 0; }
  function won(level, state) { return level.goals.every(pos => state.boxes.includes(pos)); }
  function copy(state) { return { player: state.player, boxes: [...state.boxes] }; }

  function move(level, state, direction) {
    const dir = typeof direction === 'number' ? DIRS[direction] : direction;
    const next = neighbor(level, state.player, dir);
    const boxIndex = state.boxes.indexOf(next);
    const open = gatesOpen(level, state.boxes);
    // A box can be pushed out of a shut gate, but a shut gate cannot be entered.
    if (!passable(level, next, open) && !(boxIndex >= 0 && level.tiles[next] === '|')) return null;
    if (boxIndex < 0) {
      return { state: { player: next, boxes: [...state.boxes] }, pushed: false, path: [] };
    }
    const remaining = state.boxes.filter((_, i) => i !== boxIndex);
    let destination = neighbor(level, next, dir);
    if (!passable(level, destination, gatesOpen(level, remaining)) || remaining.includes(destination)) return null;
    const path = [next, destination];
    let slideDir = dir, turns = 0;
    const slidingStates = new Set();
    while (isIce(level, destination)) {
      const key = `${destination}:${slideDir.x},${slideDir.y}`;
      // A closed skating loop has no landing; reject the entire push atomically.
      if (slidingStates.has(key)) return null;
      slidingStates.add(key);
      const turn = turnAt(level, destination);
      if (turn) {
        slideDir = turn > 0 ? { x: -slideDir.y, y: slideDir.x } : { x: slideDir.y, y: -slideDir.x };
        turns++;
      }
      const ahead = neighbor(level, destination, slideDir);
      const interim = [...remaining, destination];
      // The player now stands in the box's old square, including on curved paths.
      if (!passable(level, ahead, gatesOpen(level, interim)) || remaining.includes(ahead) || ahead === next) break;
      destination = ahead;
      path.push(destination);
    }
    const boxes = [...remaining, destination].sort((a, b) => a - b);
    return { state: { player: next, boxes }, pushed: true, path, from: next, to: destination, turns, slideDir };
  }

  function reachable(level, state) {
    const open = gatesOpen(level, state.boxes);
    const seen = new Set([state.player]);
    const queue = [state.player];
    for (let i = 0; i < queue.length; i++) {
      for (const dir of DIRS) {
        const pos = neighbor(level, queue[i], dir);
        if (passable(level, pos, open) && !state.boxes.includes(pos) && !seen.has(pos)) {
          seen.add(pos); queue.push(pos);
        }
      }
    }
    return seen;
  }
  function stateKey(level, state) {
    return state.boxes.join(',') + ':' + Math.min(...reachable(level, state));
  }
  return Object.freeze({ DIRS, parseLevel, neighbor, gatesOpen, passable, isIce, turnAt, won, copy, move, reachable, stateKey });
});
