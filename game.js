"use strict";
// Keep boot diagnostics independent from the game object so failures during
// top-level initialization are visible on devices without a Web Inspector.
window.BOOT_STAGE = "script-start";

function showBootError(error, source, line, column) {
  const value = error instanceof Error ? error : new Error(String(error));
  let panel = document.getElementById("bootError");
  if (!panel) {
    panel = document.createElement("pre");
    panel.id = "bootError";
    panel.setAttribute("role", "alert");
    panel.style.cssText = "position:fixed;z-index:99999;top:8px;left:8px;right:8px;max-height:45vh;overflow:auto;margin:0;padding:10px;background:#24050e;color:#fff;border:1px solid #ff5064;border-radius:6px;font:12px/1.4 monospace;white-space:pre-wrap";
    (document.body || document.documentElement).append(panel);
  }
  const location = source ? `${source.split("/").pop()}:${line || 0}:${column || 0}` : "unknown:0:0";
  panel.textContent = `BOOT ERROR\nStage: ${window.BOOT_STAGE}\n${value.name}: ${value.message}\n${location}`;
}

window.addEventListener("error", (event) => {
  showBootError(event.error || event.message, event.filename, event.lineno, event.colno);
});
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
  showBootError(reason, reason.fileName, reason.lineNumber, reason.columnNumber);
});

let arena, battleWorld, effects, links, ranges, rangeIndicator, contextActions, hint;
let experimentalMinimap, experimentalBadge;
let dawnMoon, starInfo, controls, zodiacCodex, zodiacCodexList;
let wave, timer, hp, starlight1, divinity1, starlight2, divinity2, nextEnemies;
let speed, restart, finalWave, gameover;
let game = null;
let finishBattle = null;
let controlsBound = false;
let toastTimer = 0;
const GAME_MODES = Object.freeze({ NORMAL: "normal", EXPERIMENTAL_VERTICAL: "experimental_vertical" });
const EXPERIMENTAL_WORLD_HEIGHT = 2.8;
const EXPERIMENTAL_INITIAL_CAMERA = "destination";
let activeGameMode = GAME_MODES.NORMAL;

const SCREEN_STATES = Object.freeze({ MAIN_MENU: "MAIN_MENU", BATTLE_MENU: "BATTLE_MENU", MAP_RANDOM: "MAP_RANDOM", BATTLE_GAME: "BATTLE_GAME", GACHA: "GACHA", COLLECTION: "COLLECTION", RELICS: "RELICS", MONSTER_CODEX: "MONSTER_CODEX", NEWS: "NEWS" });
const PROGRESS_STORAGE_KEY = "zodiacDefenseProgress";
const PROGRESS_SCHEMA_VERSION = 7;
const UPDATE_REWARD_ID = "balance_update_stardust_3000_v1";
const METEOR_MAIL_REWARD_ID = "meteor_fragment_mail_30_v1";
const STAR_DUST_GRANT_ID = "starDust5000_v1";
const METEOR_GRANT_ID = "meteorFragments20_v2";
const STAR_DUST_GRANT_AMOUNT = 5000;
const METEOR_GRANT_AMOUNT = 20;
let specialGrantApplied = false;
const PREPARATION_SECONDS = 15;
const GACHA_COSTS = Object.freeze({ constellation: Object.freeze([100, 1000]), relic: Object.freeze([3, 30]) });
const GACHA_RULES = Object.freeze({ starChance: .95, constellationChance: .05, pityLimit: 40 });
const DEFAULT_SETTINGS = Object.freeze({ showMonsterHpNumbers: true, zodiacVfx: "strong" });
const NEWS_ITEMS = Object.freeze([Object.freeze({
  id: "battle_system_update_random_map_v1", date: "2026.09.21", title: "✦ 전투 시스템 개선 업데이트",
  sections: Object.freeze([
    Object.freeze({ title: "신규 별자리 개선", bullets: Object.freeze(["심판의 자리가 도감에 정상적으로 표시되도록 수정했습니다.", "심판 대상 추가 피해: 현재 체력 10% → 3.5%"]) }),
    Object.freeze({ title: "일반 모드 난이도", paragraphs: Object.freeze(["몬스터 성장률을 추가 조정했습니다."]), bullets: Object.freeze(["Wave 1~10: +5%", "Wave 11~20: +6%", "Wave 21~40: +7%", "Wave 41 이상: +8%"]) }),
    Object.freeze({ title: "맵 선택 개편", paragraphs: Object.freeze(["기존 맵 투표 시스템이 랜덤 맵 선택으로 변경되었습니다.", "일반 모드를 시작하면 3개의 전장 중 하나가 랜덤으로 결정됩니다.", "새로운 랜덤 선택 연출도 추가되었습니다."]) }),
    Object.freeze({ title: "보상 개선", bullets: Object.freeze(["일반 모드에서 획득하는 별가루: 웨이브당 8개"]) }),
    Object.freeze({ title: "모바일 개선", bullets: Object.freeze(["모바일에서 세로 대전장 카드까지 스크롤할 수 없어 플레이하지 못하던 문제를 수정했습니다."]) }),
    Object.freeze({ title: "버그 수정", bullets: Object.freeze(["뉴스를 모두 읽어도 알림 숫자가 사라지지 않던 문제 수정", "다른 메뉴에서 전투 탭을 눌렀을 때 실제 전투가 바로 시작되던 문제 수정", "심판의 자리가 도감에서 누락되던 문제 수정"]) }),
  ]), footer: "개선된 전투와 새로운 랜덤 전장 연출을 만나보세요.",
}), Object.freeze({
  id: "constellation_balance_judgement_v1", date: "2026.09.21", title: "✦ 별자리 & 전투 밸런스 업데이트",
  sections: Object.freeze([
    Object.freeze({ title: "신규 별자리", paragraphs: Object.freeze(["⚖ 심판의 자리", "백색 별 2개로 완성하는 새로운 공격형 별자리입니다. 매 웨이브 적 1명을 심판 대상으로 지정하고, 사거리 안에서는 집중 공격합니다."]), bullets: Object.freeze(["심판 대상을 공격할 때마다 공격 직전 현재 체력의 3.5% 추가 피해"]) }),
    Object.freeze({ title: "수호자의 자리 조정", bullets: Object.freeze(["수호의 빛 비용: 별빛 200 → 350", "풀피 최대 체력 증가: 1 + (구성 별 Stage 합 ÷ 4)%", "기지 최대 체력 상한: 500,000"]) }),
    Object.freeze({ title: "광휘의 별자리 개선", bullets: Object.freeze(["공격 대상이 체력이 가장 높은 적에서 가장 앞에 있는 적으로 변경되었습니다.", "연쇄 공격 효과를 간소화하여 전투 성능을 개선했습니다."]) }),
    Object.freeze({ title: "일반 모드", bullets: Object.freeze(["Wave 1~10: +5%", "Wave 11~20: +6%", "Wave 21~40: +7%", "Wave 41 이상: +8%", "전투 별가루 보상: 웨이브당 8개"]) }),
    Object.freeze({ title: "세로 대전장 BETA", bullets: Object.freeze(["적이 세로 방향의 길에서 비정상적으로 빠르게 이동하던 문제를 수정했습니다."]) }),
    Object.freeze({ title: "업데이트 보상", paragraphs: Object.freeze(["별가루 ×3,000", "우편함에서 수령할 수 있습니다."]) }),
  ]), footer: "새로운 심판의 별과 개선된 전투를 만나보세요.",
}), Object.freeze({
  id: "difficulty_rebalance_2026_09_v1", date: "2026.09.21", title: "✦ 전투 난이도 개편 업데이트",
  sections: Object.freeze([
    Object.freeze({ title: "전투 난이도 개편", paragraphs: Object.freeze(["일반 모드의 몬스터 성장 곡선을 개편했습니다.", "초반은 보다 안정적으로 성장할 수 있고, 후반으로 갈수록 점차 강한 적이 등장합니다."]) }),
    Object.freeze({ title: "일반 모드", bullets: Object.freeze(["몬스터 기본 체력: 250", "Wave 1~10 · 웨이브당 체력 +4%", "Wave 11~20 · 웨이브당 체력 +5%", "Wave 21~40 · 웨이브당 체력 +6%", "Wave 41 이상 · 웨이브당 체력 +7%"]) }),
    Object.freeze({ title: "세로 대전장 BETA", bullets: Object.freeze(["몬스터 기본 체력: 300", "웨이브당 체력 증가율: +1.5% → +4%", "몬스터 등장 수: 일반 모드의 2배 유지"]) }),
    Object.freeze({ title: "업데이트 보상", paragraphs: Object.freeze(["업데이트를 기념하여 별조각 ×3,000을 지급합니다.", "우편함에서 수령하세요."]) }),
    Object.freeze({ title: "버그 수정", bullets: Object.freeze(["별 또는 별자리를 선택했을 때 상세 설명이 정상적으로 표시되지 않던 문제를 수정했습니다.", "정보창의 텍스트가 오른쪽으로 밀리거나 잘려 보이던 문제를 수정했습니다."]) }),
  ]), footer: "새로운 성장 곡선과 함께 더 깊어진 전투를 경험하세요.",
}), Object.freeze({
  id: "relic_growth_update_v1", date: "2026.09.21", title: "✦ 유물 성장 시스템 업데이트",
  sections: Object.freeze([
    Object.freeze({ title: "유물 레벨 시스템", paragraphs: Object.freeze(["유물을 이제 Lv.4까지 성장시킬 수 있습니다.", "같은 유물과 별조각을 사용해 유물을 업그레이드하세요."]), bullets: Object.freeze(["Lv.1 → Lv.2 · 같은 유물 ×3 · 별조각 ×200", "Lv.2 → Lv.3 · 같은 유물 ×6 · 별조각 ×400", "Lv.3 → Lv.4 · 같은 유물 ×10 · 별조각 ×1,000"]) }),
    Object.freeze({ title: "신규 유물", bullets: Object.freeze(["별빛 결정 · 몬스터 처치 별빛 증가", "불멸의 성운 · 기지 피해를 완전히 막는 보호막", "운명의 주사위 · 전투 시작 시 별빛 / 신성 / 최대 소환 수 중 하나 획득", "우주의 공명 · 활성 별자리가 많을수록 별자리 공격속도 증가"]) }),
    Object.freeze({ title: "기존 유물 밸런스 및 성장", bullets: Object.freeze(["굳센 마음 · 기지 최대 체력 증가", "별들의 노래 · 일반 별 공격속도 증가", "별자리들의 노래 · 별자리 공격속도 증가", "점성술의 약 · 시작 별빛 증가", "행성의 축복 · 일반 별 공격력 증가", "별의 축복 · 별자리 공격력 증가", "결속성의 악 · 지원형 별자리 조디악 허용 횟수 증가", "결속성의 선 · 별 최대 소환 개수 증가", "초신성의 눈물 · 게임 결과 보상 증가"]) }),
    Object.freeze({ title: "불멸의 성운", paragraphs: Object.freeze(["특별한 성장 방식을 사용합니다.", "Lv.1~Lv.3은 보호막 1회, Lv.4는 보호막 2회입니다.", "카드에서 다음 보호막 증가까지의 성장 진행도를 확인할 수 있습니다."]) }),
  ]), footer: "13종의 유물을 모으고 Lv.MAX까지 성장시켜 보세요.",
}), Object.freeze({
  id: "vertical_beta_2026_09", date: "2026.09.21", title: "세로 대전장 BETA 출시",
  sections: Object.freeze([
    Object.freeze({ title: "신규 콘텐츠", paragraphs: Object.freeze(["세로 대전장 BETA", "세로로 펼쳐진 거대한 전장을 탐험하세요.", "화면을 위아래로 이동하며 별을 배치하고, 더 넓은 전장에서 별자리를 완성할 수 있습니다."]) }),
    Object.freeze({ title: "세로 대전장 전용 규칙", bullets: Object.freeze(["몬스터 기본 체력 300", "일반 모드보다 2배 많은 몬스터 등장", "웨이브당 몬스터 체력 +1.5%", "보스는 기본적으로 5웨이브마다 등장", "단, 1~10웨이브 구간에서는 5웨이브 보스가 등장하지 않습니다.", "시작 별빛 1,500", "시작 신성 30", "모든 별자리를 종류별로 최소 1개 이상 조디악할 수 있습니다."]) }),
    Object.freeze({ title: "세로 대전장 보상", bullets: Object.freeze(["10웨이브부터 진행한 해당 웨이브당 별조각 ×5", "5웨이브마다 운석조각 ×2", "40웨이브 은하 학살자 처치 시 은하조각 ×1"]) }),
    Object.freeze({ title: "일반 모드 밸런스 조정", bullets: Object.freeze(["적 시작 체력 500 → 250", "웨이브당 적 체력 증가율 +0.8%"]) }),
    Object.freeze({ title: "개선사항", bullets: Object.freeze(["세로 대전장의 PLAY 버튼을 더 명확하게 개선했습니다.", "세로 대전장의 길을 더 길고 다양한 방향으로 꺾이는 구조로 개선했습니다."]) }),
    Object.freeze({ title: "버그 수정", bullets: Object.freeze(["별자리를 선택했을 때 설명이 정상적으로 표시되지 않던 문제를 수정했습니다.", "적이 커브 구간에서 비정상적인 속도로 이동하던 문제를 수정했습니다."]) }),
  ]), footer: "세로 대전장은 현재 BETA 버전입니다. 전장 구조와 밸런스는 앞으로 계속 개선될 수 있습니다.",
})]);
const MAX_EQUIPPED_CONSTELLATIONS = 6;
const RELIC_DEFINITIONS = Object.freeze({
  STEADFAST_HEART: { id:"STEADFAST_HEART", name:"굳센 마음", effectType:"baseMaxHp", base:1000, step:500, icon:"♥", unit:"HP" },
  SONG_OF_STARS: { id:"SONG_OF_STARS", name:"별들의 노래", effectType:"normalStarAttackSpeed", base:.05, step:.01, icon:"♪", percent:true },
  SONG_OF_CONSTELLATIONS: { id:"SONG_OF_CONSTELLATIONS", name:"별자리들의 노래", effectType:"constellationAttackSpeed", base:.05, step:.01, icon:"♫", percent:true },
  ASTROLOGY_POTION: { id:"ASTROLOGY_POTION", name:"점성술의 약", effectType:"startStarlight", base:50, step:10, icon:"⚗" },
  BLESSING_OF_PLANETS: { id:"BLESSING_OF_PLANETS", name:"행성의 축복", effectType:"normalStarDamage", base:.10, step:.01, icon:"◉", percent:true },
  BLESSING_OF_STARS: { id:"BLESSING_OF_STARS", name:"별의 축복", effectType:"constellationDamage", base:.10, step:.01, icon:"✦", percent:true },
  EVIL_OF_BINDING_STAR: { id:"EVIL_OF_BINDING_STAR", name:"결속성의 악", effectType:"supportZodiacCharge", base:1, step:1, icon:"◆", unit:"회" },
  GOOD_OF_BINDING_STAR: { id:"GOOD_OF_BINDING_STAR", name:"결속성의 선", effectType:"maxStars", base:1, step:1, icon:"◇" },
  SUPERNOVA_TEAR: { id:"SUPERNOVA_TEAR", name:"초신성의 눈물", effectType:"battleReward", base:.10, step:.025, icon:"☄", percent:true },
  STARLIGHT_CRYSTAL: { id:"STARLIGHT_CRYSTAL", name:"별빛 결정", effectType:"killStarlight", base:.10, step:.025, icon:"❖", percent:true },
  IMMORTAL_NEBULA: { id:"IMMORTAL_NEBULA", name:"불멸의 성운", effectType:"baseShields", base:1, step:0, icon:"🛡" },
  DICE_OF_FATE: { id:"DICE_OF_FATE", name:"운명의 주사위", effectType:"battleDice", base:1, step:1, icon:"⚄" },
  COSMIC_RESONANCE: { id:"COSMIC_RESONANCE", name:"우주의 공명", effectType:"resonance", base:.005, step:.005, icon:"◎", percent:true },
});
Object.values(RELIC_DEFINITIONS).forEach(Object.freeze);
const RELIC_UPGRADE_COSTS = Object.freeze({ 1:Object.freeze({ duplicates:3, starShards:200 }), 2:Object.freeze({ duplicates:6, starShards:400 }), 3:Object.freeze({ duplicates:10, starShards:1000 }) });
function relicLevel(id) { return playerProgress?.relicProgress?.[id]?.owned ? playerProgress.relicProgress[id].level : 0; }
function hasRelic(id) { return relicLevel(id) > 0; }
function getRelicEffect(id, level = relicLevel(id)) {
  const definition = RELIC_DEFINITIONS[id]; level = Math.min(4, Math.max(0, Number(level) || 0));
  if (!definition || !level) return 0;
  if (id === "IMMORTAL_NEBULA") return level === 4 ? 2 : 1;
  return Number((definition.base + (level - 1) * definition.step).toFixed(4));
}
function relicMultiplier(id) { return 1 + getRelicEffect(id); }
function formatRelicValue(id, level) {
  const d=RELIC_DEFINITIONS[id], value=getRelicEffect(id,level);
  if (d.percent) return `${Number((value*100).toFixed(1))}%`;
  return `${Number(value.toFixed?.(1) ?? value).toLocaleString()}${d.unit || ""}`;
}
function relicEffectText(id, level) {
  const value=formatRelicValue(id,level), labels={ STEADFAST_HEART:`기지 최대 체력 +${value}`, SONG_OF_STARS:`일반 별 공격속도 +${value}`, SONG_OF_CONSTELLATIONS:`별자리 공격속도 +${value}`, ASTROLOGY_POTION:`시작 별빛 +${value}`, BLESSING_OF_PLANETS:`일반 별 공격력 +${value}`, BLESSING_OF_STARS:`별자리 공격력 +${value}`, EVIL_OF_BINDING_STAR:`지원형 조디악 추가 허용 ${value}`, GOOD_OF_BINDING_STAR:`별 최대 소환 수 +${value}`, SUPERNOVA_TEAR:`게임 결과 보상 +${value}`, STARLIGHT_CRYSTAL:`몬스터 처치 별빛 +${value}`, IMMORTAL_NEBULA:`기지 보호막 ${value}회`, DICE_OF_FATE:`별빛 +${50+level*50} / 신성 +${level+1} / 최대 별 +${level}`, COSMIC_RESONANCE:`활성 별자리당 공격속도 +${value} (최대 +20%)` };
  return labels[id] || "";
}
function relicEffect(id, fallback = 1) { return hasRelic(id) ? relicMultiplier(id) : fallback; }
let relicUpgradeLocked = false;
function upgradeRelic(id) {
  if (relicUpgradeLocked) return false;
  const entry=playerProgress.relicProgress?.[id], cost=entry && RELIC_UPGRADE_COSTS[entry.level];
  if (!entry?.owned || !cost || entry.duplicates < cost.duplicates || playerProgress.starShards < cost.starShards) return false;
  relicUpgradeLocked=true;
  entry.duplicates-=cost.duplicates; playerProgress.starShards-=cost.starShards; entry.level++;
  savePlayerProgress(); relicUpgradeLocked=false; return true;
}
const LEGACY_STAR_IDS = Object.freeze({ SKY: "YELLOW", SKYBLUE: "YELLOW", LIGHT_BLUE: "YELLOW", sky: "YELLOW", skyblue: "YELLOW", light_blue: "YELLOW" });
const STAR_TYPES = Object.freeze({
  BLUE: Object.freeze({ id: "BLUE", key: "blue", name: "청색", color: "#4d83ff", damage: 100, rate: 1, range: 5, target: "lock" }),
  WHITE: Object.freeze({ id: "WHITE", key: "white", name: "백색", color: "#ffffff", damage: 75, rate: 2, range: 3.5, target: "burst" }),
  YELLOW: Object.freeze({ id: "YELLOW", key: "yellow", name: "황색", color: "#ffd84d", damage: 150, rate: .8, range: 5, target: "random" }),
  ORANGE: Object.freeze({ id: "ORANGE", key: "orange", name: "주황색", color: "#ffad45", damage: 125, rate: 1.5, range: 4, target: "nearest" }),
  RED: Object.freeze({ id: "RED", key: "red", name: "적색", color: "#ff5064", damage: 200, rate: .5, range: 3, target: "highest" }),
  PURPLE: Object.freeze({ id: "PURPLE", key: "purple", name: "자색", color: "#b16cff", damage: 100, rate: 1, range: 4.5, target: "lowest" }),
  GREEN: Object.freeze({ id: "GREEN", key: "green", name: "녹색", color: "#55db85", damage: 0, rate: 0, range: 0, target: "none", support: "alliedAttackSpeed" }),
});
const STARTER_COLLECTION = Object.freeze({
  ownedStars: Object.freeze({ BLUE: 1, WHITE: 1, YELLOW: 1, ORANGE: 1, RED: 1 }),
  ownedConstellations: Object.freeze(["ASTROLOGER"]),
  equippedConstellations: Object.freeze(["ASTROLOGER"]),
});
function normalizeStarId(value) {
  const raw = String(value || "");
  return LEGACY_STAR_IDS[raw] || LEGACY_STAR_IDS[raw.toUpperCase()] || raw.toUpperCase();
}
const STAR_LEVEL_COSTS = Object.freeze({ 1: Object.freeze({ copies: 2, shards: 4 }), 2: Object.freeze({ copies: 4, shards: 10 }), 3: Object.freeze({ copies: 8, shards: 25 }), 4: Object.freeze({ copies: 16, shards: 60 }), 5: Object.freeze({ copies: 32, shards: 100 }), 6: Object.freeze({ copies: 64, shards: 200 }) });
const CONSTELLATION_LEVEL_COSTS = Object.freeze({ 1: Object.freeze({ copies: 2, galaxyFragments: 3 }), 2: Object.freeze({ copies: 4, galaxyFragments: 10 }), 3: Object.freeze({ copies: 8, galaxyFragments: 20 }) });
function normalizeStarCollection(saved, legacyStars) {
  const source = saved?.starCollection;
  const legacy = legacyStars || {};
  return Object.fromEntries(Object.keys(STAR_TYPES).map((id) => {
    const entry = source?.[id];
    const count = entry && typeof entry === "object" ? entry.count : legacy[id];
    const level = entry && typeof entry === "object" ? entry.level : 1;
    return [id, {
      count: Math.max(0, Math.floor(Number(count) || 0)),
      level: Math.min(7, Math.max(1, Math.floor(Number(level) || 1))),
    }];
  }));
}
function syncOwnedStars(progress) {
  progress.ownedStars = Object.fromEntries(Object.entries(progress.starCollection)
    .filter(([, entry]) => entry.count > 0).map(([id, entry]) => [id, entry.count]));
}
function starLevelCosts(level) {
  return STAR_LEVEL_COSTS[level] || null;
}
function starLevelDamageMultiplier(level) { return 1 + (Math.min(7, Math.max(1, level)) - 1) * .2; }
function starLevelAttackSpeedBonus(level) { return (Math.min(7, Math.max(1, level)) - 1) * .1; }
function normalStarSpecial(type, starStage, permanentStarLevel = 1, stageSums = {}) {
  const stage = Math.min(4, Math.max(1, Number(starStage) || 1));
  const level = Math.min(7, Math.max(1, Number(permanentStarLevel) || 1));
  if (type === "blue") return { slowPercent: level + stage, duration: 1 };
  if (type === "white") return { burstCount: 3, rest: 2 - stage / 4 };
  if (type === "yellow") return { lightPercent: level + stage, duration: 1 };
  if (type === "orange") return { burnInterval: Math.max(.05, .5 - stage / 8), rawBurnInterval: .5 - stage / 8, duration: 1, damageRatio: .5 };
  if (type === "red") return { areaRange: .15 + stage / 8 };
  if (type === "purple") return { attackSpeedBonus: (stageSums.purple || 0) / 10 };
  if (type === "green") return { attackSpeedBonus: (2 + level + (stageSums.green || 0)) / 100 };
  return {};
}
function normalStarAbilityText(type, stage, level, stageSums = {}) {
  const value = normalStarSpecial(type, stage, level, stageSums);
  const texts = {
    blue: `둔화 ${value.slowPercent}% / 1초`,
    white: `3연타 후 ${value.rest}초 휴식`,
    yellow: `빛 · 받는 피해 +${value.lightPercent}% / 1초`,
    orange: `화상 · 공격력 50% / ${value.rawBurnInterval === 0 ? "simulation tick" : `${value.burnInterval}초`} / 1초`,
    red: `범위 공격 · 반경 ${value.areaRange}`,
    purple: `보라색 공명 · 공속 +${value.attackSpeedBonus}`,
    green: `별빛 지원 · 모든 아군 공속 +${Math.round(value.attackSpeedBonus * 100)}%`,
  };
  return texts[type] || "";
}
function normalStarNextLevelText(type) {
  if (type === "blue") return "기본 둔화 +1%";
  if (type === "yellow") return "기본 빛 피해 증가 +1%";
  if (type === "green") return "기본 지원 공격속도 +1%";
  return "특수능력 변화 없음 · 공격력 +20% · 공격속도 +0.1";
}
function normalStarCollectionAbilityText(type, level) {
  if (type === "blue") return `적중 시 1초 동안 (${level} + 별 Stage)% 둔화`;
  if (type === "white") return "3회 빠르게 공격 후 2 - (별 Stage / 4)초 휴식";
  if (type === "yellow") return `적중 시 1초 동안 받는 피해 +(${level} + 별 Stage)%`;
  if (type === "orange") return "1초 화상 · 0.5 - (별 Stage / 8)초마다 공격력의 50%";
  if (type === "red") return "타격 지점 반경 0.15 + (별 Stage / 8) 범위 공격";
  if (type === "purple") return "모든 보라색 별 공격속도 +보라 Stage 합 / 10";
  if (type === "green") return `모든 아군 공격속도 +(${2 + level} + 초록 Stage 합)%`;
  return "";
}
function constellationLevelDamageMultiplier(level) { return 1 + (Math.min(4, Math.max(1, level)) - 1) * .5; }
function constellationLevelAttackSpeedBonus(level) { return (Math.min(4, Math.max(1, level)) - 1) * .5; }
function normalizeConstellationCollection(saved, owned) {
  const source = saved?.constellationCollection || {};
  return Object.fromEntries(owned.map((id) => [id, { owned: true, copies: Math.max(0, Math.floor(Number(source[id]?.copies) || 0)), level: Math.min(4, Math.max(1, Math.floor(Number(source[id]?.level) || 1))) }]));
}
function normalizeRelicProgress(saved) {
  const legacyOwned = new Set((saved?.ownedRelics || []).filter((id) => RELIC_DEFINITIONS[id]));
  const source = saved?.relicProgress || {};
  return Object.fromEntries(Object.keys(RELIC_DEFINITIONS).map((id) => {
    const old = source[id];
    const owned = old?.owned === true || legacyOwned.has(id);
    return [id, { owned, level: owned ? Math.min(4, Math.max(1, Math.floor(Number(old?.level) || 1))) : 0, duplicates: owned ? Math.max(0, Math.floor(Number(old?.duplicates) || 0)) : 0 }];
  }));
}
function upgradeConstellation(id) {
  const entry = playerProgress.constellationCollection[id];
  const cost = entry && CONSTELLATION_LEVEL_COSTS[entry.level];
  if (!cost || entry.copies < cost.copies || playerProgress.galaxyFragments < cost.galaxyFragments) return false;
  entry.copies -= cost.copies; playerProgress.galaxyFragments -= cost.galaxyFragments; entry.level++;
  savePlayerProgress(); return true;
}
function upgradeStar(id) {
  const entry = playerProgress.starCollection[id];
  const cost = entry && starLevelCosts(entry.level);
  if (!cost || entry.count < cost.copies || playerProgress.starShards < cost.shards) return false;
  entry.count -= cost.copies;
  playerProgress.starShards -= cost.shards;
  entry.level++;
  syncOwnedStars(playerProgress);
  savePlayerProgress();
  return true;
}
function loadPlayerProgress() {
  try {
    const saved = typeof localStorage === "undefined" ? null : JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY));
    const sourceStars = saved?.ownedStars ?? STARTER_COLLECTION.ownedStars;
    const ownedStars = {};
    if (Array.isArray(sourceStars)) sourceStars.forEach((id) => { const normalized = normalizeStarId(id); ownedStars[normalized] = (ownedStars[normalized] || 0) + 1; });
    else Object.entries(sourceStars || {}).forEach(([id, count]) => { const normalized = normalizeStarId(id); ownedStars[normalized] = (ownedStars[normalized] || 0) + Math.max(0, Math.floor(Number(count) || 0)); });
    const ownedConstellations = [...new Set(saved?.ownedConstellations ?? STARTER_COLLECTION.ownedConstellations)];
    const equippedConstellations = [...new Set(saved?.equippedConstellations ?? STARTER_COLLECTION.equippedConstellations)]
      .filter((id) => ownedConstellations.includes(id)).slice(0, MAX_EQUIPPED_CONSTELLATIONS);
    const grants = { ...(saved?.oneTimeGrants || {}) };
    const dustGranted = grants[STAR_DUST_GRANT_ID] === true;
    const meteorGranted = grants[METEOR_GRANT_ID] === true;
    specialGrantApplied = !dustGranted || !meteorGranted;
    grants[STAR_DUST_GRANT_ID] = true;
    grants[METEOR_GRANT_ID] = true;
    // starFragments was the historical summon balance. It must never seed the
    // new level-up shard balance; starDust takes ownership of it exactly once.
    const legacyDust = Number.isFinite(saved?.starDust) ? saved.starDust : saved?.starFragments;
    const lastReadNewsVersion = typeof saved?.lastReadNewsVersion === "string" ? saved.lastReadNewsVersion : "";
    const readNewsIds = { ...(saved?.readNewsIds || {}) };
    // Older saves stored only the newest id that had been seen. Preserve that
    // meaning by marking it and every older item read; newly prepended news
    // remains unread without resetting anybody's existing history.
    const legacyNewsIndex = NEWS_ITEMS.findIndex((item) => item.id === lastReadNewsVersion);
    if (legacyNewsIndex >= 0)
      NEWS_ITEMS.slice(legacyNewsIndex).forEach((item) => { readNewsIds[item.id] = true; });
    const progress = {
      schemaVersion: PROGRESS_SCHEMA_VERSION,
      starDust: Math.max(0, Math.floor(Number(legacyDust) || 0)) + (dustGranted ? 0 : STAR_DUST_GRANT_AMOUNT),
      starShards: Math.max(0, Math.floor(Number(saved?.starShards) || 0)),
      meteorFragments: Math.max(0, Number.isFinite(saved?.meteorFragments) ? Math.floor(saved.meteorFragments) : 0) + (meteorGranted ? 0 : METEOR_GRANT_AMOUNT),
      galaxyFragments: Math.max(0, Math.floor(Number(saved?.galaxyFragments) || 0)),
      starCollection: normalizeStarCollection(saved, ownedStars),
      ownedStars,
      ownedConstellations,
      constellationCollection: normalizeConstellationCollection(saved, ownedConstellations),
      equippedConstellations,
      constellationPity: Math.min(GACHA_RULES.pityLimit - 1, Math.max(0, Number.isFinite(saved?.constellationPity) ? Math.floor(saved.constellationPity) : 0)),
      relicProgress: normalizeRelicProgress(saved),
      ownedRelics: [...new Set((saved?.ownedRelics || []).filter((id) => RELIC_DEFINITIONS[id]))],
      settings: { ...DEFAULT_SETTINGS, ...(saved?.settings || {}) },
      claimedMail: { ...(saved?.claimedMail || {}) },
      redeemedSpecialCodes: { ...(saved?.redeemedSpecialCodes || {}) },
      oneTimeGrants: grants,
      lastReadNewsVersion,
      readNewsIds,
    };
    progress.ownedRelics = Object.entries(progress.relicProgress).filter(([,entry])=>entry.owned).map(([id])=>id);
    syncOwnedStars(progress);
    return progress;
  } catch (_error) {
    specialGrantApplied = true;
    const progress = { schemaVersion: PROGRESS_SCHEMA_VERSION, starDust: STAR_DUST_GRANT_AMOUNT, starShards: 0, meteorFragments: METEOR_GRANT_AMOUNT, galaxyFragments: 0, starCollection: normalizeStarCollection(null, STARTER_COLLECTION.ownedStars), ownedStars: {}, ownedConstellations: [...STARTER_COLLECTION.ownedConstellations], constellationCollection: normalizeConstellationCollection(null, STARTER_COLLECTION.ownedConstellations), equippedConstellations: [...STARTER_COLLECTION.equippedConstellations], constellationPity: 0, relicProgress: normalizeRelicProgress(null), ownedRelics: [], settings: { ...DEFAULT_SETTINGS }, claimedMail: {}, redeemedSpecialCodes: {}, oneTimeGrants: { [STAR_DUST_GRANT_ID]: true, [METEOR_GRANT_ID]: true }, lastReadNewsVersion: "", readNewsIds: {} };
    syncOwnedStars(progress);
    return progress;
  }
}
const playerProgress = loadPlayerProgress();
function savePlayerProgress() {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(playerProgress));
  } catch (_error) {
    // The game remains playable when storage is blocked by private-browser settings.
  }
}
savePlayerProgress();
function redeemSpecialCode(rawCode) {
  const code = String(rawCode ?? "").trim();
  if (code !== "hamburger123") return { ok: false, message: "유효하지 않은 코드입니다." };
  playerProgress.redeemedSpecialCodes ||= {};
  if (playerProgress.redeemedSpecialCodes[code]) return { ok: false, message: "이미 사용한 코드입니다." };
  // Eligibility and every reward are committed synchronously as one state change.
  playerProgress.redeemedSpecialCodes[code] = true;
  playerProgress.starDust += 50000;
  playerProgress.starShards += 50000;
  playerProgress.meteorFragments += 1000;
  savePlayerProgress();
  return { ok: true, message: "코드 사용 완료!\n별가루 +50,000\n별조각 +50,000\n운석파편 +1,000" };
}
function performConstellationDraws(count, random = Math.random) {
  const cost = count === 10 ? GACHA_COSTS.constellation[1] : GACHA_COSTS.constellation[0];
  if (![1, 10].includes(count) || playerProgress.starDust < cost) return null;
  const next = {
    pity: playerProgress.constellationPity,
    stars: { ...playerProgress.ownedStars },
    constellations: [...playerProgress.ownedConstellations], collection: Object.fromEntries(Object.entries(playerProgress.constellationCollection).map(([id, entry]) => [id, { ...entry }])),
  };
  const constellationIds = Object.keys(CONSTELLATION_DEFINITIONS);
  const starIds = Object.keys(STAR_TYPES);
  const results = [];
  for (let index = 0; index < count; index++) {
    const guaranteed = next.pity >= GACHA_RULES.pityLimit - 1;
    if (guaranteed || random() < GACHA_RULES.constellationChance) {
      const id = constellationIds[Math.min(constellationIds.length - 1, Math.floor(random() * constellationIds.length))];
      const isNew = !next.constellations.includes(id);
      if (isNew) { next.constellations.push(id); next.collection[id] = { owned: true, copies: 0, level: 1 }; }
      else next.collection[id].copies++;
      next.pity = 0;
      results.push({ kind: "constellation", id, isNew, guaranteed });
    } else {
      const id = starIds[Math.min(starIds.length - 1, Math.floor(random() * starIds.length))];
      next.stars[id] = (next.stars[id] || 0) + 1;
      next.pity++;
      results.push({ kind: "star", id });
    }
  }
  // Commit only after every result was generated, keeping currency and collection atomic.
  playerProgress.starDust -= cost;
  playerProgress.constellationPity = next.pity;
  playerProgress.ownedStars = next.stars;
  Object.entries(next.stars).forEach(([id, count]) => { playerProgress.starCollection[id].count = count; });
  playerProgress.ownedConstellations = next.constellations;
  playerProgress.constellationCollection = next.collection;
  savePlayerProgress();
  return results;
}
function performRelicDraws(count, random = Math.random) {
  const cost = count === 10 ? GACHA_COSTS.relic[1] : GACHA_COSTS.relic[0];
  if (![1, 10].includes(count) || playerProgress.meteorFragments < cost) return null;
  const pool = Object.values(RELIC_DEFINITIONS);
  const next = Object.fromEntries(Object.entries(playerProgress.relicProgress).map(([id,entry])=>[id,{...entry}]));
  const results = Array.from({ length: count }, () => {
    const relic = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
    const isNew = !next[relic.id].owned;
    if (isNew) Object.assign(next[relic.id], { owned:true, level:1, duplicates:0 });
    else next[relic.id].duplicates++;
    return { kind: "relic", id: relic.id, isNew };
  });
  playerProgress.meteorFragments -= cost;
  playerProgress.relicProgress = next;
  playerProgress.ownedRelics = Object.entries(next).filter(([,entry])=>entry.owned).map(([id])=>id);
  savePlayerProgress();
  return results;
}
const CONSTELLATION_IDS = Object.freeze({
  DAWN: "DAWN",
  RADIANCE: "RADIANCE",
  SAGITTARIUS: "SAGITTARIUS",
  ASTROLOGER: "ASTROLOGER",
  GUARDIAN: "GUARDIAN",
  TWILIGHT: "TWILIGHT",
  BOND: "BOND",
  LINK: "LINK",
  STRIKE: "STRIKE",
  HORIZON: "HORIZON",
  JUDGEMENT: "JUDGEMENT",
});
const BASE_MAX_HP = 400;
const BASE_MAX_HP_CAP = 500000;
const BASE_MAX_STARS = 21;
function effectiveMaxStars() { const currentGame=typeof game === "undefined" ? null : game; return BASE_MAX_STARS + getRelicEffect("GOOD_OF_BINDING_STAR") + (currentGame?.fateDice?.kind === "maxStars" ? currentGame.fateDice.value : 0); }
const MAX_STARS_PER_PLAYER = effectiveMaxStars();
// Logical, normalized map data is authoritative for drawing, movement and
// placement. New stages can provide another definition without changing any
// of those systems.
const MAP_DEFINITIONS = Object.freeze({
  ORIGINAL_S: Object.freeze({
    id: "ORIGINAL_S", name: "별의 S길",
    roadWidth: 34,
    placementPadding: 3,
    spawn: Object.freeze({ x: 50, y: 94 }),
    destination: Object.freeze({ x: 50, y: 6 }),
    route: Object.freeze([
      Object.freeze([{ x: 50, y: 94 }, { x: 50, y: 86 }, { x: 20, y: 86 }, { x: 26, y: 70 }]),
      Object.freeze([{ x: 26, y: 70 }, { x: 30, y: 55 }, { x: 78, y: 57 }, { x: 76, y: 39 }]),
      Object.freeze([{ x: 76, y: 39 }, { x: 74, y: 23 }, { x: 30, y: 25 }, { x: 50, y: 6 }]),
    ]),
    arrows: Object.freeze([0.14, 0.38, 0.63, 0.86]),
  }),
  CURVED_MAP: Object.freeze({
    id: "CURVED_MAP", name: "성운의 곡선",
    roadWidth: 34, placementPadding: 3,
    spawn: Object.freeze({ x: 72, y: 6 }), destination: Object.freeze({ x: 42, y: 94 }),
    route: Object.freeze([
      Object.freeze([{x:72,y:6},{x:64,y:18},{x:24,y:20},{x:28,y:40}]),
      Object.freeze([{x:28,y:40},{x:31,y:54},{x:79,y:43},{x:76,y:62}]),
      Object.freeze([{x:76,y:62},{x:72,y:75},{x:38,y:78},{x:42,y:94}]),
    ]), arrows: Object.freeze([.14,.38,.63,.86]),
  }),
  LOOP_MAP: Object.freeze({
    id: "LOOP_MAP", name: "은하의 고리",
    roadWidth: 30, placementPadding: 3,
    spawn: Object.freeze({ x: 27, y: 94 }), destination: Object.freeze({ x: 70, y: 6 }),
    route: Object.freeze([
      Object.freeze([{x:27,y:94},{x:13,y:80},{x:13,y:55},{x:34,y:49}]),
      Object.freeze([{x:34,y:49},{x:54,y:43},{x:73,y:50},{x:66,y:66}]),
      Object.freeze([{x:66,y:66},{x:58,y:81},{x:31,y:69},{x:36,y:50}]),
      Object.freeze([{x:36,y:50},{x:42,y:27},{x:78,y:38},{x:70,y:6}]),
    ]), arrows: Object.freeze([.12,.34,.55,.76,.91]),
  }),
});

