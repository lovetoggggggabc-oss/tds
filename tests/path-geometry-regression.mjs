import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile("game.js", "utf8");
const definitionSource = source.slice(
  source.indexOf("const MAP_DEFINITIONS"),
  source.indexOf("// This is the sole source of truth"),
).replace("const MAP_DEFINITIONS", "this.MAP_DEFINITIONS")
  .replace("const MAP_DEFINITION", "this.MAP_DEFINITION");
const context = {};
vm.createContext(context);
vm.runInContext(definitionSource, context);

const map = context.MAP_DEFINITION;
assert.deepEqual({ ...map.spawn }, { x: 50, y: 94 });
assert.deepEqual({ ...map.destination }, { x: 50, y: 6 });
assert.equal(map.route.length, 3, "the S is made from three broad curves");
assert.deepEqual({ ...map.route[0][0] }, { ...map.spawn }, "the road begins at the only spawn portal");
assert.deepEqual({ ...map.route.at(-1).at(-1) }, { ...map.destination }, "the road ends at the destination portal");

for (let i = 1; i < map.route.length; i++)
  assert.deepEqual(
    { ...map.route[i][0] },
    { ...map.route[i - 1][3] },
    "Bezier sections must share an exact endpoint",
  );

function point(segment, t) {
  const u = 1 - t;
  return {
    x: u ** 3 * segment[0].x + 3 * u * u * t * segment[1].x + 3 * u * t * t * segment[2].x + t ** 3 * segment[3].x,
    y: u ** 3 * segment[0].y + 3 * u * u * t * segment[1].y + 3 * u * t * t * segment[2].y + t ** 3 * segment[3].y,
  };
}

const samples = map.route.flatMap((segment, section) =>
  Array.from({ length: 101 }, (_, i) => point(segment, i / 100)).slice(section ? 1 : 0));
for (let i = 1; i < samples.length; i++)
  assert.ok(samples[i].y < samples[i - 1].y, "the bottom-to-top route must never loop or self-intersect");
assert.ok(Math.min(...samples.map(({ x }) => x)) < 29, "the lower bend uses the left side of the board");
assert.ok(Math.max(...samples.map(({ x }) => x)) > 73, "the middle bend uses the right side of the board");

assert.doesNotMatch(source, /\{ x: 8, y:|lane === 0 \? 10 : 90|const top = lane === 0/);
assert.match(source, /const pathData = routePathData\(\)/);
assert.match(source, /return routePoint\(Math\.min\(1, this\.pathProgress\)\)/);
assert.match(source, /const point = routePoint\(step \/ 240\)/);
assert.match(source, /const point = routePoint\(progress\)/);

console.log("Path geometry regression passed: one non-crossing S route drives road, enemies, arrows, and placement.");
