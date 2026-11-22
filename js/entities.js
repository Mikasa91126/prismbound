/* ============================================================
   entities.js — 世界中的一切：拾取物、敌人、机关、载具、弹体
   ============================================================ */
(function () {
  'use strict';
  const PB = window.PB;
  const { C, U, Events } = PB;
  const T = C.TILE;

  const PAL = {
    gold: '#f3c76a',
    goldDark: '#a77b32',
    pale: '#fff3c4',
    stone: '#656b86',
    stoneDark: '#343849',
    stoneLight: '#8b91ad',
    wood: '#7a5630',
    woodDark: '#4d341c',
    woodLight: '#b98a4f',
    cyan: '#7ef0e0',
    cyanDark: '#2a8f9e',
    violet: '#b48cff',
    ember: '#ff9f45',
    red: '#e85a63',
    ink: '#080a12',
    white: '#ffffff',
    green: '#6fe39b',
  };

  function groundPos(tx, ty, w, h) {
    return { x: tx * T + (T - w) / 2, y: ty * T - h };
  }
  function centerPos(tx, ty, w, h) {
    return { x: tx * T + (T - w) / 2, y: ty * T + (T - h) / 2 };
  }
  function rectOf(e) { return { x: e.x, y: e.y, w: e.w, h: e.h }; }
  function overlapPlayer(e, world, inset = 0) {
    const p = world.player;
    if (!p || !p.alive) return false;
    return U.rectsOverlap(e.x + inset, e.y + inset, e.w - inset * 2, e.h - inset * 2,
      p.x, p.y, p.w, p.h);
  }
  function distToPlayer(e, world) {
    const p = world.player;
    if (!p) return 9999;
    return U.dist(e.x + e.w / 2, e.y + e.h / 2, p.x + p.w / 2, p.y + p.h / 2);
  }

  // ------------------------------------------------------------------ base
  class Ent {
    constructor(world, x, y, w, h, type) {
      this.world = world;
      this.game = world.game;
      this.x = x; this.y = y; this.w = w; this.h = h;
      this.type = type;
      this.dead = false;
      this.solid = false;
      this.oneWay = false;
      this.layer = 2;
      this.t = Math.random() * 10;
    }
    rect() { return rectOf(this); }
    centerX() { return this.x + this.w / 2; }
    centerY() { return this.y + this.h / 2; }
    update(dt) { this.t += dt; }
    draw() {}
    nearPlayer(r = 60) { return distToPlayer(this, this.world) < r; }
  }

  // ------------------------------------------------------------------ pickups
  class Shard extends Ent {
    constructor(world, tx, ty, opts = {}) {
      const p = centerPos(tx, ty, 6, 9);
      super(world, p.x, p.y, 6, 9, 'shard');
      this.baseY = this.y;
      this.phase = U.hash2(tx, ty, 3) * TAU;
      this.tx = tx; this.ty = ty;
      this.collected = false;
      this.fromBreak = opts.fromBreak;
      if (opts.fromBreak) { this.gravity = true; this.vx = 0; this.vy = 0; }
    }
    update(dt, world) {
      this.t += dt;
      if (this.gravity) {
        this.vy += 0.3;
        world.moveY(this, this.vy);
        world.moveX(this, this.vx);
        this.vx *= 0.98;
        if (this.onGround) this.gravity = false;
      }
      if (!this.fromBreak) this.y = this.baseY + Math.sin(this.t * 2.6 + this.phase) * 2;
      if (overlapPlayer(this, world, -4)) {
        this.dead = true;
        if (!this.fromBreak) {
          const key = `${this.world.chapterIndex}:${this.tx},${this.ty}`;
          this.world.collected.add(key);
          if (world.game && world.game.markShardCollected) world.game.markShardCollected(key);
        }
        if (world.game) world.game.collectShard(1, this.x + 3, this.y);
        if (PB.Gfx) PB.Gfx.particles.sparkle(this.x + 3, this.y + 4, PAL.gold);
      }
    }
    draw(ctx) {
      const x = Math.round(this.x), y = Math.round(this.y);
      const bob = Math.sin(this.t * 2.6 + this.phase) * 1.5;
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(x - 1, y + 2, 8, 7);
      ctx.globalAlpha = 1;
      ctx.fillStyle = PAL.goldDark;
      ctx.fillRect(x + 2, y + 1, 2, 7);
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(x + 1, y + 2, 4, 5);
      ctx.fillStyle = PAL.pale;
      ctx.fillRect(x + 2, y + 2, 1, 2);
      ctx.fillStyle = '#fff8d8';
      ctx.fillRect(x + 2, y + 3, 1, 1);
      ctx.restore();
    }
  }

  class GrandShard extends Ent {
    constructor(world, tx, ty, id) {
      const p = centerPos(tx, ty, 14, 16);
      super(world, p.x, p.y, 14, 16, 'grand');
      this.id = id;
      this.baseY = this.y;
      this.phase = U.hash2(tx, ty, 8) * TAU;
      this.collecting = 0;
    }
    update(dt, world) {
      this.t += dt;
      this.y = this.baseY + Math.sin(this.t * 1.6 + this.phase) * 3;
      if (overlapPlayer(this, world, -6) && !this.collecting) {
        this.collecting = 1;
        this.dead = true;
        if (world.game) world.game.collectGrand(this.id, this.centerX(), this.centerY());
      }
    }
    draw(ctx) {
      const cx = Math.round(this.centerX()), cy = Math.round(this.centerY());
      ctx.save();
      const glow = 0.2 + U.animate(this.t, 0.6) * 0.15;
      ctx.globalAlpha = glow;
      ctx.fillStyle = PAL.cyan;
      ctx.beginPath(); ctx.arc(cx, cy, 18 + Math.sin(this.t * 3) * 2, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      // 菱形大棱晶
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? PAL.cyanDark : PAL.cyan;
        const yy = cy - 11 + i * 6;
        const ww = 7 - Math.abs(i - 1.5) * 2;
        ctx.fillRect(cx - ww, yy, ww * 2, 6);
      }
      ctx.fillStyle = '#eaffff';
      ctx.fillRect(cx - 2, cy - 8, 2, 6);
      ctx.fillRect(cx, cy - 2, 2, 5);
      ctx.fillStyle = PAL.white;
      ctx.fillRect(cx - 1, cy - 7, 1, 2);
      // 环绕碎晶
      const a = this.t * 1.8;
      for (let i = 0; i < 4; i++) {
        const ang = a + i * Math.PI / 2;
        const px = cx + Math.cos(ang) * 16;
        const py = cy + Math.sin(ang) * 11;
        ctx.fillStyle = PAL.pale;
        ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
      }
      ctx.restore();
    }
  }

  class Sign extends Ent {
    constructor(world, tx, ty, textId) {
      const p = groundPos(tx, ty, 14, 16);
      super(world, p.x, p.y, 14, 16, 'sign');
      this.textId = textId;
      this.near = false;
      this.layer = 1;
    }
    update(dt, world) {
      this.t += dt;
      const near = this.nearPlayer(46);
      if (near && !this.near) {
        this.near = true;
        if (world.game) world.game.showSign(this.textId, this);
      } else if (!near && this.near) {
        this.near = false;
        if (world.game) world.game.hideSign(this);
      }
    }
    draw(ctx) {
      const x = Math.round(this.x), y = Math.round(this.y);
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(x + 3, y + 3, 8, 14);
      ctx.fillStyle = PAL.woodDark;
      ctx.fillRect(x + 4, y + 2, 7, 13);
      ctx.fillStyle = PAL.wood;
      ctx.fillRect(x + 2, y + 1, 10, 8);
      ctx.fillStyle = PAL.woodLight;
      ctx.fillRect(x + 3, y + 2, 8, 1);
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(x + 4, y + 4, 2, 1);
      ctx.fillRect(x + 7, y + 4, 2, 1);
      ctx.fillRect(x + 5, y + 6, 4, 1);
      ctx.fillStyle = this.near ? PAL.gold : PAL.goldDark;
      ctx.fillRect(x + 6, y - 3, 2, 3);
      if (this.near) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = PAL.gold;
        ctx.fillRect(x + 5, y - 5, 4, 1);
        ctx.globalAlpha = 1;
      }
    }
  }

  class Checkpoint extends Ent {
    constructor(world, tx, ty) {
      const p = groundPos(tx, ty, 14, 24);
      super(world, p.x, p.y, 14, 24, 'checkpoint');
      this.active = false;
      this.tx = tx; this.ty = ty;
      this.layer = 1;
    }
    update(dt, world) {
      this.t += dt;
      if (!this.active && overlapPlayer(this, world, -3)) {
        this.active = true;
        if (world.game) world.game.setCheckpoint({
          chapter: world.chapterIndex,
          x: this.tx * T + 3,
          y: this.ty * T - C.P_H,
          id: `${world.chapterIndex}:${this.tx},${this.ty}`,
        }, this);
        PB.Audio.sfx('checkpoint');
        Events.emit('checkpoint', { x: this.centerX(), y: this.centerY() });
        if (PB.Gfx) PB.Gfx.particles.sparkleRing(this.centerX(), this.centerY() - 10, PAL.cyan);
      }
    }
    draw(ctx) {
      const x = Math.round(this.x), y = Math.round(this.y);
      const lit = this.active;
      const glow = lit ? 0.22 + U.animate(this.t, 0.8) * 0.12 : 0.06;
      ctx.save();
      ctx.globalAlpha = glow;
      ctx.fillStyle = lit ? PAL.cyan : PAL.gold;
      ctx.beginPath(); ctx.arc(x + 7, y + 4, 15, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      // 底座
      ctx.fillStyle = PAL.stoneDark;
      ctx.fillRect(x, y + 18, 14, 6);
      ctx.fillStyle = PAL.stone;
      ctx.fillRect(x + 2, y + 16, 10, 4);
      ctx.fillStyle = PAL.stoneLight;
      ctx.fillRect(x + 3, y + 16, 8, 1);
      // 柱身
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(x + 4, y + 4, 6, 14);
      ctx.fillStyle = PAL.stoneDark;
      ctx.fillRect(x + 5, y + 5, 4, 12);
      ctx.fillStyle = PAL.stone;
      ctx.fillRect(x + 6, y + 6, 2, 10);
      // 顶端棱镜
      ctx.fillStyle = lit ? PAL.cyanDark : PAL.goldDark;
      ctx.fillRect(x + 3, y + 2, 8, 5);
      ctx.fillStyle = lit ? PAL.cyan : PAL.gold;
      ctx.fillRect(x + 5, y, 4, 7);
      ctx.fillStyle = PAL.white;
      ctx.fillRect(x + 6, y + 1, 1, 3);
      if (lit) {
        const a = this.t * 2.2;
        ctx.fillStyle = PAL.pale;
        ctx.fillRect(x + 7 + Math.cos(a) * 7 | 0, y + 4 + Math.sin(a) * 5 | 0, 1, 1);
      }
      ctx.restore();
    }
  }

  class Signpost extends Sign {}

  class Shrine extends Ent {
    constructor(world, tx, ty, formId) {
      const isArt = formId === 'echo' || formId === 'chrono';
      const p = groundPos(tx, ty, 28, 36);
      super(world, p.x, p.y, 28, 36, 'shrine');
      this.formId = formId;
      this.isArt = isArt;
      this.activated = false;
      this.layer = 1;
      this.tx = tx; this.ty = ty;
    }
    update(dt, world) {
      this.t += dt;
      if (!this.activated && overlapPlayer(this, world, -4)) {
        this.activated = true;
        if (world.game) world.game.openShrine(this.formId, this);
      }
    }
    draw(ctx) {
      const x = Math.round(this.x), y = Math.round(this.y);
      const form = PB.FORM_BY_ID[this.formId];
      const color = this.formId === 'echo' ? PAL.gold : this.formId === 'chrono' ? PAL.cyan : (form ? form.color : PAL.gold);
      const glow = this.activated ? 0.24 : 0.15 + U.animate(this.t, 0.5) * 0.06;
      ctx.save();
      // 光晕
      ctx.globalAlpha = glow;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x + 14, y + 4, 34, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      // 底座
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(x + 1, y + 28, 26, 8);
      ctx.fillStyle = PAL.stoneDark;
      ctx.fillRect(x + 2, y + 28, 24, 6);
      ctx.fillStyle = PAL.stone;
      ctx.fillRect(x + 4, y + 30, 20, 3);
      ctx.fillStyle = PAL.stoneLight;
      ctx.fillRect(x + 5, y + 30, 18, 1);
      // 外框
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(x + 5, y + 8, 18, 22);
      ctx.fillStyle = PAL.stoneDark;
      ctx.fillRect(x + 6, y + 9, 16, 20);
      ctx.fillStyle = PAL.stone;
      ctx.fillRect(x + 7, y + 10, 3, 18);
      ctx.fillRect(x + 18, y + 10, 3, 18);
      // 内芯
      const core = 5 + Math.sin(this.t * 2) * 1;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(x + 10, y + 6, 8, 5);
      ctx.fillRect(x + 11, y + 3, 6, 3);
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.fillRect(x + 11, y + 12, 6, 10);
      ctx.fillStyle = PAL.white;
      ctx.fillRect(x + 13, y + 13, 2, 4);
      // 符文
      ctx.fillStyle = this.activated ? PAL.pale : color;
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(x + 12 + (i === 1 ? 3 : 0), y + 22 + i * 2, i === 1 ? 2 : 5, 1);
      }
      // 悬浮碎晶
      const a = this.t * 1.2;
      for (let i = 0; i < 3; i++) {
        const ang = a + i * TAU / 3;
        const px = x + 14 + Math.cos(ang) * 15;
        const py = y + 8 + Math.sin(ang) * 7;
        ctx.fillStyle = PAL.pale;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
      }
      ctx.restore();
    }
  }

  class Portal extends Ent {
    constructor(world, tx, ty, goalId) {
      const p = groundPos(tx, ty, 28, 36);
      super(world, p.x, p.y, 28, 36, 'portal');
      this.goalId = goalId;
      this.layer = 1;
      this.cooldown = 0;
    }
    update(dt, world) {
      this.t += dt;
      this.cooldown = Math.max(0, this.cooldown - dt);
      if (this.cooldown <= 0 && overlapPlayer(this, world, -8)) {
        this.cooldown = 2;
        if (world.game) world.game.portalReached(this.goalId, this);
      }
    }
    draw(ctx) {
      const x = Math.round(this.x), y = Math.round(this.y);
      const pulse = U.animate(this.t, 0.8);
      ctx.save();
      ctx.globalAlpha = 0.18 + pulse * 0.15;
      ctx.fillStyle = PAL.gold;
      ctx.beginPath(); ctx.arc(x + 14, y + 18, 26, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      // 拱门
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(x, y + 4, 28, 32);
      ctx.fillStyle = PAL.stoneDark;
      ctx.fillRect(x + 2, y + 5, 24, 29);
      ctx.fillStyle = PAL.stone;
      ctx.fillRect(x + 4, y + 7, 20, 25);
      ctx.fillStyle = '#10152a';
      ctx.fillRect(x + 7, y + 10, 14, 22);
      // 能量漩涡
      for (let i = 0; i < 5; i++) {
        const a = this.t * 2 + i * 1.1;
        const px = x + 14 + Math.cos(a) * (3 + i);
        const py = y + 19 + Math.sin(a) * (5 + i);
        ctx.globalAlpha = 0.35 + i * 0.1;
        ctx.fillStyle = i % 2 ? PAL.gold : PAL.pale;
        ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(x + 3, y + 3, 4, 2);
      ctx.fillRect(x + 21, y + 3, 4, 2);
      ctx.fillRect(x + 5, y + 34, 4, 2);
      ctx.fillRect(x + 19, y + 34, 4, 2);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ pressure plates & doors
  class Plate extends Ent {
    constructor(world, tx, ty, id) {
      const p = groundPos(tx, ty, 16, 5);
      super(world, p.x, p.y, 16, 5, 'plate');
      this.plateId = id;
      this.pressed = false;
      this.layer = 1;
      this.was = false;
    }
    update(dt, world) {
      this.t += dt;
      let pressed = false;
      const p = world.player;
      if (p && U.rectsOverlap(this.x - 3, this.y - 10, this.w + 6, 15, p.x, p.y, p.w, p.h)) pressed = true;
      if (world.echo && !world.echo.dead &&
        U.rectsOverlap(this.x - 3, this.y - 10, this.w + 6, 15, world.echo.x, world.echo.y, world.echo.w, world.echo.h)) pressed = true;
      for (const e of world.entities) {
        if (e === this || e.dead) continue;
        if (!(e.type === 'barrel' || e.type === 'crate' || (e.frozen > 0))) continue;
        if (U.rectsOverlap(this.x - 3, this.y - 10, this.w + 6, 15, e.x, e.y, e.w, e.h)) pressed = true;
      }
      this.pressed = pressed;
      if (pressed !== this.was) {
        this.was = pressed;
        Events.emit('plate', { id: this.plateId, pressed });
        PB.Audio.sfx('menuMove', { vol: 0.7 });
      }
    }
    draw(ctx) {
      const x = Math.round(this.x), y = Math.round(this.y) + (this.pressed ? 2 : 0);
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(x, y, 16, 5);
      ctx.fillStyle = this.pressed ? PAL.cyanDark : PAL.stoneDark;
      ctx.fillRect(x + 1, y + 1, 14, 3);
      ctx.fillStyle = this.pressed ? PAL.cyan : PAL.stoneLight;
      ctx.fillRect(x + 3, y + 1, 10, 1);
    }
  }

  function platePressed(world, id) {
    for (const e of world.entities) {
      if (e.type === 'plate' && e.plateId === id && e.pressed) return true;
    }
    return false;
  }

  class Door extends Ent {
    constructor(world, tx, ty, id, hTiles = 3) {
      const h = hTiles * T;
      super(world, tx * T + 2, ty * T - h, 12, h, 'door');
      this.doorId = id;
      this.open = 0;
      this.closed = true;
      this.layer = 1;
    }
    update(dt, world) {
      this.t += dt;
      const wantOpen = platePressed(world, this.doorId);
      this.open = U.approach(this.open, wantOpen ? 1 : 0, dt * 4.5);
      this.solid = this.open < 0.82;
      this.closed = this.solid;
    }
    draw(ctx) {
      const x = Math.round(this.x), y = Math.round(this.y);
      const rise = this.open * (this.h + 4);
      ctx.save();
      ctx.translate(0, -rise);
      // 门框
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(x - 2, y - 2, 16, this.h + 4);
      ctx.fillStyle = PAL.stoneDark;
      ctx.fillRect(x, y, 12, this.h);
      ctx.fillStyle = PAL.stone;
      ctx.fillRect(x + 1, y + 2, 10, this.h - 4);
      ctx.fillStyle = PAL.stoneLight;
      ctx.fillRect(x + 2, y + 3, 8, 1);
      // 竖纹与符文
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = PAL.stoneDark;
        ctx.fillRect(x + 3 + i * 3, y + 6, 1, this.h - 12);
      }
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(x + 5, y + 8, 2, 2);
      ctx.fillRect(x + 5, y + 14, 2, 2);
      ctx.fillStyle = PAL.goldDark;
      ctx.fillRect(x + 6, y + Math.floor(this.h / 2) - 4, 1, 8);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ coils / laser gates
  class Coil extends Ent {
    constructor(world, tx, ty, id) {
      const p = centerPos(tx, ty, 12, 14);
      super(world, p.x, p.y, 12, 14, 'coil');
      this.circuitId = id;
      this.poweredUntil = 0;
      this.layer = 1;
    }
    isPowered(world) { return this.poweredUntil > world.time; }
    draw(ctx, world) {
      const x = Math.round(this.x), y = Math.round(this.y);
      const powered = this.isPowered(this.world);
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(x + 1, y + 10, 10, 4);
      ctx.fillStyle = PAL.stoneDark;
      ctx.fillRect(x + 2, y + 9, 8, 3);
      ctx.fillStyle = powered ? PAL.cyan : '#b87a44';
      for (let i = 0; i < 4; i++) ctx.fillRect(x + 2, y + 6 - i * 2, 8, 1);
      ctx.fillStyle = powered ? PAL.pale : '#6b4224';
      ctx.fillRect(x + 4, y + 1, 4, 5);
      if (powered) {
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = PAL.cyan;
        ctx.fillRect(x + 5 + Math.round(Math.sin(this.t * 10)), y - 2, 2, 2);
        ctx.globalAlpha = 1;
      }
    }
  }

  class Gate extends Ent {
    constructor(world, tx, ty, id, hTiles = 3, orient = 'v') {
      const h = hTiles * T;
      const w = orient === 'v' ? 6 : h;
      const hh = orient === 'v' ? h : 6;
      super(world, tx * T + 5, ty * T - h, w, hh, 'gate');
      this.circuitId = id;
      this.orient = orient;
      this.hTiles = hTiles;
      this.layer = 4;
      this.solid = false;
    }
    update(dt, world) {
      const powered = world.circuitPowered(this.circuitId);
      this.solid = !powered;
      this.powered = powered;
    }
    draw(ctx) {
      const powered = this.powered;
      const frac = powered ? 0.12 : 0.9;
      ctx.save();
      ctx.globalAlpha = frac;
      ctx.fillStyle = powered ? PAL.cyanDark : PAL.red;
      if (this.orient === 'v') {
        ctx.fillRect(Math.round(this.x), Math.round(this.y), 6, this.h);
        ctx.fillStyle = PAL.white;
        ctx.globalAlpha = frac * 0.5;
        ctx.fillRect(Math.round(this.x + 2), Math.round(this.y), 2, this.h);
      } else {
        ctx.fillRect(Math.round(this.x), Math.round(this.y), this.w, 6);
      }
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ moving platform
  class MovingPlatform extends Ent {
    constructor(world, tx, ty, args) {
      const wTiles = args[0] == null ? 4 : args[0];
      const ampX = args[1] == null ? 3 : args[1];
      const ampY = args[2] == null ? 0 : args[2];
      const period = args[3] == null ? 4 : args[3];
      const phase = args[4] == null ? 0 : args[4];
      super(world, tx * T, ty * T, wTiles * T, 8, 'movingPlatform');
      this.baseX = this.x;
      this.baseY = this.y;
      this.ampX = ampX * T;
      this.ampY = ampY * T;
      this.period = Math.max(1, period);
      this.phase = phase;
      this.solid = true;
      this.oneWay = true;
      this.prevX = this.x;
      this.prevY = this.y;
      this.layer = 1;
    }
    update(dt, world, game) {
      this.t += dt;
      this.prevX = this.x; this.prevY = this.y;
      const a = (this.t / this.period + this.phase) * Math.PI * 2;
      this.x = this.baseX + Math.sin(a) * this.ampX;
      this.y = this.baseY + Math.sin(a * 2) * this.ampY;
      this.dx = this.x - this.prevX;
      this.dy = this.y - this.prevY;
      const p = world.player;
      if (p && p.groundEntity === this) {
        p.x += this.dx;
        p.y += this.dy;
      }
    }
    draw(ctx) {
      const x = Math.round(this.x), y = Math.round(this.y);
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(x, y, this.w, 8);
      ctx.fillStyle = PAL.stoneDark;
      ctx.fillRect(x + 1, y + 1, this.w - 2, 6);
      ctx.fillStyle = PAL.stone;
      ctx.fillRect(x + 2, y + 1, this.w - 4, 2);
      ctx.fillStyle = PAL.stoneLight;
      ctx.fillRect(x + 3, y + 2, this.w - 6, 1);
      ctx.fillStyle = PAL.goldDark;
      for (let i = 6; i < this.w - 6; i += 12) ctx.fillRect(x + i, y + 4, 4, 1);
      const glow = 0.15 + U.animate(this.t, 1.2) * 0.1;
      ctx.globalAlpha = glow;
      ctx.fillStyle = PAL.cyan;
      ctx.fillRect(x + 2, y + 7, this.w - 4, 1);
      ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------------ enemies
  class Enemy extends Ent {
    constructor(world, x, y, w, h, type) {
      super(world, x, y, w, h, type);
      this.hp = 1;
      this.vx = 0; this.vy = 0;
      this.grav = 1;
      this.onGround = false;
      this.dir = Math.random() < 0.5 ? -1 : 1;
      this.frozen = 0;
      this.harmful = true;
      this.stompable = true;
      this.freezable = true;
      this.gravitable = true;
      this.flash = 0;
      this.frozenVy = 0;
      this.kicked = false;
      this.kickTimer = 0;
      this.hitEnemies = new Set();
      this.animT = Math.random();
      this.layer = 3;
    }
    update(dt, world, game) {
      this.t += dt;
      this.animT += dt;
      this.flash = Math.max(0, this.flash - dt);
      if (this.frozen > 0) {
        this.frozen -= dt;
        if (this.kicked) {
          this.updateKicked(dt, world);
        } else {
          this.vx = 0; this.vy = 0;
          if (this.frozen <= 0) this.thaw();
        }
        return;
      }
      this.think(dt, world, game);
      // 重力/移动
      if (!this.flyer) {
        this.vy += 0.5 * this.grav;
        this.vy = U.clamp(this.vy, -10, 9);
      }
      world.moveX(this, this.vx);
      world.moveY(this, this.vy);
      if (this.hitWall) this.dir *= -1;
      const g = world.groundProbe(this);
      this.onGround = g.solid;
      if (this.onGround && !this.flyer) this.vy = 0;
      // 与玩家的伤害交由 Player.interactEntities 统一结算，
      // 这样踩踏/冲刺的判定不会被实体先一步覆盖。
    }
    think(dt, world) {}
    flipGravity() {
      this.grav = (this.grav || 1) * -1;
      this.vy = -this.vy * 0.45 - 1.8 * this.grav;
      this.onGround = false;
      if (PB.Gfx) PB.Gfx.particles.gravityRune(this.centerX(), this.centerY());
      Events.emit('enemy:gravityFlip', { x: this.centerX(), y: this.centerY(), type: this.type });
    }
    checkPlayerContact(world) {
      if (!this.harmful || this.dead) return;
      const p = world.player;
      if (!p || !p.alive) return;
      if (U.rectsOverlap(this.x + 2, this.y + 2, this.w - 4, this.h - 4, p.x, p.y, p.w, p.h)) {
        p.damage(1, p.x + p.w / 2 < this.x + this.w / 2 ? 1 : -1, 'enemy');
      }
    }
    hurt(dmg, dir, source) {
      if (this.dead) return;
      if (this.frozen > 0) {
        if (source === 'solar') this.thermalShatter();
        else if (source === 'slide' || source === 'dash' || source === 'pound') this.kick(dir);
        else if (source === 'ice') this.shatterIce();
        return;
      }
      this.hp -= dmg;
      this.flash = 0.18;
      this.vx = dir * 2.8;
      this.vy = -2.4;
      if (this.hp <= 0) this.die(source, dir);
      else PB.Audio.sfx('bossHit', { vol: 0.5 });
    }
    die(source, dir) {
      this.dead = true;
      PB.Audio.sfx('hurt', { vol: 0.5 });
      if (PB.Gfx) PB.Gfx.particles.emitBurst(this.centerX(), this.centerY(), 'spark', 10);
      Events.emit('enemy:kill', {
        type: this.type, x: this.centerX(), y: this.centerY(), source, dir,
        inverted: (this.grav || 1) < 0,
      });
      if (this.world.game) this.world.game.addHitstop(0.03);
    }
    freeze(sec) {
      if (!this.freezable || this.frozen > 0) return;
      this.frozen = sec;
      this.kicked = false;
      this.vx = 0; this.vy = 0;
      this.solid = true;
      this.oneWay = true;
      this.harmful = false;
      Events.emit('cryo:freezeEnemy', {
        x: this.centerX(), y: this.centerY(), type: this.type,
      });
      if (PB.Gfx) PB.Gfx.particles.iceShatter(this.centerX(), this.centerY());
    }
    thaw() {
      this.frozen = 0;
      this.solid = false;
      this.oneWay = false;
      this.harmful = true;
      this.kicked = false;
      if (PB.Gfx) PB.Gfx.particles.sparkle(this.centerX(), this.centerY(), PAL.cyan);
    }
    kick(dir) {
      if (this.frozen <= 0 || this.kicked) return;
      this.kicked = true;
      this.kickTimer = 0.9;
      this.solid = false;
      this.oneWay = false;
      this.vx = dir * 7.4;
      this.vy = -2.4;
      this.grav = 1;
      this.hitEnemies = new Set();
      this.frozen = Math.max(this.frozen, 1.4);
      PB.Audio.sfx('dash');
      Events.emit('ice:kick', { x: this.centerX(), y: this.centerY(), dir });
    }
    updateKicked(dt, world) {
      this.kickTimer -= dt;
      this.vy += 0.5;
      world.moveX(this, this.vx);
      world.moveY(this, this.vy);
      if (this.vy > 0) this.vy = Math.min(this.vy, 8);
      if (this.hitWall || this.kickTimer <= 0) {
        this.shatterIce();
        return;
      }
      let hit = 0;
      for (const e of world.entities) {
        if (e === this || e.dead || !(e instanceof Enemy) || this.hitEnemies.has(e)) continue;
        if (U.rectsOverlap(this.x, this.y, this.w, this.h, e.x, e.y, e.w, e.h)) {
          this.hitEnemies.add(e);
          e.hurt(1, Math.sign(this.vx) || 1, 'ice');
          hit++;
        }
      }
      if (hit) {
        Events.emit('ice:bowling', { count: hit, x: this.centerX(), y: this.centerY() });
        PB.Audio.sfx('deflect', { vol: 0.6 });
      }
    }
    thermalShatter() {
      const x = this.centerX(), y = this.centerY();
      this.dead = true;
      PB.Audio.sfx('barrel', { vol: 0.5 });
      if (PB.Gfx) PB.Gfx.particles.explosion(x, y);
      for (const e of this.world.entities) {
        if (e === this || e.dead || !(e instanceof Enemy)) continue;
        if (U.dist(x, y, e.centerX(), e.centerY()) < 38) e.hurt(1, x < e.centerX() ? 1 : -1, 'solar');
      }
      Events.emit('ice:thermal', { x, y });
    }
    shatterIce() {
      this.dead = true;
      if (PB.Gfx) {
        for (let i = 0; i < 8; i++) PB.Gfx.particles.iceShatter(this.centerX() + U.rand(-6, 6), this.centerY() + U.rand(-6, 6));
      }
      PB.Audio.sfx('freeze', { vol: 0.5 });
      Events.emit('ice:shatter', { x: this.centerX(), y: this.centerY() });
    }
    drawFrozen(ctx) {
      const x = Math.round(this.x) - 2, y = Math.round(this.y) - 2;
      const w = this.w + 4, h = this.h + 4;
      ctx.save();
      ctx.globalAlpha = 0.78;
      ctx.fillStyle = '#5ecfe6';
      ctx.fillRect(x + 1, y, w - 2, h);
      ctx.fillRect(x, y + 1, w, h - 2);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#a9f8ff';
      ctx.fillRect(x + 2, y + 2, w - 4, 2);
      ctx.fillRect(x + 2, y + 2, 2, h - 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 3, y + 3, 1, 3);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#2a8f9e';
      ctx.fillRect(x + 4, y + h - 4, w - 8, 1);
      ctx.restore();
    }
  }

  class Slime extends Enemy {
    constructor(world, tx, ty) {
      const p = groundPos(tx, ty, 14, 10);
      super(world, p.x, p.y, 14, 10, 'slime');
      this.speed = 0.58;
      this.hopT = U.rand(1, 3);
    }
    think(dt, world) {
      this.hopT -= dt;
      if (!this.onGround) return;
      this.vx = this.dir * this.speed;
      const aheadX = this.dir > 0 ? this.x + this.w + 2 : this.x - 2;
      const wall = world.wallProbe(this, this.dir);
      const ground = world.groundProbe({ x: aheadX - (this.dir > 0 ? 0 : 2), y: this.y, w: 4, h: this.h, grav: 1 });
      if (wall.solid || !ground.solid) this.dir *= -1;
      if (this.hopT <= 0) {
        this.vy = -3.3;
        this.hopT = U.rand(2.2, 3.8);
      }
    }
    draw(ctx) {
      if (this.frozen > 0) { this.drawFrozen(ctx); return; }
      const frame = this.onGround ? 0 : 1;
      const spr = PB.Sprites.enemy('slime', Math.floor(this.animT * 4) % 2);
      const hop = this.onGround ? 0 : -1;
      PB.Sprites.draw(ctx, spr, this.x + (this.w - spr.width) / 2, this.y + (this.h - spr.height) + hop, this.dir < 0);
      if (this.flash > 0) {
        ctx.globalAlpha = this.flash * 3;
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.globalAlpha = 1;
      }
    }
  }

  class Bat extends Enemy {
    constructor(world, tx, ty) {
      const p = centerPos(tx, ty, 14, 9);
      super(world, p.x, p.y, 14, 9, 'bat');
      this.flyer = true;
      this.homeX = this.x; this.homeY = this.y;
      this.state = 'hang';
      this.hp = 1;
      this.harmful = true;
      this.swoopT = 0;
    }
    think(dt, world) {
      const p = world.player;
      if (!p) return;
      const d = distToPlayer(this, world);
      if (this.state === 'hang') {
        if (d < 130) { this.state = 'fly'; this.swoopT = 3.5; PB.Audio.sfx('menuBack', { vol: 0.3 }); }
        this.vx *= 0.8; this.vy = Math.sin(this.t * 3) * 0.2;
        return;
      }
      this.swoopT -= dt;
      const dx = p.x + p.w / 2 - this.centerX();
      const dy = p.y + p.h / 2 - this.centerY();
      const len = Math.max(1, Math.hypot(dx, dy));
      const speed = 1.25;
      this.vx = U.approach(this.vx, (dx / len) * speed, 0.06);
      this.vy = U.approach(this.vy, (dy / len) * speed + Math.sin(this.t * 5) * 0.3, 0.06);
      if (this.swoopT <= 0 && d > 90) {
        this.state = 'hang';
      }
      this.x = U.clamp(this.x, this.homeX - 130, this.homeX + 130);
    }
    draw(ctx) {
      if (this.frozen > 0) { this.drawFrozen(ctx); return; }
      const spr = PB.Sprites.enemy('bat', Math.floor(this.animT * 8) % 2);
      PB.Sprites.draw(ctx, spr, this.x + (this.w - spr.width) / 2, this.y, this.vx < 0);
      if (this.flash > 0) {
        ctx.globalAlpha = this.flash * 3; ctx.fillStyle = '#fff';
        ctx.fillRect(this.x, this.y, this.w, this.h); ctx.globalAlpha = 1;
      }
    }
  }

  class Wisp extends Enemy {
    constructor(world, tx, ty) {
      const p = centerPos(tx, ty, 12, 14);
      super(world, p.x, p.y, 12, 14, 'wisp');
      this.flyer = true;
      this.homeX = this.x; this.homeY = this.y;
      this.fireImmune = true;
      this.hp = 1;
      this.phase = U.rand(0, TAU);
    }
    think(dt, world) {
      const p = world.player;
      this.x = this.homeX + Math.sin(this.t * 0.8 + this.phase) * 18;
      this.y = this.homeY + Math.sin(this.t * 1.7 + this.phase) * 10;
      if (p && distToPlayer(this, world) < 90) {
        this.vx = U.approach(this.vx, (p.x - this.x) * 0.006, 0.02);
        this.vy = U.approach(this.vy, (p.y - this.y) * 0.006, 0.02);
        this.homeX += this.vx; this.homeY += this.vy;
        this.homeX = U.clamp(this.homeX, this.x - 40, this.x + 40);
      }
      if (PB.Gfx && Math.random() < 0.12) {
        PB.Gfx.particles.ember(this.centerX() + U.rand(-3, 3), this.centerY() + 4, -0.3);
      }
    }
    draw(ctx) {
      if (this.frozen > 0) { this.drawFrozen(ctx); return; }
      const cx = Math.round(this.centerX()), cy = Math.round(this.centerY());
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = PAL.ember;
      ctx.beginPath(); ctx.arc(cx, cy, 12, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      const flick = Math.sin(this.t * 9) * 2;
      ctx.fillStyle = '#e2562f';
      ctx.fillRect(cx - 3, cy - 5, 6, 10);
      ctx.fillRect(cx - 2, cy - 8 + flick, 4, 5);
      ctx.fillStyle = PAL.ember;
      ctx.fillRect(cx - 2, cy - 4, 4, 8);
      ctx.fillStyle = '#ffe6a8';
      ctx.fillRect(cx - 1, cy - 3, 2, 4);
      ctx.fillStyle = '#2b1620';
      ctx.fillRect(cx - 3, cy - 1, 1, 2);
      ctx.fillRect(cx + 2, cy - 1, 1, 2);
      if (this.flash > 0) {
        ctx.globalAlpha = this.flash * 3; ctx.fillStyle = '#fff';
        ctx.fillRect(this.x, this.y, this.w, this.h); ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }

  class Sentinel extends Enemy {
    constructor(world, tx, ty) {
      const p = groundPos(tx, ty, 16, 20);
      super(world, p.x, p.y, 16, 20, 'sentinel');
      this.hp = 2;
      this.shield = true;
      this.speed = 0.4;
      this.stompable = true;
      this.harmful = true;
    }
    think(dt, world) {
      this.vx = this.dir * this.speed;
      const wall = world.wallProbe(this, this.dir);
      if (wall.solid) this.dir *= -1;
      if (PB.Gfx && Math.random() < 0.02) PB.Gfx.particles.sparkle(this.centerX(), this.centerY() - 6, PAL.gold);
    }
    hurt(dmg, dir, source) {
      // 正面火球被盾弹开；从背后/冲刺有效
      if (this.shield && source === 'solar' && dir === -this.dir) {
        PB.Audio.sfx('deflect', { vol: 0.4 });
        if (PB.Gfx) PB.Gfx.particles.sparkle(this.x + (this.dir > 0 ? this.w : 0), this.centerY(), PAL.gold);
        return;
      }
      super.hurt(dmg, dir, source);
    }
    draw(ctx) {
      if (this.frozen > 0) { this.drawFrozen(ctx); return; }
      const spr = PB.Sprites.enemy('sentinel', 0);
      PB.Sprites.draw(ctx, spr, this.x + (this.w - spr.width) / 2, this.y, this.dir < 0);
      // 盾
      const sx = this.dir > 0 ? this.x + this.w - 1 : this.x - 3;
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(sx, this.y + 6, 4, 11);
      ctx.fillStyle = PAL.stoneLight;
      ctx.fillRect(sx + 1, this.y + 7, 2, 9);
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(sx + 1, this.y + 10, 2, 2);
      if (this.flash > 0) {
        ctx.globalAlpha = this.flash * 3; ctx.fillStyle = '#fff';
        ctx.fillRect(this.x, this.y, this.w, this.h); ctx.globalAlpha = 1;
      }
    }
  }

  // ------------------------------------------------------------------ lanterns
  class Lantern extends Ent {
    constructor(world, tx, ty) {
      const p = centerPos(tx, ty, 16, 18);
      super(world, p.x, p.y, 16, 18, 'lantern');
      this.baseX = this.x; this.baseY = this.y;
      this.tamed = false;
      this.phase = U.rand(0, TAU);
      this.solid = false;
      this.oneWay = false;
      this.layer = 1;
      this.bounceCd = 0;
    }
    tame() {
      if (this.tamed) return;
      this.tamed = true;
      this.solid = true;
      this.oneWay = true;
      PB.Audio.sfx('tame');
      if (PB.Gfx) PB.Gfx.particles.sparkleRing(this.centerX(), this.centerY(), PAL.cyan);
      Events.emit('lantern:tame', { x: this.centerX(), y: this.centerY() });
    }
    update(dt, world) {
      this.t += dt;
      this.x = this.baseX + Math.sin(this.t * 0.7 + this.phase) * 4;
      this.y = this.baseY + Math.sin(this.t * 1.4 + this.phase) * 4;
      this.bounceCd = Math.max(0, this.bounceCd - dt);
      const p = world.player;
      if (this.tamed && p && p.groundEntity === this && this.bounceCd <= 0 && Math.abs(p.vy) < 2.5) {
        this.bounceCd = 0.3;
        p.vy = -8.2 * (p.grav || 1);
        p.onGround = false;
        p.refreshAir();
        PB.Audio.sfx('spring');
        if (PB.Gfx) PB.Gfx.particles.sparkleRing(this.centerX(), this.y, PAL.cyan);
        Events.emit('lantern:bounce', { x: this.centerX(), y: this.y });
      }
    }
    draw(ctx) {
      const cx = Math.round(this.centerX()), cy = Math.round(this.centerY());
      const c = this.tamed ? PAL.cyan : PAL.ember;
      const cd = this.tamed ? PAL.cyanDark : '#8a4a2d';
      ctx.save();
      // 光晕
      ctx.globalAlpha = this.tamed ? 0.14 : 0.2;
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(cx, cy - 2, 16, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      // 吊绳/火焰
      if (!this.tamed) {
        const flick = Math.sin(this.t * 9 + this.phase) * 2;
        ctx.fillStyle = '#ffdb7a';
        ctx.fillRect(cx - 2, cy - 14 + flick, 4, 7);
        ctx.fillStyle = PAL.ember;
        ctx.fillRect(cx - 3, cy - 11 + flick * 0.5, 6, 6);
        ctx.fillStyle = '#fff2c4';
        ctx.fillRect(cx - 1, cy - 10 + flick * 0.5, 2, 3);
      }
      // 灯壳
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(cx - 7, cy - 7, 14, 15);
      ctx.fillStyle = PAL.woodDark;
      ctx.fillRect(cx - 6, cy - 6, 12, 13);
      ctx.fillStyle = PAL.wood;
      ctx.fillRect(cx - 5, cy - 5, 10, 11);
      ctx.fillStyle = c;
      ctx.fillRect(cx - 3, cy - 4, 6, 8);
      ctx.fillStyle = PAL.white;
      ctx.fillRect(cx - 1, cy - 3, 2, 4);
      // 顶盖
      ctx.fillStyle = PAL.woodDark;
      ctx.fillRect(cx - 8, cy - 8, 16, 3);
      ctx.fillRect(cx - 4, cy - 11, 8, 4);
      if (this.tamed) {
        ctx.fillStyle = PAL.pale;
        ctx.globalAlpha = 0.7;
        const a = this.t * 1.5;
        ctx.fillRect(cx + Math.cos(a) * 9, cy - 2 + Math.sin(a) * 6, 1, 1);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ barrels / crates / ice
  class Barrel extends Ent {
    constructor(world, tx, ty) {
      const p = groundPos(tx, ty, 12, 14);
      super(world, p.x, p.y, 12, 14, 'barrel');
      this.vx = 0; this.vy = 0; this.grav = 1;
      this.solid = true;
      this.gravitable = true;
      this.fuse = 0;
      this.exploded = false;
      this.onGround = false;
      this.onCeil = false;
      this.layer = 2;
    }
    ignite(delay = 0.22) {
      if (this.fuse > 0 || this.exploded) return;
      this.fuse = delay;
      PB.Audio.sfx('ignite', { vol: 0.6 });
      Events.emit('barrel:ignite', { x: this.centerX(), y: this.centerY() });
    }
    flipGravity() {
      this.grav *= -1;
      this.vy = -this.vy * 0.5 - 2 * this.grav;
      PB.Audio.sfx('flip', { vol: 0.4 });
      Events.emit('barrel:flip', { x: this.centerX(), y: this.centerY(), grav: this.grav });
      if (PB.Gfx) PB.Gfx.particles.gravityRune(this.centerX(), this.centerY());
    }
    update(dt, world) {
      this.t += dt;
      if (this.fuse > 0) {
        this.fuse -= dt;
        if (this.fuse <= 0) { world.detonate(this); return; }
      }
      this.vy += 0.55 * this.grav;
      this.vy = U.clamp(this.vy, -9, 9);
      this.onCeil = false;
      world.moveX(this, this.vx);
      world.moveY(this, this.vy);
      if (this.hitWall) this.vx = 0;
      if (this.hitCeil) this.onCeil = true;
      const g = world.groundProbe(this);
      this.onGround = g.solid;
      if (this.grav < 0 && this.onCeil && this.fuse <= 0 && this.grav) {
        this.ignite(0.18);
      }
      // 被滑铲/冲刺撞到
      const p = world.player;
      if (p && (p.state === 'slide' || p.state === 'dash') && overlapPlayer(this, world, 2)) {
        this.ignite(0.15);
        this.vx = Math.sign(p.vx || 1) * 1.6;
      }
    }
    draw(ctx) {
      const spr = PB.Sprites.enemy('barrel', 0);
      const wob = this.fuse > 0 ? Math.sin(this.t * 55) * 1 : 0;
      PB.Sprites.draw(ctx, spr, this.x + (this.w - spr.width) / 2 + wob, this.y + (this.h - spr.height), false);
      if (this.fuse > 0) {
        ctx.fillStyle = '#ffe19a';
        ctx.fillRect(Math.round(this.centerX()) + 2, Math.round(this.y) - 4, 2, 3);
        ctx.fillStyle = PAL.red;
        ctx.fillRect(Math.round(this.centerX()) + 2, Math.round(this.y) - 5, 1, 1);
      } else {
        ctx.fillStyle = PAL.red;
        ctx.fillRect(Math.round(this.centerX()) - 1, Math.round(this.y) + 4, 2, 2);
      }
      if (this.grav < 0) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = PAL.violet;
        ctx.fillRect(this.x, this.y - 2, this.w, 1);
        ctx.globalAlpha = 1;
      }
    }
  }

  class Crate extends Ent {
    constructor(world, tx, ty) {
      const p = groundPos(tx, ty, 14, 14);
      super(world, p.x, p.y, 14, 14, 'crate');
      this.vx = 0; this.vy = 0; this.grav = 1;
      this.solid = true;
      this.gravitable = true;
      this.layer = 2;
    }
    flipGravity() {
      this.grav *= -1;
      this.vy = -this.vy * 0.4 - 1.2 * this.grav;
      PB.Audio.sfx('flip', { vol: 0.35 });
    }
    knock(dir, vy) {
      this.vx = dir * 2.5;
      this.vy = vy;
    }
    update(dt, world) {
      this.t += dt;
      this.vy += 0.55 * this.grav;
      this.vy = U.clamp(this.vy, -10, 10);
      world.moveX(this, this.vx);
      world.moveY(this, this.vy);
      this.vx *= 0.92;
      if (this.onGround) this.vy = 0;
    }
    draw(ctx) {
      const spr = PB.Sprites.enemy('crate', 0);
      PB.Sprites.draw(ctx, spr, this.x + (this.w - spr.width) / 2, this.y + (this.h - spr.height), false);
      if (this.grav < 0) {
        ctx.globalAlpha = 0.4; ctx.fillStyle = PAL.violet;
        ctx.fillRect(this.x, this.y - 2, this.w, 1); ctx.globalAlpha = 1;
      }
    }
  }

  class IceBlock extends Ent {
    constructor(world, tx, ty, args = {}) {
      const p = groundPos(tx, ty, 14, 14);
      super(world, p.x, p.y, 14, 14, 'iceblock');
      this.solid = true;
      this.gravitable = false;
      this.kicked = false;
      this.vx = 0; this.vy = 0;
      this.life = args.life || 0;
      this.summoned = !!args.summoned;
      this.sparkleT = U.rand(0, 2);
      this.layer = 2;
    }
    update(dt, world) {
      this.t += dt;
      if (this.kicked) {
        this.vy += 0.4;
        world.moveX(this, this.vx);
        world.moveY(this, this.vy);
        if (this.hitWall) { this.shatter(); return; }
        for (const e of world.entities) {
          if (e === this || e.dead) continue;
          if (e instanceof Enemy && e.frozen <= 0 && U.rectsOverlap(this.x, this.y, this.w, this.h, e.x, e.y, e.w, e.h)) {
            e.hurt(1, Math.sign(this.vx) || 1, 'ice');
            Events.emit('ice:bowling', { count: 1, x: this.centerX(), y: this.centerY() });
          }
        }
        if (this.t % 0.12 < dt && PB.Gfx) PB.Gfx.particles.sparkle(this.centerX(), this.centerY(), PAL.cyan);
      }
      if (this.life > 0) {
        this.life -= dt;
        if (this.life <= 0) { this.shatter(true); return; }
      }
      this.sparkleT -= dt;
      if (this.sparkleT <= 0) {
        this.sparkleT = U.rand(0.8, 2.2);
        if (PB.Gfx) PB.Gfx.particles.sparkle(this.x + U.rand(0, this.w), this.y + U.rand(0, this.h), PAL.pale);
      }
    }
    kick(dir) {
      if (this.kicked) return;
      this.kicked = true;
      this.vx = dir * 6.4;
      this.vy = -1.5;
      this.solid = false;
      PB.Audio.sfx('dash', { vol: 0.6 });
      Events.emit('ice:kick', { x: this.centerX(), y: this.centerY(), dir });
    }
    shatter(fade = false) {
      if (this.dead) return;
      this.dead = true;
      if (PB.Gfx) {
        for (let i = 0; i < 7; i++) PB.Gfx.particles.iceShatter(this.centerX() + U.rand(-6, 6), this.centerY() + U.rand(-6, 6));
      }
      PB.Audio.sfx('freeze', { vol: 0.5 });
      this.world.spawnShardsAt(this.centerX(), this.centerY(), 2);
      Events.emit('iceblock:shatter', { x: this.centerX(), y: this.centerY() });
    }
    draw(ctx) {
      const x = Math.round(this.x), y = Math.round(this.y);
      const gl = 0.12 + U.animate(this.t, 1.5) * 0.08;
      ctx.save();
      ctx.globalAlpha = gl;
      ctx.fillStyle = PAL.cyan;
      ctx.fillRect(x - 2, y - 2, this.w + 4, this.h + 4);
      ctx.globalAlpha = 0.82;
      ctx.fillStyle = '#4ea6c4';
      ctx.fillRect(x + 1, y, this.w - 2, this.h);
      ctx.fillRect(x, y + 1, this.w, this.h - 2);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#9feaf7';
      ctx.fillRect(x + 2, y + 2, this.w - 4, 2);
      ctx.fillRect(x + 2, y + 2, 2, this.h - 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 3, y + 3, 2, 2);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#1f7188';
      ctx.fillRect(x + 5, y + 5, 1, 6);
      ctx.fillRect(x + 8, y + 3, 1, 4);
      ctx.restore();
    }
  }

  class Fossil extends Ent {
    constructor(world, tx, ty) {
      const p = groundPos(tx, ty, 14, 14);
      super(world, p.x, p.y, 14, 14, 'fossil');
      this.solid = true;
      this.layer = 2;
    }
    shatter() {
      if (this.dead) return;
      this.dead = true;
      this.world.spawnShardsAt(this.centerX(), this.centerY(), 4);
      if (PB.Gfx) {
        PB.Gfx.particles.iceShatter(this.centerX(), this.centerY());
        PB.Gfx.particles.emitBurst(this.centerX(), this.centerY(), 'ice', 10);
      }
      PB.Audio.sfx('freeze', { vol: 0.5 });
      Events.emit('fossil:shatter', { x: this.centerX(), y: this.centerY() });
    }
    update(dt, world) {
      this.t += dt;
      const p = world.player;
      if (p && (p.state === 'slide' || p.state === 'dash') && overlapPlayer(this, world, 2)) this.shatter();
    }
    draw(ctx) {
      const x = Math.round(this.x), y = Math.round(this.y);
      ctx.fillStyle = '#6b543c';
      ctx.fillRect(x, y + 1, 14, 13);
      ctx.fillStyle = '#8a6d4c';
      ctx.fillRect(x + 1, y, 12, 14);
      ctx.fillStyle = '#a98860';
      ctx.fillRect(x + 2, y + 1, 10, 2);
      // 化石螺旋
      ctx.fillStyle = '#e8e0c8';
      ctx.fillRect(x + 4, y + 4, 6, 1);
      ctx.fillRect(x + 3, y + 5, 1, 4);
      ctx.fillRect(x + 4, y + 8, 5, 1);
      ctx.fillRect(x + 8, y + 6, 1, 2);
      ctx.fillRect(x + 6, y + 6, 1, 1);
      ctx.fillStyle = '#cdeff5';
      ctx.globalAlpha = 0.65;
      ctx.fillRect(x + 1, y + 1, 12, 1);
      ctx.fillRect(x + 12, y + 2, 1, 10);
      ctx.globalAlpha = 1;
    }
  }

  class Turret extends Ent {
    constructor(world, tx, ty) {
      const p = centerPos(tx, ty, 18, 18);
      super(world, p.x, p.y, 18, 18, 'turret');
      this.hp = 3;
      this.fireT = 1.6;
      this.telegraph = 0;
      this.phase = U.rand(0, TAU);
      this.layer = 2;
    }
    update(dt, world, game) {
      this.t += dt;
      const p = game.player;
      if (!p || !p.alive) return;
      const d = U.dist(this.centerX(), this.centerY(), p.centerX(), p.centerY());
      if (d > 300) return;
      this.fireT -= dt;
      if (this.fireT <= 0.35 && this.telegraph <= 0) {
        this.telegraph = 0.35;
        PB.Audio.sfx('menuMove', { vol: 0.25 });
      }
      if (this.fireT <= 0) {
        this.fireT = 2.6;
        this.telegraph = 0;
        if (PB.BossOrb) {
          const ang = Math.atan2(p.centerY() - this.centerY(), p.centerX() - this.centerX());
          const orb = new PB.BossOrb(world, this.centerX(), this.centerY(), {
            game, vx: Math.cos(ang) * 1.35, vy: Math.sin(ang) * 1.35,
            color: '#f49cff', homing: 0.012, life: 7, kind: 'orb', deflectable: true,
          });
          world.addEntity(orb);
          if (PB.Gfx) PB.Gfx.particles.warpBurst(this.centerX(), this.centerY());
        }
      }
    }
    hurt(n = 1) {
      this.hp -= n;
      if (this.hp <= 0) {
        this.dead = true;
        PB.Audio.sfx('barrel', { vol: 0.5 });
        if (PB.Gfx) PB.Gfx.particles.explosion(this.centerX(), this.centerY());
      } else {
        if (PB.Gfx) PB.Gfx.particles.sparkle(this.centerX(), this.centerY(), '#f49cff');
      }
    }
    draw(ctx) {
      const cx = Math.round(this.centerX()), cy = Math.round(this.centerY());
      const glow = this.telegraph > 0 ? 0.45 : 0.22;
      ctx.save();
      ctx.globalAlpha = glow + Math.sin(this.t * 3 + this.phase) * 0.05;
      ctx.fillStyle = '#f49cff';
      ctx.beginPath(); ctx.arc(cx, cy, 15, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      // 底座
      ctx.fillStyle = '#22183a';
      ctx.fillRect(cx - 9, cy - 8, 18, 16);
      ctx.fillStyle = '#4a3a6b';
      ctx.fillRect(cx - 8, cy - 7, 16, 14);
      // 镜眼
      ctx.fillStyle = '#160f22';
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = this.telegraph > 0 ? '#fff2c4' : '#f49cff';
      ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - 1, cy - 2, 1, 2);
      // 悬浮环
      ctx.strokeStyle = 'rgba(244,156,255,.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, 11, this.t, this.t + 2.2); ctx.stroke();
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ vehicles / mounts
  class VehicleMount extends Ent {
    constructor(world, tx, ty, type) {
      let w = 26, h = 16;
      let p;
      if (type === 'glider') { w = 30; h = 14; p = centerPos(tx, ty, w, h); }
      else if (type === 'mech') { w = 22; h = 28; p = groundPos(tx, ty, w, h); }
      else p = groundPos(tx, ty, w, h);
      super(world, p.x, p.y, w, h, 'mount');
      this.vehicleType = type;
      this.ridden = false;
      this.layer = 1;
      this.prompt = true;
    }
    update(dt, world, game) {
      this.t += dt;
      if (this.ridden) return;
      if (game && game.bossActive) return;
      const p = world.player;
      if (!p || !p.alive || p.vehicle || p.mountCooldown > 0) return;
      if (U.rectsOverlap(this.x, this.y, this.w, this.h, p.x, p.y, p.w, p.h)) {
        p.mount(this.vehicleType, this);
        this.ridden = true;
      }
    }
    draw(ctx) {
      if (this.ridden) return;
      drawVehicle(ctx, this.vehicleType, this.x, this.y, this.w, this.h, this.t, false);
      if (this.nearPlayer(52)) {
        ctx.save();
        ctx.globalAlpha = 0.6 + U.animate(this.t, 1.1) * 0.3;
        ctx.fillStyle = PAL.pale;
        ctx.fillRect(Math.round(this.centerX()) - 1, Math.round(this.y) - 8, 2, 5);
        ctx.fillRect(Math.round(this.centerX()) - 3, Math.round(this.y) - 6, 6, 2);
        ctx.restore();
      }
    }
  }

  function drawVehicle(ctx, type, x, y, w, h, t, riding) {
    x = Math.round(x); y = Math.round(y);
    if (type === 'cart') {
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(x + 1, y + 4, w - 2, h - 6);
      ctx.fillStyle = PAL.woodDark;
      ctx.fillRect(x + 2, y + 2, w - 4, h - 8);
      ctx.fillStyle = PAL.wood;
      ctx.fillRect(x + 4, y + 3, w - 8, 3);
      ctx.fillStyle = PAL.stoneDark;
      ctx.fillRect(x + 3, y + h - 7, w - 6, 4);
      ctx.fillStyle = PAL.goldDark;
      for (let i = 6; i < w - 6; i += 7) ctx.fillRect(x + i, y + 7, 2, 3);
      ctx.fillStyle = '#0a0c16';
      ctx.fillRect(x + 4, y + h - 4, 5, 5);
      ctx.fillRect(x + w - 9, y + h - 4, 5, 5);
      ctx.fillStyle = PAL.stoneLight;
      ctx.fillRect(x + 5, y + h - 3, 2, 2);
      ctx.fillRect(x + w - 8, y + h - 3, 2, 2);
      // 炉火
      ctx.fillStyle = PAL.ember;
      ctx.fillRect(x + w - 7, y + 3, 3, 3);
      ctx.globalAlpha = 0.6;
      ctx.fillRect(x + w - 6, y + 1, 2, 2);
      ctx.globalAlpha = 1;
    } else if (type === 'glider') {
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(x + 2, y + 5, w - 4, 8);
      ctx.fillStyle = PAL.cyanDark;
      ctx.fillRect(x + 3, y + 6, w - 6, 6);
      ctx.fillStyle = PAL.cyan;
      ctx.fillRect(x + 3, y + 4, 9, 4);
      ctx.fillRect(x + w - 12, y + 4, 9, 4);
      ctx.fillStyle = PAL.pale;
      ctx.fillRect(x + 2, y + 4, 2, 2);
      ctx.fillRect(x + w - 4, y + 4, 2, 2);
      // 翼
      ctx.fillStyle = '#7fd8df';
      ctx.fillRect(x - 3, y + 2, 6, 2);
      ctx.fillRect(x + w - 3, y + 2, 6, 2);
      ctx.fillStyle = PAL.stoneDark;
      ctx.fillRect(x + 12, y + 2, 2, 8);
      ctx.fillRect(x + w - 14, y + 2, 2, 8);
      if (!riding) {
        ctx.fillStyle = PAL.white;
        ctx.globalAlpha = 0.5 + U.animate(t, 1.4) * 0.3;
        ctx.fillRect(x + 5, y + 1, 1, 1);
        ctx.fillRect(x + w - 6, y + 1, 1, 1);
        ctx.globalAlpha = 1;
      }
    } else if (type === 'mech') {
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(x + 3, y + 2, w - 6, h - 6);
      ctx.fillStyle = PAL.stoneDark;
      ctx.fillRect(x + 4, y + 3, w - 8, h - 10);
      ctx.fillStyle = PAL.stone;
      ctx.fillRect(x + 6, y + 4, w - 12, 5);
      ctx.fillStyle = PAL.stoneLight;
      ctx.fillRect(x + 7, y + 5, w - 14, 1);
      // 能量核心
      ctx.fillStyle = PAL.cyan;
      ctx.fillRect(x + w / 2 - 2, y + 12, 4, 4);
      ctx.fillStyle = PAL.white;
      ctx.fillRect(x + w / 2 - 1, y + 13, 2, 2);
      // 双臂
      ctx.fillStyle = PAL.stoneDark;
      ctx.fillRect(x - 1, y + 10, 3, 10);
      ctx.fillRect(x + w - 2, y + 10, 3, 10);
      // 腿
      ctx.fillStyle = PAL.stoneDark;
      ctx.fillRect(x + 4, y + h - 9, 5, 9);
      ctx.fillRect(x + w - 9, y + h - 9, 5, 9);
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(x + 6, y + h - 4, 1, 2);
      ctx.fillRect(x + w - 7, y + h - 4, 1, 2);
    }
  }

  class Ring extends Ent {
    constructor(world, tx, ty, tier = 1) {
      const p = centerPos(tx, ty, 16, 16);
      super(world, p.x, p.y, 16, 16, 'ring');
      this.baseY = this.y;
      this.tier = tier;
      this.phase = U.rand(0, TAU);
    }
    update(dt, world) {
      this.t += dt;
      this.y = this.baseY + Math.sin(this.t * 2 + this.phase) * 2;
      const p = world.player;
      if (p && p.vehicle && p.vehicle.type === 'glider' && overlapPlayer(this, world, -4)) {
        this.dead = true;
        if (world.game) world.game.collectShard(this.tier * 2, this.centerX(), this.centerY());
        PB.Audio.sfx('grand', { vol: 0.45 });
        if (PB.Gfx) PB.Gfx.particles.sparkleRing(this.centerX(), this.centerY(), PAL.gold);
      }
    }
    draw(ctx) {
      const cx = Math.round(this.centerX()), cy = Math.round(this.centerY());
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = PAL.gold;
      ctx.beginPath(); ctx.arc(cx, cy, 12, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 7, 0, TAU); ctx.stroke();
      ctx.strokeStyle = PAL.pale;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, 7, -0.8, 0.8); ctx.stroke();
      ctx.restore();
    }
  }

  class ArmoredWall extends Ent {
    constructor(world, tx, ty, wTiles, hTiles) {
      const w = (wTiles || 2) * T, h = (hTiles || 3) * T;
      super(world, tx * T, ty * T - h, w, h, 'armoredWall');
      this.solid = true;
      this.hp = 3;
      this.layer = 1;
    }
    hit(dmg = 1) {
      this.hp -= dmg;
      if (PB.Gfx) PB.Gfx.particles.emitBurst(this.centerX(), this.centerY(), 'spark', 8);
      if (this.hp <= 0) {
        this.dead = true;
        PB.Audio.sfx('barrel', { vol: 0.6 });
        if (PB.Gfx) PB.Gfx.particles.explosion(this.centerX(), this.centerY());
        Events.emit('armored:break', { x: this.centerX(), y: this.centerY() });
      } else {
        PB.Audio.sfx('bossHit', { vol: 0.4 });
      }
    }
    draw(ctx) {
      const x = Math.round(this.x), y = Math.round(this.y);
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(x, y, this.w, this.h);
      ctx.fillStyle = PAL.stoneDark;
      ctx.fillRect(x + 2, y + 2, this.w - 4, this.h - 4);
      for (let i = 0; i < this.w; i += 12) {
        ctx.fillStyle = PAL.stone;
        ctx.fillRect(x + 4 + i, y + 4, 6, this.h - 8);
        ctx.fillStyle = PAL.gold;
        ctx.fillRect(x + 6 + i, y + 8, 2, 2);
      }
      ctx.fillStyle = PAL.stoneLight;
      ctx.fillRect(x + 2, y + 2, this.w - 4, 1);
    }
  }

  class BossTrigger extends Ent {
    constructor(world, tx, ty, bossId) {
      super(world, tx * T, ty * T - 40, 32, 56, 'bossTrigger');
      this.bossId = bossId;
      this.layer = 0;
      this.triggered = false;
    }
    update(dt, world) {
      if (this.triggered) return;
      const p = world.player;
      if (p && U.rectsOverlap(this.x, this.y, this.w, this.h, p.x, p.y, p.w, p.h)) {
        this.triggered = true;
        if (world.game) world.game.startBoss(this.bossId, this);
      }
    }
    draw() {}
  }

  // ------------------------------------------------------------------ projectiles
  class Fireball extends Ent {
    constructor(world, x, y, vx, vy, opts = {}) {
      super(world, x - 4, y - 4, 8, 8, 'fireball');
      this.vx = vx; this.vy = vy;
      this.life = 2.6;
      this.bounces = 0;
      this.echo = !!opts.echo;
      this.gold = !!opts.echo;
      this.layer = 5;
      this.trailT = 0;
      this.hitSet = new Set();
    }
    update(dt, world) {
      this.t += dt;
      this.life -= dt;
      if (this.life <= 0) { this.pop(); return; }
      this.vy += 0.16;
      const prevX = this.x, prevY = this.y;
      this.x += this.vx;
      this.y += this.vy;
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 0.03;
        if (PB.Gfx) PB.Gfx.particles.ember(this.centerX(), this.centerY(), 0.2, this.gold ? PAL.gold : PAL.ember);
      }
      // 瓦片碰撞/交互
      const tx = Math.floor(this.centerX() / T);
      const ty = Math.floor(this.centerY() / T);
      const ch = world.tileAt(tx, ty);
      if (ch === '~') { world.evaporateWater(tx, ty); this.pop(true); return; }
      if (ch === '!') { this.pop(true); return; }
      if (ch === '%') { world.burnVines(tx, ty); this.pop(true); return; }
      if (world.isSolidTile(tx, ty)) {
        // 判断从哪个方向撞入并反弹
        const hx = Math.floor(this.centerX() / T);
        const hy = Math.floor(this.centerY() / T);
        if (Math.floor((this.centerX() - this.vx) / T) !== hx) this.vx *= -0.78;
        else this.vy *= -0.72;
        this.x = prevX; this.y = prevY;
        this.bounces++;
        PB.Audio.sfx('fireBounce', { vol: 0.5 });
        if (this.bounces > 4) { this.pop(); return; }
      }
      // 实体交互
      for (const e of world.entities) {
        if (e.dead || e === this || this.hitSet.has(e)) continue;
        if (!U.rectsOverlap(this.x, this.y, this.w, this.h, e.x, e.y, e.w, e.h)) continue;
        if (e.type === 'barrel') { e.ignite(0.16); this.pop(true); return; }
        if (e.type === 'turret') { e.hurt(1); this.pop(true); return; }
        if (e instanceof Enemy) {
          if (e.fireImmune && !e.frozen) { this.pop(); return; }
          if (e.frozen > 0) { e.thermalShatter(); this.pop(true); return; }
          e.hurt(1, Math.sign(this.vx) || 1, 'solar');
          this.hitSet.add(e);
          this.pop();
          return;
        }
        if (e.type === 'coil') { world.powerCircuit(e.circuitId); this.pop(true); return; }
        if (e.type === 'crate' || e.type === 'iceblock' || e.type === 'fossil') {
          if (e.type === 'crate') { e.knock(Math.sign(this.vx) || 1, -1.5); this.pop(); return; }
          if (e.shatter) e.shatter();
          this.pop(true);
          return;
        }
        if (e.type === 'boss' && e.hurt) { /* boss handled by boss bullets */ }
      }
      // 玩家自己发射的普通火球不会伤玩家
      const boss = world.game && world.game.boss;
      if (world.game && world.game.bossActive && boss && !boss.dead && boss.hitRect) {
        const br = boss.hitRect();
        if (U.rectsOverlap(this.x, this.y, this.w, this.h, br.x, br.y, br.w, br.h)) {
          if (boss.vulnerable) boss.hurt(1, 'solar');
          else if (PB.Gfx) PB.Gfx.particles.sparkle(this.centerX(), this.centerY(), '#ffd27a');
          PB.Audio.sfx('deflect', { vol: 0.35 });
          this.pop();
        }
      }
    }
    pop(strong = false) {
      this.dead = true;
      if (PB.Gfx) {
        PB.Gfx.particles.emitBurst(this.centerX(), this.centerY(), strong ? 'fire' : 'spark', strong ? 10 : 4);
      }
    }
    draw(ctx) {
      const cx = Math.round(this.centerX()), cy = Math.round(this.centerY());
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = this.gold ? PAL.gold : PAL.ember;
      ctx.beginPath(); ctx.arc(cx, cy, 7, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.gold ? '#c79a2e' : '#e2562f';
      ctx.fillRect(cx - 3, cy - 3, 6, 6);
      ctx.fillStyle = this.gold ? PAL.gold : PAL.ember;
      ctx.fillRect(cx - 2, cy - 2, 4, 4);
      ctx.fillStyle = PAL.pale;
      ctx.fillRect(cx - 1, cy - 2, 2, 2);
      ctx.restore();
    }
  }

  class WarpStar extends Ent {
    constructor(world, x, y, vx, vy) {
      super(world, x - 4, y - 4, 9, 9, 'warpStar');
      this.vx = vx; this.vy = vy;
      this.life = 3.2;
      this.attached = null;
      this.attachedEntity = null;
      this.stuck = false;
      this.layer = 5;
      this.world.warpStar = this;
    }
    update(dt, world) {
      this.t += dt;
      this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }
      if (this.stuck) {
        if (this.attachedEntity && !this.attachedEntity.dead) {
          this.x = this.attachedEntity.centerX() - this.w / 2;
          this.y = this.attachedEntity.centerY() - this.h / 2;
        }
        return;
      }
      this.x += this.vx;
      this.y += this.vy;
      if (PB.Gfx && Math.random() < 0.5) PB.Gfx.particles.warp(this.centerX(), this.centerY());
      const tx = Math.floor(this.centerX() / T);
      const ty = Math.floor(this.centerY() / T);
      if (world.isSolidTile(tx, ty)) {
        this.x -= this.vx; this.y -= this.vy;
        this.stuck = true;
        PB.Audio.sfx('warpThrow', { vol: 0.6 });
        return;
      }
      for (const e of world.entities) {
        if (e.dead || e === this) continue;
        if (e instanceof Enemy || e.type === 'barrel' || e.type === 'crate') {
          if (U.rectsOverlap(this.x, this.y, this.w, this.h, e.x, e.y, e.w, e.h)) {
            this.stuck = true;
            this.attachedEntity = e;
            this.x = e.centerX() - this.w / 2;
            this.y = e.centerY() - this.h / 2;
            PB.Audio.sfx('warpThrow', { vol: 0.7 });
            Events.emit('warp:attach', { x: this.centerX(), y: this.centerY(), entity: e.type });
            return;
          }
        }
      }
      // 星棱可钉在 Boss 身上
      const boss = world.game && world.game.boss;
      if (world.game && world.game.bossActive && boss && !boss.dead) {
        const br = boss.hitRect ? boss.hitRect() : { x: boss.x - 30, y: boss.y - 30, w: 60, h: 60 };
        if (U.rectsOverlap(this.x, this.y, this.w, this.h, br.x, br.y, br.w, br.h)) {
          this.stuck = true;
          this.attachedEntity = {
            type: 'boss', boss,
            centerX: () => boss.x, centerY: () => boss.y,
            x: boss.x, y: boss.y, w: 1, h: 1, dead: false,
          };
          PB.Audio.sfx('warpThrow', { vol: 0.7 });
          Events.emit('warp:attach', { x: this.centerX(), y: this.centerY(), entity: 'boss' });
        }
      }
    }
    draw(ctx) {
      const cx = Math.round(this.centerX()), cy = Math.round(this.centerY());
      const a = this.t * 6;
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = PAL.violet;
      ctx.beginPath(); ctx.arc(cx, cy, 9, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = PAL.violet;
      for (let i = 0; i < 4; i++) {
        const ang = a + i * Math.PI / 2;
        ctx.fillRect(cx + Math.round(Math.cos(ang) * 4) - 1, cy + Math.round(Math.sin(ang) * 4) - 1, 2, 2);
      }
      ctx.fillStyle = PAL.pale;
      ctx.fillRect(cx - 1, cy - 1, 2, 2);
      ctx.strokeStyle = 'rgba(244,156,255,.35)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, 10, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }

  class MechBolt extends Ent {
    constructor(world, x, y, dir) {
      super(world, x - 4, y - 3, 9, 7, 'mechBolt');
      this.vx = dir * 8.2;
      this.life = 1.4;
      this.layer = 5;
    }
    update(dt, world) {
      this.t += dt;
      this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }
      this.x += this.vx;
      const tx = Math.floor(this.centerX() / T), ty = Math.floor(this.centerY() / T);
      if (world.isSolidTile(tx, ty)) {
        this.dead = true;
        PB.Audio.sfx('bossHit', { vol: 0.4 });
        if (PB.Gfx) PB.Gfx.particles.emitBurst(this.centerX(), this.centerY(), 'spark', 5);
        return;
      }
      for (const e of world.entities) {
        if (e.dead || e === this) continue;
        if (e.type === 'armoredWall' && U.rectsOverlap(this.x, this.y, this.w, this.h, e.x, e.y, e.w, e.h)) {
          e.hit(2); this.dead = true; return;
        }
        if (e instanceof Enemy && U.rectsOverlap(this.x, this.y, this.w, this.h, e.x, e.y, e.w, e.h)) {
          e.hurt(2, Math.sign(this.vx) || 1, 'mech'); this.dead = true; return;
        }
        if (e.type === 'barrel' && U.rectsOverlap(this.x, this.y, this.w, this.h, e.x, e.y, e.w, e.h)) {
          e.ignite(0.1); this.dead = true; return;
        }
      }
    }
    draw(ctx) {
      const x = Math.round(this.x), y = Math.round(this.y);
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = PAL.cyan;
      ctx.fillRect(x - 6, y - 2, this.w + 12, this.h + 4);
      ctx.globalAlpha = 1;
      ctx.fillStyle = PAL.cyan;
      ctx.fillRect(x, y, this.w, this.h);
      ctx.fillStyle = PAL.white;
      ctx.fillRect(x + 2, y + 2, 3, 3);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ echo clone
  class EchoEntity extends Ent {
    constructor(world, samples, events, duration, source) {
      const s0 = samples[0] || { x: 0, y: 0 };
      super(world, s0.x, s0.y, 10, 18, 'echo');
      this.samples = samples;
      this.events = events;
      this.duration = duration;
      this.source = source;
      this.elapsed = 0;
      this.solid = true;
      this.oneWay = true;
      this.layer = 3;
      this.eventIndex = 0;
      this.ghosts = [];
      this.form = s0.form || 'echo';
      this.dir = s0.dir || 1;
      this.anim = s0.anim || 'idle';
      this.world.echo = this;
      PB.Audio.sfx('echoEnd');
      Events.emit('echo:spawn', { x: this.x, y: this.y });
    }
    update(dt, world) {
      this.t += dt;
      this.elapsed += dt;
      if (this.elapsed >= this.duration) {
        this.dead = true;
        if (this.world.echo === this) this.world.echo = null;
        if (PB.Gfx) PB.Gfx.particles.sparkleRing(this.centerX(), this.centerY(), PAL.gold);
        return;
      }
      const t = this.elapsed;
      let i = 0;
      while (i < this.samples.length - 2 && this.samples[i + 1].t < t) i++;
      const a = this.samples[i], b = this.samples[Math.min(i + 1, this.samples.length - 1)];
      const f = b.t > a.t ? U.clamp((t - a.t) / (b.t - a.t), 0, 1) : 0;
      this.x = U.lerp(a.x, b.x, f);
      this.y = U.lerp(a.y, b.y, f);
      this.form = a.form || this.form;
      this.dir = a.dir || this.dir;
      this.anim = a.anim || this.anim;
      // 触发录制的技能
      while (this.eventIndex < this.events.length && this.events[this.eventIndex].t <= t) {
        const ev = this.events[this.eventIndex++];
        if (this.source && this.source.replayEchoEvent) this.source.replayEchoEvent(ev, this);
      }
      // 金色残影
      if (Math.floor(t * 12) !== Math.floor((t - dt) * 12)) {
        this.ghosts.push({ x: this.x, y: this.y, form: this.form, anim: this.anim, dir: this.dir, life: 0.4 });
      }
      for (const g of this.ghosts) g.life -= dt;
      this.ghosts = this.ghosts.filter((g) => g.life > 0);
    }
    draw(ctx) {
      for (const g of this.ghosts) {
        const spr = PB.Sprites.player('echo', g.anim === 'run' ? 'run1' : (g.anim || 'idle'));
        ctx.save();
        ctx.globalAlpha = g.life * 0.6;
        PB.Sprites.draw(ctx, spr, g.x + (10 - 12) / 2, g.y + 18 - spr.height, g.dir < 0);
        ctx.restore();
      }
      const spr = PB.Sprites.player('echo', this.anim === 'run' ? 'run1' : (this.anim || 'idle'));
      ctx.save();
      ctx.globalAlpha = 0.9;
      const glow = 0.2 + U.animate(this.t, 1.3) * 0.1;
      ctx.globalAlpha = glow;
      ctx.fillStyle = PAL.gold;
      ctx.beginPath(); ctx.arc(this.centerX(), this.centerY(), 14, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.92;
      PB.Sprites.draw(ctx, spr, this.x + (this.w - 12) / 2, this.y + this.h - spr.height, this.dir < 0);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ factory
  function create(world, type, tx, ty, args) {
    switch (type) {
      case 'shard': return new Shard(world, tx, ty, {});
      case 'grand': return new GrandShard(world, tx, ty, args[0]);
      case 'sign': return new Sign(world, tx, ty, args[0]);
      case 'checkpoint': return new Checkpoint(world, tx, ty);
      case 'shrine': return new Shrine(world, tx, ty, args[0]);
      case 'chronoShrine': return new Shrine(world, tx, ty, 'chrono');
      case 'portal': return new Portal(world, tx, ty, args[0]);
      case 'plate': return new Plate(world, tx, ty, args[0]);
      case 'door': return new Door(world, tx, ty, args[0], args[1] || 3);
      case 'coil': return new Coil(world, tx, ty, args[0]);
      case 'gate': return new Gate(world, tx, ty, args[0], args[1] || 3, args[2] || 'v');
      case 'movingPlatform': return new MovingPlatform(world, tx, ty, args);
      case 'slime': return new Slime(world, tx, ty);
      case 'bat': return new Bat(world, tx, ty);
      case 'wisp': return new Wisp(world, tx, ty);
      case 'sentinel': return new Sentinel(world, tx, ty);
      case 'lantern': return new Lantern(world, tx, ty);
      case 'barrel': return new Barrel(world, tx, ty);
      case 'crate': return new Crate(world, tx, ty);
      case 'iceblock': return new IceBlock(world, tx, ty, args[0] || {});
      case 'fossil': return new Fossil(world, tx, ty);
      case 'cartMount': return new VehicleMount(world, tx, ty, 'cart');
      case 'gliderMount': return new VehicleMount(world, tx, ty, 'glider');
      case 'mechMount': return new VehicleMount(world, tx, ty, 'mech');
      case 'ring': return new Ring(world, tx, ty, args[0] || 1);
      case 'armoredWall': return new ArmoredWall(world, tx, ty, args[0], args[1]);
      case 'bossTrigger': return new BossTrigger(world, tx, ty, args[0]);
      case 'turret': return new Turret(world, tx, ty);
      default:
        console.warn('[entities] unknown type', type);
        return null;
    }
  }

  const TAU = Math.PI * 2;

  PB.Ents = {
    create,
    Ent, Shard, GrandShard, Sign, Checkpoint, Shrine, Portal,
    Plate, Door, Coil, Gate, MovingPlatform,
    Enemy, Slime, Bat, Wisp, Sentinel, Lantern,
    Barrel, Crate, IceBlock, Fossil,
    VehicleMount, Ring, ArmoredWall, BossTrigger, Turret,
    Fireball, WarpStar, MechBolt, EchoEntity,
    platePressed, drawVehicle,
    spawnFireball(world, x, y, vx, vy, opts) {
      const fb = new Fireball(world, x, y, vx, vy, opts);
      world.addEntity(fb);
      return fb;
    },
    spawnWarpStar(world, x, y, vx, vy) {
      const ws = new WarpStar(world, x, y, vx, vy);
      world.addEntity(ws);
      return ws;
    },
    spawnMechBolt(world, x, y, dir) {
      const mb = new MechBolt(world, x, y, dir);
      world.addEntity(mb);
      return mb;
    },
  };
})();
