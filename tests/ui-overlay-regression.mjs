import assert from "node:assert/strict";
import vm from "node:vm";
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
assert.match(js, /gesture = \{ id: event\.pointerId[\s\S]*element\.setPointerCapture/);
assert.match(js, /if \(!gesture \|\| gesture\.id !== event\.pointerId\) return/);
assert.match(js, /if \(event\.detail === 0 && shouldStart\(event\)\) callback\(event\)/);
assert.doesNotMatch(js, /static guardianPortal|UIManager\.guardianPortal/);

// Reproduce the iPad sequence: a star pointerdown creates the action during
// pointerup, then Safari emits a compatibility click over that new action.
// Without a fresh pointerdown, the action must remain inert.
const pointerTapSource = js.slice(js.indexOf("function bindPointerTap"), js.indexOf("// Every zodiac-facing feature"));
const pointerContext = {};
vm.createContext(pointerContext);
vm.runInContext(`${pointerTapSource}\nthis.bindPointerTap = bindPointerTap;`, pointerContext);
const fakeElement = () => {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, callback) { (listeners.get(type) || listeners.set(type, []).get(type)).push(callback); },
    setPointerCapture() {}, hasPointerCapture() { return false; }, releasePointerCapture() {},
    fire(type, extra = {}) {
      const event = { isPrimary: true, button: 0, pointerId: 7, clientX: 40, clientY: 60, detail: 1,
        currentTarget: this, preventDefault() {}, stopPropagation() {}, ...extra };
      (listeners.get(type) || []).forEach((callback) => callback(event));
    },
  };
};
const starTarget = fakeElement();
const exchangeTarget = fakeElement();
let selections = 0, exchanges = 0;
pointerContext.bindPointerTap(starTarget, () => selections++);
pointerContext.bindPointerTap(exchangeTarget, () => exchanges++);
starTarget.fire("pointerdown");
starTarget.fire("pointerup");
exchangeTarget.fire("pointerup");
exchangeTarget.fire("click");
assert.equal(selections, 1);
assert.equal(exchanges, 0, "selection gesture and compatibility click cannot leak into exchange");
exchangeTarget.fire("pointerdown");
exchangeTarget.fire("pointerup");
assert.equal(exchanges, 1, "a fresh explicit exchange gesture runs exactly once");

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
