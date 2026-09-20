import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const file = await readFile("game.js", "utf8");
const source = file.slice(file.indexOf("const CONSTELLATION_IDS"));
const definitions = source.slice(0, source.indexOf("class EnemySpawner"));
const created = [];
const context = {
  Math,
  document: {
    createElement() {
      const fill = { style: {} };
      const element = {
        style: {},
        removed: false,
        querySelector(selector) {
          assert.equal(selector, ".bar i");
          return fill;
        },
        remove() { this.removed = true; },
      };
      created.push({ element, fill });
      return element;
    },
  },
  arena: {
    append() {},
    getBoundingClientRect: () => ({ width: 430, height: 700 }),
  },
  UIManager: { beam() {} },
  RangeSystem: { metrics: () => ({ width: 430, height: 700 }) },
  game: {
    kill(enemy) { this.killed = enemy; },
    leak(enemy) { this.leaked = enemy; },
  },
};
vm.createContext(context);
vm.runInContext(`${definitions}\nthis.EnemyForTest = Enemy;`, context);

const enemy = new context.EnemyForTest("slime", 0, 1);
assert.equal(created[0].fill.style.width, "100%", "a living enemy starts with a full bar");
enemy.hit(enemy.maxHp / 2, { x: 0, y: 0 });
assert.equal(created[0].fill.style.width, "50%", "damage updates currentHP/maxHP immediately");

const widthAfterDamage = created[0].fill.style.width;
enemy.hp = enemy.maxHp / 4;
enemy.render();
assert.equal(created[0].fill.style.width, widthAfterDamage, "movement rendering must not write HP width");
enemy.updateHealthBar();
assert.equal(created[0].fill.style.width, "25%", "the event-driven updater reflects the exact ratio");

enemy.hit(enemy.maxHp, { x: 0, y: 0 });
assert.equal(enemy.el.removed, true, "death removes the enemy and its nested bar together");
assert.equal(context.game.killed, enemy);

const boss = new context.EnemyForTest("drone", 1, 1);
assert.match(boss.el.className, /\bboss\b/);
assert.equal(created[1].fill.style.width, "100%", "bosses also receive a health bar");

console.log("Enemy HP regression passed: damage-only updates, movement, death cleanup, and boss bars validated.");
