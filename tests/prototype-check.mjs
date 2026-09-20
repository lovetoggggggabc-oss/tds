import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, js] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("styles.css", "utf8"),
  readFile("game.js", "utf8"),
]);

assert.match(html, /href="styles\.css"/);
assert.match(html, /src="game\.js"/);
assert.equal((html.match(/data-act="summon"/g) || []).length, 1);
assert.match(html, /data-player="0"/);
assert.doesNotMatch(html, /data-player="1"/);
assert.equal((html.match(/data-act="zodiac"/g) || []).length, 1);
assert.equal((html.match(/data-act="zodiac-cancel"/g) || []).length, 1);
assert.equal((html.match(/data-act="codex"/g) || []).length, 1);
assert.match(html, /id="zodiacCodex"/);
assert.match(html, /id="dawnMoon"/);
assert.match(css, /\.dawn-moon\s*\{[\s\S]*?pointer-events:\s*none/);
assert.match(css, /\.dawn-special\s*\{[\s\S]*?pointer-events:\s*none/);
assert.doesNotMatch(html, /1P 마법사|2P 마법사|class="wallet"|class="players"/);
assert.match(html, /class="game-controls"/);
assert.ok(
  html.indexOf('class="field-label two"') <
    html.indexOf('class="field-label one"'),
  "2P field must be above 1P",
);
assert.match(
  html,
  /M8 7V50H89 M8 93V50/,
  "two starts must join a straight finish path",
);
assert.match(css, /grid-template-columns:\s*repeat\(5,\s*1fr\)/);
assert.match(css, /grid-template-rows:\s*repeat\(3,\s*1fr\)/);
assert.match(css, /\.road\s*\{[\s\S]*?stroke-width:\s*1\.35px/);
assert.match(css, /\.field\.p2\s*\{\s*top:\s*16%/);
assert.match(css, /\.field\.p1\s*\{\s*bottom:\s*16%/);
assert.match(css, /\.range-indicator\s*\{[\s\S]*?border-radius:\s*50%/);
assert.match(
  css,
  /\.range-indicator\s*\{[\s\S]*?pointer-events:\s*none/,
  "the visual range overlay must never intercept controls",
);
assert.match(
  css,
  /\.game-controls\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?z-index:\s*200/,
  "the control bar must live in a fixed top-level input layer",
);
assert.match(js, /this\.stars = Array\(15\)\.fill\(null\)/);
assert.match(js, /startStarlight:\s*5000/);
assert.match(js, /startDivinity:\s*50/);
assert.match(js, /summonCost:\s*30/);
assert.match(js, /emptySlots\(\)/);
assert.doesNotMatch(
  js.slice(js.indexOf("  summon() {"), js.indexOf("  tap(i) {")),
  /exitModes|clearOthers|selectOnly/,
  "summoning must not change selection or action modes",
);
assert.match(js, /swapCost:\s*10/);
assert.match(js, /slime:\s*\{[^}]*hp:\s*500/);
assert.match(js, /bug:\s*\{[^}]*hp:\s*800/);
assert.match(js, /name:\s*"코어 드론"[\s\S]*?hp:\s*10000/);
assert.match(js, /name:\s*"운석 괴물"[\s\S]*?hp:\s*20000/);
assert.match(js, /Math\.pow\(1 \+ CONFIG\.waveHpGrowth, wave - 1\)/);
assert.match(
  js,
  /rangeIndicator\.style\.width = diameter \+ "px";\s*rangeIndicator\.style\.height = diameter \+ "px"/,
);
assert.match(js, /static partner\(m\)/);
assert.match(js, /s\.tier\+\+;\s*m\.stars\[b\] = null/);
assert.doesNotMatch(
  js,
  /simulationTimeout\(\(\) => \{\s*s\.tier\+\+/,
  "merge state changes must not wait for an animation timeout",
);
assert.doesNotMatch(
  js,
  /data-act="merge"/,
  "merge must only be presented beside the selected star",
);
assert.doesNotMatch(js, /data-act="swap"/, "swap must not be a footer action");
assert.doesNotMatch(
  js,
  /data-act="release"/,
  "constellation release must not be a footer action",
);
assert.match(
  js,
  /data-context="swap"[\s\S]*data-context="merge"/,
  "normal-star actions must be contextual",
);
assert.match(js, /data-context="release"/, "release must be contextual");
assert.match(
  js,
  /let c = m\.stars\[center\]\?\.constellation;[\s\S]*c\.center !== center/,
  "only a selected constellation center may be released",
);
assert.match(
  js,
  /this\.selected = deselect \? \[\] : \[i\]/,
  "normal selection must stay singular",
);
assert.match(
  js,
  /if \(this\.zodiacMode\)[\s\S]*?this\.selected\.push\(i\)/,
  "multi-selection must be restricted to zodiac mode",
);
assert.doesNotMatch(js, /selected\.length\s*<\s*4|max(?:imum)? 4|0\/4/);
assert.match(js, /const ZODIAC_RECIPES = CONFIG\.constellations/);
assert.match(js, /static exactMatch\(counts\)/);
assert.match(js, /static renderCodex\(\)/);
assert.match(js, /static dawnSpecial\(position, damage\)/);
assert.match(
  js,
  /let dt = Math\.min\([\s\S]*?\* this\.speed/,
  "global simulation delta must use speed multiplier",
);
assert.match(js, /p\.resources\.starlight \+= e\.reward/);
assert.match(js, /if \(e\.boss\) p\.resources\.divinity\+\+/);
assert.match(js, /if \(--this\.hp <= 0\)/);

const isBoss = (n) =>
  (n <= 40 && n % 10 === 0) ||
  (n >= 45 && n <= 60 && n % 5 === 0) ||
  (n >= 62 && n % 2 === 0);
assert.deepEqual(
  [10, 20, 30, 40, 45, 50, 55, 60, 62, 64, 66].map(isBoss),
  Array(11).fill(true),
);
assert.equal(isBoss(61), false);
assert.equal(isBoss(63), false);

console.log("Prototype structure and finalized game-rule checks passed.");
