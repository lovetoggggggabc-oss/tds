import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const file = await readFile("game.js", "utf8");
const prefix = file.slice(file.indexOf("const SCREEN_STATES"), file.indexOf("// Pointer Events"));
const saved = {
  starFragments: 2500,
  meteorFragments: 77,
  ownedStars: { SKY: 2, blue: 3 },
  ownedConstellations: ["DAWN", "GUARDIAN"],
  equippedConstellations: ["DAWN", "GUARDIAN"],
  constellationPity: 19,
};
const storage = new Map([["zodiacDefenseProgress", JSON.stringify(saved)]]);
const context = {
  Math,
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
};
vm.createContext(context);
vm.runInContext(`${prefix}\nthis.api = { STAR_TYPES, CONFIG, CONSTELLATION_DEFINITIONS, playerProgress, performConstellationDraws, GACHA_RULES };`, context);
const { STAR_TYPES, CONFIG, CONSTELLATION_DEFINITIONS, playerProgress, performConstellationDraws, GACHA_RULES } = context.api;

assert.deepEqual(Object.keys(STAR_TYPES), ["BLUE", "WHITE", "YELLOW", "ORANGE", "RED", "PURPLE", "GREEN"]);
assert.equal(Object.keys(CONFIG.stars).length, 7);
assert.equal(CONFIG.stars.yellow.name, "황색");
assert.equal(CONFIG.stars.sky, undefined);
assert.equal(playerProgress.ownedStars.YELLOW, 2, "legacy SKY inventory migrates to YELLOW");
assert.equal(playerProgress.ownedStars.BLUE, 3);
assert.equal(playerProgress.meteorFragments, 77, "migration preserves unrelated currency");
assert.deepEqual(JSON.parse(JSON.stringify(CONSTELLATION_DEFINITIONS.SAGITTARIUS.recipe)), { yellow: 2, blue: 2 });
assert.deepEqual(JSON.parse(JSON.stringify(CONSTELLATION_DEFINITIONS.TWILIGHT.recipe)), { red: 2, white: 1, blue: 1 });

const pityResult = performConstellationDraws(1, () => .99);
assert.equal(pityResult[0].kind, "constellation", "draw 20 is guaranteed even when RNG misses");
assert.equal(pityResult[0].guaranteed, true);
assert.equal(playerProgress.constellationPity, 0);
assert.equal(playerProgress.starFragments, 2400);

// Ten draws resolve sequentially: three misses, a natural hit, then six misses.
const sequence = [.9,.1, .9,.2, .9,.3, .01,.4, .9,.4, .9,.5, .9,.6, .9,.7, .9,.8, .9,.9];
const tenResults = performConstellationDraws(10, () => sequence.shift() ?? .9);
assert.equal(tenResults.length, 10);
assert.equal(tenResults[3].kind, "constellation");
assert.equal(playerProgress.constellationPity, 6);
assert.equal(playerProgress.starFragments, 1400);
assert.equal(GACHA_RULES.starChance + GACHA_RULES.constellationChance, 1);
assert.equal(JSON.parse(storage.get("zodiacDefenseProgress")).constellationPity, 6, "pity persists");

console.log("Meta system regression passed: seven stars, migration, recipes, atomic costs, natural draws, sequential ten-draw pity, and persistence verified.");
