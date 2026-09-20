"use strict";
const CONFIG = {
  waveSeconds: 15,
  summonCost: 30,
  swapCost: 10,
  divinationCost: 30,
  divinationFailureCost: 15,
  startStarlight: 5000,
  startDivinity: 50,
  startHP: 5,
  // One range unit is this percentage of the arena width. RangeSystem is the
  // single conversion point used by both targeting and the circular overlay.
  rangeUnit: 6.3,
  waveHpGrowth: 0.12,
  tierDamage: [1, 1.7, 2.8, 4.4],
  constellationTierPower: [1, 1.25, 1.55, 1.9],
  whiteBurstInterval: 0.16,
  whiteBurstRest: 2,
  constellations: {
    dawn: {
      name: "새벽의 별자리",
      recipe: { blue: 3, white: 1 },
      range: 4,
      damage: 500,
      rate: 4,
      specialMultiplier: 15,
      specialHits: 4,
      special: "같은 적을 4회 공격하면 현재 공격력의 1500% 특수 피해 (기본 공격력 기준 7,500)",
    },
    radiance: {
      name: "광휘의 별자리",
      recipe: { red: 2, white: 1 },
      range: 6,
      damage: 950,
      rate: 1,
      special: "구성 별들의 단계 합만큼 서로 다른 적에게 연쇄 공격. 각 대상은 광휘의 별자리 공격력만큼 피해",
    },
    sagittarius: {
      name: "궁수자리",
      recipe: { sky: 2, blue: 2 },
      range: 6,
      damage: 400,
      rate: 6,
      specials: [
        "같은 적 집중 공격: 20타 공격력 +1000%, 40타 +2000%, 60타에 모든 아군 공격력 +1000% (10초). 타겟 변경 시 집중 초기화",
        "누적 15회 적중 시 모든 아군 사거리 +1 (5초), 종료 후 5초 대기",
      ],
    },
    astrologer: {
      name: "점성술자리",
      recipe: { orange: 2 },
      range: 3,
      damage: 10,
      rate: 1,
      specials: [
        "공격 성공 시 별빛 1 + 현재 활성화된 완성 별자리 수 획득",
        "별빛 점술 30: 50% 확률로 +60, 실패 시 추가 -15 (별빛은 0 미만이 되지 않음)",
      ],
    },
  },
  monsters: {
    slime: { name: "어둠 슬라임", hp: 100, speed: 4.6, reward: 1 },
    bug: { name: "암흑 벌레", hp: 70, speed: 7, reward: 2 },
    drone: {
      name: "코어 드론",
      hp: 2500,
      speed: 2.8,
      reward: 30,
      boss: true,
    },
    meteor: {
      name: "운석 괴물",
      hp: 5000,
      speed: 1.8,
      reward: 50,
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
// Every zodiac-facing feature reads this registry: matching, combat, labels,
// and the codex. Adding a constellation does not require another matching
// branch or a new hard-coded selection limit.
const ZODIAC_RECIPES = CONFIG.constellations;
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
    this.left = 0.7;
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
      this.left += CONFIG.waveSeconds;
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
class Constellation {
  constructor(owner, center, members, kind, connectionOrder = members) {
    this.owner = owner;
    this.center = center;
    this.members = members;
    // Combat membership and the player's visual path are intentionally kept
    // separate so recipe/slot processing cannot reorder the connection.
    this.connectionOrder = [...connectionOrder];
    this.kind = kind;
    this.stats = CONFIG.constellations[kind];
    this.componentStageSum = members.reduce(
      (sum, index) => sum + owner.stars[index].tier,
      0,
    );
    this.powerMultiplier = members.reduce(
      (sum, index) => sum + CONFIG.constellationTierPower[owner.stars[index].tier - 1], 0,
    ) / members.length;
    this.cooldown = 0;
    this.target = null;
    this.hitCount = 0;
    this.rangeHitCount = 0;
    members.forEach((i) => (owner.stars[i].support = i !== center));
    owner.stars[center].constellation = this;
  }
  attack(dt) {
    this.cooldown -= dt;
    let position = this.owner.pos(this.center);
    if (
      this.target &&
      (this.target.dead ||
        !RangeSystem.contains(position, this.target.position(), this.effectiveRange()))
    ) {
      this.target = null;
      this.hitCount = 0;
    }
    if (this.cooldown > 0) return;
    let target =
      this.target ||
      Targeting.choose(
        {
          data: () => ({
            range: this.effectiveRange(),
            target: "highest",
          }),
        },
        game.enemies,
        position,
      );
    if (target) {
      if (target !== this.target) {
        this.target = target;
        this.hitCount = 0;
      }
      const currentAttackDamage =
        this.stats.damage * this.powerMultiplier * this.attackMultiplier();
      if (this.kind === "radiance") {
        this.chainAttack(target, position);
        this.target = null;
        this.hitCount = 0;
      } else {
        target.hit(currentAttackDamage, position);
        if (this.kind !== "sagittarius" || game.attackBuffUntil <= game.gameTime)
          this.hitCount++;
        this.afterHit();
      }
      if (this.kind === "dawn" && this.hitCount === this.stats.specialHits) {
        if (!target.dead) {
          const specialDamage =
            currentAttackDamage * this.stats.specialMultiplier;
          UIManager.dawnSpecial(target.position(), specialDamage);
          target.hit(specialDamage, position);
        }
        this.hitCount = 0;
      }
      if (target.dead) {
        this.target = null;
        this.hitCount = 0;
      }
      this.cooldown = 1 / this.stats.rate;
    }
  }
  effectiveRange() {
    return this.stats.range + (game.rangeBuffUntil > game.gameTime ? 1 : 0);
  }
  attackMultiplier() {
    const allyMultiplier = game.attackBuffUntil > game.gameTime ? 11 : 1;
    if (this.kind !== "sagittarius") return allyMultiplier;
    return allyMultiplier * (this.hitCount >= 40 ? 21 : this.hitCount >= 20 ? 11 : 1);
  }
  afterHit() {
    if (this.kind === "astrologer") {
      const active = game.players.reduce(
        (total, player) => total + player.manager.activeConstellations().length,
        0,
      );
      this.owner.player.resources.starlight += 1 + active;
      game.markDirty();
      return;
    }
    if (this.kind !== "sagittarius") return;
    const now = game.gameTime;
    if (game.rangeBuffUntil <= now && game.rangeBuffCooldownUntil <= now) {
      this.rangeHitCount++;
      if (this.rangeHitCount >= 15) {
        this.rangeHitCount = 0;
        game.rangeBuffUntil = now + 5;
        game.rangeBuffCooldownUntil = now + 10;
      }
    }
    if (this.hitCount >= 60 && game.attackBuffUntil <= now) {
      game.attackBuffUntil = now + 10;
      this.hitCount = 0;
    }
  }
  chainAttack(first, origin) {
    const hit = new Set();
    let target = first;
    let from = origin;
    while (target && hit.size < this.componentStageSum) {
      const targetPosition = target.position();
      target.hit(this.stats.damage * this.powerMultiplier * this.attackMultiplier(), from);
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
    this.members.forEach((i) => {
      this.owner.stars[i].support = false;
      this.owner.stars[i].constellation = null;
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
      b.addEventListener("pointerup", () => this.tap(i));
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
    // A summon changes only the board and resources. In particular, it must
    // not replace the current selection or cancel swap/zodiac target picking.
    game.render();
    UIManager.summonEffect?.(this, i);
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
      let deselect = this.selected[0] === i;
      this.clearOthers();
      this.selected = deselect ? [] : [i];
      this.swapMode = false;
    }
    game.render();
  }
  selectOnly(i) {
    this.selected = [i];
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
      const effectiveRange =
        s.data().range + (game.rangeBuffUntil > game.gameTime ? 1 : 0);
      if (s.lock && (s.lock.dead || !RangeSystem.contains(position, s.lock.position(), effectiveRange)))
        s.lock = null;
      const targetableStar = effectiveRange === s.data().range
        ? s
        : { data: () => ({ ...s.data(), range: effectiveRange }), lock: s.lock };
      let t = s.lock || Targeting.choose(targetableStar, game.enemies, position);
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
    m.selectOnly(a);
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
  static begin(m) {
    if (m.zodiacMode) return UIManager.hint("먼저 조디악 선택을 완료하거나 취소하세요.");
    if (m.selected.length !== 1) return UIManager.hint("교환할 첫 별을 선택하세요.");
    const star = m.stars[m.selected[0]];
    if (!star || star.support || star.constellation) return UIManager.hint("별자리 구성원은 교환할 수 없습니다.");
    if (!m.player.resources.can(CONFIG.swapCost)) return UIManager.hint("별빛이 부족합니다.");
    m.swapMode = true;
    UIManager.hint("교환할 상대 별을 선택하세요 · 비용 별빛 10");
    game.render();
  }
  static execute(m, a, b) {
    if (!m.swapMode || a === b) return;
    const other = m.stars[b];
    if (!other || other.support || other.constellation) return UIManager.hint("일반 별을 교환 대상으로 선택하세요.");
    if (!m.player.resources.spend(CONFIG.swapCost)) return UIManager.hint("별빛이 부족합니다.");
    [m.stars[a], m.stars[b]] = [m.stars[b], m.stars[a]];
    m.selected = [b];
    m.swapMode = false;
    UIManager.hint("두 별의 슬롯을 교환했습니다.");
    game.render();
    UIManager.swapEffect(m, b, m.stars[b].type);
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
    const kind = this.exactMatch(counts);
    if (
      !kind ||
      picks.some((i) => m.stars[i].support || m.stars[i].constellation)
    )
      return UIManager.hint("선택한 별과 정확히 일치하는 별자리가 없습니다.");
    let center = picks[0],
      points = picks.map((i) => m.pos(i));
    new Constellation(m, center, [...picks], kind, connectionOrder);
    m.exitModes();
    UIManager.zodiacComplete(points);
    if (kind === "dawn") UIManager.showDawnMoon();
    UIManager.hint(`✨ ${CONFIG.constellations[kind].name} 완성!`);
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
      star.constellation.kind !== "astrologer"
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
      .map(([kind, zodiac]) => {
        const requirements = Object.entries(zodiac.recipe)
          .map(([type, amount]) => `<span class="codex-requirement"><i style="--star-color:${CONFIG.stars[type].color};color:${CONFIG.stars[type].color}">✦</i>${CONFIG.stars[type].name} ×${amount}</span>`)
          .join("");
        const specials = zodiac.specials || [zodiac.special];
        const abilities = specials.map((special, index) =>
          `<p><strong>특수능력${specials.length > 1 ? ` ${index + 1}` : ""}</strong><span>${special}</span></p>`,
        ).join("");
        return `<article class="zodiac-card ${kind}"><h3>${zodiac.name}</h3><h4>필요 별</h4><div class="codex-recipe">${requirements}</div><dl><div><dt>공격력</dt><dd>${zodiac.damage}</dd></div><div><dt>공격속도</dt><dd>${zodiac.rate}회/초</dd></div><div><dt>사거리</dt><dd>${zodiac.range}</dd></div></dl><div class="codex-specials">${abilities}</div></article>`;
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
      }, i * 90),
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
    const constellationStats = constellation?.stats;
    starInfo.innerHTML = constellation
      ? `<strong>✦ ${constellationStats.name}</strong><div class="stats"><span>${pick.player + 1}P · 중심 별</span><span>연결 별 ${constellation.members.length}개</span><span>공격력 ${Math.round(constellationStats.damage * constellation.powerMultiplier)}</span><span>공격속도 ${constellationStats.rate}회/초</span><span>사정거리 ${constellationStats.range}</span>${constellation.kind === "radiance" ? `<span>단계 합 ${constellation.componentStageSum}</span><span>최대 연쇄 대상 ${constellation.componentStageSum}</span>` : ""}</div><div class="trait">${(constellationStats.specials || [constellationStats.special]).join(" · ")}</div>`
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
    const placeBelow = p.y < 10;
    contextActions.classList.toggle("below", placeBelow);
    contextActions.style.left = p.x + "%";
    contextActions.style.top = `${p.y}%`;
    if (constellation) {
      let enabled = pick.m.player.resources.divinity >= 1;
      const isAstrologer = constellation.kind === "astrologer";
      const canDivine = isAstrologer && pick.m.player.resources.can(CONFIG.divinationCost);
      let actionKey = `${pick.player}:${pick.index}:constellation:${enabled}:${canDivine}`;
      if (this.actionKey !== actionKey) {
        contextActions.innerHTML = `${isAstrologer ? `<button class="divination" data-context="divination"${canDivine ? "" : " disabled"}>별빛 점술 30</button>` : ""}<button data-context="release"${enabled ? "" : " disabled"}>별자리 해제 ◇1</button>`;
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
        contextActions.innerHTML = `<button data-context="swap"${canSwap ? "" : " disabled"}>교환</button><button class="merge${partner >= 0 ? " available" : ""}" data-context="merge"${partner >= 0 ? "" : " disabled"}>합성</button>`;
        contextActions.querySelector('[data-context="swap"]').onclick = () =>
          SwapSystem.begin(pick.m);
        contextActions.querySelector('[data-context="merge"]').onclick = () =>
          MergeSystem.execute(pick.m);
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
      hp: "♥".repeat(g.hp) + "♡".repeat(CONFIG.startHP - g.hp),
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
    this.hp = CONFIG.startHP;
    this.enemies = [];
    this.spatial = new SpatialGrid();
    this.gameTime = 0;
    this.attackBuffUntil = 0;
    this.rangeBuffUntil = 0;
    this.rangeBuffCooldownUntil = 0;
    this.tasks = [];
    this.dirty = true;
    this.lastHudUpdate = 0;
    this.wave = new WaveManager(this);
    this.spawner = new EnemySpawner(this);
    this.players = [0, 1].map((i) => {
      let p = { resources: new PlayerResources() };
      p.manager = new StarManager(p, document.getElementById(`field-${i}`));
      return p;
    });
    this.buildControls();
    RangeSystem.refresh();
    window.addEventListener("resize", () => {
      RangeSystem.refresh();
      this.players.forEach((player) => player.manager.refreshPositions());
      this.markDirty();
    }, { passive: true });
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }
  buildControls() {
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
    if (--this.hp <= 0) {
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
        star.constellation.target = null;
        star.constellation.hitCount = 0;
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
let game = new GameManager();
speed.onclick = () => {
  game.speed = game.speed === 1 ? 2 : 1;
  speed.textContent = `${game.speed}× 속도`;
  speed.classList.toggle("active", game.speed === 2);
  arena.classList.toggle("speed-2", game.speed === 2);
};
restart.onclick = () => location.reload();
document.addEventListener("contextmenu", (e) => e.preventDefault());
window.__TDS__ = {
  CONFIG,
  ZODIAC_RECIPES,
  game,
  classes: { Enemy, WaveManager, Star, Targeting, RangeSystem, SpatialGrid, Constellation },
  performance: () => ({
    activeEnemies: game.enemies.length,
    activeEffects: UIManager.activeEffects || 0,
    frameMs: game.frameMs || 0,
    fps: game.frameMs ? 1000 / game.frameMs : 0,
  }),
};
