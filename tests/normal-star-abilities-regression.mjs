import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const file = await readFile("game.js", "utf8");
const prefix = file.slice(file.indexOf("const SCREEN_STATES"), file.indexOf("function performConstellationDraws"));
const context = { Math, localStorage: { getItem: () => null, setItem() {} } };
vm.createContext(context);
vm.runInContext(`${prefix}\nthis.api={STAR_TYPES,normalStarSpecial,normalStarAbilityText};`, context);
const { STAR_TYPES, normalStarSpecial: special } = context.api;
const plain = value => JSON.parse(JSON.stringify(value));

assert.deepEqual(plain(Object.fromEntries(Object.values(STAR_TYPES).map(s => [s.key, [s.damage,s.rate,s.range]]))), {
  blue:[100,1,5], white:[75,2,3.5], yellow:[150,.8,5], orange:[125,1.5,4],
  red:[200,.5,3], purple:[100,1,4.5], green:[0,0,0],
});
assert.equal(special("blue",1,1).slowPercent,2);
assert.equal(special("blue",4,1).slowPercent,5);
assert.equal(special("blue",4,3).slowPercent,7);
assert.equal(special("blue",4,7).duration,1);
assert.deepEqual([1,2,3,4].map(stage => special("white",stage,7).rest), [1.75,1.5,1.25,1]);
assert.equal(special("yellow",1,1).lightPercent,2);
assert.equal(special("yellow",4,1).lightPercent,5);
assert.equal(special("yellow",4,3).lightPercent,7);
assert.equal(special("yellow",4,7).duration,1);
assert.deepEqual([1,2,3,4].map(stage => special("orange",stage,1).rawBurnInterval), [.375,.25,.125,0]);
assert.equal(special("orange",4,1).burnInterval,.05, "Stage 4 must use a non-zero simulation-safe interval");
assert.equal(special("orange",1,7).damageRatio,.5);
assert.deepEqual([1,2,3,4].map(stage => special("red",stage,1).areaRange), [.275,.4,.525,.65]);
assert.equal(special("purple",1,7,{purple:7}).attackSpeedBonus,.7);
assert.equal(special("green",1,1,{green:7}).attackSpeedBonus,.10);
assert.equal(special("green",1,3,{green:7}).attackSpeedBonus,.12);

assert.match(file, /normalStarStageSums = Object\.freeze\(\{ green: greenStageSum, purple: purpleStageSum \}\)/);
assert.match(file, /enemy !== t/, "red AoE must exclude its already-hit primary target");
assert.match(file, /burnNextAt: game\.gameTime \+ Math\.max\(\.05, interval\)/);
assert.doesNotMatch(file, /setInterval\(/, "status effects must not create per-enemy intervals");
console.log("Normal star ability regression passed: final stats, level/stage formulas, safe burn, AoE dedupe, and event caches verified.");
