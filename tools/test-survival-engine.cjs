// Fixed-seed checks for the game rules: node tools/test-survival-engine.cjs
const assert = require('assert');
const E = require(require('path').join(__dirname, '..', 'survival-engine.js'));
const {inShape} = E;
let pass = 0;
const ok = (c, m) => { assert(c, m); pass++; };

// shapes
ok(inShape({kind:'line',x:0,y:0,facing:0,length:110,width:24},{x:100,y:10},0), 'line inside');
ok(!inShape({kind:'line',x:0,y:0,facing:0,length:110,width:24},{x:100,y:20},0), 'line outside width');
ok(!inShape({kind:'line',x:0,y:0,facing:0,length:110,width:24},{x:-10,y:0},0), 'line behind');
ok(inShape({kind:'fan',x:0,y:0,facing:0,range:72,arc:Math.PI*2/3},{x:30,y:45},0), 'fan 56deg in 120 arc');
ok(!inShape({kind:'fan',x:0,y:0,facing:0,range:72,arc:Math.PI*2/3},{x:0,y:-60},0), 'fan 90deg outside');
ok(inShape({kind:'fan',x:0,y:0,facing:0,range:82,arc:Math.PI},{x:0,y:-60},0), 'poleaxe half circle');
ok(inShape({kind:'circle',x:0,y:0,radius:64},{x:60,y:0},0), 'circle');

