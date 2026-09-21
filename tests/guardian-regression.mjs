import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const file = await readFile("game.js", "utf8");
const source = file.slice(file.indexOf("const SCREEN_STATES"), file.indexOf("class UIManager"));

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
  hint: new Element(),
  clearTimeout() {},
  setTimeout() {},
  document: { createElement: () => new Element() },
  UIManager: { beam() {}, hint() {}, zodiacComplete() {}, showDawnMoon() {} },
};
vm.createContext(context);
vm.runInContext(`${source}\nthis.api = { playerProgress, CONFIG, CONSTELLATION_IDS, CONSTELLATION_DEFINITIONS, CONSTELLATION_BEHAVIORS, Constellation, GuardianLightSystem, GuardianUnit, ZodiacSystem, Star, RangeSystem };`, context);

const { playerProgress, CONFIG, CONSTELLATION_IDS, CONSTELLATION_DEFINITIONS, CONSTELLATION_BEHAVIORS, Constellation, GuardianLightSystem, GuardianUnit, ZodiacSystem, Star, RangeSystem } = context.api;
playerProgress.ownedConstellations.push("GUARDIAN");
playerProgress.equippedConstellations.push("GUARDIAN");
const definition = CONSTELLATION_DEFINITIONS[CONSTELLATION_IDS.GUARDIAN];
assert.deepEqual(JSON.parse(JSON.stringify(definition.recipe)), { green: 2, yellow: 1 });
assert.equal(definition.attackDamage, 300);
assert.equal(definition.attackSpeed, 0.5);
assert.equal(definition.range, 3);
assert.match(definition.specialDescriptions[0], /수호의 빛 50/);
assert.doesNotMatch(definition.specialDescriptions[0], /공격에 성공할 때마다/);
assert.equal(ZodiacSystem.exactMatch({ green: 2, yellow: 1 }), "GUARDIAN");
assert.equal(ZodiacSystem.exactMatch({ orange: 1, white: 2 }), undefined);

const stars = [new Star("green", 2), new Star("green", 2), new Star("yellow", 3)];
const owner = { player: { index: 0 }, stars, pos: () => ({ x: 10, y: 10 }) };
owner.player.resources = { starlight: 1111, spend(amount) { if (this.starlight < amount) return false; this.starlight -= amount; return true; } };
context.game = {
  gameTime: 0,
  attackBuffUntil: 0,
  enemies: [],
  base: { hp: 70, maxHp: 150 },
  markDirty() {},
  render() {},
  summoned: 0,
  summonGuardian() { this.summoned++; },
};
const constellation = new Constellation(owner, 0, [0, 1, 2], "GUARDIAN");
assert.equal(constellation.componentStageSum, 7);
assert.equal(constellation.currentDamage(), 525);

const target = { hit: (damage) => { target.damage = damage; } };
CONSTELLATION_BEHAVIORS.GUARDIAN.attack(constellation, target, { x: 0, y: 0 });
assert.equal(target.damage, 525);
assert.equal(context.game.base.hp, 70, "normal attacks do not activate Guardian Light");
GuardianLightSystem.execute(owner, 0);
assert.equal(owner.player.resources.starlight, 223, "activation spends floor(80%) of current starlight");
assert.equal(context.game.base.hp, 121.5, "damaged base heals by 50 + 1% max HP");
context.game.base.hp = context.game.base.maxHp;
owner.player.resources.starlight = 2000;
GuardianLightSystem.execute(owner, 0);
assert.equal(context.game.base.maxHp, 175.5);
assert.equal(context.game.base.hp, 175.5, "full base grows and remains full");
owner.player.resources.starlight = 1110;
GuardianLightSystem.execute(owner, 0);
assert.equal(owner.player.resources.starlight, 1110, "insufficient starlight is not spent");
assert.equal(context.game.base.maxHp, 175.5, "insufficient starlight does not activate the ability");

CONSTELLATION_BEHAVIORS.GUARDIAN.update(constellation, 14.9);
assert.equal(context.game.summoned, 0);
CONSTELLATION_BEHAVIORS.GUARDIAN.update(constellation, 0.1);
assert.equal(context.game.summoned, 1, "each constellation owns its 15-second cooldown");

RangeSystem.cachedMetrics = { width: 390, height: 700 };
const unit = new GuardianUnit(context.game.base, 7);
assert.equal(unit.team, "ALLY");
assert.equal(unit.maxHp, 100.035, "summoned HP snapshots (50 + stage sum)% of current base max HP");
assert.equal(unit.pathProgress, 1);
context.game.enemies = [];
unit.update(1);
assert.ok(unit.pathProgress < 1, "guardian travels backward from destination toward spawn");
assert.equal(unit.damage, 87.75);
assert.equal(CONFIG.guardianUnit.attacksPerSecond, 3);

const collisionUnit = new GuardianUnit(context.game.base, 7);
collisionUnit.hp = 500; collisionUnit.damage = 100;
const enemy = { dead: false, position: () => collisionUnit.position(), hit(damage) { this.hp -= damage; }, hp: 800 };
context.game.enemies = [enemy]; collisionUnit.update(0);
assert.equal(enemy.hp, 200, "collision applies current HP plus snapshotted attack once");
assert.equal(collisionUnit.dead, true, "guardian disappears immediately after collision");
collisionUnit.update(0); assert.equal(enemy.hp, 200, "resolved guardian cannot damage twice");
console.log("Guardian regression passed: 1111 gate, 80% spend, healing/growth, 15-second summon, snapshots, reverse travel, and one-hit collision verified.");
