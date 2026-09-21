import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [js, css, html] = await Promise.all([
  readFile("game.js", "utf8"),
  readFile("styles.css", "utf8"),
  readFile("index.html", "utf8"),
]);

assert.match(js, /this\.el\.style\.left = `\$\{this\.x\}%`/);
assert.match(js, /width: arena\.clientWidth \|\| rect\.width/);
assert.doesNotMatch(js, /this\.el\.style\.transform = `translate3d/);
for (const id of ["DAWN", "RADIANCE", "SAGITTARIUS", "ASTROLOGER", "GUARDIAN", "TWILIGHT", "BOND", "LINK", "STRIKE", "HORIZON"])
  assert.match(js, new RegExp(`${id}: '<`), `${id} needs a battle signature`);
assert.match(js, /function starFinalOrnaments\(type\)/);
assert.match(js, /function starStageThreeOrnaments\(type\)/);
assert.match(js, /roundedStar = '<path class="star-body rounded-star"/);
assert.match(js, /facetedStar = '<path class="star-body faceted-star"/);
for (const stage of [1, 2, 3, 4]) assert.ok(js.includes(stage + ": `"));
for (const ornament of ["crystal", "prism", "planet", "flame", "moon", "leaf"])
  assert.match(js, new RegExp(`${ornament}-ornament`));
assert.match(js, /symmetricSparkles\(45, 2\.4\)/);
assert.match(css, /--stage-scale:1\.03/);
assert.match(css, /--stage-scale:1\.06/);
assert.match(css, /--stage-scale:1\.08/);
assert.match(css, /\.star-halo,\.star-orbit\{display:none!important\}/);
assert.match(html, /<small>WAVE<\/small><span id="wave">0<\/span>/);
assert.match(css, /#wave[^}]+clamp\(30px,7\.2cqw,42px\)/);
console.log("Visual identity regression passed: shared route coordinates, four stages, ten signatures, and wave hierarchy verified.");
