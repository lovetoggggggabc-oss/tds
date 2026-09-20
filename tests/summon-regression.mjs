import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile("game.js", "utf8");
const definitions = [
  source.slice(0, source.indexOf("class Enemy")),
  source.slice(source.indexOf("class Star {"), source.indexOf("class Targeting")),
  source.slice(
    source.indexOf("class StarManager"),
    source.indexOf("class MergeSystem"),
  ),
].join("\n");

class FakeButton {
  constructor() {
    this.dataset = {};
    this.listeners = {};
  }
  setAttribute() {}
  addEventListener(type, listener) {
    this.listeners[type] = listener;
  }
  click() {
    this.listeners.click();
  }
}

const context = {
  Math,
  document: { createElement: () => new FakeButton() },
  UIManager: { hint: () => {} },
};
vm.createContext(context);
vm.runInContext(
  `${definitions}\nthis.testApi = { CONFIG, PlayerResources, StarManager };`,
  context,
);

const { CONFIG, PlayerResources, StarManager } = context.testApi;
const players = [0, 1].map(() => {
  const player = { resources: new PlayerResources() };
  const field = {
    children: [],
    append(element) {
      this.children.push(element);
    },
  };
  player.manager = new StarManager(player, field);
  const summonButton = new FakeButton();
  summonButton.addEventListener("click", () => player.manager.summon());
  return { player, summonButton };
});
context.game = {
  players: players.map(({ player }) => player),
  render() {},
};

const [one, two] = players;
for (let press = 0; press < 15; press++) {
  // UI modes may be active after a previous interaction, but are never summon
  // prerequisites and must not prevent the next click.
  one.player.manager.swapMode = press % 2 === 0;
  one.player.manager.zodiacMode = press % 3 === 0;
  one.summonButton.click();
  assert.equal(
    one.player.manager.stars.filter(Boolean).length,
    press + 1,
    `1P summon click ${press + 1} should fill exactly one empty slot`,
  );
}
assert.equal(one.player.resources.starlight, 5000 - 15 * CONFIG.summonCost);
assert.equal(one.player.manager.emptySlots().length, 0);

one.summonButton.click();
assert.equal(one.player.manager.stars.filter(Boolean).length, 15);
assert.equal(
  one.player.resources.starlight,
  5000 - 15 * CONFIG.summonCost,
  "a full board must not spend starlight",
);

for (let press = 0; press < 4; press++) two.summonButton.click();
assert.equal(two.player.manager.stars.filter(Boolean).length, 4);
assert.equal(two.player.resources.starlight, 5000 - 4 * CONFIG.summonCost);
assert.equal(
  one.player.manager.stars.filter(Boolean).length,
  15,
  "2P summons must not alter 1P's board",
);

console.log(
  "Summon regression passed: 1P filled 15/15 slots, the 16th click was free, and 2P remained independent.",
);
