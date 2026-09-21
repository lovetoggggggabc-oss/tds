import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const file = await readFile("game.js", "utf8");
const source = file.slice(file.indexOf("const SCREEN_STATES"));
const definitions = [
  source.slice(0, source.indexOf("class Enemy")),
  source.slice(source.indexOf("class Star {"), source.indexOf("class Targeting")),
  source.slice(source.indexOf("class StarManager"), source.indexOf("class MergeSystem")),
].join("\n");
class FakeElement {
  constructor() { this.dataset = {}; this.listeners = {}; this.children = []; this.classList = { add() {}, remove() {} }; }
  setAttribute() {}
  setPointerCapture() {}
  addEventListener(type, listener) { this.listeners[type] = listener; }
  append(element) { this.children.push(element); }
}
const hints = [];
const context = { Math, document: { createElement: () => new FakeElement() }, UIManager: { hint: (text) => hints.push(text), summonEffect() {} } };
vm.createContext(context);
vm.runInContext(`${definitions}\nthis.testApi = { CONFIG, PlayerResources, StarManager };`, context);
const { CONFIG, PlayerResources, StarManager } = context.testApi;
const players = [0, 1].map((index) => {
  const player = { index, resources: new PlayerResources() };
  player.manager = new StarManager(player, new FakeElement());
  player.manager.isValidPlacement = (x, y) => x === 20 && y === 30;
  return player;
});
context.game = { players, render() {} };
const manager = players[0].manager;

assert.equal(manager.summonAt(50, 50), false, "invalid coordinates do not summon");
assert.equal(players[0].resources.starlight, 500, "invalid placement does not spend resources");
assert.equal(manager.summonAt(20, 30), true, "valid coordinates summon");
const star = manager.stars[0];
assert.ok(star);
assert.deepEqual([star.x, star.y, star.tier], [20, 30, 1]);
assert.equal(players[0].resources.starlight, 500 - CONFIG.summonCost);
manager.zodiacMode = true;
assert.equal(manager.summonAt(20, 30), false, "zodiac selection blocks direct summoning");
manager.zodiacMode = false;
players[0].resources.starlight = 29;
assert.equal(manager.summonAt(20, 30), false, "insufficient starlight blocks direct summoning");
assert.equal(manager.stars.filter(Boolean).length, 1);
assert.equal(players[0].resources.starlight, 29, "failed taps never spend starlight");

console.log("Summon regression passed: direct placement, validation, zodiac guard, and exact payment verified.");
