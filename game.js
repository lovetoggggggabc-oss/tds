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

let arena, effects, links, ranges, rangeIndicator, contextActions, hint;
let dawnMoon, starInfo, controls, zodiacCodex, zodiacCodexList;
let wave, timer, hp, starlight1, divinity1, starlight2, divinity2, nextEnemies;
let speed, restart, finalWave, gameover;
let game = null;
let finishBattle = null;
let controlsBound = false;
let toastTimer = 0;
const SCREEN_STATES = Object.freeze({ MAIN_MENU: "MAIN_MENU", BATTLE_MENU: "BATTLE_MENU", BATTLE_GAME: "BATTLE_GAME", GACHA: "GACHA", COLLECTION: "COLLECTION", RELICS: "RELICS" });
const PROGRESS_STORAGE_KEY = "zodiacDefenseProgress";
const PROGRESS_SCHEMA_VERSION = 4;
const STAR_DUST_GRANT_ID = "starDust5000_v1";
const METEOR_GRANT_ID = "meteorFragments20_v2";
const STAR_DUST_GRANT_AMOUNT = 5000;
const METEOR_GRANT_AMOUNT = 20;
let specialGrantApplied = false;
const PREPARATION_SECONDS = 15;
const GACHA_COSTS = Object.freeze({ constellation: Object.freeze([100, 1000]), relic: Object.freeze([10, 100]) });
const GACHA_RULES = Object.freeze({ starChance: .9, constellationChance: .1, pityLimit: 20 });
const MAX_EQUIPPED_CONSTELLATIONS = 6;
const RELIC_DEFINITIONS = Object.freeze({
  STEADFAST_HEART: Object.freeze({ id: "STEADFAST_HEART", name: "굳센 마음", description: "기지의 최대 체력과 시작 체력이 1,000 증가합니다.", effectType: "baseMaxHp", effectValue: 1000, icon: "♥" }),
  SONG_OF_STARS: Object.freeze({ id: "SONG_OF_STARS", name: "별들의 노래", description: "공격 가능한 일반 별의 공격속도가 20% 증가합니다.", effectType: "normalStarAttackSpeed", effectValue: 1.20, icon: "♪" }),
  SONG_OF_CONSTELLATIONS: Object.freeze({ id: "SONG_OF_CONSTELLATIONS", name: "별자리들의 노래", description: "완성된 공격형 별자리의 공격속도가 20% 증가합니다.", effectType: "constellationAttackSpeed", effectValue: 1.20, icon: "♫" }),
  ASTROLOGY_POTION: Object.freeze({ id: "ASTROLOGY_POTION", name: "점성술의 약", description: "전투 시작 별빛이 50 증가합니다.", effectType: "startStarlight", effectValue: 50, icon: "⚗" }),
  BLESSING_OF_PLANETS: Object.freeze({ id: "BLESSING_OF_PLANETS", name: "행성의 축복", description: "공격 가능한 일반 별의 최종 공격력이 10% 증가합니다.", effectType: "normalStarDamage", effectValue: 1.10, icon: "◉" }),
  BLESSING_OF_STARS: Object.freeze({ id: "BLESSING_OF_STARS", name: "별의 축복", description: "공격형 별자리의 최종 공격력이 10% 증가합니다.", effectType: "constellationDamage", effectValue: 1.10, icon: "✦" }),
  EVIL_OF_BINDING_STAR: Object.freeze({ id: "EVIL_OF_BINDING_STAR", name: "결속성의 악", description: "전투당 1회, 지원 별자리의 별을 조디악 재료로 사용할 수 있습니다.", effectType: "supportZodiacCharge", effectValue: 1, icon: "◆" }),
  GOOD_OF_BINDING_STAR: Object.freeze({ id: "GOOD_OF_BINDING_STAR", name: "결속성의 선", description: "별 소환 최대 개수가 1 증가합니다.", effectType: "maxStars", effectValue: 1, icon: "◇" }),
  SUPERNOVA_TEAR: Object.freeze({ id: "SUPERNOVA_TEAR", name: "초신성의 눈물", description: "전투 결과 별조각과 운석조각 보상이 10% 증가합니다.", effectType: "battleReward", effectValue: 1.10, icon: "☄" }),
});
function hasRelic(id) { return playerProgress?.ownedRelics?.includes(id) || false; }
function relicEffect(id, fallback = 1) { return hasRelic(id) ? RELIC_DEFINITIONS[id].effectValue : fallback; }
const LEGACY_STAR_IDS = Object.freeze({ SKY: "YELLOW", SKYBLUE: "YELLOW", LIGHT_BLUE: "YELLOW", sky: "YELLOW", skyblue: "YELLOW", light_blue: "YELLOW" });
const STAR_TYPES = Object.freeze({
  BLUE: Object.freeze({ id: "BLUE", key: "blue", name: "청색", color: "#4d83ff", damage: 50, rate: 4, range: 5, target: "lock" }),
  WHITE: Object.freeze({ id: "WHITE", key: "white", name: "백색", color: "#ffffff", damage: 100, rate: 3.5, range: 6, target: "burst" }),
  YELLOW: Object.freeze({ id: "YELLOW", key: "yellow", name: "황색", color: "#ffd84d", damage: 75, rate: 2, range: 7, target: "random" }),
  ORANGE: Object.freeze({ id: "ORANGE", key: "orange", name: "주황색", color: "#ffad45", damage: 125, rate: 1.5, range: 4, target: "nearest" }),
  RED: Object.freeze({ id: "RED", key: "red", name: "적색", color: "#ff5064", damage: 200, rate: 1, range: 5, target: "highest" }),
  PURPLE: Object.freeze({ id: "PURPLE", key: "purple", name: "보라색", color: "#b16cff", damage: 100, rate: 1, range: 4.5, target: "lowest" }),
  GREEN: Object.freeze({ id: "GREEN", key: "green", name: "초록색", color: "#55db85", damage: 0, rate: 0, range: 0, target: "none", support: "alliedAttackSpeed" }),
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
function constellationLevelDamageMultiplier(level) { return 1 + (Math.min(4, Math.max(1, level)) - 1) * .5; }
function constellationLevelAttackSpeedBonus(level) { return (Math.min(4, Math.max(1, level)) - 1) * .5; }
function normalizeConstellationCollection(saved, owned) {
  const source = saved?.constellationCollection || {};
  return Object.fromEntries(owned.map((id) => [id, { owned: true, copies: Math.max(0, Math.floor(Number(source[id]?.copies) || 0)), level: Math.min(4, Math.max(1, Math.floor(Number(source[id]?.level) || 1))) }]));
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
      ownedRelics: [...new Set((saved?.ownedRelics || []).filter((id) => RELIC_DEFINITIONS[id]))],
      oneTimeGrants: grants,
    };
    syncOwnedStars(progress);
    return progress;
  } catch (_error) {
    specialGrantApplied = true;
    const progress = { schemaVersion: PROGRESS_SCHEMA_VERSION, starDust: STAR_DUST_GRANT_AMOUNT, starShards: 0, meteorFragments: METEOR_GRANT_AMOUNT, galaxyFragments: 0, starCollection: normalizeStarCollection(null, STARTER_COLLECTION.ownedStars), ownedStars: {}, ownedConstellations: [...STARTER_COLLECTION.ownedConstellations], constellationCollection: normalizeConstellationCollection(null, STARTER_COLLECTION.ownedConstellations), equippedConstellations: [...STARTER_COLLECTION.equippedConstellations], constellationPity: 0, ownedRelics: [], oneTimeGrants: { [STAR_DUST_GRANT_ID]: true, [METEOR_GRANT_ID]: true } };
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
  const owned = new Set(playerProgress.ownedRelics);
  const results = Array.from({ length: count }, () => {
    const relic = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
    const isNew = !owned.has(relic.id);
    owned.add(relic.id);
    return { kind: "relic", id: relic.id, isNew };
  });
  playerProgress.meteorFragments -= cost;
  playerProgress.ownedRelics = [...owned];
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
});
const BASE_MAX_HP = 400;
const BASE_MAX_STARS = 21;
function effectiveMaxStars() { return BASE_MAX_STARS + (hasRelic("GOOD_OF_BINDING_STAR") ? RELIC_DEFINITIONS.GOOD_OF_BINDING_STAR.effectValue : 0); }
const MAX_STARS_PER_PLAYER = effectiveMaxStars();
// Logical, normalized map data is authoritative for drawing, movement and
// placement. New stages can provide another definition without changing any
// of those systems.
const MAP_DEFINITIONS = Object.freeze({
  cosmic_s_01: Object.freeze({
    id: "cosmic_s_01",
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
});
const MAP_DEFINITION = MAP_DEFINITIONS.cosmic_s_01;
const CONSTELLATION_ATTACK_SCALING_DESCRIPTION =
  "연결에 사용한 별들의 단계 합을 4로 나눈 값만큼 기본 공격력에 배율이 적용됩니다. 예: 단계 합 7 → 공격력 ×1.75";
function getConstellationStageMultiplier(constellation) {
  return constellation.componentStageSum / 4;
}
function getStageScaledDamage(constellation) {
  return constellation.definition.attackDamage * getConstellationStageMultiplier(constellation);
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
    attackSpeed: 1, range: 6, targeting: "highest",
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
    recipe: Object.freeze({ orange: 2 }), attackDamage: 10,
    attackSpeed: 1, range: 3, targeting: "highest", contextualAction: "divination",
    previewLayout: Object.freeze({
      nodes: Object.freeze([[24, 68], [76, 30]]),
      edges: Object.freeze([[0, 1]]),
    }),
    specialDescriptions: Object.freeze([
      "공격 성공 시 별빛 1 + 현재 활성화된 완성 별자리 수 획득",
      "별빛 점술 30: 별빛 30을 사용하여 50% 확률로 별빛 60, 50% 확률로 별빛 15를 획득합니다.",
    ]),
  }),
  [CONSTELLATION_IDS.GUARDIAN]: Object.freeze({
    id: CONSTELLATION_IDS.GUARDIAN, name: "수호자의 자리",
    recipe: Object.freeze({ orange: 1, white: 1, red: 1 }), attackDamage: 300,
    attackSpeed: 0.5, range: 3, targeting: "highest",
    previewLayout: Object.freeze({
      nodes: Object.freeze([[50, 18], [20, 68], [80, 68]]),
      edges: Object.freeze([[0, 1], [1, 2], [2, 0]]),
    }),
    contextualAction: "guardianLight",
    specialDescriptions: Object.freeze([
      "특수능력 1 — 수호의 빛: 별빛 50을 소모하여 기지의 체력을 50 + 기지 최대 체력의 1%만큼 회복합니다. 기지의 체력이 이미 가득 차 있다면 대신 기지의 최대 체력을 1% 증가시킵니다.",
      "수호자 소환: 15초마다 기지 최대 체력의 20%만큼의 체력을 가진 수호자를 출구에서 소환합니다. 수호자는 적과 반대 방향으로 출구에서 입구를 향해 이동하며, 적을 만나면 길을 막고 전투합니다.",
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
  guardianLightCost: 50,
  bondOfferingCost: 200,
  startStarlight: 500,
  startDivinity: 50,
  baseMaxHP: BASE_MAX_HP,
  guardianUnit: {
    hpRatio: 0.20,
    attackDamage: 100,
    attacksPerSecond: 1,
    summonCooldown: 15,
    speed: 4,
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
    slime: { name: "어둠 슬라임", hp: 500, speed: 4.6, reward: 1, baseDamage: 100, allyCombatDamage: 35 },
    bug: { name: "암흑 벌레", hp: 800, speed: 7, reward: 2, baseDamage: 150, allyCombatDamage: 55 },
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

// Pointer Events avoid Safari's synthetic touch/click pair. A small movement
// allowance keeps a deliberate tap responsive while rejecting drags.
function bindPointerTap(element, callback, shouldStart = () => true) {
  let gesture = null;
  const cancel = () => { gesture = null; };
  element.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button > 0 || !shouldStart(event)) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
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
    cancel();
    event.preventDefault();
    callback(event);
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
    burst: "3연속 공격 → 2초 대기",
    nearest: "가장 가까운 적",
    highest: "체력이 가장 높은 적",
    lowest: "현재 체력이 가장 낮은 적",
    none: "공격하지 않음 · 모든 아군 공격속도 +3%",
  };
class PlayerResources {
  constructor() {
    this.starlight = CONFIG.startStarlight + (hasRelic("ASTROLOGY_POTION") ? RELIC_DEFINITIONS.ASTROLOGY_POTION.effectValue : 0);
    this.divinity = CONFIG.startDivinity;
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
  constructor(type, lane, wave) {
    Object.assign(this, CONFIG.monsters[type]);
    this.type = type;
    // lane is retained as a harmless compatibility field for saved/test data;
    // every enemy now travels the one shared route.
    this.lane = 0;
    this.progress = 0;
    this.pathProgress = 0;
    this.maxHp = this.hp * Math.pow(1 + CONFIG.waveHpGrowth, wave - 1);
    this.hp = this.maxHp;
    this.dead = false;
    this.isBoss = this.boss === true;
    this.spawnTime = game?.gameTime || 0;
    this.abilityTriggered = false;
    this.speedBoostUntil = 0;
    this.bossRewardClaimed = false;
    this.engagedAlly = null;
    // Status effects use simulation time; no per-enemy timers are needed.
    this.statusEffects = { bindUntil: 0 };
    this.x = MAP_DEFINITION.spawn.x;
    this.y = MAP_DEFINITION.spawn.y;
    this.lastHpPercent = -1;
    this.lastHpText = "";
    this.el = document.createElement("div");
    this.el.className = `enemy ${this.type}${this.boss ? " boss" : ""}`;
    this.el.innerHTML = `<div class="enemy-health"><span class="enemy-hp"></span><div class="bar" aria-hidden="true"><i></i></div></div><span class="enemy-body"></span><small>${this.boss ? this.name : ""}</small>`;
    this.hpFill = this.el.querySelector(".bar i");
    this.hpText = this.el.querySelector(".enemy-hp");
    arena.append(this.el);
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
    const metrics = RangeSystem.metrics();
    this.el.style.transform = `translate3d(${(this.x * metrics.width) / 100}px, ${(this.y * metrics.height) / 100}px, 0)`;
  }
  update(dt) {
    if (this.bossAbility && !this.abilityTriggered && game.gameTime - this.spawnTime >= (this.abilityDelay || 0)) {
      this.abilityTriggered = true;
      if (this.bossAbility === "summonSlimes") {
        this.el.classList.add("boss-casting", "slime-pulse");
        const summonedHp = Math.max(1, this.hp * .5);
        for (let index = 0; index < 4; index++) {
          const slime = new Enemy("slime", 0, 1); slime.maxHp = summonedHp; slime.hp = summonedHp;
          slime.progress = Math.max(0, this.progress - 1 + index * .45); slime.pathProgress = slime.progress / 100;
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
    this.progress += this.speed * (this.speedBoostUntil > game.gameTime ? this.speedMultiplier : 1) * dt;
    this.pathProgress = Math.min(1, this.progress / 100);
    const position = this.calculatePosition();
    this.x = position.x;
    this.y = position.y;
    if (this.progress >= 100) {
      this.dead = true;
      this.el.remove();
      game.leak(this);
    } else this.render();
  }
  hit(n, from, sourceConstellation = null) {
    if (this.dead || n <= 0) return false;
    this.hp -= n;
    UIManager.beam(from, this.position());
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      this.el.remove();
      game.kill(this, sourceConstellation);
    } else this.updateHealthBar();
    return true;
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
  constructor(base) {
    const stats = CONFIG.guardianUnit;
    this.team = "ALLY";
    this.maxHp = base.maxHp * stats.hpRatio;
    this.hp = this.maxHp;
    this.pathProgress = 1;
    this.progress = 100;
    this.dead = false;
    this.target = null;
    this.attackCooldown = 0;
    this.enemyAttackCooldown = 0;
    Object.assign(this, MAP_DEFINITION.destination);
    this.el = document.createElement("div");
    this.el.className = "guardian-unit";
    this.el.innerHTML = '<div class="guardian-health"><span class="guardian-hp"></span><div class="bar" aria-hidden="true"><i></i></div></div><span class="guardian-body"><i></i></span>';
    this.hpFill = this.el.querySelector(".bar i");
    this.hpText = this.el.querySelector(".guardian-hp");
    arena.append(this.el);
    this.updateHealthBar();
    this.render();
  }
  position() { return { x: this.x, y: this.y }; }
  render() {
    const metrics = RangeSystem.metrics();
    this.el.style.transform = `translate3d(${(this.x * metrics.width) / 100}px, ${(this.y * metrics.height) / 100}px, 0)`;
  }
  acquireTarget() {
    let best = null;
    let distance = Infinity;
    for (const enemy of game.enemies) {
      if (enemy.dead || (enemy.engagedAlly && enemy.engagedAlly !== this)) continue;
      const nextDistance = RangeSystem.distance(this.position(), enemy.position());
      if (nextDistance <= CONFIG.guardianUnit.contactDistance && nextDistance < distance) {
        best = enemy;
        distance = nextDistance;
      }
    }
    if (best) {
      this.target = best;
      best.engagedAlly = this;
    }
  }
  update(dt) {
    if (this.dead) return;
    if (this.target?.dead) this.releaseTarget();
    if (!this.target) this.acquireTarget();
    if (this.target) {
      this.attackCooldown -= dt;
      this.enemyAttackCooldown -= dt;
      if (this.attackCooldown <= 0) {
        this.target.hit(CONFIG.guardianUnit.attackDamage, this.position());
        this.attackCooldown = 1 / CONFIG.guardianUnit.attacksPerSecond;
        if (this.target.dead) this.releaseTarget();
      }
      if (this.target && this.enemyAttackCooldown <= 0) {
        this.hit(this.target.allyCombatDamage);
        this.enemyAttackCooldown = 1;
      }
      return;
    }
    this.progress -= CONFIG.guardianUnit.speed * dt;
    this.pathProgress = Math.max(0, this.progress / 100);
    Object.assign(this, routePoint(this.pathProgress));
    if (this.progress <= 0) this.remove();
    else this.render();
  }
  hit(damage) {
    this.hp -= damage;
    if (this.hp <= 0) this.remove();
    else this.updateHealthBar();
  }
  releaseTarget() {
    if (this.target?.engagedAlly === this) this.target.engagedAlly = null;
    this.target = null;
  }
  remove() {
    this.releaseTarget();
    this.dead = true;
    this.el.remove();
  }
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
    let boss = WaveManager.isBoss(n);
    if (boss) {
      let type = bossTypeForWave(n);
      this.queue.push({ at: 0, type, lane: 0 });
    } else {
      let count = Math.min(4 + Math.floor(n * 1.2), 25);
      for (let i = 0; i < count; i++)
        this.queue.push({
          at: i * 0.7,
          type: (i + n) % 3 === 0 ? "bug" : "slime",
          lane: 0,
        });
    }
  }
  update(dt) {
    this.queue.forEach((x) => (x.at -= dt));
    while (this.queue[0] && this.queue[0].at <= 0) {
      let x = this.queue.shift();
      this.game.enemies.push(new Enemy(x.type, x.lane, this.game.wave.wave));
    }
  }
}
function bossTypeForWave(n) {
  return ({ 10: "kingSlime", 20: "timeRunner", 30: "meteor", 40: "galaxySlayer" })[n] || (n % 20 === 0 ? "meteor" : "drone");
}
class WaveManager {
  constructor(game) {
    this.game = game;
    this.wave = 0;
    this.left = 0;
  }
  static isBoss(n) {
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
      this.left += WaveManager.isBoss(this.wave)
        ? CONFIG.bossWaveSeconds
        : CONFIG.waveSeconds;
      this.game.spawner.wave(this.wave);
      if (WaveManager.isBoss(this.wave))
        UIManager.alert(`⚠ BOSS WAVE ${this.wave}`);
    }
  }
}

function nextWaveSummary(currentWave) {
  const n = currentWave + 1;
  if (WaveManager.isBoss(n))
    return [{ type: bossTypeForWave(n), count: 1 }];
  const count = Math.min(4 + Math.floor(n * 1.2), 25);
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
function routePoint(progressOrLane, legacyProgress) {
  const progress = legacyProgress === undefined ? progressOrLane : legacyProgress;
  const sections = MAP_DEFINITION.route;
  if (progress >= 1) return { ...MAP_DEFINITION.destination };
  const scaled = Math.max(0, progress) * sections.length;
  const section = Math.floor(scaled);
  return curvePoint(sections[section], scaled - section);
}

function routePathData() {
  const start = MAP_DEFINITION.spawn;
  return `M${start.x} ${start.y}` + MAP_DEFINITION.route.map((segment) =>
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
    return targets.reduce((best, enemy) => !best || enemy.progress > best.progress ? enemy : best, null);
  }
  static dist(a, b) {
    return RangeSystem.distance(a, b);
  }
}
class RangeSystem {
  static refresh() {
    const rect = arena.getBoundingClientRect();
    this.cachedMetrics = { width: rect.width, height: rect.height };
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
      constellation.owner.player.resources.starlight += 1 + active;
      game.markDirty();
    },
  }),
  [CONSTELLATION_IDS.GUARDIAN]: Object.freeze({
    createRuntime: () => ({ componentStageSum: 0, summonCooldown: CONFIG.guardianUnit.summonCooldown }),
    update(constellation, dt) {
      constellation.runtime.summonCooldown -= dt;
      if (constellation.runtime.summonCooldown > 0) return;
      constellation.runtime.summonCooldown += CONFIG.guardianUnit.summonCooldown;
      game.summonGuardian();
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
    const globalModifier = (this.owner.alliedAttackSpeedModifier?.() || 1) * relicEffect("SONG_OF_CONSTELLATIONS");
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
    arena.append(area);
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
    let target = first;
    let from = origin;
    while (target && hit.size < this.runtime.componentStageSum) {
      const targetPosition = target.position();
      target.hit(this.currentDamage(), from, this);
      if (hit.size) UIManager.chainBeam(from, targetPosition);
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
  constructor(player, field) {
    this.player = player;
    this.field = field;
    this.stars = Array(MAX_STARS_PER_PLAYER).fill(null);
    this.selected = [];
    this.swapMode = false;
    this.zodiacMode = false;
    for (let i = 0; i < MAX_STARS_PER_PLAYER; i++) {
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
    const count = Number.isFinite(game?.greenStarCount) ? game.greenStarCount
      : game?.players?.reduce((total, player) => total + player.manager.greenStarCount(), 0) || 0;
    return 1 + count * 0.03;
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
    const roadClearance = MAP_DEFINITION.roadWidth / 2 + starRadius + MAP_DEFINITION.placementPadding;
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
      this.clearOthers();
      // Re-tapping the selected star keeps its contextual controls open.
      this.selected = [i];
      this.swapMode = false;
    }
    game.render();
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
      const levelSpeedMultiplier = (s.data().rate + starLevelAttackSpeedBonus(permanentLevel)) / s.data().rate;
      const attackSpeedModifier = this.alliedAttackSpeedModifier() * relicEffect("SONG_OF_STARS") * levelSpeedMultiplier;
      const previousModifier = s.attackSpeedModifier || 1;
      if (previousModifier !== attackSpeedModifier && s.cooldown > 0)
        s.cooldown *= previousModifier / attackSpeedModifier;
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
          (game.attackBuffUntil > game.gameTime ? 11 : 1) * relicEffect("BLESSING_OF_PLANETS");
        t.hit(damage, position);
        if (s.data().target === "burst") {
          s.burstLeft--;
          if (s.burstLeft > 0) s.cooldown = CONFIG.whiteBurstInterval / attackSpeedModifier;
          else {
            s.burstLeft = 3;
            s.cooldown = CONFIG.whiteBurstRest / attackSpeedModifier;
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
        (s?.constellation ? ` constellation-${s.constellation.definitionId.toLowerCase()}` : "") +
        (selectedConstellation?.members.includes(i)
          ? " constellation-linked"
          : "");
      el.innerHTML = s
        ? `<span class="star" style="color:${s.data().color}">✦<b class="star-level">${s.tier}</b>${picked && this.zodiacMode ? `<em class="pick-order">${this.selected.indexOf(i) + 1}</em>` : ""}</span>`
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
    if (!resources.spend(CONFIG.divinationCost))
      return UIManager.hint("별빛이 부족합니다.");
    const success = Math.random() < 0.5;
    resources.starlight += success ? 60 : 15;
    UIManager.divinationEffect(manager.pos(index), success);
    star.constellation.runtime.lastDivinationResult = success ? "success" : "failure";
    UIManager.hint(success ? "점술 결과: 별빛 +60" : "점술 결과: 별빛 +15");
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
    if (!manager.player.resources.spend(CONFIG.guardianLightCost))
      return UIManager.hint("별빛이 부족합니다.");

    const base = game.base;
    if (base.hp < base.maxHp)
      base.hp = Math.min(base.maxHp, base.hp + 50 + base.maxHp * 0.01);
    else {
      base.maxHp *= 1.01;
      base.hp = base.maxHp;
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
    arena.append(d);
    setTimeout(() => d.remove(), 1700);
  }
  static guardianPortal() {
    const portal = document.createElement("div");
    portal.className = "guardian-portal";
    portal.style.left = `${MAP_DEFINITION.destination.x}%`;
    portal.style.top = `${MAP_DEFINITION.destination.y}%`;
    portal.setAttribute("aria-hidden", "true");
    this.addTransient(portal, arena, 650);
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
    arena.append(dot);
    requestAnimationFrame(() => {
      dot.style.transform = `translate(${((to.x - from.x) * arena.clientWidth) / 100}px, ${((to.y - from.y) * arena.clientHeight) / 100}px) scale(.45)`;
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
    arena.append(flash);
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
    arena.append(effect);
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
      damage = Math.round(d.damage * CONFIG.tierDamage[s.tier - 1]),
      rate = d.target === "burst" ? "3연속 후 2초" : `${d.rate}회/초`,
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
    starInfo.innerHTML = constellation
      ? `<strong>✦ ${constellationStats.name}</strong><div class="stats"><span>${pick.player + 1}P · 중심 별</span><span>연결 별 ${constellation.members.length}개</span><span>재료 단계 합: ${constellation.componentStageSum}</span><span>단계 공격력 배율: ×${formatMultiplier(getConstellationStageMultiplier(constellation))}</span>${linkInfo}${strikeInfo}${horizonInfo}<span>현재 공격력: ${Math.round(constellation.currentDamage()).toLocaleString()}</span><span>공격속도 ${constellation.definitionId === CONSTELLATION_IDS.TWILIGHT && constellation.target?.hp <= constellation.target?.maxHp * .5 ? constellationStats.attackSpeed * 2 : constellationStats.attackSpeed}회/초</span><span>사정거리 ${constellation.effectiveRange()}</span>${bondInfo}${constellation.definitionId === CONSTELLATION_IDS.DAWN ? `<span>직접 처치 진행 ${constellation.runtime.dawnKillProgress}/5</span>` : ""}${constellation.definitionId === CONSTELLATION_IDS.RADIANCE ? `<span>최대 연쇄 대상 ${constellation.componentStageSum}</span><span>광휘 처치 수: ${constellation.runtime.radianceKills}</span><span>공격력 증가: +${formatMultiplier(constellation.runtime.radianceKillBonus * 100)}%</span>` : ""}${twilightInfo}</div><div class="trait">${constellationStats.specialDescriptions.join(" · ")}</div>`
      : `<strong>✦ ${d.name} 별</strong><div class="stats"><span>${pick.player + 1}P · ${s.tier}단계</span><span>공격력 ${damage}</span><span>${d.target === "burst" ? "특수 주기" : "공격속도"} ${rate}</span><span>사정거리 ${d.range}</span></div><div class="trait">타겟팅 · ${TARGET_LABELS[d.target]}</div>`;
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
    const actionX = Math.min(arenaRect.width - 54, Math.max(54, arenaRect.width * p.x / 100));
    const actionY = Math.min(arenaRect.height - 42, Math.max(42, arenaRect.height * p.y / 100));
    contextActions.style.left = `${actionX}px`;
    contextActions.style.top = `${actionY}px`;
    if (constellation) {
      let enabled = pick.m.player.resources.divinity >= 1;
      const isAstrologer = constellation.definitionId === CONSTELLATION_IDS.ASTROLOGER;
      const isGuardian = constellation.definitionId === CONSTELLATION_IDS.GUARDIAN;
      const isBond = constellation.definitionId === CONSTELLATION_IDS.BOND;
      const isStrike = constellation.definitionId === CONSTELLATION_IDS.STRIKE;
      const isHorizon = constellation.definitionId === CONSTELLATION_IDS.HORIZON;
      const canDivine = isAstrologer && pick.m.player.resources.can(CONFIG.divinationCost);
      const canUseGuardianLight = isGuardian && pick.m.player.resources.can(CONFIG.guardianLightCost);
      const canOfferBond = isBond && constellation.runtime.bindChance < 1 && pick.m.player.resources.can(CONFIG.bondOfferingCost);
      // definitionId is deliberately part of the cache key: actions from a
      // previous tower type must never survive a selection/type change.
      let actionKey = `${pick.player}:${pick.index}:constellation:${constellation.definitionId}:${enabled}:${canDivine}:${canUseGuardianLight}:${canOfferBond}:${constellation.runtime.bindChance}:${constellation.runtime.strikeStacks || 0}:${constellation.runtime.inheritedDefinitionId || "none"}`;
      if (this.actionKey !== actionKey) {
        contextActions.innerHTML = `${isAstrologer ? `<button class="divination action-above" data-context="divination"${canDivine ? "" : " disabled"}>별빛 점술 30</button>` : ""}${isGuardian ? `<button class="guardian-light action-above" data-context="guardian-light"${canUseGuardianLight ? "" : " disabled"}>수호의 빛 50</button>` : ""}${isBond ? `<button class="bond-offering action-above" data-context="bond-offering"${canOfferBond ? "" : " disabled"}>별빛 헌납 200</button>` : ""}${isStrike ? `<button class="strike-action action-above" data-context="strike"${constellation.runtime.strikeStacks ? "" : " disabled"}>일격 가하기</button>` : ""}${isHorizon ? `<button class="horizon-action action-above" data-context="horizon">지평선의 초점</button>` : ""}<button class="${isAstrologer || isGuardian || isBond || isStrike || isHorizon ? "action-below" : "action-above"}" data-context="release"${enabled ? "" : " disabled"}>별자리 해제 ◇1</button>`;
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
        contextActions.querySelector('[data-context="swap"]').onclick = () =>
          SwapSystem.execute(pick.m, pick.index);
        contextActions.querySelector('[data-context="merge"]')?.addEventListener("click", () =>
          MergeSystem.execute(pick.m));
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
      const charge = g.bindingRelicCharge > 0 ? 1 : 0;
      const bindingLabel = bindingStatus.querySelector?.("b");
      if (bindingLabel) bindingLabel.textContent = charge ? "사용 가능 1/1" : "사용 완료 0/1";
    }
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
class GameManager {
  constructor() {
    this.last = 0;
    this.running = true;
    this.speed = 1;
    this.phase = "PREPARING";
    this.preparationRemaining = PREPARATION_SECONDS;
    this.battleRewardGranted = false;
    this.galaxyFragmentsEarned = 0;
    const initialBaseHp = BASE_MAX_HP + (hasRelic("STEADFAST_HEART") ? RELIC_DEFINITIONS.STEADFAST_HEART.effectValue : 0);
    this.base = { hp: initialBaseHp, maxHp: initialBaseHp };
    Object.defineProperty(this, "baseHP", {
      get: () => this.base.hp,
      set: (value) => { this.base.hp = value; },
    });
    this.enemies = [];
    this.alliedUnits = [];
    this.spatial = new SpatialGrid();
    this.greenStarCount = 0;
    this.activeConstellationStageSum = 0;
    this.gameTime = 0;
    this.attackBuffUntil = 0;
    this.bindingRelicCharge = hasRelic("EVIL_OF_BINDING_STAR") ? RELIC_DEFINITIONS.EVIL_OF_BINDING_STAR.effectValue : 0;
    // A discovery lasts for this game even if its field constellation is later
    // released. It is intentionally not derived from active towers.
    this.discoveredConstellations = new Set();
    this.tasks = [];
    this.dirty = true;
    this.lastHudUpdate = 0;
    window.BOOT_STAGE = "creating-players";
    this.players = [0, 1].map((i) => {
      let p = { index: i, resources: new PlayerResources() };
      p.manager = new StarManager(p, getRequiredElement(`field-${i}`));
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
  recomputeCombatCaches() {
    const constellations = new Set();
    let greenStars = 0;
    this.players.forEach((player) => player.manager.stars.forEach((star) => {
      if (!star) return;
      if (star.type === "green" && !star.support && !star.constellation) greenStars++;
      if (star.constellation) constellations.add(star.constellation);
    }));
    this.greenStarCount = greenStars;
    this.activeConstellationStageSum = [...constellations].reduce((sum, item) => sum + item.componentStageSum, 0);
  }
  start() {
    // The real-time preparation phase deliberately does not start waves.
    this.preparationStartedAt = null;
    this.render();
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
      const rect = arena.getBoundingClientRect();
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
  summonGuardian() {
    UIManager.guardianPortal();
    this.alliedUnits.push(new GuardianUnit(this.base));
  }
  fireBossMeteor(enemy) {
    const projectile = document.createElement("i"); projectile.className = "boss-meteor-projectile";
    projectile.style.left = `${enemy.x}%`; projectile.style.top = `${enemy.y}%`; arena.append(projectile);
    requestAnimationFrame(() => { projectile.style.left = `${MAP_DEFINITION.destination.x}%`; projectile.style.top = `${MAP_DEFINITION.destination.y}%`; });
    this.simulationTimeout(() => {
      projectile.remove(); const impact = document.createElement("i"); impact.className = "base-meteor-impact"; impact.style.left = `${MAP_DEFINITION.destination.x}%`; impact.style.top = `${MAP_DEFINITION.destination.y}%`; UIManager.addTransient(impact, arena, 500);
      this.base.hp = Math.max(0, this.base.hp - 20); this.markDirty(); if (this.base.hp <= 0) { this.running = false; finishBattle?.(this); }
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
    this.players.forEach((p) => {
      p.resources.starlight += e.reward;
      if (e.boss) p.resources.divinity++;
    });
    this.clearEnemyReferences(e);
    sourceConstellation?.registerKill();
    if (e.type === "galaxySlayer" && !e.bossRewardClaimed) {
      e.bossRewardClaimed = true; playerProgress.galaxyFragments++; this.galaxyFragmentsEarned++; savePlayerProgress();
    }
    this.markDirty();
  }
  leak(e) {
    this.clearEnemyReferences(e);
    this.base.hp = Math.max(0, this.base.hp - e.baseDamage);
    if (this.base.hp <= 0) {
      this.running = false;
      finishBattle?.(this);
    }
    this.markDirty();
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
    this.markDirty();
  }
  destroy() {
    this.running = false;
    this.rafRunning = false;
    if (typeof cancelAnimationFrame === "function" && this.rafId) cancelAnimationFrame(this.rafId);
    this.tasks.length = 0;
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

function bootstrapGame() {
  // This function is the only place where required page elements are bound.
  // Assignments are intentionally explicit so missing IDs identify themselves.
  window.BOOT_STAGE = "dom-ready";
  arena = getRequiredElement("arena");
  const pathSvg = getRequiredElement("paths");
  const pathData = routePathData();
  pathSvg.querySelectorAll(".roadGlow,.roadEdge,.road,.roadStars").forEach((path) => path.setAttribute("d", pathData));
  pathSvg.querySelectorAll(".start").forEach((node) => {
    node.setAttribute("cx", MAP_DEFINITION.spawn.x);
    node.setAttribute("cy", MAP_DEFINITION.spawn.y);
  });
  pathSvg.querySelectorAll(".goal").forEach((node) => {
    node.setAttribute("cx", MAP_DEFINITION.destination.x);
    node.setAttribute("cy", MAP_DEFINITION.destination.y);
  });
  const arrowLayer = pathSvg.querySelector(".route-arrows");
  if (arrowLayer) arrowLayer.innerHTML = MAP_DEFINITION.arrows.map((progress) => {
    const point = routePoint(progress);
    const before = routePoint(Math.max(0, progress - .004));
    const after = routePoint(Math.min(1, progress + .004));
    const angle = Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI + 90;
    return `<path d="M0 -2.2L2 1.8L0 .8L-2 1.8Z" transform="translate(${point.x} ${point.y}) rotate(${angle})"/>`;
  }).join("");
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
      getRequiredElement("draw-sequence").replaceChildren(); getRequiredElement("draw-result-grid").replaceChildren();
    },
  };
  const renderCollection = () => {
    getRequiredElement("star-collection").innerHTML = Object.values(STAR_TYPES).map((star) => {
      const entry = playerProgress.starCollection[star.id];
      const cost = starLevelCosts(entry.level);
      const canUpgrade = cost && entry.count >= cost.copies && playerProgress.starShards >= cost.shards;
      return `<article class="collection-card star-collection-card ${entry.count ? "owned" : "locked"}" style="--star-color:${star.color}"><div class="collection-star">✦</div><h3>${star.name} 별</h3><b class="permanent-level">${cost ? `Lv.${entry.level}` : "Lv.7 · MAX"}</b><div class="star-upgrade-details"><span>보유 별: <b>${entry.count}${cost ? ` / ${cost.copies}` : ""}</b></span><span>별조각: <b>${playerProgress.starShards}${cost ? ` / ${cost.shards}` : ""}</b></span>${cost ? `<small>다음 비용 · ${star.name} 별 ×${cost.copies} + 별조각 ×${cost.shards}</small>` : `<small>최대 레벨 · 복사본은 계속 보관됩니다.</small>`}</div><button type="button" data-upgrade-star="${star.id}"${canUpgrade ? "" : " disabled"}>${cost ? "레벨업" : "MAX"}</button></article>`;
    }).join("");
    getRequiredElement("constellation-collection").innerHTML = Object.values(CONSTELLATION_DEFINITIONS).map((definition) => {
      const owned = playerProgress.ownedConstellations.includes(definition.id);
      const order = playerProgress.equippedConstellations.indexOf(definition.id);
      const entry = playerProgress.constellationCollection[definition.id];
      const cost = entry && CONSTELLATION_LEVEL_COSTS[entry.level];
      const canUpgrade = cost && entry.copies >= cost.copies && playerProgress.galaxyFragments >= cost.galaxyFragments;
      return `<article class="collection-card constellation-collection-card ${owned ? "owned" : "locked"} ${order >= 0 ? "equipped" : ""}">${order >= 0 ? `<b class="equip-order">${order + 1}</b>` : ""}${constellationPreview(definition)}<h3>${definition.name}</h3>${owned ? `<b class="permanent-level">${cost ? `Lv.${entry.level}` : "Lv.4 · MAX"}</b><div class="constellation-upgrade-details"><span>복사본 <b>${entry.copies}${cost ? ` / ${cost.copies}` : ""}</b></span><span>은하파편 <b>${playerProgress.galaxyFragments}${cost ? ` / ${cost.galaxyFragments}` : ""}</b></span></div><div class="collection-actions"><button type="button" data-equip-constellation="${definition.id}">${order >= 0 ? "장착 해제" : "전투 장착"}</button><button type="button" data-upgrade-constellation="${definition.id}"${canUpgrade ? "" : " disabled"}>${cost ? `Lv.${entry.level + 1} 강화` : "MAX"}</button></div>` : "<small>🔒 미획득</small>"}</article>`;
    }).join("");
    document.querySelectorAll("[data-deck-count]").forEach((node) => { node.textContent = playerProgress.equippedConstellations.length; });
    document.querySelectorAll("[data-equip-constellation]").forEach((button) => { button.onclick = () => { const result = toggleEquippedConstellation(button.dataset.equipConstellation); if (!result.ok) showToast(result.message); renderCollection(); }; });
    document.querySelectorAll("[data-upgrade-star]").forEach((button) => { button.onclick = () => { if (upgradeStar(button.dataset.upgradeStar)) { updateMetaCurrency(); renderCollection(); } }; });
    document.querySelectorAll("[data-upgrade-constellation]").forEach((button) => { button.onclick = () => { if (upgradeConstellation(button.dataset.upgradeConstellation)) { updateMetaCurrency(); renderCollection(); } }; });
  };
  const renderRelics = () => {
    getRequiredElement("relic-collection").innerHTML = Object.values(RELIC_DEFINITIONS).map((relic) => {
      const owned = playerProgress.ownedRelics.includes(relic.id);
      return `<article class="relic-card ${owned ? "owned" : "locked"}" data-relic="${relic.id}"><i>${owned ? relic.icon : "🔒"}</i><div><small>${relic.effectType}</small><h2>${owned ? relic.name : "미획득 유물"}</h2><p>${owned ? relic.description : "운석조각 뽑기에서 이 유물을 해금할 수 있습니다."}</p></div></article>`;
    }).join("");
  };
  const showMainMenu = () => { updateMetaCurrency(); showScreen(SCREEN_STATES.MAIN_MENU); };
  const showBattleMenu = () => showScreen(SCREEN_STATES.BATTLE_MENU);
  const showGacha = () => { updateMetaCurrency(); showScreen(SCREEN_STATES.GACHA); };
  const showCollection = () => { renderCollection(); showScreen(SCREEN_STATES.COLLECTION); };
  const showRelics = () => { renderRelics(); showScreen(SCREEN_STATES.RELICS); };
  const startBattle = () => {
    if (currentScreen !== SCREEN_STATES.BATTLE_MENU) return false;
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
    game.start();
    return true;
  };
  finishBattle = (battle = game) => {
    if (!battle) return 0;
    const reachedWave = Math.max(0, Math.floor(battle.wave.wave));
    const rewardMultiplier = relicEffect("SUPERNOVA_TEAR");
    const reward = Math.floor(reachedWave * 4 * rewardMultiplier);
    const shardReward = reachedWave * 2;
    const meteorReward = Math.floor(reachedWave / 5);
    if (!battle.battleRewardGranted) {
      battle.battleRewardGranted = true;
      battle.starDustReward = reward;
      battle.starShardReward = shardReward;
      battle.meteorFragmentReward = meteorReward;
      playerProgress.starDust += reward;
      playerProgress.starShards += shardReward;
      playerProgress.meteorFragments += meteorReward;
      savePlayerProgress();
    }
    battle.running = false;
    battle.rafRunning = false;
    if (typeof cancelAnimationFrame === "function" && battle.rafId) cancelAnimationFrame(battle.rafId);
    finalWave.textContent = reachedWave;
    getRequiredElement("dustReward").textContent = battle.starDustReward ?? reward;
    getRequiredElement("shardReward").textContent = battle.starShardReward ?? shardReward;
    getRequiredElement("meteorFragmentReward").textContent = battle.meteorFragmentReward ?? meteorReward;
    const galaxyReward = battle.galaxyFragmentsEarned || 0;
    getRequiredElement("galaxyFragmentReward").textContent = galaxyReward;
    getRequiredElement("galaxyRewardRow").hidden = galaxyReward === 0;
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
  document.querySelectorAll?.("[data-main-home]").forEach((button) => { button.onclick = navigateOnce(showMainMenu); });
  getRequiredElement("battle-back").onclick = navigateOnce(showMainMenu);
  getRequiredElement("play-battle").onclick = navigateOnce(startBattle);
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
      const count = Number(button.dataset.cost) === (relicDraw ? 100 : 1000) ? 10 : 1;
      const results = relicDraw ? performRelicDraws(count) : performConstellationDraws(count);
      if (!results) return showToast(relicDraw ? "운석조각이 부족합니다." : "별가루가 부족합니다.");
      const resultSequence = getRequiredElement("draw-sequence");
      resultSequence.innerHTML = relicDraw ? relicSummonPreview() : summonSequencePreview(results);
      getRequiredElement("draw-result-grid").innerHTML = results.map((result, index) => result.kind === "relic"
        ? `<article class="draw-result relic-result" style="--result-order:${index}"><em>${result.isNew ? "NEW" : "보유 중"}</em><i>${RELIC_DEFINITIONS[result.id].icon}</i><b>${RELIC_DEFINITIONS[result.id].name}</b><small>${RELIC_DEFINITIONS[result.id].description}</small></article>`
        : result.kind === "star"
        ? `<article class="draw-result star-result" style="--star-color:${STAR_TYPES[result.id].color};--result-order:${index}"><i>✦</i><b>${STAR_TYPES[result.id].name} 별</b></article>`
        : `<article class="draw-result constellation-result constellation-${result.id.toLowerCase()}" style="--result-order:${index};--identity:${CONSTELLATION_SUMMON_COLORS[result.id][0]}">${result.isNew ? "<em>NEW</em>" : "<em>보유 중</em>"}${constellationPreview(CONSTELLATION_DEFINITIONS[result.id])}<b>${CONSTELLATION_DEFINITIONS[result.id].name}</b><strong>${result.id}</strong>${result.guaranteed ? "<small>확정 소환</small>" : ""}</article>`).join("");
      summonController.begin(results);
      updateMetaCurrency(); renderCollection(); renderRelics();
    };
  });
  getRequiredElement("skip-summon").onclick = () => summonController.skip();
  getRequiredElement("close-draw-results").onclick = () => summonController.close();
  window.addEventListener("resize", () => {
    RangeSystem.refresh();
    game?.markDirty();
  }, { passive: true });
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  showMainMenu();
  if (specialGrantApplied) showToast("특별 지급\n별가루 +5,000\n운석조각 +20");
  const diagnostics = {
    CONFIG, STAR_TYPES, STARTER_COLLECTION, RELIC_DEFINITIONS, GACHA_RULES, CONSTELLATION_IDS, CONSTELLATION_DEFINITIONS, ZODIAC_RECIPES, RECIPE_COUNTS, recipeCountsMatch, SCREEN_STATES, SUMMON_STATES, PREPARATION_SECONDS, GACHA_COSTS, STAR_LEVEL_COSTS, CONSTELLATION_LEVEL_COSTS, playerProgress, performConstellationDraws, performRelicDraws, effectiveMaxStars, toggleEquippedConstellation, starLevelCosts, starLevelDamageMultiplier, starLevelAttackSpeedBonus, constellationLevelDamageMultiplier, constellationLevelAttackSpeedBonus, upgradeStar, upgradeConstellation, bossTypeForWave, summonController,
    get game() { return game; },
    get currentScreen() { return currentScreen; },
    showMainMenu, showBattleMenu, showGacha, startBattle, leaveBattle, finishBattle,
    classes: { Enemy, GuardianUnit, WaveManager, Star, Targeting, RangeSystem, SpatialGrid, Constellation },
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
