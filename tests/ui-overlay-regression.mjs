import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, js] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("styles.css", "utf8"),
  readFile("game.js", "utf8"),
]);

// Logical endpoints remain in map data, but no battle marker or label is emitted.
assert.match(js, /spawn: Object\.freeze/);
assert.match(js, /destination: Object\.freeze/);
assert.doesNotMatch(html, /class="(?:spawn-portal|cosmic-base|start-label|destination-label)"/);

// Selection and exchange are separate public commands. Selection cannot spend
// currency or invoke the exchange system.
const selectBody = js.slice(js.indexOf("  selectStar(i) {"), js.indexOf("  exchangeSelectedStar() {"));
assert.doesNotMatch(selectBody, /SwapSystem|spend\(|exchangeSelectedStar/);
assert.match(selectBody, /this\.selected = \[i\]/);
const exchangeBody = js.slice(js.indexOf("  exchangeSelectedStar() {"), js.indexOf("  selectOnly(i) {"));
assert.match(exchangeBody, /SwapSystem\.execute\(this, this\.selected\[0\]\)/);
assert.match(js, /bindPointerTap\(contextActions\.querySelector\('\[data-context="swap"\]'\)/);
assert.doesNotMatch(js, /querySelector\('\[data-context="swap"\]'\)\.onclick/);

// The information card and control rail are siblings in an out-of-flow layer,
// while context buttons stay arena-local above/below the selected star.
assert.match(html, /class="battle-overlay-layer"[\s\S]*id="starInfo"[\s\S]*class="side-controls battle-control-rail"/);
assert.match(css, /\.battle-overlay-layer\{[^}]*position:absolute[^}]*pointer-events:none/);
assert.match(css, /\.battle-overlay-layer \.star-info\{[^}]*position:absolute/);
assert.match(css, /\.context-actions\{[^}]*position:absolute!important/);
assert.match(css, /\.context-actions \.action-above\{[^}]*-100% - 18px/);
assert.match(css, /\.context-actions \.action-below\{[^}]*translate\(-50%,18px\)/);

for (const stage of [1, 2, 3, 4]) assert.match(css, new RegExp(`\\.star\\.stage-${stage}\\{`));
for (const scale of ["1", "1.08", "1.16", "1.24"]) assert.match(css, new RegExp(`--stage-scale:${scale.replace(".", "\\.")}`));
for (const color of ["BLUE", "WHITE", "YELLOW", "ORANGE", "RED", "PURPLE", "GREEN"]) assert.match(js, new RegExp(`${color}: Object\\.freeze`));

console.log("Battle overlay, explicit exchange gesture, endpoint visuals, and four-stage grammar checks passed.");