function buildRoundedOrthogonalRoute(points, radius = 1.25) {
  const cubicLine = (a,b) => Object.freeze([a, {x:a.x+(b.x-a.x)/3,y:a.y+(b.y-a.y)/3}, {x:a.x+(b.x-a.x)*2/3,y:a.y+(b.y-a.y)*2/3}, b].map(Object.freeze));
  const segments=[]; let cursor=Object.freeze({...points[0]});
  for (let i=1;i<points.length-1;i++) {
    const previous=points[i-1], corner=points[i], next=points[i+1];
    const inLength=Math.hypot(corner.x-previous.x,corner.y-previous.y), outLength=Math.hypot(next.x-corner.x,next.y-corner.y);
    const r=Math.min(radius,inLength/3,outLength/3);
    const enter=Object.freeze({x:corner.x-(corner.x-previous.x)/inLength*r,y:corner.y-(corner.y-previous.y)/inLength*r});
    const exit=Object.freeze({x:corner.x+(next.x-corner.x)/outLength*r,y:corner.y+(next.y-corner.y)/outLength*r});
    segments.push(cubicLine(cursor,enter));
    segments.push(Object.freeze([enter, Object.freeze({...corner}), Object.freeze({...corner}), exit]));
    cursor=exit;
  }
  segments.push(cubicLine(cursor,Object.freeze({...points.at(-1)})));
  return Object.freeze(segments);
}
const VERTICAL_BETA_WAYPOINTS = Object.freeze([
  {x:50,y:3},{x:50,y:12},{x:20,y:12},{x:20,y:31},{x:78,y:31},{x:78,y:47},
  {x:40,y:47},{x:40,y:61},{x:72,y:61},{x:72,y:76},{x:25,y:76},{x:25,y:97},
].map(Object.freeze));
const EXPERIMENTAL_VERTICAL_MAP = Object.freeze({
  id: "EXPERIMENTAL_NEBULA_ROUTE", name: "거대 성운 항로", roadWidth: 30, placementPadding: 3,
  worldHeightScale: 2.8,
  spawn: Object.freeze({ x: 50, y: 3 }), destination: Object.freeze({ x: 25, y: 97 }),
  route: buildRoundedOrthogonalRoute(VERTICAL_BETA_WAYPOINTS), cornerRadius: 1.25,
  waypoints: VERTICAL_BETA_WAYPOINTS, arrows: Object.freeze([.05,.14,.25,.36,.46,.55,.65,.76,.87,.95]),
});
let activeMap = MAP_DEFINITIONS.ORIGINAL_S;
let activeRouteCache = null;
const CONSTELLATION_ATTACK_SCALING_DESCRIPTION =
  "연결에 사용한 별들의 단계 합을 4로 나눈 값만큼 기본 공격력에 배율이 적용됩니다. 예: 단계 합 7 → 공격력 ×1.75";
function getConstellationStageMultiplier(constellation) {
  return constellation.componentStageSum / 4;
}
function getStageScaledDamage(constellation) {
  const stageMultiplier = getConstellationStageMultiplier(constellation);
  // Judgement's two-star recipe must still deliver its specified 1,000 base
  // hit at Stage 1; higher component stages continue to use global scaling.
  return constellation.definition.attackDamage *
    (constellation.definitionId === CONSTELLATION_IDS.JUDGEMENT ? Math.max(1, stageMultiplier) : stageMultiplier);
}
function formatMultiplier(value) {
  return Number(value.toFixed(2)).toString();
}
// This is the sole source of truth for recipes, construction, combat stats,
// contextual actions, effects and the codex. specialDescriptions is shared by
// the field info and codex so displayed abilities cannot drift apart.
const CONSTELLATION_DEFINITIONS = Object.freeze({
  [CONSTELLATION_IDS.DAWN]: Object.freeze({
    id: CONSTELLATION_IDS.DAWN, name: "새벽의 별자리",
    recipe: Object.freeze({ blue: 3, white: 1 }), attackDamage: 500,
    attackSpeed: 4, range: 4, targeting: "highest", completionEffect: "dawnMoon",
    specialMultiplier: 15, specialHits: 4,
    previewLayout: Object.freeze({
      nodes: Object.freeze([[18, 67], [36, 42], [61, 28], [82, 48]]),
      edges: Object.freeze([[0, 1], [1, 2], [2, 3]]),
    }),
    specialDescriptions: Object.freeze([
      "같은 적을 4회 공격하면 현재 공격력의 1500% 특수 피해",
      "새벽의 자리가 직접 5킬할 때마다 현재 살아있는 모든 적에게 각 적 현재 체력의 20%만큼 피해를 줍니다.",
    ]),
  }),
  [CONSTELLATION_IDS.RADIANCE]: Object.freeze({
    id: CONSTELLATION_IDS.RADIANCE, name: "광휘의 별자리",
    recipe: Object.freeze({ red: 2, white: 1 }), attackDamage: 950,
    attackSpeed: 1, range: 6, targeting: "progress",
    previewLayout: Object.freeze({
      nodes: Object.freeze([[18, 70], [50, 24], [82, 70]]),
      edges: Object.freeze([[0, 1], [1, 2], [2, 0]]),
      order: Object.freeze([0, 2, 1]),
    }),
    specialDescriptions: Object.freeze([
      "구성 별들의 단계 합만큼 서로 다른 적에게 연쇄 공격. 각 대상은 광휘의 별자리 공격력만큼 피해",
      "광휘의 자리가 몬스터를 직접 처치할 때마다 자신의 공격력이 0.2%씩 영구적으로 증가합니다.",
    ]),
  }),
  [CONSTELLATION_IDS.SAGITTARIUS]: Object.freeze({
    id: CONSTELLATION_IDS.SAGITTARIUS, name: "궁수자리",
    recipe: Object.freeze({ yellow: 2, blue: 2 }), attackDamage: 400,
    attackSpeed: 6, range: 6, targeting: "highest",
    previewLayout: Object.freeze({
      nodes: Object.freeze([[18, 68], [43, 48], [67, 25], [58, 76]]),
      edges: Object.freeze([[0, 1], [1, 2], [1, 3], [3, 2]]),
    }),
    specialDescriptions: Object.freeze([
      "같은 적 집중 공격: 20타 공격력 +1000%, 40타 +2000%, 60타에 모든 아군 공격력 +1000% (10초). 타겟 변경 시 집중 초기화",
    ]),
  }),
  [CONSTELLATION_IDS.ASTROLOGER]: Object.freeze({
    id: CONSTELLATION_IDS.ASTROLOGER, name: "점성술자리",
    recipe: Object.freeze({ orange: 2 }), attackDamage: 100,
    attackSpeed: 1, range: 4, targeting: "highest", contextualAction: "divination",
    previewLayout: Object.freeze({
      nodes: Object.freeze([[24, 68], [76, 30]]),
      edges: Object.freeze([[0, 1]]),
    }),
    specialDescriptions: Object.freeze([
      "공격 명중 시 별빛 3 + 현재 활성화된 완성 별자리 수 획득",
      "별빛 점술 30: 50% 확률로 별빛 90, 50% 확률로 별빛 15를 획득합니다. 쿨타임 5초.",
    ]),
  }),
  [CONSTELLATION_IDS.GUARDIAN]: Object.freeze({
    id: CONSTELLATION_IDS.GUARDIAN, name: "수호자의 자리",
    recipe: Object.freeze({ green: 2, yellow: 1 }), attackDamage: 300,
    attackSpeed: 0.5, range: 3, targeting: "highest",
    previewLayout: Object.freeze({
      nodes: Object.freeze([[50, 18], [20, 68], [80, 68]]),
      edges: Object.freeze([[0, 1], [1, 2], [2, 0]]),
    }),
    contextualAction: "guardianLight",
    specialDescriptions: Object.freeze([
      "수호의 빛 350: 별빛 350을 사용합니다. 기지가 피해를 입었다면 50 + 최대 체력의 1%를 회복하고, 풀피라면 1 + (구성 별 Stage 합 ÷ 4)%만큼 최대 체력을 증가시킵니다 (기지 최대 500,000).",
      "15초마다 기지에서 수호자를 소환합니다. 수호자는 길을 거꾸로 이동하며 적과 만나면 현재 체력 + 공격력만큼 피해를 준 뒤 사라집니다. 수호자의 최대 체력은 기지 최대 체력과 별자리 단계 합에 따라 결정되며 최대 300,000입니다.",
    ]),
  }),
  [CONSTELLATION_IDS.TWILIGHT]: Object.freeze({
    id: CONSTELLATION_IDS.TWILIGHT, name: "황혼의 자리",
    recipe: Object.freeze({ red: 2, white: 1, blue: 1 }), attackDamage: 800,
    attackSpeed: 2, range: 7, targeting: "highest",
    transcendenceRange: 5, transcendenceKills: 50, transcendenceDuration: 15,
    previewLayout: Object.freeze({
      nodes: Object.freeze([[18, 68], [40, 28], [64, 28], [82, 68]]),
      edges: Object.freeze([[0, 1], [1, 2], [2, 3], [3, 0]]),
    }),
    specialDescriptions: Object.freeze([
      "체력이 50% 이하인 적을 공격할 때 피해량이 100% 증가하고 공격속도가 2배가 됩니다.",
      "50킬을 달성하면 15초간 초월합니다. 초월 중 사정거리가 5로 고정되며 영역 안의 현재 체력이 최대 체력의 10% 이하인 적을 즉시 처형합니다.",
    ]),
  }),
  [CONSTELLATION_IDS.BOND]: Object.freeze({
    id: CONSTELLATION_IDS.BOND, name: "결속의 자리",
    recipe: Object.freeze({ white: 3, green: 1 }), attackDamage: 500,
    attackSpeed: 1.8, range: 4, targeting: "random", contextualAction: "bondOffering",
    bindChance: 0.20, bindDuration: 2, offeringCost: 200, offeringChance: 0.10,
    previewLayout: Object.freeze({
      nodes: Object.freeze([[18, 50], [40, 24], [62, 50], [82, 76]]),
      edges: Object.freeze([[0, 1], [1, 2], [2, 3], [3, 0]]),
      order: Object.freeze([0, 1, 3, 2]),
    }),
    specialDescriptions: Object.freeze([
      "타격 시 20% 확률로 적을 2초간 결속하여 이동을 멈춥니다.",
      "별빛 헌납 200: 해당 결속의 자리의 결속 확률이 +10%p 증가합니다. 최대 100%.",
    ]),
  }),
  [CONSTELLATION_IDS.LINK]: Object.freeze({
    id: CONSTELLATION_IDS.LINK, name: "링크의 자리",
    recipe: Object.freeze({ purple: 2, green: 1, red: 1 }), attackDamage: 100,
    attackSpeed: 3, range: 6, targeting: "highest",
    previewLayout: Object.freeze({
      nodes: Object.freeze([[18, 30], [42, 50], [70, 22], [82, 74]]),
      edges: Object.freeze([[0, 1], [1, 2], [1, 3]]),
    }),
    specialDescriptions: Object.freeze([
      "다른 활성 별자리들의 재료 단계 합을 계승하며, 합이 0이면 계승 배율은 최소 ×1입니다.",
      "연결 단계 합 10/20/30마다 공격력이 +100%씩 누적 증가합니다.",
    ]),
  }),
  [CONSTELLATION_IDS.STRIKE]: Object.freeze({
    id: CONSTELLATION_IDS.STRIKE, name: "일격의 자리",
    recipe: Object.freeze({ red: 1, white: 2, purple: 1 }), attackDamage: 725,
    attackSpeed: 3.15, range: 4.45, targeting: "highest", contextualAction: "strike",
    previewLayout: Object.freeze({ nodes: Object.freeze([[15, 52], [39, 28], [65, 45], [84, 72]]), edges: Object.freeze([[0, 1], [1, 2], [2, 3]]) }),
    specialDescriptions: Object.freeze(["보스 피해 ×2.20, 일반 몬스터 피해 ×0.85.", "명중할 때 일격 스택 +1. 일격 가하기는 스택당 현재 공격력 +0.35%의 피해를 주고 스택을 소모합니다."]),
  }),
  [CONSTELLATION_IDS.HORIZON]: Object.freeze({
    id: CONSTELLATION_IDS.HORIZON, name: "지평선의 자리",
    recipe: Object.freeze({ green: 2, purple: 1 }), attackDamage: 0,
    attackSpeed: 0, range: 0, targeting: "none", supportOnly: true, contextualAction: "horizonFocus",
    previewLayout: Object.freeze({ nodes: Object.freeze([[17, 52], [50, 50], [83, 48]]), edges: Object.freeze([[0, 1], [1, 2]]) }),
    specialDescriptions: Object.freeze(["직접 공격하지 않습니다. 지평선의 초점으로 다른 활성 별자리의 능력 정의를 독립적으로 계승합니다.", "힘을 계승당한 원본 별자리는 공격 cycle마다 15% 확률로 추가 공격을 1회 합니다."]),
  }),
  [CONSTELLATION_IDS.JUDGEMENT]: Object.freeze({
    id: CONSTELLATION_IDS.JUDGEMENT, name: "심판의 자리",
    recipe: Object.freeze({ white: 2 }), attackDamage: 1000,
    attackSpeed: 5.5, range: 7.5, targeting: "progress",
    previewLayout: Object.freeze({ nodes: Object.freeze([[25, 58], [75, 58]]), edges: Object.freeze([[0, 1]]) }),
    specialDescriptions: Object.freeze([
      "특수능력 — 심판 대상: 매 웨이브 적 1명을 심판 대상으로 지정합니다. 대상이 사정거리 안에 있다면 최우선으로 공격합니다.",
      "특수능력 — 처단: 심판 대상을 공격할 때마다 대상의 공격 직전 현재 체력의 3.5%만큼 추가 피해를 입힙니다.",
    ]),
  }),
});
playerProgress.ownedConstellations = playerProgress.ownedConstellations.filter((id) => CONSTELLATION_DEFINITIONS[id]);
playerProgress.equippedConstellations = playerProgress.equippedConstellations
  .filter((id) => playerProgress.ownedConstellations.includes(id) && CONSTELLATION_DEFINITIONS[id])
  .slice(0, MAX_EQUIPPED_CONSTELLATIONS);
