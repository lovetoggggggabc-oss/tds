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
let wave, timer, hp, starlight1, divinity1, starlight2, divinity2;
let speed, restart, finalWave, gameover;
let game = null;
const CONSTELLATION_IDS = Object.freeze({
  DAWN: "DAWN",
  RADIANCE: "RADIANCE",
  SAGITTARIUS: "SAGITTARIUS",
  ASTROLOGER: "ASTROLOGER",
});
const BASE_MAX_HP = 5000;
// This is the sole source of truth for recipes, construction, combat stats,
// contextual actions, effects and the codex.
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
    abilities: Object.freeze(["같은 적을 4회 공격하면 현재 공격력의 1500% 특수 피해 (기본 공격력 기준 7,500)"]),
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
    abilities: Object.freeze(["구성 별들의 단계 합만큼 서로 다른 적에게 연쇄 공격. 각 대상은 광휘의 별자리 공격력만큼 피해"]),
  }),
  [CONSTELLATION_IDS.SAGITTARIUS]: Object.freeze({
    id: CONSTELLATION_IDS.SAGITTARIUS, name: "궁수자리",
    recipe: Object.freeze({ sky: 2, blue: 2 }), attackDamage: 400,
    attackSpeed: 6, range: 6, targeting: "highest",
    previewLayout: Object.freeze({
      nodes: Object.freeze([[18, 68], [43, 48], [67, 25], [58, 76]]),
      edges: Object.freeze([[0, 1], [1, 2], [1, 3], [3, 2]]),
    }),
    abilities: Object.freeze([
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
    abilities: Object.freeze([
      "공격 성공 시 별빛 1 + 현재 활성화된 완성 별자리 수 획득",
      "별빛 점술 30: 50% 확률로 +60, 실패 시 추가 -15 (별빛은 0 미만이 되지 않음)",
    ]),
  }),
});
const CONFIG = {
  waveSeconds: 15,
  bossWaveSeconds: 25,
  summonCost: 30,
  swapCost: 10,
  divinationCost: 30,
  divinationFailureCost: 15,
  startStarlight: 5000,
  startDivinity: 50,
  baseMaxHP: BASE_MAX_HP,
  // One range unit is this percentage of the arena width. RangeSystem is the
  // single conversion point used by both targeting and the circular overlay.
  rangeUnit: 6.3,
  waveHpGrowth: 0.12,
  tierDamage: [1, 1.7, 2.8, 4.4],
  whiteBurstInterval: 0.16,
  whiteBurstRest: 2,
  monsters: {
    slime: { name: "어둠 슬라임", hp: 500, speed: 4.6, reward: 1, baseDamage: 100 },
    bug: { name: "암흑 벌레", hp: 800, speed: 7, reward: 2, baseDamage: 150 },
    drone: {
      name: "코어 드론",
      hp: 10000,
      speed: 2.8,
      reward: 30,
      baseDamage: 500,
      boss: true,
    },
    meteor: {
      name: "운석 괴물",
      hp: 20000,
      speed: 1.8,
      reward: 50,
      baseDamage: 1000,
      boss: true,
    },
  },
  stars: {
    blue: {
      name: "청색",
      color: "#4d83ff",
      damage: 50,
      rate: 4,
      range: 5,
      target: "lock",
    },
    sky: {
      name: "하늘색",
      color: "#74e8ff",
      damage: 75,
      rate: 2,
      range: 7,
      target: "random",
    },
    white: {
      name: "백색",
      color: "#fff",
      damage: 100,
      rate: 3.5,
      range: 6,
      target: "burst",
    },
    orange: {
      name: "주황색",
      color: "#ffad45",
      damage: 125,
      rate: 1.5,
      range: 4,
      target: "nearest",
    },
    red: {
      name: "적색",
      color: "#ff5064",
      damage: 200,
      rate: 1,
      range: 5,
      target: "highest",
    },
  },
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
    this.lane = lane;
    this.progress = 0;
    this.maxHp = this.hp * Math.pow(1 + CONFIG.waveHpGrowth, wave - 1);
    this.hp = this.maxHp;
    this.dead = false;
    this.x = 8;
    this.y = lane === 0 ? 7 : 93;
    this.lastHpPercent = -1;
    this.el = document.createElement("div");
    this.el.className = `enemy ${this.type}${this.boss ? " boss" : ""}`;
    this.el.innerHTML = `<div class="bar" aria-hidden="true"><i></i></div><span class="enemy-body"></span><small>${this.boss ? this.name : ""}</small>`;
    this.hpFill = this.el.querySelector(".bar i");
    arena.append(this.el);
    this.updateHealthBar();
    this.render();
  }
  position() {
    return { x: this.x, y: this.y };
  }
  calculatePosition() {
    let p = this.progress;
    // lane 0 starts beside 2P and travels down; lane 1 starts beside 1P and travels up.
    if (p < 43) return { x: 8, y: this.lane === 0 ? 7 + p : 93 - p };
    return { x: 8 + ((p - 43) * 81) / 57, y: 50 };
  }
  render() {
    const metrics = RangeSystem.metrics();
    this.el.style.transform = `translate3d(${(this.x * metrics.width) / 100}px, ${(this.y * metrics.height) / 100}px, 0)`;
  }
  update(dt) {
    this.progress += this.speed * dt;
    const position = this.calculatePosition();
    this.x = position.x;
    this.y = position.y;
    if (this.progress >= 100) {
      this.dead = true;
      this.el.remove();
      game.leak(this);
    } else this.render();
  }
  hit(n, from) {
    this.hp -= n;
    UIManager.beam(from, this.position());
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      this.el.remove();
      game.kill(this);
    } else this.updateHealthBar();
  }
  updateHealthBar() {
    const hpPercent = Math.max(0, Math.min(100, (this.hp / this.maxHp) * 100));
    if (hpPercent !== this.lastHpPercent) {
      this.hpFill.style.width = `${hpPercent}%`;
      this.lastHpPercent = hpPercent;
    }
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
      this.queue.push({ at: 0, type, lane: n % 2 });
    } else {
      let count = Math.min(4 + Math.floor(n * 1.2), 25);
      for (let i = 0; i < count; i++)
        this.queue.push({
          at: i * 0.7,
          type: (i + n) % 3 === 0 ? "bug" : "slime",
          lane: i % 2,
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
class Star {
  constructor(type, tier = 1) {
    this.type = type;
    this.tier = tier;
    this.cooldown = Math.random() * 0.3;
    this.burstLeft = 3;
    this.lock = null;
    this.constellation = null;
    this.support = false;
  }
  data() {
    return CONFIG.stars[this.type];
  }
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
    createRuntime: () => ({ sameTargetId: null, sameTargetHits: 0 }),
    onTargetChanged(constellation, target) {
      constellation.runtime.sameTargetId = target;
      constellation.runtime.sameTargetHits = 0;
    },
    attack(constellation, target, origin) {
      const damage = constellation.currentDamage();
      target.hit(damage, origin);
      const runtime = constellation.runtime;
      runtime.sameTargetHits++;
      if (runtime.sameTargetHits === constellation.definition.specialHits) {
        if (!target.dead) {
          const specialDamage = damage * constellation.definition.specialMultiplier;
          UIManager.dawnSpecial(target.position(), specialDamage);
          target.hit(specialDamage, origin);
        }
        runtime.sameTargetHits = 0;
      }
    },
  }),
  [CONSTELLATION_IDS.RADIANCE]: Object.freeze({
    createRuntime: (constellation) => ({ componentStageSum: constellation.componentStageSum }),
    attack(constellation, first, origin) { constellation.chainAttack(first, origin); },
  }),
  [CONSTELLATION_IDS.SAGITTARIUS]: Object.freeze({
    createRuntime: () => ({
      focusTargetId: null, focusHits: 0, transcendenceUntil: 0,
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
      target.hit(constellation.currentDamage(focusMultiplier), origin);
      if (!transcending) runtime.focusHits = nextFocusHit;
      if (runtime.focusHits >= 60 && runtime.transcendenceUntil <= now) {
        runtime.transcendenceUntil = now + 10;
        runtime.focusHits = 0;
        game.attackBuffUntil = Math.max(game.attackBuffUntil, runtime.transcendenceUntil);
      }
    },
  }),
  [CONSTELLATION_IDS.ASTROLOGER]: Object.freeze({
    createRuntime: () => ({ lastDivinationResult: null }),
    attack(constellation, target, origin) {
      target.hit(constellation.currentDamage(), origin);
      const active = game.players.reduce(
        (total, player) => total + player.manager.activeConstellations().length, 0,
      );
      constellation.owner.player.resources.starlight += 1 + active;
      game.markDirty();
    },
  }),
});
class Constellation {
  constructor(owner, center, members, definitionId, connectionOrder = members) {
    this.owner = owner;
    this.center = center;
    this.members = [...members];
    this.connectionOrder = [...connectionOrder];
    this.definitionId = definitionId;
    this.definition = CONSTELLATION_DEFINITIONS[definitionId];
    this.behavior = CONSTELLATION_BEHAVIORS[definitionId];
    if (!this.definition || !this.behavior) throw new Error(`Unknown constellation: ${definitionId}`);
    this.componentStageSum = members.reduce((sum, index) => sum + owner.stars[index].tier, 0);
    this.cooldown = 0;
    this.target = null;
    this.runtime = this.behavior.createRuntime(this);
    members.forEach((index) => (owner.stars[index].support = index !== center));
    owner.stars[center].constellation = this;
  }
  resetTarget() {
    this.target = null;
    this.behavior.onTargetChanged?.(this, null);
  }
  attack(dt) {
    this.cooldown -= dt;
    const position = this.owner.pos(this.center);
    if (this.target && (this.target.dead || !RangeSystem.contains(position, this.target.position(), this.effectiveRange())))
      this.resetTarget();
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
    this.cooldown = 1 / this.definition.attackSpeed;
  }
  currentDamage(localMultiplier = 1) {
    const allyMultiplier = game.attackBuffUntil > game.gameTime ? 11 : 1;
    return this.definition.attackDamage * allyMultiplier * localMultiplier;
  }
  effectiveRange() {
    return this.definition.range;
  }
  chainAttack(first, origin) {
    const hit = new Set();
    let target = first;
    let from = origin;
    while (target && hit.size < this.runtime.componentStageSum) {
      const targetPosition = target.position();
      target.hit(this.currentDamage(), from);
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
    this.members.forEach((index) => {
      this.owner.stars[index].support = false;
      this.owner.stars[index].constellation = null;
    });
    this.connectionOrder.length = 0;
  }
}
class StarManager {
  constructor(player, field) {
    this.player = player;
    this.field = field;
    this.stars = Array(15).fill(null);
    this.selected = [];
    this.swapMode = false;
    this.zodiacMode = false;
    this.positions = [];
    for (let i = 0; i < 15; i++) {
      let b = document.createElement("button");
      b.className = "slot";
      b.dataset.index = i;
      b.setAttribute("aria-label", `빈 슬롯 ${i + 1}`);
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
    if (typeof requestAnimationFrame === "function")
      requestAnimationFrame(() => this.refreshPositions());
  }
  refreshPositions() {
    const a = arena.getBoundingClientRect();
    this.positions = [...this.field.children].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: ((r.left + r.width / 2 - a.left) / a.width) * 100,
        y: ((r.top + r.height / 2 - a.top) / a.height) * 100 };
    });
  }
  pos(i) {
    if (!this.positions[i]) this.refreshPositions();
    return this.positions[i] || { x: 0, y: 0 };
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
  summon() {
    // Never cache availability: merges and every summon can change the board.
    // Selection/action modes are UI state only and must not gate summoning.
    let empty = this.emptySlots();
    if (!empty.length) return UIManager.hint("빈 슬롯이 없습니다.");
    if (!this.player.resources.can(CONFIG.summonCost))
      return UIManager.hint("별빛이 부족합니다.");
    let i = empty[Math.floor(Math.random() * empty.length)];
    this.stars[i] = new Star(
      STAR_KEYS[Math.floor(Math.random() * STAR_KEYS.length)],
    );
    this.player.resources.spend(CONFIG.summonCost);
    // A successful summon dismisses normal contextual UI. Zodiac selection is
    // intentionally independent and remains active until its explicit cancel.
    this.clearNormalSelection();
    game.render();
    UIManager.summonEffect?.(this, i);
  }
  tap(i) {
    if (!this.stars[i]) {
      // Empty space is inert while assembling a zodiac. Only the explicit
      // cancel control is allowed to discard that ordered multi-selection.
      if (this.zodiacMode) return;
      if (this.clearNormalSelection()) game.render();
      return;
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
      el.className =
        "slot" +
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
          : `빈 슬롯 ${i + 1}`,
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
    return Object.keys(ZODIAC_RECIPES).find((kind) => {
      const requirements = ZODIAC_RECIPES[kind].recipe;
      return (
        Object.keys(counts).length === Object.keys(requirements).length &&
        Object.entries(requirements).every(
          ([type, amount]) => counts[type] === amount,
        )
      );
    });
  }
  static possibleMatches(counts) {
    return Object.keys(ZODIAC_RECIPES).filter((kind) =>
      Object.entries(counts).every(
        ([type, amount]) => (ZODIAC_RECIPES[kind].recipe[type] || 0) >= amount,
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
    zodiacCodexList.innerHTML = Object.entries(ZODIAC_RECIPES)
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
          .join(" / ");
        const specials = zodiac.abilities;
        const abilities = specials.map((special, index) =>
          `<p><strong>특수능력${specials.length > 1 ? ` ${index + 1}` : ""}</strong><span>${special}</span></p>`,
        ).join("");
        const discovered = game?.discoveredConstellations.has(definitionId);
        return `<article class="zodiac-card ${definitionId.toLowerCase()} ${discovered ? "discovered" : "undiscovered"}" data-constellation="${definitionId}"><h3>${zodiac.name}</h3><section class="codex-combination" aria-label="필요한 별 조합: ${summary}"><h4>STAR RECIPE <span>필요한 별</span></h4><svg class="codex-preview" viewBox="0 0 100 100" role="img" aria-label="${zodiac.name} 별자리 연결 그림"><g class="codex-edges">${edges}</g><g class="codex-nodes">${stars}</g></svg><div class="codex-recipe-summary">${summary}</div></section><dl><div><dt>공격력</dt><dd>${zodiac.attackDamage}</dd></div><div><dt>공격속도</dt><dd>${zodiac.attackSpeed}회/초</dd></div><div><dt>사거리</dt><dd>${zodiac.range}</dd></div></dl><div class="codex-specials">${abilities}</div></article>`;
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
    starInfo.innerHTML = constellation
      ? `<strong>✦ ${constellationStats.name}</strong><div class="stats"><span>${pick.player + 1}P · 중심 별</span><span>연결 별 ${constellation.members.length}개</span><span>공격력 ${constellationStats.attackDamage}</span><span>공격속도 ${constellationStats.attackSpeed}회/초</span><span>사정거리 ${constellationStats.range}</span>${constellation.definitionId === CONSTELLATION_IDS.RADIANCE ? `<span>단계 합 ${constellation.componentStageSum}</span><span>최대 연쇄 대상 ${constellation.componentStageSum}</span>` : ""}</div><div class="trait">${constellationStats.abilities.join(" · ")}</div>`
      : `<strong>✦ ${d.name} 별</strong><div class="stats"><span>${pick.player + 1}P · ${s.tier}단계</span><span>공격력 ${damage}</span><span>${d.target === "burst" ? "특수 주기" : "공격속도"} ${rate}</span><span>사정거리 ${d.range}</span></div><div class="trait">타겟팅 · ${TARGET_LABELS[d.target]}</div>`;
    ranges.innerHTML = "";
    let shownRange = constellation ? constellationStats.range : d.range,
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
      const canDivine = isAstrologer && pick.m.player.resources.can(CONFIG.divinationCost);
      // definitionId is deliberately part of the cache key: actions from a
      // previous tower type must never survive a selection/type change.
      let actionKey = `${pick.player}:${pick.index}:constellation:${constellation.definitionId}:${enabled}:${canDivine}`;
      if (this.actionKey !== actionKey) {
        contextActions.innerHTML = `${isAstrologer ? `<button class="divination action-above" data-context="divination"${canDivine ? "" : " disabled"}>별빛 점술 30</button>` : ""}<button class="${isAstrologer ? "action-below" : "action-above"}" data-context="release"${enabled ? "" : " disabled"}>별자리 해제 ◇1</button>`;
        if (isAstrologer)
          contextActions.querySelector('[data-context="divination"]').onclick = () =>
            DivinationSystem.execute(pick.m, pick.index);
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
      panel.querySelector("[data-act=summon]").disabled = !p.resources.can(CONFIG.summonCost) || p.manager.stars.every(Boolean);
      z.classList.toggle("active", p.manager.zodiacMode);
      cancel.hidden = !p.manager.zodiacMode;
      const match = ZodiacSystem.exactMatch(ZodiacSystem.counts(p.manager));
      z.textContent = p.manager.zodiacMode ? (match ? `${ZODIAC_RECIPES[match].name} 연결` : "조디악 선택 중") : "조디악";
    });
    this.renderInfo(g);
  }
  static renderHud(g, force = false) {
    const values = {
      wave: String(g.wave.wave),
      timer: Math.max(0, g.wave.left).toFixed(1),
      hp: `HP ${g.baseHP}/${BASE_MAX_HP}`,
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
  }
}
class GameManager {
  constructor() {
    this.last = 0;
    this.running = true;
    this.speed = 1;
    this.baseHP = BASE_MAX_HP;
    this.enemies = [];
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
      let p = { resources: new PlayerResources() };
      p.manager = new StarManager(p, getRequiredElement(`field-${i}`));
      return p;
    });
    window.BOOT_STAGE = "creating-wave";
    this.wave = new WaveManager(this);
    this.spawner = new EnemySpawner(this);
    window.BOOT_STAGE = "building-controls";
    this.buildControls();
    RangeSystem.refresh();
    window.addEventListener("resize", () => {
      RangeSystem.refresh();
      this.players.forEach((player) => player.manager.refreshPositions());
      this.markDirty();
    }, { passive: true });
  }
  start() {
    // Start simulation only after every manager, control and listener exists.
    this.wave.update(0);
    this.render();
    window.BOOT_STAGE = "starting-loop";
    this.rafRunning = true;
    requestAnimationFrame((t) => this.loop(t));
  }
  discoverConstellation(definitionId) {
    if (this.discoveredConstellations.has(definitionId)) return;
    this.discoveredConstellations.add(definitionId);
    if (!zodiacCodex.hidden) UIManager.renderCodex();
  }
  buildControls() {
    bindPointerTap(arena, (event) => {
      // Slots handle their own taps, while every in-arena contextual control
      // must remain actionable without a bubbling event clearing its target.
      if (event.target.closest(".slot, .context-actions, button, [role=button]")) return;
      let changed = false;
      this.players.forEach((player) => {
        changed = player.manager.clearNormalSelection() || changed;
      });
      if (changed) this.render();
    }, (event) => !event.target.closest(".slot, .context-actions, button, [role=button]"));
    controls.querySelectorAll(".game-controls").forEach((panel) => {
      const p = this.players[Number(panel.dataset.player)];
      panel.querySelector("[data-act=summon]").addEventListener("click", () => p.manager.summon());
      panel.querySelector("[data-act=zodiac]").addEventListener("click", () => ZodiacSystem.toggle(p.manager));
      panel.querySelector("[data-act=zodiac-cancel]").addEventListener("click", () => ZodiacSystem.cancel(p.manager));
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
  kill(e) {
    this.players.forEach((p) => {
      p.resources.starlight += e.reward;
      if (e.boss) p.resources.divinity++;
    });
    this.clearEnemyReferences(e);
    this.markDirty();
  }
  leak(e) {
    this.clearEnemyReferences(e);
    this.baseHP = Math.max(0, this.baseHP - e.baseDamage);
    if (this.baseHP <= 0) {
      this.running = false;
      finalWave.textContent = this.wave.wave;
      gameover.hidden = false;
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
    if (!this.last) this.last = t;
    const frameMs = t - this.last;
    this.frameMs = this.frameMs ? this.frameMs * 0.9 + frameMs * 0.1 : frameMs;
    let dt = Math.min(frameMs / 1000, 0.05) * this.speed;
    this.last = t;
    if (this.running) {
      this.gameTime += dt;
      this.wave.update(dt);
      this.spawner.update(dt);
      this.enemies.forEach((e) => e.update(dt));
      this.enemies = this.enemies.filter((e) => !e.dead);
      this.spatial.rebuild(this.enemies);
      this.players.forEach((p) => p.manager.update(dt));
      this.updateTasks();
      if (this.dirty) this.render();
      else if (t - this.lastHudUpdate >= 100) {
        UIManager.renderHud(this);
        this.lastHudUpdate = t;
      }
    }
    requestAnimationFrame((x) => this.loop(x));
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

function bootstrapGame() {
  // This function is the only place where required page elements are bound.
  // Assignments are intentionally explicit so missing IDs identify themselves.
  window.BOOT_STAGE = "dom-ready";
  arena = getRequiredElement("arena");
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
  speed = getRequiredElement("speed");
  restart = getRequiredElement("restart");
  finalWave = getRequiredElement("finalWave");
  gameover = getRequiredElement("gameover");

  window.BOOT_STAGE = "creating-game";
  game = new GameManager();
  speed.onclick = () => {
    game.speed = game.speed === 1 ? 2 : 1;
    speed.textContent = `${game.speed}× 속도`;
    speed.classList.toggle("active", game.speed === 2);
    arena.classList.toggle("speed-2", game.speed === 2);
  };
  restart.onclick = () => location.reload();
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  game.start();
  window.__TDS__ = {
    CONFIG, CONSTELLATION_IDS, CONSTELLATION_DEFINITIONS, ZODIAC_RECIPES, game,
    classes: { Enemy, WaveManager, Star, Targeting, RangeSystem, SpatialGrid, Constellation },
    performance: () => ({
      activeEnemies: game.enemies.length,
      activeEffects: UIManager.activeEffects || 0,
      frameMs: game.frameMs || 0,
      fps: game.frameMs ? 1000 / game.frameMs : 0,
    }),
  };
  window.BOOT_STAGE = "complete";
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", bootstrapGame, { once: true });
else bootstrapGame();
