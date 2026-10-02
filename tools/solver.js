'use strict';
const E = require('../engine.js');

// Breadth-first search over pushes. Walking regions are canonicalized, so every
// reported minimum is exact; no heuristic pruning can hide a valid solution.
function solve(level, limit = 300000) {
  const start = E.copy(level.initial);
  const nodes = [{ state: start, parent: -1, push: null, depth: 0 }];
  const seen = new Set([E.stateKey(level, start)]);
  for (let i = 0; i < nodes.length; i++) {
    const current = nodes[i];
    if (E.won(level, current.state)) {
      const pushes = [];
      let n = i;
      while (nodes[n].parent !== -1) { pushes.push(nodes[n].push); n = nodes[n].parent; }
      return { solved: true, minimum: current.depth, visited: seen.size, pushes: pushes.reverse() };
    }
    const region = E.reachable(level, current.state);
    for (const box of current.state.boxes) {
      for (let d = 0; d < 4; d++) {
        const dir = E.DIRS[d];
        const behind = E.neighbor(level, box, { x: -dir.x, y: -dir.y });
        if (!region.has(behind)) continue;
        const result = E.move(level, { player: behind, boxes: current.state.boxes }, d);
        if (!result || !result.pushed) continue;
        const key = E.stateKey(level, result.state);
        if (seen.has(key)) continue;
        seen.add(key);
        nodes.push({ state: result.state, parent: i, push: { box, dir: d }, depth: current.depth + 1 });
        if (seen.size > limit) return { solved: false, exhausted: true, visited: seen.size };
      }
    }
  }
  return { solved: false, exhausted: false, visited: seen.size };
}

function walk(level, state, destination) {
  const queue = [state.player];
  const previous = new Map([[state.player, null]]);
  const open = E.gatesOpen(level, state.boxes);
  for (let i = 0; i < queue.length && !previous.has(destination); i++) {
    for (let d = 0; d < 4; d++) {
      const pos = E.neighbor(level, queue[i], E.DIRS[d]);
      if (E.passable(level, pos, open) && !state.boxes.includes(pos) && !previous.has(pos)) {
        previous.set(pos, { from: queue[i], dir: d }); queue.push(pos);
      }
    }
  }
  if (!previous.has(destination)) throw new Error('Unreachable solver step.');
  const moves = [];
  for (let pos = destination; previous.get(pos); pos = previous.get(pos).from) moves.push(previous.get(pos).dir);
  return moves.reverse();
}
function expandSolution(level, pushes) {
  let state = E.copy(level.initial);
  const moves = [];
  for (const push of pushes) {
    const dir = E.DIRS[push.dir];
    const behind = E.neighbor(level, push.box, { x: -dir.x, y: -dir.y });
    for (const d of [...walk(level, state, behind), push.dir]) {
      const result = E.move(level, state, d);
      if (!result) throw new Error('Solver generated an illegal move.');
      moves.push(d); state = result.state;
    }
  }
  if (!E.won(level, state)) throw new Error('Solver replay did not win.');
  return moves.map(d => E.DIRS[d].key).join('');
}
module.exports = { solve, expandSolution };
