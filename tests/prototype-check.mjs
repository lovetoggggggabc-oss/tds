import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, js] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("styles.css", "utf8"),
  readFile("game.js", "utf8"),
]);

assert.match(html, /href="styles\.css\?v=50"/);
assert.match(html, /<script src="game\.js\?v=49" defer><\/script>/);
assert.equal((html.match(/data-act="summon"/g) || []).length, 0);
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
assert.match(css, /--game-shell-width:\s*min\(100%,\s*600px,\s*56\.25dvh\)/,
  "landscape screens must retain a shell-local 9:16 width");
assert.match(css, /#game-shell\s*\{[\s\S]*?width:\s*var\(--game-shell-width\);[\s\S]*?max-width:\s*600px;[\s\S]*?margin:\s*0 auto/);
assert.match(css, /\.utility-dialog\s*\{[^}]*width:var\(--game-shell-width\);[^}]*container-type:size/,
  "utility modals must use the same size container as the visible game shell");
assert.match(css, /\.codex-preview-wrap\s*\{[\s\S]*?height:\s*180px/);
assert.match(js, /preserveAspectRatio="xMidYMid meet"/);
assert.match(css, /body\.codex-open\s*\{[\s\S]*?overflow:\s*hidden/);
assert.match(html, /id="dawnMoon"/);
assert.match(html, /data-gacha-board="constellation"/);
assert.match(html, /data-gacha-board="relic"/);
assert.match(html, /id="draw-sequence"/, "draw dialog includes a constellation-linking reveal stage");
assert.match(css, /@keyframes drawSummonLink/, "summon lines animate into place before results appear");
assert.match(css, /@keyframes igniteSummonStar/, "summon stars ignite in sequence");
assert.match(js, /ownedConstellations: Object\.freeze\(\["ASTROLOGER"\]\)/, "astrologer is the starter constellation");
for (const cost of ["100", "1000"])
  assert.match(html, new RegExp(`data-draw="constellation" data-cost="${cost}"`));
for (const cost of ["3", "30"])
  assert.match(html, new RegExp(`data-draw="relic" data-cost="${cost}"`));
assert.doesNotMatch(html, /battle-countdown|preparation-count|preparation-label/,
  "preparation must not render a field-covering countdown");
assert.doesNotMatch(css, /\.battle-countdown|\.battle-transition/,
  "preparation must not add a visual overlay or darkening layer");
assert.match(css, /\.wave\s*\{[\s\S]*?pointer-events:\s*none/,
  "the HUD preparation timer must never intercept field input");
assert.match(js, /const PREPARATION_SECONDS = 15/);
assert.match(js, /Math\.floor\(reachedWave \/ 5\)/);
assert.match(js, /meteorFragments: Math\.max\(0,/);
assert.match(css, /\.dawn-moon\s*\{[\s\S]*?pointer-events:\s*none/);
assert.match(css, /\.dawn-special\s*\{[\s\S]*?pointer-events:\s*none/);
assert.doesNotMatch(html, /1P 마법사|2P 마법사|class="wallet"|class="players"/);
assert.match(html, /class="game-controls"/);
assert.equal((html.match(/>출발</g) || []).length, 0, "spawn remains logical and has no arena visual");
assert.equal((html.match(/>기지</g) || []).length, 0, "destination remains logical and has no arena visual");
assert.match(js, /const MAP_DEFINITIONS = Object\.freeze/);
assert.match(js, /spawn: Object\.freeze\(\{ x: 50, y: 94 \}\)/);
assert.match(js, /destination: Object\.freeze\(\{ x: 50, y: 6 \}\)/);
assert.equal((html.match(/class="road"/g) || []).length, 1, "the arena has one road");
assert.match(html, /class="roadStars"/, "the road carries a subtle particle layer");
assert.match(js, /\.roadGlow,\.roadEdge,\.road,\.roadStars/, "all visible road layers share routePathData");
assert.doesNotMatch(html, /data-act="summon-cancel"/);
assert.doesNotMatch(css, /\.free-field\.placing/);
assert.match(css, /\.road\s*\{[\s\S]*?stroke-width:\s*34px/);
assert.match(css, /\.range-indicator\s*\{[\s\S]*?border-radius:\s*50%/);
assert.match(
  css,
  /\.range-indicator\s*\{[\s\S]*?pointer-events:\s*none/,
  "the visual range overlay must never intercept controls",
);
assert.match(css, /\.battle-bottom-area\s*\{[\s\S]*?flex:\s*0 0 auto/, "the control bar occupies a dedicated shell-local flow area");
assert.match(js, /this\.stars = Array\(maxStars\)\.fill\(null\)/);
assert.match(js, /startStarlight:\s*300/);
assert.match(js, /startDivinity:\s*1/);
assert.match(js, /waveSeconds:\s*10/);
assert.match(js, /bossWaveSeconds:\s*20/);
assert.match(js, /beginCombat\(\)[\s\S]*?this\.wave\.update\(0\)/, "wave 1 must start only after preparation");
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
assert.match(js.slice(js.indexOf("  summonAt(x, y) {"), js.indexOf("  tap(i) {")), /this\.clearNormalSelection\(\)/,
  "successful summoning must clear normal selection");
assert.match(js, /swapCost:\s*10/);
assert.match(js, /const nextTypes = STAR_KEYS\.filter\(\(type\) => type !== oldType\)/);
assert.match(js, /pick\.m\.exchangeSelectedStar\(\)/);
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
  /playerProgress\.equippedConstellations\.slice\(0, MAX_EQUIPPED_CONSTELLATIONS\)/,
  "the battle codex must render only the saved six-slot deck",
);
assert.match(js, /flatMap\(\(\[type, amount\]\)/, "the recipe must render one icon per required star");
assert.match(css, /\.codex-preview-wrap\s*\{[^}]*height:\s*180px/, "constellation previews must be prominent");
assert.match(css, /\.codex-preview \*\s*\{[^}]*pointer-events:\s*none/, "codex decorations must not intercept scrolling");
assert.match(js, /previewLayout:\s*Object\.freeze/g, "every constellation must define a visual-only layout");
assert.match(js, /this\.discoveredConstellations = new Set\(\)/);
assert.match(js, /game\.discoverConstellation\(definitionId\)/);
assert.match(js, /summonAt\(x, y\)[\s\S]*?this\.clearNormalSelection\(\)/, "successful free placement must clear normal selection");
assert.match(js, /event\.target\.closest\("\.star-node, \.context-actions/, "star and UI input must not trigger map summoning");
assert.match(html, /id="field-1"/, "the 2P field must remain in the game");
assert.match(js, /this\.pathProgress = Math\.min\(1, this\.progress \/ 100\)/);
assert.match(js, /const roadClearance = activeMap\.roadWidth \/ 2 \+ starRadius \+ activeMap\.placementPadding/);
assert.match(js, /this\.connectionOrder = \[\.\.\.connectionOrder\]/);
assert.match(js, /c\.connectionOrder\.slice\(0, -1\)/);
assert.doesNotMatch(js, /selected\.sort\(/);
assert.match(js, /static dawnSpecial\(position, damage\)/);
assert.match(
  js,
  /let dt = realDt \* this\.speed/,
  "global simulation delta must use speed multiplier",
);
assert.match(js, /p\.resources\.starlight \+= Math\.floor\(e\.reward \* relicMultiplier\("STARLIGHT_CRYSTAL"\)\)/);
assert.match(js, /if \(e\.boss\) p\.resources\.divinity\+\+/);
assert.match(js, /const BASE_MAX_HP = 400/);
assert.match(js, /this\.base = \{ hp: initialBaseHp, maxHp: initialBaseHp \}/);
assert.match(js, /this\.damageBase\(damageToBase\)/);
for (const [type, damage] of [["slime", 100], ["bug", 150]])
  assert.match(js, new RegExp(`${type}: \\{[^}]*baseDamage: ${damage}`));
for (const [name, damage] of [["코어 드론", 500], ["운석 괴물", 1000]])
  assert.match(js, new RegExp(`name: "${name}"[\\s\\S]*?baseDamage: ${damage}`));
assert.match(css, /\.star-node\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?aspect-ratio:\s*1\s*\/\s*1/);
assert.match(js, /function bindPointerTap/);
assert.match(html, /<main class="app battle-screen" id="game-shell" hidden>/);
assert.match(css, /#game-shell\s*\{[\s\S]*?width:\s*var\(--game-shell-width\);[\s\S]*?max-width:\s*600px;[\s\S]*?height:\s*100dvh/);
assert.match(html, /styles\.css\?v=50/, "the deployed stylesheet URL must change when its layout changes");
assert.match(html, /game\.js\?v=49/, "the deployed script URL must not reuse the pre-layout cache entry");
assert.match(js, /const actionEdgeInset = 66;[\s\S]*?arenaRect\.height - actionEdgeInset/,
  "context actions reserve a complete touch target above and below edge stars");
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
