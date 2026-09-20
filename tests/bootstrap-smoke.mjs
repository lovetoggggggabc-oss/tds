import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const [html, source] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("game.js", "utf8"),
]);

class ClassList {
  add() {}
  remove() {}
  toggle() {}
}

class Element {
  constructor(id = "") {
    this.id = id;
    this.children = [];
    this.dataset = {};
    this.style = { setProperty() {} };
    this.classList = new ClassList();
    this.hidden = false;
    this.innerHTML = "";
    this.textContent = "";
  }
  append(...children) { this.children.push(...children); }
  remove() {}
  addEventListener() {}
  setAttribute() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 390, height: 700 };
  }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  focus() {}
}

const elements = new Map(
  [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => [match[1], new Element(match[1])]),
);
const controlPanel = new Element();
controlPanel.dataset.player = "0";
const actions = Object.fromEntries(
  ["zodiac", "zodiac-cancel", "codex"].map((action) => [action, new Element()]),
);
controlPanel.querySelector = (selector) =>
  actions[selector.match(/data-act=([^\]]+)/)?.[1]] || null;
elements.get("controls").querySelectorAll = (selector) =>
  selector === ".game-controls" ? [controlPanel] : [];
elements.get("controls").querySelector = (selector) =>
  selector === "[data-act=codex]" ? actions.codex : null;
elements.get("zodiacCodex").querySelector = () => new Element();

const listeners = {};
const animationFrames = [];
const storage = new Map();
const localStorage = {
  getItem(key) { return storage.get(key) ?? null; },
  setItem(key, value) { storage.set(key, value); },
};
const document = {
  readyState: "loading",
  body: new Element("body"),
  documentElement: new Element("html"),
  getElementById: (id) => elements.get(id) || null,
  createElement() {
    const element = new Element();
    element.querySelector = (selector) =>
      selector === ".bar i" || selector === ".enemy-hp" ? new Element() : null;
    return element;
  },
  createElementNS: () => new Element(),
  addEventListener(type, callback) { listeners[type] = callback; },
};
const window = {
  addEventListener(type, callback) { listeners[`window:${type}`] = callback; },
};
const context = {
  Math, Error, document, window, localStorage,
  location: { reload() {} },
  requestAnimationFrame(callback) { animationFrames.push(callback); return animationFrames.length; },
  setTimeout() { return 1; },
  clearTimeout() {},
};

vm.createContext(context);
vm.runInContext(source, context, { filename: "game.js" });
assert.equal(window.__TDS__, undefined, "loading documents must wait for DOMContentLoaded");
listeners.DOMContentLoaded();

assert.equal(window.BOOT_STAGE, "complete");
assert.equal(window.__TDS__.currentScreen, "MAIN_MENU");
assert.equal(window.__TDS__.game, null, "combat must not begin from the main menu");
window.__TDS__.showGacha();
window.__TDS__.showBattleMenu();
assert.equal(window.__TDS__.currentScreen, "BATTLE_MENU", "gacha to battle must stop at the battle menu");
assert.equal(window.__TDS__.game, null, "a navigation gesture must never start combat");
window.__TDS__.startBattle();
const game = window.__TDS__.game;
assert.equal(game.players.length, 2);
assert.deepEqual(JSON.parse(JSON.stringify(game.players.map((player) => [
  player.resources.starlight,
  player.resources.divinity,
  player.manager.stars.length,
  player.manager.field.children.length,
]))), [[5000, 50, 15, 15], [5000, 50, 15, 15]]);
assert.equal(game.wave.wave, 0, "waves must remain stopped during preparation");
assert.equal(game.phase, "PREPARING");
assert.equal(game.rafRunning, true);
assert.equal(game.spawner.queue.length, 0, "preparation must not queue enemies");

const preparationFrame = animationFrames.shift();
preparationFrame(16);
assert.equal(game.wave.wave, 0);
assert.equal(game.enemies.length, 0);
const combatStartFrame = animationFrames.shift();
combatStartFrame(15016);
assert.equal(game.phase, "COMBAT");
assert.equal(game.wave.wave, 1);
assert.ok(game.spawner.queue.length > 0, "wave 1 queues only after 15 real seconds");
assert.equal(game.wave.left, 10, "normal waves use the 10-second game-time interval");

game.wave.wave = 9;
game.wave.left = 0;
game.wave.update(0);
assert.equal(game.wave.wave, 10);
assert.equal(game.wave.left, 20, "boss waves use the 20-second game-time interval");

const firstFrame = animationFrames.splice(0);
firstFrame.forEach((callback) => callback(15032));
assert.ok(game.enemies.length > 0, "the first animation frame must spawn an enemy");
game.wave.wave = 40;
window.__TDS__.leaveBattle();
assert.equal(game.rafRunning, false, "leaving combat must stop its animation loop");
assert.equal(window.__TDS__.currentScreen, "BATTLE_GAME", "leaving combat must show results before returning home");
assert.equal(window.__TDS__.playerProgress.starFragments, 80, "wave 40 must award exactly 80 star fragments");
assert.deepEqual(JSON.parse(storage.get("zodiacDefenseProgress")), { starFragments: 80, meteorFragments: 2 });
window.__TDS__.leaveBattle();
assert.equal(window.__TDS__.playerProgress.starFragments, 80, "a battle reward must only be granted once");
assert.equal(window.__TDS__.playerProgress.meteorFragments, 2, "wave 40 must award two meteor fragments once");
elements.get("restart").onclick();
assert.equal(window.__TDS__.currentScreen, "MAIN_MENU");
window.__TDS__.showBattleMenu();
window.__TDS__.startBattle();
assert.notEqual(window.__TDS__.game, game, "re-entry must create a fresh combat state");
assert.equal(window.__TDS__.game.wave.wave, 0, "re-entry must begin with preparation before wave 1");
assert.equal(elements.has("bootError"), false, "successful boot must not display diagnostics");
assert.equal((html.match(/<script src="game\.js\?v=38" defer><\/script>/g) || []).length, 1);

console.log("Runtime bootstrap smoke passed: DOM ready, 2 players, 30 star positions, resources, wave 1, enemy spawn, and RAF verified.");
