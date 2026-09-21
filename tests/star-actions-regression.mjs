import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const file = await readFile("game.js", "utf8");
const source = file.slice(file.indexOf("const SCREEN_STATES"));
const definitions = source.slice(0, source.indexOf("class UIManager"));
const hints = [];
let moonPlays = 0;
const dawnBursts = [];
const moonfalls = [];
const divinationResults = [];
const completionPaths = [];

const context = {
  Math: Object.create(Math),
  document: { createElement: () => ({}) },
  UIManager: {
    hint: (message) => hints.push(message),
    mergeEffect: () => {},
    swapEffect: () => {},
    chainBeam: () => {},
    zodiacComplete: (points) => completionPaths.push(points),
    showDawnMoon: () => moonPlays++,
    dawnSpecial: (position, damage) => dawnBursts.push({ position, damage }),
    dawnMoonfall: (position, enemies) => moonfalls.push({ position, enemies: [...enemies] }),
    divinationEffect: (position, success) => divinationResults.push({ position, success }),
  },
  effects: { querySelectorAll: () => [] },
};
context.arena = {
  getBoundingClientRect: () => ({ width: 400, height: 800 }),
};
vm.createContext(context);
vm.runInContext(
  `${definitions}\nthis.testApi = { playerProgress, CONFIG, CONSTELLATION_IDS, CONSTELLATION_DEFINITIONS, Star, StarManager, Targeting, Constellation, RangeSystem, MergeSystem, SwapSystem, ZodiacSystem, DivinationSystem, BondOfferingSystem };`,
  context,
);

const { playerProgress, CONFIG, CONSTELLATION_IDS, CONSTELLATION_DEFINITIONS, Star, StarManager, Targeting, Constellation, RangeSystem, MergeSystem, SwapSystem, ZodiacSystem, DivinationSystem, BondOfferingSystem } =
  context.testApi;
playerProgress.ownedConstellations = Object.keys(CONSTELLATION_DEFINITIONS);
playerProgress.equippedConstellations = Object.keys(CONSTELLATION_DEFINITIONS);
assert.deepEqual(Object.keys(CONSTELLATION_DEFINITIONS), ["DAWN", "RADIANCE", "SAGITTARIUS", "ASTROLOGER", "GUARDIAN", "TWILIGHT", "BOND", "LINK", "STRIKE", "HORIZON"]);
for (const [id, definition] of Object.entries(CONSTELLATION_DEFINITIONS))
  assert.equal(definition.id, id, `${id} must carry its stable definition id`);
assert.deepEqual(JSON.parse(JSON.stringify(CONSTELLATION_DEFINITIONS.TWILIGHT.recipe)), { red: 2, white: 1, blue: 1 });
assert.equal(CONSTELLATION_DEFINITIONS.TWILIGHT.attackDamage, 800);
assert.equal(CONSTELLATION_DEFINITIONS.TWILIGHT.attackSpeed, 2);
assert.equal(CONSTELLATION_DEFINITIONS.TWILIGHT.range, 7);
assert.equal(CONSTELLATION_DEFINITIONS.TWILIGHT.transcendenceRange, 5);

const makeManager = () => {
  const resources = { starlight: 100, divinity: 9 };
  resources.can = (amount) => resources.starlight >= amount;
  resources.spend = (amount) => {
    if (!resources.can(amount)) return false;
    resources.starlight -= amount;
    return true;
  };
  return {
    player: { resources },
    stars: Array(21).fill(null),
    selected: [],
    zodiacMode: false,
    swapMode: false,
    pos: (index) => ({ x: index, y: 0 }),
    activeConstellations() {
      return this.stars.reduce((items, star) => {
        if (star?.constellation && !items.includes(star.constellation))
          items.push(star.constellation);
        return items;
      }, []);
    },
    selectOnly(index) {
      this.selected = [index];
    },
    exitModes() {
      this.swapMode = false;
      this.zodiacMode = false;
      this.selected = [];
    },
    field: {
      children: Array.from({ length: 21 }, () => ({
        classList: { add() {}, remove() {} },
      })),
    },
  };
};

context.game = {
  enemies: [],
  gameTime: 0,
  attackBuffUntil: 0,
  players: [],
  discoveredConstellations: new Set(),
  discoverConstellation(id) {
    this.discoveredConstellations.add(id);
  },
  render() {},
  simulationTimeout(callback) {
    callback();
  },
  markDirty() {},
};

