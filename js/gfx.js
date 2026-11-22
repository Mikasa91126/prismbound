/* ============================================================
   gfx.js — 双层整数像素渲染
   480×270 纯像素世界 → 整数倍放大；960×540 高清双语 UI
   程序化天空、视差地形、元素覆层、粒子与天气
   ============================================================ */
(function () {
  'use strict';
  const PB = window.PB;
  const { C, U } = PB;
  const T = C.TILE;
  const TAU = Math.PI * 2;

  const THEMES = {
    ember: {
      id: 'ember',
      sky: ['#1a1430', '#341b3f', '#642b48', '#a34b4c', '#dc8257', '#f7c080'],
      sun: '#ffe9b0', sunGlow: '#ff9f45',
      far: '#2a2138', mid: '#3a2a40', near: '#4d3648', foreground: '#191320', rim: '#c97a5c',
      rockDark: '#2f2435', rock: '#58434a', rockLight: '#7a5f59', rockEdge: '#9d7765',
      cap: '#6f824e', capDark: '#465633', capFlower: '#ffcf7a',
      accent: '#ffb454', accent2: '#ff6a3d',
      water: '#2c6277', waterDeep: '#183b50', waterLight: '#6fc7c9',
      lava: '#e2562f', lavaLight: '#ffc45e',
      vine: '#5e8a4c', vineDark: '#375836',
      weather: 'ember', haze: '#e88a5b',
    },
    frost: {
      id: 'frost',
      sky: ['#050a18', '#0a1530', '#132847', '#1e4660', '#4b7f88'],
      sun: '#d8fbff', sunGlow: '#6ee7ff',
      far: '#152238', mid: '#1c3348', near: '#2a4a5c', foreground: '#0b1622', rim: '#7fd8df',
      rockDark: '#192636', rock: '#31495b', rockLight: '#527486', rockEdge: '#6f9ba4',
      cap: '#d6f6f8', capDark: '#82bcc7', capFlower: '#9fe8f0',
      accent: '#6ee7ff', accent2: '#3f8cff',
      water: '#1d5c7e', waterDeep: '#0d3148', waterLight: '#7fe0ec',
      lava: '#ff6a3d', lavaLight: '#ffd27a',
      vine: '#3f7a70', vineDark: '#265049',
      weather: 'snow', haze: '#6ee7ff',
    },
    rift: {
      id: 'rift',
      sky: ['#080513', '#130a2b', '#231243', '#3a1c58', '#642f76'],
      sun: '#ffe1ff', sunGlow: '#f49cff',
      far: '#17102b', mid: '#21163a', near: '#332250', foreground: '#0e091b', rim: '#8a5bff',
      rockDark: '#1d1531', rock: '#382850', rockLight: '#5b447c', rockEdge: '#7e5ea6',
      cap: '#8a6cb8', capDark: '#5b3f87', capFlower: '#f49cff',
      accent: '#f49cff', accent2: '#8a5bff',
      water: '#2a4b80', waterDeep: '#15284c', waterLight: '#7bc6ff',
      lava: '#ff5a8a', lavaLight: '#ffb0d0',
      vine: '#5a4a8a', vineDark: '#33285a',
      weather: 'motes', haze: '#8a5bff',
    },
    summit: {
      id: 'summit',
      sky: ['#131a31', '#283158', '#49517d', '#8c82ad', '#d8bdb2', '#ffe6c4'],
      sun: '#fff4d0', sunGlow: '#ffd966',
      far: '#222844', mid: '#343a5e', near: '#535579', foreground: '#1a1f36', rim: '#ffd966',
      rockDark: '#2a304c', rock: '#4a5070', rockLight: '#747a9c', rockEdge: '#9ba0c2',
      cap: '#e7e4ff', capDark: '#a29ecb', capFlower: '#ffd966',
      accent: '#ffd966', accent2: '#f49cff',
      water: '#376f96', waterDeep: '#1d4466', waterLight: '#9fe8f5',
      lava: '#ff7a3c', lavaLight: '#ffe19a',
      vine: '#6a8a66', vineDark: '#45604a',
      weather: 'light', haze: '#ffd966',
    },
  };

  const BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

  class Particles {
    constructor(gfx) {
      this.gfx = gfx;
      this.list = [];
      this.max = 520;
    }
    add(p) {
      if (this.list.length >= this.max) this.list.shift();
      this.list.push(Object.assign({
        x: 0, y: 0, vx: 0, vy: 0, life: 0.5, maxLife: 0.5,
        size: 1, color: '#fff', gravity: 0, drag: 1, kind: 'px',
        flicker: 0, rot: 0, data: null,
      }, p));
    }
    update(dt) {
      for (const p of this.list) {
        p.life -= dt;
        p.vy += p.gravity;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx;
        p.y += p.vy;
        if (p.rot) p.rot += dt * 2;
      }
      this.list = this.list.filter((p) => p.life > 0);
    }
    draw(ctx) {
      for (const p of this.list) {
        const a = U.clamp(p.life / p.maxLife, 0, 1);
        const x = Math.round(p.x), y = Math.round(p.y);
        ctx.globalAlpha = p.kind === 'ring' ? a * 0.7 : a;
        ctx.fillStyle = p.color;
        if (p.kind === 'ring') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1;
          const r = p.size + (1 - a) * (p.data && p.data.r || 30);
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
        } else if (p.kind === 'line') {
          ctx.fillRect(x, y, (p.data && p.data.len || 6) * (p.data && p.data.dir || 1), 1);
        } else if (p.kind === 'diamond') {
          ctx.fillRect(x, y - 1, 1, 3);
          ctx.fillRect(x - 1, y, 3, 1);
        } else if (p.kind === 'glyph') {
          ctx.fillRect(x - 2, y - 2, 5, 1);
          ctx.fillRect(x - 2, y + 2, 5, 1);
          ctx.fillRect(x - 2, y - 2, 1, 5);
          ctx.fillRect(x + 2, y - 2, 1, 5);
        } else if (p.kind === 'circle') {
          ctx.beginPath(); ctx.arc(x, y, p.size, 0, TAU); ctx.fill();
        } else {
          ctx.fillRect(x, y, p.size, p.size);
        }
      }
      ctx.globalAlpha = 1;
    }

    dust(x, y, dir = 0, n = 4) {
      for (let i = 0; i < n; i++) {
        this.add({
          x: x + U.rand(-3, 3), y: y - U.rand(0, 3),
          vx: dir * U.rand(0.2, 1.1) + U.rand(-0.3, 0.3), vy: -U.rand(0.1, 0.7),
          life: U.rand(0.25, 0.5), maxLife: 0.5, size: U.rand(1, 2),
          color: 'rgba(220,205,185,.55)', drag: 0.94, gravity: 0.01,
        });
      }
    }
    sparkle(x, y, color = '#ffe6a0') {
      this.add({
        x, y, vx: U.rand(-0.25, 0.25), vy: U.rand(-0.6, -0.1),
        life: U.rand(0.35, 0.7), maxLife: 0.7, size: 1, color, kind: 'diamond', drag: 0.97,
      });
    }
    sparkleRing(x, y, color = '#ffe6a0') {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        this.add({
          x, y, vx: Math.cos(a) * U.rand(0.6, 1.5), vy: Math.sin(a) * U.rand(0.4, 1.1),
          life: U.rand(0.35, 0.65), maxLife: 0.65, size: 1, color, kind: 'px', drag: 0.93,
        });
      }
    }
    emitBurst(x, y, type, n, angle = 0) {
      for (let i = 0; i < n; i++) {
        const a = angle + U.rand(-1.6, 1.6);
        const sp = U.rand(0.5, 2.2);
        if (type === 'dash') {
          this.add({
            x, y, vx: -Math.cos(a) * sp * 1.6, vy: Math.sin(a) * sp * 0.3,
            life: U.rand(0.15, 0.35), maxLife: 0.35, size: U.rand(1, 2),
            color: i % 2 ? '#ffffff' : '#7ef0e0', kind: 'line',
            data: { len: U.rand(3, 8), dir: -Math.sign(Math.cos(a)) },
          });
        } else if (type === 'fire') {
          this.add({
            x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.4,
            life: U.rand(0.25, 0.6), maxLife: 0.6, size: U.rand(1, 3),
            color: i % 3 === 0 ? '#ffe6a0' : i % 3 === 1 ? '#ff9f45' : '#e2562f',
            gravity: -0.02, drag: 0.94,
          });
        } else if (type === 'gravity') {
          this.add({
            x, y, vx: Math.cos(a) * sp * 0.6, vy: Math.sin(a) * sp * 0.6,
            life: U.rand(0.4, 0.9), maxLife: 0.9, size: U.rand(1, 2),
            color: '#b48cff', kind: i % 3 === 0 ? 'glyph' : 'px', drag: 0.92,
          });
        } else if (type === 'dust') {
          this.add({
            x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5 - 0.3,
            life: U.rand(0.25, 0.6), maxLife: 0.6, size: U.rand(1, 2),
            color: 'rgba(200,190,170,.5)', gravity: 0.02, drag: 0.92,
          });
        } else if (type === 'ice') {
          this.add({
            x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.3,
            life: U.rand(0.3, 0.7), maxLife: 0.7, size: U.rand(1, 3),
            color: i % 2 ? '#d8fbff' : '#6ee7ff', gravity: 0.08, drag: 0.96,
          });
        } else {
          this.add({
            x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: U.rand(0.2, 0.5), maxLife: 0.5, size: U.rand(1, 2),
            color: i % 2 ? '#fff6cf' : '#ffd966', gravity: 0.04, drag: 0.95,
          });
        }
      }
    }
    ember(x, y, vy = -0.25, color = '#ff9f45') {
      this.add({
        x, y, vx: U.rand(-0.15, 0.15), vy,
        life: U.rand(0.6, 1.4), maxLife: 1.4, size: 1,
        color: Math.random() < 0.3 ? '#ffe6a0' : color,
        gravity: -0.01, drag: 0.99, flicker: 1,
      });
    }
    snowflake(x, y) {
      this.add({
        x, y, vx: U.rand(-0.2, 0.2), vy: U.rand(0.15, 0.45),
        life: U.rand(0.9, 1.8), maxLife: 1.8, size: Math.random() < 0.3 ? 2 : 1,
        color: 'rgba(220,250,255,.75)', gravity: 0.005, drag: 0.995,
      });
    }
    gravityRune(x, y) {
      this.add({
        x, y, vx: U.rand(-0.3, 0.3), vy: U.rand(-0.5, -0.1),
        life: U.rand(0.4, 0.8), maxLife: 0.8, size: 1,
        color: Math.random() < 0.5 ? '#b48cff' : '#e9dcff', kind: 'glyph', drag: 0.97,
      });
    }
    gravityPulse(x, y, color = '#b48cff') {
      this.add({ x, y, life: 0.45, maxLife: 0.45, kind: 'ring', color, size: 6, data: { r: 50 }, drag: 1 });
      this.emitBurst(x, y, 'gravity', 14);
    }
    frostPulse(x, y, color = '#6ee7ff') {
      this.add({ x, y, life: 0.42, maxLife: 0.42, kind: 'ring', color, size: 5, data: { r: 48 }, drag: 1 });
      for (let i = 0; i < 12; i++) {
        const a = U.rand(0, TAU);
        this.add({
          x, y, vx: Math.cos(a) * U.rand(0.6, 2), vy: Math.sin(a) * U.rand(0.3, 1.2),
          life: U.rand(0.3, 0.7), maxLife: 0.7, size: 1, color: i % 2 ? '#d8fbff' : color, drag: 0.94,
        });
      }
    }
    iceShatter(x, y) {
      for (let i = 0; i < 5; i++) {
        this.add({
          x: x + U.rand(-4, 4), y: y + U.rand(-4, 4),
          vx: U.rand(-1.2, 1.2), vy: U.rand(-1.6, 0.2),
          life: U.rand(0.3, 0.7), maxLife: 0.7, size: U.rand(1, 2),
          color: Math.random() < 0.4 ? '#ffffff' : '#9feaf7', gravity: 0.12, drag: 0.97,
        });
      }
    }
    steam(x, y, dir = -1) {
      this.add({
        x, y, vx: U.rand(-0.2, 0.2), vy: dir * U.rand(0.3, 1.2),
        life: U.rand(0.5, 1.2), maxLife: 1.2, size: U.rand(1, 3),
        color: 'rgba(230,250,255,.55)', drag: 0.98, gravity: -0.01,
      });
    }
    smoke(x, y) {
      this.add({
        x, y, vx: U.rand(-0.3, 0.3), vy: U.rand(-0.8, -0.2),
        life: U.rand(0.6, 1.3), maxLife: 1.3, size: U.rand(2, 4),
        color: 'rgba(80,75,85,.55)', drag: 0.97, gravity: -0.01,
      });
    }
    explosion(x, y) {
      this.emitBurst(x, y, 'fire', 24);
      for (let i = 0; i < 10; i++) this.smoke(x + U.rand(-8, 8), y + U.rand(-8, 8));
      this.add({ x, y, life: 0.4, maxLife: 0.4, kind: 'ring', color: '#ffd27a', size: 8, data: { r: 42 }, drag: 1 });
    }
    poundWave(x, y, color = '#ffd966') {
      for (let i = 0; i < 2; i++) {
        this.add({ x, y: y - i * 2, life: 0.45 + i * 0.12, maxLife: 0.45 + i * 0.12, kind: 'ring', color, size: 4 + i * 4, data: { r: 34 + i * 8 }, drag: 1 });
      }
      this.emitBurst(x, y, 'dust', 14);
    }
    dashTrail(x, y, dir, color = '#7ef0e0') {
      this.add({
        x: x - dir * 5, y: y + U.rand(-6, 6), vx: -dir * U.rand(0.3, 0.8), vy: 0,
        life: U.rand(0.12, 0.3), maxLife: 0.3, size: 1, color,
        kind: 'line', data: { len: U.rand(3, 7), dir: -dir }, drag: 0.95,
      });
    }
    warp(x, y) {
      this.add({
        x, y, vx: U.rand(-0.3, 0.3), vy: U.rand(-0.4, 0.1),
        life: U.rand(0.25, 0.6), maxLife: 0.6, size: 1,
        color: Math.random() < 0.5 ? '#f49cff' : '#ffe1ff', kind: 'diamond', drag: 0.96,
      });
    }
    warpBurst(x, y) {
      this.add({ x, y, life: 0.42, maxLife: 0.42, kind: 'ring', color: '#f49cff', size: 5, data: { r: 40 }, drag: 1 });
      for (let i = 0; i < 16; i++) {
        const a = U.rand(0, TAU);
        this.add({
          x, y, vx: Math.cos(a) * U.rand(0.8, 2.4), vy: Math.sin(a) * U.rand(0.8, 2.4),
          life: U.rand(0.25, 0.6), maxLife: 0.6, size: 1,
          color: i % 3 === 0 ? '#ffffff' : '#f49cff', drag: 0.94,
        });
      }
    }
    clockGlyph(x, y) {
      this.add({
        x, y, vx: U.rand(-0.2, 0.2), vy: U.rand(-0.3, 0), life: U.rand(0.3, 0.7), maxLife: 0.7,
        size: 1, color: 'rgba(126,240,224,.65)', kind: 'glyph', drag: 0.97,
      });
    }
    windStreak(x, y, dir) {
      this.add({
        x, y, vx: -dir * U.rand(1.2, 2.4), vy: 0,
        life: U.rand(0.15, 0.35), maxLife: 0.35, size: 1,
        color: 'rgba(200,251,255,.55)', kind: 'line', data: { len: U.rand(4, 9), dir: -dir }, drag: 0.98,
      });
    }
    updraft(x, y) {
      this.add({
        x: x + U.rand(-5, 5), y, vx: 0, vy: -U.rand(0.3, 1),
        life: U.rand(0.3, 0.7), maxLife: 0.7, size: 1,
        color: 'rgba(220,250,255,.6)', drag: 0.99,
      });
    }
    revive(x, y) {
      for (let i = 0; i < 18; i++) {
        const a = U.rand(0, TAU);
        this.add({
          x, y, vx: Math.cos(a) * U.rand(0.5, 2.2), vy: Math.sin(a) * U.rand(0.4, 1.6),
          life: U.rand(0.5, 1.1), maxLife: 1.1, size: U.rand(1, 2),
          color: i % 2 ? '#ffe6a0' : '#9feaf7', drag: 0.95, gravity: -0.02,
        });
      }
    }
  }

  class Gfx {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.world = null;
      this.wctx = null;
      this.k = 4;
      this.dpr = 1;
      this.particles = new Particles(this);
      this.ambient = [];
      this.time = 0;
      this.flash = { alpha: 0, color: '#fff' };
      this.bg = {};
      this.bgStars = {};
      this._ambientInit = false;
      this._lastTheme = null;
    }

    init() {
      this.canvas = U.byId('game');
      this.ctx = this.canvas.getContext('2d');
      this.world = document.createElement('canvas');
      this.world.width = C.W;
      this.world.height = C.H;
      this.wctx = this.world.getContext('2d');
      this.wctx.imageSmoothingEnabled = false;
      this.ctx.imageSmoothingEnabled = false;
      this.dpr = Math.min(2.5, window.devicePixelRatio || 1);
      this.buildStars();
      window.addEventListener('resize', () => this.resize());
      this.resize();
    }

    resize() {
      // 尽量使用屏内最大的偶数像素倍率；小窗口由 CSS 等比缩放兜底
      const availW = Math.max(320, window.innerWidth);
      const availH = Math.max(180, window.innerHeight);
      const dpr = this.dpr || 1;
      let maxK = Math.floor(Math.min((availW * dpr) / C.W, (availH * dpr) / C.H));
      maxK = Math.max(2, Math.min(10, maxK));
      let k = maxK - (maxK % 2);
      if (k < 2) k = 2;
      this.k = k;
      this.canvas.width = C.W * k;
      this.canvas.height = C.H * k;
      const cssW = (C.W * k) / dpr;
      const cssH = (C.H * k) / dpr;
      this.canvas.style.width = cssW + 'px';
      this.canvas.style.height = cssH + 'px';
      this.ctx.imageSmoothingEnabled = false;
      this.wctx.imageSmoothingEnabled = false;
    }

    buildStars() {
      const rng = U.mulberry32(4109);
      for (let t = 0; t < 4; t++) {
        const arr = [];
        for (let i = 0; i < 110; i++) {
          arr.push({
            x: Math.floor(rng() * C.W),
            y: Math.floor(rng() * 190),
            b: rng(),
            p: rng() * TAU,
            s: rng() < 0.12 ? 2 : 1,
          });
        }
        this.bgStars[t] = arr;
      }
    }

    theme(id) { return THEMES[id] || THEMES.ember; }

    // ------------------------------------------------------------- update
    update(dt) {
      this.time += dt;
      this.particles.update(dt);
      this.updateAmbient(dt);
      this.flash.alpha = Math.max(0, this.flash.alpha - dt * 4);
    }

    flashScreen(color = '#ffffff', alpha = 0.5) {
      this.flash.color = color;
      this.flash.alpha = Math.max(this.flash.alpha, alpha);
    }

    updateAmbient(dt) {
      const themeId = this._lastTheme || 'ember';
      const theme = this.theme(themeId);
      let want = 0;
      if (theme.weather === 'snow') want = 46;
      else if (theme.weather === 'ember') want = 36;
      else if (theme.weather === 'motes') want = 40;
      else if (theme.weather === 'light') want = 32;
      while (this.ambient.length < want) {
        this.ambient.push(this.spawnAmbient(theme, true));
      }
      for (const p of this.ambient) {
        p.t += dt;
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.ph += dt;
        if (theme.weather === 'snow') p.x += Math.sin(p.ph * 1.4 + p.seed) * 0.12;
        if (p.x < -10) p.x += C.W + 20;
        if (p.x > C.W + 10) p.x -= C.W + 20;
        if (p.y < -10) p.y += C.H + 20;
        if (p.y > C.H + 10) p.y -= C.H + 20;
      }
    }

    spawnAmbient(theme, initial) {
      const seed = Math.random() * TAU;
      if (theme.weather === 'snow') {
        return { x: U.rand(0, C.W), y: initial ? U.rand(0, C.H) : -4, vx: U.rand(-0.05, 0.08), vy: U.rand(0.15, 0.4), size: Math.random() < 0.3 ? 2 : 1, seed, ph: seed, kind: 'snow' };
      }
      if (theme.weather === 'ember') {
        return { x: U.rand(0, C.W), y: initial ? U.rand(0, C.H) : C.H + 4, vx: U.rand(-0.04, 0.06), vy: -U.rand(0.1, 0.35), size: Math.random() < 0.25 ? 2 : 1, seed, ph: seed, kind: 'ember' };
      }
      if (theme.weather === 'motes') {
        return { x: U.rand(0, C.W), y: initial ? U.rand(0, C.H) : C.H + 4, vx: U.rand(-0.02, 0.02), vy: -U.rand(0.04, 0.16), size: Math.random() < 0.2 ? 2 : 1, seed, ph: seed, kind: 'mote' };
      }
      return { x: U.rand(0, C.W), y: initial ? U.rand(0, C.H) : C.H + 4, vx: U.rand(-0.02, 0.03), vy: -U.rand(0.05, 0.2), size: Math.random() < 0.2 ? 2 : 1, seed, ph: seed, kind: 'light' };
    }

    drawBossBackdrop(ctx, game) {
      const boss = game.boss;
      const pd = boss.phaseData ? boss.phaseData() : { color: '#f49cff', glow: '#8a5bff' };
      const t = this.time;
      ctx.save();
      // 巨大棱镜虚影
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = pd.glow;
      const cx = C.W / 2, cy = 92;
      const size = 150;
      const pts = [
        [cx, cy - size], [cx + size * 0.62, cy - size * 0.2],
        [cx + size * 0.34, cy + size * 0.8], [cx - size * 0.34, cy + size * 0.8],
        [cx - size * 0.62, cy - size * 0.2],
      ];
      ctx.beginPath();
      pts.forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py));
      ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = pd.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 200, C.H);
      ctx.lineTo(cx, cy + 20);
      ctx.lineTo(cx + 200, C.H);
      ctx.stroke();
      // 漂浮符文
      for (let i = 0; i < 14; i++) {
        const a = t * 0.2 + i * TAU / 14;
        const rx = cx + Math.cos(a) * (170 + (i % 3) * 24);
        const ry = cy + 52 + Math.sin(a) * 62;
        ctx.globalAlpha = 0.12 + (i % 4) * 0.03;
        ctx.fillStyle = i % 2 ? pd.color : '#ffffff';
        ctx.fillRect(Math.round(rx), Math.round(ry), i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
      }
      // 地面法阵
      ctx.globalAlpha = 0.11;
      ctx.strokeStyle = pd.color;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(C.W / 2, C.H - 34, 150, 22, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(C.W / 2, C.H - 34, 116, 16, 0, 0, TAU); ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = t * 0.3 + i * TAU / 8;
        ctx.fillRect(Math.round(C.W / 2 + Math.cos(a) * 150), Math.round(C.H - 34 + Math.sin(a) * 22), 2, 2);
      }
      ctx.restore();
    }

    drawAmbient(ctx, theme) {
      for (const p of this.ambient) {
        const x = Math.round(p.x), y = Math.round(p.y);
        const tw = 0.5 + Math.sin(p.ph * 2 + p.seed) * 0.3;
        ctx.globalAlpha = 0.55 * tw;
        if (p.kind === 'snow') ctx.fillStyle = '#e8ffff';
        else if (p.kind === 'ember') ctx.fillStyle = Math.random() < 0.5 ? '#ffb454' : '#ffe6a0';
        else if (p.kind === 'mote') ctx.fillStyle = Math.random() < 0.5 ? '#f49cff' : '#b48cff';
        else ctx.fillStyle = '#ffeab0';
        ctx.fillRect(x, y, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    }

    // ------------------------------------------------------------- render
    render(game) {
      const theme = this.theme(game.themeOverride || (game.world ? game.world.chapter.theme : 'ember'));
      this._lastTheme = theme.id;
      const ctx = this.wctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, C.W, C.H);

      const cam = game.camera;
      const shakeX = game.shakeX || 0;
      const shakeY = game.shakeY || 0;

      this.drawSky(ctx, theme, cam);
      this.drawParallax(ctx, theme, cam);
      if (game.bossActive && game.boss) this.drawBossBackdrop(ctx, game);
      this.drawAmbient(ctx, theme);

      ctx.save();
      ctx.translate(-Math.round(cam.x) + Math.round(shakeX), -Math.round(cam.y) + Math.round(shakeY));
      if (game.world) {
        this.drawTiles(ctx, game.world, theme, game);
        this.drawEntities(ctx, game.world, game);
        if (game.player && game.state !== 'title' && game.state !== 'intro' && game.state !== 'ending') {
          game.player.draw(ctx, cam);
        }
        if (game.bossActive && game.boss && game.boss.draw) game.boss.draw(ctx);
        this.particles.draw(ctx);
      }
      ctx.restore();

      // 屏幕边缘的前景框：藤蔓、冰锥、电缆与晶体，为画面制造纵深
      this.drawForegroundFrame(ctx, theme, cam);
      // 顶部空气透视/暗角（世界层内，具有像素感）
      this.drawAtmosphere(ctx, theme, game);

      // 放大到显示画布
      const main = this.ctx;
      main.setTransform(1, 0, 0, 1, 0, 0);
      main.imageSmoothingEnabled = false;
      main.clearRect(0, 0, this.canvas.width, this.canvas.height);
      main.drawImage(this.world, 0, 0, C.W, C.H, 0, 0, C.W * this.k, C.H * this.k);

      if (this.flash.alpha > 0.001 && PB.Save.data.settings.flashes !== false) {
        main.save();
        main.globalAlpha = this.flash.alpha * 0.65;
        main.fillStyle = this.flash.color;
        main.fillRect(0, 0, this.canvas.width, this.canvas.height);
        main.restore();
      }

      // UI 层：960×540 设计坐标
      if (PB.UI) {
        main.save();
        const s = this.k / 2;
        main.setTransform(s, 0, 0, s, 0, 0);
        PB.UI.draw(game, main);
        main.restore();
      }
    }

    // ------------------------------------------------------------- sky
    drawSky(ctx, theme, cam) {
      const bands = theme.sky;
      const bandH = Math.ceil(C.H / bands.length);
      for (let i = 0; i < bands.length; i++) {
        ctx.fillStyle = bands[i];
        ctx.fillRect(0, i * bandH - 2, C.W, bandH + 4);
      }
      // 抖动色带
      for (let i = 0; i < bands.length - 1; i++) {
        const y = (i + 1) * bandH;
        const a = theme.sky[i], b = theme.sky[i + 1];
        for (let yy = -3; yy <= 3; yy++) {
          for (let xx = 0; xx < C.W; xx += 2) {
            const thr = BAYER4[(yy + 3) & 3][(xx >> 1) & 3] / 16;
            const f = 0.5 + yy / 8;
            ctx.fillStyle = f > thr ? b : a;
            ctx.fillRect(xx, y + yy, 2, 1);
          }
        }
      }
      // 星
      const stars = this.bgStars[theme.id === 'frost' ? 0 : theme.id === 'rift' ? 1 : theme.id === 'summit' ? 2 : 3];
      if (stars) {
        const ox = -cam.x * 0.02, oy = -cam.y * 0.015;
        for (const s of stars) {
          const tw = (Math.sin(this.time * 1.1 + s.p) + 1) / 2;
          if (tw < 0.25) continue;
          const x = U.wrap(s.x + ox, C.W);
          const y = s.y + oy;
          if (y < 0 || y > 210) continue;
          ctx.globalAlpha = 0.25 + tw * s.b * 0.65;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(x), Math.round(y), s.s, s.s);
        }
        ctx.globalAlpha = 1;
      }
      // 地平线光晕
      ctx.save();
      const hg = ctx.createRadialGradient(350, 176, 10, 350, 176, 260);
      hg.addColorStop(0, U.rgba(theme.haze, 0.13));
      hg.addColorStop(0.55, U.rgba(theme.haze, 0.05));
      hg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(0, 60, C.W, 180);
      // 斜向光柱
      ctx.globalAlpha = 0.035;
      ctx.fillStyle = theme.sunGlow;
      for (let i = 0; i < 3; i++) {
        const x = 80 + i * 150;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 34, 0);
        ctx.lineTo(x - 20, C.H);
        ctx.lineTo(x - 66, C.H);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      // 日月 / 大棱镜
      this.drawCelestial(ctx, theme, cam);
      // 极光
      if (theme.id === 'frost' || theme.id === 'rift' || theme.id === 'summit') {
        this.drawAurora(ctx, theme, cam);
      }
      // 云/雾
      this.drawHaze(ctx, theme, cam);
    }

    drawCelestial(ctx, theme, cam) {
      const ox = -cam.x * 0.01;
      let cx = 370 + ox, cy = 58;
      if (theme.id === 'ember') { cx = 382 + ox; cy = 76; }
      if (theme.id === 'rift') { cx = 348 + ox; cy = 52; }
      if (theme.id === 'summit') { cx = 240 + ox; cy = 58; }
      const r = theme.id === 'ember' ? 18 : theme.id === 'summit' ? 14 : 10;
      ctx.save();
      // 抖动光晕（限制在圆形范围内，避免出现方形边界）
      for (let i = 3; i >= 1; i--) {
        ctx.globalAlpha = 0.022 * i;
        ctx.fillStyle = theme.sunGlow;
        const rr = r * (0.95 + i * 0.5);
        for (let yy = -r * 3; yy < r * 3; yy += 2) {
          for (let xx = -r * 3; xx < r * 3; xx += 2) {
            const dd = xx * xx + yy * yy;
            if (dd < rr * rr && dd > (rr - 8) * (rr - 8)) {
              if ((BAYER4[((yy + 60) >> 1) & 3][((xx + 60) >> 1) & 3] / 16) < 0.55) {
                ctx.fillRect(Math.round(cx + xx), Math.round(cy + yy), 2, 2);
              }
            } else if (dd < (rr - 8) * (rr - 8)) {
              if ((BAYER4[((yy + 60) >> 1) & 3][((xx + 60) >> 1) & 3] / 16) < 0.1) {
                ctx.fillRect(Math.round(cx + xx), Math.round(cy + yy), 2, 2);
              }
            }
          }
        }
      }
      // 柱状光
      ctx.globalAlpha = 0.03;
      ctx.fillStyle = theme.sunGlow;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.7, cy + r * 0.3);
      ctx.lineTo(cx + r * 0.7, cy + r * 0.3);
      ctx.lineTo(cx + r * 2.1, C.H);
      ctx.lineTo(cx - r * 2.1, C.H);
      ctx.closePath();
      ctx.fill();
      // 本体
      ctx.globalAlpha = 1;
      ctx.fillStyle = theme.sun;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      if (theme.id === 'rift') {
        // 环
        ctx.strokeStyle = 'rgba(244,156,255,.45)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.8, r * 0.55, -0.35, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = theme.sunGlow;
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.65, 0, TAU); ctx.fill();
      }
      if (theme.id === 'summit') {
        // 大棱镜在空中
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = theme.sunGlow;
        ctx.fillRect(cx - 1, cy + r, 2, 40);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    drawAurora(ctx, theme, cam) {
      const t = this.time * 0.15;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let band = 0; band < 2; band++) {
        const baseY = 40 + band * 26;
        for (let x = 0; x < C.W; x += 2) {
          const yy = baseY + Math.sin(x * 0.025 + t + band * 2) * 12 + Math.sin(x * 0.007 - t * 0.7) * 10;
          const h = 3 + (Math.sin(x * 0.04 + t * 2) + 1) * 4;
          const a = 0.02 + 0.025 * (Math.sin(x * 0.018 + t + band) + 1) / 2;
          ctx.globalAlpha = a;
          ctx.fillStyle = band ? theme.accent : theme.accent2;
          ctx.fillRect(x - Math.round(cam.x * 0.01), Math.round(yy), 2, Math.round(h));
        }
      }
      ctx.restore();
    }

    drawHaze(ctx, theme, cam) {
      // 低空雾带
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const y = 150 + i * 26;
        const off = (this.time * (2 + i) + cam.x * (0.05 + i * 0.02)) % (C.W + 160);
        ctx.globalAlpha = 0.06 + i * 0.015;
        ctx.fillStyle = theme.haze;
        for (let x = -160; x < C.W + 160; x += 160) {
          ctx.beginPath();
          ctx.ellipse(x + off - 160, y, 100, 9 + i * 2, 0, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // ------------------------------------------------------------- parallax layers
    getLayer(themeId) {
      if (!this.bg[themeId]) {
        const theme = this.theme(themeId);
        this.bg[themeId] = [0, 1, 2].map((i) => this.makeLayer(theme, i));
        this.bg[themeId].push(this.makeForeground(theme));
      }
      return this.bg[themeId];
    }

    makeForeground(theme) {
      const w = 720, h = 320;
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const rng = U.mulberry32({ ember: 991, frost: 1171, rift: 1301, summit: 1447 }[theme.id]);
      ctx.fillStyle = theme.foreground;
      if (theme.id === 'ember') {
        // 前景蕨叶与断柱
        for (let i = 0; i < 10; i++) {
          const x = i * 78 + rng() * 30;
          const bh = 28 + rng() * 52;
          ctx.fillStyle = theme.foreground;
          ctx.fillRect(x, h - bh - 20, 10 + rng() * 12, bh + 20);
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = theme.rim;
          ctx.fillRect(x + 2, h - bh - 20, 1, Math.max(4, bh * 0.4));
          ctx.globalAlpha = 1;
          // 蕨叶
          for (let l = 0; l < 5; l++) {
            const ly = h - bh - 6 + l * 8;
            const dir = l % 2 ? 1 : -1;
            ctx.fillStyle = theme.foreground;
            ctx.fillRect(x - dir * 10, ly, 12, 3);
            ctx.fillRect(x - dir * 16, ly + 3, 8, 2);
          }
        }
        // 悬挂灯
        for (let i = 0; i < 4; i++) {
          const x = 90 + rng() * 560;
          const y = 60 + rng() * 80;
          ctx.strokeStyle = theme.foreground;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y); ctx.stroke();
          ctx.fillStyle = theme.accent;
          ctx.globalAlpha = 0.5;
          ctx.fillRect(x - 2, y, 4, 5);
          ctx.globalAlpha = 1;
        }
      } else if (theme.id === 'frost') {
        for (let i = 0; i < 12; i++) {
          const x = i * 64 + rng() * 20;
          const bh = 40 + rng() * 60;
          ctx.fillStyle = theme.foreground;
          ctx.fillRect(x, h - bh, 4, bh);
          ctx.fillRect(x + 4, h - bh + 4, 3, bh * 0.8);
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = theme.rim;
          ctx.fillRect(x, h - bh, 1, 8);
          ctx.globalAlpha = 1;
        }
      } else if (theme.id === 'rift') {
        for (let i = 0; i < 9; i++) {
          const x = i * 82 + rng() * 30;
          const y = h - 50 - rng() * 80;
          ctx.fillStyle = theme.foreground;
          ctx.fillRect(x, y, 32 + rng() * 24, 10);
          ctx.fillRect(x + 8, y + 10, 6, 20 + rng() * 30);
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = theme.rim;
          ctx.fillRect(x + 2, y, 16, 1);
          ctx.globalAlpha = 1;
        }
      } else {
        for (let i = 0; i < 8; i++) {
          const x = i * 94 + rng() * 30;
          const bh = 30 + rng() * 55;
          ctx.fillStyle = theme.foreground;
          ctx.beginPath();
          ctx.moveTo(x, h);
          ctx.lineTo(x + 18, h - bh);
          ctx.lineTo(x + 34, h);
          ctx.fill();
          ctx.globalAlpha = 0.4;
          ctx.fillStyle = theme.rim;
          ctx.fillRect(x + 17, h - bh, 2, 10);
          ctx.globalAlpha = 1;
        }
      }
      ctx.fillStyle = theme.foreground;
      ctx.fillRect(0, h - 18, w, 18);
      return { canvas: cv, factor: 0.78, yFactor: 0.12, foreground: true };
    }

    makeLayer(theme, index) {
      const w = 720, h = 320;
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const rng = U.mulberry32({ ember: 3901, frost: 7103, rift: 5507, summit: 8803 }[theme.id] + index * 131);
      const colors = index === 0 ? [theme.far, theme.mid] : index === 1 ? [theme.mid, theme.near] : [theme.near, theme.rockDark];
      if (theme.id === 'ember') this.paintEmberLayer(ctx, theme, rng, index, w, h);
      else if (theme.id === 'frost') this.paintFrostLayer(ctx, theme, rng, index, w, h);
      else if (theme.id === 'rift') this.paintRiftLayer(ctx, theme, rng, index, w, h);
      else this.paintSummitLayer(ctx, theme, rng, index, w, h);
      return { canvas: cv, factor: 0.16 + index * 0.17, yFactor: 0.05 + index * 0.06 };
    }

    mountain(ctx, rng, x, y, w, h, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const px = x + (i / steps) * w;
        const py = y + Math.sin(i * 1.7 + rng() * 0.3) * h * 0.12 - (i === 7 ? h * 0.35 : 0);
        ctx.lineTo(px, py);
      }
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.fill();
    }

    paintEmberLayer(ctx, theme, rng, index, w, h) {
      const base = h - (index === 0 ? 42 : index === 1 ? 20 : 4);
      const color = index === 0 ? theme.far : index === 1 ? theme.mid : theme.near;
      const color2 = index === 0 ? theme.mid : index === 1 ? theme.near : theme.rockDark;
      // 层层山脊
      if (index === 0) {
        // 远处暖雾
        ctx.globalAlpha = 0.09;
        ctx.fillStyle = theme.haze;
        ctx.fillRect(0, 120, w, 100);
        ctx.globalAlpha = 1;
        this.ridge(ctx, rng, base + 6, 44, 110, 46, color);
        ctx.globalAlpha = 0.55;
        this.ridge(ctx, rng, base + 36, 26, 64, 34, color2);
        ctx.globalAlpha = 1;
        // 山脊微光
        for (let i = 0; i < 18; i++) {
          ctx.globalAlpha = 0.12 + rng() * 0.16;
          ctx.fillStyle = theme.rim;
          ctx.fillRect(Math.floor(rng() * w), base - 20 - rng() * 60, 2, 1);
        }
        ctx.globalAlpha = 1;
      } else if (index === 1) {
        this.ridge(ctx, rng, base + 4, 24, 70, 38, color);
        // 遗迹拱门与塔楼
        for (let i = 0; i < 7; i++) {
          const x = 18 + i * 102 + rng() * 22;
          const tw = 24 + rng() * 18;
          const th = 55 + rng() * 80;
          ctx.fillStyle = color2;
          ctx.fillRect(x, base - th, tw, th + 20);
          // 破口
          ctx.clearRect(x + 2, base - th - 2, tw * 0.35, 5);
          ctx.fillStyle = color;
          ctx.fillRect(x - 4, base - th + 4, tw + 8, 5);
          // 窗
          for (let wy = 0; wy < 4; wy++) {
            if (rng() < 0.7) {
              ctx.fillStyle = 'rgba(255,186,90,.38)';
              ctx.fillRect(x + 5, base - th + 16 + wy * 12, 2, 4);
            }
          }
          // 拱
          if (rng() < 0.55) {
            const ax = x + tw + 8;
            const aw = 30 + rng() * 26;
            const ah = 26 + rng() * 30;
            ctx.fillStyle = color;
            ctx.fillRect(ax, base - ah, aw, ah);
            ctx.fillStyle = 'rgba(20,16,30,.8)';
            ctx.beginPath();
            ctx.arc(ax + aw / 2, base - ah + 6, aw * 0.26, Math.PI, 0);
            ctx.lineTo(ax + aw / 2 + aw * 0.26, base);
            ctx.lineTo(ax + aw / 2 - aw * 0.26, base);
            ctx.closePath(); ctx.fill();
          }
          // 挂藤
          ctx.fillStyle = theme.vineDark;
          if (rng() < 0.45) {
            const vx = x + rng() * tw;
            for (let vy = 0; vy < 4; vy++) ctx.fillRect(vx + Math.sin(vy) * 2, base - th + 8 + vy * 8, 1, 6);
          }
        }
        // 吊桥
        ctx.strokeStyle = color2;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 120; x < w - 100; x += 12) {
          ctx.lineTo(x, base - 62 + Math.sin(x * 0.025) * 8);
        }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,180,84,.16)';
        ctx.lineWidth = 1;
        for (let x = 120; x < w - 100; x += 30) {
          ctx.beginPath();
          ctx.moveTo(x, base - 62 + Math.sin(x * 0.025) * 8);
          ctx.lineTo(x, base - 62 + Math.sin(x * 0.025) * 8 + 8);
          ctx.stroke();
        }
      } else {
        // 近景巨岩与草脊
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 24) {
          const y = base - 10 - Math.abs(Math.sin(x * 0.021 + 1.4)) * 46 - rng() * 12;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = theme.rim;
        for (let x = 10; x < w; x += 38) {
          const y = base - 10 - Math.abs(Math.sin(x * 0.021 + 1.4)) * 46;
          ctx.fillRect(x, Math.round(y), 10, 1);
        }
        ctx.globalAlpha = 1;
        // 巨岩纹理与树根
        for (let i = 0; i < 12; i++) {
          const x = rng() * w;
          const y = base - rng() * 40;
          ctx.fillStyle = color2;
          ctx.fillRect(x, y, 2 + rng() * 14, 1);
          ctx.fillStyle = theme.rockDark;
          ctx.fillRect(x + 4, y + 4, 1, 5);
        }
        // 草帽与小花
        for (let x = 6; x < w; x += 18) {
          const y = base - 10 - Math.abs(Math.sin(x * 0.021 + 1.4)) * 46;
          ctx.fillStyle = theme.capDark;
          ctx.fillRect(x, y - 3, 2, 3);
          if (rng() < 0.25) {
            ctx.fillStyle = theme.capFlower;
            ctx.fillRect(x + 2, y - 4, 1, 1);
          }
        }
      }
      // 发光的窗/尘埃
      if (index === 1) {
        for (let i = 0; i < 18; i++) {
          ctx.globalAlpha = 0.2 + rng() * 0.35;
          ctx.fillStyle = i % 2 ? theme.accent : theme.rim;
          ctx.fillRect(Math.floor(rng() * w), Math.floor(rng() * base), 1, 1);
        }
        ctx.globalAlpha = 1;
      }
    }

    ridge(ctx, rng, base, hMin, hMax, step, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-20, 320);
      for (let x = -20; x <= 740; x += step) {
        const peak = hMin + rng() * (hMax - hMin);
        const y = base - peak;
        ctx.lineTo(x, y);
        ctx.lineTo(x + step * 0.5, y + peak * 0.18);
      }
      ctx.lineTo(740, 320);
      ctx.closePath();
      ctx.fill();
    }

    paintFrostLayer(ctx, theme, rng, index, w, h) {
      const base = h - (index === 0 ? 30 : index === 1 ? 4 : -16);
      const color = index === 0 ? theme.far : index === 1 ? theme.mid : theme.near;
      if (index === 0) {
        for (let x = -50; x < w + 60; x += 110) {
          this.mountain(ctx, rng, x, base - 90 - rng() * 50, 180, 150, color);
          // 雪顶
          ctx.fillStyle = 'rgba(200,240,250,.25)';
          ctx.beginPath();
          ctx.moveTo(x + 55, base - 90 - rng() * 6);
          ctx.lineTo(x + 90, base - 30);
          ctx.lineTo(x + 30, base - 30);
          ctx.closePath();
          ctx.fill();
        }
      } else if (index === 1) {
        // 冰崖与冻结瀑布
        for (let i = 0; i < 5; i++) {
          const x = 40 + i * 140 + rng() * 25;
          const iw = 18 + rng() * 26;
          const ih = 60 + rng() * 100;
          ctx.fillStyle = color;
          ctx.fillRect(x, base - ih, iw, ih);
          ctx.fillStyle = 'rgba(150,230,245,.18)';
          for (let s = 0; s < 4; s++) ctx.fillRect(x + 2 + s * 4, base - ih + 4, 2, ih - 6);
          // 冰锥
          ctx.fillStyle = 'rgba(210,250,255,.32)';
          for (let s = 0; s < 3; s++) {
            ctx.beginPath();
            ctx.moveTo(x + 2, base - ih);
            ctx.lineTo(x + 6 + s * 5, base - ih - 12 - rng() * 12);
            ctx.lineTo(x + 10 + s * 5, base - ih);
            ctx.fill();
          }
        }
      } else {
        for (let i = 0; i < 11; i++) {
          const x = i * 68 + rng() * 20;
          const bh = 20 + rng() * 46;
          ctx.fillStyle = color;
          ctx.fillRect(x, base - bh, 58, bh + 20);
          ctx.fillStyle = 'rgba(220,250,255,.35)';
          ctx.fillRect(x, base - bh, 58, 3);
          // 冰晶
          ctx.fillStyle = 'rgba(126,231,255,.22)';
          if (rng() < 0.6) {
            ctx.beginPath();
            ctx.moveTo(x + 20, base - bh);
            ctx.lineTo(x + 28, base - bh - 16);
            ctx.lineTo(x + 36, base - bh);
            ctx.fill();
          }
        }
      }
      // 星/雪
      for (let i = 0; i < 18; i++) {
        ctx.globalAlpha = 0.2 + rng() * 0.4;
        ctx.fillStyle = '#e8ffff';
        ctx.fillRect(Math.floor(rng() * w), Math.floor(rng() * base), 1, 1);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.fillRect(0, base, w, h - base);
    }

    paintRiftLayer(ctx, theme, rng, index, w, h) {
      const color = index === 0 ? theme.far : index === 1 ? theme.mid : theme.near;
      const accent = theme.accent;
      if (index === 0) {
        // 星云团
        for (let i = 0; i < 10; i++) {
          ctx.globalAlpha = 0.05 + rng() * 0.08;
          ctx.fillStyle = i % 2 ? theme.accent2 : theme.sunGlow;
          ctx.beginPath();
          ctx.ellipse(rng() * w, 30 + rng() * 130, 55 + rng() * 80, 18 + rng() * 30, rng() * 2, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (index === 1) {
        // 浮空城市块
        for (let i = 0; i < 7; i++) {
          const x = 20 + i * 105 + rng() * 20;
          const y = 80 + rng() * 90;
          const bw = 40 + rng() * 60;
          const bh = 12 + rng() * 20;
          ctx.fillStyle = color;
          ctx.fillRect(x, y, bw, bh);
          // 倒挂建筑
          ctx.fillRect(x + 8, y + bh, 12, 18 + rng() * 26);
          ctx.fillRect(x + bw - 26, y + bh, 10, 12 + rng() * 18);
          // 窗
          ctx.fillStyle = 'rgba(244,156,255,.5)';
          for (let wx = 0; wx < 4; wx++) {
            if (rng() < 0.65) ctx.fillRect(x + 5 + wx * 9, y + 4, 2, 2);
          }
          ctx.fillStyle = 'rgba(126,240,224,.35)';
          ctx.fillRect(x + 4, y - 2, bw - 8, 1);
          // 天线
          ctx.fillStyle = color;
          ctx.fillRect(x + bw / 2, y - 18, 1, 18);
          ctx.fillStyle = accent;
          ctx.fillRect(x + bw / 2 - 1, y - 19, 3, 1);
        }
      } else {
        // 近景街区/拱门
        for (let i = 0; i < 8; i++) {
          const x = i * 92 + rng() * 20;
          const bh = 30 + rng() * 60;
          ctx.fillStyle = color;
          ctx.fillRect(x, h - bh - 20, 72, bh + 30);
          ctx.fillStyle = 'rgba(244,156,255,.25)';
          ctx.fillRect(x + 4, h - bh - 18, 64, 1);
          // 霓虹窗
          for (let wy = 0; wy < 3; wy++) {
            ctx.fillStyle = rng() < 0.5 ? 'rgba(126,240,224,.4)' : 'rgba(244,156,255,.4)';
            if (rng() < 0.7) ctx.fillRect(x + 8 + (wy % 2) * 20, h - bh - 8 + wy * 12, 6, 2);
          }
        }
      }
      // 星尘
      for (let i = 0; i < 30; i++) {
        ctx.globalAlpha = 0.2 + rng() * 0.5;
        ctx.fillStyle = rng() < 0.5 ? '#f49cff' : '#9feaf7';
        ctx.fillRect(Math.floor(rng() * w), Math.floor(rng() * h * 0.8), 1, 1);
      }
      ctx.globalAlpha = 1;
    }

    paintSummitLayer(ctx, theme, rng, index, w, h) {
      const base = h - 22;
      const color = index === 0 ? theme.far : index === 1 ? theme.mid : theme.near;
      if (index === 0) {
        for (let x = -40; x < w + 70; x += 115) {
          this.mountain(ctx, rng, x, base - 95 - rng() * 40, 200, 160, color);
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = '#e7e4ff';
          ctx.beginPath();
          ctx.moveTo(x + 70, base - 100);
          ctx.lineTo(x + 100, base - 40);
          ctx.lineTo(x + 40, base - 40);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        // 大棱镜光柱
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = theme.accent;
        ctx.fillRect(340, 20, 6, base - 20);
        ctx.globalAlpha = 1;
      } else if (index === 1) {
        // 神殿廊柱
        for (let i = 0; i < 6; i++) {
          const x = 30 + i * 130 + rng() * 20;
          const ph = 60 + rng() * 60;
          ctx.fillStyle = color;
          ctx.fillRect(x, base - ph, 18, ph);
          ctx.fillRect(x - 8, base - ph - 6, 34, 6);
          ctx.fillStyle = 'rgba(255,217,102,.3)';
          ctx.fillRect(x + 4, base - ph + 6, 2, ph - 12);
          // 晶体
          ctx.fillStyle = 'rgba(231,228,255,.32)';
          ctx.beginPath();
          ctx.moveTo(x + 30, base);
          ctx.lineTo(x + 40, base - 30 - rng() * 20);
          ctx.lineTo(x + 50, base);
          ctx.fill();
        }
      } else {
        // 云海与近景晶簇
        ctx.fillStyle = 'rgba(240,230,255,.15)';
        for (let i = 0; i < 8; i++) {
          ctx.beginPath();
          ctx.ellipse(rng() * w, 220 + rng() * 50, 50 + rng() * 60, 8 + rng() * 8, 0, 0, TAU);
          ctx.fill();
        }
        for (let i = 0; i < 7; i++) {
          const x = i * 105 + rng() * 30;
          const bh = 30 + rng() * 50;
          ctx.fillStyle = color;
          ctx.fillRect(x, base - bh, 20, bh);
          ctx.fillStyle = 'rgba(255,217,102,.2)';
          ctx.fillRect(x + 2, base - bh, 2, bh);
          ctx.fillStyle = 'rgba(231,228,255,.3)';
          ctx.beginPath();
          ctx.moveTo(x - 4, base);
          ctx.lineTo(x + 10, base - bh - 18);
          ctx.lineTo(x + 26, base);
          ctx.fill();
        }
      }
    }

    drawParallax(ctx, theme, cam) {
      const layers = this.getLayer(theme.id);
      for (const layer of layers) {
        const ox = -U.wrap(cam.x * layer.factor, layer.canvas.width);
        const oy = -cam.y * layer.yFactor + (C.H - layer.canvas.height + 40);
        ctx.drawImage(layer.canvas, Math.floor(ox), Math.floor(oy));
        ctx.drawImage(layer.canvas, Math.floor(ox + layer.canvas.width), Math.floor(oy));
      }
    }

    // ------------------------------------------------------------- terrain
    drawTiles(ctx, world, theme, game) {
      const cam = game.camera;
      const x0 = Math.max(0, Math.floor(cam.x / T) - 1);
      const x1 = Math.min(world.width - 1, Math.floor((cam.x + C.W) / T) + 1);
      const y0 = Math.max(0, Math.floor(cam.y / T) - 1);
      const y1 = Math.min(world.height - 1, Math.floor((cam.y + C.H) / T) + 1);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const ch = world.tileAt(tx, ty);
          if (ch === '.') continue;
          this.drawTile(ctx, world, theme, tx, ty, ch, game);
        }
      }
    }

    solidForCap(world, tx, ty) {
      const ch = world.tileAt(tx, ty);
      return ch === '#' || ch === 'c' || ch === '%' || ch === '?' || world.isFrozen(tx, ty);
    }

    drawTile(ctx, world, theme, tx, ty, ch, game) {
      const x = tx * T, y = ty * T;
      if (ch === '#') { this.drawStone(ctx, world, theme, tx, ty, x, y, false); return; }
      if (ch === 'c') { this.drawStone(ctx, world, theme, tx, ty, x, y, true); return; }
      if (ch === '?') { this.drawFakeWall(ctx, world, theme, tx, ty, x, y, game); return; }
      if (ch === '%') { this.drawVine(ctx, world, theme, tx, ty, x, y); return; }
      if (ch === '=') { this.drawOneWay(ctx, theme, tx, ty, x, y); return; }
      if (ch === 'S' || ch === 'M') { this.drawSpring(ctx, theme, ch === 'M', tx, ty, x, y); return; }
      if (ch === '^' || ch === 'v' || ch === '<' || ch === '>') { this.drawSpike(ctx, theme, ch, x, y); return; }
      if (ch === '~') { this.drawWater(ctx, world, theme, tx, ty, x, y); return; }
      if (ch === '!') { this.drawLava(ctx, world, theme, tx, ty, x, y); return; }
      if (ch === '_') { this.drawRail(ctx, theme, x, y); return; }
      // 冻结/蒸汽覆盖（对水与岩浆）
      if (world.isFrozen(tx, ty)) { /* handled inside water/lava */ }
    }

    drawStone(ctx, world, theme, tx, ty, x, y, cracked) {
      const solidAbove = this.solidForCap(world, tx, ty - 1);
      const solidBelow = this.solidForCap(world, tx, ty + 1);
      const solidLeft = this.solidForCap(world, tx - 1, ty);
      const solidRight = this.solidForCap(world, tx + 1, ty);
      const h = U.hash2(tx, ty, 11);
      const h2 = U.hash2(tx * 5, ty * 3, 23);
      // 基底；内部不描边，让相邻石层自然融合
      ctx.fillStyle = theme.rockDark;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = theme.rock;
      ctx.fillRect(x + (solidLeft ? 0 : 1), y + (solidAbove ? 0 : 1), T - (solidLeft ? 0 : 1) - (solidRight ? 0 : 1), T - (solidAbove ? 0 : 1) - (solidBelow ? 0 : 1));
      if (h > 0.55) { ctx.globalAlpha = 0.12; ctx.fillStyle = theme.rockLight; ctx.fillRect(x + 2, y + 2, 7, 5); ctx.globalAlpha = 1; }
      if (h2 < 0.35) { ctx.globalAlpha = 0.14; ctx.fillStyle = '#000'; ctx.fillRect(x + 6, y + 7, 9, 7); ctx.globalAlpha = 1; }
      // 贯穿多个瓦片的岩层线（不形成方格）
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = theme.rockDark;
      for (let yy = 0; yy < T; yy++) {
        if ((ty * T + yy + 7) % 23 === 0) ctx.fillRect(x, y + yy, T, 1);
        if ((ty * T + yy + 7) % 23 === 1) { ctx.globalAlpha = 0.06; ctx.fillStyle = theme.rockLight; ctx.fillRect(x, y + yy, T, 1); ctx.globalAlpha = 0.16; ctx.fillStyle = theme.rockDark; }
      }
      // 局部纵向裂隙
      if (h2 > 0.4) {
        const cx = x + 2 + Math.floor(U.hash2(tx, ty, 15) * 12);
        const len = 4 + Math.floor(U.hash2(tx, ty, 17) * 9);
        ctx.fillStyle = 'rgba(8,6,12,.22)';
        ctx.fillRect(cx, y + 3, 1, Math.min(len, T - 5));
        if (h2 > 0.72) ctx.fillRect(cx + (h2 > 0.85 ? 1 : -1), y + 3 + len - 3, 1, 2);
      }
      // 苔藓/霜脉/晶体/矿脉
      if (theme.id === 'frost' && h < 0.3) {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#c8fbff';
        ctx.fillRect(x + 3, y + 9, 4, 1);
        ctx.fillRect(x + 6, y + 10, 1, 3);
        ctx.globalAlpha = 1;
      } else if (theme.id === 'ember' && h2 < 0.25) {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = theme.capDark;
        ctx.fillRect(x + 2, y + 4, 5, 1);
        ctx.fillRect(x + 4, y + 5, 3, 1);
        ctx.globalAlpha = 1;
      } else if (theme.id === 'rift' && h > 0.82) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = theme.accent;
        ctx.fillRect(x + 4, y + 6, 1, 4);
        ctx.fillRect(x + 5, y + 10, 4, 1);
        ctx.globalAlpha = 1;
      } else if (theme.id === 'summit' && h2 > 0.8) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = theme.capFlower;
        ctx.fillRect(x + 5, y + 5, 1, 5);
        ctx.fillRect(x + 6, y + 8, 3, 1);
        ctx.globalAlpha = 1;
      }
      // 暴露面轮廓
      if (!solidLeft) {
        ctx.fillStyle = theme.rockDark;
        ctx.fillRect(x, y, 2, T);
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = theme.rockLight;
        ctx.fillRect(x + 1, y + 2, 1, T - 4);
        ctx.globalAlpha = 1;
      }
      if (!solidRight) {
        ctx.fillStyle = theme.rockDark;
        ctx.fillRect(x + T - 2, y, 2, T);
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = '#000';
        ctx.fillRect(x + T - 1, y + 1, 1, T - 2);
        ctx.globalAlpha = 1;
      }
      if (!solidBelow) {
        ctx.fillStyle = theme.rockDark;
        ctx.fillRect(x, y + T - 2, T, 2);
      }
      // 顶部生物/矿物冠层
      if (!solidAbove) {
        const capH = 2 + (h > 0.58 ? 1 : 0);
        ctx.fillStyle = theme.capDark;
        ctx.fillRect(x, y, T, capH + 1);
        ctx.fillStyle = theme.cap;
        ctx.fillRect(x, y, T, capH);
        ctx.fillStyle = 'rgba(8,10,16,.3)';
        ctx.fillRect(x + 1, y + capH, T - 2, 1);
        // 不规则草簇/雪沿/晶棱
        for (let i = 0; i < 9; i++) {
          const gh = U.hash2(tx * 11 + i, ty, 31);
          const px = x + 1 + i * 2;
          if (theme.id === 'frost') {
            if (gh > 0.7) { ctx.fillStyle = '#f4ffff'; ctx.fillRect(px, y - 1, 1, 1); }
            if (gh > 0.9) { ctx.fillStyle = theme.capDark; ctx.fillRect(px, y - 2, 1, 1); }
          } else {
            if (gh > 0.6) {
              ctx.fillStyle = theme.capDark;
              ctx.fillRect(px, y - 1 - (gh > 0.84 ? 1 : 0), 1, 1 + (gh > 0.84 ? 1 : 0));
              if (gh > 0.9) { ctx.fillStyle = theme.capFlower; ctx.fillRect(px, y - 2, 1, 1); }
            }
          }
        }
        // 少量发光晶体/小花
        if (h2 > 0.9) {
          ctx.fillStyle = theme.capFlower;
          ctx.globalAlpha = 0.75;
          ctx.fillRect(x + 3, y - 3, 1, 3);
          ctx.fillRect(x + 12, y - 2, 1, 2);
          ctx.globalAlpha = 1;
        }
        // 垂根/藤蔓/冰锥
        if (!solidLeft) {
          ctx.fillStyle = theme.capDark;
          ctx.fillRect(x, y + capH + 1, 1, 3 + Math.floor(h * 4));
          if (theme.id === 'frost') {
            ctx.fillStyle = 'rgba(200,251,255,.5)';
            ctx.fillRect(x + 1, y + capH + 2, 1, 2);
          }
        }
        if (theme.id === 'rift') {
          ctx.fillStyle = theme.accent;
          ctx.globalAlpha = 0.55 + Math.sin(this.time * 2 + tx) * 0.15;
          ctx.fillRect(x + 1, y, T - 2, 1);
          ctx.globalAlpha = 1;
        }
      }
      if (cracked) {
        // 更深的裂缝
        ctx.fillStyle = 'rgba(8,5,10,.9)';
        ctx.fillRect(x + 3, y + 3, 1, 8);
        ctx.fillRect(x + 4, y + 10, 4, 1);
        ctx.fillRect(x + 9, y + 4, 1, 8);
        ctx.fillRect(x + 7, y + 11, 1, 3);
        ctx.fillRect(x + 11, y + 8, 1, 3);
        // 缝隙里透出的脉动微光：暗示岩层下方有空间
        const pulse = 0.4 + Math.sin(this.time * 2.8 + tx * 0.9) * 0.25;
        ctx.globalAlpha = Math.max(0.15, pulse);
        ctx.fillStyle = theme.accent;
        ctx.fillRect(x + 4, y + 6, 1, 1);
        ctx.fillRect(x + 9, y + 7, 1, 1);
        ctx.fillRect(x + 7, y + 12, 1, 1);
        ctx.globalAlpha *= 0.5;
        ctx.fillRect(x + 2, y - 1, 1, 1);
        ctx.fillRect(x + 12, y - 2, 1, 1);
        ctx.globalAlpha = 1;
      }
    }

    drawFakeWall(ctx, world, theme, tx, ty, x, y, game) {
      this.drawStone(ctx, world, theme, tx, ty, x, y, false);
      const warp = game && game.player && game.player.currentForm === 'warp' && game.player.forms.warp;
      if (warp) {
        const pulse = 0.35 + Math.sin(this.time * 3 + tx) * 0.2;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = theme.accent;
        for (let i = 0; i < 3; i++) {
          const px = x + 3 + Math.floor(U.hash2(tx + i, ty, 4) * 10);
          const py = y + 3 + Math.floor(U.hash2(tx, ty + i, 8) * 10);
          ctx.fillRect(px, py, 1, 1);
        }
        ctx.globalAlpha = 1;
      }
    }

    drawVine(ctx, world, theme, tx, ty, x, y) {
      ctx.fillStyle = theme.vineDark;
      ctx.fillRect(x + 2, y, T - 4, T);
      ctx.fillStyle = theme.vine;
      for (let i = 0; i < 3; i++) {
        const px = x + 4 + i * 4 + Math.round(Math.sin(this.time * 0.8 + tx + i) * 1);
        ctx.fillRect(px, y + 1, 2, T - 2);
        for (let ly = 3; ly < T - 2; ly += 5) {
          ctx.fillRect(px + (ly % 2 ? 2 : -2), y + ly, 2, 1);
        }
      }
      ctx.fillStyle = theme.capFlower;
      if (U.hash2(tx, ty, 12) > 0.6) ctx.fillRect(x + 7, y + 4, 2, 2);
      if (world.isBurning(tx, ty)) {
        const f = 0.7 + Math.sin(this.time * 18 + tx) * 0.3;
        ctx.globalAlpha = f;
        ctx.fillStyle = '#ffce6a';
        ctx.fillRect(x + 4, y + 3, 3, 5);
        ctx.fillRect(x + 9, y + 7, 2, 4);
        ctx.fillStyle = '#ff6a3d';
        ctx.fillRect(x + 5, y + 1, 2, 3);
        ctx.globalAlpha = 1;
      }
    }

    drawOneWay(ctx, theme, tx, ty, x, y) {
      ctx.fillStyle = 'rgba(8,10,18,.55)';
      ctx.fillRect(x, y + 6, T, 3);
      ctx.fillStyle = theme.rockDark;
      ctx.fillRect(x, y, T, 5);
      ctx.fillStyle = theme.rockLight;
      ctx.fillRect(x, y, T, 2);
      ctx.fillStyle = theme.accent;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(x + 2, y, T - 4, 1);
      ctx.globalAlpha = 1;
      ctx.fillStyle = theme.rockDark;
      ctx.fillRect(x + 2, y + 5, 2, 3);
      ctx.fillRect(x + T - 4, y + 5, 2, 3);
    }

    drawSpring(ctx, theme, meteor, tx, ty, x, y) {
      ctx.fillStyle = theme.rockDark;
      ctx.fillRect(x + 1, y + 12, 14, 4);
      ctx.fillStyle = meteor ? theme.accent2 : theme.rockLight;
      ctx.fillRect(x + 2, y + 10, 12, 2);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i % 2 ? theme.rockLight : theme.rockDark;
        ctx.fillRect(x + 4 + i, y + 8 - i * 2, 8 - i * 2, 2);
      }
      ctx.fillStyle = meteor ? theme.accent : theme.cap;
      ctx.fillRect(x + 2, y + 1, 12, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 4, y + 2, 2, 1);
      ctx.fillStyle = meteor ? theme.accent : theme.accent;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x + 5, y + 1, 6, 1);
      ctx.globalAlpha = 1;
      if (meteor) {
        ctx.fillStyle = theme.accent2;
        ctx.fillRect(x + 7, y - 5 + Math.round(Math.sin(this.time * 4 + tx) * 1), 2, 4);
      }
    }

    drawSpike(ctx, theme, ch, x, y) {
      ctx.fillStyle = theme.rockDark;
      ctx.fillRect(x + 1, y + 10, 14, 4);
      ctx.fillStyle = theme.rockLight;
      ctx.fillRect(x + 2, y + 10, 12, 1);
      for (let i = 0; i < 3; i++) {
        const sx = x + 2 + i * 5;
        ctx.fillStyle = '#c8d3e8';
        if (ch === '^') {
          ctx.fillRect(sx + 1, y + 4, 2, 7);
          ctx.fillRect(sx, y + 8, 4, 3);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(sx + 1, y + 5, 1, 2);
        } else if (ch === 'v') {
          ctx.fillRect(sx + 1, y + 5, 2, 7);
          ctx.fillRect(sx, y + 5, 4, 3);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(sx + 1, y + 9, 1, 2);
        } else if (ch === '<') {
          ctx.fillRect(x + 3, y + 2 + i * 4, 7, 2);
          ctx.fillRect(x + 7, y + 1 + i * 4, 3, 4);
        } else {
          ctx.fillRect(x + 6, y + 2 + i * 4, 7, 2);
          ctx.fillRect(x + 6, y + 1 + i * 4, 3, 4);
        }
      }
    }

    drawWater(ctx, world, theme, tx, ty, x, y) {
      if (world.isFrozen(tx, ty)) { this.drawIce(ctx, world, tx, ty, x, y); return; }
      const top = world.tileAt(tx, ty - 1) !== '~';
      const t = this.time;
      ctx.fillStyle = theme.waterDeep;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = theme.water;
      ctx.fillRect(x, y + (top ? 3 : 0), T, T - (top ? 3 : 0));
      // 波纹
      ctx.fillStyle = theme.waterLight;
      const wy = top ? 2 : 7;
      for (let i = 0; i < T; i += 4) {
        const yy = y + wy + Math.round(Math.sin(t * 1.8 + (tx * T + i) * 0.12) * 1.2);
        ctx.fillRect(x + i, yy, 3, 1);
      }
      if (!top) {
        ctx.globalAlpha = 0.25;
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = theme.waterLight;
          ctx.fillRect(x + 2 + i * 5, y + 5 + ((Math.floor(t * 8 + i + tx) % 9)), 1, 2);
        }
        ctx.globalAlpha = 1;
      }
      if (world.isSteam(tx, ty)) {
        ctx.globalAlpha = 0.5 + Math.sin(t * 4 + tx) * 0.2;
        ctx.fillStyle = 'rgba(240,252,255,.8)';
        ctx.fillRect(x + 2, y + 2, 12, 3);
        ctx.fillRect(x + 5, y + 7, 6, 5);
        ctx.globalAlpha = 1;
      }
    }

    drawLava(ctx, world, theme, tx, ty, x, y) {
      if (world.isFrozen(tx, ty)) { this.drawObsidian(ctx, world, tx, ty, x, y); return; }
      const t = this.time;
      ctx.fillStyle = '#2a1018';
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = theme.lava;
      ctx.fillRect(x, y + 2, T, T - 2);
      ctx.fillStyle = theme.lavaLight;
      const top = world.tileAt(tx, ty - 1) !== '!';
      if (top) {
        for (let i = 0; i < T; i += 3) {
          const yy = y + Math.round(Math.sin(t * 2 + (tx * 2 + i) * 0.2) * 1.5);
          ctx.fillRect(x + i, yy, 2, 1);
        }
      }
      for (let i = 0; i < 3; i++) {
        const ph = Math.floor(t * 2.5 + i * 4 + tx);
        const px = x + 3 + (ph * 3) % 10;
        const py = y + 4 + (ph * 5) % 10;
        ctx.fillStyle = i % 2 ? theme.lavaLight : '#ffe6a0';
        ctx.fillRect(px, py, 2, 2);
      }
    }

    drawIce(ctx, world, tx, ty, x, y) {
      const f = world.frozen.get(world.key(tx, ty));
      const remain = f ? f.until - world.time : 9;
      if (remain < 1.6 && Math.floor(remain * 8) % 2 === 0) ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#2f8ba6';
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = '#9feaf7';
      ctx.fillRect(x, y, T, 2);
      ctx.fillStyle = '#d8fbff';
      ctx.fillRect(x + 1, y, T - 2, 1);
      ctx.fillStyle = '#6bd6e6';
      ctx.fillRect(x + 1, y + 2, T - 2, T - 3);
      // 棱面
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.fillRect(x + 3, y + 4, 1, 6);
      ctx.fillRect(x + 5, y + 6, 4, 1);
      ctx.fillRect(x + 10, y + 3, 1, 3);
      ctx.fillStyle = 'rgba(30,90,110,.4)';
      ctx.fillRect(x + 12, y + 8, 2, 5);
      ctx.globalAlpha = 1;
    }

    drawObsidian(ctx, world, tx, ty, x, y) {
      const f = world.frozen.get(world.key(tx, ty));
      const remain = f ? f.until - world.time : 6;
      if (remain < 1.4 && Math.floor(remain * 8) % 2 === 0) ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#16101f';
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = '#2c1d3a';
      ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
      ctx.fillStyle = '#4a3057';
      ctx.fillRect(x + 2, y + 2, T - 4, 2);
      ctx.fillStyle = '#ff9f45';
      ctx.globalAlpha *= 0.65;
      ctx.fillRect(x + 4, y + 6, 1, 5);
      ctx.fillRect(x + 5, y + 10, 3, 1);
      ctx.fillRect(x + 10, y + 3, 1, 4);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#0e0914';
      ctx.fillRect(x + 8, y + 6, 1, 5);
      ctx.fillRect(x + 9, y + 10, 2, 1);
    }

    drawRail(ctx, theme, x, y) {
      ctx.fillStyle = theme.rockDark;
      ctx.fillRect(x, y + 8, 1, 4);
      ctx.fillRect(x + 15, y + 8, 1, 4);
      ctx.fillStyle = '#8a7a63';
      ctx.fillRect(x, y + 9, T, 1);
      ctx.fillRect(x, y + 12, T, 1);
      ctx.fillStyle = '#5b4c3d';
      ctx.fillRect(x + 2, y + 9, 2, 3);
      ctx.fillRect(x + 10, y + 9, 2, 3);
    }

    // ------------------------------------------------------------- entities / atmosphere
    drawEntities(ctx, world, game) {
      // 电路导线（画在实体与地形之间）
      this.drawWires(ctx, world);
      const sorted = world.entities.slice().sort((a, b) => (a.layer || 2) - (b.layer || 2) || a.y - b.y);
      // 世界外的实体跳过
      const cam = game.camera;
      for (const e of sorted) {
        if (e.dead) continue;
        if (e.x > cam.x + C.W + 80 || e.x + (e.w || 16) < cam.x - 80) continue;
        if (e.y > cam.y + C.H + 100 || e.y + (e.h || 16) < cam.y - 100) continue;
        if (e.layer <= 3) e.draw(ctx, world);
      }
      // 高层实体稍后绘制
      for (const e of sorted) {
        if (e.dead) continue;
        if (e.layer > 3) e.draw(ctx, world);
      }
    }

    drawWires(ctx, world) {
      for (const [id, coil] of world.coils) {
        const gates = world.gates.get(id) || [];
        const powered = world.circuitPowered(id);
        for (const gate of gates) {
          const x1 = coil.centerX(), y1 = coil.centerY();
          const x2 = gate.centerX ? gate.centerX() : gate.x + gate.w / 2;
          const y2 = gate.centerY ? gate.centerY() : gate.y + gate.h / 2;
          ctx.save();
          ctx.strokeStyle = powered ? 'rgba(126,240,224,.55)' : 'rgba(128,92,66,.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          const midX = (x1 + x2) / 2;
          ctx.quadraticCurveTo(midX, y1 - 10, x2, y2);
          ctx.stroke();
          if (powered) {
            const t = (this.time * 2) % 1;
            const px = U.lerp(x1, x2, t);
            const py = U.lerp(y1, y2, t) - Math.sin(t * Math.PI) * 10;
            ctx.fillStyle = '#d8fbff';
            ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
          }
          ctx.restore();
        }
      }
    }

    drawForegroundFrame(ctx, theme, cam) {
      const t = this.time;
      const sway = Math.sin(t * 0.7 + cam.x * 0.012) * 3;
      ctx.save();
      ctx.globalAlpha = 0.82;
      // 顶部两角
      if (theme.id === 'ember') {
        // 垂落的藤蔓与叶片
        for (const side of [0, 1]) {
          const bx = side ? C.W - 14 : 14;
          const dir = side ? -1 : 1;
          ctx.fillStyle = theme.foreground;
          ctx.fillRect(bx - 2, 0, 4, 18 + Math.round(sway * dir));
          for (let i = 0; i < 5; i++) {
            const lx = bx + dir * (5 + i * 9) + sway * (i % 2 ? 0.5 : -0.5);
            const ly = 8 + i * 9;
            ctx.fillStyle = theme.foreground;
            ctx.fillRect(Math.round(lx), ly, 13, 3);
            ctx.fillRect(Math.round(lx) + dir * 4, ly + 3, 9, 2);
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = theme.rim;
            ctx.fillRect(Math.round(lx), ly, 9, 1);
            ctx.globalAlpha = 0.82;
            ctx.fillStyle = theme.foreground;
          }
        }
        // 底角蕨叶
        for (const side of [0, 1]) {
          const bx = side ? C.W - 8 : 8;
          const dir = side ? -1 : 1;
          for (let i = 0; i < 4; i++) {
            const h = 18 + i * 7;
            ctx.fillStyle = theme.foreground;
            ctx.beginPath();
            ctx.moveTo(bx, C.H);
            ctx.lineTo(bx + dir * (8 + i * 6), C.H - h);
            ctx.lineTo(bx + dir * (14 + i * 6), C.H);
            ctx.fill();
          }
        }
      } else if (theme.id === 'frost') {
        // 冰锥
        for (let i = 0; i < 7; i++) {
          const x = i < 4 ? 8 + i * 22 : C.W - 8 - (i - 4) * 24;
          const h = 14 + (i % 3) * 13 + (i > 3 ? 10 : 0);
          ctx.fillStyle = theme.foreground;
          ctx.beginPath();
          ctx.moveTo(x - 5, 0);
          ctx.lineTo(x + 5, 0);
          ctx.lineTo(x + 1, h);
          ctx.lineTo(x - 2, h - 4);
          ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 0.28;
          ctx.fillStyle = theme.rim;
          ctx.fillRect(x - 2, 2, 1, Math.max(3, h - 5));
          ctx.globalAlpha = 0.82;
        }
        // 底角雪堆
        ctx.fillStyle = theme.foreground;
        ctx.beginPath();
        ctx.moveTo(0, C.H);
        ctx.lineTo(0, C.H - 18);
        ctx.quadraticCurveTo(50, C.H - 28, 110, C.H);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(C.W, C.H);
        ctx.lineTo(C.W, C.H - 16);
        ctx.quadraticCurveTo(C.W - 60, C.H - 26, C.W - 120, C.H);
        ctx.fill();
      } else if (theme.id === 'rift') {
        // 电缆与折角
        for (const side of [0, 1]) {
          const bx = side ? C.W - 6 : 6;
          const dir = side ? -1 : 1;
          ctx.strokeStyle = theme.foreground;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(bx, 0);
          ctx.quadraticCurveTo(bx + dir * 20, 45, bx + dir * 8, 95 + sway);
          ctx.stroke();
          ctx.fillStyle = theme.foreground;
          ctx.fillRect(bx + dir * 2 - (side ? 6 : 0), 28, 8, 18);
          ctx.fillRect(bx + dir * 14 - (side ? 12 : 0), 70, 14, 8);
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = theme.rim;
          ctx.fillRect(bx + dir * 1, 31, 2, 2);
          ctx.fillRect(bx + dir * 16, 73, 2, 2);
          ctx.globalAlpha = 0.82;
        }
        // 底角城市碎块
        ctx.fillStyle = theme.foreground;
        ctx.fillRect(0, C.H - 14, 66, 14);
        ctx.fillRect(16, C.H - 26, 24, 12);
        ctx.fillRect(C.W - 80, C.H - 18, 80, 18);
        ctx.fillRect(C.W - 52, C.H - 30, 18, 12);
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = theme.rim;
        ctx.fillRect(18, C.H - 24, 20, 1);
        ctx.fillRect(C.W - 78, C.H - 16, 30, 1);
      } else {
        // 云端晶体与光柱
        for (const side of [0, 1]) {
          const bx = side ? C.W - 6 : 6;
          const dir = side ? -1 : 1;
          ctx.fillStyle = theme.foreground;
          ctx.beginPath();
          ctx.moveTo(bx, C.H);
          ctx.lineTo(bx + dir * 18, C.H - 58);
          ctx.lineTo(bx + dir * 38, C.H - 22);
          ctx.lineTo(bx + dir * 56, C.H);
          ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = theme.rim;
          ctx.fillRect(bx + dir * 15, C.H - 56, 2, 10);
          ctx.globalAlpha = 0.82;
        }
        // 云
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = theme.foreground;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.ellipse(70 + i * 86 + sway, C.H - 10, 42, 7, 0, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 0.82;
      }
      // 所有主题：顶部极轻的暗角
      const g = ctx.createLinearGradient(0, 0, 0, 24);
      g.addColorStop(0, 'rgba(3,5,10,.35)');
      g.addColorStop(1, 'rgba(3,5,10,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, C.W, 24);
      ctx.restore();
    }

    drawAtmosphere(ctx, theme, game) {
      // 底部环境雾：让深层地面退远，突出可玩层
      ctx.save();
      const fg = ctx.createLinearGradient(0, C.H - 88, 0, C.H);
      fg.addColorStop(0, 'rgba(5,7,14,0)');
      fg.addColorStop(1, 'rgba(5,7,14,.6)');
      ctx.fillStyle = fg;
      ctx.fillRect(0, C.H - 88, C.W, 88);
      ctx.restore();
      // 极轻的暗角，增强低分辨率质感
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = '#05060d';
      const edge = 18;
      for (let i = 0; i < edge; i += 2) {
        ctx.globalAlpha = 0.006 * (edge - i);
        ctx.fillRect(i, 0, 1, C.H);
        ctx.fillRect(C.W - i - 1, 0, 1, C.H);
      }
      ctx.restore();
      // 子弹时间视觉
      if (game.player && game.player.slowActive) {
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#6ee7ff';
        ctx.fillRect(0, 0, C.W, C.H);
        ctx.globalAlpha = 0.16;
        ctx.strokeStyle = '#7ef0e0';
        ctx.lineWidth = 1;
        const cx = C.W / 2, cy = C.H / 2;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath(); ctx.arc(cx, cy, 40 + i * 30 + Math.sin(this.time * 2 + i) * 4, 0, TAU); ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  PB.Gfx = new Gfx();
  PB.THEMES = THEMES;
})();
