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
const SCREEN_STATES = Object.freeze({ MAIN_MENU: "MAIN_MENU", BATTLE_MENU: "BATTLE_MENU", BATTLE_GAME: "BATTLE_GAME", GACHA: "GACHA", COLLECTION: "COLLECTION" });
const PROGRESS_STORAGE_KEY = "zodiacDefenseProgress";
const PREPARATION_SECONDS = 15;
const GACHA_COSTS = Object.freeze({ constellation: Object.freeze([100, 1000]), relic: Object.freeze([10, 100]) });
const GACHA_RULES = Object.freeze({ starChance: .9, constellationChance: .1, pityLimit: 20 });
const MAX_EQUIPPED_CONSTELLATIONS = 6;
const LEGACY_STAR_IDS = Object.freeze({ SKY: "YELLOW", SKYBLUE: "YELLOW", LIGHT_BLUE: "YELLOW", sky: "YELLOW", skyblue: "YELLOW", light_blue: "YELLOW" });
const PLACEHOLDER_STAR_COMBAT_STATS = Object.freeze({ damage: 100, rate: 2, range: 5, target: "nearest" }); // TODO: 보라색/초록색의 정식 전투 밸런스를 확정한다.
const STAR_TYPES = Object.freeze({
  BLUE: Object.freeze({ id: "BLUE", key: "blue", name: "청색", color: "#4d83ff", damage: 50, rate: 4, range: 5, target: "lock" }),
  WHITE: Object.freeze({ id: "WHITE", key: "white", name: "백색", color: "#ffffff", damage: 100, rate: 3.5, range: 6, target: "burst" }),
  YELLOW: Object.freeze({ id: "YELLOW", key: "yellow", name: "황색", color: "#ffd84d", damage: 75, rate: 2, range: 7, target: "random" }),
  ORANGE: Object.freeze({ id: "ORANGE", key: "orange", name: "주황색", color: "#ffad45", damage: 125, rate: 1.5, range: 4, target: "nearest" }),
  RED: Object.freeze({ id: "RED", key: "red", name: "적색", color: "#ff5064", damage: 200, rate: 1, range: 5, target: "highest" }),
  PURPLE: Object.freeze({ id: "PURPLE", key: "purple", name: "보라색", color: "#b16cff", ...PLACEHOLDER_STAR_COMBAT_STATS }),
  GREEN: Object.freeze({ id: "GREEN", key: "green", name: "초록색", color: "#55db85", ...PLACEHOLDER_STAR_COMBAT_STATS }),
});
const STARTER_COLLECTION = Object.freeze({
  ownedStars: Object.freeze({ BLUE: 1, WHITE: 1, YELLOW: 1, ORANGE: 1, RED: 1 }),
  ownedConstellations: Object.freeze(["DAWN"]),
  equippedConstellations: Object.freeze(["DAWN"]),
});
function normalizeStarId(value) {
  const raw = String(value || "");
  return LEGACY_STAR_IDS[raw] || LEGACY_STAR_IDS[raw.toUpperCase()] || raw.toUpperCase();
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
    return {
      starFragments: Math.max(0, Number.isFinite(saved?.starFragments) ? Math.floor(saved.starFragments) : 0),
      meteorFragments: Math.max(0, Number.isFinite(saved?.meteorFragments) ? Math.floor(saved.meteorFragments) : 0),
      ownedStars,
      ownedConstellations,
      equippedConstellations,
      constellationPity: Math.min(GACHA_RULES.pityLimit - 1, Math.max(0, Number.isFinite(saved?.constellationPity) ? Math.floor(saved.constellationPity) : 0)),
    };
  } catch (_error) {
    return { starFragments: 0, meteorFragments: 0, ownedStars: { ...STARTER_COLLECTION.ownedStars }, ownedConstellations: [...STARTER_COLLECTION.ownedConstellations], equippedConstellations: [...STARTER_COLLECTION.equippedConstellations], constellationPity: 0 };
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
  if (![1, 10].includes(count) || playerProgress.starFragments < cost) return null;
  const next = {
    pity: playerProgress.constellationPity,
    stars: { ...playerProgress.ownedStars },
    constellations: [...playerProgress.ownedConstellations],
  };
  const constellationIds = Object.keys(CONSTELLATION_DEFINITIONS);
  const starIds = Object.keys(STAR_TYPES);
  const results = [];
  for (let index = 0; index < count; index++) {
    const guaranteed = next.pity >= GACHA_RULES.pityLimit - 1;
    if (guaranteed || random() < GACHA_RULES.constellationChance) {
      const id = constellationIds[Math.min(constellationIds.length - 1, Math.floor(random() * constellationIds.length))];
      const isNew = !next.constellations.includes(id);
      if (isNew) next.constellations.push(id);
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
  playerProgress.starFragments -= cost;
  playerProgress.constellationPity = next.pity;
  playerProgress.ownedStars = next.stars;
  playerProgress.ownedConstellations = next.constellations;
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
});
const BASE_MAX_HP = 400;
const MAX_STARS_PER_PLAYER = 15;
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
      "새벽의 자리가 몬스터를 3마리 처치할 때마다 모든 적에게 각 적의 현재 체력의 20%만큼 피해를 줍니다.",
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
      "별빛 점술 30: 50% 확률로 +60, 실패 시 추가 -15 (별빛은 0 미만이 되지 않음)",
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
  divinationFailureCost: 15,
  guardianLightCost: 50,
  startStarlight: 5000,
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
    },
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
  };