// Purple reuses spatial targeting and keeps source ordering for equal HP.
const targetPosition = { x: 50, y: 50 };
const enemiesByHp = [120, 40, 40].map((hp) => ({ hp, dead: false, position: () => targetPosition }));
context.game.spatial = { near: () => enemiesByHp };
const purple = new Star("purple");
assert.equal(Targeting.choose(purple, enemiesByHp, targetPosition), enemiesByHp[1]);

// Green support is derived from live, unconsumed board state rather than a
// permanent mutation, so merge/swap/zodiac consumption immediately changes it.
const supportBoard = { stars: [new Star("green"), new Star("green"), new Star("blue")] };
supportBoard.greenStarCount = StarManager.prototype.greenStarCount;
const attackBoard = { stars: [], greenStarCount: StarManager.prototype.greenStarCount };
context.game.players = [{ manager: supportBoard }, { manager: attackBoard }];
assert.equal(StarManager.prototype.alliedAttackSpeedModifier.call(attackBoard), 1.05);
supportBoard.stars[0].support = true;
assert.equal(StarManager.prototype.alliedAttackSpeedModifier.call(attackBoard), 1.04);
supportBoard.stars[1] = null;
assert.equal(StarManager.prototype.alliedAttackSpeedModifier.call(attackBoard), 1);
context.game.players = [];
context.game.spatial = null;

// Merge is immediate, clears the successful result selection, and empties one material slot.
const mergeManager = makeManager();
mergeManager.stars[2] = new Star("blue", 1);
mergeManager.stars[8] = new Star("blue", 1);
mergeManager.selected = [2];
MergeSystem.execute(mergeManager);
assert.equal(mergeManager.stars[2].tier, 2);
assert.equal(mergeManager.stars[8], null);
assert.deepEqual([...mergeManager.selected], []);

// Exchange changes only type, charges exactly 10, and preserves tier/slot/selection.
const swapManager = makeManager();
swapManager.stars[4] = new Star("blue", 3);
const swappedStar = swapManager.stars[4];
swapManager.selected = [4];
SwapSystem.execute(swapManager, 4);
assert.equal(swapManager.player.resources.starlight, 100 - CONFIG.swapCost);
assert.equal(swapManager.stars[4], swappedStar);
assert.notEqual(swapManager.stars[4].type, "blue");
assert.equal(swapManager.stars[4].tier, 3);
assert.deepEqual([...swapManager.selected], [4]);
assert.equal(swapManager.stars[4].lock, null);
assert.equal(swapManager.stars[4].cooldown, 0);
assert.equal(swapManager.stars[4].burstLeft, 3);
for (let exchange = 0; exchange < 4; exchange++) {
  const previousType = swapManager.stars[4].type;
  const previousStarlight = swapManager.player.resources.starlight;
  SwapSystem.execute(swapManager, 4);
  assert.notEqual(swapManager.stars[4].type, previousType);
  assert.equal(swapManager.stars[4].tier, 3);
  assert.equal(swapManager.player.resources.starlight, previousStarlight - CONFIG.swapCost);
  assert.deepEqual([...swapManager.selected], [4]);
}

const firstReplacement = swapManager.stars[4].type;
SwapSystem.execute(swapManager, 4);
assert.equal(swapManager.player.resources.starlight, 100 - CONFIG.swapCost * 6);
assert.notEqual(swapManager.stars[4].type, firstReplacement);
assert.equal(swapManager.stars[4].tier, 3);
assert.deepEqual([...swapManager.selected], [4]);

swapManager.player.resources.starlight = CONFIG.swapCost - 1;
const typeBeforeRejectedSwap = swapManager.stars[4].type;
SwapSystem.execute(swapManager, 4);
assert.equal(swapManager.player.resources.starlight, CONFIG.swapCost - 1);
assert.equal(swapManager.stars[4].type, typeBeforeRejectedSwap);

const constellationSwapManager = makeManager();
constellationSwapManager.stars[0] = new Star("orange");
constellationSwapManager.stars[0].constellation = {
  center: 0,
  definitionId: CONSTELLATION_IDS.ASTROLOGER,
};
constellationSwapManager.selected = [0];
SwapSystem.execute(constellationSwapManager, 0);
assert.equal(constellationSwapManager.player.resources.starlight, 100);
assert.equal(constellationSwapManager.stars[0].type, "orange");

