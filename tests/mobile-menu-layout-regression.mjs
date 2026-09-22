import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, game] = await Promise.all([readFile("index.html", "utf8"), readFile("styles.css", "utf8"), readFile("game.js", "utf8")]);

assert.match(html, /class="currency-item"[\s\S]*class="currency-label">별가루<[\s\S]*class="currency-value" data-star-dust/);
assert.match(html, /class="currency-label">별조각/);
assert.match(html, /class="currency-label">운석조각/);
assert.match(html, /<details class="main-menu-dropdown-wrap" data-main-menu-disclosure>/);
assert.match(html, /<summary class="main-menu-toggle" data-main-menu-toggle/);
assert.match(html, /data-main-menu-dropdown>[\s\S]*data-open-mail>편지함[\s\S]*data-open-news>소식[\s\S]*data-open-settings>설정/);

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
assert.match(css, /\.main-menu-dropdown-wrap\[open\]>\.main-menu-dropdown\{display:grid!important\}/);
assert.match(game, /mainMenuDisclosure\.addEventListener\("toggle",syncMainDropdownState\)/);
assert.match(game, /const bindReliableMenuAction=\(button,action\)=>/);
assert.match(game, /n\.style\.left=`\$\{position\.x\}%`;n\.style\.top=`\$\{position\.y\}%`/);

assert.match(html, /class="screen-scroll-content summon-content-scroll"[\s\S]*class="draw-actions"/);
assert.doesNotMatch(html, />\ucc9c\uc7a5 \[<b data-constellation-pity/);
assert.match(html, /data-battle-mode="normal"[\s\S]*class="stage-map mode-visual"[\s\S]*class="mode-body"/);
assert.match(html, /data-battle-mode="vertical"[\s\S]*class="stage-map mode-visual vertical-map"[\s\S]*class="mode-body"/);
assert.match(mobile, /\.screen-scroll-content\s*\{[^}]*flex:1 1 auto[^}]*min-height:0[^}]*overflow-y:auto[^}]*touch-action:pan-y/s);
assert.match(mobile, /\.summon-content-scroll\s*\{[^}]*padding:[^}]*var\(--bottom-nav-height\)[^}]*var\(--mobile-safe-bottom\)/s);
assert.match(mobile, /\.battle-mode-grid \.stage-card\s*\{[^}]*height:auto[^}]*min-height:0/s);
assert.match(mobile, /\.battle-mode-grid \.mode-visual\s*\{[^}]*position:relative[^}]*aspect-ratio:16 \/ 7/s);
assert.match(mobile, /\.battle-mode-grid \.mode-body\s*\{[^}]*position:relative[^}]*overflow:visible/s);
assert.match(game, /\.screen-scroll-content, \.battle-mode-grid, \.collection-scroll, \.relic-collection, \.monster-codex-content/);

console.log("Mobile two-row menu and narrow-screen readability checks passed.");
