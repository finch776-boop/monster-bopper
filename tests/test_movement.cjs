const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const helpers = source.slice(source.indexOf('function craterFloorAt('), source.indexOf('function recoverPlayer('));
const start = source.indexOf('// A gentle rim lift');
const landing = source.slice(start, source.indexOf('  lastFloorPlat = floorPlat;', start));
function step(overrides = {}) {
  const state = {
    camera: {position: {x: 0, y: 1.7, z: 0}}, EYE: 1.7,
    inside: false, INSIDE_POS: {y: 1.7}, craters: [], platforms: [],
    CASTLE: {on: false}, chunks: new Map(), previousFeet: 0, velY: -1,
    OBBY: {on:false}, OBBY_LAVA_Y:.15,
    PARTY: {on:false}, ANIMAL: {on:false}, ADV: {on:false},
    onGround: true, jumpsLeft: 0, titan: {dbljump: false}, snd: {ready: false},
    THEMES: [{name: 'MOON'}], themeIndex: 0, moving: true, ...overrides
  };
  vm.createContext(state);
  vm.runInContext(helpers + landing, state);
  return state;
}
const crater = {x: 0, z: 0, r: 5, depth: 8};
const rim = step({craters: [crater], camera: {position: {x: 4.5, y: -6, z: 0}}, previousFeet: -8});
assert.equal(rim.camera.position.x, 4.5, 'The rim must never push the player back into the pit');
assert.ok(rim.camera.position.y >= rim.EYE, 'Walking to the rim lifts the player to safety');
const bridge = step({craters: [crater], platforms: [{x: 0, z: 0, hw: 2, hd: 2, top: 3}], previousFeet: 4, camera: {position: {x: 0, y: 3.7, z: 0}}, velY: -30});
assert.equal(bridge.camera.position.y, 4.7, 'A platform above a crater remains solid during a fast fall');
assert.equal(bridge.onGround, true);
const falling = step({previousFeet: 10, camera: {position: {x: 0, y: 9, z: 0}}, velY: -30});
assert.equal(falling.onGround, false, 'Walking off a ledge clears grounded state');
const jumping = step({platforms: [{x: 0, z: 0, hw: 2, hd: 2, top: 3}], previousFeet: 1, camera: {position: {x: 0, y: 3, z: 0}}, velY: 8});
assert.equal(jumping.camera.position.y, 3, 'Jumping below a platform must not teleport onto it');
const bottom = step({craters: [crater], previousFeet: -7, camera: {position: {x: 0, y: -8, z: 0}}, velY: -20});
assert.equal(bottom.camera.position.y, -6.3, 'Crater bottoms still stop a fall');
console.log('5 movement regression scenarios passed');
