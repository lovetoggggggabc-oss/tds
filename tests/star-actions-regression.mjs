import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile("game.js", "utf8");
const definitions = source.slice(0, source.indexOf("class UIManager"));
const hints = [];
let moonPlays = 0;

const context = {
  Math: Object.create(Math),
  document: { createElement: () => ({}) },
  UIManager: {
    hint: (message) => hints.push(message),
    mergeEffect: () => {},
    zodiacComplete: () => {},
    showDawnMoon: () => moonPlays++,
  },
  effects: { querySelectorAll: () => [] },
};
vm.createContext(context);
vm.runInContext(
  `${definitions}\nthis.testApi = { CONFIG, Star, Constellation, MergeSystem, SwapSystem, ZodiacSystem };`,
  context,
);

const { CONFIG, Star, Constellation, MergeSystem, SwapSystem, ZodiacSystem } =
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
  render() {},
  simulationTimeout(callback) {
    callback();
  },
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
swapManager.selected = [4];
context.Math.random = () => 0;
SwapSystem.execute(swapManager);
assert.equal(swapManager.player.resources.starlight, 100 - CONFIG.swapCost);
assert.notEqual(swapManager.stars[4].type, "blue");
assert.equal(swapManager.stars[4].tier, 3);
assert.deepEqual([...swapManager.selected], [4]);

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
  [2, "red"],
  [3, "white"],
])
  zodiacManager.stars[index] = new Star(type);
zodiacManager.zodiacMode = true;
zodiacManager.selected = [0, 1, 2, 3];
ZodiacSystem.create(zodiacManager);
assert.equal(moonPlays, 1);
const constellation = zodiacManager.stars[0].constellation;
assert.equal(CONFIG.constellation.damage, 500);
assert.equal(CONFIG.constellation.rate, 4);
assert.equal(CONFIG.constellation.range, 4);

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
for (let hit = 0; hit < 3; hit++) {
  constellation.cooldown = 0;
  constellation.attack(0);
}
assert.deepEqual(damage, [500, 500, 500, 500 * 15]);
assert.equal(constellation.hitCount, 0);
assert.equal(moonPlays, 1, "special attack must not replay the moon");

console.log(
  "Zodiac cancel, dawn constellation, merge, and exchange regressions passed.",
);
