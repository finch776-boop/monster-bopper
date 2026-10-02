const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const between=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));

(async()=>{
  const THREE=await import('data:text/javascript;base64,'+fs.readFileSync(path.join(root,'three.module.js')).toString('base64'));
  function harness(host=false){
    const sent=[],events=[],timers=[],scene=new THREE.Scene();
    const state={THREE,scene,player:'Guest',NET:{on:true,host,hostTok:'host-token',applying:false,monsters:new Map(),peers:new Map(),posT:99,monT:0,heartT:99,lastHitBy:null},
      monsters:[],bossesAlive:0,bossMaxTotal:0,bossNameEl:{textContent:''},bossHpEl:{style:{}},bossEl:{style:{}},
      ADV:{on:false},PARTY:{on:false},CASTLE:{on:false},ANIMAL:{on:false},BATTLE_ON:true,gameRun:4,playing:true,
      combo:0,comboTime:0,comboMult:()=>1,COMBO_WINDOW:2,bestCombo:0,doubleTime:0,score:0,runBops:0,nextBoss:0,level:3,
      worldPos:0,worldOrder:[0,1,2],THEMES:[{name:'A'},{name:'B'},{name:'C'}],themeIndex:0,cycle:1,
      camera:{position:new THREE.Vector3(0,1.7,24)},EYE:1.7,yaw:0,flyMode:false,performance:{now:()=>1000},
      clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),netSendAll:m=>sent.push(JSON.parse(JSON.stringify(m))),
      animalNetMessage:()=>false,poof(){},beep(){},banner(){},monsterSound(){},titanSay(){},showPopup(){},gainSuper(){},mev(){},updateScore(){},awardTickets(){},spawnPickup(){},flashScreen(){},
      setTimeout:fn=>timers.push(fn),bossPhaseCheck:()=>events.push('local-phase'),popMonster:()=>events.push('local-pop'),
      disposeObj:o=>events.push(['dispose',o.userData.netId]),
      bossHpSum:()=>state.monsters.filter(m=>m.userData.isBoss).reduce((sum,m)=>sum+Math.max(0,m.userData.hp),0),
      applyTheme:i=>{state.themeIndex=i;events.push(['theme',i]);return state.THEMES[i].name;},setSong:i=>events.push(['song',i]),
      updateLevelHud:()=>events.push('level-hud'),buildBattleField:()=>events.push('field'),stageUp:()=>events.push('stage'),
      levelUp:()=>{state.level++;},newCycle(){state.worldPos=0;},advComplete:()=>events.push('quest-win'),partyWin:()=>events.push('party-win'),collectPickup:()=>events.push('pickup'),
      makeMonster(opts){const m=new THREE.Group();m.position.copy(opts.pos||new THREE.Vector3());m.userData={isBoss:!!opts.boss,hp:opts.hp||1,maxhp:opts.hp||1,size:opts.size||1,color:0x66ccff,skin:opts.skin||'robot',speed:1};state.monsters.push(m);scene.add(m);return m;}
    };
    vm.createContext(state);
    vm.runInContext(between('function netSpawnMsg(','function netMode(')+between('function netMsg(','function netHostLost(')+between('function damage(','// bosses are FIGHTS')+between('function defeatBoss(','function advanceWorld(')+between('function advanceWorld(','function levelUp(')+between('function netTick(','// ---- 👁 THIRD-PERSON'),state);
    const receive=m=>state.netMsg('host-token',{},m);
    return {state,sent,events,timers,receive};
  }
  const host=harness(true),boss=host.state.makeMonster({boss:true,hp:18,size:2.7,skin:'robot',pos:new THREE.Vector3(2,0,-9)});
  Object.assign(boss.userData,{netId:42,dmg:7,maxhp:26});host.state.NET.monsters.set(42,boss);host.state.bossesAlive=1;
  const spawn=host.state.netSpawnMsg(boss);
  assert.equal(spawn.boss,true);assert.equal(spawn.hp,18);assert.equal(spawn.maxhp,26);assert.equal(spawn.id,42);
  const guest=harness();guest.receive(spawn);
  const replica=guest.state.NET.monsters.get(42);
  assert.ok(replica.userData.isBoss,'Guest preserves boss identity');assert.equal(replica.userData.hp,18);assert.equal(replica.userData.maxhp,26);
  assert.equal(guest.state.bossesAlive,1);assert.notEqual(guest.state.bossEl.style.display,'none');
  guest.receive(spawn);assert.equal(guest.state.monsters.length,1,'Duplicate spawn does not double count boss');assert.equal(guest.state.bossesAlive,1);
  console.log('PASS: boss spawn identity, current/max HP, HUD and duplicate-spawn safety');

  guest.state.damage(replica,999,new THREE.Vector3());
  assert.equal(guest.sent.at(-1).t,'hit');assert.equal(guest.sent.at(-1).id,42);assert.equal(guest.sent.at(-1).d,999);
  assert.equal(replica.userData.hp,18,'Guest hit request does not predict boss HP or death');assert.equal(guest.events.includes('local-phase'),false);assert.equal(guest.events.includes('local-pop'),false);
  guest.receive({t:'monp',a:[[42,3,-8,9,1]]});
  assert.equal(replica.userData.hp,9);assert.equal(replica.userData.shielded,true);assert.equal(replica.userData.netTgt.x,3);
  assert.ok(Math.abs(parseFloat(guest.state.bossHpEl.style.width)-9/26*100)<.01,'Boss HUD follows authoritative HP');
  guest.receive({t:'monp',a:[[42,4,-7,8,0]]});assert.equal(replica.userData.shielded,false);
  host.state.NET.monT=0;host.state.netTick(.1);
  const positions=host.sent.find(m=>m.t==='monp');assert.ok(positions);assert.equal(positions.a[0][3],18);assert.equal(positions.a[0][4],0);
  console.log('PASS: guest hits are requests only; host HP/shield snapshots update boss HUD');

  host.state.NET.lastHitBy='Guest';host.state.defeatBoss(boss);
  const removal=host.sent.find(m=>m.t==='mond');assert.ok(removal,'Host boss death must broadcast removal');assert.equal(removal.id,42);assert.equal(removal.by,'Guest');
  assert.equal(host.state.NET.monsters.has(42),false);assert.equal(host.state.NET.lastHitBy,null);
  guest.receive(removal);assert.equal(guest.state.monsters.length,0,'Authoritative removal applies even when local player got the final hit');assert.equal(guest.state.bossesAlive,0);assert.equal(guest.state.bossEl.style.display,'none');
  guest.receive(removal);assert.equal(guest.state.bossesAlive,0,'Duplicate removal cannot underflow boss count');
  guest.receive({t:'mond',id:999,by:'Guest'});assert.equal(guest.state.monsters.length,0,'Already-predicted ordinary removal is harmless');
  console.log('PASS: host death broadcast/map cleanup, local-final-hit removal and duplicate-removal safety');

  const worldGuest=harness();worldGuest.state.netMsg('not-the-host',{}, {t:'world',theme:2,level:8});
  assert.equal(worldGuest.state.themeIndex,0);assert.equal(worldGuest.state.level,3,'Untrusted world event cannot replace the active world');
  worldGuest.receive({t:'world',theme:2,level:8});assert.equal(worldGuest.state.themeIndex,2);assert.equal(worldGuest.state.level,8);assert.ok(worldGuest.events.includes('field'));
  const worldHost=harness(true);worldHost.state.netMsg('guest-token',{}, {t:'world',theme:2,level:99});assert.equal(worldHost.state.themeIndex,0);
  worldHost.state.advanceWorld();const worldMessage=worldHost.sent.find(m=>m.t==='world');assert.ok(worldMessage);assert.equal(worldMessage.theme,1);assert.equal(worldMessage.level,3);
  console.log('PASS: world transition broadcast and trusted-host-only guest theme/level/objective updates');
})().catch(error=>{console.error(error);process.exitCode=1;});
