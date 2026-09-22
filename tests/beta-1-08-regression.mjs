import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [js, html, css] = await Promise.all(["game.js", "index.html", "styles.css"].map((file) => readFile(file, "utf8")));

assert.match(js, /const GAME_VERSION = "1\.08 BETA"/);
assert.match(js, /id: "beta_1_08_battle_view_expansion"/);
for (let version = 1; version <= 7; version += 1) assert.match(js, new RegExp(`\\[1\\.0${version} BETA\\]`));
assert.doesNotMatch(html.match(/<header class="game-hud battle-top-hud">[\s\S]*?<\/header>/)?.[0] || "", /별자리 디펜스|ZODIAC DEFENSE|ASTRAL CORE|NEXT ENEMY/);
assert.match(html, /class="wave"[\s\S]*id="wave"[\s\S]*id="timer"/);
assert.match(html, /class="hp"[\s\S]*id="hp"[\s\S]*id="baseShields"/);
assert.match(html, /<b>다음 적<\/b><div id="nextEnemies">/);
assert.match(css, /\.battle-top-hud\{[\s\S]*position:absolute!important[\s\S]*height:0/);
assert.match(css, /\.battle-top-hud \.wave\{[\s\S]*left:50%;translate:-50% 0/);
assert.match(css, /\.battle-map-area\{padding:0!important\}/);
assert.match(css, /\.battle-overlay-layer \.side-controls\{top:calc/);
assert.match(js, /⚠ BOSS ·/);
assert.match(html, /battle-resources[\s\S]*별빛[\s\S]*신성[\s\S]*data-act="zodiac"[\s\S]*data-battle-resonance[\s\S]*codex-button/);
console.log("1.08 beta battle viewport regression passed.");