class PlayerResources {
  constructor() {
    this.starlight = CONFIG.startStarlight;
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
    this.engagedAlly = null;
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
    if (this.engagedAlly && !this.engagedAlly.dead) return;
    this.engagedAlly = null;
    this.progress += this.speed * dt;
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
    this.hp -= n;
    UIManager.beam(from, this.position());
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      this.el.remove();
      game.kill(this, sourceConstellation);
    } else this.updateHealthBar();
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
      let type = n % 20 === 0 ? "meteor" : "drone";
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
    return [{ type: n % 20 === 0 ? "meteor" : "drone", count: 1 }];
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
          UIManager.dawnSpecial(target.position(), specialDamage);
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
    this.cooldown -= dt;
    const position = this.owner.pos(this.center);
    if (this.target && (this.target.dead || !RangeSystem.contains(position, this.target.position(), this.effectiveRange())))
      this.resetTarget();
    if (this.definitionId === CONSTELLATION_IDS.TWILIGHT) {
      const nextSpeed = this.effectiveAttackSpeed(this.target);
      const previousSpeed = this.runtime.currentAttackSpeed || this.definition.attackSpeed;
      if (nextSpeed !== previousSpeed && this.cooldown > 0)
        this.cooldown *= previousSpeed / nextSpeed;
      this.runtime.currentAttackSpeed = nextSpeed;
    }
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
    if (this.definitionId === CONSTELLATION_IDS.RADIANCE) this.resetTarget();
    else if (target.dead) this.resetTarget();
    const attackSpeed = this.effectiveAttackSpeed(target);
    this.cooldown = 1 / attackSpeed;
  }
  currentDamage(localMultiplier = 1) {
    const allyMultiplier = game.attackBuffUntil > game.gameTime ? 11 : 1;
    const killMultiplier = this.definitionId === CONSTELLATION_IDS.RADIANCE
      ? 1 + this.runtime.radianceKillBonus
      : 1;
    return getStageScaledDamage(this) * killMultiplier * allyMultiplier * localMultiplier;
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
    if (this.runtime.dawnKillProgress < 3) {
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
    if (this.definitionId === CONSTELLATION_IDS.TWILIGHT && target && !target.dead && target.hp <= target.maxHp * 0.50)
      return this.definition.attackSpeed * 2;
    return this.definition.attackSpeed;
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
    this.originalComponents.forEach((saved) => {
      const star = this.owner.stars[saved.index];
      Object.assign(star, { type: saved.type, tier: saved.tier, x: saved.x, y: saved.y });
      star.support = false;
      star.constellation = null;
    });
    this.connectionOrder.length = 0;
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
    game.render();
    UIManager.summonEffect?.(this, i);
    return true;
  }
  tap(i) {
    if (!this.stars[i]) return;
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
  }
  update(dt) {
    this.stars.forEach((s, i) => {
      if (!s || s.support) return;
      if (s.constellation) {
        s.constellation.attack(dt);
        return;
      }
      s.cooldown -= dt;
      if (s.cooldown > 0) return;
      const position = this.pos(i);
      const effectiveRange = s.data().range;
      if (s.lock && (s.lock.dead || !RangeSystem.contains(position, s.lock.position(), effectiveRange)))
        s.lock = null;
      let t = s.lock || Targeting.choose(s, game.enemies, position);
      if (t) {
        s.lock = t;
        let damage = s.data().damage * CONFIG.tierDamage[s.tier - 1] *
          (game.attackBuffUntil > game.gameTime ? 11 : 1);
        t.hit(damage, position);
        if (s.data().target === "burst") {
          s.burstLeft--;
          if (s.burstLeft > 0) s.cooldown = CONFIG.whiteBurstInterval;
          else {
            s.burstLeft = 3;
            s.cooldown = CONFIG.whiteBurstRest;
          }
        } else s.cooldown = 1 / s.data().rate;
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
    if (
      !definitionId ||
      picks.some((i) => m.stars[i].support || m.stars[i].constellation)
    )
      return UIManager.hint("선택한 별과 정확히 일치하는 별자리가 없습니다.");
    let center = picks[0],
      points = picks.map((i) => m.pos(i));
    new Constellation(m, center, [...picks], definitionId, connectionOrder);
    game.discoverConstellation(definitionId);
    m.exitModes();
    UIManager.zodiacComplete(points);
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
    if (success) resources.starlight += 60;
    else resources.starlight = Math.max(
      0,
      resources.starlight - CONFIG.divinationFailureCost,
    );
    UIManager.divinationEffect(manager.pos(index), success);
    star.constellation.runtime.lastDivinationResult = success ? "success" : "failure";
    UIManager.hint(success ? "점술 성공! +60" : "점술 실패... -15");
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
  static dawnSpecial(position, damage) {
    const burst = document.createElement("div");
    burst.className = "dawn-special";
    burst.style.left = `${position.x}%`;
    burst.style.top = `${position.y}%`;
    burst.setAttribute("aria-hidden", "true");
    burst.innerHTML = `<i class="dawn-flash"></i><i class="dawn-shockwave"></i><svg viewBox="0 0 100 70"><path d="M87 9C65 58 29 69 7 46c28 11 55-3 80-37Z"/></svg>${Array.from({ length: 8 }, (_, i) => `<i class="dawn-spark" style="--angle:${i * 45}deg"></i>`).join("")}<b>${Math.round(damage).toLocaleString()}</b>`;
    this.addTransient(burst, arena, 480);
  }
  static dawnMoonfall(origin, enemies) {
    const flash = document.createElement("i");
    flash.className = "dawn-moonfall-flash";
    flash.setAttribute("aria-hidden", "true");
    this.addTransient(flash, arena, 520);

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
    effect.textContent = success ? "점술 성공! +60" : "점술 실패... -15";
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
  static zodiacComplete(points) {
    points.slice(0, -1).forEach((from, i) => {
      const to = points[i + 1];
      game.simulationTimeout(() => {
        effects.insertAdjacentHTML(
          "beforeend",
          `<line class="link-form" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>`,
        );
        for (let n = 0; n < 4; n++)
          effects.insertAdjacentHTML(
            "beforeend",
            `<circle class="spark" cx="${from.x + ((to.x - from.x) * (n + 1)) / 5}" cy="${from.y + ((to.y - from.y) * (n + 1)) / 5}" r="${0.35 + n * 0.06}"/>`,
          );
      }, i * 90);
    });
    game.simulationTimeout(
      () =>
        effects.insertAdjacentHTML(
          "beforeend",
          `<circle class="complete-wave" cx="${points[0].x}" cy="${points[0].y}" r="2.5"/>`,
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
    starInfo.innerHTML = constellation
      ? `<strong>✦ ${constellationStats.name}</strong><div class="stats"><span>${pick.player + 1}P · 중심 별</span><span>연결 별 ${constellation.members.length}개</span><span>재료 단계 합: ${constellation.componentStageSum}</span><span>단계 공격력 배율: ×${formatMultiplier(getConstellationStageMultiplier(constellation))}</span><span>현재 공격력: ${Math.round(constellation.currentDamage()).toLocaleString()}</span><span>공격속도 ${constellation.definitionId === CONSTELLATION_IDS.TWILIGHT && constellation.target?.hp <= constellation.target?.maxHp * .5 ? constellationStats.attackSpeed * 2 : constellationStats.attackSpeed}회/초</span><span>사정거리 ${constellation.effectiveRange()}</span>${constellation.definitionId === CONSTELLATION_IDS.DAWN ? `<span>직접 처치 진행 ${constellation.runtime.dawnKillProgress}/3</span>` : ""}${constellation.definitionId === CONSTELLATION_IDS.RADIANCE ? `<span>최대 연쇄 대상 ${constellation.componentStageSum}</span><span>광휘 처치 수: ${constellation.runtime.radianceKills}</span><span>공격력 증가: +${formatMultiplier(constellation.runtime.radianceKillBonus * 100)}%</span>` : ""}${twilightInfo}</div><div class="trait">${constellationStats.specialDescriptions.join(" · ")}</div>`
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
      const canDivine = isAstrologer && pick.m.player.resources.can(CONFIG.divinationCost);
      const canUseGuardianLight = isGuardian && pick.m.player.resources.can(CONFIG.guardianLightCost);
      // definitionId is deliberately part of the cache key: actions from a
      // previous tower type must never survive a selection/type change.
      let actionKey = `${pick.player}:${pick.index}:constellation:${constellation.definitionId}:${enabled}:${canDivine}:${canUseGuardianLight}`;
      if (this.actionKey !== actionKey) {
        contextActions.innerHTML = `${isAstrologer ? `<button class="divination action-above" data-context="divination"${canDivine ? "" : " disabled"}>별빛 점술 30</button>` : ""}${isGuardian ? `<button class="guardian-light action-above" data-context="guardian-light"${canUseGuardianLight ? "" : " disabled"}>수호의 빛 50</button>` : ""}<button class="${isAstrologer || isGuardian ? "action-below" : "action-above"}" data-context="release"${enabled ? "" : " disabled"}>별자리 해제 ◇1</button>`;
        if (isAstrologer)
          contextActions.querySelector('[data-context="divination"]').onclick = () =>
            DivinationSystem.execute(pick.m, pick.index);
        if (isGuardian)
          contextActions.querySelector('[data-context="guardian-light"]').onclick = () =>
            GuardianLightSystem.execute(pick.m, pick.index);
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
                `<line class="link${selected ? " selected" : ""}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`,
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
    this.base = { hp: BASE_MAX_HP, maxHp: BASE_MAX_HP };
    Object.defineProperty(this, "baseHP", {
      get: () => this.base.hp,
      set: (value) => { this.base.hp = value; },
    });
    this.enemies = [];
    this.alliedUnits = [];
    this.spatial = new SpatialGrid();
    this.gameTime = 0;
    this.attackBuffUntil = 0;
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
  kill(e, sourceConstellation = null) {
    this.players.forEach((p) => {
      p.resources.starlight += e.reward;
      if (e.boss) p.resources.divinity++;
    });
    this.clearEnemyReferences(e);
    sourceConstellation?.registerKill();
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
    exitDialog.hidden = true;
  };
  const updateMetaCurrency = () => {
    document.querySelectorAll?.("[data-star-fragments]").forEach((node) => {
      node.textContent = playerProgress.starFragments.toLocaleString("ko-KR");
    });
    document.querySelectorAll?.("[data-meteor-fragments]").forEach((node) => {
      node.textContent = playerProgress.meteorFragments.toLocaleString("ko-KR");
    });
    document.querySelectorAll?.("[data-draw]").forEach((button) => {
      const balance = button.dataset.draw === "relic" ? playerProgress.meteorFragments : playerProgress.starFragments;
      button.disabled = balance < Number(button.dataset.cost);
    });
    document.querySelectorAll?.("[data-constellation-pity]").forEach((node) => { node.textContent = `${playerProgress.constellationPity} / ${GACHA_RULES.pityLimit}`; });
  };
  const showToast = (message) => {
    toast.textContent = message; toast.hidden = false; clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
  };
  const renderCollection = () => {
    getRequiredElement("star-collection").innerHTML = Object.values(STAR_TYPES).map((star) => {
      const count = playerProgress.ownedStars[star.id] || 0;
      return `<article class="collection-card star-collection-card ${count ? "owned" : "locked"}" style="--star-color:${star.color}"><div class="collection-star">✦</div><h3>${star.name}</h3><small>${count ? `보유 ${count}` : "🔒 미획득"}</small></article>`;
    }).join("");
    getRequiredElement("constellation-collection").innerHTML = Object.values(CONSTELLATION_DEFINITIONS).map((definition) => {
      const owned = playerProgress.ownedConstellations.includes(definition.id);
      const order = playerProgress.equippedConstellations.indexOf(definition.id);
      return `<button type="button" class="collection-card constellation-collection-card ${owned ? "owned" : "locked"} ${order >= 0 ? "equipped" : ""}" data-equip-constellation="${definition.id}">${order >= 0 ? `<b class="equip-order">${order + 1}</b>` : ""}${constellationPreview(definition)}<h3>${definition.name}</h3><small>${!owned ? "🔒 미획득" : order >= 0 ? "전투 장착 중" : "전투에 장착"}</small></button>`;
    }).join("");
    document.querySelectorAll("[data-deck-count]").forEach((node) => { node.textContent = playerProgress.equippedConstellations.length; });
    document.querySelectorAll("[data-equip-constellation]").forEach((button) => { button.onclick = () => { const result = toggleEquippedConstellation(button.dataset.equipConstellation); if (!result.ok) showToast(result.message); renderCollection(); }; });
  };
  const showMainMenu = () => { updateMetaCurrency(); showScreen(SCREEN_STATES.MAIN_MENU); };
  const showBattleMenu = () => showScreen(SCREEN_STATES.BATTLE_MENU);
  const showGacha = () => { updateMetaCurrency(); showScreen(SCREEN_STATES.GACHA); };
  const showCollection = () => { renderCollection(); showScreen(SCREEN_STATES.COLLECTION); };
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
    const reward = reachedWave * 2;
    const meteorReward = Math.floor(reachedWave / 20);
    if (!battle.battleRewardGranted) {
      battle.battleRewardGranted = true;
      battle.starFragmentReward = reward;
      battle.meteorFragmentReward = meteorReward;
      playerProgress.starFragments += reward;
      playerProgress.meteorFragments += meteorReward;
      savePlayerProgress();
    }
    battle.running = false;
    battle.rafRunning = false;
    if (typeof cancelAnimationFrame === "function" && battle.rafId) cancelAnimationFrame(battle.rafId);
    finalWave.textContent = reachedWave;
    getRequiredElement("fragmentReward").textContent = battle.starFragmentReward ?? reward;
    getRequiredElement("meteorFragmentReward").textContent = battle.meteorFragmentReward ?? meteorReward;
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
      if (button.disabled) return;
      if (button.dataset.draw === "relic") return showToast("유물 뽑기 확률 설정 후 이용할 수 있습니다.");
      const results = performConstellationDraws(Number(button.dataset.cost) === 1000 ? 10 : 1);
      if (!results) return showToast("별조각이 부족합니다.");
      getRequiredElement("draw-result-grid").innerHTML = results.map((result) => result.kind === "star"
        ? `<article class="draw-result star-result" style="--star-color:${STAR_TYPES[result.id].color}"><i>✦</i><b>${STAR_TYPES[result.id].name} 별</b></article>`
        : `<article class="draw-result constellation-result">${result.isNew ? "<em>NEW</em>" : "<em>보유 중</em>"}${constellationPreview(CONSTELLATION_DEFINITIONS[result.id])}<b>${CONSTELLATION_DEFINITIONS[result.id].name}</b>${result.guaranteed ? "<small>확정 소환</small>" : ""}</article>`).join("");
      getRequiredElement("draw-results").hidden = false;
      updateMetaCurrency(); renderCollection();
    };
  });
  getRequiredElement("close-draw-results").onclick = () => { getRequiredElement("draw-results").hidden = true; };
  window.addEventListener("resize", () => {
    RangeSystem.refresh();
    game?.markDirty();
  }, { passive: true });
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  showMainMenu();
  const diagnostics = {
    CONFIG, STAR_TYPES, STARTER_COLLECTION, GACHA_RULES, CONSTELLATION_IDS, CONSTELLATION_DEFINITIONS, ZODIAC_RECIPES, RECIPE_COUNTS, recipeCountsMatch, SCREEN_STATES, PREPARATION_SECONDS, GACHA_COSTS, playerProgress, performConstellationDraws, toggleEquippedConstellation,
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
