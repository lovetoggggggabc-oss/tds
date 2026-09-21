import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const file = await readFile("game.js", "utf8");
const prefix = file.slice(file.indexOf("const SCREEN_STATES"), file.indexOf("function performConstellationDraws"));
const saved = {
  starDust: 100, starShards: 7, meteorFragments: 0,
  starCollection: Object.fromEntries(["BLUE","WHITE","YELLOW","ORANGE","RED","PURPLE","GREEN"].map(id => [id, { count: id === "RED" ? 14 : 0, level: 1 }])),
  ownedStars: { RED: 14 }, ownedConstellations: [], equippedConstellations: [],
  oneTimeGrants: { starDust5000_v1: true, meteorFragments20_v2: true },
};
const storage = new Map([["zodiacDefenseProgress", JSON.stringify(saved)]]);
const context = { Math, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } };
vm.createContext(context);
vm.runInContext(`${prefix}\nthis.api={playerProgress,upgradeStar,starLevelCosts,starLevelDamageMultiplier,starLevelAttackSpeedBonus};`, context);
const api = context.api;
assert.deepEqual(JSON.parse(JSON.stringify([1,2,3].map(api.starLevelCosts))), [{copies:2,shards:1},{copies:4,shards:2},{copies:8,shards:4}]);
assert.equal(api.upgradeStar("RED"), true);
assert.deepEqual(JSON.parse(JSON.stringify(api.playerProgress.starCollection.RED)), { count: 12, level: 2 });
assert.equal(api.playerProgress.starShards, 6);
assert.equal(api.upgradeStar("RED"), true);
assert.equal(api.upgradeStar("RED"), true);
assert.deepEqual(JSON.parse(JSON.stringify(api.playerProgress.starCollection.RED)), { count: 0, level: 4 });
assert.equal(api.playerProgress.starShards, 0);
assert.equal(api.upgradeStar("RED"), false, "MAX cannot be upgraded");
assert.equal(api.starLevelDamageMultiplier(4), 1.6);
assert.ok(Math.abs(api.starLevelAttackSpeedBonus(4) - .3) < 1e-9);
for (const id of ["BLUE","WHITE","YELLOW","ORANGE","RED","PURPLE","GREEN"])
  assert.ok(api.playerProgress.starCollection[id], `${id} has permanent progression`);
console.log("Star level regression passed: seven types, atomic 2/4/8 + 1/2/4 costs, MAX, damage and speed scaling.");
