import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, js] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("styles.css", "utf8"),
  readFile("game.js", "utf8"),
]);

assert.match(html, /href="styles\.css\?v=27"/);
assert.match(html, /<script src="game\.js\?v=27" defer><\/script>/);
assert.equal((html.match(/data-act="summon"/g) || []).length, 1);
assert.match(html, /data-player="0"/);
assert.doesNotMatch(html, /data-player="1"/, "2P's direct controls must not be rendered");
assert.equal((html.match(/data-act="zodiac"/g) || []).length, 1);
assert.equal((html.match(/data-act="zodiac-cancel"/g) || []).length, 1);
assert.equal((html.match(/data-act="codex"/g) || []).length, 1);
assert.match(html, /id="zodiacCodex"/);
assert.match(html, />별자리 도감<\/button>/);
assert.match(css, /\.codex-panel\s*\{[\s\S]*?display:\s*flex;[\s\S]*?overflow:\s*hidden/);
assert.match(css, /\.codex-list\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto/);
assert.match(css, /-webkit-overflow-scrolling:\s*touch/);
assert.match(css, /\.codex-panel\s*\{[\s\S]*?height:\s*min\(90dvh,\s*900px\)/);
assert.match(css, /#game-shell\s*\{[\s\S]*?max-width:\s*600px;[\s\S]*?margin:\s*0 auto/);
assert.match(css, /\.codex-preview\s*\{[\s\S]*?min-height:\s*180px/);
assert.match(js, /preserveAspectRatio="xMidYMid meet"/);
assert.match(css, /body\.codex-open\s*\{[\s\S]*?overflow:\s*hidden/);
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
assert.match(css, /grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
assert.match(css, /grid-template-rows:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
assert.match(css, /\.road\s*\{[\s\S]*?stroke-width:\s*1\.35px/);
assert.match(css, /\.field\.p2\s*\{\s*top:\s*5%/);
assert.match(css, /\.field\.p1\s*\{\s*bottom:\s*5%/);
assert.match(css, /\.range-indicator\s*\{[\s\S]*?border-radius:\s*50%/);
assert.match(
  css,
  /\.range-indicator\s*\{[\s\S]*?pointer-events:\s*none/,
  "the visual range overlay must never intercept controls",
);
assert.match(
  css,
  /\.control-deck\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?z-index:\s*200/,
  "the control bar must live in a fixed top-level input layer",
);
assert.match(js, /this\.stars = Array\(15\)\.fill\(null\)/);
assert.match(js, /startStarlight:\s*5000/);
assert.match(js, /startDivinity:\s*50/);
assert.match(js, /bossWaveSeconds:\s*25/);
assert.match(js, /start\(\)[\s\S]*?this\.wave\.update\(0\)/, "wave 1 must start after construction");
for (const id of [
  "arena", "controls", "wave", "timer", "hp", "starlight1",
  "divinity1", "starlight2", "divinity2",
])
  assert.match(
    js,
    new RegExp(`${id} = getRequiredElement\\("${id}"\\)`),
    `${id} must be required during DOM-ready bootstrap`,
  );
assert.match(js, /summonCost:\s*30/);
assert.match(js, /emptySlots\(\)/);
assert.match(
  js.slice(js.indexOf("  summon() {"), js.indexOf("  tap(i) {")),
  /this\.clearNormalSelection\(\)/,
  "successful summoning must clear normal selection",
);
assert.match(js, /swapCost:\s*10/);
assert.match(js, /const nextTypes = STAR_KEYS\.filter\(\(type\) => type !== oldType\)/);
assert.match(js, /SwapSystem\.execute\(pick\.m, pick\.index\)/);
assert.match(css, /\.context-actions button\s*\{[\s\S]*?touch-action:\s*manipulation/);
assert.match(css, /\.context-actions \.action-above\s*\{[\s\S]*?translate\(-50%,\s*calc\(-100% - 18px\)\)/);
assert.match(css, /\.context-actions \.action-below\s*\{[\s\S]*?translate\(-50%,\s*18px\)/);
assert.match(js, /class="action-above" data-context="swap"/);
assert.match(js, /class="merge available action-below" data-context="merge"/);
assert.match(js, /slime:\s*\{[^}]*hp:\s*500/);
assert.match(js, /bug:\s*\{[^}]*hp:\s*800/);
assert.match(js, /name:\s*"코어 드론"[\s\S]*?hp:\s*10000/);
assert.match(js, /name:\s*"운석 괴물"[\s\S]*?hp:\s*20000/);
assert.match(js, /Math\.pow\(1 \+ CONFIG\.waveHpGrowth, wave - 1\)/);
assert.match(js, /this\.hpFill = this\.el\.querySelector\("\.bar i"\)/);
assert.match(js, /else this\.updateHealthBar\(\)/);
assert.doesNotMatch(
  js.slice(js.indexOf("  render() {"), js.indexOf("  update(dt) {")),
  /hpPercent|style\.width/,
  "enemy movement rendering must not update health bars",
);
assert.doesNotMatch(css, /contain:\s*layout style paint/, "paint containment must not clip enemy HP bars");
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
  /this\.selected = \[i\]/,
  "normal selection must stay singular and remain selected when tapped again",
);
assert.match(
  js,
  /if \(this\.zodiacMode\)[\s\S]*?this\.selected\.push\(i\)/,
  "multi-selection must be restricted to zodiac mode",
);
assert.doesNotMatch(js, /selected\.length\s*<\s*4|max(?:imum)? 4|0\/4/);
assert.match(js, /const ZODIAC_RECIPES = CONSTELLATION_DEFINITIONS/);
assert.match(js, /static exactMatch\(counts\)/);
assert.match(js, /static renderCodex\(\)/);
assert.match(js, /const CONSTELLATION_DEFINITIONS = Object\.freeze/);
assert.match(js, /this\.definitionId = definitionId/);
assert.match(js, /const isAstrologer = constellation\.definitionId === CONSTELLATION_IDS\.ASTROLOGER/);
assert.match(js, /constellation:\$\{constellation\.definitionId\}/,
  "the contextual-action cache must be invalidated by the selected definition");
assert.doesNotMatch(js, /display:\s*none[^}]*data-player/, "2P controls must not be hidden with CSS");
for (const name of ["새벽의 별자리", "광휘의 별자리", "궁수자리", "점성술자리"])
  assert.match(js, new RegExp(`name:\\s*"${name}"`), `${name} must remain in the registry`);
assert.doesNotMatch(js, /rangeBuffUntil|rangeBuffCooldownUntil|totalHits/);
assert.doesNotMatch(js, /사거리 \+1/);
assert.match(
  js.slice(js.indexOf("static renderCodex()"), js.indexOf("static zodiacComplete")),
  /Object\.entries\(ZODIAC_RECIPES\)/,
  "the codex must render the complete shared registry",
);
assert.match(js, /flatMap\(\(\[type, amount\]\)/, "the recipe must render one icon per required star");
assert.match(css, /\.codex-preview\s*\{[^}]*min-height:\s*180px/, "constellation previews must be prominent");
assert.match(css, /\.codex-preview \*\s*\{[^}]*pointer-events:\s*none/, "codex decorations must not intercept scrolling");
assert.match(js, /previewLayout:\s*Object\.freeze/g, "every constellation must define a visual-only layout");
assert.match(js, /this\.discoveredConstellations = new Set\(\)/);
assert.match(js, /game\.discoverConstellation\(definitionId\)/);
assert.match(js, /if \(this\.zodiacMode\) return;[\s\S]*?this\.summonAt\(i\)/, "empty zodiac slots must preserve selection");
assert.match(js, /summonAt\(i\)[\s\S]*?this\.clearNormalSelection\(\)/, "successful direct summons must clear normal selection");
assert.match(js, /event\.target\.closest\("\.slot, \.context-actions, button, \[role=button\]"\)/, "arena controls must not trigger background deselection");
assert.match(html, /id="field-1"/, "the 2P field must remain in the game");
assert.match(html, /M8 7V50H89 M8 93V50/, "both enemy paths must remain in the arena");
assert.match(js, /this\.connectionOrder = \[\.\.\.connectionOrder\]/);
assert.match(js, /c\.connectionOrder\.slice\(0, -1\)/);
assert.doesNotMatch(js, /selected\.sort\(/);
assert.match(js, /static dawnSpecial\(position, damage\)/);
assert.match(
  js,
  /let dt = Math\.min\([\s\S]*?\* this\.speed/,
  "global simulation delta must use speed multiplier",
);
assert.match(js, /p\.resources\.starlight \+= e\.reward/);
assert.match(js, /if \(e\.boss\) p\.resources\.divinity\+\+/);
assert.match(js, /const BASE_MAX_HP = 5000/);
assert.match(js, /this\.baseHP = BASE_MAX_HP/);
assert.match(js, /this\.baseHP = Math\.max\(0, this\.baseHP - e\.baseDamage\)/);
for (const [type, damage] of [["slime", 100], ["bug", 150]])
  assert.match(js, new RegExp(`${type}: \\{[^}]*baseDamage: ${damage}`));
for (const [name, damage] of [["코어 드론", 500], ["운석 괴물", 1000]])
  assert.match(js, new RegExp(`name: "${name}"[\\s\\S]*?baseDamage: ${damage}`));
assert.match(css, /\.slot\s*\{[\s\S]*?aspect-ratio:\s*1\s*\/\s*1/);
assert.match(js, /function bindPointerTap/);
assert.match(html, /<main class="app" id="game-shell">/);
assert.match(css, /#game-shell\s*\{[\s\S]*?width:\s*min\(100%,\s*600px\);[\s\S]*?max-width:\s*600px;[\s\S]*?height:\s*100dvh/);
assert.match(css, /\.field\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
assert.match(html, /styles\.css\?v=27/, "the deployed stylesheet URL must change when its layout changes");
assert.match(html, /game\.js\?v=27/, "the deployed script URL must not reuse the pre-direct-summon cache entry");
assert.match(css, /\.star-info\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?z-index:\s*160/);

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
