const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const nodes = new Map();
const node = id => { if (!nodes.has(id)) nodes.set(id, { textContent: '', classList: { toggle() {} } }); return nodes.get(id); };
const awards = [], sent = [];
class Vector3 { constructor(x=0,y=0,z=0) { Object.assign(this,{x,y,z}); } clone() { return new Vector3(this.x,this.y,this.z); } add(v) { this.x+=v.x; this.y+=v.y; this.z+=v.z; return this; } }
const state = {
  THREE: { Vector3, Raycaster:class{}, DoubleSide:2 },
  NET: { on:false, host:false, monsters:new Map() },
  $:node, document:{querySelectorAll:()=>[]},
  scene:{remove(){}}, clock:{elapsedTime:0}, camera:{position:new Vector3()}, EYE:1.7,
  onGround:true, pendingBooms:[], discoBlocks:[], monsters:[], fortDirtyT:0,
  NIGHT:{on:false}, rand:a=>a, poof(){}, disposeObj(){}, beep(){}, banner(){}, spawnPickup(){},
  startNightmare(){}, endNightmare(){}, awardTickets:(source,amount)=>awards.push([source,amount]),
  netSendAll:m=>sent.push(m), syncFort(){}, toon:()=>({}), platforms:[]
};
vm.createContext(state);
const run = code => vm.runInContext(code,state);
run(source.slice(source.indexOf('const CASTLE ='),source.indexOf('// Family multiplayer uses')));
const reset = () => run(`CASTLE.on=true;CASTLE.creative=false;CASTLE.phase='build';CASTLE.night=0;CASTLE.t=45;
  CASTLE.heartHp=100;CASTLE.heartMax=220;CASTLE.repairT=0;CASTLE.repairUsed=false;CASTLE.forge=null;
  CASTLE.inv={wood:12,stone:4,metal:0,gold:20,lava:1,bouncy:2,water:3,ice:2,glass:2,disco:0,boom:1,torch:2};
  NET.on=false;NET.host=false;`);
for (const dt of [1/60,1/30,.05]) {
  reset();
  for (let i=0;i<Math.round(3/dt)-1;i++) assert.equal(run(`castleRepairStep(${dt},true,true,true)`),'charging');
  assert.equal(run('CASTLE.inv.gold'),20,'No early spending');
  assert.equal(run(`castleRepairStep(${dt},true,true,true)`),'bought');
  assert.equal(run('CASTLE.inv.gold'),15); assert.equal(run('CASTLE.heartHp'),170);
  for (let i=0;i<200;i++) assert.equal(run(`castleRepairStep(${dt},true,true,true)`),'used');
  assert.equal(run('CASTLE.inv.gold'),15,'No repeated drain while staying in ring');
  assert.equal(run('castleRepairStep(.1,false,true,true)'),'away');
  assert.equal(run('castleRepairStep(3,true,true,true)'),'bought');
  assert.equal(run('CASTLE.heartHp'),220,'Repairs cap at max health');
}
for (const [setup,expected] of [
  ['CASTLE.inv.gold=4','poor'], ['CASTLE.heartHp=220','full'],
  ["CASTLE.phase='night'",'night'], ['CASTLE.creative=true','night'],
  ['NET.on=true;NET.host=false','host']
]) { reset();run(setup);const before=run('CASTLE.inv.gold');assert.equal(run('castleRepairStep(4,true,true,true)'),expected);assert.equal(run('CASTLE.inv.gold'),before); }
reset();
run('castleRepairStep(2,true,true,true)');
assert.equal(run('castleRepairStep(.05,true,false,true)'),'ready');
assert.equal(run('CASTLE.repairT'),0,'Walking cancels repair');
run('castleRepairStep(2,true,true,true)');
assert.equal(run('castleRepairStep(.05,true,true,false)'),'ready');
assert.equal(run('CASTLE.repairT'),0,'Jumping cancels repair');
reset();run('NET.on=true;NET.host=true');
assert.equal(run('castleRepairStep(3,true,true,true)'),'bought','Host can repair');
console.log('Castle repair: 3-second dwell at 20/30/60fps, cancellation, cost/cap, one purchase per visit, guest protection passed');

reset();run("CASTLE.phase='night';CASTLE.night=1;CASTLE.t=.01;CASTLE.toSpawn=0;castleTick(.05)");
assert.equal(run('CASTLE.phase'),'build');assert.equal(run('CASTLE.inv.gold'),23);
assert.deepEqual(awards,[['castle',3]]);
run('castleTick(.05)');assert.equal(awards.length,1,'One reward per survived night');
reset();run("NET.on=true;NET.host=false;CASTLE.phase='night';CASTLE.night=1;CASTLE.t=.01;CASTLE.toSpawn=0;castleTick(.05)");
assert.equal(awards.length,1,'Guests cannot grant host-authoritative survival rewards');
assert.equal(run('CASTLE.phase'),'night');assert.equal(run('CASTLE.inv.gold'),20);
console.log('Castle progression: survived night grants 3 gold and 3 tickets once; guests cannot finish host rounds');

const shader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};
state.shader=shader;run('castleSurfaceMaterial({}).onBeforeCompile(shader)');
assert.match(shader.vertexShader,/attribute float castleMat/);
assert.match(shader.vertexShader,/vCastleMat = castleMat/);
assert.match(shader.fragmentShader,/float grain/);assert.match(shader.fragmentShader,/float rivet/);
assert.match(shader.fragmentShader,/float diamond/);assert.match(shader.fragmentShader,/float joint/);
assert.match(source,/g\.setAttribute\('castleMat', new THREE\.Float32BufferAttribute\(a\.ids, 1\)\)/);
assert.match(source,/if \(CASTLE\.forge\) \{ disposeObj\(CASTLE\.forge\); scene\.remove\(CASTLE\.forge\); CASTLE\.forge = null; \}/);
console.log('Castle surfaces: per-material shader wiring and forge cleanup verified; browser WebGL/visual verification still required');
