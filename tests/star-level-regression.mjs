import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const file = await readFile("game.js", "utf8");
const prefix = file.slice(file.indexOf("const SCREEN_STATES"), file.indexOf("function performConstellationDraws"));
const saved = {
  starDust: 100, starShards: 399, meteorFragments: 0,
  starCollection: Object.fromEntries(["BLUE","WHITE","YELLOW","ORANGE","RED","PURPLE","GREEN"].map(id => [id, { count: id === "RED" ? 126 : 0, level: 1 }])),
  ownedStars: { RED: 126 }, ownedConstellations: [], equippedConstellations: [],
  oneTimeGrants: { starDust5000_v1: true, meteorFragments20_v2: true },
};
const storage = new Map([["zodiacDefenseProgress", JSON.stringify(saved)]]);
const context = { Math, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } };
vm.createContext(context);
vm.runInContext(`${prefix}\nthis.api={playerProgress,upgradeStar,starLevelCosts,starLevelDamageMultiplier,starLevelAttackSpeedBonus};`, context);
const api = context.api;
assert.deepEqual(JSON.parse(JSON.stringify([1,2,3,4,5,6].map(api.starLevelCosts))), [{copies:2,shards:4},{copies:4,shards:10},{copies:8,shards:25},{copies:16,shards:60},{copies:32,shards:100},{copies:64,shards:200}]);
for (let level = 2; level <= 7; level++) assert.equal(api.upgradeStar("RED"), true);
assert.deepEqual(JSON.parse(JSON.stringify(api.playerProgress.starCollection.RED)), { count: 0, level: 7 });
assert.equal(api.playerProgress.starShards, 0);
assert.equal(api.upgradeStar("RED"), false, "MAX cannot be upgraded");
assert.equal(api.starLevelDamageMultiplier(7), 2.2);
assert.ok(Math.abs(api.starLevelAttackSpeedBonus(7) - .6) < 1e-9);
for (const id of ["BLUE","WHITE","YELLOW","ORANGE","RED","PURPLE","GREEN"])
  assert.ok(api.playerProgress.starCollection[id], `${id} has permanent progression`);
console.log("Star level regression passed: seven types, atomic Lv1-Lv7 table costs, MAX, damage and speed scaling.");
