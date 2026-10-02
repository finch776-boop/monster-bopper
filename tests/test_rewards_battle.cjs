const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
(async()=>{
 const THREE=await import('data:text/javascript;base64,'+fs.readFileSync(path.join(__dirname,'../three.module.js')).toString('base64'));
 const data=new Map(),state={THREE,player:'A',clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},showPopup(){},tpDisposeRig(){},rewardTrailClear(){}};
 vm.createContext(state);const run=c=>vm.runInContext(c,state);
 run(source.slice(source.indexOf('function rewardCatalog()'),source.indexOf('const REWARD_TRAIL=')));
 assert.equal(run('buyReward("snow")'),false);assert.equal(run('rewardMine().tickets'),0);
 run('awardTickets("test",5)');assert.equal(run('buyReward("snow")'),true);assert.equal(run('rewardMine().tickets'),2);
 assert.equal(run('buyReward("snow")'),true);assert.equal(run('rewardMine().tickets'),2,'Equipping owned style never charges twice');
 assert.equal(run('buyReward("ember")'),false);assert.equal(run('buyReward("unknown")'),false);
 state.player='B';assert.equal(run('rewardMine().tickets'),0);assert.equal(run('rewardMine().owned.length'),1);
 data.set('mb_lava_courses','{"A":{"unlocked":14}}');state.player='A';run('awardTickets("test",2)');assert.equal(data.get('mb_lava_courses'),'{"A":{"unlocked":14}}');
 data.set('mb_rewards','broken');assert.equal(run('rewardMine().tickets'),0);
 data.set('mb_rewards','{"A":{"tickets":-99,"owned":["hacked"],"equipped":"hacked"}}');assert.equal(run('rewardMine().tickets'),0);assert.equal(run('rewardMine().equipped'),'explorer');
 console.log('PASS: spendable rewards, affordability, no duplicate charges, profile isolation and legacy-save preservation');
 Object.assign(state,{scene:new THREE.Scene(),platforms:[],camera:{position:new THREE.Vector3(0,1.7,24)},BATTLE_ON:true,EYE:1.7,onGround:true,inside:false,hp:60,maxHP:100,shieldTime:0,
  makeVolcanicRockTextures:()=>({color:new THREE.Texture(),bump:new THREE.Texture()}),disposeObj(o){o.traverse(c=>{c.geometry?.dispose();c.material?.dispose();});},$:()=>({style:{},textContent:''}),banner(){},beep(){},gainSuper(){},updateHP(){}});
 run(source.slice(source.indexOf('const BATTLE_FIELD='),source.indexOf('function startGame(')));
 run('buildBattleField()');assert.equal(run('BATTLE_FIELD.nodes.length'),3);assert.equal(state.platforms.length,3);
 run('camera.position.set(-18,EYE,8);onGround=false;battleFieldTick(3)');assert.equal(run('BATTLE_FIELD.nodes[0].done'),false);
 state.onGround=true;run('battleFieldTick(1);camera.position.set(0,EYE,24);battleFieldTick(1)');assert.equal(run('BATTLE_FIELD.nodes[0].progress'),0);
 for(const node of run('BATTLE_FIELD.nodes')){state.camera.position.set(node.x,1.7,node.z);for(let i=0;i<125;i++)run('battleFieldTick(1/60)');}
 assert.equal(run('BATTLE_FIELD.ready'),true);const before=run('rewardMine().tickets');run('camera.position.set(0,EYE,7);battleFieldTick(.05)');assert.equal(run('rewardMine().tickets'),before+4);
 run('battleFieldTick(.05)');assert.equal(run('rewardMine().tickets'),before+4,'Chest pays once per completed run');assert.ok(state.shieldTime>=15);
 run('battleFieldCleanup();battleFieldCleanup()');assert.equal(state.platforms.length,0);assert.equal(run('BATTLE_FIELD.group'),null);
 console.log('PASS: beacon grounded charge/reset, all-three unlock, chest reward/buff once and full cleanup');
})().catch(e=>{console.error(e);process.exitCode=1;});
