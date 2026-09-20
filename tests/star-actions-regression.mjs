import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile("game.js", "utf8");
const definitions = source.slice(0, source.indexOf("class UIManager"));
const hints = [];
let moonPlays = 0;
const dawnBursts = [];
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
    divinationEffect: (position, success) => divinationResults.push({ position, success }),
  },
  effects: { querySelectorAll: () => [] },
};
context.arena = {
  getBoundingClientRect: () => ({ width: 400, height: 800 }),
};
vm.createContext(context);
vm.runInContext(
  `${definitions}\nthis.testApi = { CONFIG, Star, Constellation, RangeSystem, MergeSystem, SwapSystem, ZodiacSystem, DivinationSystem };`,
  context,
);

const { CONFIG, Star, Constellation, RangeSystem, MergeSystem, SwapSystem, ZodiacSystem, DivinationSystem } =
  context.testApi;

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
    stars: Array(15).fill(null),
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
      children: Array.from({ length: 15 }, () => ({
        classList: { add() {}, remove() {} },
      })),
    },
  };
};

context.game = {
  enemies: [],
  gameTime: 0,
  attackBuffUntil: 0,
  rangeBuffUntil: 0,
  rangeBuffCooldownUntil: 0,
  players: [],
  render() {},
  simulationTimeout(callback) {
    callback();
  },
  markDirty() {},
};

// Merge is immediate, retains the selected slot, and empties one material slot.
const mergeManager = makeManager();
mergeManager.stars[2] = new Star("blue", 1);
mergeManager.stars[8] = new Star("blue", 1);
mergeManager.selected = [2];
MergeSystem.execute(mergeManager);
assert.equal(mergeManager.stars[2].tier, 2);
assert.equal(mergeManager.stars[8], null);
assert.deepEqual([...mergeManager.selected], [2]);

// Exchange changes only type, charges exactly 10, and preserves tier/slot/selection.
const swapManager = makeManager();
swapManager.stars[4] = new Star("blue", 3);
swapManager.stars[7] = new Star("red", 2);
swapManager.selected = [4];
SwapSystem.begin(swapManager);
SwapSystem.execute(swapManager, 4, 7);
assert.equal(swapManager.player.resources.starlight, 100 - CONFIG.swapCost);
assert.equal(swapManager.stars[4].type, "red");
assert.equal(swapManager.stars[7].type, "blue");
assert.equal(swapManager.stars[7].tier, 3);
assert.deepEqual([...swapManager.selected], [7]);

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
assert.equal(moonPlays, 1);
const constellation = zodiacManager.stars[0].constellation;
assert.equal(CONFIG.constellations.dawn.damage, 500);
assert.equal(CONFIG.constellations.dawn.rate, 4);
assert.equal(CONFIG.constellations.dawn.range, 4);
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
assert.equal(constellation.hitCount, 0);
assert.equal(moonPlays, 1, "special attack must not replay the moon");
assert.deepEqual(dawnBursts, [{ position: { x: 1, y: 0 }, damage: 7500 }]);

// Dawn's streak belongs to one living, in-range target only.
const nextEnemy = { ...enemy, dead: false, hp: 100000, position: () => ({ x: 2, y: 0 }), hit: enemy.hit };
context.game.enemies = [nextEnemy];
constellation.target = enemy;
constellation.hitCount = 3;
enemy.dead = true;
constellation.cooldown = 0;
constellation.attack(0);
assert.equal(constellation.hitCount, 1, "changing targets resets the four-hit streak");
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
assert.equal(radiance.kind, "radiance");
assert.equal(radiance.componentStageSum, 4);
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
const radianceDamage = 950 * radiance.powerMultiplier;
assert.deepEqual(chained.map((enemy) => enemy.received || []), [
  [radianceDamage], [radianceDamage], [radianceDamage], [radianceDamage], [],
]);
context.game.enemies = chained.slice(0, 2).map((enemy) => ({ ...enemy, hp: 10000, received: [], hit: enemy.hit }));
radiance.cooldown = 0;
radiance.attack(0);
assert.deepEqual(context.game.enemies.map((enemy) => enemy.received), [[radianceDamage], [radianceDamage]]);