savePlayerProgress();
const CONFIG = {
  waveSeconds: 10,
  bossWaveSeconds: 20,
  summonCost: 30,
  swapCost: 10,
  divinationCost: 30,
  guardianLightCost: 350,
  bondOfferingCost: 200,
  startStarlight: 300,
  startDivinity: 1,
  baseMaxHP: BASE_MAX_HP,
  guardianUnit: {
    hpRatio: 0.50,
    attacksPerSecond: 3,
    summonCooldown: 15,
    speed: 3,
    contactDistance: 24,
  },
  // One range unit is this percentage of the arena width. RangeSystem is the
  // single conversion point used by both targeting and the circular overlay.
  rangeUnit: 6.3,
  waveHpGrowth: 0.12,
  tierDamage: [1, 1.7, 2.8, 4.4],
  whiteBurstInterval: 0.16,
  whiteBurstRest: 2,
  monsters: {
    darkSlime: { name: "암흑 슬라임", hp: 800, speed: 4.5, reward: 5, role: "기본형", abilityName: "없음", abilityText: "특수 능력이 없습니다.", description: "어둠으로 이루어진 가장 기본적인 몬스터. 작고 단순하지만, 끊임없이 몰려온다." },
    shadowRunner: { name: "그림자 러너", hp: 450, speed: 7, reward: 7, role: "저체력 / 고속", abilityName: "질주", abilityText: "별도의 가속 없이 기본 이동속도 7로 빠르게 전진합니다.", description: "빛을 피하는 그림자. 빠른 속도로 별들을 향해 달려온다." },
    voidGolem: { name: "공허 골렘", hp: 2000, speed: 2.2, reward: 12, role: "피해감소 탱커", damageTakenMultiplier: .8, abilityName: "암흑화", abilityText: "받는 모든 피해가 20% 감소합니다.", description: "무너진 별의 조각으로 만들어진 골렘. 묵직한 몸으로 별빛을 짓밟는다." },
    abyssEye: { name: "심연의 눈", hp: 1000, speed: 3, reward: 15, role: "원거리 방해", abilityName: "암흑탄", abilityText: "10초 후 가장 가까운 일반 별에 암흑탄을 발사하고, 이후 5초마다 공격속도를 1초간 2 감소시킵니다.", description: "공허 속에서 떠도는 거대한 눈. 모든 별빛을 노려본다." },
    voidGuide: { name: "공허의 인도자", hp: 20000, speed: 2.5, reward: 45, boss: true, role: "특수 보스", abilityName: "행진 준비 · 암흑 행진", abilityText: "러너 2기와 골렘 1기를 앞세웁니다. 2초 후부터 8초마다 거리 3 안의 몬스터 이동속도를 3초간 1.8 증가시킵니다.", description: "다가오는 어둠을 인도하는 존재. 그가 나타나면, 모든 몬스터가 더 빠르게 움직인다." },
    voidPriest: { name: "공허의 사제", hp: 25000, speed: 2.7, reward: 55, boss: true, role: "치유 보스", abilityName: "의식 준비 · 재생의 의식", abilityText: "슬라임 2기와 골렘 1기를 앞세웁니다. 2초 후부터 6초마다 모든 살아 있는 몬스터의 최대 체력 5%를 회복합니다.", description: "공허의 힘으로 동료들을 치유하는 사제. 그가 있는 한, 어둠은 쉽게 무너지지 않는다." },
    slime: { name: "어둠 슬라임", hp: 500, speed: 4.6, reward: 5, baseDamage: 100, allyCombatDamage: 35 },
    bug: { name: "암흑 벌레", hp: 800, speed: 7, reward: 7, baseDamage: 150, allyCombatDamage: 55 },
    drone: {
      name: "코어 드론",
      hp: 10000,
      speed: 2.8,
      reward: 30,
      baseDamage: 500,
      allyCombatDamage: 180,
      boss: true,
    },
    meteor: {
      name: "운석 괴물",
      hp: 20000,
      speed: 1.8,
      reward: 50,
      baseDamage: 1000,
      allyCombatDamage: 300,
      boss: true,
      bossAbility: "meteorShot",
      abilityDelay: 1,
    },
    kingSlime: { name: "우주 킹슬라임", hp: 14000, speed: 2.2, reward: 35, baseDamage: 600, allyCombatDamage: 210, boss: true, bossAbility: "summonSlimes", abilityDelay: .8 },
    timeRunner: { name: "시공간 러너", hp: 18000, speed: 3.6, reward: 45, baseDamage: 800, allyCombatDamage: 250, boss: true, bossAbility: "timeSprint", abilityDelay: 5, speedMultiplier: 3.2, abilityDuration: 3 },
    galaxySlayer: { name: "은하 학살자", hp: 30000, speed: 1.55, reward: 70, baseDamage: 1400, allyCombatDamage: 380, boss: true, bossAbility: "severZodiac", abilityDelay: 5 },
  },
  stars: Object.freeze(Object.fromEntries(Object.values(STAR_TYPES).map(({ id: _id, key, ...definition }) => [key, Object.freeze(definition)]))),
};
const VERTICAL_BETA = "experimental_vertical";
const EARLY_WAVE_COMPOSITIONS = Object.freeze([
  null,
  { darkSlime: 8 }, { darkSlime: 10 }, { darkSlime: 10, shadowRunner: 2 },
  { darkSlime: 8, shadowRunner: 3, voidGolem: 1 }, { darkSlime: 6, shadowRunner: 6, voidGolem: 1 },
  { shadowRunner: 12 }, { voidGolem: 4, shadowRunner: 4 }, { voidGolem: 8 },
  { darkSlime: 4, voidGolem: 2, shadowRunner: 2, abyssEye: 1 }, { voidGuide: 1 },
  { darkSlime: 8 }, { darkSlime: 10 }, { darkSlime: 10, shadowRunner: 2 },
  { darkSlime: 8, shadowRunner: 3, voidGolem: 1 }, { darkSlime: 6, shadowRunner: 6, voidGolem: 1 },
  { shadowRunner: 12 }, { voidGolem: 4, shadowRunner: 4 }, { voidGolem: 8 },
  { darkSlime: 4, voidGolem: 2, shadowRunner: 2, abyssEye: 1 }, { voidPriest: 1 },
].map((entry) => entry && Object.freeze(entry)));
const MONSTER_CODEX_IDS = Object.freeze(["darkSlime", "shadowRunner", "voidGolem", "abyssEye", "voidGuide", "voidPriest"]);
const MODE_CONFIG = Object.freeze({
  normal: Object.freeze({ baseEnemyHp: 250, enemyCountMultiplier: 1, startingStarlight: 300, startingDivinity: 1 }),
  experimental_vertical: Object.freeze({ baseEnemyHp: 300, waveHpGrowth: .04, enemyCountMultiplier: 2, startingStarlight: 1500, startingDivinity: 30 }),
});

function getNormalWaveHpMultiplier(wave) {
  const n = Math.max(1, Math.floor(Number(wave) || 1));
  const multiplier = Math.pow(1.05, Math.min(n - 1, 9))
    * Math.pow(1.06, Math.min(Math.max(n - 10, 0), 10))
    * Math.pow(1.07, Math.min(Math.max(n - 20, 0), 20))
    * Math.pow(1.08, Math.max(n - 40, 0));
  return Number.isFinite(multiplier) ? Math.min(multiplier, 1e300) : 1e300;
}

function getWaveHpMultiplier(mode, wave) {
  if (mode === GAME_MODES.EXPERIMENTAL_VERTICAL) {
    const multiplier = Math.pow(1 + MODE_CONFIG.experimental_vertical.waveHpGrowth, Math.max(0, Math.floor(Number(wave) || 1) - 1));
    return Number.isFinite(multiplier) ? Math.min(multiplier, 1e300) : 1e300;
  }
  return getNormalWaveHpMultiplier(wave);
}

// Pointer Events avoid Safari's synthetic touch/click pair. A small movement
// allowance keeps a deliberate tap responsive while rejecting drags.
function bindPointerTap(element, callback, shouldStart = () => true) {
  let gesture = null;
  const cancel = (event) => {
    if (gesture && event?.pointerId === gesture.id && element.hasPointerCapture?.(gesture.id))
      element.releasePointerCapture(gesture.id);
    gesture = null;
  };
  element.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button > 0 || !shouldStart(event)) return;
    // A contextual control created after this point has no matching gesture
    // record. Therefore the selecting pointerup (and Safari compatibility
    // click) can never activate that newly-created control.
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, target: event.currentTarget };
    element.setPointerCapture?.(event.pointerId);
  });
  element.addEventListener("pointermove", (event) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10)
      cancel();
  }, { passive: true });
  element.addEventListener("pointercancel", cancel);
  element.addEventListener("pointerup", (event) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    cancel(event);
    event.preventDefault();
    event.stopPropagation();
    callback(event);
  });
  // Pointer gestures are authoritative. In particular, never turn Safari's
  // synthetic click after touchend into a second action. Keyboard activation
  // remains handled explicitly by each control.
  element.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.detail === 0 && shouldStart(event)) callback(event);
  });
}
// Every zodiac-facing feature reads this registry: matching, combat, labels,
// and the codex. Adding a constellation does not require another matching
// branch or a new hard-coded selection limit.
const ZODIAC_RECIPES = CONSTELLATION_DEFINITIONS;
const RECIPE_COUNTS = Object.freeze(Object.fromEntries(
  Object.entries(ZODIAC_RECIPES).map(([id, definition]) => [id, definition.recipe]),
));
function recipeCountsMatch(selectedCounts, recipeCounts) {
  const selectedTypes = Object.keys(selectedCounts);
  const recipeTypes = Object.keys(recipeCounts);
  return selectedTypes.length === recipeTypes.length &&
    selectedTypes.every((type) => recipeCounts[type] === selectedCounts[type]);
}
const STAR_KEYS = Object.keys(CONFIG.stars),
  TARGET_LABELS = {
    lock: "대상 고정 공격",
    random: "무작위 대상",
    burst: "3연속 공격 → Stage별 휴식",
    nearest: "가장 가까운 적",
    highest: "체력이 가장 높은 적",
    lowest: "현재 체력이 가장 낮은 적",
    none: "공격하지 않음 · 별빛 지원",
  };
class PlayerResources {
  constructor(fateDice = null) {
    const mode = MODE_CONFIG[typeof activeGameMode === "string" ? activeGameMode : "normal"] || MODE_CONFIG.normal;
    this.starlight = mode.startingStarlight + getRelicEffect("ASTROLOGY_POTION") + (fateDice?.kind === "starlight" ? fateDice.value : 0);
    this.divinity = mode.startingDivinity + (fateDice?.kind === "divinity" ? fateDice.value : 0);
  }
  can(n) {
    return this.starlight >= n;
  }
  spend(n) {
    if (!this.can(n)) return false;
    this.starlight -= n;
    return true;
  }
}
class Enemy {
  constructor(type, lane, wave, judgementTarget = false) {
    Object.assign(this, CONFIG.monsters[type]);
    this.type = type;
    // lane is retained as a harmless compatibility field for saved/test data;
    // every enemy now travels the one shared route.
    this.lane = 0;
    this.progress = 0;
    this.pathProgress = 0;
    this.distanceTravelled = 0;
    const runtimeMode = game?.mode || (typeof activeGameMode === "string" ? activeGameMode : "normal");
    const legacyHarness = !game?.mode;
    // Every new monster's listed base HP is authoritative; current-wave
    // scaling is still applied, including when waves 11–19 repeat layouts.
    this.maxHp = this.hp * (legacyHarness ? Math.pow(1 + CONFIG.waveHpGrowth, wave - 1) : getWaveHpMultiplier(runtimeMode, wave));
    this.hp = this.maxHp;
    this.dead = false;
    this.judgementTarget = judgementTarget;
    this.isBoss = this.boss === true;
    this.spawnTime = game?.gameTime || 0;
    this.nextAbilityAt = this.type === "abyssEye" ? this.spawnTime + 10
      : (this.type === "voidGuide" || this.type === "voidPriest") ? this.spawnTime + 2 : Infinity;
    this.marchBuffs = new Map();
    this.healFlashUntil = 0;
    this.abilityTriggered = false;
    this.speedBoostUntil = 0;
    this.bossRewardClaimed = false;
    this.engagedAlly = null;
    // Status effects use simulation time; no per-enemy timers are needed.
    this.statusEffects = { bindUntil: 0, slowUntil: 0, slowPercent: 0, lightUntil: 0, lightPercent: 0, burnUntil: 0, burnNextAt: 0, burnInterval: 0, burnDamage: 0, burnFrom: null };
    this.x = activeMap.spawn.x;
    this.y = activeMap.spawn.y;
    this.resolved = false;
    this.lastHpPercent = -1;
    this.lastHpText = "";
    this.el = document.createElement("div");
    this.el.className = `enemy ${this.type}${this.boss ? " boss" : ""}${this.judgementTarget ? " judgement-target" : ""}`;
    this.el.innerHTML = `<div class="enemy-health"><span class="enemy-hp"></span><div class="bar" aria-hidden="true"><i></i></div></div><span class="enemy-body"></span>${this.judgementTarget ? '<b class="judgement-mark" aria-label="심판 대상">⚖</b>' : ""}<small>${this.boss ? this.name : ""}</small>`;
    this.hpFill = this.el.querySelector(".bar i");
    this.hpText = this.el.querySelector(".enemy-hp");
    this.hpText.hidden = !playerProgress.settings.showMonsterHpNumbers;
    (typeof battleWorld !== "undefined" && battleWorld ? battleWorld : arena).append(this.el);
    this.updateHealthBar();
    this.render();
  }
  position() {
    return { x: this.x, y: this.y };
  }
  calculatePosition() {
    return routePoint(Math.min(1, this.pathProgress));
  }
  render() {
    // The road SVG and every moving unit now use the same normalized arena
    // coordinate space. Percent positioning avoids mixing the SVG viewport
    // with a border-box pixel measurement (which drifted on resized tablets).
    this.el.style.left = `${this.x}%`;
    this.el.style.top = `${this.y}%`;
    if (game?.mode === "experimental_vertical") {
      const y = worldToScreen(this.position()).y;
      this.el.style.visibility = y < -100 || y > arena.clientHeight + 100 ? "hidden" : "";
    } else this.el.style.visibility = "";
  }
  update(dt) {
    const status = this.statusEffects;
    if (status.burnUntil > game.gameTime && status.burnInterval > 0) {
      // At most one tick is resolved per simulation update. This makes the
      // Stage 4 minimum interval safe even when a frame covers several ticks.
      if (game.gameTime >= status.burnNextAt) {
        status.burnNextAt += status.burnInterval;
        this.hit(status.burnDamage, status.burnFrom, null, true);
        if (this.dead) return;
      }
    }
    this.el.classList.toggle("slowed", status.slowUntil > game.gameTime);
    this.el.classList.toggle("lit", status.lightUntil > game.gameTime);
    this.el.classList.toggle("burning", status.burnUntil > game.gameTime);
    this.el.classList.toggle("ritual-healed", this.healFlashUntil > game.gameTime);
    this.updateAbility();
    if (this.dead) return;
    if (this.bossAbility && !this.abilityTriggered && game.gameTime - this.spawnTime >= (this.abilityDelay || 0)) {
      this.abilityTriggered = true;
      if (this.bossAbility === "summonSlimes") {
        this.el.classList.add("boss-casting", "slime-pulse");
        const summonedHp = Math.max(1, this.hp * .5);
        for (let index = 0; index < 4; index++) {
          const slime = new Enemy("slime", 0, 1); slime.maxHp = summonedHp; slime.hp = summonedHp;
          slime.progress = Math.max(0, this.progress - 1 + index * .45); slime.pathProgress = slime.progress / 100; slime.distanceTravelled = slime.pathProgress * activeRouteCache.length;
          Object.assign(slime, slime.calculatePosition()); slime.updateHealthBar(); slime.render(); slime.el.classList.add("summoned-slime"); game.enemies.push(slime);
        }
      } else if (this.bossAbility === "timeSprint") {
        this.speedBoostUntil = game.gameTime + this.abilityDuration; this.el.classList.add("runner-boost");
      } else if (this.bossAbility === "meteorShot") game.fireBossMeteor(this);
      else if (this.bossAbility === "severZodiac") game.forceDismantleRandom(this);
    }
    if (this.bossAbility === "timeSprint") {
      this.el.classList.toggle("runner-charging", !this.abilityTriggered);
      if (this.speedBoostUntil && game.gameTime >= this.speedBoostUntil) { this.speedBoostUntil = 0; this.el.classList.remove("runner-boost"); }
    }
    const bound = this.statusEffects.bindUntil > game.gameTime;
    this.el.classList.toggle("bound", bound);
    if (bound) return;
    if (this.engagedAlly && !this.engagedAlly.dead) return;
    this.engagedAlly = null;
    const routeLength = typeof activeRouteCache === "object" && activeRouteCache ? activeRouteCache.length : 100;
    const slowMultiplier = status.slowUntil > game.gameTime ? 1 - status.slowPercent / 100 : 1;
    for (const [source, until] of this.marchBuffs) if (until <= game.gameTime) this.marchBuffs.delete(source);
    const marchBonus = this.marchBuffs.size ? 1.8 : 0;
    this.distanceTravelled += (this.speed + marchBonus) * slowMultiplier * routeLength / 100 * (this.speedBoostUntil > game.gameTime ? this.speedMultiplier : 1) * dt;
    // Legacy percentage equivalent: this.pathProgress = Math.min(1, this.progress / 100);
    this.pathProgress = Math.min(1, this.distanceTravelled / routeLength);
    this.progress = this.pathProgress * 100;
    const position = this.calculatePosition();
    this.x = position.x;
    this.y = position.y;
    if (this.progress >= 100 && !this.resolved) {
      this.resolved = true;
      this.dead = true;
      this.el.remove();
      game.leak(this);
    } else this.render();
  }
  hit(n, from, sourceConstellation = null, isStatusDamage = false) {
    if (this.dead || n <= 0) return false;
    const lightMultiplier = this.statusEffects.lightUntil > game.gameTime ? 1 + this.statusEffects.lightPercent / 100 : 1;
    this.hp -= n * lightMultiplier * (this.damageTakenMultiplier || 1);
    if (!isStatusDamage) UIManager.beam(from, this.position());
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      this.el.remove();
      game.kill(this, sourceConstellation);
    } else this.updateHealthBar();
    return true;
  }
  updateAbility() {
    if (this.dead || game.gameTime < this.nextAbilityAt) return;
    if (this.type === "abyssEye") {
      const stars = game.players.flatMap((player) => player.manager.stars.filter((star) => star && !star.support && !star.constellation).map((star) => ({ star, position: player.manager.pos(player.manager.stars.indexOf(star)) })));
      let target = null, closest = Infinity;
      stars.forEach((candidate) => { const distance = RangeSystem.distance(this.position(), candidate.position); if (distance < closest) { closest = distance; target = candidate; } });
      if (target) {
        target.star.darkShotUntil = Math.max(target.star.darkShotUntil || 0, game.gameTime + 1);
        UIManager.darkShot(this.position(), target.position);
      }
      this.nextAbilityAt += 5;
    } else if (this.type === "voidGuide") {
      game.enemies.forEach((enemy) => {
        if (!enemy.dead && RangeSystem.contains(this.position(), enemy.position(), 3)) enemy.marchBuffs.set(this, game.gameTime + 3);
      });
      this.el.classList.remove("ability-pulse"); void this.el.offsetWidth; this.el.classList.add("ability-pulse");
      this.nextAbilityAt += 8;
    } else if (this.type === "voidPriest") {
      game.enemies.forEach((enemy) => {
        if (enemy.dead) return;
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * .05);
        enemy.healFlashUntil = game.gameTime + .45;
        enemy.updateHealthBar();
      });
      this.el.classList.remove("ability-pulse"); void this.el.offsetWidth; this.el.classList.add("ability-pulse");
      this.nextAbilityAt += 6;
    }
  }
  applySlow(percent, duration = 1) {
    this.statusEffects.slowPercent = percent;
    this.statusEffects.slowUntil = game.gameTime + duration;
    this.el.classList.add("slowed");
  }
  applyLight(percent, duration = 1) {
    this.statusEffects.lightPercent = percent;
    this.statusEffects.lightUntil = game.gameTime + duration;
    this.el.classList.add("lit");
  }
  applyBurn(damage, interval, duration = 1, from = this.position()) {
    Object.assign(this.statusEffects, { burnDamage: damage, burnInterval: Math.max(.05, interval), burnNextAt: game.gameTime + Math.max(.05, interval), burnUntil: game.gameTime + duration, burnFrom: from });
    this.el.classList.add("burning");
  }
  applyBind(duration) {
    // Reapplication refreshes the deadline rather than stacking timers.
    this.statusEffects.bindUntil = game.gameTime + duration;
    this.el.classList.add("bound");
  }
  execute(sourceConstellation) {
    if (this.dead) return false;
    this.hp = 0;
    this.dead = true;
    this.el.remove();
    game.kill(this, sourceConstellation);
    return true;
  }
  updateHealthBar() {
    const hpPercent = Math.max(0, Math.min(100, (this.hp / this.maxHp) * 100));
    const hpText = `${Math.round(Math.max(0, this.hp)).toLocaleString()} / ${Math.round(this.maxHp).toLocaleString()}`;
    if (hpPercent !== this.lastHpPercent) {
      this.hpFill.style.width = `${hpPercent}%`;
      this.lastHpPercent = hpPercent;
    }
    if (hpText !== this.lastHpText) {
      this.hpText.textContent = hpText;
      this.lastHpText = hpText;
    }
  }
}
class GuardianUnit {
  constructor(base, componentStageSum = 0) {
    this.team = "ALLY";
    this.maxHp = Math.min(300000, base.maxHp * ((50 + componentStageSum) / 100));
    this.damage = base.maxHp * 0.50;
    this.hp = this.maxHp;
    this.pathProgress = 1;
    this.progress = 100;
    this.distanceTravelled = activeRouteCache.length;
    this.dead = false;
    this.resolved = false;
    Object.assign(this, activeMap.destination);
    this.el = document.createElement("div");
    this.el.className = "guardian-unit";
    this.el.innerHTML = '<div class="guardian-health"><span class="guardian-hp"></span><div class="bar" aria-hidden="true"><i></i></div></div><span class="guardian-body"><i></i></span>';
    this.hpFill = this.el.querySelector(".bar i");
    this.hpText = this.el.querySelector(".guardian-hp");
    (typeof battleWorld !== "undefined" && battleWorld ? battleWorld : arena).append(this.el);
    this.updateHealthBar();
    this.render();
  }
  position() { return { x: this.x, y: this.y }; }
  render() {
    this.el.style.left = `${this.x}%`;
    this.el.style.top = `${this.y}%`;
  }
  acquireTarget() {
    let best = null, distance = Infinity;
    for (const enemy of game.enemies) {
      if (enemy.dead) continue;
      const nextDistance = RangeSystem.distance(this.position(), enemy.position());
      if (nextDistance <= CONFIG.guardianUnit.contactDistance && nextDistance < distance) {
        best = enemy; distance = nextDistance;
      }
    }
    return best;
  }
  update(dt) {
    if (this.dead) return;
    const target = this.acquireTarget();
    if (target && !this.resolved) {
      this.resolved = true;
      target.hit(this.hp + this.damage, this.position());
      this.remove();
      return;
    }
    this.distanceTravelled -= CONFIG.guardianUnit.speed * activeRouteCache.length / 100 * dt;
    this.pathProgress = Math.max(0, this.distanceTravelled / activeRouteCache.length);
    this.progress = this.pathProgress * 100;
    Object.assign(this, routePoint(this.pathProgress));
    if (this.progress <= 0) this.remove(); else this.render();
  }
  hit(damage) {
    this.hp -= damage;
    if (this.hp <= 0) this.remove(); else this.updateHealthBar();
  }
  remove() { this.dead = true; this.el.remove(); }
  updateHealthBar() {
    this.hpFill.style.width = `${Math.max(0, this.hp / this.maxHp * 100)}%`;
    this.hpText.textContent = `${Math.round(Math.max(0, this.hp)).toLocaleString()} / ${Math.round(this.maxHp).toLocaleString()}`;
  }
}
class EnemySpawner {
  constructor(game) {
    this.game = game;
    this.queue = [];
  }
  wave(n) {
    const early = EARLY_WAVE_COMPOSITIONS[n];
    if (early) {
      const bossType = early.voidGuide ? "voidGuide" : early.voidPriest ? "voidPriest" : null;
      if (bossType) {
        const preparation = bossType === "voidGuide" ? ["shadowRunner", "shadowRunner", "voidGolem"] : ["darkSlime", "darkSlime", "voidGolem"];
        preparation.forEach((type, index) => this.queue.push({ at: index * .12, type, lane: 0, bossPreparation: true }));
        this.queue.push({ at: .74, type: bossType, lane: 0, judgementTarget: true });
        return;
      }
      const multiplier = MODE_CONFIG[this.game.mode]?.enemyCountMultiplier || 1;
      const remaining = Object.fromEntries(Object.entries(early).map(([type, count]) => [type, count * multiplier]));
      const order = [];
      while (Object.values(remaining).some(Boolean)) Object.keys(remaining).forEach((type) => { if (remaining[type] > 0) { order.push(type); remaining[type]--; } });
      const judgementIndex = Math.floor(Math.random() * order.length);
      order.forEach((type, index) => this.queue.push({ at: index * .7, type, lane: 0, judgementTarget: index === judgementIndex }));
    } else if (WaveManager.isBoss(n, this.game.mode)) {
      this.queue.push({ at: 0, type: bossTypeForWave(n), lane: 0, judgementTarget: true });
    } else {
      const normalCount = Math.min(4 + Math.floor(n * 1.2), 25);
      let count = normalCount * (MODE_CONFIG[this.game.mode]?.enemyCountMultiplier || 1);
      const judgementIndex = Math.floor(Math.random() * count);
      for (let i = 0; i < count; i++)
        this.queue.push({
          at: i * 0.7,
          type: (i + n) % 3 === 0 ? "bug" : "slime",
          lane: 0,
          judgementTarget: i === judgementIndex,
        });
    }
  }
  update(dt) {
    this.queue.forEach((x) => (x.at -= dt));
    while (this.queue[0] && this.queue[0].at <= 0) {
      let x = this.queue.shift();
      this.game.enemies.push(new Enemy(x.type, x.lane, this.game.wave.wave, x.judgementTarget));
    }
  }
}
function bossTypeForWave(n) {
  // Legacy 21+ boss rotation remains intact; early-wave spawning is handled
  // authoritatively by EARLY_WAVE_COMPOSITIONS before this fallback is used.
  const landmark = ({ 10: "kingSlime", 20: "timeRunner", 30: "meteor", 40: "galaxySlayer" })[n];
  if (landmark) return landmark;
  return ["kingSlime", "timeRunner", "meteor", "galaxySlayer"][Math.floor(n / 5 - 2) % 4] || "drone";
}
class WaveManager {
  constructor(game) {
    this.game = game;
    this.wave = 0;
    this.left = 0;
  }
  static isBoss(n, mode = game?.mode || activeGameMode) {
    // Previous vertical schedule: n === 10 || (n >= 15 && n % 5 === 0).
    // Waves 1–20 now deliberately defer to the shared authoritative schedule.
    if (n <= 20) return n === 10 || n === 20;
    if (mode === VERTICAL_BETA) return n >= 25 && n % 5 === 0;
    return (
      (n <= 40 && n % 10 === 0) ||
      (n >= 45 && n <= 60 && n % 5 === 0) ||
      (n >= 62 && n % 2 === 0)
    );
  }
  update(dt) {
    this.left -= dt;
    if (this.left <= 0) {
      this.wave++;
      this.left += WaveManager.isBoss(this.wave, this.game.mode)
        ? CONFIG.bossWaveSeconds
        : CONFIG.waveSeconds;
      this.game.spawner.wave(this.wave);
      if (WaveManager.isBoss(this.wave, this.game.mode))
        UIManager.alert(`⚠ BOSS WAVE ${this.wave}`);
    }
  }
}

function nextWaveSummary(currentWave, mode = game?.mode || activeGameMode) {
  const n = currentWave + 1;
  if (EARLY_WAVE_COMPOSITIONS[n]) {
    const multiplier = MODE_CONFIG[mode]?.enemyCountMultiplier || 1;
    return Object.entries(EARLY_WAVE_COMPOSITIONS[n]).map(([type, count]) => ({ type, count: CONFIG.monsters[type].boss ? count : count * multiplier }));
  }
  if (WaveManager.isBoss(n, mode))
    return [{ type: bossTypeForWave(n), count: 1 }];
  const count = Math.min(4 + Math.floor(n * 1.2), 25) * (MODE_CONFIG[mode]?.enemyCountMultiplier || 1);
  let slime = 0, bug = 0;
  for (let i = 0; i < count; i++) (i + n) % 3 === 0 ? bug++ : slime++;
  return [{ type: "slime", count: slime }, { type: "bug", count: bug }].filter((entry) => entry.count);
}
class Star {
  constructor(type, tier = 1, x = 50, y = 50) {
    this.type = type;
    this.tier = tier;
    this.cooldown = Math.random() * 0.3;
    this.burstLeft = 3;
    this.lock = null;
    this.constellation = null;
    this.support = false;
    this.x = x;
    this.y = y;
    this.darkShotUntil = 0;
  }
  data() {
    return CONFIG.stars[this.type];
  }
}
function curvePoint(points, t) {
  const u = 1 - t;
  if (points.length === 3)
    return { x: u * u * points[0].x + 2 * u * t * points[1].x + t * t * points[2].x,
      y: u * u * points[0].y + 2 * u * t * points[1].y + t * t * points[2].y };
  return { x: u ** 3 * points[0].x + 3 * u * u * t * points[1].x + 3 * u * t * t * points[2].x + t ** 3 * points[3].x,
    y: u ** 3 * points[0].y + 3 * u * u * t * points[1].y + 3 * u * t * t * points[2].y + t ** 3 * points[3].y };
}
function buildRouteCache(map) {
  // Vertical battlefields render a 2.8x taller world. Measure route samples
  // in that same world metric so an equal travelled distance is independent
  // of whether a segment is horizontal, vertical, or curved.
  const xScale = 1;
  const yScale = map.worldHeightScale || 1;
  const samples = [{ ...map.spawn, distance: 0 }]; let total = 0; let previous = map.spawn;
  map.route.forEach((segment) => { for (let step = 1; step <= 80; step++) {
    const point = curvePoint(segment, step / 80); total += Math.hypot((point.x - previous.x) * xScale, (point.y - previous.y) * yScale);
    samples.push({ ...point, distance: total }); previous = point;
  }});
  return Object.freeze({ samples: Object.freeze(samples), length: total });
}
const ROUTE_CACHES = Object.freeze(Object.fromEntries([...Object.values(MAP_DEFINITIONS), EXPERIMENTAL_VERTICAL_MAP].map((map) => [map.id, buildRouteCache(map)])));
function setActiveMap(mapId) { activeMap = mapId === EXPERIMENTAL_VERTICAL_MAP.id ? EXPERIMENTAL_VERTICAL_MAP : MAP_DEFINITIONS[mapId] || MAP_DEFINITIONS.ORIGINAL_S; activeRouteCache = ROUTE_CACHES[activeMap.id]; return activeMap; }
setActiveMap(activeMap.id);
function routePoint(progressOrLane, legacyProgress) {
  const progress = Math.max(0, Math.min(1, legacyProgress === undefined ? progressOrLane : legacyProgress));
  const cache = activeRouteCache; const target = cache.length * progress;
  let low = 0, high = cache.samples.length - 1;
  while (low < high) { const mid = (low + high) >> 1; if (cache.samples[mid].distance < target) low = mid + 1; else high = mid; }
  const b = cache.samples[low], a = cache.samples[Math.max(0, low - 1)];
  const span = b.distance - a.distance; const ratio = span ? (target - a.distance) / span : 0;
  return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
}

