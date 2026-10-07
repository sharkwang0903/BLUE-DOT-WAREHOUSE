'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const E = require('../engine.js');
const sources = require('../levels.js');
const { solve, expandSolution } = require('./solver.js');

assert.equal(sources.length, 12);
assert.deepEqual(sources.map(source => source.id), Array.from({ length: 12 }, (_, i) => i + 1));
const report = [];
for (const source of sources) {
  const level = E.parseLevel(source), result = solve(level, 1000000);
  assert.ok(result.solved, `Room ${source.id} must have a solution.`);
  if (source.id > 1) assert.ok(result.minimum >= 13, 'Only the first room can be introductory.');
  const solution = expandSolution(level, result.pushes);
  let state = E.copy(level.initial), pushes = 0, slides = 0, stops = 0, gateChanges = 0, gateCrossings = 0;
  const history = [], checkpoints = [], holders = new Set(), ids = new Map(state.boxes.map((pos, i) => [pos, i]));
  for (const key of solution) {
    const before = E.copy(state), direction = E.DIRS.findIndex(d => d.key === key);
    const moved = E.move(level, state, direction);
    assert.ok(moved, 'Every solution move must be legal.');
    assert.notEqual(moved.state, state);
    assert.deepEqual(state, before, 'The engine must not mutate previous states.');
    assert.equal(new Set([moved.state.player, ...moved.state.boxes]).size, level.goals.length + 1);
    history.push(before);
    if (moved.pushed) {
      pushes++;
      const id = ids.get(moved.from); ids.delete(moved.from); ids.set(moved.to, id);
      if (moved.path.length > 2) {
        slides++;
        if (E.isIce(level, moved.to) && moved.state.boxes.includes(E.neighbor(level, moved.to, E.DIRS[direction]))) stops++;
      }
      if (moved.path.some(pos => level.gates.includes(pos))) gateCrossings++;
    }
    if (E.gatesOpen(level, before.boxes) !== E.gatesOpen(level, moved.state.boxes)) gateChanges++;
    state = moved.state;
    checkpoints.push({ key, player: state.player, boxes: state.boxes.join(','), wait: moved.path.length > 2 ? 315 : 125 });
    for (const plate of level.plates) if (ids.has(plate)) holders.add(ids.get(plate));
  }
  assert.ok(E.won(level, state)); assert.equal(pushes, result.minimum);
  // Undo the entire solution, including slides and circuit changes.
  while (history.length) state = history.pop();
  assert.deepEqual(state, level.initial);
  if (level.gates.length) {
    assert.ok(gateChanges >= 3 && holders.size >= 2 && gateCrossings >= 1, 'The circuit must require box exchange.');
    const closed = E.parseLevel({ ...source, map: source.map.map(row => row.replaceAll('|', '#')) });
    const withoutGate = solve(closed, 1000000);
    assert.equal(withoutGate.exhausted, false);
    assert.equal(withoutGate.solved, false, 'The gate must be essential.');
  }
  if (level.tiles.some(tile => tile === '~' || tile === '*')) assert.ok(slides > 0, 'Ice must be used.');
  if (source.id >= 9) {
    assert.ok(level.gates.length && level.tiles.some(tile => tile === '~' || tile === '*'), 'Every new room combines ice and gates.');
    assert.ok(slides >= 3, 'Mixed rooms must use ice repeatedly.');
    if (source.id <= 11) assert.ok(pushes >= 21 && pushes <= 29, 'Rooms 9–11 match the late-game difficulty band.');
    else {
      assert.equal(level.goals.length, 4, 'The final room coordinates four boxes.');
      assert.ok(pushes >= 33 && pushes <= 38 && stops >= 2, 'The boss combines a long plan with deliberate box brakes.');
    }
    // Check that the ice changes the puzzle, rather than decorating unused floor.
    const dry = solve(E.parseLevel({ ...source, map: source.map.map(row => row.replaceAll('~', ' ').replaceAll('*', '.')) }), 1000000);
    assert.ok(!dry.exhausted, 'The dry-room comparison must finish its search.');
    assert.ok(!dry.solved || dry.minimum !== pushes, 'Removing the ice must change the solution requirements.');
  }
  const row = { room: source.id, name: source.name, size: `${level.width}x${level.height}`, boxes: level.goals.length,
    minimumPushes: pushes, replaySteps: solution.length, visitedStates: result.visited, gateChanges, distinctPlateHolders: holders.size,
    gateCrossings, slides, boxStops: stops, solution, checkpoints };
  report.push(row); console.log(JSON.stringify({ ...row, solution: undefined, checkpoints: undefined }));
}

// Focused boundary cases for the two mechanisms, shared by game and solver.
const slideRoom = E.parseLevel({ map: ['########','#      #','# ~~~ .#','#      #','########'], player:[1,2], boxes:[[2,2]] });
const sliding = E.move(slideRoom, slideRoom.initial, 1);
assert.equal(sliding.to, 2 * 8 + 5, 'A box leaves the ice and stops on the first dry cell.');
assert.equal(sliding.state.player, 2 * 8 + 2, 'Only the box slides.');
assert.equal(sliding.path.length, 4);
const gateRoom = E.parseLevel({ map: ['########','#o | . #','#      #','#    . #','########'], player:[2,2], boxes:[[1,1],[2,1]] });
assert.equal(E.gatesOpen(gateRoom, gateRoom.initial.boxes), true);
assert.equal(E.move(gateRoom, { player: 10, boxes:[9,12] }, 1).state.player, 11, 'An open gate is walkable.');
assert.equal(E.move(gateRoom, { player: 10, boxes:[17,12] }, 1), null, 'A shut gate blocks entry.');
assert.equal(E.move(gateRoom, { player: 10, boxes:[17,11] }, 1).state.player, 11, 'An occupied gate can be vacated without trapping its box.');
assert.equal(E.move(gateRoom, { player: 11, boxes:[17,12] }, 2).state.player, 19, 'A player inside a closing gate can leave.');
assert.equal(E.move(slideRoom, { player: 9, boxes:[18] }, 0), null, 'Wall bumps are ignored.');
fs.writeFileSync(__dirname + '/verification.json', JSON.stringify(report, null, 2));
console.log(`PASS: ${sources.length} exact solutions, full undo replay, essential circuits, ice, gate occupancy, walls.`);
