const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

(async () => {
  // Use the shipped Three.js, not mesh mocks, so generated props and cleanup run.
  const THREE = await import('data:text/javascript;base64,' + fs.readFileSync(path.join(__dirname, '../three.module.js')).toString('base64'));
  const source = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const nodes = new Map(), storage = new Map(), tickets = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {style:{},textContent:'',innerHTML:'',children:[],classList:{add(){},remove(){}},addEventListener(){},appendChild(n){this.children.push(n);}});
    return nodes.get(id);
  };
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const state = {THREE,scene,camera,player:'Tester',EYE:1.7,inside:false,maxHP:100,hp:65,lives:3,
    playing:false,mouseDown:false,level:1,themeIndex:0,velY:0,yaw:0,pitch:0,freezeTime:0,shieldTime:0,
    MOVE:10,magnetTime:0,shake:0,bossMaxTotal:0,bossesAlive:0,isTouch:true,missions:[],monsters:[],
    clock:{elapsedTime:0},THEMES:Array.from({length:14},(_,i)=>({name:'World '+i})),
    document:{body:node('body'),createElement:()=>node('created'+Math.random()),getElementById:()=>true,querySelectorAll:()=>[]},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},$:node,
    toon:(color,props={})=>new THREE.MeshStandardMaterial({color,...props}),castS:o=>o,outline(){},
    makeBurger:()=>new THREE.Group(),pickKind:()=>({arche:'walker'}),
    makeMonster(opts={}){const m=new THREE.Group();if(opts.pos)m.position.copy(opts.pos);m.userData={...opts};state.monsters.push(m);scene.add(m);return m;},
    disposeObj(o){o.traverse(c=>{if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();});},
    beep(){},banner(){},poof(){},showPopup(){},updateHP(){},unlockAudio(){},applyTitan(){},
    applyTheme(w){state.themeIndex=w;},setSong(){},updateLevelHud(){},renderMissions(){},spawnSidekick(){},
    music(){},musicStart(){},goFullscreen(){},beginDesktopPlay(){},bossEntrance(fn){fn();},
    flashScreen(){},bumpStat(){},titanSay(){},shuffle:a=>a,setTimeout(){},
    awardTickets:(source,amount)=>tickets.push({source,amount}),hurtPlayer(n){state.hp-=n;},
  };
  for(const id of ['overlay','selectScreen','mapScreen','pauseScreen','overScreen','advEnd','hud','bossNameEl','bossHpEl','bossEl'])state[id]=node(id);
  vm.createContext(state);
  const run = text => vm.runInContext(text,state);
  state.resetGame = () => {run('advCleanup()');for(const m of state.monsters)scene.remove(m);state.monsters.length=0;state.lives=3;};
  run(source.slice(source.indexOf('const ADV_EMOJI ='),source.indexOf('function startGame(fromNetwork)')));
  const adv = run('ADV');

  for(let w=0;w<14;w++)for(let l=0;l<5;l++) {
    run(`startAdvLevel(${w},${l})`);
    assert.equal(adv.world,w);assert.equal(adv.level,l);assert.ok(adv.stage);
    if(adv.phase==='collect') {
      assert.equal(adv.items.length,8+Math.min(6,w));assert.ok(adv.portal);
      adv.items.forEach(it=>{assert.ok(Math.abs(it.position.x)<50&&Math.abs(it.position.z)<50);assert.ok(Math.hypot(it.position.x,it.position.z+66)>8);});
    }
    if(adv.phase==='escape'){assert.equal(adv.gates.length,3);assert.equal(state.monsters.length,0);}
    if(adv.phase==='hunt'){assert.equal(state.monsters.length,5);assert.equal(adv.signals.filter(s=>s.userData.target).length,5);}
  }
  console.log('PASS: all 70 mission entries retain all 14 worlds and build bounded objective props');

  assert.equal(run('advGatePhase(0)'),'open');assert.equal(run('advGatePhase(4.49)'),'open');
  assert.equal(run('advGatePhase(4.5)'),'warning');assert.equal(run('advGatePhase(5.99)'),'warning');
  assert.equal(run('advGatePhase(6)'),'closed');assert.equal(run('advGatePhase(8)'),'open');
  run('startAdvLevel(0,2)');camera.position.set(70,1.7,-60);run('advTick(.01)');
  assert.equal(adv.on,true,'Cannot skip gates and enter locked portal');
  adv.elapsed=6;camera.position.set(10,1.7,55);run('advTick(.01)');assert.equal(adv.routeIndex,0,'Closed gate does not count');
  adv.elapsed=4.6;camera.position.set(10,1.7,55);run('advTick(.01)');assert.equal(adv.routeIndex,1,'Amber stays passable while the warning bar is raised');
  for(let i=0;i<3;i++){adv.elapsed=8-adv.gates[i].offset;camera.position.set(adv.gates[i].x,1.7,adv.gates[i].z);run('advTick(.01)');assert.equal(adv.routeIndex,i+1);}
  camera.position.set(70,1.7,-60);run('advTick(.01)');assert.equal(adv.on,false);assert.equal(tickets.length,1);assert.equal(tickets[0].amount,5);
  run('advComplete()');assert.equal(tickets.length,1,'Repeated completion cannot duplicate tickets');
  console.log('PASS: three sequential gates, advance warning, locked portal and exactly-once completion reward');

  run('startAdvLevel(1,1)');const positions=adv.items.map(o=>[o.position.x,o.position.z]);run('startAdvLevel(1,1)');
  assert.deepEqual(adv.items.map(o=>[o.position.x,o.position.z]),positions,'Star trail is authored, never random');
  while(adv.items.length){camera.position.copy(adv.items[0].position);camera.position.y=1.7;run('advTick(.01)');}
  assert.equal(adv.on,true,'All stars power the portal instead of ending without a destination');
  camera.position.copy(adv.portal.position);camera.position.y=1.7;run('advTick(.01)');assert.equal(adv.on,false);assert.equal(tickets.length,2);
  console.log('PASS: authored star trail powers the visible exit portal');

  run('startAdvLevel(0,1)');adv.defendHp=30;camera.position.set(-10,1.7,14);run('advTickStage(.1)');assert.equal(adv.defendHp,55);
  run('advTickStage(13)');assert.equal(adv.defendHp,55,'Standing on a switch does not auto-farm repair');
  camera.position.set(0,1.7,24);run('advTickStage(.1)');camera.position.set(-10,1.7,14);run('advTickStage(.1)');assert.equal(adv.defendHp,80);
  camera.position.set(-27,1.7,28);state.hp=60;run('advTickStage(.1)');assert.equal(state.hp,75);assert.equal(state.shieldTime,6);assert.equal(adv.bonus,1);
  camera.position.set(0,1.7,24);run('advTickStage(14)');camera.position.set(-27,1.7,28);run('advTickStage(.1)');assert.equal(adv.bonus,1,'Bonus cache is one use per mission');
  const beforeFail=tickets.length;run('advFail("Test retry")');assert.equal(tickets.length,beforeFail,'Failure never awards completion tickets');
  console.log('PASS: reusable repair timing, one-use shield caches and no failure rewards');

  run('startAdvLevel(0,0)');run('advTick(1)');assert.equal(state.monsters.length,0,'Spawn beacon warns before a wave');
  run('advTick(3)');run('advTick(.1)');assert.equal(state.monsters.length,1);
  assert.ok(run('ADV_SPAWNS').some(p=>Math.hypot(state.monsters[0].position.x-p[0],state.monsters[0].position.z-p[1])<3));
  state.hp=70;camera.position.set(0,1.7,14);run('advTickStage(.1)');assert.equal(state.freezeTime,3);assert.equal(state.hp,80);
  run('startAdvLevel(2,1)');run('advSpawner()');assert.equal(state.monsters.filter(m=>m.userData.golden).length,5,'Extra hunt spawns cannot substitute for the five authored gold targets');
  console.log('PASS: warned authored wave spawns, pulse switch and exactly five hunt targets');

  const oldStage=adv.stage, oldProps=[...oldStage.children];let disposed=0;
  oldStage.traverse(o=>{if(o.geometry)o.geometry.addEventListener('dispose',()=>disposed++);});
  run('advCleanup()');assert.equal(adv.stage,null);assert.equal(adv.pads.length+adv.gates.length+adv.signals.length+adv.route.length+adv.items.length,0);
  assert.equal(scene.children.includes(oldStage),false);assert.ok(disposed>oldProps.length,'All temporary geometry is disposed');
  assert.equal(run('advUnlocked(advMine(),0)'),true);assert.equal(run('advMine()[player].stars["0-2"]'),3);
  console.log('PASS: temporary props fully dispose and saved progression survives cleanup');
})().catch(error=>{console.error(error);process.exitCode=1;});
