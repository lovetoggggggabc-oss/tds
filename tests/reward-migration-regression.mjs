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
  const first = load({ starFragments: startingBalance, starFragmentGrantVersion: 0 });
  assert.equal(first.value.starFragments, startingBalance + 2000, `first load grants 2,000 to ${startingBalance}`);
  assert.equal(first.saved.starFragmentGrantVersion, 2);
  const reload = load(first.saved);
  assert.equal(reload.value.starFragments, startingBalance + 2000, "reload does not repeat the grant");
}
assert.equal(load(null).value.starFragments, 2000, "new progression uses normal zero balance plus the grant, not a test 5,000 balance");
assert.match(file, /const reward = Math\.floor\(reachedWave \* 4 \* rewardMultiplier\)/);
assert.match(file, /const meteorReward = Math\.floor\(Math\.floor\(reachedWave \/ 20\) \* rewardMultiplier\)/);
console.log("Reward migration regression passed: one-time 2,000 grant, clean default, ×4 wave reward, and unchanged meteor formula verified.");
