import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const [source, html, css] = await Promise.all([
  readFile("game.js", "utf8"), readFile("index.html", "utf8"), readFile("styles.css", "utf8"),
]);

const start = source.indexOf("const EARLY_WAVE_COMPOSITIONS");
const end = source.indexOf("const MODE_CONFIG", start);
const registrySource = source.slice(start, end).replace("const EARLY_WAVE_COMPOSITIONS", "var EARLY_WAVE_COMPOSITIONS").replace("const MONSTER_CODEX_IDS", "var MONSTER_CODEX_IDS");
const context = {};
vm.createContext(context);
vm.runInContext(registrySource, context);
const waves = JSON.parse(JSON.stringify(context.EARLY_WAVE_COMPOSITIONS));

const expected = [null,
  { darkSlime: 8 }, { darkSlime: 10 }, { darkSlime: 10, shadowRunner: 2 },
  { darkSlime: 8, shadowRunner: 3, voidGolem: 1 }, { darkSlime: 6, shadowRunner: 6, voidGolem: 1 },
  { shadowRunner: 12 }, { voidGolem: 4, shadowRunner: 4 }, { voidGolem: 8 },
  { darkSlime: 4, voidGolem: 2, shadowRunner: 2, abyssEye: 1 }, { voidGuide: 1 },
  { darkSlime: 8 }, { darkSlime: 10 }, { darkSlime: 10, shadowRunner: 2 },
  { darkSlime: 8, shadowRunner: 3, voidGolem: 1 }, { darkSlime: 6, shadowRunner: 6, voidGolem: 1 },
  { shadowRunner: 12 }, { voidGolem: 4, shadowRunner: 4 }, { voidGolem: 8 },
  { darkSlime: 4, voidGolem: 2, shadowRunner: 2, abyssEye: 1 }, { voidPriest: 1 },
];
assert.deepEqual(waves, expected, "waves 1–20 must use the exact authoritative composition");
for (let wave = 11; wave <= 19; wave++) assert.deepEqual(waves[wave], waves[wave - 10]);

assert.deepEqual(JSON.parse(JSON.stringify(context.MONSTER_CODEX_IDS)), ["darkSlime", "shadowRunner", "voidGolem", "abyssEye", "voidGuide", "voidPriest"]);
assert.match(source, /const damageToBase = Math\.max\(0, e\.hp\)/);
assert.match(source, /this\.hp -= n \* lightMultiplier \* \(this\.damageTakenMultiplier \|\| 1\)/);
assert.match(source, /damageTakenMultiplier: \.8/);
assert.match(source, /this\.nextAbilityAt = this\.type === "abyssEye" \? this\.spawnTime \+ 10/);
assert.match(source, /this\.nextAbilityAt \+= 5/);
assert.match(source, /enemy\.marchBuffs\.set\(this, game\.gameTime \+ 3\)/);
assert.match(source, /this\.nextAbilityAt \+= 8/);
assert.match(source, /enemy\.maxHp \* \.05/);
assert.match(source, /this\.nextAbilityAt \+= 6/);
assert.match(source, /count \* multiplier/);
assert.match(source, /bossPreparation: true/);
assert.match(source, /at: \.74, type: bossType/);

assert.match(html, /data-open-monster-codex/);
assert.match(html, /id="monster-codex-list"/);
assert.match(html, /id="monster-codex-detail"/);
assert.match(css, /\.monster-codex-content\{display:flex;flex:1;min-height:0;/);
assert.match(css, /overflow-y:auto/);

console.log("Monster/wave/codex regression passed: 20 waves, boss preparations, abilities, current-HP leaks, and mobile codex verified.");
