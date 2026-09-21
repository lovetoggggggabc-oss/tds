import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const [html, css, js] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("styles.css", "utf8"),
  readFile("game.js", "utf8"),
]);

const helperSource = js.slice(js.indexOf("const GAME_MODES"), js.indexOf("// Pointer Events"));
const context = {};
vm.createContext(context);
vm.runInContext(`${helperSource}\nthis.normal = getNormalWaveHpMultiplier; this.waveMultiplier = getWaveHpMultiplier;`, context);
const normal = context.normal;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12 * Math.max(1, expected), `${actual} != ${expected}`);

close(normal(1), 1);
close(normal(2), 1.05);
close(normal(10), 1.05 ** 9);
close(normal(11), 1.05 ** 9 * 1.06);
close(normal(20), 1.05 ** 9 * 1.06 ** 10);
close(normal(21), 1.05 ** 9 * 1.06 ** 10 * 1.07);
close(normal(40), 1.05 ** 9 * 1.06 ** 10 * 1.07 ** 20);
close(normal(41), 1.05 ** 9 * 1.06 ** 10 * 1.07 ** 20 * 1.08);
close(normal(100), 1.05 ** 9 * 1.06 ** 10 * 1.07 ** 20 * 1.08 ** 60);
assert.ok(Number.isFinite(normal(100)));
assert.ok(Number.isFinite(normal(1_000_000)), "endless normal waves remain finite");
close(context.waveMultiplier("experimental_vertical", 1), 1);
close(context.waveMultiplier("experimental_vertical", 2), 1.04);
close(300 * context.waveMultiplier("experimental_vertical", 10), 300 * 1.04 ** 9);
close(300 * context.waveMultiplier("experimental_vertical", 40), 300 * 1.04 ** 39);
assert.ok(Number.isFinite(context.waveMultiplier("experimental_vertical", 1_000_000)), "endless vertical waves remain finite");
assert.match(js, /experimental_vertical: Object\.freeze\(\{ baseEnemyHp: 300, waveHpGrowth: \.04, enemyCountMultiplier: 2/);

assert.match(html, /\[업데이트 보상\][\s\S]*별가루 3,000개[\s\S]*별가루 ×3,000[\s\S]*보상 수령/);
assert.doesNotMatch(html, /별조각 ×3,000/);
assert.match(js, /balance_update_stardust_3000_v1/);
assert.match(js, /updateRewardClaiming \|\| playerProgress\.claimedMail\[UPDATE_REWARD_ID\]/);
assert.match(js, /playerProgress\.claimedMail\[UPDATE_REWARD_ID\]=true; playerProgress\.starDust\+=3000; savePlayerProgress\(\)/);
assert.doesNotMatch(js, /playerProgress\.starDust-=3000/);
assert.match(js, /claimedMail: \{ \.\.\.\(saved\?\.claimedMail \|\| \{\}\) \}/);

const newNews = js.indexOf('id: "difficulty_rebalance_2026_09_v1"');
assert.ok(newNews >= 0 && newNews < js.indexOf('id: "relic_growth_update_v1"'));
assert.ok(newNews < js.indexOf('id: "vertical_beta_2026_09"'));

assert.match(html, /star-info battle-selection-info/);
assert.match(css, /\.battle-overlay-layer \.star-info\{[^}]*position:absolute[^}]*width:min\(76cqw,640px\)[^}]*grid-template-columns:minmax\(0,1fr\)[^}]*writing-mode:horizontal-tb[^}]*word-break:keep-all/);
assert.match(css, /\.battle-overlay-layer \.side-controls\{[^}]*position:absolute/);
assert.match(js, /normalStarAbilityText\(s\.type, s\.tier, permanentLevel, g\.normalStarStageSums\)/);
assert.match(js, /constellationStats\.specialDescriptions\.map/);

console.log("Difficulty curves, reward migration, news ordering, and compact selection HUD regression passed.");
