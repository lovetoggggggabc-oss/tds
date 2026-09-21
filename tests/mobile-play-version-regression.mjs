import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, game] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("styles.css", "utf8"),
  readFile("game.js", "utf8"),
]);

for (const [id, label] of [["play-battle", "일반 모드 플레이"], ["play-experimental", "세로 대전장 플레이"]]) {
  const card = html.match(new RegExp(`<article class="stage-card mode-card[\\s\\S]*?<button type="button" class="mode-play-button" id="${id}"><span>${label}</span></button></div>\\s*</article>`));
  assert.ok(card, `${label} button must be a child of its mode body`);
}

const modeRules = css.match(/\.battle-mode-grid \.stage-card \.mode-play-button\{([^}]*)\}/)?.[1] || "";
assert.match(modeRules, /position:relative/);
assert.match(modeRules, /flex:0 0 auto/);
assert.match(modeRules, /min-height:52px/);
assert.match(modeRules, /visibility:visible/);
assert.doesNotMatch(modeRules, /position:absolute|display:none|height:0|max-height:0|opacity:0|pointer-events:none/);
assert.match(css, /\.battle-mode-grid \.stage-card\{[^}]*height:auto/);
assert.match(css, /\.battle-mode-grid \.mode-body\{[^}]*overflow:visible/);
assert.match(css, /\.battle-mode-grid\{[^}]*padding-bottom:calc\(var\(--mobile-safe-bottom\) \+ 40px\)/);

assert.match(game, /const GAME_VERSION = "1\.01 BETA"/);
assert.match(game, /id: "beta_1_01_mobile_play_fix", version: GAME_VERSION/);
assert.match(game, /class="news-version">VERSION \$\{item\.version\}/);
assert.match(html, /class="game-version" data-game-version/);
assert.equal((game.match(/id: "/g) || []).length >= 6, true, "existing news items must remain");

console.log("Mobile PLAY flow and 1.01 BETA version/news regression checks passed.");
