const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

(async () => {
  const root = path.join(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const THREE = await import('data:text/javascript;base64,' + fs.readFileSync(path.join(root, 'three.module.js')).toString('base64'));
  const nodes = new Map(), storage = new Map(), timers = [], awards = [], hits = [];
  const node = id => { if (!nodes.has(id)) { const classes=new Set();nodes.set(id, {style:{},classList:{add(k){classes.add(k);},remove(k){classes.delete(k);},contains(k){return classes.has(k);}},textContent:''}); } return nodes.get(id); };
  const mesh = () => new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  const scene = new THREE.Scene(), platform = {mesh:mesh(),x:75,z:75,hw:2,hd:2,top:1.5};
  const state = {
    THREE, scene, player:'Party test', EYE:1.7, camera:{position:new THREE.Vector3(0,1.7,28)},
    ground:mesh(),decoGroup:new THREE.Group(),towerShell:new THREE.Group(),water:mesh(),beach:mesh(),platforms:[platform],
    toon:col=>new THREE.MeshBasicMaterial({color:col}),
    disposeObj(obj){obj.traverse(c=>{c.geometry?.dispose();if(c.material)c.material.dispose();});},
    shuffle:a=>a.slice().reverse(), $:node, localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    monsters:[], bossesAlive:0,bossMaxTotal:0,bossNameEl:node('bossName'),bossHpEl:node('bossHp'),bossEl:node('boss'),
    THEMES:[{name:'RAINBOW LAND'},{name:'BEACH PARTY'},{name:'TOYBOX PLANET'}],themeIndex:0,worldGrav:22,
    missions:[],NET:{on:false},kidMode:true,playing:true,mouseDown:false,yaw:0,pitch:0,velY:0,
    selectScreen:node('select'),pauseScreen:node('pause'),overScreen:node('over'),overlay:node('overlay'),hud:node('hud'),document:{body:{classList:{add(){},remove(){}}}},
    awardTickets:(source,amount)=>awards.push({source,amount}), hurtPlayer:(damage,pos)=>hits.push({damage,pos:pos.clone()}),
    setTimeout:fn=>timers.push(fn),beep(){},banner(){},flashScreen(){},showPopup(){},poof(){},
    unlockAudio(){},applyTitan(){},netShutdown(){state.NET.on=false;},renderMissions(){},setSong(){},music(){},musicStart(){},spawnSidekick(){},goFullscreen(){},startMenuDemo(){},
    applyTheme(index){state.themeIndex=index;},
    makeMonster(opts){ const m=new THREE.Group();m.add(mesh());m.position.copy(opts.pos);m.userData={isBoss:!!opts.boss,hp:opts.hp||1,body:m.children[0]};state.monsters.push(m);scene.add(m);return m; }
  };
  vm.createContext(state);
  const run = code=>vm.runInContext(code,state);
  state.resetGame=()=>{for(const m of state.monsters)scene.remove(m);state.monsters.length=0;run('partyCleanup()');};
  run(source.slice(source.indexOf('const PARTY ='),source.indexOf('(function bigTitleLetters()')));
  for (let i=0;i<50;i++) {
    const queue=run('partyRoundQueue("mix",3)'); assert.equal(new Set(queue).size,3);assert.equal(queue.length,3);
  }
  assert.equal(run('partyRoundQueue("target",3)[0]'),'target');
  assert.equal(run('partyRoundQueue("crystal",99).length'),3);
  assert.equal(run('partyPulsePhase(-3)'),'rest');assert.equal(run('partyPulsePhase(4.99)'),'rest');
  assert.equal(run('partyPulsePhase(5)'),'warning');assert.equal(run('partyPulsePhase(7.399)'),'warning');
  assert.equal(run('partyPulsePhase(7.4)'),'impact');assert.equal(run('partyPulsePhase(8)'),'rest');
  console.log('PASS: three unique Surprise Mix rounds and complete 2.4-second warning phases');

  run('startParty("crystal",3)');
  assert.equal(run('PARTY.tokens.length'),17);assert.equal(run('PARTY_ROUTE.length'),14);assert.equal(run('PARTY.goal'),14);
  assert.equal(run('PARTY.plats.length'),3);assert.equal(state.platforms.length,4);assert.equal(platform.active,false);assert.equal(platform.mesh.visible,false);
  assert.equal(run('PARTY.plats.every(p=>p.bouncy&&p.top===.45)'),true);
  assert.equal(run('PARTY.tokens.filter(t=>t.userData.baseY>3).length'),3);
  run('camera.position.set(-13,EYE,2);partyTick(.01)');assert.equal(run('PARTY.progress'),0,'Ground does not collect overhead spring bonus');
  run('camera.position.set(-13,5.4,2);partyTick(.01)');assert.equal(run('PARTY.progress'),1,'Spring-height player can collect bonus');
  run('camera.position.set(0,EYE,17);partyTick(.01)');assert.equal(run('PARTY.progress'),2);
  run('partyCleanup()');assert.equal(state.platforms.length,1);assert.equal(platform.active,undefined);assert.equal(platform.mesh.visible,true);
  assert.equal(run('PARTY.props'),null);assert.equal(run('PARTY.tokens.length'),0);
  console.log('PASS: authored gem route, reachable optional spring gems, collision and visual cleanup');

  run('startParty("target");partyTick(1.5)');
  assert.equal(state.monsters.length,6);assert.equal(run('PARTY.targetSlots.length'),6);
  assert.equal(state.monsters.every(m=>m.userData.partyTarget&&m.userData.hp===1&&m.userData.speed===0&&m.userData.dmg===0),true);
  run('partyBop({});partyBop()');assert.equal(run('PARTY.progress'),0,'Only gallery targets count');
  while(run('PARTY.progress')<12){
    if(!state.monsters.length)run('partyTick(1.2)');
    const m=state.monsters.shift();scene.remove(m);state.bopped=m.userData;run('partyBop(bopped)');
    assert.ok(state.monsters.length<=6);
  }
  assert.equal(run('PARTY.transition'),true);assert.equal(awards.length,1);assert.equal(awards[0].amount,3);
  run('partyWin()');assert.equal(awards.length,1,'Repeated win hook cannot double-award');
  console.log('PASS: six bounded gallery targets, replacement warnings, scoped bops and one ticket reward');

  run('startParty("boss")');assert.equal(run('PARTY.pulses.length'),3);
  run('camera.position.set(-14,EYE,-5);PARTY.elapsed=5.01;partyTick(.01)');assert.equal(hits.length,0);
  run('PARTY.elapsed=7.39;partyTick(.02)');assert.equal(hits.length,1);assert.equal(hits[0].damage,4);
  run('partyTick(.1)');assert.equal(hits.length,1,'Only one hit per impact, not every frame');
  run('camera.position.set(14,EYE+3,-5);PARTY.elapsed=10.39;partyTick(.02)');assert.equal(hits.length,1,'Jump above pulse avoids impact');
  assert.equal(state.monsters[0].userData.shootCd,1e9);assert.equal(state.monsters[0].userData.slamCd,1e9);
  assert.equal(state.monsters[0].userData.didShield,undefined,'Existing boss shield lifecycle remains enabled');
  run('partyCleanup();partyCleanup()');assert.equal(state.platforms.length,1);assert.equal(run('PARTY.pulses.length'),0);
  console.log('PASS: pooled floor pulses, safe warning, one impact hit, jump dodge and boss lifecycle');

  run('startParty("crystal",3);partyWin()');
  const continuation=timers[timers.length-1];run('partyCleanup()');continuation();
  assert.equal(run('PARTY.on'),false,'Cancelled series cannot reopen a round');
  assert.equal(run('PARTY.queue.length'),0);
  run('startParty("crystal",3);partyWin()');timers[timers.length-1]();
  const second=run('PARTY.kind');assert.notEqual(second,'crystal');run('partyWin()');timers[timers.length-1]();
  assert.notEqual(run('PARTY.kind'),second);assert.notEqual(run('PARTY.kind'),'crystal');
  run('partyReturn()');assert.equal(state.monsters.length,0);assert.equal(state.platforms.length,1);
  assert.ok(state.pauseScreen.classList.contains('hidden'));assert.ok(state.overScreen.classList.contains('hidden'));assert.ok(!node('partyScreen').classList.contains('hidden'));
  assert.equal(run('PARTY.props'),null);assert.equal(run('PARTY.on'),false);
  console.log('PASS: win-to-next-round uniqueness, stale timeout cancellation and return cleanup');
})().catch(error=>{console.error(error);process.exitCode=1;});
