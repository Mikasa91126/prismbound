/* ============================================================
   PRISMBOUND / 棱镜奇旅
   core.js — 常量、工具、事件总线与本地存档
   零依赖，所有内容由代码生成。
   ============================================================ */
(function () {
  'use strict';

  const PB = (window.PB = window.PB || {});

  const C = {
    W: 480,
    H: 270,
    TILE: 16,
    COLS: 30,
    ROWS_VISIBLE: 16.875,
    UI_W: 960,
    UI_H: 540,
    STEP: 1 / 60,
    VERSION: '1.0.4',
    TITLE: '棱镜奇旅',
    TITLE_EN: 'PRISMBOUND',

    // 玩家碰撞盒（站立 / 滑铲）
    P_W: 10,
    P_H: 18,
    P_SLIDE_H: 10,

    // 水平移动
    RUN_MAX: 2.55,
    RUN_ACC: 0.55,
    AIR_ACC: 0.44,
    GROUND_FRICTION: 0.72,
    AIR_FRICTION: 0.045,
    TURN_MULT: 1.9,

    // 垂直手感
    GRAV_UP: 0.42,
    GRAV_DOWN: 0.63,
    GRAV_APEX: 0.7,
    APEX_WINDOW: 1.5,
    MAX_FALL: 8.6,
    JUMP_V: 7.05,
    DOUBLE_JUMP_V: 6.05,
    JUMP_CUT: 0.44,
    COYOTE: 7,
    JUMP_BUFFER: 8,
    HEAD_CORNER: 4,

    // 墙
    WALL_SLIDE_MAX: 1.65,
    WALL_JUMP_X: 3.45,
    WALL_JUMP_Y: 6.7,
    WALL_LOCK: 9,

    // 滑铲 / 跃冲
    SLIDE_MAX: 4.7,
    SLIDE_MIN: 2.7,
    SLIDE_FRICTION: 0.045,
    SLIDE_STEER: 0.06,
    WAVE_JUMP_V: 5.9,
    WAVE_TIME: 17,

    // 冲刺
    DASH_SPEED: 6.55,
    DASH_TIME: 9,
    DASH_CD: 10,
    DASH_END_MULT: 0.72,

    // 砸地
    POUND_SPEED: 11,
    POUND_IMPACT_R: 42,

    // 子弹时间
    BULLET_SCALE: 0.34,
    BULLET_DRAIN: 34,       // 每秒
    BULLET_REGEN: 20,
    BULLET_MAX: 100,

    // 回响分身
    ECHO_RECORD: 4.0,
    ECHO_COOLDOWN: 7.0,

    // 生命与互动
    HEARTS: 3,
    INVULN: 1.25,
    HITSTOP: 0.055,
    CAM_LERP: 0.115,
    CAM_LOOKAHEAD: 26,

    // 世界
    WATER_FREEZE_TIME: 11,
    LAVA_FREEZE_TIME: 6.5,
    ICE_BLOCK_LIFE: 7.5,
    COIL_POWER_TIME: 9,
    BOSS_NAME: '棱镜守望者',
    BOSS_NAME_EN: 'THE PRISM WARDEN',
  };

  const FORMS = [
    {
      id: 'solar', num: 1, key: '1',
      zh: '烈焰火花', en: 'SOLAR SPARK',
      color: '#ffb454', color2: '#ff6a3d', pale: '#ffe6b0',
      skillZh: '弹跳火球', skillEn: 'BOUNCING EMBER',
      descZh: '投出会在石壁间弹跳的火球。点燃藤蔓、引爆连环炸药桶、为铜线通电；落入水面会蒸腾出托举万物的蒸汽柱。',
      descEn: 'Hurl an ember that ricochets off stone. Burn vines, chain barrels, power copper coils — and flash water into a lifting steam column.',
      verse: '一点星火，足以让沉睡的遗迹重新呼吸。',
      verseEn: 'A single spark can teach old ruins to breathe again.',
    },
    {
      id: 'cryo', num: 2, key: '2',
      zh: '霜晶形态', en: 'CRYO CRYSTAL',
      color: '#6ee7ff', color2: '#3f8cff', pale: '#d8fbff',
      skillZh: '霜华脉冲', skillEn: 'FROST PULSE',
      descZh: '冻结水面与熔岩，驯服火焰灯笼灵，将敌人封进可踢飞的冰块。空中按 ↓+J，可在脚下凝结临时冰台。',
      descEn: 'Freeze water into bridges and lava into obsidian. Tame flame lanterns, encase foes in kickable ice, and press ↓+J to crystallize a midair step.',
      verse: '把奔流凝成一步，把灼热封进一瞬。',
      verseEn: 'Still the river into a footstep; seal the fire into an instant.',
    },
    {
      id: 'grav', num: 3, key: '3',
      zh: '星蚀重力', en: 'GRAVITON VOID',
      color: '#b48cff', color2: '#6d4bd6', pale: '#e9dcff',
      skillZh: '重力翻转', skillEn: 'GRAVITY FLIP',
      descZh: '点按 J 将自身重力倒转，踏上天穹。↓+J 释放重力脉冲，让敌人、木箱与炸药桶一同向上坠落——倒悬天龙，从上方奇袭。',
      descEn: 'Tap J to invert your own gravity and walk the sky. ↓+J pulses gravity through foes and cargo, sending barrels “falling” upward to blast open ceiling vaults.',
      verse: '天空并非尽头，只是另一个可以站立的方向。',
      verseEn: 'The sky is not the end — only another floor to stand upon.',
    },
    {
      id: 'warp', num: 4, key: '4',
      zh: '星隙折跃', en: 'WARP PRISM',
      color: '#f59cff', color2: '#8a5bff', pale: '#ffe1ff',
      skillZh: '星棱折跃', skillEn: 'STAR-RIFT WARP',
      descZh: '按 J 抛出星棱；再按 J 保留动量瞬移至棱尖。若星棱钉在敌人或炸药桶上，将与其量子换位。被动可见假墙的翡翠微光。',
      descEn: 'Throw a star-prism with J; press J again to warp to it with momentum intact. Lodged in a foe or barrel, it swaps you both. Fake walls shimmer emerald in this form.',
      verse: '距离只是尚未被折叠的光。',
      verseEn: 'Distance is only light that has not yet been folded.',
    },
  ];
  const FORM_BY_ID = {};
  FORMS.forEach((f) => (FORM_BY_ID[f.id] = f));

  // ------------------------------------------------------------------ utils
  const U = {
    clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
    lerp(a, b, t) { return a + (b - a) * t; },
    invLerp(a, b, v) { return (v - a) / (b - a); },
    approach(v, target, delta) {
      if (v < target) return Math.min(v + delta, target);
      if (v > target) return Math.max(v - delta, target);
      return target;
    },
    damp(a, b, lambda, dt) { return U.lerp(a, b, 1 - Math.exp(-lambda * dt)); },
    sign(v) { return v < 0 ? -1 : v > 0 ? 1 : 0; },
    rand(a = 0, b = 1) { return a + Math.random() * (b - a); },
    randInt(a, b) { return Math.floor(U.rand(a, b + 1)); },
    pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    chance(p) { return Math.random() < p; },
    mulberry32(seed) {
      let s = seed >>> 0;
      return function () {
        s |= 0; s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    hash2(x, y, seed = 0) {
      let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    },
    rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    },
    pointInRect(px, py, x, y, w, h) { return px >= x && px <= x + w && py >= y && py <= y + h; },
    dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },
    dist2(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; },
    signStr(v) { return v < 0 ? '-' : '+'; },
    pad(n, w = 2) { return String(Math.max(0, Math.floor(n))).padStart(w, '0'); },
    formatTime(seconds) {
      seconds = Math.max(0, seconds || 0);
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      const d = Math.floor((seconds % 1) * 10);
      return `${U.pad(m)}:${U.pad(s)}.${d}`;
    },
    formatTimeShort(seconds) {
      seconds = Math.max(0, seconds || 0);
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${U.pad(m)}:${U.pad(s)}`;
    },
    easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); },
    easeInCubic(t) { return t * t * t; },
    easeOutBack(t) {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    easeInOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; },
    wrap(v, n) { return ((v % n) + n) % n; },
    snap(v, grid) { return Math.round(v / grid) * grid; },
    floorTo(v, grid) { return Math.floor(v / grid) * grid; },
    animate(t, speed = 1) { return (Math.sin(t * Math.PI * 2 * speed) + 1) / 2; },
    noteToFreq(note) {
      if (typeof note === 'number') return note;
      if (!note) return 0;
      const m = /^([A-G])(#|b)?(-?\d)$/.exec(note);
      if (!m) return 0;
      const semis = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
      let n = semis[m[1]];
      if (m[2] === '#') n += 1;
      if (m[2] === 'b') n -= 1;
      const octave = parseInt(m[3], 10);
      const midi = 12 * (octave + 1) + n;
      return 440 * Math.pow(2, (midi - 69) / 12);
    },
    noteToMidi(note) {
      if (typeof note === 'number') return note;
      const f = U.noteToFreq(note);
      return f ? 69 + 12 * Math.log2(f / 440) : 0;
    },
    colorLerp(hexA, hexB, t) {
      const pa = U.hexToRgb(hexA), pb = U.hexToRgb(hexB);
      if (!pa || !pb) return hexA;
      const c = pa.map((v, i) => Math.round(U.lerp(v, pb[i], t)));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    },
    hexToRgb(hex) {
      if (!hex || hex[0] !== '#') return null;
      let h = hex.slice(1);
      if (h.length === 3) h = h.split('').map((c) => c + c).join('');
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    },
    rgba(hex, a) {
      const c = U.hexToRgb(hex);
      return c ? `rgba(${c[0]},${c[1]},${c[2]},${a})` : hex;
    },
    alpha(hex, a) { return U.rgba(hex, a); },
    deepMerge(base, over) {
      if (Array.isArray(base)) return Array.isArray(over) ? over.slice() : base.slice();
      if (base && typeof base === 'object') {
        const out = Object.assign({}, base);
        if (over && typeof over === 'object') {
          for (const k of Object.keys(over)) out[k] = U.deepMerge(base[k], over[k]);
        }
        return out;
      }
      return over === undefined ? base : over;
    },
    byId(id) { return document.getElementById(id); },
    now() { return performance.now() / 1000; },
    noop() {},
  };

  // ------------------------------------------------------------------ events
  const Events = {
    map: new Map(),
    on(name, fn) {
      if (!this.map.has(name)) this.map.set(name, new Set());
      this.map.get(name).add(fn);
      return () => this.off(name, fn);
    },
    off(name, fn) {
      const set = this.map.get(name);
      if (set) set.delete(fn);
    },
    emit(name, payload) {
      const set = this.map.get(name);
      if (set) for (const fn of Array.from(set)) {
        try { fn(payload); } catch (err) { console.error('[event]', name, err); }
      }
    },
    clear() { this.map.clear(); },
  };

  // ------------------------------------------------------------------ save
  const SAVE_KEY = 'prismbound.save.v1';
  function defaultSave() {
    return {
      version: 1,
      createdAt: Date.now(),
      chapter: 0,                  // 已解锁到第几章（0 起）
      checkpoint: null,            // { chapter, x, y, id }
      forms: { solar: false, cryo: false, grav: false, warp: false },
      arts: { echo: false, chrono: false },
      chains: {},                  // chainId -> { done, count, date }
      grand: {},                   // grandShardId -> true
      collectedShards: {},          // "chapter:tx,ty" -> true
      bestTime: {},                // chapterId -> seconds
      seenIntro: false,
      seenEnding: false,
      trueEnding: false,
      completed: false,
      settings: {
        music: 0.72,
        sfx: 0.82,
        shake: true,
        flashes: true,
        hints: true,
      },
      stats: { deaths: 0, shards: 0, playTime: 0, jumps: 0, dashes: 0 },
    };
  }

  const Save = {
    key: SAVE_KEY,
    data: defaultSave(),
    available: true,
    load() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.data = U.deepMerge(defaultSave(), parsed);
        } else {
          this.data = defaultSave();
        }
      } catch (err) {
        console.warn('[save] localStorage unavailable; using memory save.', err);
        this.available = false;
        this.data = defaultSave();
      }
      return this.data;
    },
    save() {
      try {
        this.data.updatedAt = Date.now();
        localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
      } catch (err) {
        this.available = false;
      }
    },
    reset() {
      this.data = defaultSave();
      this.save();
    },
    hasProgress() {
      return !!(this.data && (this.data.seenIntro || this.data.chapter > 0 || Object.values(this.data.forms || {}).some(Boolean)));
    },
    unlockForm(id) {
      if (this.data.forms[id]) return false;
      this.data.forms[id] = true;
      this.save();
      return true;
    },
    unlockArt(id) {
      if (this.data.arts[id]) return false;
      this.data.arts[id] = true;
      this.save();
      return true;
    },
    setCheckpoint(cp) {
      this.data.checkpoint = cp;
      this.save();
    },
  };

  // ------------------------------------------------------------------ misc
  const InputMap = null; // defined in input.js
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  PB.C = C;
  PB.U = U;
  PB.FORMS = FORMS;
  PB.FORM_BY_ID = FORM_BY_ID;
  PB.Events = Events;
  PB.Save = Save;
  PB.defaultSave = defaultSave;
  PB.isTouch = isTouch;

  // 全局错误提示，避免黑屏无信息
  PB.showError = function (err) {
    console.error(err);
    const el = U.byId('error');
    if (el) {
      el.hidden = false;
      el.textContent = 'PRISMBOUND 遇到了一个错误 / A prism cracked:\n\n' + (err && err.stack ? err.stack : String(err));
    }
  };
})();
