/* ============================================================
   world.js — 关卡世界、瓦片碰撞、元素交互与机关
   · 轴分离 AABB，支持一/八向冲刺、砸地、重力翻转
   · 一/四向平台、移动平台载人、动态实体固体
   · 冻结水面/熔岩、蒸汽柱、藤蔓燃烧、裂岩、压力门、激光电路
   ============================================================ */
(function () {
  'use strict';
  const PB = window.PB;
  const { C, U, Events } = PB;
  const T = C.TILE;

  class World {
    constructor(chapterIndex, opts = {}) {
      this.chapterIndex = chapterIndex;
      this.chapter = PB.Levels.get(chapterIndex) || PB.Levels.SANDBOX;
      this.level = PB.Levels.compose(this.chapter);
      this.width = this.level.width;
      this.height = this.level.height;
      this.pixelW = this.level.pixelW;
      this.pixelH = this.level.pixelH;
      this.tiles = this.level.rows.map((r) => r.split(''));
      this.time = 0;
      this.frozen = new Map();       // key -> {kind, until, tx, ty}
      this.steam = new Map();        // key -> {until}
      this.burning = new Map();      // key -> {until, tx, ty}
      this.entities = [];
      this.pickups = [];
      this.projectiles = [];
      this.coils = new Map();
      this.gates = new Map();
      this.checkpoints = [];
      this.shrines = [];
      this.player = null;
      this.game = null;
      this.spawn = { x: 3 * T, y: 22 * T };
      this.collected = opts.collected || new Set();
      this.visualSeed = (chapterIndex + 1) * 7817;
      this._loadEntities();
      if (opts.spawn) this.spawn = { x: opts.spawn.x, y: opts.spawn.y };
      this.deathsAt = 0;
    }

    // ------------------------------------------------------------- loading
    _loadEntities() {
      for (const e of this.level.ents) {
        if (e.type === 'start') {
          if (!this._explicitStart) {
            this.spawn = { x: e.tx * T + 3, y: e.ty * T - C.P_H };
            this._explicitStart = true;
          }
          continue;
        }
        if (e.type === 'grand' && PB.Save.data.grand[e.args[0]]) continue;
        if (e.type === 'shard') {
          const key = `${this.chapterIndex}:${e.tx},${e.ty}`;
          if (this.collected.has(key)) continue;
        }
        const ent = PB.Ents.create(this, e.type, e.tx, e.ty, e.args || []);
        if (ent) {
          this.entities.push(ent);
          if (ent.type === 'coil') {
            this.coils.set(ent.circuitId, ent);
            if (!this.gates.has(ent.circuitId)) this.gates.set(ent.circuitId, []);
            ent.world = this;
          }
          if (ent.type === 'gate') {
            if (!this.gates.has(ent.circuitId)) this.gates.set(ent.circuitId, []);
            this.gates.get(ent.circuitId).push(ent);
            ent.world = this;
          }
          if (ent.type === 'checkpoint') this.checkpoints.push(ent);
          if (ent.type === 'shrine' || ent.type === 'chronoShrine') this.shrines.push(ent);
        }
      }
    }

    addEntity(ent) {
      this.entities.push(ent);
      return ent;
    }

    // ------------------------------------------------------------- grid
    inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height; }
    tileAt(tx, ty) {
      if (tx < 0 || tx >= this.width) return '#';
      if (ty < 0) return '.';
      if (ty >= this.height) return '.';
      return this.tiles[ty][tx];
    }
    setTile(tx, ty, ch) {
      if (this.inBounds(tx, ty)) this.tiles[ty][tx] = ch;
    }
    key(tx, ty) { return tx + ',' + ty; }
    isFrozen(tx, ty) { return this.frozen.has(this.key(tx, ty)); }
    isSteam(tx, ty) { return this.steam.has(this.key(tx, ty)); }
    isBurning(tx, ty) { return this.burning.has(this.key(tx, ty)); }

    isSolidTile(tx, ty) {
      const ch = this.tileAt(tx, ty);
      if (this.isFrozen(tx, ty)) return true;
      if (ch === '#' || ch === 'c' || ch === '%' || ch === 'S' || ch === 'M') return true;
      return false;
    }

    isOneWayTile(tx, ty) {
      return this.tileAt(tx, ty) === '=';
    }

    // 简单的矩形与瓦片重叠
    tilesInRect(x, y, w, h) {
      const x0 = Math.floor(x / T), x1 = Math.floor((x + w - 0.01) / T);
      const y0 = Math.floor(y / T), y1 = Math.floor((y + h - 0.01) / T);
      const out = [];
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) out.push({ tx, ty });
      }
      return out;
    }

    // ------------------------------------------------------------- collision
    _solidEntitiesNear(rect) {
      const out = [];
      for (const e of this.entities) {
        if (!e.solid || e.dead) continue;
        const r = e.rect();
        if (r.x < rect.x + rect.w && r.x + r.w > rect.x && r.y < rect.y + rect.h && r.y + r.h > rect.y) {
          out.push(e);
        }
      }
      return out;
    }

    _resolveEntityX(body, e, dir) {
      const r = e.rect();
      const b = body;
      if (dir > 0) b.x = r.x - b.w - 0.01;
      else b.x = r.x + r.w + 0.01;
      b.vx = 0;
      b.hitWall = dir;
      if (e.onPlayerCollide) e.onPlayerCollide(body, 'side');
    }

    _resolveEntityY(body, e, dir, prevY) {
      const r = e.rect();
      const b = body;
      if (dir > 0) {
        b.y = r.y - b.h - 0.01;
        b.vy = 0;
        b.onGround = true;
        b.groundEntity = e;
      } else {
        b.y = r.y + r.h + 0.01;
        b.vy = 0;
        b.hitCeil = true;
        b.ceilEntity = e;
      }
      if (e.onPlayerCollide) e.onPlayerCollide(body, dir > 0 ? 'top' : 'bottom');
    }

    moveX(body, dx) {
      if (!dx) return false;
      let remain = dx;
      let collided = false;
      const steps = Math.max(1, Math.ceil(Math.abs(dx) / 7));
      const step = dx / steps;
      body.hitWall = 0;
      for (let s = 0; s < steps; s++) {
        body.x += step;
        // 瓦片
        for (const { tx, ty } of this.tilesInRect(body.x, body.y, body.w, body.h)) {
          if (!this.isSolidTile(tx, ty)) continue;
          const tileX = tx * T;
          if (step > 0) body.x = tileX - body.w - 0.01;
          else body.x = tileX + T + 0.01;
          body.vx = 0;
          body.hitWall = step > 0 ? 1 : -1;
          collided = true;
          break;
        }
        if (body.hitWall) break;
        // 实体
        const solids = this._solidEntitiesNear({ x: body.x, y: body.y, w: body.w, h: body.h });
        for (const e of solids) {
          if (e.oneWay) continue;
          this._resolveEntityX(body, e, step > 0 ? 1 : -1);
          collided = true;
          break;
        }
        if (body.hitWall) break;
      }
      return collided;
    }

    moveY(body, dy, opts = {}) {
      if (!dy) return false;
      let collided = false;
      const grav = body.grav || 1;
      const steps = Math.max(1, Math.ceil(Math.abs(dy) / 7));
      const step = dy / steps;
      body.hitCeil = false;
      body.onGround = false;
      for (let s = 0; s < steps; s++) {
        const prevY = body.y;
        body.y += step;
        let stop = false;
        // 瓦片
        for (const { tx, ty } of this.tilesInRect(body.x, body.y, body.w, body.h)) {
          const isSolid = this.isSolidTile(tx, ty);
          const isOneWay = this.isOneWayTile(tx, ty);
          if (!isSolid && !isOneWay) continue;
          if (isOneWay) {
            if (body.dropThrough > 0) continue;
            if (step > 0 && grav > 0) {
              const top = ty * T;
              if (prevY + body.h > top + 0.6) continue;
            } else if (step < 0 && grav < 0) {
              const bottom = ty * T + T;
              if (prevY < bottom - 0.6) continue;
            } else {
              continue;
            }
          }
          if (step > 0) {
            body.y = ty * T - body.h - 0.01;
            body.vy = 0;
            body.onGround = true;
            body.groundEntity = null;
            body.groundTile = { tx, ty };
          } else {
            body.y = ty * T + T + 0.01;
            body.vy = 0;
            body.hitCeil = true;
            body.ceilingTile = { tx, ty };
          }
          collided = true;
          stop = true;
          break;
        }
        if (stop) break;
        // 实体固体
        const solids = this._solidEntitiesNear({ x: body.x, y: body.y, w: body.w, h: body.h });
        for (const e of solids) {
          const r = e.rect();
          if (e.oneWay) {
            if (body.dropThrough > 0) continue;
            if (step > 0 && grav > 0) {
              if (prevY + body.h > r.y + 1.2) continue;
            } else if (step < 0 && grav < 0) {
              if (prevY < r.y + r.h - 1.2) continue;
            } else continue;
          }
          this._resolveEntityY(body, e, step > 0 ? 1 : -1, prevY);
          collided = true;
          stop = true;
          break;
        }
        if (stop) break;
      }
      return collided;
    }

    groundProbe(body) {
      const grav = body.grav || 1;
      const y = grav > 0 ? body.y + body.h + 0.6 : body.y - 0.6;
      const x0 = body.x + 1, w = body.w - 2;
      const tiles = this.tilesInRect(x0, grav > 0 ? body.y + body.h : body.y - 1, w, 1);
      for (const { tx, ty } of tiles) {
        if (this.isSolidTile(tx, ty) || this.isOneWayTile(tx, ty)) {
          return { solid: true, oneWay: this.isOneWayTile(tx, ty), tx, ty };
        }
      }
      // 实体地面
      for (const e of this.entities) {
        if (!e.solid || e.dead) continue;
        const r = e.rect();
        if (body.x + body.w > r.x + 1 && body.x < r.x + r.w - 1) {
          if (grav > 0 && Math.abs(body.y + body.h - r.y) <= 1.5) {
            return { solid: true, entity: e, oneWay: !!e.oneWay };
          }
          if (grav < 0 && Math.abs(body.y - (r.y + r.h)) <= 1.5) {
            return { solid: true, entity: e, oneWay: !!e.oneWay };
          }
        }
      }
      return { solid: false };
    }

    wallProbe(body, dir) {
      const x = dir > 0 ? body.x + body.w + 1 : body.x - 1;
      const tiles = this.tilesInRect(x, body.y + 2, 1, body.h - 4);
      for (const { tx, ty } of tiles) {
        if (this.isSolidTile(tx, ty)) return { solid: true, tx, ty };
      }
      for (const e of this.entities) {
        if (!e.solid || e.dead || e.oneWay) continue;
        const r = e.rect();
        if (dir > 0 && Math.abs(body.x + body.w - r.x) <= 2 &&
          body.y + body.h > r.y + 1 && body.y < r.y + r.h - 1) return { solid: true, entity: e };
        if (dir < 0 && Math.abs(body.x - (r.x + r.w)) <= 2 &&
          body.y + body.h > r.y + 1 && body.y < r.y + r.h - 1) return { solid: true, entity: e };
      }
      return { solid: false };
    }

    headCornerFix(body) {
      // 4px 头顶角落顺滑纠偏：撞到天花板边缘时轻推过角
      if (!body.hitCeil) return false;
      for (const off of [1, 2, 3, 4, -1, -2, -3, -4]) {
        const testX = body.x + off;
        const solids = this.tilesInRect(testX, body.y, body.w, body.h);
        let blocked = false;
        for (const { tx, ty } of solids) {
          if (this.isSolidTile(tx, ty)) { blocked = true; break; }
        }
        if (!blocked) {
          body.x = testX;
          body.hitCeil = false;
          body.vy = Math.max(body.vy, 0);
          return true;
        }
      }
      return false;
    }

    // ------------------------------------------------------------- hazards
    hazardAt(body) {
      const inset = 2;
      const bx = body.x + inset, by = body.y + inset;
      const bw = body.w - inset * 2, bh = body.h - inset * 2;
      const tiles = this.tilesInRect(bx, by, bw, bh);
      for (const { tx, ty } of tiles) {
        const ch = this.tileAt(tx, ty);
        if (ch === '^' || ch === 'v' || ch === '<' || ch === '>') {
          // 尖刺的有效碰撞盒略小
          let sx = tx * T + 2, sy = ty * T + 2, sw = T - 4, sh = T - 4;
          if (ch === '^') { sy = ty * T + 7; sh = 8; }
          if (ch === 'v') { sy = ty * T + 1; sh = 8; }
          if (ch === '<') { sx = tx * T + 1; sw = 8; }
          if (ch === '>') { sx = tx * T + 7; sw = 8; }
          if (U.rectsOverlap(bx, by, bw, bh, sx, sy, sw, sh)) return { type: 'spike', tx, ty };
        }
        if (ch === '~' || ch === '!') {
          if (this.isFrozen(tx, ty)) continue;
          if (ch === '~' && this.isSteam(tx, ty)) continue;
          return { type: ch === '~' ? 'water' : 'lava', tx, ty };
        }
      }
      if (body.y > this.pixelH + 60) return { type: 'void' };
      return null;
    }

    springUnder(body) {
      const grav = body.grav || 1;
      const tx = Math.floor((body.x + body.w / 2) / T);
      const ty = Math.floor((grav > 0 ? body.y + body.h + 2 : body.y - 2) / T);
      const ch = this.tileAt(tx, ty);
      if (ch === 'S') return { type: 'spring', tx, ty };
      if (ch === 'M') return { type: 'meteor', tx, ty };
      return null;
    }

    // ------------------------------------------------------------- elemental
    freezeArea(cx, cy, radius = 76, formSource) {
      const results = { water: 0, lava: 0, lanterns: 0, enemies: 0, fossils: 0 };
      const candidates = [];
      const rTiles = Math.ceil(radius / T) + 2;
      const ctx = Math.floor(cx / T), cty = Math.floor(cy / T);
      // 按列只保留最上层的液面，确保冻结出可连续行走的桥面
      const cols = new Map();
      for (let ty = cty - rTiles; ty <= cty + rTiles; ty++) {
        for (let tx = ctx - rTiles; tx <= ctx + rTiles; tx++) {
          const ch = this.tileAt(tx, ty);
          if (ch !== '~' && ch !== '!') continue;
          if (this.isFrozen(tx, ty)) continue;
          const d = U.dist(cx, cy, tx * T + 8, ty * T + 8);
          if (d > radius) continue;
          const k = ch + ':' + tx;
          const cur = cols.get(k);
          if (!cur || ty < cur.ty) cols.set(k, { tx, ty, ch, d });
        }
      }
      const arr = Array.from(cols.values()).sort((a, b) => a.d - b.d);
      let waterCount = 0, lavaCount = 0;
      for (const c of arr) {
        if (c.ch === '~' && waterCount < 12) {
          this.frozen.set(this.key(c.tx, c.ty), {
            kind: 'frost', until: this.time + C.WATER_FREEZE_TIME, tx: c.tx, ty: c.ty,
          });
          if (this.tileAt(c.tx, c.ty + 1) === '~') {
            this.frozen.set(this.key(c.tx, c.ty + 1), {
              kind: 'frost', until: this.time + C.WATER_FREEZE_TIME, tx: c.tx, ty: c.ty + 1,
            });
          }
          waterCount++; results.water++;
        } else if (c.ch === '!' && lavaCount < 8) {
          this.frozen.set(this.key(c.tx, c.ty), {
            kind: 'obsidian', until: this.time + C.LAVA_FREEZE_TIME, tx: c.tx, ty: c.ty,
          });
          if (this.tileAt(c.tx, c.ty + 1) === '!') {
            this.frozen.set(this.key(c.tx, c.ty + 1), {
              kind: 'obsidian', until: this.time + C.LAVA_FREEZE_TIME, tx: c.tx, ty: c.ty + 1,
            });
          }
          lavaCount++; results.lava++;
        }
      }
      // 灯笼灵、敌人、化石
      for (const e of this.entities) {
        if (e.dead) continue;
        const d = U.dist(cx, cy, e.centerX ? e.centerX() : e.x + (e.w || 12) / 2, e.centerY ? e.centerY() : e.y + (e.h || 12) / 2);
        if (d > radius + 12) continue;
        if (e.type === 'lantern' && !e.tamed && e.tame) {
          e.tame(); results.lanterns++;
        } else if (e.freezable && e.freeze && !e.frozen) {
          e.freeze(4.3); results.enemies++;
        } else if (e.type === 'fossil' && e.shatter) {
          e.shatter(); results.fossils++;
        }
      }
      if (results.water + results.lava + results.lanterns + results.enemies + results.fossils > 0) {
        PB.Audio.sfx('freeze');
        Events.emit('cryo:pulse', { x: cx, y: cy, ...results, source: formSource });
      }
      return results;
    }

    evaporateWater(tx, ty) {
      // 找到水面，制造一根向上的蒸汽柱
      let top = ty;
      while (top > 0 && this.tileAt(tx, top - 1) === '~') top--;
      const now = this.time;
      let count = 0;
      for (let dx = -1; dx <= 1; dx++) {
        for (let yy = Math.max(0, top - 6); yy <= top + 2; yy++) {
          const ch = this.tileAt(tx + dx, yy);
          if (ch === '~' || ch === '.') {
            this.steam.set(this.key(tx + dx, yy), { until: now + 3.4 });
            count++;
          }
        }
      }
      if (count) {
        PB.Audio.sfx('steam');
        Events.emit('water:evaporate', { x: tx * T + 8, y: top * T });
        if (this.game) this.game.shake(2, 0.2);
      }
    }

    burnVines(tx, ty) {
      const start = this.tileAt(tx, ty);
      if (start !== '%') return 0;
      const seen = new Set();
      const queue = [{ tx, ty, d: 0 }];
      const burn = [];
      while (queue.length && burn.length < 60) {
        const cur = queue.shift();
        const k = this.key(cur.tx, cur.ty);
        if (seen.has(k)) continue;
        seen.add(k);
        if (this.tileAt(cur.tx, cur.ty) !== '%') continue;
        burn.push(cur);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          queue.push({ tx: cur.tx + dx, ty: cur.ty + dy, d: cur.d + 1 });
        }
      }
      for (const b of burn) {
        this.burning.set(this.key(b.tx, b.ty), {
          until: this.time + 0.12 + b.d * 0.045,
          tx: b.tx, ty: b.ty,
        });
      }
      if (burn.length) {
        PB.Audio.sfx('ignite');
        Events.emit('vine:burn', { tx, ty, count: burn.length });
      }
      return burn.length;
    }

    breakCracked(tx, ty, radius = 0) {
      let broken = 0;
      const r = Math.ceil(radius / T);
      for (let yy = ty - r; yy <= ty + r; yy++) {
        for (let xx = tx - r; xx <= tx + r; xx++) {
          if (this.tileAt(xx, yy) !== 'c') continue;
          if (radius > 0 && U.dist(tx * T, ty * T, xx * T, yy * T) > radius) continue;
          this.setTile(xx, yy, '.');
          broken++;
        }
      }
      if (broken) {
        PB.Audio.sfx('pound');
        if (this.game) this.game.shake(3, 0.25);
        Events.emit('cracked:break', { tx, ty, count: broken });
      }
      return broken;
    }

    powerCircuit(id, duration = C.COIL_POWER_TIME) {
      const coil = this.coils.get(id);
      if (!coil) return;
      coil.poweredUntil = this.time + duration;
      PB.Audio.sfx('deflect');
      Events.emit('coil:power', { id, tx: coil.tx, ty: coil.ty });
    }

    circuitPowered(id) {
      const coil = this.coils.get(id);
      return !!(coil && coil.poweredUntil > this.time);
    }

    gravityPulse(cx, cy, radius = 76) {
      let count = 0;
      for (const e of this.entities) {
        if (e.dead || !e.gravitable) continue;
        const ex = e.centerX ? e.centerX() : e.x + (e.w || 12) / 2;
        const ey = e.centerY ? e.centerY() : e.y + (e.h || 12) / 2;
        if (U.dist(cx, cy, ex, ey) > radius) continue;
        if (e.flipGravity) { e.flipGravity(); count++; }
      }
      PB.Audio.sfx('pulse');
      if (this.game) this.game.shake(3.5, 0.3);
      Events.emit('gravity:pulse', { x: cx, y: cy, count });
      return count;
    }

    detonate(barrel) {
      if (!barrel || barrel.dead || barrel.exploded) return;
      barrel.exploded = true;
      const cx = barrel.x + barrel.w / 2, cy = barrel.y + barrel.h / 2;
      barrel.dead = true;
      PB.Audio.sfx('barrel');
      if (this.game) this.game.shake(5, 0.35);
      this.spawnExplosion(cx, cy);
      Events.emit('barrel:explode', { x: cx, y: cy });
      // 破坏裂缝、伤害敌人、连锁
      for (let ty = Math.floor((cy - 56) / T); ty <= Math.floor((cy + 56) / T); ty++) {
        for (let tx = Math.floor((cx - 56) / T); tx <= Math.floor((cx + 56) / T); tx++) {
          if (this.tileAt(tx, ty) === 'c') this.setTile(tx, ty, '.');
        }
      }
      for (const e of this.entities) {
        if (e === barrel || e.dead) continue;
        const ex = e.centerX ? e.centerX() : e.x + (e.w || 12) / 2;
        const ey = e.centerY ? e.centerY() : e.y + (e.h || 12) / 2;
        const d = U.dist(cx, cy, ex, ey);
        if (d < 62) {
          if (e.type === 'barrel') {
            const delay = 0.08 + Math.min(0.08, d * 0.0012);
            e.fuse = e.fuse > 0 ? Math.min(e.fuse, delay) : delay;
          } else if (e.hurt && e.type !== 'lantern') {
            e.hurt(1, cx < ex ? 1 : -1, 'explosion');
          } else if (e.type === 'crate' && e.knock) {
            e.knock(cx < ex ? 1 : -1, -2);
          }
        }
      }
      if (this.player && this.player.alive) {
        const px = this.player.x + this.player.w / 2, py = this.player.y + this.player.h / 2;
        if (U.dist(cx, cy, px, py) < 45) this.player.damage(1, cx < px ? 1 : -1, 'explosion');
      }
      // 冲击粒子上抛
      if (PB.Gfx) PB.Gfx.particles.emitBurst(cx, cy, 'fire', 26);
    }

    spawnExplosion(x, y) {
      if (!PB.Gfx) return;
      PB.Gfx.particles.explosion(x, y);
    }

    spawnShardsAt(x, y, n = 3) {
      for (let i = 0; i < n; i++) {
        const ent = PB.Ents.create(this, 'shard', 0, 0, []);
        if (!ent) continue;
        ent.x = x + U.rand(-6, 6);
        ent.y = y + U.rand(-8, 4);
        ent.vx = U.rand(-2.4, 2.4);
        ent.vy = U.rand(-4.2, -1.6);
        ent.fromBreak = true;
        this.addEntity(ent);
      }
    }

    applySteam(body) {
      const tiles = this.tilesInRect(body.x, body.y, body.w, body.h);
      let inside = false;
      for (const { tx, ty } of tiles) {
        if (this.isSteam(tx, ty)) { inside = true; break; }
      }
      if (!inside) return false;
      const grav = body.grav || 1;
      body.vy = U.approach(body.vy, -3.5 * grav, 0.85);
      body.inSteam = true;
      if (!body._steamSfx || this.time - body._steamSfx > 0.35) {
        body._steamSfx = this.time;
        PB.Audio.sfx('steam', { vol: 0.4 });
      }
      if (PB.Gfx && Math.random() < 0.35) {
        PB.Gfx.particles.steam(body.x + U.rand(0, body.w), body.y + U.rand(0, body.h), -grav);
      }
      return true;
    }

    // ------------------------------------------------------------- update
    update(dt, player) {
      this.time += dt;
      this.player = player;
      // 移动平台优先，并携带玩家
      for (const e of this.entities) {
        if (e.type === 'movingPlatform' && !e.dead) e.update(dt, this, this.game, player);
      }
      for (const e of this.entities) {
        if (e.dead) continue;
        if (e.type === 'movingPlatform') continue;
        if (e.update) e.update(dt, this, this.game);
      }
      // 清理
      this.entities = this.entities.filter((e) => !e.dead);
      // 冻结与蒸汽、燃烧计时
      for (const [k, f] of this.frozen) {
        if (this.time >= f.until) {
          this.frozen.delete(k);
          if (PB.Gfx) PB.Gfx.particles.iceShatter(f.tx * T + 8, f.ty * T + 8);
        }
      }
      for (const [k, s] of this.steam) {
        if (this.time >= s.until) this.steam.delete(k);
      }
      for (const [k, b] of this.burning) {
        if (this.time >= b.until) {
          if (this.tileAt(b.tx, b.ty) === '%') this.setTile(b.tx, b.ty, '.');
          this.burning.delete(k);
          if (PB.Gfx) PB.Gfx.particles.smoke(b.tx * T + 8, b.ty * T + 8);
        }
      }
    }

    // 供实体寻找最近目标
    nearestSolidGround(x, y) {
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      for (let dy = 0; dy < 8; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (this.isSolidTile(tx + dx, ty + dy)) return { tx: tx + dx, ty: ty + dy };
        }
      }
      return null;
    }

    forEachTile(cb) {
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const ch = this.tiles[y][x];
          if (ch !== '.') cb(x, y, ch);
        }
      }
    }
  }

  PB.World = World;
})();
