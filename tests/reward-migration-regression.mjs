import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const file = await readFile("game.js", "utf8");
const migration = file.slice(file.indexOf("const SCREEN_STATES"), file.indexOf("function performConstellationDraws"));
function load(saved) {
  const storage = new Map(saved ? [["zodiacDefenseProgress", JSON.stringify(saved)]] : []);
  const context = { localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } };
  vm.createContext(context);
  vm.runInContext(`${migration}\nthis.value = playerProgress;`, context);
  return { value: JSON.parse(JSON.stringify(context.value)), saved: JSON.parse(storage.get("zodiacDefenseProgress")) };
}
for (const startingBalance of [500, 5000]) {
  const first = load({ starFragments: startingBalance, meteorFragments: 3, ownedStars: { RED: 4 } });
  assert.equal(first.value.starDust, startingBalance + 5000, "legacy summon currency migrates to dust plus grant");
  assert.equal(first.value.starShards, 0, "legacy summon currency never becomes level-up shards");
  assert.equal(first.value.meteorFragments, 23);
  assert.deepEqual(first.value.starCollection.RED, { count: 4, level: 1 });
  const reload = load(first.saved);
  assert.equal(reload.value.starDust, startingBalance + 5000, "dust grant does not repeat");
  assert.equal(reload.value.meteorFragments, 23, "meteor grant does not repeat");
}
assert.equal(load(null).value.starDust, 5000);
assert.equal(load(null).value.starShards, 0);
assert.match(file, /const shardReward = reachedWave \* 2/);
assert.match(file, /battle\.battleRewardGranted/);
console.log("Reward migration regression passed: currencies split, grants are idempotent, inventory migrates, and wave shards are guarded.");