// Cancelling selection exits zodiac mode without consuming either resource.
const cancelManager = makeManager();
cancelManager.zodiacMode = true;
cancelManager.selected = [1, 3, 5];
const resourcesBeforeCancel = { ...cancelManager.player.resources };
ZodiacSystem.cancel(cancelManager);
assert.equal(cancelManager.zodiacMode, false);
assert.deepEqual([...cancelManager.selected], []);
assert.equal(
  cancelManager.player.resources.starlight,
  resourcesBeforeCancel.starlight,
);
assert.equal(
  cancelManager.player.resources.divinity,
  resourcesBeforeCancel.divinity,
);

// Completion plays the moon once. Special attacks do not call the moon effect.
const zodiacManager = makeManager();
for (const [index, type] of [
  [0, "blue"],
  [1, "blue"],
  [2, "blue"],
  [3, "white"],
])
  zodiacManager.stars[index] = new Star(type);
zodiacManager.zodiacMode = true;
zodiacManager.selected = [0, 1, 2, 3];
ZodiacSystem.create(zodiacManager);
assert.equal(context.game.discoveredConstellations.has(CONSTELLATION_IDS.DAWN), true);
assert.equal(moonPlays, 1);
const constellation = zodiacManager.stars[0].constellation;
assert.equal(CONSTELLATION_DEFINITIONS.DAWN.attackDamage, 500);
assert.equal(CONSTELLATION_DEFINITIONS.DAWN.attackSpeed, 4);
assert.equal(CONSTELLATION_DEFINITIONS.DAWN.range, 4);
assert.equal(constellation.definitionId, CONSTELLATION_IDS.DAWN);
assert.deepEqual([...constellation.connectionOrder], [0, 1, 2, 3]);
assert.deepEqual(JSON.parse(JSON.stringify(completionPaths.at(-1))), [
  { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
]);

const damage = [];
const enemy = {
  dead: false,
  hp: 100000,
  position: () => ({ x: 1, y: 0 }),
  hit(amount) {
    damage.push(amount);
    this.hp -= amount;
  },
};
context.game.enemies = [enemy];
for (let hit = 0; hit < 4; hit++) {
  constellation.cooldown = 0;
  constellation.attack(0);
}
assert.deepEqual(damage, [500, 500, 500, 500, 500 * 15]);
assert.equal(constellation.runtime.sameTargetHits, 0);
assert.equal(moonPlays, 1, "special attack must not replay the moon");
assert.deepEqual(dawnBursts, [{ position: { x: 1, y: 0 }, damage: 7500 }]);

// Dawn's streak belongs to one living, in-range target only.
const nextEnemy = { ...enemy, dead: false, hp: 100000, position: () => ({ x: 2, y: 0 }), hit: enemy.hit };
context.game.enemies = [nextEnemy];
constellation.target = enemy;
constellation.runtime.sameTargetHits = 3;
enemy.dead = true;
constellation.cooldown = 0;
constellation.attack(0);
assert.equal(constellation.runtime.sameTargetHits, 1, "changing targets resets the four-hit streak");
assert.equal(dawnBursts.length, 1);

// Radiance accepts red x2 + white x1, saves the real stage sum and chains once
// per stage across distinct nearest enemies.
const radianceManager = makeManager();
for (const [index, type, tier] of [
  [0, "red", 2],
  [1, "red", 1],
  [2, "white", 1],
]) radianceManager.stars[index] = new Star(type, tier);
radianceManager.zodiacMode = true;
radianceManager.selected = [0, 1, 2];
ZodiacSystem.create(radianceManager);
const radiance = radianceManager.stars[0].constellation;
assert.equal(radiance.definitionId, "RADIANCE");
assert.equal(radiance.runtime.componentStageSum, 4);
assert.equal(moonPlays, 1, "radiance must not play the dawn moon");
const chained = Array.from({ length: 5 }, (_, index) => ({
  dead: false,
  hp: 10000,
  position: () => ({ x: index + 1, y: 0 }),
  hit(amount) { this.hp -= amount; this.received = (this.received || []).concat(amount); },
}));
context.game.enemies = chained;
radiance.cooldown = 0;
radiance.attack(0);
const radianceDamage = 950;
assert.deepEqual(chained.map((enemy) => enemy.received || []), [
  [radianceDamage], [radianceDamage], [radianceDamage], [radianceDamage], [],
]);
context.game.enemies = chained.slice(0, 2).map((enemy) => ({ ...enemy, hp: 10000, received: [], hit: enemy.hit }));
radiance.cooldown = 0;
radiance.attack(0);
assert.deepEqual(context.game.enemies.map((enemy) => enemy.received), [[radianceDamage], [radianceDamage]]);

// Kill progression is instance-local. Dawn triggers exactly once on the fifth
// direct kill and moonfall deals 20% current HP without assigning a damage source.
const moonfallHits = [];
context.game.enemies = [1000, 10000, 20000].map((maxHp, index) => ({
  dead: index === 2,
  maxHp,
  hp: maxHp / (index + 1),
  position: () => ({ x: index, y: 1 }),
  hit(...args) { moonfallHits.push(args); },
}));
constellation.registerKill();
constellation.registerKill();
assert.equal(moonfalls.length, 0);
constellation.registerKill();
assert.equal(moonfalls.length, 0);
constellation.registerKill();
assert.equal(moonfalls.length, 0, "four direct kills do not trigger moonfall");
constellation.registerKill();
assert.equal(moonfalls.length, 1);
assert.equal(constellation.runtime.dawnKillProgress, 0);
assert.deepEqual(moonfallHits.map(([amount]) => amount), [200, 1000]);
assert.ok(moonfallHits.every((args) => args.length === 2), "moonfall kills must not carry DAWN attribution");

// Radiance begins at +0%, gains exactly +0.2% per direct kill, and applies the
// divided stage multiplier once before its accumulated multiplier.
assert.equal(radiance.runtime.radianceKills, 0);
assert.equal(radiance.currentDamage(), 950);
for (let kill = 0; kill < 10; kill++) radiance.registerKill();
assert.equal(radiance.runtime.radianceKills, 10);
assert.equal(radiance.runtime.radianceKillBonus, 0.02);
assert.equal(radiance.currentDamage(), 950 * 1.02);
for (let kill = 10; kill < 100; kill++) radiance.registerKill();
assert.equal(radiance.runtime.radianceKills, 100);
assert.equal(radiance.runtime.radianceKillBonus, 0.2);
assert.equal(radiance.currentDamage(), 950 * 1.2);

const stageSevenManager = makeManager();
[[0, "red", 2], [1, "red", 2], [2, "white", 3]].forEach(([slot, type, tier]) => {
  stageSevenManager.stars[slot] = new Star(type, tier);
});
stageSevenManager.selected = [0, 1, 2];
stageSevenManager.zodiacMode = true;
ZodiacSystem.create(stageSevenManager);
const stageSevenRadiance = stageSevenManager.stars[0].constellation;
assert.equal(stageSevenRadiance.componentStageSum, 7);
assert.equal(stageSevenRadiance.currentDamage(), 950 * 1.75, "2 + 2 + 3 stages must apply exactly one x1.75 multiplier");

// Recipe matching is count-based: selection order and star tier never affect it.
for (const tiers of [[1, 1, 1], [2, 4, 3]]) {
  const manager = makeManager();
  for (const [index, type] of [[7, "white"], [2, "red"], [12, "red"]])
    manager.stars[index] = new Star(type, tiers[index === 7 ? 2 : index === 2 ? 0 : 1]);
  manager.zodiacMode = true;
  manager.selected = [7, 12, 2];
  assert.equal(ZodiacSystem.exactMatch(ZodiacSystem.counts(manager)), "RADIANCE");
  ZodiacSystem.create(manager);
  assert.equal(manager.stars[7].constellation.definitionId, "RADIANCE");
  assert.equal(manager.stars[7].constellation.runtime.componentStageSum, tiers.reduce((a, b) => a + b, 0));
}
assert.equal(ZodiacSystem.exactMatch({ blue: 3, white: 1 }), "DAWN");
assert.equal(ZodiacSystem.exactMatch({ white: 1, blue: 3 }), "DAWN");
assert.deepEqual([...ZodiacSystem.possibleMatches({ red: 2 })], ["RADIANCE", "TWILIGHT"]);
assert.deepEqual([...ZodiacSystem.possibleMatches({ red: 3 })], []);

// Every live recipe uses the same count matcher. Exact material counts are
// order- and tier-independent, while missing, extra, and wrong colors fail.
for (const [definitionId, definition] of Object.entries(CONSTELLATION_DEFINITIONS)) {
  const types = Object.entries(definition.recipe)
    .flatMap(([type, amount]) => Array(amount).fill(type));
  const exactCounts = Object.fromEntries(Object.entries(definition.recipe));
  assert.equal(ZodiacSystem.exactMatch(exactCounts), definitionId, `${definitionId}: exact recipe`);

  const missingCounts = { ...exactCounts };
  const firstType = types[0];
  if (--missingCounts[firstType] === 0) delete missingCounts[firstType];
  assert.notEqual(ZodiacSystem.exactMatch(missingCounts), definitionId, `${definitionId}: one missing`);
  assert.notEqual(
    ZodiacSystem.exactMatch({ ...exactCounts, [firstType]: exactCounts[firstType] + 1 }),
    definitionId,
    `${definitionId}: one extra`,
  );
  assert.equal(
    ZodiacSystem.exactMatch({ ...missingCounts, violet: 1 }),
    undefined,
    `${definitionId}: wrong color`,
  );

  const manager = makeManager();
  const reversedTypes = [...types].reverse();
  const picks = reversedTypes.map((type, index) => {
    const slot = index * 2;
    manager.stars[slot] = new Star(type, index % 4 + 1);
    return slot;
  });
  manager.selected = picks;
  manager.zodiacMode = true;
  assert.equal(ZodiacSystem.exactMatch(ZodiacSystem.counts(manager)), definitionId,
    `${definitionId}: reordered, mixed-tier recipe`);
  ZodiacSystem.create(manager);
  const constellation = manager.stars[picks[0]].constellation;
  assert.equal(constellation.definitionId, definitionId);
  assert.deepEqual([...constellation.connectionOrder], picks,
    `${definitionId}: creation must preserve selection order`);
}

// BOND is order-independent, scales its base damage once, refreshes a
// game-time bind deadline, and keeps offerings on the individual instance.
const bondManager = makeManager();
[[8, "green", 3], [2, "white", 4], [10, "white", 2], [4, "white", 3]]
  .forEach(([slot, type, tier]) => { bondManager.stars[slot] = new Star(type, tier); });
bondManager.selected = [8, 2, 10, 4];
bondManager.zodiacMode = true;
ZodiacSystem.create(bondManager);
const bond = bondManager.stars[8].constellation;
assert.equal(bond.definitionId, "BOND");
assert.equal(bond.componentStageSum, 12);
assert.equal(bond.currentDamage(), 1500);
assert.equal(bond.definition.attackSpeed, 1.8);
assert.equal(bond.definition.range, 4);
assert.equal(bond.definition.targeting, "random");
bondManager.player.resources.starlight = 1800;
for (let count = 0; count < 9; count++) BondOfferingSystem.execute(bondManager, 8);
assert.equal(bond.runtime.bindChance, 1);
assert.equal(bondManager.player.resources.starlight, 200);
BondOfferingSystem.execute(bondManager, 8);
assert.equal(bondManager.player.resources.starlight, 200, "a capped offering spends nothing");

// LINK reads only component sums from every other active instance, including
// another LINK, and recomputes rather than storing final damage.
const linkManager = makeManager();
[[0, "purple", 1], [2, "green", 1], [4, "purple", 1], [6, "red", 1]]
  .forEach(([slot, type, tier]) => { linkManager.stars[slot] = new Star(type, tier); });
linkManager.selected = [6, 0, 4, 2];
linkManager.zodiacMode = true;
ZodiacSystem.create(linkManager);
const link = linkManager.stars[6].constellation;
const linked = { componentStageSum: 7 };
context.game.players = [{ manager: { activeConstellations: () => [link, linked] } }];
assert.equal(link.currentDamage(), 700);
linked.componentStageSum = 10;
assert.equal(link.currentDamage(), 2000);
linked.componentStageSum = 20;
assert.equal(link.currentDamage(), 6000);
linked.componentStageSum = 30;
assert.equal(link.currentDamage(), 12000);
context.game.players = [{ manager: { activeConstellations: () => [link] } }];
assert.equal(link.currentDamage(), 100, "no linked constellation keeps a minimum x1 inheritance multiplier");

// The reported Twilight case uses tiers 4 + 2 + 3 + 1, for a stage sum of
// ten and therefore 800 * (10 / 4) = 2,000 base stage damage.
const twilightManager = makeManager();
[[6, "blue", 1], [2, "red", 4], [8, "white", 3], [4, "red", 2]]
  .forEach(([slot, type, tier]) => { twilightManager.stars[slot] = new Star(type, tier); });
twilightManager.selected = [6, 2, 8, 4];
twilightManager.zodiacMode = true;
ZodiacSystem.create(twilightManager);
const twilight = twilightManager.stars[6].constellation;
assert.equal(twilight.definitionId, "TWILIGHT");
assert.equal(twilight.componentStageSum, 10);
assert.equal(twilight.currentDamage(), 2000);
assert.deepEqual([...twilight.connectionOrder], [6, 2, 8, 4]);
const weakenedTwilightTarget = {
  dead: false, hp: 50, maxHp: 100,
  hit(damage) { this.lastDamage = damage; },
};
twilight.behavior.attack(twilight, weakenedTwilightTarget, { x: 0, y: 0 });
assert.equal(weakenedTwilightTarget.lastDamage, 4000, "Twilight retains double damage at 50% HP");
assert.equal(twilight.effectiveAttackSpeed(weakenedTwilightTarget), 4,
  "Twilight retains double attack speed at 50% HP");
context.game.gameTime = 10;
twilight.runtime.transcendenceUntil = 25;
assert.equal(twilight.effectiveRange(), 5, "Twilight retains range 5 during transcendence");
context.game.gameTime = 0;

// Divination replaces exchange for a constellation: 30 is paid first, then
// success grants 60 while the alternate result grants 15.
const divineManager = makeManager();
divineManager.stars[0] = new Star("blue");
divineManager.stars[0].constellation = { center: 0, definitionId: "ASTROLOGER", runtime: {} };
divineManager.selected = [0];
context.Math.random = () => 0.49;
DivinationSystem.execute(divineManager, 0);
assert.equal(divineManager.player.resources.starlight, 160);
divineManager.player.resources.starlight = 100;
context.game.gameTime = 6;
context.Math.random = () => 0.51;
DivinationSystem.execute(divineManager, 0);
assert.equal(divineManager.player.resources.starlight, 85);
divineManager.player.resources.starlight = 31;
context.game.gameTime = 12;
DivinationSystem.execute(divineManager, 0);
assert.equal(divineManager.player.resources.starlight, 16);
assert.deepEqual(divinationResults.map((result) => result.success), [true, false, false]);
context.game.gameTime = 0;

// Visual paths preserve selection, deselection, and reselection order for
// every recipe size; matching continues to depend only on type counts.
const connectionCases = [
  { types: ["orange", "orange"], picks: [8, 2], kind: "ASTROLOGER" },
  { types: ["red", "white", "red"], picks: [9, 1, 5], kind: "RADIANCE" },
  { types: ["blue", "blue", "white", "blue"], picks: [11, 3, 7, 0], kind: "DAWN" },
  { types: ["blue", "yellow", "blue", "yellow"], picks: [6, 12, 2, 10], kind: "SAGITTARIUS" },
];
for (const { types, picks, kind } of connectionCases) {
  const manager = makeManager();
  picks.forEach((slot, index) => { manager.stars[slot] = new Star(types[index]); });
  manager.zodiacMode = true;
  manager.selected = [...picks];
  ZodiacSystem.create(manager);
  const made = manager.stars[picks[0]].constellation;
  assert.equal(made.definitionId, kind);
  assert.deepEqual([...made.connectionOrder], picks);
  assert.equal(completionPaths.at(-1).length - 1, picks.length - 1);
  assert.deepEqual(
    [...made.connectionOrder.slice(0, -1)].map((from, index) => [from, made.connectionOrder[index + 1]]),
    picks.slice(0, -1).map((from, index) => [from, picks[index + 1]]),
  );
}
const reselection = makeManager();
[[13, "blue"], [4, "blue"], [8, "white"], [1, "blue"]]
  .forEach(([slot, type]) => { reselection.stars[slot] = new Star(type); });
reselection.zodiacMode = true;
reselection.selected = [13, 4, 8];
reselection.selected.splice(reselection.selected.indexOf(4), 1);
reselection.selected.push(1, 4);
ZodiacSystem.create(reselection);
assert.deepEqual(
  [...reselection.stars[13].constellation.connectionOrder],
  [13, 8, 1, 4],
);
assert.deepEqual(
  [...reselection.stars[13].constellation.connectionOrder.slice(0, -1)]
    .map((from, index) => [from, reselection.stars[13].constellation.connectionOrder[index + 1]]),
  [[13, 8], [8, 1], [1, 4]],
);

// Astrologer attacks retain their combat stats and award 1 + active zodiac.
const astrologerManager = makeManager();
astrologerManager.stars[2] = new Star("orange");
astrologerManager.stars[9] = new Star("orange");
astrologerManager.selected = [9, 2];
astrologerManager.zodiacMode = true;
context.game.players = [{ manager: astrologerManager }];
ZodiacSystem.create(astrologerManager);
const astrologer = astrologerManager.stars[9].constellation;
const starlightBeforeAttack = astrologerManager.player.resources.starlight;
context.game.enemies = [enemy];
enemy.dead = false;
enemy.hp = 100000;
astrologer.cooldown = 0;
astrologer.attack(0);
assert.equal(astrologerManager.player.resources.starlight, starlightBeforeAttack + 4);
assert.equal(astrologer.definition.attackDamage, 100);
assert.equal(astrologer.definition.attackSpeed, 1);
assert.equal(astrologer.definition.range, 4);

// Sagittarius uses simulation time for its attack buff and freezes focus
// accumulation during transcendence without introducing range-buff state.
const sagittariusManager = makeManager();
[[1, "yellow"], [5, "blue"], [7, "yellow"], [12, "blue"]]
  .forEach(([slot, type]) => { sagittariusManager.stars[slot] = new Star(type); });
sagittariusManager.selected = [12, 1, 5, 7];
sagittariusManager.zodiacMode = true;
context.game.players = [{ manager: sagittariusManager }];
ZodiacSystem.create(sagittariusManager);
const sagittarius = sagittariusManager.stars[12].constellation;
assert.equal(sagittarius.definition.attackDamage, 400);
assert.equal(sagittarius.definition.attackSpeed, 6);
assert.equal(sagittarius.definition.range, 6);
const focusDamage = [];
const focusEnemy = { dead: false, hp: 1e9, position: () => ({ x: 1, y: 0 }), hit(value) { focusDamage.push(value); } };
sagittarius.runtime.focusHits = 19;
sagittarius.behavior.attack(sagittarius, focusEnemy, { x: 0, y: 0 });
sagittarius.runtime.focusHits = 39;
sagittarius.behavior.attack(sagittarius, focusEnemy, { x: 0, y: 0 });
assert.deepEqual(focusDamage, [400 * 11, 400 * 21], "the 20th and 40th focus hits use stage-scaled 1100% and 2100% damage");
sagittarius.runtime.focusHits = 59;
sagittarius.behavior.attack(sagittarius, enemy, { x: 0, y: 0 });
assert.equal("totalHits" in sagittarius.runtime, false);
assert.equal("rangeBuffUntil" in sagittarius.runtime, false);
assert.equal("rangeBuffCooldownUntil" in sagittarius.runtime, false);
assert.equal(sagittarius.effectiveRange(), 6);
assert.equal(context.game.attackBuffUntil, 10);
assert.equal(sagittarius.runtime.focusHits, 0);
sagittarius.runtime.focusHits = 59;
sagittarius.behavior.attack(sagittarius, enemy, { x: 0, y: 0 });
assert.equal(context.game.attackBuffUntil, 10);
assert.equal(sagittarius.runtime.focusHits, 59, "focus is frozen during transcendence");

// The same pixel conversion defines visual radius and gameplay inclusion.
assert.equal(RangeSystem.radius(4), 100.8);
assert.equal(RangeSystem.contains({ x: 0, y: 0 }, { x: 25.2, y: 0 }, 4), true);
assert.equal(RangeSystem.contains({ x: 0, y: 0 }, { x: 25.21, y: 0 }, 4), false);
assert.equal(RangeSystem.contains({ x: 0, y: 0 }, { x: 0, y: 12.6 }, 4), true);
assert.equal(RangeSystem.contains({ x: 0, y: 0 }, { x: 0, y: 12.61 }, 4), false);
context.arena.getBoundingClientRect = () => ({ width: 1024, height: 768 });
RangeSystem.refresh();
assert.ok(Math.abs(RangeSystem.radius(6) - 387.072) < 1e-9);
assert.equal(RangeSystem.contains({ x: 10, y: 10 }, { x: 47.8, y: 10 }, 6), true);
assert.equal(RangeSystem.contains({ x: 10, y: 10 }, { x: 47.81, y: 10 }, 6), false);

console.log(
  "Zodiac cancel, dawn constellation, merge, and exchange regressions passed.",
);
