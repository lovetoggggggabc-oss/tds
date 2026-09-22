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
assert.match(css, /\.battle-world\.fixed-map-ratio\{[\s\S]*translate:-50% -50%/);
assert.match(game, /CURVED_MAP:[\s\S]*artwork: "assets\/battle\/nebula-curve-map\.png"[\s\S]*spawn: Object\.freeze\(\{ x: 73\.2, y: 8\.2 \}\), destination: Object\.freeze\(\{ x: 47\.2, y: 84\.5 \}\)/);
assert.match(game, /LOOP_MAP:[\s\S]*\{x:72,y:48\}[\s\S]*\{x:57,y:62\}[\s\S]*\{x:44,y:42\}/);
assert.match(css, /button\[data-act="zodiac-cancel"\]\{left:1\.7%!important;top:88\.4%!important;width:25\.5%!important/);
assert.match(game, /function fitBattleWorldToArena\(\)[\s\S]*assetWidth[\s\S]*assetHeight/);

console.log("Illustrated battle layering, fixed aspect ratio, routes, and mobile hit targets verified.");