// Recipe matching is count-based: selection order and star tier never affect it.
for (const tiers of [[1, 1, 1], [2, 4, 3]]) {
  const manager = makeManager();
  for (const [index, type] of [[7, "white"], [2, "red"], [12, "red"]])
    manager.stars[index] = new Star(type, tiers[index === 7 ? 2 : index === 2 ? 0 : 1]);
  manager.zodiacMode = true;
  manager.selected = [7, 12, 2];
  assert.equal(ZodiacSystem.exactMatch(ZodiacSystem.counts(manager)), "radiance");
  ZodiacSystem.create(manager);
  assert.equal(manager.stars[7].constellation.kind, "radiance");
  assert.equal(manager.stars[7].constellation.componentStageSum, tiers.reduce((a, b) => a + b, 0));
}
assert.equal(ZodiacSystem.exactMatch({ blue: 3, white: 1 }), "dawn");
assert.equal(ZodiacSystem.exactMatch({ white: 1, blue: 3 }), "dawn");
assert.deepEqual([...ZodiacSystem.possibleMatches({ red: 2 })], ["radiance"]);
assert.deepEqual([...ZodiacSystem.possibleMatches({ red: 3 })], []);

// Divination replaces exchange for a constellation: 30 is paid first, then
// success grants 60 while failure removes at most another 15.
const divineManager = makeManager();
divineManager.stars[0] = new Star("blue");
divineManager.stars[0].constellation = { center: 0, kind: "astrologer" };
divineManager.selected = [0];
context.Math.random = () => 0.49;
DivinationSystem.execute(divineManager, 0);
assert.equal(divineManager.player.resources.starlight, 130);
context.Math.random = () => 0.51;
DivinationSystem.execute(divineManager, 0);
assert.equal(divineManager.player.resources.starlight, 85);
divineManager.player.resources.starlight = 31;
DivinationSystem.execute(divineManager, 0);
assert.equal(divineManager.player.resources.starlight, 0);
assert.deepEqual(divinationResults.map((result) => result.success), [true, false, false]);

// Visual paths preserve selection, deselection, and reselection order for
// every recipe size; matching continues to depend only on type counts.
const connectionCases = [
  { types: ["orange", "orange"], picks: [8, 2], kind: "astrologer" },
  { types: ["red", "white", "red"], picks: [9, 1, 5], kind: "radiance" },
  { types: ["blue", "blue", "white", "blue"], picks: [11, 3, 7, 0], kind: "dawn" },
  { types: ["blue", "sky", "blue", "sky"], picks: [6, 12, 2, 10], kind: "sagittarius" },
];
for (const { types, picks, kind } of connectionCases) {
  const manager = makeManager();
  picks.forEach((slot, index) => { manager.stars[slot] = new Star(types[index]); });
  manager.zodiacMode = true;
  manager.selected = [...picks];
  ZodiacSystem.create(manager);
  const made = manager.stars[picks[0]].constellation;
  assert.equal(made.kind, kind);
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
assert.equal(astrologerManager.player.resources.starlight, starlightBeforeAttack + 2);
assert.equal(astrologer.stats.damage, 10);
assert.equal(astrologer.stats.rate, 1);
assert.equal(astrologer.stats.range, 3);

// Sagittarius uses simulation time for both ally buffs and freezes focus
// accumulation during transcendence without introducing per-buff timers.
const sagittariusManager = makeManager();
[[1, "sky"], [5, "blue"], [7, "sky"], [12, "blue"]]
  .forEach(([slot, type]) => { sagittariusManager.stars[slot] = new Star(type); });
sagittariusManager.selected = [12, 1, 5, 7];
sagittariusManager.zodiacMode = true;
context.game.players = [{ manager: sagittariusManager }];
ZodiacSystem.create(sagittariusManager);
const sagittarius = sagittariusManager.stars[12].constellation;
assert.equal(sagittarius.stats.damage, 400);
assert.equal(sagittarius.stats.rate, 6);
assert.equal(sagittarius.stats.range, 6);
sagittarius.rangeHitCount = 14;
sagittarius.hitCount = 59;
sagittarius.afterHit();
assert.equal(context.game.rangeBuffUntil, 5);
assert.equal(context.game.rangeBuffCooldownUntil, 10);
sagittarius.hitCount = 60;
sagittarius.afterHit();
assert.equal(context.game.attackBuffUntil, 10);
assert.equal(sagittarius.hitCount, 0);

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
