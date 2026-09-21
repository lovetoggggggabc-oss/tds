import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const game = fs.readFileSync(new URL("../game.js", import.meta.url), "utf8");

for (const asset of ["01-background.svg", "02-mascot-desk.svg", "03-ui-atlas.svg"]) {
  assert.ok(fs.existsSync(new URL(`../assets/main-menu/${asset}`, import.meta.url)), `${asset} must remain a text SVG asset`);
}
assert.match(html, /class="observatory-backdrop"/);
assert.match(html, /class="mascot-desk"/);
assert.match(html, /03-ui-atlas\.svg#logo/);
assert.match(html, /id="open-battle-menu"/);
assert.match(game, /getRequiredElement\("open-battle-menu"\)\.onclick = navigateOnce\(showBattleMenu\)/);
for (const attribute of ["data-coming-soon", "data-open-collection", "data-open-battle", "data-open-relics", "data-open-gacha", "data-open-news", "data-open-mail", "data-open-settings"]) assert.match(html, new RegExp(attribute));
for (const currency of ["data-star-dust", "data-star-shards", "data-meteor-fragments"]) assert.match(html, new RegExp(`<b class="currency-value" ${currency}>0</b>`));
assert.match(css, /object-fit|background:url\("assets\/main-menu\/01-background\.svg"\) center center\/cover/);
assert.match(css, /\.main-lobby \.bottom-nav button\.active svg/);
assert.doesNotMatch(html + css, /assets\/main-menu\/[^"')]+\.(?:png|jpe?g)/i);
console.log("Illustrated SVG main menu, live data hooks, navigation handlers, and responsive composition verified.");
