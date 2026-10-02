const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const storage = new Map();
const nodes = new Map();
function element(id) {
  if (!nodes.has(id)) nodes.set(id, {hidden:false, textContent:'', innerHTML:'', classList:{add(){},remove(){}}});
  return nodes.get(id);
}
const state = {
  THREE:{Vector3:class {constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});} copy(v){Object.assign(this,v);return this;}}}, EYE:1.7,
  player:'Test player', clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  camera:{position:{copy(v){Object.assign(this,v);return this;}}},
  velY:-30,dashT:.2,iceVel:{set(){}},onIceP:true,inWaterP:true,onGround:true,jumpsLeft:1,yaw:2,pitch:1,
  snd:{ready:false},banner(){},beep(){},noise(){},bumpStat(){},flashScreen(){},awardTickets(){},
  obbyCleanup(){},music(){},startMenuDemo(){},playing:true,mouseDown:true,
  document:{body:{classList:{remove(){}}}}, $:element,
  selectScreen:element('select'),pauseScreen:element('pause'),overScreen:element('over'),overlay:element('overlay'),hud:element('hud')
};
vm.createContext(state);
vm.runInContext(source.slice(source.indexOf('const OBBY ='),source.indexOf('function obbyCleanup()')),state);
const run = code=>vm.runInContext(code,state);
assert.equal(run('OBBY_COURSES.length'),20);
assert.equal(run('OBBY_WORLDS.length'),5);
let checked = 0;
for(let level=0;level<20;level++) {
  const route=run(`obbyLayout(${level})`);
  let previous={x:0,z:30,y:.65,width:7,kind:0};
  for(const p of route) {
    // Worst mover separation, using takeoff/landing edges. Simulate the same
    // semi-implicit gravity step as the game at both normal and low frame rates.
    const separation=Math.hypot(p.x-previous.x,p.z-previous.z)+(p.kind===3?1.1:0)+(previous.kind===3?1.1:0);
    const needed=Math.max(0,separation-previous.width/2-p.width/2+.4);
    for(const dt of [1/60,1/30,.05]) {
      let feet=previous.y, velocity=previous.kind===5?15:10.5, distance=0, landed=false;
      for(let frame=0;frame<180;frame++) {
        const last=feet; velocity-=22*dt; feet+=velocity*dt; distance+=11*dt;
        if(velocity<=0 && last>=p.y && feet<=p.y){landed=distance>=needed;break;}
      }
      assert.ok(landed,`Course ${level+1}: jump to platform ${++checked} must be reachable at dt=${dt}`);
    }
    assert.ok(Math.abs(p.x)<97 && Math.abs(p.z)<97,'Course stays within world boundaries');
    previous=p;
  }
}
assert.equal(run('obbyTouchesLava(.15,null)'),true);
assert.equal(run('obbyTouchesLava(2,null)'),false);
assert.equal(run('obbyTouchesLava(.65,{top:.65})'),false);
assert.equal(run('obbyContains({x:0,z:0,hw:3,hd:3},0,0)'),true);
assert.equal(run('obbyContains({x:0,z:0,hw:3,hd:3,polygon:[[-1,-2],[1,-2],[2,-1],[2,1],[1,2],[-1,2],[-2,1],[-2,-1]]},1.8,1.8)'),false,'Chipped corners do not allow invisible landings');
assert.equal(run('obbyContains({x:0,z:0,hw:3,hd:3,polygon:[[-1,-2],[1,-2],[2,-1],[2,1],[1,2],[-1,2],[-2,1],[-2,-1]]},0,0)'),true,'Rock centre stays safely landable');
assert.equal(run('obbyEruptionPhase(4.99)'), 'rest');
assert.equal(run('obbyEruptionPhase(5)'), 'warning');
assert.equal(run('obbyEruptionPhase(7.99)'), 'warning');
assert.equal(run('obbyEruptionPhase(8)'), 'erupt');
assert.equal(run('obbyEruptionPhase(10)'), 'rest');
for(const dt of [1/60,1/30,.05]) {
  run('var rock={active:true,warn:0,hiddenT:0,standCollapse:true,collapseDelay:3};');
  assert.equal(run(`obbyCollapseStep(rock,${dt},false)`),'','Airborne contact never starts collapse');
  assert.equal(run(`obbyCollapseStep(rock,${dt},true)`),'warn');
  assert.equal(run(`obbyCollapseStep(rock,${dt},false)`),'reset','Jumping away resets continuous standing');
  assert.equal(run('rock.warn'),0);
  for(let frame=0;frame<Math.round(3/dt)-1;frame++)run(`obbyCollapseStep(rock,${dt},true)`);
  assert.equal(run('rock.active'),true,'Rock stays solid until three seconds');
  assert.equal(run(`obbyCollapseStep(rock,${dt},true)`),'drop');
  assert.equal(run('rock.active'),false,'Collapsed rock cannot collide');
  for(let frame=0;frame<Math.round(3/dt)-1;frame++)run(`obbyCollapseStep(rock,${dt},false)`);
  assert.equal(run('rock.active'),false,'Rock waits three seconds to return');
  assert.equal(run(`obbyCollapseStep(rock,${dt},false)`),'restore');
  assert.equal(run('rock.active && rock.warn===0 && rock.fallT===0'),true,'Rock fully resets');
}
run('var purple={active:true,warn:0,hiddenT:0};obbyCollapseStep(purple,.05,true);');
for(let frame=0;frame<29;frame++)run('obbyCollapseStep(purple,.05,false)');
assert.equal(run('purple.active'),false,'Earlier purple tiles keep their committed 1.5-second timer');
console.log('Grounded dwell, jump reset, three-second drop/restore and legacy crumble passed at 20/30/60 fps');
for(const dt of [1/60,1/30,.05]) {
  run('var glass={active:true,warn:0,hiddenT:0,standCollapse:true,collapseDelay:4};');
  assert.equal(run(`obbyCollapseStep(glass,${dt},false)`),'');
  for(let frame=0;frame<Math.round(4/dt)-1;frame++)run(`obbyCollapseStep(glass,${dt},true)`);
  assert.equal(run('glass.active'),true,'Glass remains solid until four seconds');
  assert.equal(run(`obbyCollapseStep(glass,${dt},true)`),'drop');
  for(let frame=0;frame<Math.round(3/dt);frame++)run(`obbyCollapseStep(glass,${dt},false)`);
  assert.equal(run('glass.active && glass.warn===0'),true,'Glass regenerates after three seconds');
  run(`obbyCollapseStep(glass,${dt},true)`);
  assert.equal(run(`obbyCollapseStep(glass,${dt},false)`),'reset','Leaving glass clears stress');
}
console.log('Four-second glass stress, jump reset and regeneration passed at 20/30/60 fps');
run('OBBY.cpPos = new THREE.Vector3(3,6,-20); OBBY.falls=0; obbyRespawn()');
assert.equal(state.camera.position.x,3); assert.equal(state.camera.position.y,6);
assert.equal(state.velY,0); assert.equal(state.dashT,0); assert.equal(state.onIceP,false);
assert.equal(run('OBBY.falls'),1); assert.equal(state.yaw,0);
vm.runInContext(source.slice(source.indexOf('function obbyFinish()'),source.indexOf('function obbyTick(')),state);
for(let level=0;level<20;level++) {
  run('OBBY.starSeen=new Set([0,2])');
  run(`OBBY.level=${level}; OBBY.t=20+${level}; OBBY.done=false; obbyFinish()`);
  assert.equal(run('obbyUnlocked()'),Math.min(19,level+1));
  assert.equal(JSON.parse(storage.get('mb_lava_courses'))['Test player'].bests[level],20+level);
  assert.equal(element('obbyNext').hidden,level===19);
  assert.deepEqual(JSON.parse(storage.get('mb_lava_courses'))['Test player'].stars[level],[0,2]);
}
run('OBBY.level=0; OBBY.t=99; OBBY.done=false; OBBY.starSeen=new Set([1]); obbyFinish()');
assert.equal(JSON.parse(storage.get('mb_lava_courses'))['Test player'].bests[0],20,'Replay preserves faster best time');
assert.deepEqual(JSON.parse(storage.get('mb_lava_courses'))['Test player'].stars[0],[0,2,1],'Replay merges collected stars');
state.player='Other player'; assert.equal(run('obbyUnlocked()'),0,'Unlocks belong to each local player');
storage.set('mb_lava_courses',JSON.stringify({'Other player':{unlocked:3,bests:{0:11}}}));
assert.equal(run('obbyUnlocked()'),3,'Old campaign unlocks survive expansion');
assert.equal(run('obbyProgress()[player].legacyBests[0]'),11,'Short-course records are archived');
assert.equal(run('obbyProgress()[player].bests[0]'),undefined,'New longer courses do not inherit impossible old records');
storage.set('mb_lava_courses','broken'); assert.equal(run('obbyUnlocked()'),0,'Broken save falls back safely');
console.log(`20 course progressions, ${checked} jump/frame-rate cases, star replay persistence, lava contact, checkpoint recovery and player save isolation passed`);