function routePathData(map = activeMap) {
  const start = map.spawn;
  return `M${start.x} ${start.y}` + map.route.map((segment) =>
    `C${segment[1].x} ${segment[1].y} ${segment[2].x} ${segment[2].y} ${segment[3].x} ${segment[3].y}`
  ).join("");
}
class Targeting {
  static choose(star, enemies, pos) {
    let targets = (game.spatial?.near(pos, star.data().range) || enemies).filter(
      (e) =>
        !e.dead &&
        RangeSystem.contains(pos, e.position(), star.data().range),
    );
    if (!targets.length) return null;
    if (star.data().target === "lock" && targets.includes(star.lock))
      return star.lock;
    if (star.data().target === "random")
      return targets[Math.floor(Math.random() * targets.length)];
    if (star.data().target === "nearest")
      return targets.reduce((best, enemy) =>
        !best || Targeting.dist(pos, enemy.position()) < Targeting.dist(pos, best.position()) ? enemy : best, null);
    if (star.data().target === "highest")
      return targets.reduce((best, enemy) => !best || enemy.hp > best.hp ? enemy : best, null);
    if (star.data().target === "lowest")
      // SpatialGrid preserves the game's enemy ordering; strict comparison
      // therefore keeps the first enemy as the stable tie-breaker.
      return targets.reduce((best, enemy) => !best || enemy.hp < best.hp ? enemy : best, null);
    if (star.data().target === "progress")
      return targets.reduce((best, enemy) => !best || enemy.distanceTravelled > best.distanceTravelled ? enemy : best, null);
    return targets.reduce((best, enemy) => !best || enemy.progress > best.progress ? enemy : best, null);
  }
  static dist(a, b) {
    return RangeSystem.distance(a, b);
  }
}
class RangeSystem {
  static refresh() {
    // clientWidth/clientHeight describe the inner box used by the absolutely
    // positioned SVG layers. getBoundingClientRect() includes the arena border
    // and therefore was not the coordinate space used by viewBox 0 0 100 100.
    const world = typeof battleWorld !== "undefined" && battleWorld ? battleWorld : arena;
    const rect = world.getBoundingClientRect?.() || arena.getBoundingClientRect?.() || {};
    this.cachedMetrics = {
      width: world.clientWidth || arena.clientWidth || rect.width || 100,
      height: world.clientHeight || arena.clientHeight || rect.height || 100,
    };
  }
  static metrics() {
    if (!this.cachedMetrics) this.refresh();
    return this.cachedMetrics || { width: 100, height: 100 };
  }
  static radius(range) {
    return (this.metrics().width * CONFIG.rangeUnit * range) / 100;
  }
  static distance(a, b) {
    const { width, height } = this.metrics();
    return Math.hypot(
      ((a.x - b.x) * width) / 100,
      ((a.y - b.y) * height) / 100,
    );
  }
  static contains(a, b, range) {
    return this.distance(a, b) <= this.radius(range);
  }
}
class SpatialGrid {
  constructor(cellSize = 10) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }
  key(x, y) { return `${x}|${y}`; }
  rebuild(enemies) {
    this.cells.clear();
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const key = this.key(Math.floor(enemy.x / this.cellSize), Math.floor(enemy.y / this.cellSize));
      let cell = this.cells.get(key);
      if (!cell) this.cells.set(key, (cell = []));
      cell.push(enemy);
    }
  }
  near(position, range) {
    const { width, height } = RangeSystem.metrics();
    const xRadius = CONFIG.rangeUnit * range;
    const yRadius = (xRadius * width) / height;
    const minX = Math.floor((position.x - xRadius) / this.cellSize);
    const maxX = Math.floor((position.x + xRadius) / this.cellSize);
    const minY = Math.floor((position.y - yRadius) / this.cellSize);
    const maxY = Math.floor((position.y + yRadius) / this.cellSize);
    const candidates = [];
    for (let x = minX; x <= maxX; x++)
      for (let y = minY; y <= maxY; y++) {
        const cell = this.cells.get(this.key(x, y));
        if (cell) candidates.push(...cell);
      }
    return candidates;
  }
}
const CONSTELLATION_BEHAVIORS = Object.freeze({
  [CONSTELLATION_IDS.DAWN]: Object.freeze({
    createRuntime: (constellation) => ({
      componentStageSum: constellation.componentStageSum,
      sameTargetId: null,
      sameTargetHits: 0,
      dawnKillProgress: 0,
    }),
    onTargetChanged(constellation, target) {
      constellation.runtime.sameTargetId = target;
      constellation.runtime.sameTargetHits = 0;
    },
    attack(constellation, target, origin) {
      const damage = constellation.currentDamage();
      target.hit(damage, origin, constellation);
      const runtime = constellation.runtime;
      runtime.sameTargetHits++;
      if (runtime.sameTargetHits === constellation.definition.specialHits) {
        if (!target.dead) {
          const specialDamage = damage * constellation.definition.specialMultiplier;
          UIManager.dawnSpecial(target.position(), specialDamage, origin);
          target.hit(specialDamage, origin, constellation);
        }
        runtime.sameTargetHits = 0;
      }
    },
  }),
  [CONSTELLATION_IDS.RADIANCE]: Object.freeze({
    createRuntime: (constellation) => ({
      componentStageSum: constellation.componentStageSum,
      radianceKills: 0,
      radianceKillBonus: 0,
    }),
    attack(constellation, first, origin) { constellation.chainAttack(first, origin); },
  }),
  [CONSTELLATION_IDS.SAGITTARIUS]: Object.freeze({
    createRuntime: () => ({
      componentStageSum: 0, focusTargetId: null, focusHits: 0, transcendenceUntil: 0,
    }),
    onTargetChanged(constellation, target) {
      constellation.runtime.focusTargetId = target;
      constellation.runtime.focusHits = 0;
    },
    attack(constellation, target, origin) {
      const runtime = constellation.runtime;
      const now = game.gameTime;
      const transcending = runtime.transcendenceUntil > now;
      const nextFocusHit = runtime.focusHits + 1;
      const focusMultiplier = transcending ? 1 : nextFocusHit >= 40 ? 21 : nextFocusHit >= 20 ? 11 : 1;
      target.hit(constellation.currentDamage(focusMultiplier), origin, constellation);
      if (!transcending) runtime.focusHits = nextFocusHit;
      if (runtime.focusHits >= 60 && runtime.transcendenceUntil <= now) {
        runtime.transcendenceUntil = now + 10;
        runtime.focusHits = 0;
        game.attackBuffUntil = Math.max(game.attackBuffUntil, runtime.transcendenceUntil);
      }
    },
  }),
  [CONSTELLATION_IDS.ASTROLOGER]: Object.freeze({
    createRuntime: () => ({ componentStageSum: 0, lastDivinationResult: null }),
    attack(constellation, target, origin) {
      target.hit(constellation.currentDamage(), origin, constellation);
      const active = game.players.reduce(
        (total, player) => total + player.manager.activeConstellations().length, 0,
      );
      constellation.owner.player.resources.starlight += 3 + active;
      game.markDirty();
    },
  }),
  [CONSTELLATION_IDS.GUARDIAN]: Object.freeze({
    createRuntime: () => ({ componentStageSum: 0, summonCooldown: CONFIG.guardianUnit.summonCooldown }),
    update(constellation, dt) {
      constellation.runtime.summonCooldown -= dt;
      if (constellation.runtime.summonCooldown > 0) return;
      constellation.runtime.summonCooldown += CONFIG.guardianUnit.summonCooldown;
      game.summonGuardian(constellation.componentStageSum);
    },
    attack(constellation, target, origin) {
      target.hit(constellation.currentDamage(), origin, constellation);
    },
  }),
  [CONSTELLATION_IDS.TWILIGHT]: Object.freeze({
    createRuntime: () => ({ killCount: 0, transcendenceUntil: 0, areaElement: null, lastTimeLabel: null }),
    update(constellation) {
      const runtime = constellation.runtime;
      if (runtime.transcendenceUntil > game.gameTime) {
        constellation.updateTwilightArea();
        const timeLabel = Math.ceil((runtime.transcendenceUntil - game.gameTime) * 10);
        if (timeLabel !== runtime.lastTimeLabel) {
          runtime.lastTimeLabel = timeLabel;
          game.markDirty();
        }
        for (const enemy of game.spatial.near(constellation.owner.pos(constellation.center), constellation.effectiveRange())) {
          if (!enemy.dead && enemy.hp <= enemy.maxHp * 0.10 &&
              RangeSystem.contains(constellation.owner.pos(constellation.center), enemy.position(), constellation.effectiveRange()))
            enemy.execute(constellation);
        }
        return;
      }
      if (runtime.transcendenceUntil) constellation.endTwilightTranscendence();
      if (runtime.killCount >= constellation.definition.transcendenceKills)
        constellation.startTwilightTranscendence();
    },
    attack(constellation, target, origin) {
      const weakened = target.hp <= target.maxHp * 0.50;
      target.hit(constellation.currentDamage(weakened ? 2 : 1), origin, constellation);
    },
    dispose(constellation) { constellation.endTwilightTranscendence(); },
  }),
  [CONSTELLATION_IDS.BOND]: Object.freeze({
    createRuntime: (constellation) => ({
      componentStageSum: constellation.componentStageSum, bindChance: constellation.definition.bindChance, offerings: 0,
    }),
    attack(constellation, target, origin) {
      target.hit(constellation.currentDamage(), origin, constellation);
      UIManager.bondStrike?.(target.position());
      if (!target.dead && Math.random() < constellation.runtime.bindChance) {
        target.applyBind(constellation.definition.bindDuration);
        UIManager.bondApplied?.(target.position());
      }
    },
  }),
  [CONSTELLATION_IDS.LINK]: Object.freeze({
    createRuntime: (constellation) => ({
      componentStageSum: constellation.componentStageSum, linkedStageSum: 0, thresholdBonusCount: 0,
    }),
    update(constellation) { constellation.refreshLinkState(); },
    attack(constellation, target, origin) {
      target.hit(constellation.currentDamage(), origin, constellation);
    },
  }),
  [CONSTELLATION_IDS.STRIKE]: Object.freeze({
    createRuntime: (constellation) => ({ componentStageSum: constellation.componentStageSum, strikeStacks: 0 }),
    attack(constellation, target, origin) {
      if (target.hit(constellation.strikeDamageFor(target), origin, constellation)) { constellation.runtime.strikeStacks++; game.markDirty(); }
    },
  }),
  [CONSTELLATION_IDS.HORIZON]: Object.freeze({
    createRuntime: (constellation) => ({ componentStageSum: constellation.componentStageSum, inheritedDefinitionId: null, inheritedRuntime: null }),
    update() {}, attack() {},
  }),
  [CONSTELLATION_IDS.JUDGEMENT]: Object.freeze({
    createRuntime: (constellation) => ({ componentStageSum: constellation.componentStageSum }),
    attack(constellation, target, origin) {
      // Snapshot immediately before the base hit: execution damage always
      // follows current HP (including bosses), never maximum HP.
      const judgementDamage = target.judgementTarget ? target.hp * 0.035 : 0;
      target.hit(constellation.currentDamage(), origin, constellation);
      // Additional judgement damage is deliberately source-less: it cannot
      // recursively trigger constellation on-hit or kill abilities.
      if (judgementDamage > 0 && !target.dead)
        target.hit(judgementDamage, origin, null, true);
    },
  }),
});
class Constellation {
  constructor(owner, center, members, definitionId, connectionOrder = members) {
    this.owner = owner;
    this.center = center;
    this.members = [...members];
    this.connectionOrder = [...connectionOrder];
    this.originalComponents = members.map((index) => {
      const star = owner.stars[index];
      return { index, type: star.type, tier: star.tier, x: star.x, y: star.y, owner: owner.player.index };
    });
    this.definitionId = definitionId;
    this.definition = CONSTELLATION_DEFINITIONS[definitionId];
    this.behavior = CONSTELLATION_BEHAVIORS[definitionId];
    if (!this.definition || !this.behavior) throw new Error(`Unknown constellation: ${definitionId}`);
    this.componentStageSum = members.reduce((sum, index) => sum + owner.stars[index].tier, 0);
    this.cooldown = 0;
    this.target = null;
    this.runtime = this.behavior.createRuntime(this);
    // Keep the construction input on every instance's runtime state. Behavior
    // factories may initialize additional, constellation-specific progress.
    this.runtime.componentStageSum = this.componentStageSum;
    members.forEach((index) => (owner.stars[index].support = index !== center));
    owner.stars[center].constellation = this;
  }
  resetTarget() {
    this.target = null;
    this.behavior.onTargetChanged?.(this, null);
  }
  attack(dt) {
    this.behavior.update?.(this, dt);
    if (this.definition.supportOnly) {
      if (!this.runtime.inheritedDefinitionId || this.inheritanceRunning) return;
      const inheritedDefinition = CONSTELLATION_DEFINITIONS[this.runtime.inheritedDefinitionId];
      const inheritedBehavior = CONSTELLATION_BEHAVIORS[this.runtime.inheritedDefinitionId];
      const saved = { definition: this.definition, behavior: this.behavior, runtime: this.runtime };
      this.definition = inheritedDefinition; this.behavior = inheritedBehavior; this.runtime = saved.runtime.inheritedRuntime; this.inheritanceRunning = true;
      this.attack(dt);
      saved.runtime.inheritedRuntime = this.runtime;
      this.definition = saved.definition; this.behavior = saved.behavior; this.runtime = saved.runtime; this.inheritanceRunning = false;
      return;
    }
    this.cooldown -= dt;
    const position = this.owner.pos(this.center);
    if (this.definitionId === CONSTELLATION_IDS.JUDGEMENT) {
      const marked = game.enemies.find((enemy) => !enemy.dead && enemy.judgementTarget &&
        RangeSystem.contains(position, enemy.position(), this.effectiveRange()));
      if (marked && marked !== this.target) {
        this.target = marked;
        this.behavior.onTargetChanged?.(this, marked);
      }
    }
    if (this.target && (this.target.dead || !RangeSystem.contains(position, this.target.position(), this.effectiveRange())))
      this.resetTarget();
    const nextSpeed = this.effectiveAttackSpeed(this.target);
    const previousSpeed = this.runtime.currentAttackSpeed || this.definition.attackSpeed;
    if (nextSpeed !== previousSpeed && this.cooldown > 0)
      this.cooldown *= previousSpeed / nextSpeed;
    this.runtime.currentAttackSpeed = nextSpeed;
    if (this.cooldown > 0) return;
    const target = this.target || Targeting.choose({ data: () => ({
      range: this.effectiveRange(), target: this.definition.targeting,
    }) }, game.enemies, position);
    if (!target) return;
    if (target !== this.target) {
      this.target = target;
      this.behavior.onTargetChanged?.(this, target);
    }
    this.behavior.attack(this, target, position);
    if (this.inheritedByHorizon && Math.random() < .15 && !target.dead)
      this.behavior.attack(this, target, position);
    if (this.definition.targeting === "random" || this.definitionId === CONSTELLATION_IDS.RADIANCE) this.resetTarget();
    else if (target.dead) this.resetTarget();
    const attackSpeed = this.effectiveAttackSpeed(target);
    this.cooldown = 1 / attackSpeed;
  }
  currentDamage(localMultiplier = 1) {
    const allyMultiplier = game.attackBuffUntil > game.gameTime ? 11 : 1;
    const killMultiplier = this.definitionId === CONSTELLATION_IDS.RADIANCE
      ? 1 + this.runtime.radianceKillBonus
      : 1;
    const linkMultiplier = this.definitionId === CONSTELLATION_IDS.LINK ? this.linkDamageMultiplier() : 1;
    const level = playerProgress.constellationCollection[this.definitionId]?.level || 1;
    return getStageScaledDamage(this) * constellationLevelDamageMultiplier(level) * linkMultiplier * killMultiplier * allyMultiplier * localMultiplier * relicEffect("BLESSING_OF_STARS");
  }
  strikeDamageFor(target, bonusMultiplier = 1) {
    return this.currentDamage(bonusMultiplier) * (target.isBoss ? 2.2 : .85);
  }
  unleashStrike() {
    if (this.definitionId !== CONSTELLATION_IDS.STRIKE || this.runtime.strikeStacks <= 0) return false;
    const origin = this.owner.pos(this.center);
    const target = Targeting.choose({ data: () => ({ range: this.effectiveRange(), target: this.definition.targeting }) }, game.enemies, origin);
    if (!target) return false;
    const stacks = this.runtime.strikeStacks;
    if (!target.hit(this.strikeDamageFor(target, 1 + stacks * .0035), origin, this)) return false;
    this.runtime.strikeStacks = 0; UIManager.strikeBurst(origin, target.position(), stacks); game.markDirty(); return true;
  }
  linkedConstellationStageSum() {
    if (Number.isFinite(game?.activeConstellationStageSum))
      return Math.max(0, game.activeConstellationStageSum - this.componentStageSum);
    return (game?.players || []).reduce((sum, player) => sum + player.manager.activeConstellations()
      .reduce((subtotal, item) => subtotal + (item === this ? 0 : item.componentStageSum), 0), 0);
  }
  linkDamageMultiplier() {
    const linkedStageSum = this.linkedConstellationStageSum();
    const thresholdBonusCount = [10, 20, 30].filter((threshold) => linkedStageSum >= threshold).length;
    return Math.max(1, linkedStageSum) * (1 + thresholdBonusCount);
  }
  refreshLinkState() {
    if (this.definitionId !== CONSTELLATION_IDS.LINK) return;
    const linkedStageSum = this.linkedConstellationStageSum();
    const thresholdBonusCount = [10, 20, 30].filter((threshold) => linkedStageSum >= threshold).length;
    if (linkedStageSum === this.runtime.linkedStageSum && thresholdBonusCount === this.runtime.thresholdBonusCount) return;
    this.runtime.linkedStageSum = linkedStageSum;
    this.runtime.thresholdBonusCount = thresholdBonusCount;
    const element = this.centerElement();
    element?.classList.toggle("link-tier-10", linkedStageSum >= 10);
    element?.classList.toggle("link-tier-20", linkedStageSum >= 20);
    element?.classList.toggle("link-tier-30", linkedStageSum >= 30);
    element?.classList.add("link-updated");
    game.simulationTimeout?.(() => element?.classList.remove("link-updated"), 420);
    game.markDirty?.();
  }
  registerKill() {
    if (this.definitionId === CONSTELLATION_IDS.TWILIGHT) {
      this.runtime.killCount++;
      if (this.runtime.transcendenceUntil <= game.gameTime &&
          this.runtime.killCount >= this.definition.transcendenceKills)
        this.startTwilightTranscendence();
      game.markDirty();
      return;
    }
    if (this.definitionId === CONSTELLATION_IDS.RADIANCE) {
      this.runtime.radianceKills++;
      this.runtime.radianceKillBonus = this.runtime.radianceKills * 0.002;
      game.markDirty();
      return;
    }
    if (this.definitionId !== CONSTELLATION_IDS.DAWN) return;
    this.runtime.dawnKillProgress++;
    if (this.runtime.dawnKillProgress < 5) {
      game.markDirty();
      return;
    }
    this.runtime.dawnKillProgress = 0;
    const origin = this.owner.pos(this.center);
    const livingEnemies = game.enemies.filter((enemy) => !enemy.dead);
    UIManager.dawnMoonfall(origin, livingEnemies);
    // No source is passed for moonfall: its kills receive rewards normally,
    // but cannot count toward (or recursively trigger) DAWN's direct-kill skill.
    livingEnemies.forEach((enemy) => enemy.hit(enemy.hp * 0.20, origin));
    game.markDirty();
  }
  effectiveRange() {
    if (this.definitionId === CONSTELLATION_IDS.TWILIGHT && this.runtime.transcendenceUntil > game.gameTime)
      return this.definition.transcendenceRange;
    return this.definition.range;
  }
  effectiveAttackSpeed(target = this.target) {
    const resonance = Math.min(.20, (game?.activeConstellationCount || 0) * getRelicEffect("COSMIC_RESONANCE"));
    const globalModifier = (this.owner.alliedAttackSpeedModifier?.() || 1) * relicMultiplier("SONG_OF_CONSTELLATIONS") * (1 + resonance);
    const levelBonus = constellationLevelAttackSpeedBonus(playerProgress.constellationCollection[this.definitionId]?.level || 1);
    if (this.definitionId === CONSTELLATION_IDS.TWILIGHT && target && !target.dead && target.hp <= target.maxHp * 0.50)
      return (this.definition.attackSpeed + levelBonus) * globalModifier * 2;
    return (this.definition.attackSpeed + levelBonus) * globalModifier;
  }
  startTwilightTranscendence() {
    if (this.definitionId !== CONSTELLATION_IDS.TWILIGHT || this.runtime.transcendenceUntil > game.gameTime) return;
    this.runtime.killCount = 0;
    this.runtime.transcendenceUntil = game.gameTime + this.definition.transcendenceDuration;
    const area = document.createElement("div");
    area.className = "twilight-area";
    area.setAttribute("aria-hidden", "true");
    (typeof battleWorld !== "undefined" && battleWorld ? battleWorld : arena).append(area);
    this.runtime.areaElement = area;
    this.centerElement()?.classList.add("twilight-transcending");
    this.updateTwilightArea();
    UIManager.alert("황혼의 자리 초월!");
    game.markDirty();
  }
  updateTwilightArea() {
    const area = this.runtime.areaElement;
    if (!area) return;
    const position = this.owner.pos(this.center);
    const diameter = RangeSystem.radius(this.definition.transcendenceRange) * 2;
    area.style.left = `${position.x}%`;
    area.style.top = `${position.y}%`;
    area.style.width = `${diameter}px`;
    area.style.height = `${diameter}px`;
  }
  endTwilightTranscendence() {
    if (this.definitionId !== CONSTELLATION_IDS.TWILIGHT) return;
    this.runtime.transcendenceUntil = 0;
    this.runtime.areaElement?.remove();
    this.runtime.areaElement = null;
    this.centerElement()?.classList.remove("twilight-transcending");
    game.markDirty();
  }
  centerElement() {
    return this.owner.field.querySelector(`[data-index="${this.center}"]`);
  }
  chainAttack(first, origin) {
    const hit = new Set();
    const points = [origin];
    let target = first;
    let from = origin;
    while (target && hit.size < this.runtime.componentStageSum) {
      const targetPosition = target.position();
      target.hit(this.currentDamage(), from, this, true);
      points.push(targetPosition);
      hit.add(target);
      from = targetPosition;
      let nearestDistance = Infinity;
      target = null;
      for (const enemy of game.enemies) {
        if (enemy.dead || hit.has(enemy)) continue;
        const distance = RangeSystem.distance(from, enemy.position());
        if (distance < nearestDistance) {
          nearestDistance = distance;
          target = enemy;
        }
      }
    }
    UIManager.chainPath?.(points);
  }
  release() {
    this.behavior.dispose?.(this);
    if (this.definitionId === CONSTELLATION_IDS.HORIZON && this.inheritedTarget) {
      const oldTarget = this.inheritedTarget; this.inheritedTarget = null;
      oldTarget.inheritedByHorizon = game.players.some((p) => p.manager.activeConstellations().some((c) => c !== this && c.definitionId === CONSTELLATION_IDS.HORIZON && c.inheritedTarget === oldTarget));
    }
    this.originalComponents.forEach((saved) => {
      const star = this.owner.stars[saved.index];
      Object.assign(star, { type: saved.type, tier: saved.tier, x: saved.x, y: saved.y });
      star.support = false;
      star.constellation = null;
    });
    this.connectionOrder.length = 0;
    game?.recomputeCombatCaches?.();
  }
}
class StarManager {
  constructor(player, field, maxStars = MAX_STARS_PER_PLAYER) {
    this.player = player;
    this.field = field;
    this.stars = Array(maxStars).fill(null);
    this.selected = [];
    this.swapMode = false;
    this.zodiacMode = false;
    for (let i = 0; i < maxStars; i++) {
      let b = document.createElement("button");
      b.className = "star-node";
      b.dataset.index = i;
      b.hidden = true;
      bindPointerTap(b, (event) => {
        event.stopPropagation();
        this.tap(i);
      });
      b.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.tap(i);
        }
      });
      field.append(b);
    }
  }
  pos(i) {
    const star = this.stars[i];
    return star ? { x: star.x, y: star.y } : { x: 0, y: 0 };
  }
  activeConstellations() {
    return this.stars.reduce((constellations, star) => {
      if (star?.constellation && !constellations.includes(star.constellation))
        constellations.push(star.constellation);
      return constellations;
    }, []);
  }
  greenStarCount() {
    return this.stars.filter((star) => star?.type === "green" && !star.support && !star.constellation).length;
  }
  alliedAttackSpeedModifier() {
    if (Number.isFinite(game?.greenSupportBonus)) return 1 + game.greenSupportBonus;
    const sum = game?.players?.reduce((total, player) => total + player.manager.stars
      .reduce((stages, star) => stages + (star?.type === "green" && !star.support && !star.constellation ? star.tier : 0), 0), 0) || 0;
    if (!sum) return 1;
    const level = playerProgress.starCollection.GREEN?.level || 1;
    return 1 + normalStarSpecial("green", 1, level, { green: sum }).attackSpeedBonus;
  }
  clearOthers() {
    game.players.forEach((p) => {
      if (p.manager !== this) p.manager.exitModes();
    });
  }
  emptySlots() {
    return this.stars.reduce((empty, star, index) => {
      if (!star) empty.push(index);
      return empty;
    }, []);
  }
  isValidPlacement(x, y) {
    const metrics = RangeSystem.metrics();
    const edge = 28;
    const px = (x * metrics.width) / 100, py = (y * metrics.height) / 100;
    if (px < edge || px > metrics.width - edge || py < edge || py > metrics.height - edge) return false;
    const starRadius = Math.min(27, Math.max(19, metrics.width * .055));
    const roadClearance = activeMap.roadWidth / 2 + starRadius + activeMap.placementPadding;
    for (let step = 0; step <= 240; step++) {
      const point = routePoint(step / 240);
      if (RangeSystem.distance({ x, y }, point) < roadClearance) return false;
    }
    return !game.players.some((player) => player.manager.stars.some((star) =>
      star && RangeSystem.distance({ x, y }, star) < 46));
  }
  summonAt(x, y) {
    if (this.emptySlots()[0] === undefined) {
      UIManager.hint(`별을 최대 ${effectiveMaxStars()}개까지 배치할 수 있습니다.`);
      return false;
    }
    if (this.zodiacMode || !this.isValidPlacement(x, y)) {
      if (!this.zodiacMode) UIManager.hint("길과 다른 별을 피해 배치하세요.");
      return false;
    }
    if (!this.player.resources.can(CONFIG.summonCost)) {
      UIManager.hint("별빛이 부족합니다.");
      return false;
    }
    const i = this.emptySlots()[0];
    if (i === undefined) return false;
    this.stars[i] = new Star(STAR_KEYS[Math.floor(Math.random() * STAR_KEYS.length)], 1, x, y);
    this.player.resources.spend(CONFIG.summonCost);
    this.clearNormalSelection();
    game.recomputeCombatCaches?.();
    game.render();
    UIManager.summonEffect?.(this, i);
    return true;
  }
  tap(i) {
    if (!this.stars[i]) return;
    if (this.horizonFocusSource) {
      const target = this.stars[i].constellation;
      if (!target || target.definitionId === CONSTELLATION_IDS.HORIZON || target === this.horizonFocusSource) return UIManager.hint("다른 활성 별자리를 선택하세요.");
      const horizon = this.horizonFocusSource;
      if (horizon.inheritedTarget) horizon.inheritedTarget.inheritedByHorizon = game.players.some((p) => p.manager.activeConstellations().some((c) => c !== horizon && c.definitionId === CONSTELLATION_IDS.HORIZON && c.inheritedTarget === horizon.inheritedTarget));
      horizon.inheritedTarget = target;
      horizon.runtime.inheritedDefinitionId = target.definitionId;
      horizon.runtime.inheritedRuntime = target.behavior.createRuntime(horizon);
      target.inheritedByHorizon = true;
      this.horizonFocusSource = null; UIManager.horizonLink(horizon.owner.pos(horizon.center), target.owner.pos(target.center)); UIManager.hint(`${target.definition.name}의 힘을 계승했습니다.`); game.render(); return;
    }
    if (this.swapMode && this.selected.length === 1 && this.selected[0] !== i)
      return SwapSystem.execute(this, this.selected[0], i);
    if (this.zodiacMode) {
      let at = this.selected.indexOf(i);
      if (at >= 0) this.selected.splice(at, 1);
      else this.selected.push(i);
      ZodiacSystem.describeSelection(this);
    } else {
      this.selectStar(i);
    }
    game.render();
  }
  // Selection is intentionally state-only. Exchange is a separate explicit
  // command so rendering a contextual button can never spend currency.
  selectStar(i) {
    if (!this.stars[i]) return false;
    this.clearOthers();
    this.selected = [i];
    this.swapMode = false;
    return true;
  }
  exchangeSelectedStar() {
    if (this.selected.length !== 1) return false;
    return SwapSystem.execute(this, this.selected[0]);
  }
  selectOnly(i) {
    this.selected = [i];
  }
  clearNormalSelection() {
    if (this.zodiacMode || (!this.selected.length && !this.swapMode)) return false;
    this.selected = [];
    this.swapMode = false;
    return true;
  }
  exitModes() {
    this.swapMode = false;
    this.zodiacMode = false;
    this.selected = [];
    this.horizonFocusSource = null;
  }
  update(dt) {
    this.stars.forEach((s, i) => {
      if (!s || s.support) return;
      if (s.constellation) {
        s.constellation.attack(dt);
        return;
      }
      if (s.data().target === "none") return;
      const permanentLevel = playerProgress.starCollection[s.type.toUpperCase()]?.level || 1;
      const purpleBonus = s.type === "purple" ? (game?.purpleStageSum || 0) / 10 : 0;
      const levelSpeedMultiplier = (s.data().rate + starLevelAttackSpeedBonus(permanentLevel) + purpleBonus) / s.data().rate;
      const baseModifier = this.alliedAttackSpeedModifier() * relicMultiplier("SONG_OF_STARS") * levelSpeedMultiplier;
      const unmodifiedRate = s.data().rate * baseModifier;
      const effectiveRate = Math.max(.1, unmodifiedRate - (s.darkShotUntil > game.gameTime ? 2 : 0));
      const attackSpeedModifier = effectiveRate / s.data().rate;
      const previousModifier = s.attackSpeedModifier || 1;
      if (previousModifier !== attackSpeedModifier && s.cooldown > 0) s.cooldown *= previousModifier / attackSpeedModifier;
      s.attackSpeedModifier = attackSpeedModifier;
      s.cooldown -= dt;
      if (s.cooldown > 0) return;
      const position = this.pos(i);
      const effectiveRange = s.data().range;
      if (s.lock && (s.lock.dead || !RangeSystem.contains(position, s.lock.position(), effectiveRange)))
        s.lock = null;
      let t = s.lock || Targeting.choose(s, game.enemies, position);
      if (t) {
        s.lock = t;
        let damage = s.data().damage * CONFIG.tierDamage[s.tier - 1] * starLevelDamageMultiplier(permanentLevel) *
          (game.attackBuffUntil > game.gameTime ? 11 : 1) * relicMultiplier("BLESSING_OF_PLANETS");
        t.hit(damage, position);
        const special = normalStarSpecial(s.type, s.tier, permanentLevel, game?.normalStarStageSums);
        if (s.type === "blue" && !t.dead) t.applySlow(special.slowPercent, special.duration);
        else if (s.type === "yellow" && !t.dead) t.applyLight(special.lightPercent, special.duration);
        else if (s.type === "orange" && !t.dead) t.applyBurn(damage * special.damageRatio, special.burnInterval, special.duration, position);
        else if (s.type === "red") {
          const nearby = game.spatial?.near(t.position(), special.areaRange) || game.enemies;
          nearby.forEach((enemy) => {
            if (enemy !== t && !enemy.dead && RangeSystem.contains(t.position(), enemy.position(), special.areaRange)) enemy.hit(damage, position);
          });
          UIManager.areaImpact?.(t.position(), special.areaRange);
        }
        if (s.data().target === "burst") {
          s.burstLeft--;
          if (s.burstLeft > 0) s.cooldown = CONFIG.whiteBurstInterval / attackSpeedModifier;
          else {
            s.burstLeft = 3;
            s.cooldown = special.rest;
          }
        } else s.cooldown = 1 / (s.data().rate * attackSpeedModifier);
        if (t.dead || s.data().target === "random") s.lock = null;
      }
    });
  }
  render() {
    let selectedConstellation =
      this.selected.length === 1
        ? this.stars[this.selected[0]]?.constellation
        : null;
    [...this.field.children].forEach((el, i) => {
      let s = this.stars[i],
        picked = this.selected.includes(i);
      el.hidden = !s;
      if (s) {
        el.style.left = `${s.x}%`;
        el.style.top = `${s.y}%`;
      }
      el.className =
        "star-node" +
        (picked && !this.zodiacMode ? " selected" : "") +
        (picked && this.zodiacMode ? " zodiac-picked" : "") +
        (s && s.support ? " support" : "") +
        (s && s.constellation ? " constellation" : "") +
        (s && !s.constellation ? ` normal-${s.type}` : "") +
        (s?.constellation ? ` constellation-${s.constellation.definitionId.toLowerCase()}` : "") +
        (s?.constellation?.center === i ? " constellation-center" : "") +
        (selectedConstellation?.members.includes(i)
          ? " constellation-linked"
          : "");
      el.innerHTML = s
        ? renderNormalStarVisual(s, picked && this.zodiacMode ? this.selected.indexOf(i) + 1 : 0,
          s.constellation?.center === i ? s.constellation.definitionId : "")
        : "";
      el.setAttribute(
        "aria-label",
        s
          ? `${s.data().name} 별 ${s.tier}단계${picked ? " 선택됨" : ""}`
          : `빈 별 위치 ${i + 1}`,
      );
      el.setAttribute("aria-pressed", picked);
    });
  }
}

