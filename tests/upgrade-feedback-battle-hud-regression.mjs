import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, game] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("styles.css", "utf8"),
  readFile("game.js", "utf8"),
]);

assert.match(game, /showBattleStarInfo: true/);
assert.match(game, /settings: \{ \.\.\.DEFAULT_SETTINGS, \.\.\.\(saved\?\.settings \|\| \{\}\) \}/);
assert.match(html, /data-setting-star-info/);
assert.match(game, /if\(!playerProgress\.settings\.showBattleStarInfo\) starInfo\.hidden=true/);
assert.match(game, /comparisonRow\("공격력"/);
assert.match(game, /starLevelStats\(star,entry\.level\+1\)/);
assert.match(game, /constellationLevelStats\(d,entry\.level\+1\)/);
assert.match(game, /getRelicEffect\(id,e\.level\+1\)/);
assert.match(game, /보호막 증가까지 \$\{level\} \/ 3/);
assert.match(game, /RELIC LEVEL UP/);
assert.match(game, /✦ LEVEL UP/);
assert.match(game, /equipped-badge/);
assert.match(game, /장착 완료/);
assert.match(html, /class="resources battle-resources"/);
assert.doesNotMatch(html.match(/<header class="game-hud[\s\S]*?<\/header>/)?.[0] || "", /class="resources"/);
assert.match(css, /button\[data-act="zodiac"\]\{position:absolute;left:50%;top:7px;transform:translateX\(-50%\)/);
assert.match(css, /right:calc\(50% \+ clamp\(72px,20cqw,90px\)\)/);
assert.match(css, /padding-bottom:max\(8px,env\(safe-area-inset-bottom\)\)/);
assert.match(css, /max-height:min\(210px,31cqh\)/);
assert.match(html, /data-equipped-slots/);

console.log("1.04 upgrade feedback, equipment state, compact info, setting migration, and centered battle HUD checks passed.");
