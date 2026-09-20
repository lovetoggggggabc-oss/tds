import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, js] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("styles.css", "utf8"),
  readFile("game.js", "utf8"),
]);

assert.match(html, /href="styles\.css"/);
assert.match(html, /src="game\.js"/);
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
assert.match(js, /this\.stars = Array\(15\)\.fill\(null\)/);
assert.match(js, /startStarlight:\s*5000/);
assert.match(js, /startDivinity:\s*50/);
assert.match(js, /summonCost:\s*30/);
assert.match(js, /swapCost:\s*10/);
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
