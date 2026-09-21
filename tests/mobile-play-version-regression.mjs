import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, game] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("styles.css", "utf8"),
  readFile("game.js", "utf8"),
]);

for (const [mode, title] of [["normal", "일반 모드"], ["vertical", "세로 대전장 BETA"]]) {
  const card = html.match(new RegExp(`<button type="button" class="stage-card mode-card[^>]*data-battle-mode="${mode}"[\\s\\S]*?<span class="mode-title">${title}</span>[\\s\\S]*?터치하여 플레이[\\s\\S]*?</button>`));
  assert.ok(card, `${title} must be one semantic, full-card button`);
}
assert.doesNotMatch(html, /mode-play-button|id="play-battle"|id="play-experimental"/);
assert.match(css, /\.battle-mode-grid \.mode-card>\*\{pointer-events:none\}/);
assert.match(css, /\.battle-mode-grid \.mode-card\{[^}]*touch-action:pan-y/);
assert.match(css, /\.battle-mode-grid \.mode-card:active\{[^}]*scale\(\.985\)/);
assert.match(css, /padding-bottom:calc\(var\(--mobile-safe-bottom\) \+ 64px\)/);

assert.match(game, /Math\.hypot\([^)]*\) > 10/);
assert.match(game, /let modeSelectionLocked = false/);
assert.match(game, /now - battleMenuOpenedAt > 80/);
assert.match(game, /bindPointerTap\(card/);
assert.match(game, /mode === GAME_MODES\.NORMAL \? beginMapRandom\(\) : startBattle\(GAME_MODES\.EXPERIMENTAL_VERTICAL\)/);
assert.match(game, /const GAME_VERSION = "1\.02 BETA"/);
assert.match(game, /id: "beta_1_02_mode_selection_fix", version: GAME_VERSION/);
assert.match(game, /id: "beta_1_01_mobile_play_fix", version: "1\.01 BETA"/);
assert.match(game, /class="news-version">VERSION \$\{item\.version\}/);
assert.match(html, /class="game-version" data-game-version/);

console.log("Full-card mobile mode selection and 1.02 BETA version/news regression checks passed.");