// The four silhouettes deliberately progress from soft mascot-like geometry to
// a faceted celestial relic. Decorations stay inside the node's visual bounds
// so they never affect placement, selection, range, or combat hit testing.
function symmetricSparkles(distance, size) {
  return [0, 90, 180, 270].map((angle) =>
    `<path class="star-sparkle" d="M50 ${50 - distance - size}l${size} ${size} ${-size} ${size} ${-size} ${-size}Z" transform="rotate(${angle} 50 50)"/>`
  ).join("");
}
function starFinalOrnaments(type) {
  const ornaments = {
    blue: '<g class="type-ornament crystal-ornament"><path d="M18 23l5-9 5 9-5 10Zm54 0 5-9 5 9-5 10Z"/><path d="M14 67l4-7 4 7-4 8Zm64 0 4-7 4 7-4 8Z"/></g>',
    white: '<g class="type-ornament prism-ornament"><path d="M20 25l4-8 4 8-4 8Zm52 0 4-8 4 8-4 8Z"/><path d="M17 69l3-6 3 6-3 7Zm60 0 3-6 3 6-3 7Z"/></g>',
    yellow: '<g class="type-ornament planet-ornament"><circle cx="18" cy="62" r="6"/><ellipse cx="18" cy="62" rx="10" ry="3"/><circle cx="82" cy="38" r="6"/><ellipse cx="82" cy="38" rx="10" ry="3"/></g>',
    orange: '<g class="type-ornament flame-ornament"><path d="M24 67c-11-7-10-18-3-26-1 8 4 10 7 15 3 5 1 9-4 11Zm52 0c11-7 10-18 3-26 1 8-4 10-7 15-3 5-1 9 4 11Z"/><path class="ornament-highlight" d="M19 58c-7-6-6-13-2-18 0 6 3 8 5 11Zm62 0c7-6 6-13 2-18 0 6-3 8-5 11Z"/></g>',
    red: '<g class="type-ornament nova-ornament"><path d="M50 2l5 18 12-12-3 20 19-7-13 16 21 1-19 10 18 9-21 2 13 16-19-7 3 20-12-12-5 18-5-18-12 12 3-20-19 7 13-16-21-2 18-9-19-10 21-1-13-16 19 7-3-20 12 12Z"/><circle cx="50" cy="48" r="9"/></g>',
    purple: '<g class="type-ornament moon-ornament"><path d="M22 19a9 9 0 1 0 8 14 7 7 0 1 1-8-14Zm56 0a9 9 0 1 1-8 14 7 7 0 1 0 8-14Z"/></g>',
    green: '<g class="type-ornament leaf-ornament"><path d="M17 35c1-8 6-12 13-11-1 7-5 12-13 11Zm66 0c-1-8-6-12-13-11 1 7 5 12 13 11ZM20 70c2-7 7-10 13-8-2 7-7 10-13 8Zm60 0c-2-7-7-10-13-8 2 7 7 10 13 8Z"/></g>',
  };
  return ornaments[type] || "";
}
function starStageThreeOrnaments(type) {
  if (type === "orange") return '<g class="type-ornament flame-ornament stage-three-ornament"><path d="M20 69c-7-5-6-12-2-17 0 5 3 7 5 10 1 3 0 5-3 7Zm60 0c7-5 6-12 2-17 0 5-3 7-5 10-1 3 0 5 3 7Z"/></g>';
  if (type === "red") return '<g class="type-ornament nova-ornament stage-three-ornament"><path d="M50 2l4 16 10-10-2 17 16-6-11 13 18 1-16 8 15 8-18 1 11 13-16-6 2 17-10-10-4 16-4-16-10 10 2-17-16 6 11-13-18-1 15-8-16-8 18-1-11-13 16 6-2-17 10 10Z"/></g>';
  if (type === "green") return '<g class="type-ornament leaf-ornament stage-three-ornament"><path d="M17 31c2-7 7-9 12-7-2 6-6 9-12 7Zm66 0c-2-7-7-9-12-7 2 6 6 9 12 7Z"/></g>';
  return "";
}
function normalStarGlyph(tier, type = "white") {
  const fourRay = '<path class="star-body" d="M50 18 56 44 82 50 56 56 50 82 44 56 18 50 44 44Z"/>';
  const eightRay = '<path class="star-body" d="M50 15 56 39 75 25 61 44 85 50 61 56 75 75 56 61 50 85 44 61 25 75 39 56 15 50 39 44 25 25 44 39Z"/>';
  const crossRay = '<path class="star-body" d="M50 8 57 39 72 24 61 44 92 50 61 56 72 76 57 61 50 92 43 61 28 76 39 56 8 50 39 44 28 24 43 39Z"/>';
  const divineRay = '<path class="star-body" d="M50 4 57 38 75 22 62 43 96 50 62 57 75 78 57 62 50 96 43 62 25 78 38 57 4 50 38 43 25 22 43 38Z"/>';
  const shapes = {
    1: `${fourRay}<circle class="star-core-disc" cx="50" cy="50" r="7"/>`,
    2: `${eightRay}<circle class="star-core-disc" cx="50" cy="50" r="8"/>`,
    3: `${crossRay}<circle class="star-core-disc" cx="50" cy="50" r="9"/>`,
    4: `${divineRay}<circle class="star-core-disc outer" cx="50" cy="50" r="11"/><path class="final-core" d="M50 38 54 46 62 50 54 54 50 62 46 54 38 50 46 46Z"/>${symmetricSparkles(42, 2.2)}`,
  };
  return `<svg class="star-glyph star-type-${type}" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${shapes[tier] || shapes[1]}</svg>`;
}
function constellationSignature(definitionId) {
  const art = {
    DAWN: '<path d="M61 20a31 31 0 1 0 13 54A25 25 0 1 1 61 20Z"/><circle cx="76" cy="27" r="2"/><circle cx="79" cy="69" r="2"/>',
    RADIANCE: '<circle cx="50" cy="50" r="12"/><path d="M50 8v24M50 68v24M8 50h24M68 50h24M20 20l17 17M63 63l17 17M80 20 63 37M37 63 20 80"/>',
    SAGITTARIUS: '<path d="M24 18Q67 50 24 82M22 50h58M68 37l14 13-14 13"/>',
    ASTROLOGER: '<path d="M15 50Q50 18 85 50Q50 82 15 50ZM50 32a18 18 0 1 0 0 36 18 18 0 0 0 0-36Z"/><path d="m50 40 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
    GUARDIAN: '<path d="M50 12 79 24v25c0 20-13 31-29 40-16-9-29-20-29-40V24Z"/><path d="m50 35 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z"/>',
    TWILIGHT: '<path class="bright" d="M50 16a34 34 0 0 0 0 68Z"/><path class="dark" d="M50 16a34 34 0 0 1 0 68l9-13-9-10 9-11-9-10 8-12Z"/>',
    BOND: '<ellipse cx="38" cy="50" rx="24" ry="14"/><ellipse cx="62" cy="50" rx="24" ry="14"/>',
    LINK: '<path d="M50 50 50 14M50 50 86 50M50 50 50 86M50 50 14 50"/><path d="m50 38 12 12-12 12-12-12Z"/><circle cx="50" cy="14" r="4"/><circle cx="86" cy="50" r="4"/><circle cx="50" cy="86" r="4"/><circle cx="14" cy="50" r="4"/>',
    STRIKE: '<path d="M8 55h62M18 45h52M66 34l25 16-25 16"/><circle cx="25" cy="50" r="7"/>',
    HORIZON: '<path d="M7 57h86M20 63h60"/><path d="M36 56a14 14 0 0 1 28 0"/><path d="m50 25 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z"/>',
    JUDGEMENT: '<path d="M18 66h64M50 20v46M27 34h46M27 34 16 56h22ZM73 34 62 56h22Z"/><path d="m50 9 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
  };
  return art[definitionId] ? `<span class="constellation-signature signature-${definitionId.toLowerCase()}"><svg viewBox="0 0 100 100" aria-hidden="true">${art[definitionId]}</svg></span>` : "";
}
function renderNormalStarVisual(star, pickOrder = 0, signatureId = "") {
  return `<span class="star stage-${star.tier}" style="--star-color:${star.data().color};color:${star.data().color}"><i class="star-halo"></i><i class="star-orbit"></i><span class="star-core">${normalStarGlyph(star.tier, star.type)}</span><i class="star-sparks"></i><b class="star-level">${star.tier}</b>${signatureId ? constellationSignature(signatureId) : ""}${pickOrder ? `<em class="pick-order">${pickOrder}</em>` : ""}</span>`;
}
class MergeSystem {
  static partner(m) {
    if (m.selected.length !== 1 || m.zodiacMode) return -1;
    let a = m.selected[0],
      s = m.stars[a];
    if (!s || s.constellation || s.support || s.tier >= 4) return -1;
    return m.stars.findIndex(
      (x, i) =>
        i !== a &&
        x &&
        !x.support &&
        !x.constellation &&
        x.type === s.type &&
        x.tier === s.tier,
    );
  }
  static execute(m) {
    if (m.zodiacMode)
      return UIManager.hint("먼저 조디악 선택을 완료하거나 취소하세요.");
    if (m.selected.length !== 1)
      return UIManager.hint("합칠 별 하나를 선택하세요.");
    let a = m.selected[0],
      s = m.stars[a];
    if (s.constellation || s.support || s.tier >= 4)
      return UIManager.hint("이 별은 합칠 수 없습니다.");
    let b = this.partner(m);
    if (b < 0) return UIManager.hint("같은 종류·단계의 별이 필요합니다.");
    // The visual trail is decorative only: apply every gameplay change in the
    // same input event so another merge can be performed immediately.
    UIManager.mergeEffect(m, b, a);
    s.tier++;
    m.stars[b] = null;
    m.selected = [];
    m.swapMode = false;
    game.recomputeCombatCaches?.();
    UIManager.hint(`${s.data().name} 별 ${s.tier}단계 완성!`);
    game.render();
    m.field.children[a].classList.add("merge-flash");
    game.simulationTimeout(
      () => m.field.children[a].classList.remove("merge-flash"),
      430,
    );
  }
}
class SwapSystem {
  static execute(m, index) {
    if (m.zodiacMode) return UIManager.hint("먼저 조디악 선택을 완료하거나 취소하세요.");
    const star = m.stars[index];
    if (!star || star.support || star.constellation) return UIManager.hint("별자리 구성원은 교환할 수 없습니다.");
    if (!m.player.resources.spend(CONFIG.swapCost)) return UIManager.hint("별빛이 부족합니다.");

    const oldType = star.type;
    const nextTypes = STAR_KEYS.filter((type) => type !== oldType);
    star.type = nextTypes[Math.floor(Math.random() * nextTypes.length)];
    // A type owns targeting, cadence and burst behavior. Clear all transient
    // combat state so the replacement starts using its own rules immediately.
    star.lock = null;
    star.cooldown = 0;
    star.burstLeft = 3;
    game.recomputeCombatCaches?.();
    m.selected = [index];
    m.swapMode = false;
    UIManager.hint(`${star.data().name} 별로 교환했습니다.`);
    game.render();
    UIManager.swapEffect(m, index, oldType);
  }
}
class ZodiacSystem {
  static counts(m) {
    return m.selected.reduce((counts, index) => {
      const type = m.stars[index]?.type;
      if (type) counts[type] = (counts[type] || 0) + 1;
      return counts;
    }, {});
  }
  static exactMatch(counts) {
    return playerProgress.equippedConstellations.find((kind) =>
      RECIPE_COUNTS[kind] && playerProgress.ownedConstellations.includes(kind) && recipeCountsMatch(counts, RECIPE_COUNTS[kind]),
    );
  }
  static possibleMatches(counts) {
    return playerProgress.equippedConstellations.filter((kind) =>
      playerProgress.ownedConstellations.includes(kind) && RECIPE_COUNTS[kind] &&
      Object.entries(counts).every(
        ([type, amount]) => (RECIPE_COUNTS[kind][type] || 0) >= amount,
      ),
    );
  }
  static describeSelection(m) {
    const counts = this.counts(m);
    const exact = this.exactMatch(counts);
    if (exact)
      UIManager.hint(`${ZODIAC_RECIPES[exact].name}를 연결할 수 있습니다.`);
    else if (m.selected.length && !this.possibleMatches(counts).length)
      UIManager.hint("현재 선택으로 완성 가능한 별자리가 없습니다.");
  }
  static toggle(m) {
    if (!m.zodiacMode) {
      m.clearOthers();
      m.swapMode = false;
      m.zodiacMode = true;
      m.selected = [];
      UIManager.hint("조디악 선택 중 · 중심 별을 먼저, 지원 별을 이어서 고르세요.");
      return game.render();
    }
    this.create(m);
  }
  static create(m) {
    // Capture the input order before any recipe/combat work or mode cleanup.
    const connectionOrder = [...m.selected];
    const picks = [...m.selected];
    const counts = this.counts(m);
    const definitionId = this.exactMatch(counts);
    if (definitionId && game.players.some((player) => player.manager.activeConstellations()
      .some((constellation) => constellation.definitionId === definitionId)))
      return UIManager.hint("이미 전장에 존재하는 별자리입니다.");
    const supportPicks = picks.filter((i) => m.stars[i]?.support);
    const usesBindingRelic = supportPicks.length > 0;
    if (!definitionId || picks.some((i) => m.stars[i]?.constellation) ||
        (usesBindingRelic && (!hasRelic("EVIL_OF_BINDING_STAR") || game.bindingRelicCharge < 1)))
      return UIManager.hint("선택한 별과 정확히 일치하는 별자리가 없습니다.");
    let center = picks[0],
      points = picks.map((i) => m.pos(i));
    // A successful special zodiac consumes its charge and releases only the
    // source constellations whose support members are actually being reused.
    if (usesBindingRelic) {
      const sources = new Set(supportPicks.flatMap((index) =>
        m.activeConstellations().filter((constellation) => constellation.members.includes(index))));
      sources.forEach((constellation) => constellation.release());
      game.bindingRelicCharge--;
    }
    new Constellation(m, center, [...picks], definitionId, connectionOrder);
    game.recomputeCombatCaches?.();
    game.discoverConstellation(definitionId);
    m.exitModes();
    UIManager.zodiacComplete(points, definitionId);
    if (CONSTELLATION_DEFINITIONS[definitionId].completionEffect === "dawnMoon") UIManager.showDawnMoon();
    UIManager.hint(`✨ ${CONSTELLATION_DEFINITIONS[definitionId].name} 완성!`);
    game.render();
  }
  static cancel(m) {
    if (!m.zodiacMode) return;
    m.exitModes();
    effects
      .querySelectorAll(".zodiac-preview")
      .forEach((element) => element.remove());
    UIManager.hint("조디악 선택을 취소했습니다.");
    game.render();
  }
  static release(m, center = m.selected[0]) {
    let c = m.stars[center]?.constellation;
    if (!c || c.center !== center)
      return UIManager.hint("완성된 별자리의 중심 별을 선택하세요.");
    if (m.player.resources.divinity < 1)
      return UIManager.hint("신성 1이 필요합니다.");
    m.player.resources.divinity--;
    c.release();
    m.selectOnly(center);
    UIManager.hint("별자리를 해제했습니다.");
    game.render();
  }
}
class DivinationSystem {
  static execute(manager, index) {
    const star = manager.stars[index];
    if (
      !star?.constellation ||
      star.constellation.center !== index ||
      star.constellation.definitionId !== CONSTELLATION_IDS.ASTROLOGER
    )
      return UIManager.hint("점성술자리를 선택하세요.");
    const resources = manager.player.resources;
    if ((star.constellation.runtime.divinationReadyAt || 0) > game.gameTime)
      return UIManager.hint(`점술 쿨타임 ${Math.ceil(star.constellation.runtime.divinationReadyAt - game.gameTime)}초`);
    if (!resources.spend(CONFIG.divinationCost))
      return UIManager.hint("별빛이 부족합니다.");
    const success = Math.random() < 0.5;
    resources.starlight += success ? 90 : 15;
    star.constellation.runtime.divinationReadyAt = game.gameTime + 5;
    UIManager.divinationEffect(manager.pos(index), success);
    star.constellation.runtime.lastDivinationResult = success ? "success" : "failure";
    UIManager.hint(success ? "점술 결과: 별빛 +90" : "점술 결과: 별빛 +15");
    game.markDirty();
  }
}
class GuardianLightSystem {
  static execute(manager, index) {
    const star = manager.stars[index];
    if (
      !star?.constellation ||
      star.constellation.center !== index ||
      star.constellation.definitionId !== CONSTELLATION_IDS.GUARDIAN
    )
      return UIManager.hint("수호자의 자리를 선택하세요.");
    const resources = manager.player.resources;
    const base = game.base;
    if (base.hp >= base.maxHp && base.maxHp >= BASE_MAX_HP_CAP)
      return UIManager.hint("기지 최대 체력이 상한에 도달했습니다.");
    if (!resources.spend(CONFIG.guardianLightCost))
      return UIManager.hint("별빛 350이 필요합니다.");
    if (base.hp < base.maxHp)
      base.hp = Math.min(base.maxHp, base.hp + 50 + base.maxHp * 0.01);
    else {
      const increasePercent = 1 + star.constellation.componentStageSum / 4;
      const nextMaxHp = Math.min(BASE_MAX_HP_CAP, base.maxHp + base.maxHp * increasePercent / 100);
      base.maxHp = nextMaxHp;
      base.hp = nextMaxHp;
    }
    UIManager.hint("수호의 빛을 사용했습니다.");
    game.markDirty();
    game.render();
  }
}
class BondOfferingSystem {
  static execute(manager, index) {
    const constellation = manager.stars[index]?.constellation;
    if (!constellation || constellation.center !== index || constellation.definitionId !== CONSTELLATION_IDS.BOND)
      return UIManager.hint("결속의 자리를 선택하세요.");
    if (constellation.runtime.bindChance >= 1)
      return UIManager.hint("결속 확률이 이미 100%입니다.");
    if (!manager.player.resources.spend(CONFIG.bondOfferingCost))
      return UIManager.hint("별빛이 부족합니다.");
    constellation.runtime.offerings++;
    constellation.runtime.bindChance = Math.min(1,
      constellation.definition.bindChance + constellation.runtime.offerings * constellation.definition.offeringChance);
    UIManager.hint(`결속 확률이 ${Math.round(constellation.runtime.bindChance * 100)}%로 증가했습니다.`);
    game.markDirty();
  }
}
class UIManager {
  static addTransient(element, parent, milliseconds, limit = 120) {
    this.activeEffects ||= 0;
    if (this.activeEffects >= limit) return false;
    this.activeEffects++;
    parent.append(element);
    game.simulationTimeout(() => {
      element.remove();
      this.activeEffects = Math.max(0, this.activeEffects - 1);
    }, milliseconds);
    return true;
  }
  static hint(t) {
    hint.textContent = t;
    clearTimeout(this.ht);
    this.ht = setTimeout(
      () => (hint.textContent = "별을 선택하고 행동 버튼을 사용하세요."),
      2200,
    );
  }
  static alert(t) {
    let d = document.createElement("div");
    d.className = "boss-alert";
    d.textContent = t;
    (typeof battleWorld !== "undefined" && battleWorld ? battleWorld : arena).append(d);
    setTimeout(() => d.remove(), 1700);
  }
  static beam(a, b) {
    let line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", "beam");
    ["x1", "y1", "x2", "y2"].forEach((k, i) =>
      line.setAttribute(k, [a.x, a.y, b.x, b.y][i]),
    );
    this.addTransient(line, effects, 170);
  }
  static chainBeam(a, b) {
    let line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", "chain-beam");
    ["x1", "y1", "x2", "y2"].forEach((key, index) =>
      line.setAttribute(key, [a.x, a.y, b.x, b.y][index]),
    );
    this.addTransient(line, effects, 230);
  }
  static darkShot(a, b) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", "dark-shot");
    [["x1", a.x], ["y1", a.y], ["x2", b.x], ["y2", b.y]].forEach(([key, value]) => line.setAttribute(key, value));
    this.addTransient(line, effects, 280, 120);
    const impact = document.createElement("i");
    impact.className = "dark-shot-impact"; impact.style.left = `${b.x}%`; impact.style.top = `${b.y}%`;
    this.addTransient(impact, battleWorld || arena, 1000, 120);
  }
  static chainPath(points) {
    if (!points || points.length < 2) return;
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", "chain-path-effect");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    path.setAttribute("class", "chain-beam");
    path.setAttribute("points", points.map(({ x, y }) => `${x},${y}`).join(" "));
    group.append(path);
    for (const point of points.slice(1)) {
      const flash = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      flash.setAttribute("class", "chain-flash"); flash.setAttribute("cx", point.x); flash.setAttribute("cy", point.y); flash.setAttribute("r", ".65");
      group.append(flash);
    }
    this.addTransient(group, effects, 140);
  }
  static areaImpact(position, range) {
    const pulse = document.createElement("i");
    pulse.className = "normal-star-area-impact";
    pulse.style.left = `${position.x}%`;
    pulse.style.top = `${position.y}%`;
    const diameter = RangeSystem.radius(range) * 2;
    pulse.style.width = `${diameter}px`;
    pulse.style.height = `${diameter}px`;
    pulse.setAttribute("aria-hidden", "true");
    this.addTransient(pulse, (typeof battleWorld !== "undefined" && battleWorld ? battleWorld : arena), 260);
  }
  static strikeBurst(from, to, stacks) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line"); line.setAttribute("class", "strike-beam");
    [["x1", from.x], ["y1", from.y], ["x2", to.x], ["y2", to.y]].forEach(([key, value]) => line.setAttribute(key, value));
    line.style.setProperty("--strike-power", Math.min(1, stacks / 100)); this.addTransient(line, effects, 420);
  }
  static horizonLink(from, to) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line"); line.setAttribute("class", "horizon-focus-line");
    [["x1", from.x], ["y1", from.y], ["x2", to.x], ["y2", to.y]].forEach(([key, value]) => line.setAttribute(key, value)); this.addTransient(line, effects, 650);
  }
  static bondStrike(position) {
    const strike = document.createElement("i");
    strike.className = "bond-strike";
    strike.style.left = `${position.x}%`;
    strike.style.top = `${position.y}%`;
    strike.setAttribute("aria-hidden", "true");
    this.addTransient(strike, arena, 260);
  }
  static bondApplied(position) {
    const pulse = document.createElement("i");
    pulse.className = "bond-applied";
    pulse.style.left = `${position.x}%`;
    pulse.style.top = `${position.y}%`;
    pulse.setAttribute("aria-hidden", "true");
    this.addTransient(pulse, arena, 420);
  }
  static dawnSpecial(position, damage) {
    const origin = arguments[2] || position;
    const moon = document.createElement("i");
    moon.className = "dawn-origin-pulse";
    moon.style.left = `${origin.x}%`; moon.style.top = `${origin.y}%`;
    moon.setAttribute("aria-hidden", "true");
    this.addTransient(moon, arena, 460);
    const burst = document.createElement("div");
    burst.className = "dawn-special";
    burst.style.left = `${position.x}%`;
    burst.style.top = `${position.y}%`;
    burst.setAttribute("aria-hidden", "true");
    burst.innerHTML = `<svg viewBox="0 0 100 70"><path d="M87 9C65 58 29 69 7 46c28 11 55-3 80-37Z"/></svg>${Array.from({ length: 4 }, (_, i) => `<i class="dawn-spark" style="--angle:${i * 90}deg"></i>`).join("")}<b>${Math.round(damage).toLocaleString()}</b>`;
    this.addTransient(burst, arena, 480);
  }
  static dawnMoonfall(origin, enemies) {
    const pulse = document.createElement("i");
    pulse.className = "dawn-moonfall-pulse";
    pulse.style.left = `${origin.x}%`;
    pulse.style.top = `${origin.y}%`;
    pulse.setAttribute("aria-hidden", "true");
    this.addTransient(pulse, arena, 650);
    enemies.forEach((enemy) => {
      const position = enemy.position();
      const hit = document.createElement("i");
      hit.className = "dawn-moonfall-hit";
      hit.style.left = `${position.x}%`;
      hit.style.top = `${position.y}%`;
      hit.setAttribute("aria-hidden", "true");
      this.addTransient(hit, arena, 460);
    });
  }
  static divinationEffect(position, success) {
    const effect = document.createElement("div");
    effect.className = `divination-effect ${success ? "success" : "failure"}`;
    effect.style.left = `${position.x}%`;
    effect.style.top = `${position.y}%`;
    effect.textContent = success ? "운명의 카드 ✦ +60" : "별빛 카드 ✦ +15";
    effect.setAttribute("aria-hidden", "true");
    this.addTransient(effect, arena, 900);
  }
  static renderCodex() {
    zodiacCodexList.innerHTML = playerProgress.equippedConstellations.slice(0, MAX_EQUIPPED_CONSTELLATIONS)
      .filter((id) => playerProgress.ownedConstellations.includes(id) && ZODIAC_RECIPES[id])
      .map((id) => [id, ZODIAC_RECIPES[id]])
      .map(([definitionId, zodiac]) => {
        const recipeEntries = Object.entries(zodiac.recipe);
        // Types always come from the recipe registry. previewLayout only
        // supplies presentation coordinates and never participates in matching.
        const recipeTypes = recipeEntries.flatMap(([type, amount]) =>
          Array.from({ length: amount }, () => type));
        const displayTypes = (zodiac.previewLayout.order || recipeTypes.map((_, i) => i))
          .map((index) => recipeTypes[index]);
        const edges = zodiac.previewLayout.edges.map(([from, to]) => {
          const a = zodiac.previewLayout.nodes[from];
          const b = zodiac.previewLayout.nodes[to];
          return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
        }).join("");
        const stars = zodiac.previewLayout.nodes.map(([x, y], index) => {
          const type = displayTypes[index];
          return `<g class="codex-star" style="--star-color:${CONFIG.stars[type].color}" transform="translate(${x} ${y})"><circle r="9"/><text aria-hidden="true">✦</text></g>`;
        }).join("");
        const summary = recipeEntries
          .map(([type, amount]) => `${CONFIG.stars[type].name} ×${amount}`)
          .join(" + ");
        const specials = zodiac.specialDescriptions;
        const abilities = specials.map((special, index) =>
          `<p><strong>특수능력${specials.length > 1 ? ` ${index + 1}` : ""}</strong><span>${special}</span></p>`,
        ).join("");
        const discovered = game?.discoveredConstellations.has(definitionId);
        return `<article class="zodiac-card ${definitionId.toLowerCase()} ${discovered ? "discovered" : "undiscovered"}" data-constellation="${definitionId}"><h3>${zodiac.name}</h3><div class="codex-preview-wrap"><svg class="codex-preview" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${zodiac.name} 별자리 연결 그림"><g class="codex-edges">${edges}</g><g class="codex-nodes">${stars}</g></svg></div><div class="codex-recipe" aria-label="필요한 별 조합: ${summary}"><h4>STAR RECIPE</h4><div class="codex-recipe-summary"><span>필요한 별</span>${summary}</div></div><dl class="codex-stats"><div class="codex-attack-stat"><dt>기본 공격력</dt><dd>${zodiac.attackDamage}</dd><small>단계 효과: 재료 별 단계 합 ÷ 4 × 공격력</small></div><div><dt>공격속도</dt><dd>${zodiac.attackSpeed}회/초</dd></div><div><dt>사거리</dt><dd>${zodiac.range}</dd></div></dl><p class="codex-scaling">${CONSTELLATION_ATTACK_SCALING_DESCRIPTION}</p><div class="codex-special">${abilities}</div></article>`;
      })
      .join("");
  }
  static zodiacComplete(points, definitionId) {
    const accentClass = ` constellation-effect-${String(definitionId || "dawn").toLowerCase()}`;
    points.slice(0, -1).forEach((from, i) => {
      const to = points[i + 1];
      game.simulationTimeout(() => {
        effects.insertAdjacentHTML(
          "beforeend",
          `<line class="link-form${accentClass}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>`,
        );
        for (let n = 0; n < 4; n++)
          effects.insertAdjacentHTML(
            "beforeend",
            `<circle class="spark${accentClass}" cx="${from.x + ((to.x - from.x) * (n + 1)) / 5}" cy="${from.y + ((to.y - from.y) * (n + 1)) / 5}" r="${0.35 + n * 0.06}"/>`,
          );
      }, i * 90);
    });
    game.simulationTimeout(
      () =>
        effects.insertAdjacentHTML(
          "beforeend",
          `<circle class="complete-wave${accentClass}" cx="${points[0].x}" cy="${points[0].y}" r="2.5"/>`,
        ),
      380,
    );
    game.simulationTimeout(
      () =>
        effects
          .querySelectorAll(".link-form,.spark,.complete-wave")
          .forEach((e) => e.remove()),
      1200,
    );
  }
  static showDawnMoon() {
    dawnMoon.hidden = false;
    dawnMoon.classList.remove("play");
    void dawnMoon.offsetWidth;
    dawnMoon.classList.add("play");
    clearTimeout(this.moonTimer);
    this.moonTimer = setTimeout(() => {
      dawnMoon.classList.remove("play");
      dawnMoon.hidden = true;
    }, 1800);
  }
  static mergeEffect(m, fromIndex, toIndex) {
    let from = m.pos(fromIndex),
      to = m.pos(toIndex),
      dot = document.createElement("i");
    dot.className = "merge-particle";
    dot.style.left = from.x + "%";
    dot.style.top = from.y + "%";
    (typeof battleWorld !== "undefined" && battleWorld ? battleWorld : arena).append(dot);
    requestAnimationFrame(() => {
      const metrics = RangeSystem.metrics();
      dot.style.transform = `translate(${((to.x - from.x) * metrics.width) / 100}px, ${((to.y - from.y) * metrics.height) / 100}px) scale(.45)`;
      dot.style.opacity = "0";
    });
    game.simulationTimeout(() => dot.remove(), 420);
  }
  static summonEffect(m, index) {
    let p = m.pos(index),
      flash = document.createElement("i");
    flash.className = "summon-effect";
    flash.style.left = p.x + "%";
    flash.style.top = p.y + "%";
    (typeof battleWorld !== "undefined" && battleWorld ? battleWorld : arena).append(flash);
    // Purely decorative: no gameplay state or input is held until this ends.
    setTimeout(() => flash.remove(), 420);
  }
  static swapEffect(m, index, oldType) {
    const position = m.pos(index);
    const effect = document.createElement("span");
    effect.className = "swap-effect";
    effect.style.left = `${position.x}%`;
    effect.style.top = `${position.y}%`;
    const old = document.createElement("i");
    old.className = "swap-old-star";
    old.textContent = "✦";
    old.style.color = CONFIG.stars[oldType].color;
    const next = document.createElement("i");
    next.className = "swap-new-star";
    next.textContent = "✦";
    next.style.color = m.stars[index].data().color;
    effect.append(old, next);
    for (let n = 0; n < 7; n++) {
      const particle = document.createElement("i");
      particle.className = "swap-particle";
      particle.style.setProperty("--angle", `${n * (360 / 7)}deg`);
      effect.append(particle);
    }
    (typeof battleWorld !== "undefined" && battleWorld ? battleWorld : arena).append(effect);
    setTimeout(() => effect.remove(), 560);
  }
  static selected(g) {
    for (let i = g.players.length - 1; i >= 0; i--) {
      let m = g.players[i].manager;
      if (!m.zodiacMode && m.selected.length === 1)
        return { m, index: m.selected[0], player: i };
    }
    return null;
  }
  static renderInfo(g) {
    let pick = this.selected(g);
    if (!pick) {
      starInfo.hidden = true;
      ranges.innerHTML = "";
      rangeIndicator.hidden = true;
      contextActions.hidden = true;
      this.actionKey = null;
      return;
    }
    let s = pick.m.stars[pick.index],
      d = s.data(),
      permanentLevel = playerProgress.starCollection[s.type.toUpperCase()]?.level || 1,
      damage = Math.round(d.damage * CONFIG.tierDamage[s.tier - 1] * starLevelDamageMultiplier(permanentLevel)),
      rate = d.target === "burst" ? `3연속 후 ${normalStarSpecial("white", s.tier, permanentLevel).rest}초` : `${d.rate + starLevelAttackSpeedBonus(permanentLevel) + (s.type === "purple" ? (g.purpleStageSum || 0) / 10 : 0)}회/초`,
      p = pick.m.pos(pick.index);
    starInfo.hidden = false;
    starInfo.style.setProperty("--star-color", d.color);
    let constellation = s.constellation;
    const constellationStats = constellation?.definition;
    const twilightActive = constellation?.definitionId === CONSTELLATION_IDS.TWILIGHT && constellation.runtime.transcendenceUntil > g.gameTime;
    const twilightInfo = constellation?.definitionId === CONSTELLATION_IDS.TWILIGHT
      ? `<span>킬 수: ${constellation.runtime.killCount} / ${constellationStats.transcendenceKills}</span>${twilightActive ? `<span class="twilight-time">초월 중: ${Math.max(0, constellation.runtime.transcendenceUntil - g.gameTime).toFixed(1)}초</span>` : ""}`
      : "";
    const bondInfo = constellation?.definitionId === CONSTELLATION_IDS.BOND
      ? `<span>결속 확률: ${Math.round(constellation.runtime.bindChance * 100)}%</span>` : "";
    const linkInfo = constellation?.definitionId === CONSTELLATION_IDS.LINK
      ? (() => {
          const linked = constellation.linkedConstellationStageSum();
          const thresholds = [10, 20, 30].filter((threshold) => linked >= threshold).length;
          return `<span>자신의 재료 단계 합: ${constellation.componentStageSum}</span><span>연결된 다른 별자리 단계 합: ${linked}</span><span>계승 배율: ×${Math.max(1, linked)}</span><span>임계치 강화: +${thresholds * 100}%</span>`;
        })() : "";
    const strikeInfo = constellation?.definitionId === CONSTELLATION_IDS.STRIKE ? `<span>일격 스택: ${constellation.runtime.strikeStacks}</span>` : "";
    const horizonInfo = constellation?.definitionId === CONSTELLATION_IDS.HORIZON ? `<span>계승 대상: ${constellation.runtime.inheritedDefinitionId ? CONSTELLATION_DEFINITIONS[constellation.runtime.inheritedDefinitionId].name : "없음"}</span>` : "";
    const constellationLevel = constellation ? (playerProgress.constellationCollection[constellation.definitionId]?.level || 1) : 1;
    const recipe = constellation ? Object.entries(constellationStats.recipe).map(([type, count]) => `${STAR_TYPES[type.toUpperCase()].name} ×${count}`).join(" + ") : "";
    starInfo.innerHTML = constellation
      ? `<strong>✦ ${constellationStats.name} · Lv.${constellationLevel}</strong><section class="info-section"><b>조합</b><p>${recipe}</p></section><section class="info-section"><b>기본 능력치</b><div class="stats"><span>공격력 ${Math.round(constellation.currentDamage()).toLocaleString()}</span><span>공격속도 ${constellation.definitionId === CONSTELLATION_IDS.TWILIGHT && constellation.target?.hp <= constellation.target?.maxHp * .5 ? constellationStats.attackSpeed * 2 : constellationStats.attackSpeed}회/초</span><span>사거리 ${constellation.effectiveRange()}</span><span>연결 별 ${constellation.members.length}개</span><span>재료 단계 합: ${constellation.componentStageSum}</span><span>단계 공격력 배율: ×${formatMultiplier(getConstellationStageMultiplier(constellation))}</span>${linkInfo}${strikeInfo}${horizonInfo}${bondInfo}${constellation.definitionId === CONSTELLATION_IDS.DAWN ? `<span>직접 처치 진행 ${constellation.runtime.dawnKillProgress}/5</span>` : ""}${constellation.definitionId === CONSTELLATION_IDS.RADIANCE ? `<span>최대 연쇄 대상 ${constellation.componentStageSum}</span><span>광휘 처치 수: ${constellation.runtime.radianceKills}</span><span>공격력 증가: +${formatMultiplier(constellation.runtime.radianceKillBonus * 100)}%</span>` : ""}${twilightInfo}</div></section>${constellationStats.specialDescriptions.map((description, index) => `<section class="info-section ability"><b>특수능력 ${index + 1}</b><p>${description}</p></section>`).join("")}`
      : `<strong>✦ ${d.name} 별 · Stage ${s.tier} · Lv.${permanentLevel}</strong><section class="info-section"><b>기본 능력치</b><div class="stats"><span>공격력 ${damage}</span><span>${d.target === "burst" ? "특수 주기" : "공격속도"} ${rate}</span><span>사정거리 ${d.range}</span><span>타겟 방식 ${TARGET_LABELS[d.target]}</span></div></section><section class="info-section ability normal-star-special"><b>특수능력</b><p>${normalStarAbilityText(s.type, s.tier, permanentLevel, g.normalStarStageSums)}</p></section>`;
    ranges.innerHTML = "";
    let shownRange = constellation ? constellation.effectiveRange() : d.range,
      diameter = RangeSystem.radius(shownRange) * 2;
    rangeIndicator.hidden = false;
    rangeIndicator.style.left = p.x + "%";
    rangeIndicator.style.top = p.y + "%";
    rangeIndicator.style.width = diameter + "px";
    rangeIndicator.style.height = diameter + "px";
    contextActions.hidden = false;
    const arenaRect = arena.getBoundingClientRect();
    const selectedScreen = worldToScreen(p);
    // Context actions are absolutely positioned in the same arena containing
    // block as the selected star.  Reserve one 44px touch target plus the
    // 18px visual gap at either vertical edge; this is only an edge clamp and
    // preserves the swap -> star -> merge order everywhere else.
    const actionX = Math.min(arenaRect.width - 54, Math.max(54, selectedScreen.x));
    const actionEdgeInset = 66;
    const actionY = Math.min(arenaRect.height - actionEdgeInset, Math.max(actionEdgeInset, selectedScreen.y));
    contextActions.style.setProperty("--action-x", `${actionX}px`);
    contextActions.style.setProperty("--action-y", `${actionY}px`);
    if (constellation) {
      let enabled = pick.m.player.resources.divinity >= 1;
      const isAstrologer = constellation.definitionId === CONSTELLATION_IDS.ASTROLOGER;
      const isGuardian = constellation.definitionId === CONSTELLATION_IDS.GUARDIAN;
      const isBond = constellation.definitionId === CONSTELLATION_IDS.BOND;
      const isStrike = constellation.definitionId === CONSTELLATION_IDS.STRIKE;
      const isHorizon = constellation.definitionId === CONSTELLATION_IDS.HORIZON;
      const canDivine = isAstrologer && pick.m.player.resources.can(CONFIG.divinationCost);
      const canUseGuardianLight = isGuardian && pick.m.player.resources.starlight >= CONFIG.guardianLightCost &&
        (game.base.hp < game.base.maxHp || game.base.maxHp < BASE_MAX_HP_CAP);
      const canOfferBond = isBond && constellation.runtime.bindChance < 1 && pick.m.player.resources.can(CONFIG.bondOfferingCost);
      // definitionId is deliberately part of the cache key: actions from a
      // previous tower type must never survive a selection/type change.
      let actionKey = `${pick.player}:${pick.index}:constellation:${constellation.definitionId}:${enabled}:${canDivine}:${canUseGuardianLight}:${canOfferBond}:${constellation.runtime.bindChance}:${constellation.runtime.strikeStacks || 0}:${constellation.runtime.inheritedDefinitionId || "none"}`;
      if (this.actionKey !== actionKey) {
        contextActions.innerHTML = `${isAstrologer ? `<button class="divination action-above" data-context="divination"${canDivine ? "" : " disabled"}>별빛 점술 30</button>` : ""}${isGuardian ? `<button class="guardian-light action-above" data-context="guardian-light"${canUseGuardianLight ? "" : " disabled"}>수호의 빛 350</button>` : ""}${isBond ? `<button class="bond-offering action-above" data-context="bond-offering"${canOfferBond ? "" : " disabled"}>별빛 헌납 200</button>` : ""}${isStrike ? `<button class="strike-action action-above" data-context="strike"${constellation.runtime.strikeStacks ? "" : " disabled"}>일격 가하기</button>` : ""}${isHorizon ? `<button class="horizon-action action-above" data-context="horizon">지평선의 초점</button>` : ""}<button class="${isAstrologer || isGuardian || isBond || isStrike || isHorizon ? "action-below" : "action-above"}" data-context="release"${enabled ? "" : " disabled"}>별자리 해제 ◇1</button>`;
        if (isAstrologer)
          contextActions.querySelector('[data-context="divination"]').onclick = () =>
            DivinationSystem.execute(pick.m, pick.index);
        if (isGuardian)
          contextActions.querySelector('[data-context="guardian-light"]').onclick = () =>
            GuardianLightSystem.execute(pick.m, pick.index);
        if (isBond)
          contextActions.querySelector('[data-context="bond-offering"]').onclick = () =>
            BondOfferingSystem.execute(pick.m, pick.index);
        if (isStrike) contextActions.querySelector('[data-context="strike"]').onclick = () => constellation.unleashStrike();
        if (isHorizon) contextActions.querySelector('[data-context="horizon"]').onclick = () => { pick.m.horizonFocusSource = constellation; pick.m.selected = []; UIManager.hint("계승할 다른 별자리를 선택하세요."); game.render(); };
        contextActions.querySelector('[data-context="release"]').onclick = () =>
          ZodiacSystem.release(pick.m, pick.index);
        this.actionKey = actionKey;
      }
    } else if (!s.support) {
      let partner = MergeSystem.partner(pick.m),
        canSwap = pick.m.player.resources.can(CONFIG.swapCost) && !s.support;
      let actionKey = `${pick.player}:${pick.index}:star:${s.type}:${s.tier}:${canSwap}:${partner}`;
      if (this.actionKey !== actionKey) {
        contextActions.innerHTML = `<button class="action-above" data-context="swap"${canSwap ? "" : " disabled"}>교환 10</button>${partner >= 0 ? `<button class="merge available action-below" data-context="merge">합성</button>` : ""}`;
        // Require a fresh pointerdown/up gesture that began on the action.
        // This prevents iPad's compatibility click from the selecting touch
        // activating a button that was rendered beneath that same finger.
        bindPointerTap(contextActions.querySelector('[data-context="swap"]'), (event) => {
          event.stopPropagation();
          pick.m.exchangeSelectedStar();
        });
        const mergeButton = contextActions.querySelector('[data-context="merge"]');
        if (mergeButton) bindPointerTap(mergeButton, (event) => {
          event.stopPropagation();
          MergeSystem.execute(pick.m);
        });
        this.actionKey = actionKey;
      }
    } else {
      contextActions.hidden = true;
      this.actionKey = null;
    }
  }
  static render(g) {
    this.renderHud(g, true);
    let drawn = new Set(),
      lines = [];
    g.players.forEach((p) =>
      p.manager.stars.forEach((s) => {
        let c = s?.constellation;
        if (c && !drawn.has(c)) {
          drawn.add(c);
          c.connectionOrder.slice(0, -1).forEach((fromIndex, index) => {
              const a = c.owner.pos(fromIndex);
              const b = c.owner.pos(c.connectionOrder[index + 1]);
              let selected = c.owner.selected[0] === c.center;
              lines.push(
                `<line class="link constellation-link-${c.definitionId.toLowerCase()}${selected ? " selected" : ""}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`,
              );
            });
        }
      }),
    );
    links.innerHTML = lines.join("");
    g.players.forEach((p) => p.manager.render());
    controls.querySelectorAll(".game-controls").forEach((panel) => {
      const p = g.players[Number(panel.dataset.player)];
      const z = panel.querySelector("[data-act=zodiac]");
      const cancel = panel.querySelector("[data-act=zodiac-cancel]");
      panel.classList.toggle("active-player", p.manager.selected.length > 0 || p.manager.swapMode || p.manager.zodiacMode);
      z.classList.toggle("active", p.manager.zodiacMode);
      cancel.hidden = !p.manager.zodiacMode;
      const match = ZodiacSystem.exactMatch(ZodiacSystem.counts(p.manager));
      const zodiacLabel = p.manager.zodiacMode
        ? (match ? `${ZODIAC_RECIPES[match].name} 연결` : "조디악 선택 중")
        : "조디악";
      z.innerHTML = `<i>✦</i><span>${zodiacLabel}<small>ZODIAC</small></span>`;
    });
    this.renderInfo(g);
  }
  static renderHud(g, force = false) {
    const preparing = g.phase === "PREPARING";
    document.querySelector?.(".route-arrows")?.classList.toggle("visible", preparing);
    const seconds = Math.max(0, Math.ceil(preparing ? g.preparationRemaining : g.wave.left));
    const values = {
      wave: String(preparing ? 1 : g.wave.wave),
      timer: `00:${String(seconds).padStart(2, "0")}`,
      hp: `♥ ${Math.round(g.base.hp).toLocaleString()} / ${Math.round(g.base.maxHp).toLocaleString()}`,
      starlight1: String(g.players[0].resources.starlight),
      divinity1: String(g.players[0].resources.divinity),
      starlight2: String(g.players[1].resources.starlight),
      divinity2: String(g.players[1].resources.divinity),
    };
    const elements = { wave, timer, hp, starlight1, divinity1, starlight2, divinity2 };
    this.hudValues ||= {};
    for (const [key, value] of Object.entries(values)) {
      if (force || this.hudValues[key] !== value)
        elements[key].textContent = value;
      this.hudValues[key] = value;
    }
    const bindingStatus = document.getElementById("bindingRelicStatus");
    if (bindingStatus) {
      bindingStatus.hidden = !hasRelic("EVIL_OF_BINDING_STAR");
      const bindingLabel = bindingStatus.querySelector?.("b");
      if (bindingLabel) bindingLabel.textContent = `사용 가능 ${g.bindingRelicCharge}/${g.bindingRelicMaxCharge}`;
    }
    const shieldStatus=document.getElementById("baseShields");
    if (shieldStatus) { shieldStatus.hidden=g.remainingBaseShields < 1; shieldStatus.textContent=`🛡 ×${g.remainingBaseShields}`; }
    if (preparing)
      timer.parentElement?.querySelector("small") && (timer.parentElement.querySelector("small").textContent = "전투 준비");
    else if (timer.parentElement?.querySelector("small")) {
      timer.parentElement.querySelector("small").textContent = "다음 웨이브까지";
    }
    const nextWave = g.wave.wave + 1;
    if (force || this.hudValues.nextWave !== nextWave) {
      nextEnemies.innerHTML = nextWaveSummary(g.wave.wave)
        .map(({ type, count }) => `<span>${CONFIG.monsters[type].boss ? "◈" : "◉"} ${CONFIG.monsters[type].name} ×${count}</span>`)
        .join("");
      this.hudValues.nextWave = nextWave;
    }
  }
}

