import assert from "node:assert/strict";
import vm from "node:vm";
import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";

const source = await readFile("game.js", "utf8");
const definitions = source.slice(0, source.indexOf("class UIManager"));
const context = {
  Math,
  document: { createElement: () => ({}) },
  arena: { getBoundingClientRect: () => ({ width: 430, height: 700 }) },
  UIManager: {},
};
vm.createContext(context);
vm.runInContext(`${definitions}\nthis.api = { SpatialGrid, Targeting, RangeSystem, Star };`, context);
const { SpatialGrid, Targeting, RangeSystem, Star } = context.api;
RangeSystem.refresh();

const makeEnemies = (count) => Array.from({ length: count }, (_, index) => ({
  dead: false,
  hp: 500 + index,
  progress: index / count * 100,
  x: 8 + index / count * 81,
  y: index % 2 ? 50 : 10,
  position() { return { x: this.x, y: this.y }; },
}));

for (const count of [50, 100, 150, 200]) {
  const enemies = makeEnemies(count);
  const grid = new SpatialGrid();
  grid.rebuild(enemies);
  context.game = { enemies, spatial: grid };
  const star = new Star("blue");
  const position = { x: 42, y: 50 };
  const started = performance.now();
  for (let attack = 0; attack < 1000; attack++)
    Targeting.choose(star, enemies, position);
  const elapsed = performance.now() - started;
  const candidates = grid.near(position, star.data().range);
  assert.ok(candidates.length < enemies.length, `${count}: spatial query should narrow candidates`);
  assert.ok(Targeting.choose(star, enemies, position), `${count}: combat target should resolve`);
  console.log(`${count} enemies: ${candidates.length} nearby candidates, 1,000 searches ${elapsed.toFixed(1)}ms`);
}

const enemies = makeEnemies(200);
for (let index = 0; index < 160; index++) enemies[index].dead = true;
const active = enemies.filter((enemy) => !enemy.dead);
const grid = new SpatialGrid();
grid.rebuild(active);
assert.equal(active.length, 40);
assert.equal([...grid.cells.values()].flat().some((enemy) => enemy.dead), false);
console.log("Performance regression passed: 50/100/150/200 enemies and dead-enemy cleanup validated.");
