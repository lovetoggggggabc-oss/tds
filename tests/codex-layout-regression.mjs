import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [css, js] = await Promise.all([
  readFile("styles.css", "utf8"),
  readFile("game.js", "utf8"),
]);

const rule = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] || "";
};

const panel = rule(".codex-panel");
assert.match(panel, /display:\s*flex/);
assert.match(panel, /flex-direction:\s*column/);
assert.match(panel, /overflow:\s*hidden/);

const list = rule(".codex-list");
assert.match(list, /display:\s*flex/);
assert.match(list, /flex-direction:\s*column/);
assert.match(list, /gap:\s*14px/);
assert.match(list, /min-height:\s*0/);
assert.match(list, /overflow-y:\s*auto/);
assert.match(list, /overflow-x:\s*hidden/);

const card = rule(".zodiac-card");
assert.match(card, /display:\s*flex/);
assert.match(card, /flex:\s*0 0 auto/);
assert.match(card, /height:\s*auto/);
assert.match(card, /overflow:\s*hidden/);
assert.doesNotMatch(card, /max-content|overflow:\s*visible/);

const previewWrap = rule(".codex-preview-wrap");
assert.match(previewWrap, /position:\s*relative/);
assert.match(previewWrap, /height:\s*180px/);
assert.match(previewWrap, /flex:\s*0 0 180px/);
assert.match(previewWrap, /overflow:\s*hidden/);

const preview = rule(".codex-preview");
assert.match(preview, /height:\s*100%/);
assert.match(preview, /overflow:\s*hidden/);
assert.match(preview, /pointer-events:\s*none/);

assert.match(js, /viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"/);
assert.match(js, /class="codex-recipe-summary"><span>필요한 별<\/span>\$\{summary\}/);
assert.ok(
  js.indexOf('class="codex-preview-wrap"') < js.indexOf('class="codex-recipe"') &&
    js.indexOf('class="codex-recipe"') < js.indexOf('class="codex-stats"') &&
    js.indexOf('class="codex-stats"') < js.indexOf('class="codex-special"'),
  "preview, recipe, stats, and specials must remain in document order",
);

console.log("Codex layout regression checks passed.");
