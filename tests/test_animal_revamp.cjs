const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const storage = new Map(), nodes = new Map(), awards = [], broadcasts = [];
const element = id => { if (!nodes.has(id)) nodes.set(id, {style:{},textContent:''}); return nodes.get(id); };
const state = {
  document:{body:{classList:{add(){},remove(){}}}},
  player:'Rescue tester', EYE:1.7, clamp:(v,a,b)=>Math.max(a,Math.min(b,v)), $:element,
  THREE:{Vector3:class { constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});} }},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  camera:{position:{x:0,y:1.7,z:0}}, NET:{on:false,host:false,hostTok:'trusted-host',peers:new Map(),monsters:new Map()},
  performance:{now:()=>1000}, banner(){}, beep(){}, showPopup(){}, poof(){},
  awardTickets:(source,n)=>awards.push([source,n]), netSendAll:m=>broadcasts.push(m),
  disposeObj(){}, scene:{remove(){}}, monsters:[]
};
vm.createContext(state);
vm.runInContext(source.slice(source.indexOf('const ANIMAL_HABITATS ='), source.indexOf('// ---------- PARTY RUSH')),state);
const run = code => vm.runInContext(code,state);
function station(key, x=0, z=0) {
  const a=run(`ANIMAL_BOOK.find(a=>a.key===${JSON.stringify(key)})`);
  return {key,a,x,z,careX:x,careZ:z,progress:0,done:false,
    meter:{scale:{},position:{}},ring:{material:{color:{setHex(){}}},scale:{setScalar(){}}},
    hinge:{rotation:{y:0}},friend:{position:{},rotation:{}},supply:{scale:{}}};
}
state.makeTestStation=station;
const enter = (key='fox')=>run(`ANIMAL.on=true; ANIMAL.habitat='forest'; ANIMAL.rescues=0; ANIMAL.complete=false; ANIMAL.stations=[makeTestStation('${key}')];`);
assert.equal(run('ANIMAL_BOOK.length'),31);
assert.equal(run('ANIMAL_HABITATS.find(h=>h.key==="dino").theme'),11,'Dinosaur rescue is not Mars');
assert.equal(run('ANIMAL_HABITATS.find(h=>h.key==="arctic").theme'),7,'Arctic rescue does not inherit Moon pits');
assert.equal(run('animalMine().unlocked.rabbit'),1,'Starter pet remains available');
for (const dt of [1/60,1/30,.05]) {
  enter(); state.camera.position={x:0,y:1.7,z:0};
  for(let i=0;i<Math.floor(1/dt);i++)run(`animalTick(${dt})`);
  assert.ok(run('ANIMAL.stations[0].progress')>.9);
  state.camera.position.x=10; const before=run('ANIMAL.stations[0].progress');run(`animalTick(${dt})`);
  assert.ok(run('ANIMAL.stations[0].progress')<before,'Leaving care ring cools progress');
  state.camera.position={x:0,y:7,z:0};run(`animalTick(${dt})`);
  assert.equal(run('ANIMAL.stations[0].done'),false,'Flying/jumping over a ring never completes care');
  state.camera.position={x:0,y:1.7,z:0};
  for(let i=0;i<Math.ceil(3/dt);i++)run(`animalTick(${dt})`);
  assert.equal(run('ANIMAL.stations[0].done'),true,'Holding near friend rescues them');
  assert.equal(run('ANIMAL.rescues'),1);assert.equal(run('ANIMAL.complete'),true);
}
assert.deepEqual(awards,[['animal:fox',2]],'A new rescue earns two tickets only once across retries');
assert.equal(run('animalMine().unlocked.fox'),1);
assert.equal(run('animalRescueBop()'),false,'Shooting is not a rescue requirement');
assert.equal(run('animalNearCare(ANIMAL.stations[0],{x:NaN,y:1.7,z:0})'),false);
assert.equal(run('animalNearCare(ANIMAL.stations[0],{x:0,y:1.7,z:Infinity})'),false);

enter('wolf'); state.NET.on=true;state.NET.host=false;state.camera.position={x:0,y:1.7,z:0};
for(let i=0;i<50;i++)run('animalTick(.1)');
assert.equal(run('ANIMAL.stations[0].progress'),0,'A guest cannot grant local progress');
run(`animalNetMessage('untrusted',{}, {t:'animalSync',habitat:'forest',stations:[['wolf',1,2.5]]})`);
assert.equal(run('ANIMAL.stations[0].done'),false,'A non-host peer cannot forge a rescue');
run(`animalNetMessage('trusted-host',{}, {t:'animalSync',habitat:'ocean',stations:[['wolf',1,2.5]]})`);
assert.equal(run('ANIMAL.stations[0].done'),false,'Mismatched habitat snapshots are ignored');
run(`animalNetMessage('trusted-host',{}, {t:'animalSync',habitat:'forest',stations:[['wolf',0,1.2]]})`);
assert.equal(run('ANIMAL.stations[0].progress'),1.2);
run(`animalNetMessage('trusted-host',{}, {t:'animalSync',habitat:'forest',stations:[['wolf',1,2.5]]})`);
run(`animalNetMessage('trusted-host',{}, {t:'animalSync',habitat:'forest',stations:[['wolf',1,2.5]]})`);
assert.equal(run('animalMine().unlocked.wolf'),1);
assert.equal(awards.filter(x=>x[0]==='animal:wolf').length,1,'Repeated network state is reward-idempotent');

enter('bear'); state.NET.host=true;state.camera.position={x:25,y:1.7,z:25};
state.NET.peers.set('guest',{lastSeen:999,ch:{readyState:'open'},tgt:{x:0,y:1.7,z:0}});
for(let i=0;i<27;i++)run('animalTick(.1)');
assert.equal(run('ANIMAL.stations[0].done'),true,'Host observes guest care position and completes cooperative rescue');
assert.ok(broadcasts.some(m=>m.t==='animalSync'&&m.stations[0][1]===1),'Host broadcasts completed rescue');
enter('owl');state.NET.peers.get('guest').lastSeen=-9999;
for(let i=0;i<30;i++)run('animalTick(.1)');
assert.equal(run('ANIMAL.stations[0].done'),false,'Stale disconnected positions cannot keep rescuing');

storage.set('mb_animals',JSON.stringify({'Old player':{unlocked:{rabbit:1,dragon:1},active:'dragon',total:14}}));
state.player='Old player';assert.equal(run('activeAnimal().key'),'dragon','Existing earned pets and equipped ability survive');
assert.equal(run('animalMine().total'),14);
let disposedMaps=0;state.testTexture={dispose(){disposedMaps++;}};
run('ANIMAL.group={traverse(cb){cb({material:{map:testTexture}});cb({material:{map:testTexture}});}};ANIMAL.snow={};animalCleanup()');
assert.equal(disposedMaps,1,'Shared habitat textures dispose once');
assert.equal(run('ANIMAL.stations.length'),0);assert.equal(run('ANIMAL.group'),null);assert.equal(run('ANIMAL.snow'),null);
assert.equal(run('ANIMAL.on'),false);
console.log('PASS: friendly care loop at 20/30/60 fps, earned pets/tickets, host authority, guest snapshots, stale-peer rejection and cleanup');