function bare(seed, layer = 1) {
  const r = E.createRun('t', seed);
  r.enemies = []; r.groups = []; r.hazards = []; r.weaponPickups = []; r.healingItems = [];
  r.emperor.x = 1000; r.emperor.y = 600; r.emperor.alive = true;
  return r;
}
function dummy(r, type, x, y, hp = 999) {
  const e = {id:'d'+Math.random(), type, label:type, friendly:false, x, y, facing:Math.PI, hp, maxHp:hp, radius:12, alive:true, openUntil:0, recoverUntil:0, aimUntil:0, nextSkillAt:Infinity, swingStartedAt:null, attackRange:0, speed:0, attackDelay:99, lastAttackAt:1e9, damage:0};
  r.enemies.push(e); r.groups.push({members:[e], alerted:false, noticeRadius:0, x, y});
  return e;
}
// spear pierces two, not three
{
  const r = bare(1); r.player.meleeWeapon = 'spear'; r.player.x = 200; r.player.y = 300;
  const a = dummy(r,'soldier',240,300), b = dummy(r,'soldier',280,300), c = dummy(r,'soldier',300,302);
  E.advance(r,{x:0,y:0},.016);
  ok(a.hp < 999 && b.hp < 999 && c.hp === 999, 'spear hits exactly two in line');
}
// sword single target
{
  const r = bare(2); r.player.meleeWeapon = 'sword'; r.player.x = 200; r.player.y = 300;
  const a = dummy(r,'soldier',230,300), b = dummy(r,'soldier',200,335);
  E.advance(r,{x:0,y:0},.016);
  ok((a.hp < 999) !== (b.hp < 999), 'sword hits one');
}
// longsword arc excludes behind
{
  const r = bare(3); r.player.meleeWeapon = 'longSword'; r.player.x = 200; r.player.y = 300;
  const a = dummy(r,'soldier',240,300), b = dummy(r,'soldier',150,300);
  E.advance(r,{x:0,y:0},.016);
  ok(a.hp < 999 && b.hp === 999, 'long sword 120 arc spares the back');
  const r2 = bare(3); r2.player.meleeWeapon = 'poleaxe'; r2.player.x = 200; r2.player.y = 300;
  const c = dummy(r2,'soldier',240,300), d = dummy(r2,'soldier',200,255), e = dummy(r2,'soldier',150,300);
  E.advance(r2,{x:0,y:0},.016);
  ok(c.hp < 999 && d.hp < 999 && e.hp === 999, 'poleaxe 180 arc');
}
// shield front vs back
{
  const r = bare(4); r.player.meleeWeapon = 'sword'; r.player.x = 200; r.player.y = 300;
  const s = dummy(r,'shield',240,300); s.facing = Math.PI; // facing player
  E.advance(r,{x:0,y:0},.016);
  const front = 999 - s.hp;
  const r2 = bare(4); r2.player.meleeWeapon = 'sword'; r2.player.x = 200; r2.player.y = 300;
  const s2 = dummy(r2,'shield',240,300); s2.facing = 0; // back to player
  E.advance(r2,{x:0,y:0},.016);
  const back = 999 - s2.hp;
  ok(front <= back * .5 && front > 0, `shield reduces front ${front} vs ${back}`);
  const r3 = bare(4); r3.player.meleeWeapon = 'sword'; r3.player.x = 200; r3.player.y = 300;
  const s3 = dummy(r3,'shield',240,300); s3.facing = Math.PI; s3.openUntil = 99;
  E.advance(r3,{x:0,y:0},.016);
  ok(999 - s3.hp > back, 'opened shield takes bonus damage');
}
// swap keeps cooldown and drops the old weapon
{
  const r = bare(5); r.player.meleeWeapon = 'sword'; r.player.x = 300; r.player.y = 300;
  r.weaponPickups.push({x:310,y:300,type:'spear',collected:false});
  r.nextAttackAt = 5;
  E.advance(r,{x:0,y:0},.016);
  ok(r.player.meleeWeapon === 'sword' && r.swapCandidate, 'no auto swap when armed');
  E.advance(r,{x:0,y:0,swap:true},.016);
  ok(r.player.meleeWeapon === 'spear', 'swap to spear');
  ok(r.weaponPickups.some(w => w.type === 'sword' && !w.collected), 'old sword dropped');
  ok(r.nextAttackAt === 5, 'cooldown kept');
  const r2 = bare(5); r2.player.x = 300; r2.player.y = 300;
  r2.weaponPickups.push({x:310,y:300,type:'poleaxe',collected:false});
  E.advance(r2,{x:0,y:0},.016);
  ok(r2.player.meleeWeapon === 'poleaxe', 'auto pickup when empty-handed');
}
// layer 4 guarantees spear; layer composition
{
  const r = E.createRun('t', 9);
  for (const layer of [2,3,4,5]) {
    r.emperor.hp = 0; r.emperor.alive = false; r.phase = 'upgrade'; r.layer = layer - 1;
    r.upgradeChoices = [{id:'swift'}];
    E.chooseUpgrade(r, 'swift');
    const types = new Set(r.enemies.map(e => e.type));
    if (layer === 2) ok(types.has('shield') && !types.has('archer'), 'L2 shield only');
    if (layer === 3) ok(types.has('archer') && !types.has('spearman'), 'L3 adds archer');
    if (layer === 4) { ok(types.has('spearman'), 'L4 adds spearman'); ok(r.weaponPickups.some(w => w.type === 'spear'), 'L4 spear'); }
    if (layer === 5) ok(r.marshal && r.groups.filter(g => g.squad).length === 3, 'L5 three squads + marshal');
  }
}
// emperor: threshold skipping and single clear
{
  const r = E.createRun('t', 11);
  while (r.layer < 6) { r.emperor.alive = false; r.phase = 'upgrade'; r.upgradeChoices = [{id:'vitality'}]; E.chooseUpgrade(r,'vitality'); }
  const em = r.emperor; r.enemies = []; r.groups = [];
  r.player.meleeWeapon = 'poleaxe';
  ok(em.phase === 0 && !em.engaged, 'starts idle in phase 0');
  // one huge hit from 100% to 20%
  const dealt = Math.ceil(em.maxHp * .8);
  r.player.x = em.x - 40; r.player.y = em.y;
  r.talents.strength = 0;
  // simulate via exposed path: call advance with a fake weapon that deals the right damage
  E.MELEE_WEAPONS; // frozen; use direct damage instead
  em.hp = em.maxHp; 
  const before = em.phase;
  // emulate damage: reduce hp and let the next hit trigger phase compute
  em.hp = Math.ceil(em.maxHp * .25) + 30;
  r.nextAttackAt = 0;
  E.advance(r,{x:0,y:0},.016);
  ok(em.engaged, 'hit engages');
  ok(em.phase === 2 && em.phaseName === '追袭', `jumps straight to last phase (${em.phase})`);
  let clears = 0; const orig = r.bossKills;
  em.hp = 1; em.wardUntil = 0; r.nextAttackAt = 0; r.telegraphs = [];
  E.advance(r,{x:0,y:0},.016);
  ok(r.phase === 'upgrade' && r.bossKills === orig + 1, 'clear once');
  E.advance(r,{x:0,y:0},.016);
  ok(r.bossKills === orig + 1, 'no double clear');
}
// reinforcement cap
{
  const r = E.createRun('t', 12);
  r.player.x = r.emperor.x + 120; r.player.y = r.emperor.y; r.player.hp = 1e9; r.player.maxHp = 1e9;
  for (let i = 0; i < 60 * 60 && r.phase === 'playing'; i++) E.advance(r,{x:0,y:0},1/60);
  const summoned = r.enemies.filter(e => e.alive && e.summoned && !e.friendly).length;
  ok(summoned <= 3, `summons capped (${summoned})`);
}
// idle player dies in late layers even with good gear
function idleRun(seed) {
  const r = E.createRun('idle', seed);
  while (r.layer < 6) { r.emperor.alive = false; r.phase = 'upgrade'; r.upgradeChoices = [{id:'strength'}]; E.chooseUpgrade(r,'strength'); }
  r.player.meleeWeapon = 'poleaxe'; r.player.bowAmmo = 40;
  r.player.x = r.emperor.x + 70; r.player.y = r.emperor.y;
  for (let i = 0; i < 60 * 120 && r.phase === 'playing'; i++) E.advance(r,{x:0,y:0},1/60);
  return r;
}
let idleWins = 0;
for (const seed of [1,2,3,4,5,6]) if (idleRun(seed).phase === 'upgrade') idleWins++;
ok(idleWins === 0, `idle never clears late emperor (${idleWins}/6)`);
// determinism
{
  const a = idleRun(42), b = idleRun(42);
  ok(a.elapsed === b.elapsed && a.player.hp === b.player.hp, 'deterministic');
}
// talents: every clear (even layer 1) is a 3-pick from all rarities; owned cards can come again
{
  const seen = {}; let ownedAgain = 0, layer1Picks = 0;
  for (let s = 0; s < 300; s++) {
    const x = E.createRun('t', s);
    x.talents.thunder = 1;
    x.emperor.hp = 1; x.emperor.engaged = true; x.player.meleeWeapon = 'sword';
    x.emperor.x = x.player.x + 30; x.emperor.y = x.player.y; x.enemies = []; x.groups = []; x.nextAttackAt = 0;
    E.advance(x,{x:0,y:0},.016);
    if (x.phase === 'upgrade' && x.upgradeChoices.length === 3) layer1Picks++;
    for (const c of x.upgradeChoices) { seen[c.rarity] = (seen[c.rarity]||0)+1; if (c.id === 'thunder') ownedAgain++; }
  }
  ok(layer1Picks === 300, `layer 1 offers three talents (${layer1Picks})`);
  ok(['common','rare','epic','legendary'].every(k => seen[k] > 0), `all rarities appear ${JSON.stringify(seen)}`);
  ok(ownedAgain > 0, 'owned legendary can be offered again');
  const r = E.createRun('t', 3);
  r.phase = 'upgrade'; r.emperor.alive = false; r.upgradeChoices = [{id:'thunder'}];
  E.chooseUpgrade(r,'thunder'); r.phase = 'upgrade'; r.emperor.alive = false; r.upgradeChoices = [{id:'thunder'}];
  ok(E.chooseUpgrade(r,'thunder') && r.talents.thunder === 2, 'legendary stacks');
}
// new weapons
{
  const r = bare(21); r.player.meleeWeapon = 'meteor'; r.player.x = 300; r.player.y = 300;
  const a = dummy(r,'soldier',360,300), b = dummy(r,'soldier',240,300), c = dummy(r,'soldier',300,360), d = dummy(r,'soldier',420,300);
  E.advance(r,{x:0,y:0},.016);
  ok(a.hp < 999 && b.hp < 999 && c.hp < 999 && d.hp === 999, 'meteor hits all around, not beyond');
  const r2 = bare(22); r2.player.meleeWeapon = 'dualBlades'; r2.player.x = 300; r2.player.y = 300;
  const e = dummy(r2,'soldier',330,300), f = dummy(r2,'soldier',300,335), g = dummy(r2,'soldier',270,300);
  e.x = 325; f.y = 334;
  E.advance(r2,{x:0,y:0},.016);
  ok([e,f,g].filter(u => u.hp < 999).length === 2, 'dual blades hit exactly two');
  const r3 = bare(23); r3.player.meleeWeapon = 'mace'; r3.player.x = 200; r3.player.y = 300;
  const s = dummy(r3,'shield',240,300); s.facing = Math.PI;
  E.advance(r3,{x:0,y:0},.016);
  ok(999 - s.hp >= 34 && s.stunUntil > r3.elapsed && E.isOpen(s, r3.elapsed), 'mace ignores shield and stuns');
  const r4 = bare(24); r4.player.meleeWeapon = 'crossbow'; r4.player.x = 100; r4.player.y = 300;
  const h = dummy(r4,'soldier',250,300), k = dummy(r4,'soldier',300,302);
  E.advance(r4,{x:0,y:0},.016);
  ok(h.hp < 999 && k.hp < 999 && r4.player.bowAmmo === 0, 'crossbow reaches far and pierces');
  const r5 = bare(25); r5.player.meleeWeapon = 'halberd'; r5.player.x = 200; r5.player.y = 300;
  const m = dummy(r5,'soldier',250,300); const x0 = m.x;
  E.advance(r5,{x:0,y:0},.016);
  ok(m.hp < 999 && m.x > x0 + 20, 'halberd knocks back');
}
// reach talent extends range
{
  const r = bare(26); r.player.meleeWeapon = 'sword'; r.player.x = 200; r.player.y = 300;
  const far = dummy(r,'soldier',280,300);
  E.advance(r,{x:0,y:0},.016);
  ok(far.hp === 999, 'out of plain sword reach');
  r.talents.reach = 3; r.nextAttackAt = 0;
  E.advance(r,{x:0,y:0},.016);
  ok(far.hp < 999, 'reach +36% connects');
}
console.log('passed', pass);
