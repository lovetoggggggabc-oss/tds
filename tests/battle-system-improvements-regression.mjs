import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, js] = await Promise.all([
  readFile("index.html", "utf8"), readFile("styles.css", "utf8"), readFile("game.js", "utf8"),
]);

assert.match(js, /JUDGEMENT: "JUDGEMENT"/);
assert.match(js, /name: "심판의 자리"[\s\S]*recipe: Object\.freeze\(\{ white: 2 \}\), attackDamage: 1000,[\s\S]*attackSpeed: 5\.5, range: 7\.5/);
assert.match(js, /target\.judgementTarget \? target\.hp \* 0\.035 : 0/);
assert.doesNotMatch(js, /judgementTarget \? target\.hp \* 0\.10/);
assert.match(js, /Object\.values\(CONSTELLATION_DEFINITIONS\)\.map\(\(definition\)/, "collection renders locked and owned definitions from the complete registry");

assert.match(html, /id="map-random"/);
assert.doesNotMatch(html, /data-map-vote|map-vote-time/);
assert.match(js, /const selector = new RandomMapSelector\(random\)/);
assert.match(js, /setTimeout\(\(\) => startBattle\(GAME_MODES\.NORMAL\), 2750\)/);
assert.doesNotMatch(js, /requestAnimationFrame\(frame\)/);
assert.match(css, /\.map-random-cards article\.active/);
assert.match(css, /@keyframes randomMapWinner/);

assert.match(css, /\.battle-mode-grid\{[^}]*flex:1[^}]*min-height:0[^}]*overflow-y:auto[^}]*overflow-x:hidden[^}]*-webkit-overflow-scrolling:touch[^}]*padding:[^}]*env\(safe-area-inset-bottom\)/);
assert.match(js, /const showBattleMenu = \(\) => showScreen\(SCREEN_STATES\.BATTLE_MENU\)/);
assert.match(js, /\[data-open-battle\][\s\S]*navigateOnce\(showBattleMenu\)/);
assert.match(js, /const intentionalActivation = event\.detail === 0 \|\| playIntentArmed/);

assert.match(js, /id: "battle_system_update_random_map_v1"/);
assert.match(js, /const unread=NEWS_ITEMS\.filter\(\(item\)=>!playerProgress\.readNewsIds\[item\.id\]\)\.length/);
assert.match(js, /badge\.hidden = unread===0/);
assert.match(js, /NEWS_ITEMS\.slice\(legacyNewsIndex\)\.forEach/, "legacy last-read saves migrate without clearing read history");
assert.match(js, /NEWS_ITEMS\.forEach\(\(item\) => \{ playerProgress\.readNewsIds\[item\.id\] = true; \}\);[\s\S]*savePlayerProgress\(\); refreshNews\(\)/);
assert.match(js, /Math\.floor\(reachedWave \* \(vertical \? 4 : 8\) \* rewardMultiplier\)/);

console.log("Battle-system improvements regression passed: Judgement, random map VFX, safe scrolling, news persistence, navigation guard, and rewards verified.");
