import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const game = fs.readFileSync(new URL("../game.js", import.meta.url), "utf8");

for (const asset of ["space-background.png", "star-s-path.png", "nebula-curve-map.png", "galaxy-ring-map.png", "battle-ui-overlay.png"])
  assert.match(html + game, new RegExp(`assets/battle/${asset.replace(".", "\\.")}`));

assert.match(html, /class="battle-space-background"[\s\S]*class="battle-map-art"/);
assert.match(html, /class="battle-ui-art"/);
assert.match(css, /\.battle-ui-art\{[\s\S]*pointer-events:none/);
assert.match(css, /\.battle-control-rail button\{[\s\S]*touch-action:manipulation/);
assert.match(css, /button\[data-act="zodiac"\][\s\S]*min-height:44px/);
assert.match(game, /CURVED_MAP:[\s\S]*artwork: "assets\/battle\/nebula-curve-map\.png"[\s\S]*spawn: Object\.freeze\(\{ x: 72, y: 6 \}\), destination: Object\.freeze\(\{ x: 42, y: 94 \}\)/);
assert.match(game, /LOOP_MAP:[\s\S]*route: Object\.freeze\(\[[\s\S]*\{x:70,y:56\}[\s\S]*\{x:39,y:61\}[\s\S]*\{x:45,y:48\}/);

console.log("Illustrated battle layering, independent routes, and mobile hit targets verified.");
