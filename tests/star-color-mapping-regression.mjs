import assert from "node:assert/strict";
import fs from "node:fs";

const js = fs.readFileSync(new URL("../game.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

const expectedTypes = [
  ["BLUE", "blue", "청색", "#4d83ff", "50", "4", "5", "lock"],
  ["WHITE", "white", "백색", "#ffffff", "100", "3.5", "6", "burst"],
  ["YELLOW", "yellow", "황색", "#ffd84d", "75", "2", "7", "random"],
  ["ORANGE", "orange", "주황색", "#ffad45", "125", "1.5", "4", "nearest"],
  ["RED", "red", "적색", "#ff5064", "200", "1", "5", "highest"],
  ["PURPLE", "purple", "자색", "#b16cff", "100", "1", "4.5", "lowest"],
  ["GREEN", "green", "녹색", "#55db85", "0", "0", "0", "none"],
];

for (const [id, key, name, color, damage, rate, range, target] of expectedTypes) {
  const definition = new RegExp(`${id}: Object\\.freeze\\(\\{ id: "${id}", key: "${key}", name: "${name}", color: "${color}", damage: ${damage}, rate: ${rate}, range: ${range}, target: "${target}"`);
  assert.match(js, definition, `${id} must retain its original identity and combat profile`);
}

assert.equal(new Set(expectedTypes.map(([, key]) => key)).size, expectedTypes.length);
assert.equal(new Set(expectedTypes.map(([, , name]) => name)).size, expectedTypes.length);
assert.equal(new Set(expectedTypes.map(([, , , color]) => color)).size, expectedTypes.length);

assert.match(js, /red: '<g class="type-ornament nova-ornament"/);
assert.match(js, /type === "red"[^\n]+nova-ornament stage-three-ornament/);
assert.match(js, /star-glyph star-type-\$\{type\}/);
assert.doesNotMatch(js, /type === "red" \? "orange"/);
assert.doesNotMatch(css, /\.star-type-(?:white|yellow|orange)\{--star-color:/);

for (const stage of [1, 2, 3, 4])
  assert.ok(js.includes(`${stage}: \``), `stage ${stage} SVG must remain mapped`);

console.log("star color mapping regression checks passed");
