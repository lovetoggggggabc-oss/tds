"use strict";
const CONFIG = {
  waveSeconds: 15,
  summonCost: 30,
  swapCost: 10,
  startStarlight: 5000,
  startDivinity: 50,
  startHP: 5,
  rangeUnit: 6.3,
  waveHpGrowth: 0.12,
  tierDamage: [1, 1.7, 2.8, 4.4],
  whiteBurstInterval: 0.16,
  whiteBurstRest: 2,
  constellation: { range: 9, damagePerTier: 150, cooldown: 0.55 },
  monsters: {
    slime: { name: "어둠 슬라임", hp: 500, speed: 4.6, reward: 1 },
    bug: { name: "암흑 벌레", hp: 800, speed: 7, reward: 2 },
    drone: {
      name: "코어 드론",
      hp: 10000,
      speed: 2.8,
      reward: 30,
      boss: true,
    },
    meteor: {
      name: "운석 괴물",
      hp: 20000,
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
const STAR_KEYS = Object.keys(CONFIG.stars),
  RECIPE = { blue: 2, red: 1, white: 1 },
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
    this.el = document.createElement("div");
    this.el.className = `enemy ${this.type}${this.boss ? " boss" : ""}`;
    this.el.innerHTML = `<div class="bar" aria-hidden="true"><i></i></div><span class="enemy-body"></span><small>${this.boss ? this.name : ""}</small>`;
    arena.append(this.el);
    this.render();
  }
  position() {
    let p = this.progress;
    // lane 0 starts beside 2P and travels down; lane 1 starts beside 1P and travels up.
    if (p < 43) return { x: 8, y: this.lane === 0 ? 7 + p : 93 - p };
    return { x: 8 + ((p - 43) * 81) / 57, y: 50 };
  }
  render() {
    let p = this.position();
    this.el.style.left = p.x + "%";
    this.el.style.top = p.y + "%";
    this.el.querySelector("i").style.width =
      Math.max(0, (this.hp / this.maxHp) * 100) + "%";
  }
  update(dt) {
    this.progress += this.speed * dt;
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
    let targets = enemies.filter(
      (e) =>
        !e.dead &&
        Targeting.dist(pos, e.position()) <=
          star.data().range * CONFIG.rangeUnit,
    );
    if (!targets.length) return null;
    if (star.data().target === "lock" && targets.includes(star.lock))
      return star.lock;
    if (star.data().target === "random")
      return targets[Math.floor(Math.random() * targets.length)];
    if (star.data().target === "nearest")
      return targets.sort(
        (a, b) =>
          Targeting.dist(pos, a.position()) - Targeting.dist(pos, b.position()),
      )[0];
    if (star.data().target === "highest")
      return targets.sort((a, b) => b.hp - a.hp)[0];
    return targets.sort((a, b) => b.progress - a.progress)[0];
  }
  static dist(a, b) {
    return Math.hypot(a.x - b.x, (a.y - b.y) * 0.68);
  }
}
class Constellation {
  constructor(owner, center, members) {
    this.owner = owner;
    this.center = center;
    this.members = members;
    this.cooldown = 0;
    members.forEach((i) => (owner.stars[i].support = i !== center));
    owner.stars[center].constellation = this;
  }
  attack(dt) {
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    let target = Targeting.choose(
      {
        data: () => ({
          range: CONFIG.constellation.range,
          target: "highest",
        }),
      },
      game.enemies,
      this.owner.pos(this.center),
    );
    if (target) {
      let power =
        this.members.reduce((s, i) => s + this.owner.stars[i].tier, 0) *
        CONFIG.constellation.damagePerTier;
      target.hit(power, this.owner.pos(this.center));
      this.cooldown = CONFIG.constellation.cooldown;
    }
  }
  release() {
    this.members.forEach((i) => {
      this.owner.stars[i].support = false;
      this.owner.stars[i].constellation = null;
    });
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
    for (let i = 0; i < 15; i++) {
      let b = document.createElement("button");
      b.className = "slot";
      b.dataset.index = i;
      b.setAttribute("aria-label", `빈 슬롯 ${i + 1}`);
      b.addEventListener("pointerup", () => this.tap(i));
      field.append(b);
    }
  }
  pos(i) {
    let el = this.field.children[i],
      a = arena.getBoundingClientRect(),
      r = el.getBoundingClientRect();
    return {
      x: ((r.left + r.width / 2 - a.left) / a.width) * 100,
      y: ((r.top + r.height / 2 - a.top) / a.height) * 100,
    };
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
      else if (this.selected.length < 4) this.selected.push(i);
      else
        return UIManager.hint("조디악 별은 최대 4개까지 선택할 수 있습니다.");
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
      let t = Targeting.choose(s, game.enemies, this.pos(i));
      if (t) {
        s.lock = t;
        let damage = s.data().damage * CONFIG.tierDamage[s.tier - 1];
        t.hit(damage, this.pos(i));
        if (s.data().target === "burst") {
          s.burstLeft--;
          if (s.burstLeft > 0) s.cooldown = CONFIG.whiteBurstInterval;
          else {
            s.burstLeft = 3;
            s.cooldown = CONFIG.whiteBurstRest;
          }
        } else s.cooldown = 1 / s.data().rate;
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
        ? `<span class="star" style="color:${s.data().color}">✦<b class="star-level">${s.tier}</b></span>`
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
    if (!m.player.resources.can(CONFIG.swapCost))
      return UIManager.hint("별빛이 부족합니다.");
    if (m.zodiacMode)
      return UIManager.hint("먼저 조디악 선택을 완료하거나 취소하세요.");
    if (m.selected.length !== 1)
      return UIManager.hint("교환할 별을 먼저 선택하세요.");
    m.swapMode = true;
    UIManager.hint("위치를 바꿀 다른 별을 선택하세요.");
    game.render();
  }
  static execute(m, a, b) {
    if (
      !m.stars[b] ||
      m.stars[a].support ||
      m.stars[b].support ||
      m.stars[a].constellation ||
      m.stars[b].constellation
    )
      return UIManager.hint("별자리 구성원은 교환할 수 없습니다.");
    if (!m.player.resources.spend(CONFIG.swapCost)) return;
    m.stars[a] = [m.stars[b], (m.stars[b] = m.stars[a])][0];
    m.selected = [b];
    m.swapMode = false;
    game.render();
  }
}
class ZodiacSystem {
  static toggle(m) {
    if (!m.zodiacMode) {
      m.clearOthers();
      m.swapMode = false;
      m.zodiacMode = true;
      m.selected = [];
      UIManager.hint("조디악 선택 모드 · 중심 별을 먼저, 총 4개를 고르세요.");
      return game.render();
    }
    this.create(m);
  }
  static create(m) {
    let picks = m.selected;
    if (picks.length !== 4)
      return UIManager.hint(
        `조디악 선택 모드 · 별 ${4 - picks.length}개를 더 선택하세요.`,
      );
    let counts = {};
    picks.forEach((i) => {
      let s = m.stars[i];
      if (s) counts[s.type] = (counts[s.type] || 0) + 1;
    });
    if (
      Object.keys(RECIPE).some((k) => counts[k] !== RECIPE[k]) ||
      picks.some((i) => m.stars[i].support || m.stars[i].constellation)
    )
      return UIManager.hint("새벽: 청색×2 + 적색×1 + 백색×1");
    let center = picks[0],
      points = picks.map((i) => m.pos(i));
    new Constellation(m, center, [...picks]);
    m.exitModes();
    UIManager.zodiacComplete(points[0], points.slice(1));
    UIManager.hint("✨ 새벽의 별자리 완성!");
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
class UIManager {
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
    effects.append(line);
    game.simulationTimeout(() => line.remove(), 170);
  }
  static zodiacComplete(center, members) {
    members.forEach((p, i) =>
      game.simulationTimeout(() => {
        effects.insertAdjacentHTML(
          "beforeend",
          `<line class="link-form" x1="${center.x}" y1="${center.y}" x2="${p.x}" y2="${p.y}"/>`,
        );
        for (let n = 0; n < 4; n++)
          effects.insertAdjacentHTML(
            "beforeend",
            `<circle class="spark" cx="${center.x + ((p.x - center.x) * (n + 1)) / 5}" cy="${center.y + ((p.y - center.y) * (n + 1)) / 5}" r="${0.35 + n * 0.06}"/>`,
          );
      }, i * 90),
    );
    game.simulationTimeout(
      () =>
        effects.insertAdjacentHTML(
          "beforeend",
          `<circle class="complete-wave" cx="${center.x}" cy="${center.y}" r="2.5"/>`,
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
    starInfo.innerHTML = constellation
      ? `<strong>✦ 새벽의 별자리</strong><div class="stats"><span>${pick.player + 1}P · 중심 별</span><span>연결 별 ${constellation.members.length}개</span><span>공격력 ${constellation.members.reduce((sum, i) => sum + pick.m.stars[i].tier, 0) * CONFIG.constellation.damagePerTier}</span><span>사정거리 ${CONFIG.constellation.range}</span></div><div class="trait">연결된 지원 별의 힘으로 공격</div>`
      : `<strong>✦ ${d.name} 별</strong><div class="stats"><span>${pick.player + 1}P · ${s.tier}단계</span><span>공격력 ${damage}</span><span>${d.target === "burst" ? "특수 주기" : "공격속도"} ${rate}</span><span>사정거리 ${d.range}</span></div><div class="trait">타겟팅 · ${TARGET_LABELS[d.target]}</div>`;
    ranges.innerHTML = "";
    let shownRange = constellation ? CONFIG.constellation.range : d.range,
      diameter =
        (arena.clientWidth * shownRange * CONFIG.rangeUnit * 2) / 100;
    rangeIndicator.hidden = false;
    rangeIndicator.style.left = p.x + "%";
    rangeIndicator.style.top = p.y + "%";
    rangeIndicator.style.width = diameter + "px";
    rangeIndicator.style.height = diameter + "px";
    let slot = pick.m.field.children[pick.index].getBoundingClientRect(),
      ar = arena.getBoundingClientRect();
    contextActions.hidden = false;
    contextActions.classList.toggle("below", slot.top - ar.top < 55);
    contextActions.style.left = p.x + "%";
    contextActions.style.top = `${((slot.top - ar.top + (slot.top - ar.top < 55 ? slot.height + 5 : -5)) / ar.height) * 100}%`;
    if (constellation) {
      let enabled = pick.m.player.resources.divinity >= 1;
      contextActions.innerHTML = `<button data-context="release"${enabled ? "" : " disabled"}>별자리 해제 ◇1</button>`;
      contextActions.querySelector("button").onclick = () =>
        ZodiacSystem.release(pick.m, pick.index);
    } else if (!s.support) {
      let partner = MergeSystem.partner(pick.m),
        canSwap = pick.m.player.resources.can(CONFIG.swapCost) && !s.support;
      contextActions.innerHTML = `<button data-context="swap"${canSwap ? "" : " disabled"}>교환</button><button class="merge${partner >= 0 ? " available" : ""}" data-context="merge"${partner >= 0 ? "" : " disabled"}>합성</button>`;
      contextActions.querySelector('[data-context="swap"]').onclick = () =>
        SwapSystem.begin(pick.m);
      contextActions.querySelector('[data-context="merge"]').onclick = () =>
        MergeSystem.execute(pick.m);
    } else {
      contextActions.hidden = true;
    }
  }
  static render(g) {
    wave.textContent = g.wave.wave;
    timer.textContent = Math.max(0, g.wave.left).toFixed(1);
    hp.textContent = "♥".repeat(g.hp) + "♡".repeat(CONFIG.startHP - g.hp);
    let drawn = new Set(),
      lines = [];
    g.players.forEach((p) =>
      p.manager.stars.forEach((s) => {
        let c = s?.constellation;
        if (c && !drawn.has(c)) {
          drawn.add(c);
          let a = c.owner.pos(c.center);
          c.members
            .filter((i) => i !== c.center)
            .forEach((i) => {
              let b = c.owner.pos(i);
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
    let p = g.players[0],
      z = controls.querySelector("[data-act=zodiac]");
    controls.classList.toggle(
      "active-player",
      p.manager.selected.length > 0 ||
        p.manager.swapMode ||
        p.manager.zodiacMode,
    );
    controls.querySelector("[data-act=summon]").disabled =
      !p.resources.can(CONFIG.summonCost) || p.manager.stars.every(Boolean);
    z.classList.toggle("active", p.manager.zodiacMode);
    z.textContent = p.manager.zodiacMode
      ? `연결 실행 (${p.manager.selected.length}/4)`
      : "조디악";
    this.renderInfo(g);
  }
}
class GameManager {
  constructor() {
    this.last = 0;
    this.running = true;
    this.speed = 1;
    this.hp = CONFIG.startHP;
    this.enemies = [];
    this.wave = new WaveManager(this);
    this.spawner = new EnemySpawner(this);
    this.players = [0, 1].map((i) => {
      let p = { resources: new PlayerResources() };
      p.manager = new StarManager(p, document.getElementById(`field-${i}`));
      return p;
    });
    this.buildControls();
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }
  buildControls() {
    let p = this.players[0];
    controls
      .querySelector("[data-act=summon]")
      .addEventListener("click", () => p.manager.summon());
    controls.querySelector("[data-act=zodiac]").addEventListener("click", () =>
      ZodiacSystem.toggle(p.manager),
    );
  }
  simulationTimeout(callback, milliseconds) {
    return setTimeout(callback, milliseconds / this.speed);
  }
  kill(e) {
    this.players.forEach((p) => {
      p.resources.starlight += e.reward;
      if (e.boss) p.resources.divinity++;
    });
    this.render();
  }
  leak() {
    if (--this.hp <= 0) {
      this.running = false;
      finalWave.textContent = this.wave.wave;
      gameover.hidden = false;
    }
    this.render();
  }
  loop(t) {
    if (!this.last) this.last = t;
    let dt = Math.min((t - this.last) / 1000, 0.05) * this.speed;
    this.last = t;
    if (this.running) {
      this.wave.update(dt);
      this.spawner.update(dt);
      this.enemies.forEach((e) => e.update(dt));
      this.enemies = this.enemies.filter((e) => !e.dead);
      this.players.forEach((p) => p.manager.update(dt));
      this.render();
    }
    requestAnimationFrame((x) => this.loop(x));
  }
  render() {
    UIManager.render(this);
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
  game,
  classes: { Enemy, WaveManager, Star, Targeting },
};
