/* ============================================================
   boss.js — 三阶段终局 Boss「棱镜守望者」
   阶段 1：烈焰护盾 → 霜华脉冲破盾
   阶段 2：重力护甲 → 重力脉冲破盾
   阶段 3：星隙偏转 → 折跃/子弹时间弹反
   能量弹可在踩踏/冲刺时弹反，子弹时间让时机更从容。
   ============================================================ */
(function () {
  'use strict';
  const PB = window.PB;
  const { C, U, Events } = PB;
  const TAU = Math.PI * 2;

  const PHASES = [
    { color: '#ffb454', glow: '#ff6a3d', form: 'cryo', hintZh: '霜华脉冲', hintEn: 'CRYO PULSE', inputZh: '2 → J', cd: 2.35 },
    { color: '#b48cff', glow: '#6d4bd6', form: 'grav', hintZh: '重力脉冲', hintEn: 'GRAVITY PULSE', inputZh: '3 → ↓ + J', cd: 2.05 },
    { color: '#f49cff', glow: '#8a5bff', form: 'warp', hintZh: '星隙折跃', hintEn: 'WARP', inputZh: '4 → J → J', cd: 1.85 },
  ];

  class Boss {
    constructor(game, id, arena) {
      this.game = game;
      this.world = game.world;
      this.id = id || 'boss';
      this.arena = arena || {
        x: U.clamp(this.world.pixelW / 2 - C.W / 2, 0, Math.max(0, this.world.pixelW - C.W)),
        y: 0, w: C.W, h: this.world.pixelH,
      };
      this.nameZh = C.BOSS_NAME;
      this.nameEn = C.BOSS_NAME_EN;
      this.maxHp = 9;
      this.hp = 9;
      this.phase = 1;
      this.requiredForm = PHASES[0].form;
      this.shielded = true;
      this.vulnerable = false;
      this.hitCd = 0;
      this.vulnT = 0;
      this.attackT = 1.9;
      this.transitionT = 0;
      this.introT = 2.2;
      this.dead = false;
      this.deathT = 0;
      this.t = 0;
      this.flash = 0;
      this.anchorX = this.arena.x + this.arena.w / 2;
      this.baseY = this.arena.y + 178;
      this.x = this.anchorX;
      this.y = this.baseY;
      this.w = 66;
      this.h = 72;
      this.layer = 3;
      this.orbit = 0;
      this.telegraph = 0;
      this.telegraphKind = null;
      this.lastOrbTime = 0;
    }

    arenaCenter() { return { x: this.arena.x + this.arena.w / 2, y: this.arena.y + this.arena.h / 2 }; }
    centerX() { return this.x; }
    centerY() { return this.y; }
    coreRect() { return { x: this.x - 22, y: this.y - 22, w: 44, h: 44 }; }
    hitRect() { return { x: this.x - 38, y: this.y - 44, w: 76, h: 90 }; }
    phaseData() { return PHASES[this.phase - 1] || PHASES[0]; }

    update(dt, game) {
      this.t += dt;
      this.orbit += dt * (0.8 + this.phase * 0.25);
      this.flash = Math.max(0, this.flash - dt);
      this.hitCd = Math.max(0, this.hitCd - dt);
      if (this.dead) {
        this.deathT += dt;
        if (this.deathT > 1.5 && !this._ending) {
          this._ending = true;
          this.game.bossDefeated();
        }
        return;
      }
      // 入场
      if (this.introT > 0) {
        this.introT -= dt;
        this.y = U.lerp(this.arena.y + 190, this.baseY, U.clamp(1 - this.introT / 2.2, 0, 1));
        if (this.introT <= 0) {
          this.attackT = 1.0;
          this.game.toast('守望者苏醒', 'THE WARDEN AWAKENS', 'boss');
        }
        return;
      }
      // 阶段过渡
      if (this.transitionT > 0) {
        this.transitionT -= dt;
        this.x = this.anchorX + Math.sin(this.t * 18) * 5;
        this.y = this.baseY + Math.cos(this.t * 15) * 5;
        if (this.transitionT <= 0) {
          this.shielded = true;
          this.vulnerable = false;
          this.attackT = 1.1;
          if (PB.Gfx) PB.Gfx.particles.sparkleRing(this.x, this.y, this.phaseData().color);
        }
        return;
      }
      // 浮游轨迹
      const targetX = this.anchorX + Math.sin(this.t * 0.55) * 76;
      this.x = U.damp(this.x, targetX, 2.6, dt);
      this.y = this.baseY + Math.sin(this.t * 1.1) * 16;
      if (this.telegraph > 0) this.telegraph -= dt;

      // 护盾/暴露
      if (this.vulnerable) {
        this.vulnT -= dt;
        if (this.vulnT <= 0) this.shieldUp();
        if (PB.Gfx && Math.random() < 0.25) PB.Gfx.particles.sparkle(this.x + U.rand(-22, 22), this.y + U.rand(-22, 22), '#fff2c4');
      } else {
        this.attackT -= dt;
        if (this.attackT <= 0) {
          this.attack();
          this.attackT = this.phaseData().cd;
        }
      }

      // 玩家近战判定
      const p = game.player;
      if (p && p.alive) {
        const core = this.coreRect();
        const overlapping = U.rectsOverlap(core.x, core.y, core.w, core.h, p.x, p.y, p.w, p.h);
        if (overlapping) {
          const attacking = p.state === 'dash' || p.state === 'pound' ||
            (p.vy * (p.grav || 1) > 0.5 && p.y + p.h < this.y + 12);
          if (this.vulnerable && attacking && this.hitCd <= 0) {
            this.hurt(1, 'melee');
            p.vy = -7.2 * (p.grav || 1);
            p.refreshAir();
            if (p.state === 'dash') p.state = 'normal';
          } else if (!this.vulnerable && p.invuln <= 0) {
            p.damage(1, p.centerX() < this.x ? 1 : -1, 'boss');
          }
        }
      }

      // 敌方弹体清理（由各自的实体处理碰撞）
    }

    onFormPulse(form, x, y) {
      if (!this.shielded || this.dead || this.introT > 0) return;
      const d = U.dist(x, y, this.x, this.y);
      if (form === this.requiredForm && d < 178) {
        this.breakShield(form);
      }
    }

    onWarpNear(x, y) {
      if (this.dead) return;
      const d = U.dist(x, y, this.x, this.y);
      if (this.phase === 3 && this.shielded && d < 110) this.breakShield('warp');
      else if (this.vulnerable && d < 55 && this.hitCd <= 0) this.hurt(1, 'warp');
    }

    onWarpSwap() {
      if (this.dead) return;
      if (this.shielded) this.breakShield('warp');
      else if (this.hitCd <= 0) this.hurt(1, 'warp');
      this.game.shake(5, 0.4);
    }

    breakShield(source) {
      if (!this.shielded) return;
      this.shielded = false;
      this.vulnerable = true;
      this.vulnT = 4.3;
      this.hitCd = 0.18;
      this.telegraph = 0;
      this.clearHostileOrbs();
      PB.Audio.sfx('bossPhase', { vol: 0.7 });
      this.game.shake(4, 0.4);
      if (PB.Gfx) {
        PB.Gfx.particles.frostPulse(this.x, this.y, this.phaseData().color);
        PB.Gfx.particles.sparkleRing(this.x, this.y, this.phaseData().color);
      }
      Events.emit('boss:shieldBreak', { phase: this.phase, source });
      this.game.toast('核心暴露', 'CORE EXPOSED — STRIKE NOW', 'boss', 1.8);
    }

    shieldUp() {
      this.vulnerable = false;
      this.shielded = true;
      this.vulnT = 0;
      this.attackT = Math.max(this.attackT, 1.4);
      PB.Audio.sfx('bossPhase', { vol: 0.4 });
      if (PB.Gfx) PB.Gfx.particles.sparkleRing(this.x, this.y, this.phaseData().color);
    }

    hurt(n, source) {
      if (this.dead || !this.vulnerable || this.hitCd > 0) return;
      this.hp -= n;
      this.hitCd = 0.72;
      this.flash = 0.16;
      this.game.addHitstop(0.06);
      this.game.shake(5, 0.35);
      PB.Audio.sfx('bossHit');
      if (PB.Gfx) {
        PB.Gfx.particles.emitBurst(this.x, this.y, 'spark', 14);
        PB.Gfx.flashScreen('#fff2c4', 0.12);
      }
      Events.emit('boss:hit', { hp: this.hp, phase: this.phase, source });
      if (this.hp <= 0) {
        this.die();
        return;
      }
      const newPhase = this.hp > 6 ? 1 : this.hp > 3 ? 2 : 3;
      if (newPhase > this.phase) {
        this.phase = newPhase;
        this.requiredForm = this.phaseData().form;
        this.shielded = false;
        this.vulnerable = false;
        this.transitionT = 1.8;
        this.hitCd = 2.2;
        this.clearHostileOrbs();
        this.attackT = 2;
        this.anchorX = this.arena.x + this.arena.w / 2 + (newPhase === 3 ? 40 : 0);
        PB.Audio.sfx('bossPhase');
        this.game.shake(8, 0.9);
        if (PB.Gfx) {
          PB.Gfx.flashScreen(this.phaseData().color, 0.3);
          PB.Gfx.particles.gravityPulse(this.x, this.y, this.phaseData().color);
        }
        this.game.toast(`第 ${this.phase} 阶段 · ${this.phaseData().hintZh}`, `PHASE ${this.phase} · ${this.phaseData().hintEn}`, 'boss', 3.2);
        Events.emit('boss:phase', { phase: this.phase });
      }
    }

    die() {
      if (this.dead) return;
      this.dead = true;
      this.hp = 0;
      this.shielded = false;
      this.vulnerable = false;
      this.deathT = 0;
      this.clearHostileOrbs();
      PB.Audio.sfx('bossDie');
      this.game.shake(10, 1.2);
      if (PB.Gfx) {
        PB.Gfx.flashScreen('#fff2c4', 0.6);
        PB.Gfx.particles.explosion(this.x, this.y);
        for (let i = 0; i < 8; i++) PB.Gfx.particles.sparkleRing(this.x + U.rand(-30, 30), this.y + U.rand(-30, 30), ['#ffb454', '#6ee7ff', '#b48cff', '#f49cff'][i % 4]);
      }
      Events.emit('boss:dead', {});
    }

    clearHostileOrbs() {
      for (const e of this.world.entities) {
        if (e.type === 'bossOrb' && !e.friendly) e.dead = true;
      }
    }

    attack() {
      const p = this.game.player;
      if (!p) return;
      const px = p.centerX(), py = p.centerY();
      if (this.phase === 1) {
        // 三枚追踪余烬
        for (let i = -1; i <= 1; i++) {
          const ang = Math.atan2(py - this.y, px - this.x) + i * 0.24;
          this.spawnOrb(this.x, this.y + 12, Math.cos(ang) * 1.3, Math.sin(ang) * 1.3, {
            color: '#ffb454', homing: 0.02, life: 7, kind: 'ember', deflectable: true,
          });
        }
        PB.Audio.sfx('fireball', { vol: 0.7 });
      } else if (this.phase === 2) {
        // 天花板冰棱 + 两枚追踪紫弹
        for (let i = 0; i < 5; i++) {
          const x = this.arena.x + 60 + Math.random() * (this.arena.w - 120);
          this.spawnOrb(x, this.arena.y + 20, 0, 1.8, {
            color: '#b48cff', homing: 0, life: 6, kind: 'shard', deflectable: true, gravity: 0.03,
          });
          if (PB.Gfx) PB.Gfx.particles.sparkle(x, this.arena.y + 24, '#b48cff');
        }
        for (let i = 0; i < 2; i++) {
          const ang = Math.atan2(py - this.y, px - this.x) + (i ? 0.5 : -0.5);
          this.spawnOrb(this.x, this.y + 10, Math.cos(ang) * 1.25, Math.sin(ang) * 1.25, {
            color: '#b48cff', homing: 0.01, life: 7, kind: 'orb', deflectable: true,
          });
        }
        PB.Audio.sfx('pulse', { vol: 0.5 });
        this.game.shake(3, 0.25);
      } else {
        // 星隙爆发 + 短暂位移
        const n = 7;
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * TAU + this.t;
          this.spawnOrb(this.x, this.y, Math.cos(ang) * 1.5, Math.sin(ang) * 1.5, {
            color: '#f49cff', homing: 0.012, life: 8, kind: 'orb', deflectable: true,
          });
        }
        if (PB.Gfx) PB.Gfx.particles.warpBurst(this.x, this.y);
        PB.Audio.sfx('warp');
        // 瞬移
        const nx = this.arena.x + 90 + Math.random() * (this.arena.w - 180);
        PB.Gfx && PB.Gfx.particles.warpBurst(this.x, this.y);
        this.x = nx;
        this.y = this.baseY + Math.sin(this.t) * 12;
      }
      this.telegraph = 0;
    }

    spawnOrb(x, y, vx, vy, opt) {
      const orb = new BossOrb(this.world, x, y, Object.assign({ boss: this, game: this.game }, opt));
      this.world.addEntity(orb);
      return orb;
    }

    draw(ctx) {
      const pd = this.phaseData();
      const x = Math.round(this.x), y = Math.round(this.y);
      const introScale = this.introT > 0 ? U.clamp(1 - this.introT / 2.2, 0, 1) : 1;
      const dark = '#120c20';
      const mid = U.colorLerp(dark, pd.color, 0.28);
      const pale = U.colorLerp(pd.color, '#ffffff', 0.55);
      ctx.save();
      ctx.globalAlpha = introScale;
      // 光晕与地面投影
      ctx.globalAlpha = introScale * (0.12 + Math.sin(this.t * 2) * 0.02);
      ctx.fillStyle = pd.color;
      ctx.beginPath(); ctx.arc(x, y, 78, 0, TAU); ctx.fill();
      ctx.globalAlpha = introScale * 0.18;
      ctx.fillStyle = pd.glow;
      ctx.beginPath(); ctx.ellipse(x, y + 68, 34, 7, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = introScale;
      // 外圈符文
      ctx.strokeStyle = U.rgba(pd.color, 0.34);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 62, 0, TAU); ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = this.orbit * 0.45 + i * TAU / 8;
        const px = x + Math.cos(a) * 62;
        const py = y + Math.sin(a) * 62;
        ctx.globalAlpha = introScale * (0.55 + Math.sin(this.t * 3 + i) * 0.2);
        ctx.fillStyle = i % 2 ? pd.color : pale;
        ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
      }
      ctx.globalAlpha = introScale;
      // 背翼
      for (const s of [-1, 1]) {
        const fl = Math.sin(this.t * 1.3) * 4;
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(x + s * 22, y - 10);
        ctx.lineTo(x + s * (52 + fl), y - 34);
        ctx.lineTo(x + s * 62, y - 2);
        ctx.lineTo(x + s * 38, y + 26);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = U.rgba(pd.color, 0.5);
        ctx.stroke();
        ctx.fillStyle = U.rgba(pd.color, 0.18);
        ctx.beginPath();
        ctx.moveTo(x + s * 30, y - 6);
        ctx.lineTo(x + s * (50 + fl), y - 20);
        ctx.lineTo(x + s * 38, y + 4);
        ctx.closePath(); ctx.fill();
      }
      // 长袍/下摆
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(x - 26, y + 22);
      ctx.lineTo(x - 14, y + 66);
      ctx.lineTo(x, y + 54);
      ctx.lineTo(x + 16, y + 68);
      ctx.lineTo(x + 26, y + 22);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = U.rgba(pd.color, 0.35);
      ctx.stroke();
      // 肩甲
      for (const s of [-1, 1]) {
        ctx.fillStyle = mid;
        ctx.beginPath();
        ctx.moveTo(x + s * 18, y - 16);
        ctx.lineTo(x + s * 40, y - 8);
        ctx.lineTo(x + s * 32, y + 16);
        ctx.lineTo(x + s * 14, y + 8);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = U.rgba(pd.color, 0.6);
        ctx.stroke();
        ctx.fillStyle = pale;
        ctx.globalAlpha = introScale * 0.65;
        ctx.fillRect(x + s * 28 - 1, y - 4, 2, 2);
        ctx.globalAlpha = introScale;
      }
      // 躯干
      ctx.fillStyle = mid;
      ctx.beginPath();
      ctx.moveTo(x - 24, y - 10);
      ctx.lineTo(x, y - 22);
      ctx.lineTo(x + 24, y - 10);
      ctx.lineTo(x + 18, y + 24);
      ctx.lineTo(x, y + 34);
      ctx.lineTo(x - 18, y + 24);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = pd.color;
      ctx.lineWidth = 1;
      ctx.stroke();
      // 胸甲刻纹
      ctx.fillStyle = U.rgba(pd.color, 0.75);
      ctx.fillRect(x - 10, y + 4, 20, 2);
      ctx.fillRect(x - 7, y + 9, 14, 1);
      ctx.fillStyle = U.rgba('#ffffff', 0.35);
      ctx.fillRect(x - 2, y - 18, 4, 9);
      // 头冠
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(x - 16, y - 30);
      ctx.lineTo(x, y - 44);
      ctx.lineTo(x + 16, y - 30);
      ctx.lineTo(x + 12, y - 12);
      ctx.lineTo(x - 12, y - 12);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = U.rgba(pd.color, 0.5);
      ctx.stroke();
      // 金色三叉冠
      ctx.fillStyle = '#f2c46a';
      for (let i = -1; i <= 1; i++) {
        const cx = x + i * 11;
        ctx.beginPath();
        ctx.moveTo(cx - 3, y - 42);
        ctx.lineTo(cx, y - (i === 0 ? 60 : 53));
        ctx.lineTo(cx + 3, y - 42);
        ctx.closePath(); ctx.fill();
      }
      // 核心眼
      const eye = this.vulnerable ? 9 + Math.sin(this.t * 8) * 1.5 : 6;
      ctx.fillStyle = this.vulnerable ? pale : pd.color;
      ctx.beginPath(); ctx.ellipse(x, y - 6, eye, eye * 0.62, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(x, y - 6, 2.6, 5.2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 1, y - 9, 1, 2);
      // 环绕四枚小棱晶
      for (let i = 0; i < 4; i++) {
        const a = this.orbit + i * TAU / 4;
        const ox = x + Math.cos(a) * 50;
        const oy = y + Math.sin(a) * 36;
        ctx.globalAlpha = introScale * 0.9;
        ctx.fillStyle = ['#ffb454', '#6ee7ff', '#b48cff', '#f49cff'][i];
        ctx.beginPath();
        ctx.moveTo(Math.round(ox), Math.round(oy) - 6); ctx.lineTo(Math.round(ox) + 4, Math.round(oy));
        ctx.lineTo(Math.round(ox), Math.round(oy) + 6); ctx.lineTo(Math.round(ox) - 4, Math.round(oy));
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(ox) - 1, Math.round(oy) - 2, 1, 2);
      }
      ctx.globalAlpha = introScale;
      // 护盾：六枚环绕晶片 + 光弧
      if (this.shielded && !this.vulnerable) {
        ctx.globalAlpha = introScale * (0.5 + Math.sin(this.t * 4) * 0.12);
        ctx.strokeStyle = pd.color;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 56, 0, TAU); ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const a = this.orbit * 0.9 + i * TAU / 6;
          const px = x + Math.cos(a) * 56;
          const py = y + Math.sin(a) * 56;
          ctx.fillStyle = pd.color;
          ctx.beginPath();
          ctx.moveTo(px, py - 5); ctx.lineTo(px + 3, py);
          ctx.lineTo(px, py + 5); ctx.lineTo(px - 3, py);
          ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = introScale;
      }
      // 暴露核心的光
      if (this.vulnerable) {
        ctx.globalAlpha = introScale * (0.22 + Math.sin(this.t * 6) * 0.1);
        ctx.fillStyle = pale;
        ctx.beginPath(); ctx.arc(x, y - 6, 24, 0, TAU); ctx.fill();
        ctx.globalAlpha = introScale;
      }
      // 攻击蓄力
      if (this.telegraph > 0) {
        ctx.globalAlpha = introScale * 0.6;
        ctx.strokeStyle = pale;
        ctx.beginPath(); ctx.arc(x, y - 6, 14 + (1 - this.telegraph) * 18, 0, TAU); ctx.stroke();
        ctx.globalAlpha = introScale;
      }
      if (this.flash > 0) {
        ctx.globalAlpha = Math.min(1, this.flash * 4);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, 46, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }

    diamond(ctx, x, y, rx, ry, color) {
      ctx.beginPath();
      ctx.moveTo(x, y - ry); ctx.lineTo(x + rx, y); ctx.lineTo(x, y + ry); ctx.lineTo(x - rx, y);
      ctx.closePath(); ctx.fill();
    }
  }

  class BossOrb {
    constructor(world, x, y, opt = {}) {
      this.world = world;
      this.game = opt.game || world.game;
      this.boss = opt.boss;
      this.x = x; this.y = y;
      this.w = 10; this.h = 10;
      this.vx = opt.vx || 0;
      this.vy = opt.vy || 0;
      this.life = opt.life || 7;
      this.maxLife = this.life;
      this.t = 0;
      this.friendly = false;
      this.dead = false;
      this.type = 'bossOrb';
      this.layer = 5;
      this.color = opt.color || '#f49cff';
      this.homing = opt.homing || 0;
      this.gravity = opt.gravity || 0;
      this.kind = opt.kind || 'orb';
      this.deflectable = opt.deflectable !== false;
      this.solid = false;
      this.targetX = 0; this.targetY = 0;
    }
    centerX() { return this.x; }
    centerY() { return this.y; }
    rect() { return { x: this.x - 5, y: this.y - 5, w: 10, h: 10 }; }
    update(dt, world, game) {
      this.t += dt;
      this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }
      const p = game.player;
      if (!this.friendly) {
        if (this.homing && p && p.alive) {
          const dx = p.centerX() - this.x, dy = p.centerY() - this.y;
          const d = Math.max(1, Math.hypot(dx, dy));
          this.vx += (dx / d) * this.homing * 12;
          this.vy += (dy / d) * this.homing * 12;
          const sp = Math.hypot(this.vx, this.vy);
          const maxSp = this.kind === 'shard' ? 2.5 : 2.2;
          if (sp > maxSp) { this.vx = (this.vx / sp) * maxSp; this.vy = (this.vy / sp) * maxSp; }
        }
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        // 地形
        const tx = Math.floor(this.x / C.TILE), ty = Math.floor(this.y / C.TILE);
        if (world.isSolidTile(tx, ty)) {
          this.dead = true;
          if (PB.Gfx) PB.Gfx.particles.emitBurst(this.x, this.y, this.kind === 'shard' ? 'ice' : 'spark', 8);
          return;
        }
        // 玩家接触
        if (p && p.alive && U.rectsOverlap(this.x - 6, this.y - 6, 12, 12, p.x, p.y, p.w, p.h)) {
          const stomp = p.vy * (p.grav || 1) > 0.4 && p.y + p.h <= this.y + 8;
          const attack = p.state === 'dash' || p.state === 'pound' || stomp;
          if (this.deflectable && attack) {
            this.deflect(p);
          } else if (p.invuln <= 0) {
            p.damage(1, this.x < p.centerX() ? 1 : -1, 'bossOrb');
            this.dead = true;
            if (PB.Gfx) PB.Gfx.particles.emitBurst(this.x, this.y, 'spark', 8);
          }
        }
      } else {
        // 友方：飞向 Boss / 最近敌人
        let tx = null, ty = null;
        if (this.boss && !this.boss.dead) { tx = this.boss.x; ty = this.boss.y; }
        else {
          let best = null, bd = 9999;
          for (const e of world.entities) {
            if (e.dead || !(e instanceof PB.Ents.Enemy || e.type === 'turret')) continue;
            const d = U.dist(this.x, this.y, e.centerX(), e.centerY());
            if (d < bd) { bd = d; best = e; }
          }
          if (best) { tx = best.centerX(); ty = best.centerY(); }
        }
        if (tx != null) {
          const dx = tx - this.x, dy = ty - this.y;
          const d = Math.max(1, Math.hypot(dx, dy));
          this.vx = U.approach(this.vx, (dx / d) * 8, 0.3);
          this.vy = U.approach(this.vy, (dy / d) * 8, 0.3);
        }
        this.x += this.vx;
        this.y += this.vy;
        if (this.boss && !this.boss.dead && U.dist(this.x, this.y, this.boss.x, this.boss.y) < 44) {
          if (this.boss.shielded) this.boss.breakShield('orb');
          else this.boss.hurt(1, 'orb');
          this.dead = true;
          if (PB.Gfx) PB.Gfx.particles.explosion(this.x, this.y);
          PB.Audio.sfx('bossHit');
        } else {
          for (const e of world.entities) {
            if (e.dead || !(e instanceof PB.Ents.Enemy || e.type === 'turret')) continue;
            if (U.rectsOverlap(this.x - 5, this.y - 5, 10, 10, e.x, e.y, e.w, e.h)) {
              e.hurt(1, Math.sign(this.vx) || 1, 'orb');
              this.dead = true;
              if (PB.Gfx) PB.Gfx.particles.sparkleRing(this.x, this.y, '#fff2c4');
              break;
            }
          }
        }
      }
      if (PB.Gfx) {
        if (Math.random() < 0.5) PB.Gfx.particles.emitBurst(this.x, this.y, this.friendly ? 'fire' : (this.kind === 'shard' ? 'ice' : 'spark'), 1);
      }
    }
    deflect(p) {
      this.friendly = true;
      this.life = Math.max(this.life, 3.5);
      this.color = '#fff2c4';
      const dx = (this.boss ? this.boss.x : p.centerX() + 100) - this.x;
      const dy = (this.boss ? this.boss.y : p.centerY()) - this.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      this.vx = (dx / d) * 9;
      this.vy = (dy / d) * 9;
      p.vy = -7.2 * (p.grav || 1);
      p.refreshAir();
      if (this.game) this.game.addHitstop(0.05);
      PB.Audio.sfx('deflect');
      if (PB.Gfx) PB.Gfx.particles.sparkleRing(this.x, this.y, '#fff2c4');
      Events.emit('orb:deflect', {
        x: this.x, y: this.y, slow: !!(p.slowActive), phase: this.boss ? this.boss.phase : 0,
      });
    }
    draw(ctx) {
      const x = Math.round(this.x), y = Math.round(this.y);
      const pulse = 0.7 + Math.sin(this.t * 10) * 0.3;
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = this.friendly ? '#fff2c4' : this.color;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      if (this.kind === 'shard') {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(x, y - 7); ctx.lineTo(x + 5, y + 1); ctx.lineTo(x, y + 7); ctx.lineTo(x - 5, y + 1);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e9dcff';
        ctx.fillRect(x - 1, y - 4, 1, 4);
      } else {
        ctx.fillStyle = this.friendly ? '#fff2c4' : this.color;
        ctx.fillRect(x - 4, y - 4, 8, 8);
        ctx.fillRect(x - 3, y - 5, 6, 10);
        ctx.fillRect(x - 5, y - 3, 10, 6);
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        ctx.fillRect(x - 2, y - 2, 2, 2);
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = 0.5 * pulse;
        ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }
  }

  PB.Boss = Boss;
  PB.BossOrb = BossOrb;
})();
