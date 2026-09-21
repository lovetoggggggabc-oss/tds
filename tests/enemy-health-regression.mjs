import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const file = await readFile("game.js", "utf8");
const source = file.slice(file.indexOf("const SCREEN_STATES"));
const definitions = source.slice(0, source.indexOf("class EnemySpawner"));
const created = [];
const context = {
  Math,
  document: {
    createElement() {
      const fill = { style: {} };
      const hpText = { textContent: "" };
      const element = {
        style: {},
        removed: false,
        classes: new Set(),
        classList: {
          add(name) { element.classes.add(name); },
          toggle(name, enabled) { enabled ? element.classes.add(name) : element.classes.delete(name); },
        },
        querySelector(selector) {
          if (selector === ".bar i") return fill;
          if (selector === ".enemy-hp") return hpText;
          assert.fail(`unexpected selector ${selector}`);
        },
        remove() { this.removed = true; },
      };
      created.push({ element, fill, hpText });
      return element;
    },
  },
  arena: {
    append() {},
    getBoundingClientRect: () => ({ width: 430, height: 700 }),
  },
  UIManager: { beam() {} },
  RangeSystem: { metrics: () => ({ width: 430, height: 700 }) },
  routePoint: (progress) => ({ x: 50, y: 94 - progress * 88 }),
  game: {
    gameTime: 0,
    kill(enemy) { this.killed = enemy; },
    leak(enemy) { this.leaked = enemy; },
  },
};
vm.createContext(context);
vm.runInContext(`${definitions}\nthis.EnemyForTest = Enemy;`, context);

const enemy = new context.EnemyForTest("slime", 0, 1);
assert.equal(created[0].fill.style.width, "100%", "a living enemy starts with a full bar");
assert.equal(created[0].hpText.textContent, "500 / 500", "a living enemy starts with current and maximum HP text");
enemy.hit(enemy.maxHp / 2, { x: 0, y: 0 });
assert.equal(created[0].fill.style.width, "50%", "damage updates currentHP/maxHP immediately");
assert.equal(created[0].hpText.textContent, "250 / 500", "damage updates HP text immediately");

const widthAfterDamage = created[0].fill.style.width;
enemy.hp = enemy.maxHp / 4;
enemy.render();
assert.equal(created[0].fill.style.width, widthAfterDamage, "movement rendering must not write HP width");
assert.equal(created[0].hpText.textContent, "250 / 500", "movement rendering must not write HP text");
enemy.updateHealthBar();
assert.equal(created[0].fill.style.width, "25%", "the event-driven updater reflects the exact ratio");
assert.equal(created[0].hpText.textContent, "125 / 500", "the event-driven updater reflects rounded current HP");

const progressBeforeBind = enemy.progress;
enemy.applyBind(2);
enemy.update(1);
assert.equal(enemy.progress, progressBeforeBind, "bind stops movement without rewinding path progress");
assert.equal(enemy.el.classes.has("bound"), true);
context.game.gameTime = 1;
enemy.applyBind(2);
assert.equal(enemy.statusEffects.bindUntil, 3, "reapplying bind refreshes one simulation-time deadline");
context.game.gameTime = 3;
enemy.update(1);
assert.ok(enemy.progress > progressBeforeBind, "movement resumes from the same position after bind expires");
assert.equal(enemy.el.classes.has("bound"), false);

enemy.hit(enemy.maxHp, { x: 0, y: 0 });
assert.equal(enemy.el.removed, true, "death removes the enemy and its nested bar together");
assert.equal(context.game.killed, enemy);

const boss = new context.EnemyForTest("drone", 1, 1);
assert.match(boss.el.className, /\bboss\b/);
assert.equal(created[1].fill.style.width, "100%", "bosses also receive a health bar");
assert.equal(created[1].hpText.textContent, "10,000 / 10,000", "bosses also receive formatted HP text");

console.log("Enemy HP regression passed: damage-only updates, movement, death cleanup, and boss bars validated.");
