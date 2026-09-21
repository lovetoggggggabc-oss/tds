import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const file = await readFile("game.js", "utf8");
const source = file.slice(file.indexOf("const SCREEN_STATES"), file.indexOf("function performConstellationDraws"));
function boot(saved) {
  const storage = new Map(saved ? [["zodiacDefenseProgress", JSON.stringify(saved)]] : []);
  const context = { localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } };
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.api={playerProgress,redeemSpecialCode};`, context);
  return { context, storage };
}
const { context, storage } = boot({ starDust: 10, starShards: 20, meteorFragments: 30, oneTimeGrants: { "starDust5000_v1": true, "meteorFragments20_v2": true } });
const { playerProgress, redeemSpecialCode } = context.api;
assert.deepEqual(JSON.parse(JSON.stringify(playerProgress.redeemedSpecialCodes)), {}, "legacy saves migrate with an empty code ledger");
assert.equal(redeemSpecialCode("wrong").message, "유효하지 않은 코드입니다.");
assert.deepEqual([playerProgress.starDust, playerProgress.starShards, playerProgress.meteorFragments], [10, 20, 30]);
assert.equal(redeemSpecialCode(" hamburger123 ").ok, true);
assert.deepEqual([playerProgress.starDust, playerProgress.starShards, playerProgress.meteorFragments], [50010, 50020, 1030]);
assert.equal(redeemSpecialCode("hamburger123").message, "이미 사용한 코드입니다.");
assert.deepEqual([playerProgress.starDust, playerProgress.starShards, playerProgress.meteorFragments], [50010, 50020, 1030]);
const reload = boot(JSON.parse(storage.get("zodiacDefenseProgress"))).context.api;
assert.equal(reload.redeemSpecialCode("hamburger123").message, "이미 사용한 코드입니다.", "redemption remains blocked after reload");
assert.deepEqual([reload.playerProgress.starDust, reload.playerProgress.starShards, reload.playerProgress.meteorFragments], [50010, 50020, 1030]);
console.log("Special-code regression passed: migration, exact matching, atomic rewards, duplicate clicks, and reload persistence verified.");
