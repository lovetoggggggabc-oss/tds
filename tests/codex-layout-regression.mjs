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
assert.match(js, /<dt>기본 공격력<\/dt><dd>\$\{zodiac\.attackDamage\}<\/dd>/);
assert.match(js, /단계 효과: 재료 별 단계 합 ÷ 4 × 공격력/);
assert.match(js, /연결에 사용한 별들의 단계 합을 4로 나눈 값만큼 기본 공격력에 배율이 적용됩니다\./);
assert.match(js, /새벽의 자리가 직접 5킬할 때마다 현재 살아있는 모든 적에게 각 적 현재 체력의 20%만큼 피해를 줍니다\./);
assert.match(js, /광휘의 자리가 몬스터를 직접 처치할 때마다 자신의 공격력이 0\.2%씩 영구적으로 증가합니다\./);
assert.match(js, /<strong>특수능력\$\{specials\.length > 1/);
assert.match(js, /광휘 처치 수: \$\{constellation\.runtime\.radianceKills\}/);
assert.match(js, /공격력 증가: \+\$\{formatMultiplier\(constellation\.runtime\.radianceKillBonus \* 100\)\}%/);
assert.match(js, /단계 공격력 배율: ×\$\{formatMultiplier\(getConstellationStageMultiplier\(constellation\)\)\}/);
assert.doesNotMatch(js, /\.abilities\b/, "codex and field info must share definition specialDescriptions");
assert.ok(
  js.indexOf('class="codex-preview-wrap"') < js.indexOf('class="codex-recipe"') &&
    js.indexOf('class="codex-recipe"') < js.indexOf('class="codex-stats"') &&
    js.indexOf('class="codex-stats"') < js.indexOf('class="codex-scaling"') &&
    js.indexOf('class="codex-scaling"') < js.indexOf('class="codex-special"'),
  "preview, recipe, stats, and specials must remain in document order",
);

console.log("Codex layout regression checks passed.");
