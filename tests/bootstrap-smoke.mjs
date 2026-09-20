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
  ["summon", "zodiac", "zodiac-cancel", "codex"].map((action) => [action, new Element()]),
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
const document = {
  readyState: "loading",
  body: new Element("body"),
  documentElement: new Element("html"),
  getElementById: (id) => elements.get(id) || null,
  createElement() {
    const element = new Element();
    element.querySelector = (selector) => selector === ".bar i" ? new Element() : null;
    return element;
  },
  createElementNS: () => new Element(),
  addEventListener(type, callback) { listeners[type] = callback; },
};
const window = {
  addEventListener(type, callback) { listeners[`window:${type}`] = callback; },
};
const context = {
  Math, Error, document, window,
  location: { reload() {} },
  requestAnimationFrame(callback) { animationFrames.push(callback); return animationFrames.length; },
  setTimeout() { return 1; },
  clearTimeout() {},
};

vm.createContext(context);
vm.runInContext(source, context, { filename: "game.js" });
assert.equal(window.__TDS__, undefined, "loading documents must wait for DOMContentLoaded");
listeners.DOMContentLoaded();

const game = window.__TDS__.game;
assert.equal(window.BOOT_STAGE, "complete");
assert.equal(game.players.length, 2);
assert.deepEqual(JSON.parse(JSON.stringify(game.players.map((player) => [
  player.resources.starlight,
  player.resources.divinity,
  player.manager.stars.length,
  player.manager.field.children.length,
]))), [[5000, 50, 15, 15], [5000, 50, 15, 15]]);
assert.equal(game.wave.wave, 1);
assert.equal(game.rafRunning, true);
assert.ok(game.spawner.queue.length > 0, "wave 1 must queue enemies before the loop");

const firstFrame = animationFrames.splice(0);
firstFrame.forEach((callback) => callback(16));
assert.ok(game.enemies.length > 0, "the first animation frame must spawn an enemy");
assert.equal(elements.has("bootError"), false, "successful boot must not display diagnostics");
assert.equal((html.match(/<script src="game\.js\?v=31" defer><\/script>/g) || []).length, 1);

console.log("Runtime bootstrap smoke passed: DOM ready, 2 players, 30 star positions, resources, wave 1, enemy spawn, and RAF verified.");