function maxCameraY() {
  return Math.max(0, (battleWorld?.clientHeight || 0) - (arena?.clientHeight || 0));
}
function clampCameraY(value = game?.cameraY || 0) {
  return Math.max(0, Math.min(maxCameraY(), Number.isFinite(value) ? value : 0));
}
function worldToScreen(point) {
  const width = battleWorld?.clientWidth || arena?.clientWidth || 100;
  const height = battleWorld?.clientHeight || arena?.clientHeight || 100;
  return { x: point.x / 100 * width, y: point.y / 100 * height - (game?.cameraY || 0) };
}
function screenToWorld(point) {
  const width = battleWorld?.clientWidth || arena?.clientWidth || 100;
  const height = battleWorld?.clientHeight || arena?.clientHeight || 100;
  return { x: point.x / width * 100, y: (point.y + (game?.cameraY || 0)) / height * 100 };
}
function getViewportWorldBounds() {
  const top = screenToWorld({ x: 0, y: 0 }).y;
  const bottom = screenToWorld({ x: 0, y: arena?.clientHeight || 0 }).y;
  return { top, bottom };
}
function renderExperimentalMinimap() {
  if (!game || game.mode !== GAME_MODES.EXPERIMENTAL_VERTICAL) return;
  const canvas = experimentalMinimap.querySelector("canvas"), ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#72ddff"; ctx.lineWidth = 2; ctx.beginPath();
  const samples = activeRouteCache.samples;
  samples.forEach((point, index) => { const x = 4 + point.x / 100 * 32, y = point.y / 100 * canvas.height; index ? ctx.lineTo(x,y) : ctx.moveTo(x,y); }); ctx.stroke();
  ctx.fillStyle = "#ff6176";
  game.enemies.forEach((enemy) => { if (!enemy.dead) ctx.fillRect(3 + enemy.x / 100 * 34, enemy.y / 100 * canvas.height - 1, 2, 2); });
  const viewport = experimentalMinimap.querySelector("i");
  viewport.style.top = `${game.cameraY / battleWorld.clientHeight * 100}%`;
  viewport.style.height = `${arena.clientHeight / battleWorld.clientHeight * 100}%`;
}
function applyCamera() {
  if (!battleWorld) return;
  const experimental = game?.mode === "experimental_vertical";
  battleWorld.style.transform = experimental ? `translate3d(0, ${-clampCameraY(game.cameraY)}px, 0)` : "";
  if (game) game.cameraY = experimental ? clampCameraY(game.cameraY) : 0;
  experimentalMinimap.hidden = !experimental;
  experimentalBadge.hidden = !experimental;
  arena.classList.toggle("experimental-vertical", experimental);
  RangeSystem.refresh();
  game?.markDirty();
  renderExperimentalMinimap();
}
function installExperimentalCamera(manager) {
  let drag = null;
  const threshold = 10;
  const down = (event) => { if (!event.isPrimary || event.button > 0 || event.target.closest("button,.star-node,.context-actions")) return; drag = { id:event.pointerId, y:event.clientY, camera:manager.cameraY, moved:false }; };
  const move = (event) => { if (!drag || drag.id !== event.pointerId) return; const delta = event.clientY - drag.y; if (Math.abs(delta) > threshold) drag.moved = true; if (!drag.moved) return; event.preventDefault(); manager.cameraY = clampCameraY(drag.camera - delta); applyCamera(); };
  const up = (event) => { if (!drag || drag.id !== event.pointerId) return; if (drag.moved) { event.preventDefault(); event.stopImmediatePropagation(); } drag = null; };
  const wheel = (event) => { event.preventDefault(); manager.cameraY = clampCameraY(manager.cameraY + event.deltaY); applyCamera(); };
  arena.addEventListener("pointerdown", down); arena.addEventListener("pointermove", move, { passive:false }); arena.addEventListener("pointerup", up, true); arena.addEventListener("pointercancel", up, true); arena.addEventListener("wheel", wheel, { passive:false });
  manager.cameraCleanup = () => { arena.removeEventListener("pointerdown", down); arena.removeEventListener("pointermove", move); arena.removeEventListener("pointerup", up, true); arena.removeEventListener("pointercancel", up, true); arena.removeEventListener("wheel", wheel); };
}
class GameManager {
  constructor() {
    this.last = 0;
    this.mode = activeGameMode;
    this.cameraY = 0;
    this.running = true;
    this.speed = 1;
    this.phase = "PREPARING";
    this.preparationRemaining = PREPARATION_SECONDS;
    this.battleRewardGranted = false;
    this.galaxyFragmentsEarned = 0;
    this.fateDice = this.rollFateDice();
    const initialBaseHp = Math.min(BASE_MAX_HP_CAP, BASE_MAX_HP + getRelicEffect("STEADFAST_HEART"));
    this.base = { hp: initialBaseHp, maxHp: initialBaseHp };
    this.remainingBaseShields = getRelicEffect("IMMORTAL_NEBULA");
    Object.defineProperty(this, "baseHP", {
      get: () => this.base.hp,
      set: (value) => { this.base.hp = value; },
    });
    this.enemies = [];
    this.alliedUnits = [];
    this.spatial = new SpatialGrid();
    this.greenStarCount = 0;
    this.greenStageSum = 0;
    this.purpleStageSum = 0;
    this.greenSupportBonus = 0;
    this.normalStarStageSums = Object.freeze({ green: 0, purple: 0 });
    this.activeConstellationStageSum = 0;
    this.activeConstellationCount = 0;
    this.gameTime = 0;
    this.attackBuffUntil = 0;
    this.bindingRelicCharge = getRelicEffect("EVIL_OF_BINDING_STAR");
    this.bindingRelicMaxCharge = this.bindingRelicCharge;
    // A discovery lasts for this game even if its field constellation is later
    // released. It is intentionally not derived from active towers.
    this.discoveredConstellations = new Set();
    this.tasks = [];
    this.dirty = true;
    this.lastHudUpdate = 0;
    window.BOOT_STAGE = "creating-players";
    this.players = [0, 1].map((i) => {
      let p = { index: i, resources: new PlayerResources(this.fateDice) };
      const maxStars=BASE_MAX_STARS+getRelicEffect("GOOD_OF_BINDING_STAR")+(this.fateDice?.kind === "maxStars" ? this.fateDice.value : 0);
      p.manager = new StarManager(p, getRequiredElement(`field-${i}`), maxStars);
      return p;
    });
    window.BOOT_STAGE = "creating-wave";
    this.wave = new WaveManager(this);
    this.spawner = new EnemySpawner(this);
    window.BOOT_STAGE = "building-controls";
    if (!controlsBound) {
      this.buildControls();
      controlsBound = true;
    }
    RangeSystem.refresh();
  }
  rollFateDice(random = Math.random) {
    const level=relicLevel("DICE_OF_FATE"); if (!level) return null;
    const kind=["starlight","divinity","maxStars"][Math.min(2,Math.floor(random()*3))];
    const value=kind === "starlight" ? 50+level*50 : kind === "divinity" ? level+1 : level;
    return Object.freeze({kind,value});
  }
  setupCamera() {
    applyCamera();
    if (this.mode !== GAME_MODES.EXPERIMENTAL_VERTICAL) return;
    this.cameraY = EXPERIMENTAL_INITIAL_CAMERA === "destination" ? maxCameraY() : 0;
    applyCamera();
    installExperimentalCamera(this);
  }
  recomputeCombatCaches() {
    const constellations = new Set();
    let greenStars = 0, greenStageSum = 0, purpleStageSum = 0;
    this.players.forEach((player) => player.manager.stars.forEach((star) => {
      if (!star) return;
      if (star.type === "green" && !star.support && !star.constellation) { greenStars++; greenStageSum += star.tier; }
      if (star.type === "purple" && !star.support && !star.constellation) purpleStageSum += star.tier;
      if (star.constellation) constellations.add(star.constellation);
    }));
    this.greenStarCount = greenStars;
    this.greenStageSum = greenStageSum;
    this.purpleStageSum = purpleStageSum;
    this.normalStarStageSums = Object.freeze({ green: greenStageSum, purple: purpleStageSum });
    this.greenSupportBonus = greenStageSum ? normalStarSpecial("green", 1, playerProgress.starCollection.GREEN?.level || 1, this.normalStarStageSums).attackSpeedBonus : 0;
    this.activeConstellationStageSum = [...constellations].reduce((sum, item) => sum + item.componentStageSum, 0);
    this.activeConstellationCount = constellations.size;
  }
  start() {
    // The real-time preparation phase deliberately does not start waves.
    this.preparationStartedAt = null;
    this.render();
    if (this.fateDice) {
      const label={starlight:"별빛",divinity:"신성",maxStars:"별 최대 소환 수"}[this.fateDice.kind];
      UIManager.alert(`운명의 주사위\n✦ ${label} +${this.fateDice.value}`);
    }
    window.BOOT_STAGE = "starting-loop";
    this.rafRunning = true;
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }
  discoverConstellation(definitionId) {
    if (this.discoveredConstellations.has(definitionId)) return;
    this.discoveredConstellations.add(definitionId);
    if (!zodiacCodex.hidden) UIManager.renderCodex();
  }
  buildControls() {
    bindPointerTap(arena, (event) => {
      // Star and UI controls own their gestures. Only a tap that began and
      // ended on bare map space may summon, so one pointer gesture can never
      // select a star and also create another one behind it.
      if (event.target.closest(".star-node, .context-actions, .star-info, .overlay, button, [role=button]")) return;
      const manager = game.players[0].manager;
      if (!game.running || !zodiacCodex.hidden || game.players.some((player) => player.manager.zodiacMode)) return;
      const rect = battleWorld.getBoundingClientRect();
      manager.summonAt(
        ((event.clientX - rect.left) / rect.width) * 100,
        ((event.clientY - rect.top) / rect.height) * 100,
      );
    }, (event) => {
      if (!zodiacCodex.hidden || game.players.some((player) => player.manager.zodiacMode)) return false;
      return !event.target.closest(".star-node, .context-actions, .star-info, .overlay, button, [role=button]");
    });
    bindPointerTap(arena, (event) => {
      if (event.target.closest(".star-node, .context-actions, .star-info, .overlay, button, [role=button]")) return;
      let changed = false;
      game.players.forEach((player) => {
        changed = player.manager.clearNormalSelection() || changed;
      });
      if (changed) game.render();
    }, (event) => !event.target.closest(".star-node, .context-actions, .star-info, .overlay, button, [role=button]"));
    controls.querySelectorAll(".game-controls").forEach((panel) => {
      const playerIndex = Number(panel.dataset.player);
      panel.querySelector("[data-act=zodiac]").addEventListener("click", () => ZodiacSystem.toggle(game.players[playerIndex].manager));
      panel.querySelector("[data-act=zodiac-cancel]").addEventListener("click", () => ZodiacSystem.cancel(game.players[playerIndex].manager));
    });
    const codexButton = controls.querySelector("[data-act=codex]");
    const closeCodex = () => {
      zodiacCodex.hidden = true;
      document.body.classList.remove("codex-open");
      codexButton.focus();
    };
    codexButton.addEventListener("click", () => {
      UIManager.renderCodex();
      zodiacCodexList.scrollTop = 0;
      zodiacCodex.hidden = false;
      document.body.classList.add("codex-open");
      zodiacCodex.querySelector("[data-close-codex]").focus();
    });
    zodiacCodex.querySelector("[data-close-codex]").addEventListener("click", closeCodex);
    zodiacCodex.addEventListener("pointerdown", (event) => event.stopPropagation());
    zodiacCodex.addEventListener("click", (event) => {
      if (event.target === zodiacCodex) closeCodex();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !zodiacCodex.hidden) closeCodex();
    });
  }
  simulationTimeout(callback, milliseconds) {
    const task = { at: this.gameTime + milliseconds / 1000, callback };
    this.tasks.push(task);
    return task;
  }
  updateTasks() {
    for (let index = this.tasks.length - 1; index >= 0; index--) {
      if (this.tasks[index].at > this.gameTime) continue;
      const [task] = this.tasks.splice(index, 1);
      task.callback();
    }
  }
  markDirty() {
    this.dirty = true;
  }
  summonGuardian(componentStageSum = 0) {
    this.alliedUnits.push(new GuardianUnit(this.base, componentStageSum));
  }
  fireBossMeteor(enemy) {
    const projectile = document.createElement("i"); projectile.className = "boss-meteor-projectile";
    projectile.style.left = `${enemy.x}%`; projectile.style.top = `${enemy.y}%`; (typeof battleWorld !== "undefined" && battleWorld ? battleWorld : arena).append(projectile);
    requestAnimationFrame(() => { projectile.style.left = `${activeMap.destination.x}%`; projectile.style.top = `${activeMap.destination.y}%`; });
    this.simulationTimeout(() => {
      projectile.remove(); const impact = document.createElement("i"); impact.className = "base-meteor-impact"; impact.style.left = `${activeMap.destination.x}%`; impact.style.top = `${activeMap.destination.y}%`; UIManager.addTransient(impact, (typeof battleWorld !== "undefined" && battleWorld ? battleWorld : arena), 500);
      this.damageBase(20); this.markDirty();
    }, 650);
  }
  forceDismantleRandom(enemy) {
    const active = this.players.flatMap((player) => player.manager.activeConstellations());
    if (!active.length) return false;
    const target = active[Math.floor(Math.random() * active.length)];
    UIManager.horizonLink(enemy.position(), target.owner.pos(target.center));
    target.centerElement()?.classList.add("forced-sever");
    this.simulationTimeout(() => { target.release(); target.owner.selected = []; this.recomputeCombatCaches(); this.render(); }, 320);
    return true;
  }
  kill(e, sourceConstellation = null) {
    if (e.killRewardGranted) return;
    e.killRewardGranted = true;
    this.players.forEach((p) => {
      p.resources.starlight += Math.floor(e.reward * relicMultiplier("STARLIGHT_CRYSTAL"));
      if (e.boss) p.resources.divinity++;
    });
    this.clearEnemyReferences(e);
    sourceConstellation?.registerKill();
    if (this.mode === VERTICAL_BETA && this.wave.wave === 40 && e.type === "galaxySlayer" && !e.bossRewardClaimed) {
      e.bossRewardClaimed = true; this.wave40GalaxySlayerDefeated = true;
    }
    this.markDirty();
  }
  leak(e) {
    if (e.baseDamageApplied) return;
    e.baseDamageApplied = true;
    const damageToBase = Math.max(0, e.hp);
    this.clearEnemyReferences(e);
    this.damageBase(damageToBase);
    this.markDirty();
  }
  damageBase(amount) {
    const damage=Math.max(0,Number(amount)||0); if (!damage) return 0;
    if (this.remainingBaseShields > 0) { this.remainingBaseShields--; this.markDirty(); return 0; }
    this.base.hp = Math.max(0, this.base.hp - damage);
    if (this.base.hp <= 0) {
      this.running = false;
      finishBattle?.(this);
    }
    this.markDirty(); return damage;
  }
  clearEnemyReferences(enemy) {
    this.players.forEach((player) => player.manager.stars.forEach((star) => {
      if (!star) return;
      if (star.lock === enemy) star.lock = null;
      if (star.constellation?.target === enemy) {
        star.constellation.resetTarget();
      }
    }));
  }
  loop(t) {
    if (!this.rafRunning) return;
    if (!this.last) this.last = t;
    const frameMs = t - this.last;
    this.frameMs = this.frameMs ? this.frameMs * 0.9 + frameMs * 0.1 : frameMs;
    const realDt = Math.min(frameMs / 1000, 0.05);
    let dt = realDt * this.speed;
    this.last = t;
    if (this.running) {
      if (this.phase === "PREPARING") {
        if (this.preparationStartedAt === null) this.preparationStartedAt = t;
        this.preparationRemaining = Math.max(0, PREPARATION_SECONDS - (t - this.preparationStartedAt) / 1000);
        this.gameTime += realDt;
        this.players.forEach((p) => p.manager.update(realDt));
        if (this.preparationRemaining <= 0) this.beginCombat();
      } else {
        this.gameTime += dt;
        this.wave.update(dt);
        this.spawner.update(dt);
        this.enemies.forEach((e) => e.update(dt));
        this.enemies = this.enemies.filter((e) => !e.dead);
        this.alliedUnits.forEach((unit) => unit.update(dt));
        this.alliedUnits = this.alliedUnits.filter((unit) => !unit.dead);
        this.spatial.rebuild(this.enemies);
        this.players.forEach((p) => p.manager.update(dt));
      }
      this.updateTasks();
      if (this.dirty) this.render();
      else if (t - this.lastHudUpdate >= 100) {
        UIManager.renderHud(this);
        this.lastHudUpdate = t;
      }
    }
    this.rafId = requestAnimationFrame((x) => this.loop(x));
  }
  beginCombat() {
    if (this.phase !== "PREPARING") return;
    this.phase = "COMBAT";
    this.preparationRemaining = 0;
    this.wave.update(0);
    renderActiveMap();
    this.markDirty();
  }
  destroy() {
    this.running = false;
    this.rafRunning = false;
    if (typeof cancelAnimationFrame === "function" && this.rafId) cancelAnimationFrame(this.rafId);
    this.tasks.length = 0;
    this.cameraCleanup?.();
    this.cameraCleanup = null;
    this.enemies.forEach((enemy) => enemy.el?.remove());
    this.alliedUnits.forEach((unit) => unit.el?.remove());
    this.players.forEach((player) => { player.manager.field.innerHTML = ""; });
    this.enemies.length = 0;
    this.alliedUnits.length = 0;
    effects.innerHTML = "";
    links.innerHTML = "";
    ranges.innerHTML = "";
    contextActions.hidden = true;
    starInfo.hidden = true;
    zodiacCodex.hidden = true;
    document.body.classList.remove("codex-open");
  }
  render() {
    UIManager.render(this);
    renderExperimentalMinimap();
    this.dirty = false;
  }
}
function getRequiredElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required DOM element: ${id}`);
  return element;
}

function constellationPreview(definition) {
  const recipeTypes = Object.entries(definition.recipe).flatMap(([type, amount]) => Array(amount).fill(type));
  const displayTypes = (definition.previewLayout.order || recipeTypes.map((_, index) => index)).map((index) => recipeTypes[index]);
  const edges = definition.previewLayout.edges.map(([from, to]) => `<line x1="${definition.previewLayout.nodes[from][0]}" y1="${definition.previewLayout.nodes[from][1]}" x2="${definition.previewLayout.nodes[to][0]}" y2="${definition.previewLayout.nodes[to][1]}"/>`).join("");
  const nodes = definition.previewLayout.nodes.map(([x, y], index) => `<text x="${x}" y="${y}" style="--star-color:${CONFIG.stars[displayTypes[index]].color}">✦</text>`).join("");
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><g>${edges}</g>${nodes}</svg>`;
}

