const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const clearContext={Math};vm.createContext(clearContext);
vm.runInContext(source.slice(source.indexOf('function craterKeepsObjectivesClear('),source.indexOf('function buildCraterField(')),clearContext);
const clear=(x,z,r)=>clearContext.craterKeepsObjectivesClear(x,z,r);
for(const [x,z] of [[-18,8],[19,-14],[-17,-36],[0,7],[7,10],[7,7],[0,14],[-10,14],[10,14],[-27,28],[30,-5],[-24,14],[-38,-20],[-12,-42],[30,-32],[42,12],[42,-42],[10,55],[28,25],[48,-12],[70,-60]]) {
 for(const r of [4,8,12])for(let angle=0;angle<6.3;angle+=.3)assert.equal(clear(x+Math.sin(angle)*r,z+Math.cos(angle)*r,r),false,'Objective cannot sit over a pit');
}
assert.equal(clear(-86,-86,4),true,'Distant crater terrain remains possible');
assert.match(source,/if \(!craterKeepsObjectivesClear\(x,z,r\)\) continue;/);
console.log('PASS: crater generation reserves authored objectives and mission trails, with distant pits retained');
const bossSource=source.slice(source.indexOf('function defeatBoss('),source.indexOf('function advanceWorld('));
function runBoss(mode,change){
 const timers=[],received=[],position={y:0,clone(){return {setY(){return this;}}}};
 const m={position,userData:{color:0xff0000}};
 const ctx={NET:{on:false},gameRun:1,playing:true,ADV:{on:mode==='quest'},PARTY:{on:false},BATTLE_ON:mode==='battle',monsters:[m],bossesAlive:1,combo:0,COMBO_WINDOW:2,bestCombo:0,doubleTime:0,score:0,runBops:0,level:1,bossEl:{style:{}},
  comboMult:()=>1,poof(){},disposeObj(){},scene:{remove(){}},showPopup(){},gainSuper(){},mev(){},updateScore(){},beep(){},titanSay(){},banner(){},awardTickets(){},spawnPickup(){},levelUp(){},
  advComplete:()=>received.push('quest'),collectPickup:()=>received.push('pickup'),advanceWorld:()=>received.push('world'),setTimeout:fn=>timers.push(fn)};
 vm.createContext(ctx);vm.runInContext(bossSource,ctx);ctx.defeatBoss(m);change?.(ctx);timers.forEach(fn=>fn());return received;
}
assert.deepEqual(runBoss('battle'),['pickup','world']);assert.deepEqual(runBoss('quest'),['quest']);
for(const mode of ['battle','quest']){
 assert.deepEqual(runBoss(mode,s=>s.gameRun++),[],'New run cancels old completion callbacks');
 assert.deepEqual(runBoss(mode,s=>{s.BATTLE_ON=false;s.ADV.on=false;}),[],'Leaving mode cancels old completion callbacks');
}
assert.match(source,/function resetGame\(\) \{ gameRun\+\+/);assert.match(source,/function endGame\(\) \{ gameRun\+\+/);
console.log('PASS: delayed boss pickup/world/quest callbacks only affect their original active run');
