'use strict';
const assert = require('node:assert/strict');
const E = require('../engine.js');
const flat = ['#######','#     #','#     #','#  r  #','#   . #','#     #','#######'];
const setups = [
  { box:[3,4], player:[3,5] }, { box:[2,3], player:[1,3] },
  { box:[3,2], player:[3,1] }, { box:[4,3], player:[5,3] }
];
for (const turn of ['r','l']) for (let d=0;d<4;d++) {
  const level=E.parseLevel({map:flat.map(row=>row.replace('r',turn)),player:setups[d].player,boxes:[setups[d].box]});
  const before=E.copy(level.initial), moved=E.move(level,level.initial,d), out=(d+(turn==='r'?1:3))%4;
  const expected=E.neighbor(level,24,E.DIRS[out]);
  assert.equal(moved.to,expected,`${turn} rotates entry direction ${d} by exactly 90 degrees.`);
  assert.equal(moved.turns,1);assert.equal(moved.path.length,3);
  assert.equal(moved.state.player,before.boxes[0]);assert.deepEqual(level.initial,before);
}
const walk=E.parseLevel({map:flat,player:[2,3],boxes:[[5,5]]});
const step=E.move(walk,walk.initial,1);
assert.equal(step.state.player,24);assert.equal(step.pushed,false,'The player walks normally across a turn tile.');

const chain=E.parseLevel({map:flat.map((row,y)=>y===4?'#  l. #':row),player:[1,3],boxes:[[2,3]]});
const curved=E.move(chain,chain.initial,1);
assert.equal(curved.turns,2);assert.deepEqual(curved.path,[23,24,31,32]);assert.ok(E.won(chain,curved.state));
const before=E.copy(chain.initial);assert.deepEqual(chain.initial,before);

const wall=E.parseLevel({map:flat.map((row,y)=>y===4?'#  #. #':row),player:[1,3],boxes:[[2,3]]});
assert.equal(E.move(wall,wall.initial,1).to,24,'A wall after the turn stops the box on the turning tile.');
const brake=E.parseLevel({map:flat.map((row,y)=>y===4?'#   ..#':row),player:[1,3],boxes:[[2,3],[3,4]]});
assert.equal(E.move(brake,brake.initial,1).to,24,'Another box can brake a turn before the next segment.');

const loop=E.parseLevel({map:['#######','#     #','# rr  #','# rr .#','#     #','#     #','#######'],player:[2,4],boxes:[[2,3]]});
const looped=E.move(loop,loop.initial,0);
assert.equal(looped.to,24);assert.equal(looped.turns,3);
assert.equal(looped.state.player,23);assert.equal(looped.state.boxes.includes(looped.state.player),false,'A folded route stops before the new player position.');

const vacant=E.parseLevel({map:['#######','#     #','#     #','#  r .#','#r~r  #','#     #','#######'],player:[1,3],boxes:[[2,3]]});
const around=E.move(vacant,vacant.initial,1);
assert.equal(around.to,22,'The player\'s old square is vacant after pushing and may be a landing.');
assert.equal(around.turns,3);assert.equal(around.state.player,23);

const gate=E.parseLevel({map:['#######','#o    #','#     #','#  r  #','#  |. #','#   . #','#######'],player:[1,3],boxes:[[2,3],[2,1]]});
assert.equal(E.move(gate,gate.initial,1).to,24,'A closed gate blocks the outgoing curve.');
assert.equal(E.move(gate,{player:22,boxes:[8,23]},1).to,31,'A held plate lets the curved route enter the gate.');
const release=E.parseLevel({map:['#######','#     #','#     #','# +r  #','#  |. #','#     #','#######'],player:[1,3],boxes:[[2,3],[2,1]]});
assert.ok(E.gatesOpen(release,release.initial.boxes));
const released=E.move(release,release.initial,1);
assert.equal(released.to,24);assert.equal(E.gatesOpen(release,released.state.boxes),false,'Gate occupancy is recalculated during a curved slide.');
console.log('PASS: Both turns in all four directions, normal walking, chained curves, dry landing, walls, box brakes, folded loops, player collision, vacated origin, gates and plate release.');
