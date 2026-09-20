import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const file = await readFile("game.js", "utf8");
const source = file.slice(file.indexOf("const CONSTELLATION_IDS"));
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
  setPointerCapture() {}
  addEventListener(type, listener) {
    this.listeners[type] = listener;
  }
  click() {
    this.listeners.click();
  }
  pointerTap() {
    const event = {
      isPrimary: true,
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 10,
      preventDefault() {},
      stopPropagation() {},
    };
    this.listeners.pointerdown(event);
    this.listeners.pointerup(event);
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
const players = [0, 1].map((index) => {
  const player = { index, resources: new PlayerResources() };
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

// TEST A: tapping a 1P empty slot summons into that exact slot. It clears a
// normal selection only after payment succeeds and never affects the 2P board.
one.player.manager.selected = [2];
one.player.manager.swapMode = true;
one.player.manager.field.children[7].pointerTap();
assert.ok(one.player.manager.stars[7], "the tapped 1P slot must receive the star");
assert.equal(one.player.manager.stars[7].tier, 1, "direct summons must be stage 1");
assert.equal(one.player.manager.selected.length, 0, "a successful direct summon clears selection");
assert.equal(one.player.manager.swapMode, false);
assert.equal(one.player.resources.starlight, 5000 - CONFIG.summonCost);

two.player.manager.tap(7);
assert.equal(two.player.manager.stars[7], null, "an empty 2P slot must remain inert");
assert.equal(two.player.resources.starlight, 5000);

one.player.manager.zodiacMode = true;
one.player.manager.selected = [7];
one.player.manager.tap(8);
assert.equal(one.player.manager.stars[8], null, "zodiac mode must not summon");
assert.equal(one.player.manager.selected.join(), "7", "zodiac selection must be preserved");
one.player.manager.zodiacMode = false;

one.player.resources.starlight = CONFIG.summonCost - 1;
one.player.manager.selected = [7];
one.player.manager.tap(8);
assert.equal(one.player.manager.stars[8], null, "insufficient starlight must not summon");
assert.equal(one.player.manager.selected.join(), "7", "a failed direct summon preserves selection");
one.player.manager.stars.fill(null);
one.player.manager.selected = [];
one.player.manager.swapMode = false;
one.player.resources.starlight = 5000;

// TEST B: repeated summons without a selection never auto-select a new star.
for (let press = 0; press < 5; press++) {
  one.summonButton.click();
  assert.equal(
    one.player.manager.selected.length,
    0,
    "a newly summoned star must not be selected automatically",
  );
}
assert.equal(one.player.manager.stars.filter(Boolean).length, 5);

// TEST C/D: a successful summon clears a normal selection and contextual mode.
const originalSelection = one.player.manager.stars.findIndex(Boolean);
for (let press = 0; press < 5; press++) {
  one.player.manager.selected = [originalSelection];
  one.player.manager.swapMode = true;
  one.summonButton.click();
  assert.equal(one.player.manager.selected.length, 0, "summoning must clear normal selection");
  assert.equal(one.player.manager.swapMode, false, "summoning must dismiss contextual mode");
  assert.equal(
    one.player.manager.stars.filter(Boolean).length,
    press + 6,
    `selected-state summon click ${press + 1} should fill exactly one empty slot`,
  );
}
assert.equal(one.player.manager.stars.filter(Boolean).length, 10);

// Fill the remaining five slots, then verify a full field blocks without cost.
for (let press = 0; press < 5; press++) one.summonButton.click();
assert.equal(one.player.resources.starlight, 5000 - 15 * CONFIG.summonCost);
assert.equal(one.player.manager.emptySlots().length, 0);

one.summonButton.click();
assert.equal(one.player.manager.stars.filter(Boolean).length, 15);
assert.equal(
  one.player.resources.starlight,
  5000 - 15 * CONFIG.summonCost,
  "a full board must not spend starlight",
);
one.player.manager.selected = [originalSelection];
one.player.manager.swapMode = true;
one.summonButton.click();
assert.deepEqual(one.player.manager.selected, [originalSelection], "a failed summon must preserve selection");
assert.equal(one.player.manager.swapMode, true, "a failed summon must preserve contextual mode");

for (let press = 0; press < 4; press++) two.summonButton.click();
assert.equal(two.player.manager.stars.filter(Boolean).length, 4);
assert.equal(two.player.resources.starlight, 5000 - 4 * CONFIG.summonCost);
assert.equal(
  one.player.manager.stars.filter(Boolean).length,
  15,
  "2P summons must not alter 1P's board",
);

console.log(
  "Summon regression passed: success cleared selection, failure preserved it, and boards remained independent.",
);
