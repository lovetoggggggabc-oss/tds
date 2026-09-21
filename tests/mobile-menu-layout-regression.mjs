import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css] = await Promise.all([readFile("index.html", "utf8"), readFile("styles.css", "utf8")]);

assert.match(html, /class="currency-item"[\s\S]*class="currency-label">별가루<[\s\S]*class="currency-value" data-star-dust/);
assert.match(html, /class="currency-label">별조각/);
assert.match(html, /class="currency-label">운석조각/);
assert.match(html, /class="utility-label">우편함/);
assert.match(html, /class="utility-label">설정/);

const mobile = css.slice(css.indexOf("/* Mobile lobby composition"));
assert.match(mobile, /@media \(max-width:600px\)/);
assert.match(mobile, /\.main-top-bar\s*\{[^}]*grid-template-columns:1fr[^}]*grid-template-rows:auto auto/s);
assert.match(mobile, /\.permanent-wallet\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/s);
assert.match(mobile, /\.currency-label\s*\{[^}]*writing-mode:horizontal-tb[^}]*white-space:nowrap[^}]*word-break:keep-all/s);
assert.match(mobile, /\.currency-value\s*\{[^}]*text-overflow:clip[^}]*white-space:nowrap/s);
assert.match(mobile, /\.menu-tools button[^}]*\{[^}]*min-width:44px[^}]*min-height:44px/s);
assert.match(mobile, /\.monster-codex-detail section p\s*\{[^}]*word-break:keep-all/s);
assert.match(css, /height:100dvh/);
assert.match(css, /env\(safe-area-inset-top\)/);
assert.match(css, /env\(safe-area-inset-bottom\)/);

console.log("Mobile two-row menu and narrow-screen readability checks passed.");
