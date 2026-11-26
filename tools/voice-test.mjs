import { matchSpell, phon } from '../src/voice.js';
const cases = [
 ['corp por','corp',false],['Corp Por','corp',true],['car','corp',true],['core','corp',true],['corpse','corp',true],['Corpse','corp',true],
 ['core poor','corp',false],['car pour','corp',false],['copper','corp',false],['court poor','corp',true],['corps power','corp',false],
 ['korp por','corp',false],['corporate','corp',true],['cop','corp',true],['call paul','corp',true],
 ['vas flam','flam',false],['was flame','flam',false],['boss flame','flam',false],['vast flame','flam',true],['flame','flam',true],
 ['hello there','',true],['what is this','',true],['open the door','',true],['','',true],['… …','',true],['the','',true],['okay','',true],
];
let fail=0;
for (const [t,exp,final] of cases){ const m=matchSpell(t,final); const got=m?m.spell.id:''; const ok=got===exp; if(!ok)fail++;
 console.log((ok?'PASS':'FAIL'),JSON.stringify(t),final?'final':'interim','->',got||'-',m?m.score.toFixed(2)+' '+m.matched:''); }
console.log(fail?`${fail} failures`:'all pass');
process.exit(fail?1:0);