const SUMMON_STATES = Object.freeze({ START: "SUMMON_START", FORMING: "CONSTELLATION_FORMING", COMPLETE: "CONSTELLATION_COMPLETE", FLASH: "REVEAL_FLASH", REVEAL: "RESULT_REVEAL", IDLE: "RESULT_IDLE" });
const CONSTELLATION_SUMMON_COLORS = Object.freeze({
  DAWN: ["#e7e5ff", "#9d75ff"], RADIANCE: ["#fffef0", "#ffd65c"], SAGITTARIUS: ["#65baff", "#ffe06b"],
  ASTROLOGER: ["#bd75ff", "#ffd96b"], GUARDIAN: ["#d9f8ff", "#5dbdff"], TWILIGHT: ["#9a48dc", "#ff4d68"],
  BOND: ["#f7fff9", "#55db85"], LINK: ["#b16cff", "#ff5064"], STRIKE: ["#ff5064", "#e9dfff"], HORIZON: ["#55db85", "#b16cff"],
  JUDGEMENT: ["#fff8d7", "#91cfff"],
});

function summonSequencePreview(results) {
  const constellation = [...results].reverse().find((result) => result.kind === "constellation");
  const layout = constellation
    ? CONSTELLATION_DEFINITIONS[constellation.id].previewLayout
    : { nodes: [[14, 66], [31, 35], [52, 55], [70, 24], [87, 65]], edges: [[0, 1], [1, 2], [2, 3], [3, 4]] };
  // Expand the compact collection layout across the safe central 84% of the 9:16 stage.
  const points = layout.nodes.map(([x, y]) => [8 + x * .84, 7 + y * .94]);
  const edges = layout.edges.map(([from, to], index) => {
    const [x1, y1] = points[from], [x2, y2] = points[to];
    return `<g style="--link-order:${index}"><line class="summon-link-base" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><line class="summon-link-energy" pathLength="1" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><circle class="summon-runner" r="1.25"><animateMotion begin="${.7 + index * .34}s" dur=".48s" fill="freeze" path="M${x1},${y1} L${x2},${y2}"/></circle></g>`;
  }).join("");
  const nodes = points.map(([x, y], index) => `<text class="summon-node" style="--star-order:${index}" x="${x}" y="${y}">✦</text>`).join("");
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><g>${edges}</g>${nodes}</svg>`;
}

function relicSummonPreview() {
  const shards = [[18,22],[78,18],[12,66],[86,70],[31,84],[67,86]].map(([x,y], index) =>
    `<path class="relic-shard" style="--shard-order:${index}" d="M${x} ${y}l${index % 2 ? 4 : -4} 7 ${index % 2 ? -7 : 7} 2Z"/>`).join("");
  return `<svg class="relic-summon-sequence" viewBox="0 0 100 100" aria-hidden="true"><g>${shards}</g><circle class="relic-glyph-ring" cx="50" cy="50" r="20"/><circle class="relic-glyph-ring inner" cx="50" cy="50" r="12"/><path class="relic-rift" d="M49 35l4 10-6 7 5 13"/></svg>`;
}

function toggleEquippedConstellation(id) {
  if (!playerProgress.ownedConstellations.includes(id)) return { ok: false, message: "아직 획득하지 않은 별자리입니다." };
  const current = playerProgress.equippedConstellations;
  const index = current.indexOf(id);
  if (index >= 0) current.splice(index, 1);
  else if (current.length >= MAX_EQUIPPED_CONSTELLATIONS) return { ok: false, message: "전투에 가져갈 별자리는 최대 6개입니다." };
  else current.push(id);
  savePlayerProgress();
  return { ok: true };
}

class RandomMapSelector {
  constructor(random = Math.random) {
    const ids = Object.keys(MAP_DEFINITIONS);
    this.selectedMapId = ids[Math.min(ids.length - 1, Math.floor(random() * ids.length))];
  }
}

function renderActiveMap() {
  const pathSvg = getRequiredElement("paths"); const pathData = routePathData();
  pathSvg.querySelectorAll(".roadGlow,.roadEdge,.road,.roadStars").forEach((path) => path.setAttribute("d", pathData));
  const arrowLayer = pathSvg.querySelector(".route-arrows");
  if (arrowLayer) arrowLayer.innerHTML = activeMap.arrows.map((progress) => { const point = routePoint(progress), before = routePoint(progress-.004), after = routePoint(progress+.004); const angle = Math.atan2(after.y-before.y,after.x-before.x)*180/Math.PI+90; return `<path d="M0 -2.2L2 1.8L0 .8L-2 1.8Z" transform="translate(${point.x} ${point.y}) rotate(${angle})"/>`; }).join("");
  arrowLayer?.classList.toggle("visible", game?.phase === "PREPARING");
}

function bootstrapGame() {
  // This function is the only place where required page elements are bound.
  // Assignments are intentionally explicit so missing IDs identify themselves.
  window.BOOT_STAGE = "dom-ready";
  arena = getRequiredElement("arena");
  battleWorld = getRequiredElement("battleWorld");
  experimentalMinimap = getRequiredElement("experimentalMinimap");
  experimentalBadge = getRequiredElement("experimentalBadge");
  renderActiveMap();
  effects = getRequiredElement("effects");
  links = getRequiredElement("links");
  ranges = getRequiredElement("ranges");
  rangeIndicator = getRequiredElement("rangeIndicator");
  contextActions = getRequiredElement("contextActions");
  hint = getRequiredElement("hint");
  dawnMoon = getRequiredElement("dawnMoon");
  starInfo = getRequiredElement("starInfo");
  controls = getRequiredElement("controls");
  zodiacCodex = getRequiredElement("zodiacCodex");
  zodiacCodexList = getRequiredElement("zodiacCodexList");
  wave = getRequiredElement("wave");
  timer = getRequiredElement("timer");
  hp = getRequiredElement("hp");
  starlight1 = getRequiredElement("starlight1");
  divinity1 = getRequiredElement("divinity1");
  starlight2 = getRequiredElement("starlight2");
  divinity2 = getRequiredElement("divinity2");
  nextEnemies = getRequiredElement("nextEnemies");
  speed = getRequiredElement("speed");
  restart = getRequiredElement("restart");
  finalWave = getRequiredElement("finalWave");
  gameover = getRequiredElement("gameover");

  const mainMenu = getRequiredElement("main-menu");
  const battleMenu = getRequiredElement("battle-menu");
  const gachaScreen = getRequiredElement("gacha-screen");
  const collectionScreen = getRequiredElement("collection-screen");
  const relicScreen = getRequiredElement("relic-screen");
  const monsterCodexScreen = getRequiredElement("monster-codex-screen");
  const mapRandomScreen = getRequiredElement("map-random");
  const gameShell = getRequiredElement("game-shell");
  const exitDialog = getRequiredElement("exit-dialog");
  const toast = getRequiredElement("game-toast");
  let currentScreen = SCREEN_STATES.MAIN_MENU;
  const showScreen = (screen) => {
    if (!Object.values(SCREEN_STATES).includes(screen) || screen === currentScreen) return;
    currentScreen = screen;
    mainMenu.hidden = screen !== SCREEN_STATES.MAIN_MENU;
    battleMenu.hidden = screen !== SCREEN_STATES.BATTLE_MENU;
    gameShell.hidden = screen !== SCREEN_STATES.BATTLE_GAME;
    gachaScreen.hidden = screen !== SCREEN_STATES.GACHA;
    collectionScreen.hidden = screen !== SCREEN_STATES.COLLECTION;
    relicScreen.hidden = screen !== SCREEN_STATES.RELICS;
    monsterCodexScreen.hidden = screen !== SCREEN_STATES.MONSTER_CODEX;
    mapRandomScreen.hidden = screen !== SCREEN_STATES.MAP_RANDOM;
    exitDialog.hidden = true;
  };
  const updateMetaCurrency = () => {
    document.querySelectorAll?.("[data-star-dust]").forEach((node) => {
      node.textContent = playerProgress.starDust.toLocaleString("ko-KR");
    });
    document.querySelectorAll?.("[data-star-shards]").forEach((node) => {
      node.textContent = playerProgress.starShards.toLocaleString("ko-KR");
    });
    document.querySelectorAll?.("[data-meteor-fragments]").forEach((node) => {
      node.textContent = playerProgress.meteorFragments.toLocaleString("ko-KR");
    });
    document.querySelectorAll?.("[data-galaxy-fragments]").forEach((node) => { node.textContent = playerProgress.galaxyFragments.toLocaleString("ko-KR"); });
    document.querySelectorAll?.("[data-draw]").forEach((button) => {
      const balance = button.dataset.draw === "relic" ? playerProgress.meteorFragments : playerProgress.starDust;
      button.disabled = balance < Number(button.dataset.cost);
    });
    document.querySelectorAll?.("[data-constellation-pity]").forEach((node) => { node.textContent = `${playerProgress.constellationPity} / ${GACHA_RULES.pityLimit}`; });
  };
  const showToast = (message) => {
    toast.textContent = message; toast.hidden = false; clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
  };
  const resultDialog = getRequiredElement("draw-results");
  const summonController = {
    state: SUMMON_STATES.IDLE, timers: [], results: [],
    active() { return !resultDialog.hidden && this.state !== SUMMON_STATES.IDLE; },
    clearTimers() { this.timers.forEach(clearTimeout); this.timers.length = 0; },
    schedule(state, delay, action) { this.timers.push(setTimeout(() => { this.state = state; resultDialog.dataset.summonState = state; action?.(); }, delay)); },
    begin(results) {
      this.clearTimers(); this.results = results;
      const featured = [...results].reverse().find((item) => item.kind === "constellation") || results[0];
      const isRelic = featured.kind === "relic";
      const colors = isRelic ? ["#a36bff", "#63dfff"] : featured.kind === "constellation" ? CONSTELLATION_SUMMON_COLORS[featured.id] : [STAR_TYPES[featured.id].color, "#ffffff"];
      resultDialog.style.setProperty("--summon-primary", colors[0]); resultDialog.style.setProperty("--summon-secondary", colors[1]);
      resultDialog.className = `draw-result-dialog ${isRelic ? "featured-relic" : featured.kind === "constellation" ? "featured-constellation" : "featured-star"}`;
      resultDialog.querySelector(".summon-content header small").textContent = isRelic ? "ANCIENT RELIC AWAKENING" : "CELESTIAL SUMMON";
      resultDialog.querySelector(".summoning-title").textContent = isRelic ? "고대 문양을 깨우는 중…" : "별자리를 잇는 중…";
      resultDialog.hidden = false; document.body.classList.add("summon-input-locked");
      getRequiredElement("skip-summon").hidden = results.some((item) => item.kind === "constellation");
      this.state = SUMMON_STATES.START; resultDialog.dataset.summonState = this.state;
      void resultDialog.offsetWidth;
      this.schedule(SUMMON_STATES.FORMING, 260);
      this.schedule(SUMMON_STATES.COMPLETE, 2100);
      this.schedule(SUMMON_STATES.FLASH, 2600);
      this.schedule(SUMMON_STATES.REVEAL, 2920, () => resultDialog.classList.add("summon-complete"));
      this.schedule(SUMMON_STATES.IDLE, 2920 + results.length * 90, () => resultDialog.classList.add("results-idle"));
    },
    skip() {
      if (!this.active()) return;
      this.clearTimers(); this.state = SUMMON_STATES.IDLE; resultDialog.dataset.summonState = this.state;
      resultDialog.classList.add("summon-complete", "results-idle", "summon-skipped");
    },
    close() {
      if (this.state !== SUMMON_STATES.IDLE) return;
      this.clearTimers(); this.results = []; resultDialog.hidden = true; resultDialog.removeAttribute("data-summon-state");
      resultDialog.className = "draw-result-dialog"; document.body.classList.remove("summon-input-locked");
      getRequiredElement("skip-summon").hidden = false;
      getRequiredElement("draw-sequence").replaceChildren(); getRequiredElement("draw-result-grid").replaceChildren();
    },
  };
  const renderCollection = () => {
    getRequiredElement("star-collection").innerHTML = Object.values(STAR_TYPES).map((star) => {
      const entry = playerProgress.starCollection[star.id];
      const cost = starLevelCosts(entry.level);
      const canUpgrade = cost && entry.count >= cost.copies && playerProgress.starShards >= cost.shards;
      const visualStage = Math.min(4, Math.ceil(entry.level / 2));
      return `<article class="collection-card star-collection-card ${entry.count ? "owned" : "locked"}" style="--star-color:${star.color}"><div class="collection-star stage-${visualStage}">${normalStarGlyph(visualStage, star.key)}</div><h3>${star.name} 별</h3><b class="permanent-level">${cost ? `Lv.${entry.level}` : "Lv.7 · MAX"}</b><div class="collection-ability"><strong>기본 스탯</strong><p>공격력 ${star.damage} · 공격속도 ${star.rate} · 사거리 ${star.range}</p><strong>특수능력 · 현재 Lv.</strong><p>${normalStarCollectionAbilityText(star.key, entry.level)}</p><strong>다음 Lv.</strong><p>${cost ? normalStarNextLevelText(star.key) : "최대 레벨"}</p></div><div class="star-upgrade-details"><span>보유 별: <b>${entry.count}${cost ? ` / ${cost.copies}` : ""}</b></span><span>별조각: <b>${playerProgress.starShards}${cost ? ` / ${cost.shards}` : ""}</b></span>${cost ? `<small>다음 비용 · ${star.name} 별 ×${cost.copies} + 별조각 ×${cost.shards}</small>` : `<small>최대 레벨 · 복사본은 계속 보관됩니다.</small>`}</div><button type="button" data-upgrade-star="${star.id}"${canUpgrade ? "" : " disabled"}>${cost ? "레벨업" : "MAX"}</button></article>`;
    }).join("");
    getRequiredElement("constellation-collection").innerHTML = Object.values(CONSTELLATION_DEFINITIONS).map((definition) => {
      const owned = playerProgress.ownedConstellations.includes(definition.id);
      const order = playerProgress.equippedConstellations.indexOf(definition.id);
      const entry = playerProgress.constellationCollection[definition.id];
      const cost = entry && CONSTELLATION_LEVEL_COSTS[entry.level];
      const canUpgrade = cost && entry.copies >= cost.copies && playerProgress.galaxyFragments >= cost.galaxyFragments;
      const recipe = Object.entries(definition.recipe).map(([type, amount]) => `${CONFIG.stars[type].name} 별 ×${amount}`).join(" + ");
      return `<article class="collection-card constellation-collection-card ${owned ? "owned" : "locked"} ${order >= 0 ? "equipped" : ""}">${order >= 0 ? `<b class="equip-order">${order + 1}</b>` : ""}${constellationPreview(definition)}<h3>${definition.name}</h3><div class="collection-ability"><strong>Lv.${entry?.level || 1} · 조합</strong><p>${recipe}</p><strong>기본 능력</strong><p>${definition.supportOnly ? `지원형 · 사거리 ${definition.range}` : `공격력 ${definition.attackDamage} · 공격속도 ${definition.attackSpeed}회/초 · 사거리 ${definition.range}`}</p><strong>비용 · 쿨타임</strong><p>비용: 위 별 조합 · 쿨타임: ${definition.attackSpeed ? `${(1 / definition.attackSpeed).toFixed(2)}초` : "해당 없음"}</p><strong>현재 레벨 효과</strong><p>${definition.supportOnly ? "지원 능력은 정의된 특수 효과를 적용합니다." : `공격력 ×${formatMultiplier(constellationLevelDamageMultiplier(entry?.level || 1))} · 공격속도 보너스 +${Math.round(constellationLevelAttackSpeedBonus(entry?.level || 1) * 100)}%`}</p><strong>특수 능력 1 · 2</strong>${definition.specialDescriptions.map((text) => `<p>${text}</p>`).join("")}</div>${owned ? `<b class="permanent-level">${cost ? `Lv.${entry.level}` : "Lv.4 · MAX"}</b><div class="constellation-upgrade-details"><span>복사본 <b>${entry.copies}${cost ? ` / ${cost.copies}` : ""}</b></span><span>은하파편 <b>${playerProgress.galaxyFragments}${cost ? ` / ${cost.galaxyFragments}` : ""}</b></span></div><div class="collection-actions"><button type="button" data-equip-constellation="${definition.id}">${order >= 0 ? "장착 해제" : "전투 장착"}</button><button type="button" data-upgrade-constellation="${definition.id}"${canUpgrade ? "" : " disabled"}>${cost ? `Lv.${entry.level + 1} 강화` : "MAX"}</button></div>` : "<small>🔒 미획득</small>"}</article>`;
    }).join("");
    document.querySelectorAll("[data-deck-count]").forEach((node) => { node.textContent = playerProgress.equippedConstellations.length; });
    document.querySelectorAll("[data-equip-constellation]").forEach((button) => { button.onclick = () => { const result = toggleEquippedConstellation(button.dataset.equipConstellation); if (!result.ok) showToast(result.message); renderCollection(); }; });
    document.querySelectorAll("[data-upgrade-star]").forEach((button) => { button.onclick = () => { if (upgradeStar(button.dataset.upgradeStar)) { updateMetaCurrency(); renderCollection(); } }; });
    document.querySelectorAll("[data-upgrade-constellation]").forEach((button) => { button.onclick = () => { if (upgradeConstellation(button.dataset.upgradeConstellation)) { updateMetaCurrency(); renderCollection(); } }; });
  };
  const renderRelics = () => {
    const collection=getRequiredElement("relic-collection");
    collection.innerHTML = Object.values(RELIC_DEFINITIONS).map((relic) => {
      const entry=playerProgress.relicProgress[relic.id], owned=entry.owned, cost=RELIC_UPGRADE_COSTS[entry.level];
      const ready=Boolean(cost && entry.duplicates>=cost.duplicates && playerProgress.starShards>=cost.starShards);
      const nebulaProgress=relic.id === "IMMORTAL_NEBULA" && entry.level < 4 ? `<p class="relic-growth">다음 보호막 증가까지 <b>${entry.level-1} / 3</b></p>` : "";
      return `<article class="relic-card ${owned ? "owned" : "locked"} ${ready ? "upgrade-ready" : ""}" data-relic="${relic.id}"><i>${owned ? relic.icon : "🔒"}</i><div class="relic-card-copy"><small>${relic.effectType}</small><h2>${relic.name} <b>${owned ? (entry.level===4 ? "Lv.MAX" : `Lv.${entry.level}`) : "미획득"}</b></h2><p class="current-effect">현재 효과 · ${owned ? relicEffectText(relic.id,entry.level) : relicEffectText(relic.id,1)}</p>${owned && cost ? `<p>다음 Lv · ${relicEffectText(relic.id,entry.level+1)}</p><p>보유 유물 <b>${entry.duplicates} / ${cost.duplicates}</b> · 별조각 <b>${playerProgress.starShards.toLocaleString()} / ${cost.starShards.toLocaleString()}</b></p>${nebulaProgress}<button type="button" data-upgrade-relic="${relic.id}" ${ready ? "" : "disabled"}>${ready ? "업그레이드 가능" : "업그레이드"}</button>` : owned ? `<button type="button" disabled>최대 레벨</button>` : `<p>운석파편 뽑기에서 획득할 수 있습니다.</p>`}</div></article>`;
    }).join("");
    collection.querySelectorAll("[data-upgrade-relic]").forEach((button)=>button.onclick=()=>{ if(upgradeRelic(button.dataset.upgradeRelic)){ updateMetaCurrency(); renderRelics(); } });
  };
  const showMainMenu = () => { updateMetaCurrency(); showScreen(SCREEN_STATES.MAIN_MENU); };
  const showBattleMenu = () => showScreen(SCREEN_STATES.BATTLE_MENU);
  const showGacha = () => { updateMetaCurrency(); showScreen(SCREEN_STATES.GACHA); };
  const showCollection = () => { renderCollection(); showScreen(SCREEN_STATES.COLLECTION); };
  const showRelics = () => { renderRelics(); showScreen(SCREEN_STATES.RELICS); };
  const renderMonsterCodex = (selectedId = MONSTER_CODEX_IDS[0]) => {
    const list = getRequiredElement("monster-codex-list");
    const detail = getRequiredElement("monster-codex-detail");
    list.innerHTML = MONSTER_CODEX_IDS.map((id) => { const monster = CONFIG.monsters[id]; return `<button type="button" class="monster-card ${id}${id === selectedId ? " selected" : ""}" data-monster-id="${id}"><span class="monster-portrait"><i></i></span><span><small>${monster.boss ? "BOSS / SPECIAL" : monster.role}</small><b>${monster.name}</b><em>HP ${monster.hp.toLocaleString("ko-KR")} · SPD ${monster.speed}</em></span></button>`; }).join("");
    const monster = CONFIG.monsters[selectedId];
    detail.className = `monster-codex-detail ${selectedId}`;
    detail.innerHTML = `<div class="monster-detail-portrait"><i></i></div><small>${monster.boss ? "BOSS / SPECIAL" : monster.role}</small><h2>${monster.name}</h2><dl><div><dt>기본 체력</dt><dd>${monster.hp.toLocaleString("ko-KR")}</dd></div><div><dt>이동속도</dt><dd>${monster.speed}</dd></div><div><dt>역할 / 등급</dt><dd>${monster.role}</dd></div></dl><section><b>능력 · ${monster.abilityName}</b><p>${monster.abilityText}</p></section><section><b>설명</b><p>${monster.description}</p></section>`;
    list.querySelectorAll("[data-monster-id]").forEach((button) => button.onclick = () => renderMonsterCodex(button.dataset.monsterId));
  };
  const showMonsterCodex = () => { renderMonsterCodex(); showScreen(SCREEN_STATES.MONSTER_CODEX); };
  const startBattle = (mode = GAME_MODES.NORMAL) => {
    if (![SCREEN_STATES.MAP_RANDOM, SCREEN_STATES.BATTLE_MENU].includes(currentScreen)) return false;
    activeGameMode = mode;
    if (mode === GAME_MODES.EXPERIMENTAL_VERTICAL) setActiveMap(EXPERIMENTAL_VERTICAL_MAP.id);
    if (game) game.destroy();
    gameover.hidden = true;
    speed.textContent = "×1";
    speed.classList.remove("active");
    arena.classList.remove("speed-2");
    arena.classList.remove("battle-arrival");
    void arena.offsetWidth;
    arena.classList.add("battle-arrival");
    showScreen(SCREEN_STATES.BATTLE_GAME);
    window.BOOT_STAGE = "creating-game";
    game = new GameManager();
    game.setupCamera();
    renderActiveMap();
    game.start();
    return true;
  };
  let mapRandomTimers = [];
  const beginMapRandom = (random = Math.random) => {
    if (currentScreen !== SCREEN_STATES.BATTLE_MENU) return false;
    const selector = new RandomMapSelector(random); // authoritative choice: exactly one random call
    mapRandomTimers.forEach(clearTimeout); mapRandomTimers = [];
    showScreen(SCREEN_STATES.MAP_RANDOM);
    const maps = Object.values(MAP_DEFINITIONS), cards = getRequiredElement("map-random-cards"), result = getRequiredElement("map-random-result");
    result.hidden = true; cards.classList.remove("decided");
    getRequiredElement("map-random-title").textContent = "전장 탐색 중...";
    cards.innerHTML = maps.map((map) => `<article data-random-map="${map.id}"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="${routePathData(map)}"/></svg><strong>${map.name}</strong></article>`).join("");
    const steps = [0,1,2,0,1,2,0,1,2,0,1,2];
    const delays = [0,90,180,270,370,480,600,740,900,1090,1320,1600];
    const highlight = (id) => cards.querySelectorAll("[data-random-map]").forEach((card) => card.classList.toggle("active", card.dataset.randomMap === id));
    steps.forEach((index, step) => mapRandomTimers.push(setTimeout(() => highlight(maps[index].id), delays[step])));
    mapRandomTimers.push(setTimeout(() => {
      setActiveMap(selector.selectedMapId); highlight(selector.selectedMapId);
      cards.classList.add("decided"); result.querySelector("strong").textContent = activeMap.name; result.hidden = false;
      getRequiredElement("map-random-title").textContent = "전장 결정";
    }, 1950));
    mapRandomTimers.push(setTimeout(() => startBattle(GAME_MODES.NORMAL), 2750));
    return selector.selectedMapId;
  };
  finishBattle = (battle = game) => {
    if (!battle) return 0;
    const reachedWave = Math.max(0, Math.floor(battle.wave.wave));
    battle.resultMode = battle.mode || GAME_MODES.NORMAL;
    const rewardMultiplier = relicMultiplier("SUPERNOVA_TEAR");
    const vertical = battle.resultMode === VERTICAL_BETA;
    const reward = Math.floor(reachedWave * (vertical ? 4 : 8) * rewardMultiplier);
    // Legacy normal formula remains `const shardReward = reachedWave * 2`;
    // the BETA branch deliberately uses its independent inclusive-wave rule.
    const shardReward = Math.floor((vertical ? (reachedWave < 10 ? 0 : (reachedWave - 9) * 5) : reachedWave * 2) * rewardMultiplier);
    const meteorReward = Math.floor((vertical ? Math.floor(reachedWave / 5) * 2 : Math.floor(reachedWave / 5)) * rewardMultiplier);
    const galaxyReward = Math.floor((vertical && battle.wave40GalaxySlayerDefeated ? 1 : 0) * rewardMultiplier);
    if (!battle.battleRewardGranted) {
      battle.battleRewardGranted = true;
      battle.starDustReward = reward;
      battle.starShardReward = shardReward;
      battle.meteorFragmentReward = meteorReward;
      battle.galaxyFragmentReward = galaxyReward;
      playerProgress.starDust += reward;
      playerProgress.starShards += shardReward;
      playerProgress.meteorFragments += meteorReward;
      playerProgress.galaxyFragments += galaxyReward;
      savePlayerProgress();
    }
    battle.running = false;
    battle.rafRunning = false;
    if (typeof cancelAnimationFrame === "function" && battle.rafId) cancelAnimationFrame(battle.rafId);
    finalWave.textContent = reachedWave;
    getRequiredElement("dustReward").textContent = battle.starDustReward ?? reward;
    getRequiredElement("shardReward").textContent = battle.starShardReward ?? shardReward;
    getRequiredElement("meteorFragmentReward").textContent = battle.meteorFragmentReward ?? meteorReward;
    getRequiredElement("galaxyFragmentReward").textContent = battle.galaxyFragmentReward ?? galaxyReward;
    getRequiredElement("galaxyRewardRow").hidden = !vertical;
    getRequiredElement("resultModeLabel").textContent = vertical ? "세로 대전장 BETA · 보상" : "획득 보상";
    gameover.classList.remove("reveal-results"); void gameover.offsetWidth; gameover.classList.add("reveal-results");
    gameover.hidden = false;
    exitDialog.hidden = true;
    updateMetaCurrency();
    return reward;
  };
  const leaveBattle = () => finishBattle(game);
  const navigateOnce = (callback) => (event) => { event?.preventDefault?.(); event?.stopPropagation?.(); callback(); };
  getRequiredElement("open-battle-menu").onclick = navigateOnce(showBattleMenu);
  document.querySelectorAll?.("[data-open-battle]").forEach((button) => { button.onclick = navigateOnce(showBattleMenu); });
  document.querySelectorAll?.("[data-open-gacha]").forEach((button) => { button.onclick = navigateOnce(showGacha); });
  document.querySelectorAll?.("[data-open-collection]").forEach((button) => { button.onclick = navigateOnce(showCollection); });
  document.querySelectorAll?.("[data-open-relics]").forEach((button) => { button.onclick = navigateOnce(showRelics); });
  document.querySelectorAll?.("[data-open-monster-codex]").forEach((button) => { button.onclick = navigateOnce(showMonsterCodex); });
  document.querySelectorAll?.("[data-main-home]").forEach((button) => { button.onclick = navigateOnce(showMainMenu); });
  getRequiredElement("battle-back").onclick = navigateOnce(showMainMenu);
  // A delayed mobile synthetic click can be retargeted after the bottom-nav
  // screen swap. Arm PLAY only when this control received its own pointerdown;
  // keyboard/assistive clicks (detail === 0) remain supported.
  const playBattleButton = getRequiredElement("play-battle");
  let playIntentArmed = false;
  playBattleButton.onpointerdown = (event) => { playIntentArmed = event.isPrimary !== false; };
  playBattleButton.onpointercancel = () => { playIntentArmed = false; };
  playBattleButton.onclick = (event) => {
    event.preventDefault(); event.stopPropagation();
    const intentionalActivation = event.detail === 0 || playIntentArmed;
    playIntentArmed = false;
    if (intentionalActivation) beginMapRandom();
  };
  const experimentalButton = getRequiredElement("play-experimental");
  bindPointerTap(experimentalButton, () => {
    if (currentScreen === SCREEN_STATES.BATTLE_MENU) startBattle(GAME_MODES.EXPERIMENTAL_VERTICAL);
  });
  getRequiredElement("battle-exit").onclick = () => { exitDialog.hidden = false; };
  getRequiredElement("exit-cancel").onclick = () => { exitDialog.hidden = true; };
  getRequiredElement("exit-confirm").onclick = leaveBattle;
  document.querySelectorAll?.("[data-coming-soon]").forEach((button) => {
    button.addEventListener("click", () => {
      toast.textContent = "준비 중인 콘텐츠입니다.";
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.hidden = true; }, 1800);
    });
  });
  speed.onclick = () => {
    if (!game || game.phase === "PREPARING") return;
    game.speed = game.speed === 1 ? 2 : 1;
    speed.textContent = `×${game.speed}`;
    speed.classList.toggle("active", game.speed === 2);
    arena.classList.toggle("speed-2", game.speed === 2);
  };
  restart.onclick = () => {
    if (game) game.destroy();
    game = null;
    gameover.hidden = true;
    showMainMenu();
  };
  document.querySelectorAll?.("[data-gacha-tab]").forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll("[data-gacha-tab]").forEach((item) => item.setAttribute("aria-selected", String(item === tab)));
      document.querySelectorAll("[data-gacha-board]").forEach((board) => { board.hidden = board.dataset.gachaBoard !== tab.dataset.gachaTab; });
    };
  });
  document.querySelectorAll?.("[data-collection-tab]").forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll("[data-collection-tab]").forEach((item) => item.setAttribute("aria-selected", String(item === tab)));
      document.querySelectorAll("[data-collection-panel]").forEach((panel) => { panel.hidden = panel.dataset.collectionPanel !== tab.dataset.collectionTab; });
    };
  });
  document.querySelectorAll?.("[data-draw]").forEach((button) => {
    button.onclick = () => {
      if (button.disabled || summonController.active()) return;
      const relicDraw = button.dataset.draw === "relic";
      const count = Number(button.dataset.cost) === (relicDraw ? 30 : 1000) ? 10 : 1;
      const results = relicDraw ? performRelicDraws(count) : performConstellationDraws(count);
      if (!results) return showToast(relicDraw ? "운석조각이 부족합니다." : "별가루가 부족합니다.");
      const resultSequence = getRequiredElement("draw-sequence");
      resultSequence.innerHTML = relicDraw ? relicSummonPreview() : summonSequencePreview(results);
      getRequiredElement("draw-result-grid").innerHTML = results.map((result, index) => result.kind === "relic"
        ? `<article class="draw-result relic-result" style="--result-order:${index}"><em>${result.isNew ? "NEW" : "중복 +1"}</em><i>${RELIC_DEFINITIONS[result.id].icon}</i><b>${RELIC_DEFINITIONS[result.id].name}</b><small>${relicEffectText(result.id,relicLevel(result.id))}</small></article>`
        : result.kind === "star"
        ? `<article class="draw-result star-result" style="--star-color:${STAR_TYPES[result.id].color};--result-order:${index}"><small>일반 별 획득</small><i>✦</i><b>${STAR_TYPES[result.id].name} 별</b><span>${STAR_TYPES[result.id].name} · Stage 1</span></article>`
        : `<article class="draw-result constellation-result constellation-${result.id.toLowerCase()}" style="--result-order:${index};--identity:${CONSTELLATION_SUMMON_COLORS[result.id][0]}">${result.isNew ? "<em>NEW</em>" : "<em>보유 중</em>"}<small>별자리 획득</small>${constellationPreview(CONSTELLATION_DEFINITIONS[result.id])}<b>${CONSTELLATION_DEFINITIONS[result.id].name}</b><span>조합 · ${Object.entries(CONSTELLATION_DEFINITIONS[result.id].recipe).map(([type,count])=>`${STAR_TYPES[type.toUpperCase()].name}×${count}`).join(" · ")}</span><span>핵심 능력 · ${CONSTELLATION_DEFINITIONS[result.id].specialDescriptions[0]}</span>${result.guaranteed ? "<strong>확정 소환</strong>" : ""}</article>`).join("");
      summonController.begin(results);
      updateMetaCurrency(); renderCollection(); renderRelics();
    };
  });
  getRequiredElement("skip-summon").onclick = () => summonController.skip();
  getRequiredElement("close-draw-results").onclick = () => summonController.close();
  const settingsDialog = getRequiredElement("settings-dialog"), mailDialog = getRequiredElement("mail-dialog"), newsDialog = getRequiredElement("news-dialog");
  const setModalOpen = (dialog, open) => {
    if (open) document.querySelectorAll(".utility-dialog:not([hidden])").forEach((other) => { if (other !== dialog) other.hidden = true; });
    dialog.hidden = !open;
    document.body.classList.toggle("modal-open", open || Boolean(document.querySelector(".utility-dialog:not([hidden])")));
  };
  const refreshSettings = () => {
    document.body.dataset.zodiacVfx = playerProgress.settings.zodiacVfx;
    const hpButton = settingsDialog.querySelector("[data-setting-hp]"), vfxButton = settingsDialog.querySelector("[data-setting-vfx]");
    if (hpButton) hpButton.textContent = playerProgress.settings.showMonsterHpNumbers ? "ON" : "OFF";
    if (vfxButton) vfxButton.textContent = playerProgress.settings.zodiacVfx === "strong" ? "강하게" : "약하게";
    document.querySelectorAll?.(".enemy-hp").forEach((node) => { node.hidden = !playerProgress.settings.showMonsterHpNumbers; });
  };
  const latestNewsId = NEWS_ITEMS[0]?.id || "";
  const refreshNews = () => {
    const unread=NEWS_ITEMS.filter((item)=>!playerProgress.readNewsIds[item.id]).length;
    document.querySelectorAll?.("[data-news-badge]").forEach((badge) => { badge.hidden = unread===0; badge.textContent=unread; });
    getRequiredElement("news-items").innerHTML = NEWS_ITEMS.map((item) => `<article class="news-item"><header><time>${item.date}${playerProgress.readNewsIds[item.id] ? "" : " · NEW"}</time><h3>${item.title}</h3></header>${item.sections.map((section) => `<section><h4>${section.title}</h4>${(section.paragraphs || []).map((paragraph) => `<p>${paragraph}</p>`).join("")}${section.bullets ? `<ul>${section.bullets.map((bullet) => `<li>${bullet}</li>`).join("")}</ul>` : ""}</section>`).join("")}<footer>${item.footer}</footer></article>`).join("");
  };
  document.querySelectorAll?.("[data-open-news]").forEach((button) => button.onclick = () => {
    NEWS_ITEMS.forEach((item) => { playerProgress.readNewsIds[item.id] = true; });
    playerProgress.lastReadNewsVersion = latestNewsId;
    savePlayerProgress(); refreshNews(); setModalOpen(newsDialog, true);
  });
  const showSettingsView = (view) => settingsDialog.querySelectorAll("[data-settings-view]").forEach((panel) => { panel.hidden = panel.dataset.settingsView !== view; });
  document.querySelectorAll?.("[data-open-settings]").forEach((button) => button.onclick = (event) => { event.preventDefault(); event.stopPropagation(); refreshSettings(); showSettingsView("main"); setModalOpen(settingsDialog, true); });
  const hpSettingButton = settingsDialog.querySelector("[data-setting-hp]"), vfxSettingButton = settingsDialog.querySelector("[data-setting-vfx]");
  if (hpSettingButton) hpSettingButton.onclick = () => { playerProgress.settings.showMonsterHpNumbers = !playerProgress.settings.showMonsterHpNumbers; savePlayerProgress(); refreshSettings(); };
  if (vfxSettingButton) vfxSettingButton.onclick = () => { playerProgress.settings.zodiacVfx = playerProgress.settings.zodiacVfx === "strong" ? "weak" : "strong"; savePlayerProgress(); refreshSettings(); };
  const refreshMail = () => {
    const updateClaimed = playerProgress.claimedMail[UPDATE_REWARD_ID] === true;
    const meteorClaimed = playerProgress.claimedMail[METEOR_MAIL_REWARD_ID] === true;
    document.querySelectorAll?.("[data-mail-badge]").forEach((node) => {
      const unread = Number(!updateClaimed) + Number(!meteorClaimed);
      node.hidden = unread === 0; node.textContent = unread;
    });
    const updateButton=getRequiredElement("claim-update-reward"); updateButton.disabled=updateClaimed; updateButton.textContent=updateClaimed?"✓ 수령 완료":"보상 수령";
    const updateCard=getRequiredElement("update-mail-card"); updateCard.classList.toggle("claimed",updateClaimed); updateCard.querySelector("i")?.replaceChildren(updateClaimed?"✓":"NEW");
    const meteorCard=getRequiredElement("meteor-mail-card"); meteorCard.classList.toggle("claimed",meteorClaimed); meteorCard.querySelector("i")?.replaceChildren(meteorClaimed?"✓":"NEW");
    const meteorButton=getRequiredElement("claim-meteor-mail"); meteorButton.disabled=meteorClaimed; meteorButton.textContent=meteorClaimed?"✓ 수령 완료":"받기";
  };
  document.querySelectorAll?.("[data-open-mail]").forEach((button)=>button.onclick=()=>{refreshMail();setModalOpen(mailDialog,true);});
  let updateRewardClaiming = false;
  const claimUpdateReward = getRequiredElement("claim-update-reward"); claimUpdateReward.onclick=()=>{ if(updateRewardClaiming || playerProgress.claimedMail[UPDATE_REWARD_ID]) return; updateRewardClaiming=true; claimUpdateReward.disabled=true; playerProgress.claimedMail[UPDATE_REWARD_ID]=true; playerProgress.starDust+=3000; savePlayerProgress(); refreshMail(); updateMetaCurrency(); updateRewardClaiming=false; };
  const claimMeteorReward = getRequiredElement("claim-meteor-mail"); claimMeteorReward.onclick=()=>{ if(playerProgress.claimedMail[METEOR_MAIL_REWARD_ID]) return; playerProgress.claimedMail[METEOR_MAIL_REWARD_ID]=true; playerProgress.meteorFragments+=30; savePlayerProgress(); refreshMail(); updateMetaCurrency(); };
  document.querySelectorAll?.("[data-open-rates]").forEach((button)=>button.onclick=()=>{ const stars=Object.values(STAR_TYPES), zodiacs=Object.values(CONSTELLATION_DEFINITIONS); getRequiredElement("rate-details").innerHTML=`<h3>일반 별 개별 확률</h3>${stars.map((x)=>`<div><span>${x.name}</span><b>${(GACHA_RULES.starChance/stars.length*100).toFixed(2)}%</b></div>`).join("")}<h3>별자리 개별 확률</h3>${zodiacs.map((x)=>`<div><span>${x.name}</span><b>${(GACHA_RULES.constellationChance/zodiacs.length*100).toFixed(2)}%</b></div>`).join("")}`; settingsDialog.querySelector("[data-star-rate-total]").textContent=`${GACHA_RULES.starChance*100}%`; settingsDialog.querySelector("[data-zodiac-rate-total]").textContent=`${GACHA_RULES.constellationChance*100}%`; showSettingsView("rates"); });
  settingsDialog.querySelectorAll("[data-settings-back]").forEach((button) => button.onclick=()=>showSettingsView("main"));
  const specialCodeButton = settingsDialog.querySelector("[data-open-special-code]");
  if (specialCodeButton) specialCodeButton.onclick=()=>{ settingsDialog.querySelector("[data-special-code-result]").textContent=""; showSettingsView("code"); };
  const specialCodeForm = settingsDialog.querySelector("[data-special-code-form]");
  if (specialCodeForm) specialCodeForm.onsubmit=(event)=>{ event.preventDefault(); const input=settingsDialog.querySelector("[data-special-code-input]"); const result=redeemSpecialCode(input.value); settingsDialog.querySelector("[data-special-code-result]").textContent=result.message; if(result.ok) input.value=""; updateMetaCurrency(); };
  document.querySelectorAll?.("[data-close-utility]").forEach((button)=>button.onclick=()=>setModalOpen(button.closest(".utility-dialog"),false));
  refreshSettings(); refreshMail(); refreshNews();
  window.addEventListener("resize", () => {
    RangeSystem.refresh();
    game?.markDirty();
  }, { passive: true });
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  showMainMenu();
  if (specialGrantApplied) showToast("특별 지급\n별가루 +5,000\n운석조각 +20");
  const diagnostics = {
    CONFIG, MODE_CONFIG, EARLY_WAVE_COMPOSITIONS, MONSTER_CODEX_IDS, NEWS_ITEMS, GAME_MODES, EXPERIMENTAL_VERTICAL_MAP, VERTICAL_BETA_WAYPOINTS, STAR_TYPES, STARTER_COLLECTION, RELIC_DEFINITIONS, RELIC_UPGRADE_COSTS, GACHA_RULES, CONSTELLATION_IDS, CONSTELLATION_DEFINITIONS, ZODIAC_RECIPES, RECIPE_COUNTS, recipeCountsMatch, getNormalWaveHpMultiplier, getWaveHpMultiplier, SCREEN_STATES, SUMMON_STATES, PREPARATION_SECONDS, GACHA_COSTS, STAR_LEVEL_COSTS, CONSTELLATION_LEVEL_COSTS, MAP_DEFINITIONS, ROUTE_CACHES, RandomMapSelector, playerProgress, performConstellationDraws, performRelicDraws, getRelicEffect, relicEffectText, upgradeRelic, redeemSpecialCode, effectiveMaxStars, toggleEquippedConstellation, starLevelCosts, starLevelDamageMultiplier, starLevelAttackSpeedBonus, normalStarSpecial, normalStarAbilityText, constellationLevelDamageMultiplier, constellationLevelAttackSpeedBonus, upgradeStar, upgradeConstellation, bossTypeForWave, summonController,
    get game() { return game; },
    get currentScreen() { return currentScreen; },
    showMainMenu, showBattleMenu, showGacha, showMonsterCodex, beginMapRandom, startBattle, leaveBattle, finishBattle, setActiveMap, routePoint, worldToScreen, screenToWorld, clampCameraY, getViewportWorldBounds,
    classes: { Enemy, EnemySpawner, GuardianUnit, WaveManager, Star, Targeting, RangeSystem, SpatialGrid, Constellation },
    performance: () => ({
      activeEnemies: game?.enemies.length || 0,
      activeEffects: UIManager.activeEffects || 0,
      frameMs: game?.frameMs || 0,
      fps: game?.frameMs ? 1000 / game.frameMs : 0,
    }),
  };
  window.__TDS__ = diagnostics;
  window.BOOT_STAGE = "complete";
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", bootstrapGame, { once: true });
else bootstrapGame();
