import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const file = await readFile("game.js", "utf8");
const source = file.slice(file.indexOf("const CONSTELLATION_IDS"), file.indexOf("class DivinationSystem"));

class Element {
  constructor() { this.style = {}; this.children = []; }
  append(child) { this.children.push(child); }
  remove() { this.removed = true; }
  querySelector() { return new Element(); }
  addEventListener() {}
  setAttribute() {}
}

const arena = new Element();
const context = {
  Math,
  arena,
  document: { createElement: () => new Element() },
  UIManager: { beam() {}, hint() {}, zodiacComplete() {}, showDawnMoon() {} },
};
vm.createContext(context);
vm.runInContext(`${source}\nthis.api = { CONFIG, CONSTELLATION_IDS, CONSTELLATION_DEFINITIONS, CONSTELLATION_BEHAVIORS, Constellation, GuardianUnit, ZodiacSystem, Star, RangeSystem };`, context);

const { CONFIG, CONSTELLATION_IDS, CONSTELLATION_DEFINITIONS, CONSTELLATION_BEHAVIORS, Constellation, GuardianUnit, ZodiacSystem, Star, RangeSystem } = context.api;
const definition = CONSTELLATION_DEFINITIONS[CONSTELLATION_IDS.GUARDIAN];
assert.deepEqual(JSON.parse(JSON.stringify(definition.recipe)), { orange: 1, white: 1, red: 1 });
assert.equal(definition.attackDamage, 300);
assert.equal(definition.attackSpeed, 0.5);
assert.equal(definition.range, 3);
assert.equal(ZodiacSystem.exactMatch({ orange: 1, white: 1, red: 1 }), "GUARDIAN");
assert.equal(ZodiacSystem.exactMatch({ orange: 1, white: 2 }), undefined);

const stars = [new Star("orange", 2), new Star("white", 2), new Star("red", 3)];
const owner = { player: { index: 0 }, stars, pos: () => ({ x: 10, y: 10 }) };
context.game = {
  gameTime: 0,
  attackBuffUntil: 0,
  enemies: [],
  base: { hp: 4000, maxHp: 5000 },
  markDirty() {},
  summoned: 0,
  summonGuardian() { this.summoned++; },
};
const constellation = new Constellation(owner, 0, [0, 1, 2], "GUARDIAN");
assert.equal(constellation.componentStageSum, 7);
assert.equal(constellation.currentDamage(), 2100);

const target = { hit: (damage) => { target.damage = damage; } };
CONSTELLATION_BEHAVIORS.GUARDIAN.attack(constellation, target, { x: 0, y: 0 });
assert.equal(target.damage, 2100);
assert.equal(context.game.base.hp, 4100, "damaged base heals by 50 + 1% max HP");
context.game.base.hp = context.game.base.maxHp;
CONSTELLATION_BEHAVIORS.GUARDIAN.attack(constellation, target, { x: 0, y: 0 });
assert.equal(context.game.base.maxHp, 5050);
assert.equal(context.game.base.hp, 5050, "full base grows and remains full");

CONSTELLATION_BEHAVIORS.GUARDIAN.update(constellation, 14.9);
assert.equal(context.game.summoned, 0);
CONSTELLATION_BEHAVIORS.GUARDIAN.update(constellation, 0.1);
assert.equal(context.game.summoned, 1, "each constellation owns its 15-second cooldown");

RangeSystem.cachedMetrics = { width: 390, height: 700 };
const unit = new GuardianUnit(context.game.base);
assert.equal(unit.team, "ALLY");
assert.equal(unit.maxHp, 1010, "summoned HP snapshots 20% of current base max HP");
assert.equal(unit.pathProgress, 1);
context.game.enemies = [];
unit.update(1);
assert.ok(unit.pathProgress < 1, "guardian travels backward from destination toward spawn");
assert.equal(CONFIG.guardianUnit.attackDamage, 100);
assert.equal(CONFIG.guardianUnit.attacksPerSecond, 1);

console.log("Guardian regression passed: recipe, scaling, base blessing, independent summon cooldown, HP snapshot, and reverse travel verified.");
