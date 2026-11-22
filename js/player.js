/* ============================================================
   player.js — 露米 / LUMI
   进阶平台手感 + 四棱镜形态 + 回响分身 + 子弹时间 + 三种载具
   ============================================================ */
(function () {
  'use strict';
  const PB = window.PB;
  const { C, U, Events, Input } = PB;
  const T = C.TILE;
  const TAU = Math.PI * 2;

  const RUN_ANIM = ['run0', 'run1', 'run2', 'run3', 'run4', 'run5'];

  class Player {
    constructor(world, x, y, game) {
      this.world = world;
      this.game = game;
      this.x = x; this.y = y;
      this.w = C.P_W; this.h = C.P_H;
      this.vx = 0; this.vy = 0;
      this.grav = 1;
      this.facing = 1;
      this.state = 'normal';
      this.alive = true;
      this.t = 0;

      this.onGround = false;
      this.wasGround = false;
      this.groundEntity = null;
      this.groundTile = null;
      this.groundOneWay = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.jumpHeld = false;
      this.jumpCut = false;
      this.airJumps = 1;
      this.airDash = 1;
      this.dashTime = 0;
      this.dashCd = 0;
      this.dashDirX = 1;
      this.dashDirY = 0;
      this.controlLock = 0;
      this.slideTime = 0;
      this.slideDir = 1;
      this.waveTime = 0;
      this.springCd = 0;
      this.dropThrough = 0;
      this.spinT = 0;
      this.spinDir = 1;
      this.wallDir = 0;
      this.wallSliding = false;
      this.inSteam = false;

      this.maxHearts = C.HEARTS + (Object.keys(PB.Save.data.grand || {}).filter((k) => PB.Save.data.grand[k]).length >= 12 ? 1 : 0);
      this.hearts = this.maxHearts;
      this.invuln = 0;
      this.flash = 0;
      this.deadT = 0;
      this.deathReason = null;

      this.forms = Object.assign({}, PB.Save.data.forms);
      this.arts = Object.assign({}, PB.Save.data.arts);
      this.currentForm = this.firstUnlockedForm();

      this.skillCd = 0;
      this.skillCdMax = 0;
      this.summonedBlock = null;
      this.warpThrowLock = 0;
      this.teleportLock = 0;

      this.echoState = 'idle';
      this.echoTimer = 0;
      this.echoCooldown = 0;
      this.echoSamples = [];
      this.echoEvents = [];
      this.echoSampleTick = 0;

      this.slowMeter = C.BULLET_MAX;
      this.slowActive = false;
      this.slowCd = 0;
      this.slowWasDown = false;

      this.vehicle = null;
      this.mountEntity = null;
      this.mountCooldown = 0;
      this.vehicleHp = 0;
      this.cartSpeed = 0;
      this.gliderBoost = 0;

      this.ghosts = [];
      this.dustT = 0;
      this.animT = 0;
      this.animName = 'idle';
      this.faceLock = 0;

      this.stats = { stomps: 0, wallJumps: 0, dashes: 0, doubles: 0 };
      this.timeSinceGround = 0;

      world.player = this;
      this.emitAura();
    }

    firstUnlockedForm() {
      for (const f of PB.FORMS) if (this.forms[f.id]) return f.id;
      return 'base';
    }
    form() { return PB.FORM_BY_ID[this.currentForm] || null; }
    unlocked(id) { return !!this.forms[id]; }

    onFormUnlocked(id) {
      this.forms[id] = true;
      if (this.currentForm === 'base' || !this.currentForm) this.currentForm = id;
      this.emitFormBurst();
    }
    onArtUnlocked(id) {
      this.arts[id] = true;
      if (id === 'chrono') this.slowMeter = C.BULLET_MAX;
    }

    setForm(id, silent = false) {
      if (!this.forms[id]) {
        if (!silent && this.game) this.game.toast('尚未唤醒 / SEALED', '这支棱镜还在沉睡。', 'info');
        return false;
      }
      if (this.currentForm === id) return false;
      this.currentForm = id;
      this.emitFormBurst();
      PB.Audio.sfx('form');
      if (!silent) Events.emit('form:switch', { form: id });
      return true;
    }

    switchNextForm() {
      const avail = PB.FORMS.filter((f) => this.forms[f.id]);
      if (!avail.length) return;
      let i = avail.findIndex((f) => f.id === this.currentForm);
      i = (i + 1) % avail.length;
      this.setForm(avail[i].id);
    }

    emitFormBurst() {
      const f = this.form();
      const color = f ? f.color : '#7ef0e0';
      if (PB.Gfx) PB.Gfx.particles.sparkleRing(this.centerX(), this.centerY(), color);
    }
    emitAura() {
      if (!PB.Gfx) return;
      const f = this.form();
      if (!f) return;
      const color = f.color;
      switch (f.id) {
        case 'solar': PB.Gfx.particles.ember(this.centerX() + U.rand(-5, 5), this.centerY() + U.rand(-8, 8), 0.2); break;
        case 'cryo': PB.Gfx.particles.snowflake(this.centerX() + U.rand(-6, 6), this.centerY() + U.rand(-8, 8)); break;
        case 'grav': PB.Gfx.particles.gravityRune(this.centerX() + U.rand(-6, 6), this.centerY() + U.rand(-8, 8)); break;
        case 'warp': PB.Gfx.particles.warp(this.centerX() + U.rand(-6, 6), this.centerY() + U.rand(-8, 8)); break;
        default: break;
      }
    }

    centerX() { return this.x + this.w / 2; }
    centerY() { return this.y + this.h / 2; }
    feetY() { return this.grav > 0 ? this.y + this.h : this.y; }

    // ------------------------------------------------------------- update
    update(dt, world, game) {
      this.world = world;
      this.game = game;
      this.t += dt;
      if (!this.alive) {
        this.deadT += dt;
        this.y += this.vy * 0.5;
        this.vy += 0.2;
        return;
      }
      this.animT += dt;
      this.invuln = Math.max(0, this.invuln - dt);
      this.flash = Math.max(0, this.flash - dt);
      this.mountCooldown = Math.max(0, this.mountCooldown - dt);
      this.dashCd = Math.max(0, this.dashCd - 1);
      this.skillCd = Math.max(0, this.skillCd - dt);
      this.springCd = Math.max(0, this.springCd - 1);
      this.warpThrowLock = Math.max(0, this.warpThrowLock - dt);
      this.teleportLock = Math.max(0, this.teleportLock - dt);
      this.controlLock = Math.max(0, this.controlLock - 1);
      this.dropThrough = Math.max(0, this.dropThrough - 1);
      this.waveTime = Math.max(0, this.waveTime - 1);
      this.spinT = Math.max(0, this.spinT - dt);
      this.faceLock = Math.max(0, this.faceLock - 1);
      this.echoCooldown = Math.max(0, this.echoCooldown - dt);
      if (this.echoState === 'cool' && this.echoCooldown <= 0) this.echoState = 'idle';

      this.updateBulletTime(dt);
      this.updateEcho(dt);
      this.handleFormInput();

      if (this.echoState === 'recording') this.recordSample(dt);

      if (this.vehicle) {
        this.updateVehicle(dt, world, game);
      } else {
        this.updateOnFoot(dt, world, game);
      }

      this.updateGhosts(dt);
      this.checkEchoHeadBounce();
      this.updateHazards(world);
      // 世界边界
      if (world) {
        this.x = U.clamp(this.x, 0, Math.max(0, world.pixelW - this.w));
        if (this.y < 2) { this.y = 2; if (this.vy < 0) this.vy = 0; }
      }
      // 环境粒子
      if (Math.random() < 0.18) this.emitAura();
      if (this.slowActive && Math.random() < 0.3 && PB.Gfx) {
        PB.Gfx.particles.clockGlyph(this.centerX() + U.rand(-14, 14), this.centerY() + U.rand(-14, 14));
      }
    }

    // ------------------------------------------------------------- common input
    handleFormInput() {
      if (this.vehicle) return;
      if (Input.consume('form1')) this.setForm('solar');
      if (Input.consume('form2')) this.setForm('cryo');
      if (Input.consume('form3')) this.setForm('grav');
      if (Input.consume('form4')) this.setForm('warp');
      if (Input.consume('cycle')) this.switchNextForm();
      if (Input.consume('echo')) this.onEchoPressed();
      if (Input.consume('skill')) this.useSkill(Input.isDown('down'));
    }

    updateBulletTime(dt) {
      const want = this.arts.chrono && Input.isDown('slow');
      if (want && !this.slowActive && this.slowMeter > 0.5 && this.slowCd <= 0) {
        this.slowActive = true;
        PB.Audio.sfx('bulletIn');
        if (this.game) this.game.onBulletTime(true);
      }
      if (this.slowActive) {
        // 以真实时间计费：子弹时间中的物理步更少，按比例补回
        this.slowMeter -= C.BULLET_DRAIN * dt / C.BULLET_SCALE;
        if (!want || this.slowMeter <= 0) {
          this.slowActive = false;
          this.slowCd = 0.35;
          PB.Audio.sfx('bulletOut');
          if (this.game) this.game.onBulletTime(false);
        }
      } else {
        this.slowCd = Math.max(0, this.slowCd - dt);
        if (!want) this.slowMeter = Math.min(C.BULLET_MAX, this.slowMeter + C.BULLET_REGEN * dt);
      }
      // 音序器/滤镜由 Game 根据 slowActive 设置
    }

    // ------------------------------------------------------------- on foot
    updateOnFoot(dt, world, game) {
      const grav = this.grav;
      const wasGround = this.onGround;
      this.wasGround = wasGround;
      this.inSteam = world.applySteam(this);

      // 输入
      const ax = Input.axisX();
      const down = Input.isDown('down');
      const jumpDown = Input.isDown('jump');
      if (Input.consume('jump')) {
        this.jumpBuffer = C.JUMP_BUFFER;
        if (this.onGround && this.groundOneWay && down) {
          this.dropThrough = 10;
          this.onGround = false;
          this.jumpBuffer = 0;
          this.y += 1;
        }
      }
      if (this.jumpBuffer > 0) this.jumpBuffer--;
      if (!jumpDown && this.jumpHeld && this.vy * grav < 0 && !this.jumpCut) {
        this.vy *= C.JUMP_CUT;
        this.jumpCut = true;
      }
      this.jumpHeld = jumpDown;

      if (this.state === 'dash') {
        this.updateDash(dt, world);
      } else if (this.state === 'pound') {
        this.updatePound(dt, world);
      } else if (this.state === 'slide') {
        this.updateSlide(dt, world, ax, down, jumpDown);
      } else if (this.onGround && this.dropThrough <= 0 && down && Math.abs(this.vx) > 1.1 && this.controlLock === 0) {
        this.startSlide();
        this.updateSlide(dt, world, ax, down, jumpDown);
      } else {
        this.updateNormal(dt, world, ax, down, jumpDown);
      }

      this.postMove(world, game, wasGround, dt);
    }

    postMove(world, game, wasGround, dt) {
      // 头顶角落纠偏（仅正向重力向上撞天花板时；倒悬时这是落脚面，不能横向推）
      if (this.hitCeil && this.state !== 'pound' && this.grav > 0) {
        if (!world.headCornerFix(this)) {
          if (this.vy * this.grav < 0) this.vy = 0;
        }
      }

      // 落地/离地
      const probe = world.groundProbe(this);
      const oneWayBlocked = this.dropThrough > 0 && probe.oneWay;
      const grounded = probe.solid && !oneWayBlocked && this.vy * this.grav >= -0.8;
      this.onGround = !!grounded;
      const justLanded = !wasGround && this.onGround;
      if (this.onGround) {
        this.groundEntity = probe.entity || null;
        this.groundOneWay = !!probe.oneWay;
        this.groundTile = probe.tx != null ? { tx: probe.tx, ty: probe.ty } : null;
        this.coyote = C.COYOTE;
        this.timeSinceGround = 0;
        this.airJumps = Math.max(this.airJumps, 1);
        this.airDash = Math.max(this.airDash, 1);
        this.jumpCut = false;
        if (justLanded) this.onLand();
      } else {
        this.coyote = Math.max(0, this.coyote - 1);
        this.timeSinceGround += dt;
        this.groundEntity = null;
        this.groundOneWay = false;
        this.groundTile = null;
      }

      // 弹簧：只在真正落上的一瞬触发
      if (justLanded && this.springCd <= 0) {
        const sp = world.springUnder(this);
        if (sp) this.triggerSpring(sp, false);
      }

      // 实体交互（踩踏/踢冰/点燃）
      this.interactEntities(world, game);

      // 冻结地形 / 蒸汽事件（连携追踪用）
      if (this.onGround && this.groundTile) {
        const k = this.world.key(this.groundTile.tx, this.groundTile.ty);
        const f = this.world.frozen.get(k);
        if (f && f.kind === 'frost') {
          if (this._lastFrostTile !== k) {
            this._lastFrostTile = k;
            Events.emit('frost:step', { tx: this.groundTile.tx, ty: this.groundTile.ty });
          }
        } else {
          this._lastFrostTile = null;
        }
        if (f && f.kind === 'obsidian' && this._lastObsidianTile !== k) {
          this._lastObsidianTile = k;
          Events.emit('obsidian:stand', { tx: this.groundTile.tx, ty: this.groundTile.ty });
        }
      }
      let steamNow = false;
      for (const t of this.world.tilesInRect(this.x, this.y, this.w, this.h)) {
        if (this.world.isSteam(t.tx, t.ty)) { steamNow = true; break; }
      }
      if (steamNow && !this._steamActive) {
        this._steamActive = true;
        this._steamStartY = this.y;
        Events.emit('steam:enter', { y: this.y });
      } else if (!steamNow && this._steamActive) {
        this._steamActive = false;
        Events.emit('steam:exit', { rise: this._steamStartY - this.y });
      }

      // 跑步扬尘
      if (this.onGround && Math.abs(this.vx) > 1.1 && this.state === 'normal' && this.dustT <= 0) {
        this.dustT = 0.12;
        if (PB.Gfx) PB.Gfx.particles.dust(this.x + this.w / 2, this.feetY(), -Math.sign(this.vx));
      }
      this.dustT -= dt;
    }

    updateNormal(dt, world, ax, down, jumpDown) {
      const grav = this.grav;
      // 水平
      const accel = this.onGround ? C.RUN_ACC : C.AIR_ACC;
      if (this.controlLock > 0) ax = 0;
      const target = ax * C.RUN_MAX;
      if (ax !== 0) {
        const mult = Math.sign(this.vx) !== 0 && Math.sign(this.vx) !== ax ? C.TURN_MULT : 1;
        this.vx = U.approach(this.vx, target, accel * mult);
        if (this.faceLock <= 0) this.facing = ax;
      } else {
        const fr = this.onGround ? C.GROUND_FRICTION : C.AIR_FRICTION;
        this.vx = U.approach(this.vx, 0, fr);
      }

      // 墙壁状态要在跳跃判定之前更新，才能蹬墙
      this.updateWallState();

      // 跳跃
      if (this.dropThrough <= 0 && this.jumpBuffer > 0) {
        if (this.onGround || this.coyote > 0) {
          this.doJump();
        } else if (this.wallSliding) {
          this.doWallJump();
        } else if (this.airJumps > 0) {
          this.doDoubleJump();
        }
      }

      // 空中冲刺 / 砸地
      if (Input.consume('dash')) {
        this.tryDashOrPound(down, ax);
        if (this.state !== 'normal') return;
      }

      // 重力
      if (!this.inSteam) {
        const g = this.vy * grav > 0 ? C.GRAV_DOWN : C.GRAV_UP;
        const apex = Math.abs(this.vy) < C.APEX_WINDOW ? C.GRAV_APEX : 1;
        const wave = this.waveTime > 0 ? 0.76 : 1;
        this.vy += g * apex * wave * grav;
        this.vy = U.clamp(this.vy, -C.MAX_FALL, C.MAX_FALL);
      }

      // 墙滑限速
      if (this.wallSliding) {
        if (grav > 0) this.vy = Math.min(this.vy, C.WALL_SLIDE_MAX);
        else this.vy = Math.max(this.vy, -C.WALL_SLIDE_MAX);
      }

      this.moveAndCollide(world);
    }

    doJump() {
      this.vy = -C.JUMP_V * this.grav;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.jumpCut = false;
      this.jumpHeld = true;
      this.airJumps = 1;
      this.airDash = 1;
      this.refreshAir();
      PB.Audio.sfx('jump');
      if (PB.Gfx) PB.Gfx.particles.dust(this.centerX(), this.feetY(), 0);
      Events.emit('player:jump', { x: this.centerX(), y: this.centerY() });
      if (this.game) this.game.stats.jumps++;
    }

    doDoubleJump() {
      this.vy = -C.DOUBLE_JUMP_V * this.grav;
      this.airJumps = 0;
      this.spinT = 0.42;
      this.spinDir = this.facing;
      this.jumpBuffer = 0;
      this.jumpCut = false;
      PB.Audio.sfx('doubleJump');
      if (PB.Gfx) {
        PB.Gfx.particles.sparkleRing(this.centerX(), this.centerY(), PAL_ACCENT(this));
        PB.Gfx.particles.emitBurst(this.centerX(), this.centerY() + 6, 'spark', 5);
      }
      this.stats.doubles++;
      Events.emit('player:doubleJump', { x: this.centerX(), y: this.centerY(), form: this.currentForm });
      if (this.game) this.game.stats.jumps++;
    }

    doWallJump() {
      const dir = this.wallDir || (this.facing > 0 ? 1 : -1);
      const probe = this.world.wallProbe(this, dir);
      if (probe.entity && probe.entity.type === 'iceblock' && probe.entity.summoned) {
        Events.emit('ice:cradle', { x: this.centerX(), y: this.centerY() });
      }
      this.vx = -dir * C.WALL_JUMP_X;
      this.vy = -C.WALL_JUMP_Y * this.grav;
      this.facing = -dir;
      this.controlLock = C.WALL_LOCK;
      this.faceLock = C.WALL_LOCK;
      this.wallSliding = false;
      this.jumpBuffer = 0;
      this.refreshAir();
      this.jumpCut = false;
      PB.Audio.sfx('wallJump');
      if (PB.Gfx) {
        PB.Gfx.particles.dust(this.x + (dir > 0 ? this.w : 0), this.centerY(), -dir);
        PB.Gfx.particles.sparkle(this.centerX(), this.centerY(), PAL_ACCENT(this));
      }
      this.stats.wallJumps++;
      Events.emit('player:wallJump', {
        x: this.centerX(), y: this.centerY(), dir, wallSide: dir,
        streak: this.stats.wallJumps,
      });
    }

    refreshAir() {
      this.airJumps = 1;
      this.airDash = 1;
      this.dashCd = 0;
      this.jumpCut = false;
    }

    updateWallState() {
      this.wallSliding = false;
      this.wallDir = 0;
      if (this.onGround) return;
      if (this.state === 'dash' || this.state === 'pound') return;
      const grav = this.grav;
      const falling = this.vy * grav > 0.35;
      if (!falling) return;
      const ax = Input.axisX();
      if (ax === 0) return;
      const probe = this.world.wallProbe(this, ax);
      if (probe.solid) {
        this.wallSliding = true;
        this.wallDir = ax;
        this.facing = -ax;
        this.faceLock = 2;
        if (Math.random() < 0.35 && PB.Gfx) {
          PB.Gfx.particles.dust(this.x + (ax > 0 ? this.w : 0), this.y + U.rand(4, this.h - 2), -ax);
        }
      }
    }

    tryDashOrPound(down, ax) {
      if (this.dashCd > 0) return;
      if (this.onGround) {
        // 地面冲刺
      } else if (this.airDash <= 0) return;
      const aim = Input.aimVector(this.facing);
      const norm = Math.hypot(aim.x, aim.y) || 1;
      let dx = aim.x / norm, dy = aim.y / norm;
      if (this.onGround && dy > 0.6 && Math.abs(dx) < 0.2) {
        dx = this.facing; dy = 0;
      }
      if (!this.onGround && down && ax === 0) {
        this.startPound();
        return;
      }
      this.startDash(dx, dy);
    }

    startDash(dx, dy) {
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) dx = this.facing;
      this.state = 'dash';
      this.dashTime = C.DASH_TIME;
      this.dashCd = C.DASH_CD + C.DASH_TIME;
      this.dashDirX = dx;
      this.dashDirY = dy;
      const len = Math.hypot(dx, dy) || 1;
      this.vx = (dx / len) * C.DASH_SPEED;
      this.vy = (dy / len) * C.DASH_SPEED;
      this.facing = dx !== 0 ? Math.sign(dx) : this.facing;
      if (!this.onGround) this.airDash--;
      this.jumpCut = true;
      PB.Audio.sfx('dash');
      this.stats.dashes++;
      if (this.game) this.game.stats.dashes++;
      if (PB.Gfx) {
        PB.Gfx.particles.emitBurst(this.centerX(), this.centerY(), 'dash', 7, Math.atan2(dy, dx));
      }
      Events.emit('player:dash', {
        x: this.centerX(), y: this.centerY(),
        dx, dy, angle: Math.atan2(dy, dx), form: this.currentForm, air: !this.onGround,
      });
      if (this.echoState === 'recording') this.recordEvent('dash', { dx, dy });
    }

    updateDash(dt, world) {
      this.dashTime--;
      // 冲刺伤害
      for (const e of world.entities) {
        if (e.dead) continue;
        if (e instanceof PB.Ents.Enemy) {
          if (e.frozen > 0) {
            if (U.rectsOverlap(this.x, this.y, this.w, this.h, e.x, e.y, e.w, e.h)) e.kick(this.dashDirX >= 0 ? 1 : -1);
          } else if (U.rectsOverlap(this.x, this.y, this.w, this.h, e.x, e.y, e.w, e.h)) {
            e.hurt(1, this.dashDirX >= 0 ? 1 : -1, 'dash');
            if (this.game) this.game.addHitstop(0.035);
          }
        } else if (e.type === 'iceblock' && U.rectsOverlap(this.x, this.y, this.w, this.h, e.x, e.y, e.w, e.h)) {
          e.kick(this.dashDirX >= 0 ? 1 : -1);
        } else if (e.type === 'fossil' && U.rectsOverlap(this.x, this.y, this.w, this.h, e.x, e.y, e.w, e.h)) {
          e.shatter();
        } else if (e.type === 'barrel' && U.rectsOverlap(this.x, this.y, this.w, this.h, e.x, e.y, e.w, e.h)) {
          e.ignite(0.16);
        }
      }
      if (this.dashTime % 2 === 0) {
        this.ghosts.push({ x: this.x, y: this.y, facing: this.facing, form: this.currentForm, anim: 'dash', life: 0.22 });
      }
      // 冲刺位移
      this.moveAndCollide(world);
      if (this.hitWall) this.refreshAir();
      if (this.dashTime <= 0 || this.hitWall) {
        this.state = 'normal';
        this.vx *= C.DASH_END_MULT;
        this.vy *= C.DASH_END_MULT;
      }
    }

    startPound() {
      this.state = 'pound';
      this.poundT = 0;
      this.vx = 0;
      this.vy = C.POUND_SPEED * this.grav;
      this.jumpCut = true;
      PB.Audio.sfx('poundCharge', { vol: 0.6 });
      Events.emit('player:poundStart', { x: this.centerX(), y: this.centerY() });
      if (this.echoState === 'recording') this.recordEvent('pound', {});
    }

    updatePound(dt, world) {
      this.poundT = (this.poundT || 0) + 1;
      // 穿过敌人时造成伤害
      for (const e of world.entities) {
        if (e.dead || !(e instanceof PB.Ents.Enemy)) continue;
        if (U.rectsOverlap(this.x, this.y, this.w, this.h, e.x, e.y, e.w, e.h)) {
          e.hurt(2, this.facing, 'pound');
        }
      }
      this.moveAndCollide(world);
      const probe = world.groundProbe(this);
      // 倒悬时向上的“天花板”实际是落脚面，同样触发砸地
      const landed = this.grav > 0 ? (this.onGround || probe.solid) : this.hitCeil;
      this.hitGround = landed;
      if (landed) { this.poundImpact(world); return; }
      // 极端情况：在无天花板的露天区域倒悬砸地，不能永远锁在 pound
      if (this.poundT > 100 || (this.grav < 0 && this.y <= 2)) {
        this.state = 'normal';
        this.vy = 0;
        this.hitGround = false;
      }
    }

    poundImpact(world) {
      this.state = 'normal';
      this.onGround = true;
      this.vy = 0;
      this.groundOneWay = false;
      PB.Audio.sfx('pound');
      if (this.game) {
        this.game.shake(6, 0.32);
        this.game.addHitstop(0.055);
      }
      if (PB.Gfx) {
        PB.Gfx.particles.poundWave(this.centerX(), this.feetY() + (this.grav > 0 ? 2 : -2), PAL_ACCENT(this));
        PB.Gfx.particles.emitBurst(this.centerX(), this.feetY(), 'dust', 16);
      }
      const cx = this.centerX(), cy = this.centerY();
      for (const e of world.entities) {
        if (e.dead) continue;
        if (e instanceof PB.Ents.Enemy) {
          if (U.dist(cx, cy, e.centerX(), e.centerY()) < C.POUND_IMPACT_R + 8) {
            e.hurt(2, cx < e.centerX() ? 1 : -1, 'pound');
          }
        } else if (e.type === 'barrel') {
          if (U.dist(cx, cy, e.centerX(), e.centerY()) < C.POUND_IMPACT_R) e.ignite(0.2);
        } else if (e.type === 'iceblock') {
          if (U.dist(cx, cy, e.centerX(), e.centerY()) < C.POUND_IMPACT_R) e.shatter();
        } else if (e.type === 'armoredWall') {
          if (U.dist(cx, cy, e.centerX(), e.centerY()) < C.POUND_IMPACT_R + 16) e.hit(1);
        } else if (e.type === 'crate') {
          if (U.dist(cx, cy, e.centerX(), e.centerY()) < C.POUND_IMPACT_R) e.knock(cx < e.centerX() ? 1 : -1, -3);
        }
      }
      // 砸碎脚下裂岩
      const tx = Math.floor(cx / T), ty = Math.floor((this.feetY() + 2 * this.grav) / T);
      world.breakCracked(tx, ty, 26);
      // 陨石弹簧
      const sp = world.springUnder(this);
      if (sp) {
        this.triggerSpring(sp, true);
      } else {
        this.refreshAir();
        this.springCd = 4;
      }
      Events.emit('player:pound', { x: cx, y: cy });
    }

    startSlide() {
      this.state = 'slide';
      this.slideTime = 52;
      this.slideDir = Math.sign(this.vx) || this.facing;
      this.vx = Math.min(C.SLIDE_MAX, Math.max(Math.abs(this.vx) * 1.12, 3.6)) * this.slideDir;
      this.setHeight(C.P_SLIDE_H);
      PB.Audio.sfx('slide');
      Events.emit('player:slide', { x: this.centerX(), y: this.centerY(), dir: this.slideDir });
      if (this.echoState === 'recording') this.recordEvent('slide', { dir: this.slideDir });
    }

    updateSlide(dt, world, ax, down, jumpDown) {
      this.slideTime--;
      // 转向/爬行微调
      if (ax && Math.sign(ax) === this.slideDir) this.vx = U.approach(this.vx, this.slideDir * C.SLIDE_MAX, 0.12);
      else if (ax && Math.sign(ax) !== this.slideDir) this.vx = U.approach(this.vx, 0, C.SLIDE_FRICTION * 1.5);
      else this.vx = U.approach(this.vx, this.slideDir * C.SLIDE_MIN, C.SLIDE_FRICTION);
      this.facing = this.slideDir;
      // 跳跃 -> 滑铲跃冲
      if (this.jumpBuffer > 0) {
        if (this.canStand()) {
          this.setHeight(C.P_H);
          this.state = 'normal';
          this.vy = -C.WAVE_JUMP_V * this.grav;
          this.vx = this.slideDir * Math.max(4.25, Math.abs(this.vx) * 1.05);
          this.waveTime = C.WAVE_TIME;
          this.jumpBuffer = 0;
          this.jumpCut = false;
          this.refreshAir();
          PB.Audio.sfx('wave');
          if (PB.Gfx) PB.Gfx.particles.dashTrail(this.centerX(), this.centerY(), this.slideDir, PAL_ACCENT(this));
          Events.emit('player:waveslide', { x: this.centerX(), y: this.centerY(), dir: this.slideDir, speed: Math.abs(this.vx) });
          return;
        } else {
          this.jumpBuffer = 0;
        }
      }
      // 滑铲伤害
      for (const e of world.entities) {
        if (e.dead) continue;
        if (!U.rectsOverlap(this.x, this.y, this.w, this.h, e.x, e.y, e.w, e.h)) continue;
        if (e instanceof PB.Ents.Enemy) {
          if (e.frozen > 0) e.kick(this.slideDir);
          else e.hurt(1, this.slideDir, 'slide');
        } else if (e.type === 'iceblock') e.kick(this.slideDir);
        else if (e.type === 'fossil') e.shatter();
        else if (e.type === 'barrel') e.ignite(0.16);
      }
      const wantsEnd = !down || Math.abs(this.vx) < 0.9 || this.slideTime <= 0 || this.hitWall;
      if (wantsEnd) {
        if (this.canStand()) {
          this.setHeight(C.P_H);
          this.state = 'normal';
        } else {
          // 仍卡在矮洞中：保持滑铲，但允许继续向前爬出
          this.slideTime = Math.max(this.slideTime, 24);
          this.hitWall = 0;
          if (Math.abs(this.vx) < 1.15) this.vx = this.slideDir * 1.15;
        }
      }
      // 重力 + 移动（同一帧内完成，避免悬空或二次位移）
      if (!this.onGround) {
        this.vy += C.GRAV_DOWN * this.grav * 0.9;
        this.vy = U.clamp(this.vy, -C.MAX_FALL, C.MAX_FALL);
      } else {
        this.vy = 0;
      }
      this.moveAndCollide(world);
    }

    canStand() {
      const newY = this.y + this.h - C.P_H;
      const rect = { x: this.x, y: newY, w: this.w, h: C.P_H };
      for (const { tx, ty } of this.world.tilesInRect(rect.x, rect.y, rect.w, rect.h)) {
        if (this.world.isSolidTile(tx, ty)) return false;
      }
      for (const e of this.world.entities) {
        if (!e.solid || e.dead || e === this) continue;
        const r = e.rect();
        if (U.rectsOverlap(this.x, newY, this.w, C.P_H, r.x, r.y, r.w, r.h)) return false;
      }
      return true;
    }

    setHeight(h) {
      if (this.h === h) return;
      this.y += this.h - h;
      this.h = h;
    }

    moveAndCollide(world) {
      this.hitWall = 0;
      this.hitCeil = false;
      this.hitGround = false;
      this.vyBefore = this.vy;
      world.moveX(this, this.vx);
      if (this.hitWall) this.vx = 0;
      world.moveY(this, this.vy);
      if (this.onGround) this.hitGround = true;
      if (this.hitCeil) this.hitCeil = true;
    }
    onLand() {
      const fall = Math.abs(this.vyBefore || this.vy);
      PB.Audio.sfx('land', { vol: fall > 5 ? 1 : 0.55 });
      if (PB.Gfx) {
        PB.Gfx.particles.dust(this.centerX(), this.feetY(), 0, fall > 5 ? 10 : 5);
        if (fall > 6.5) PB.Gfx.particles.emitBurst(this.centerX(), this.feetY(), 'dust', 10);
      }
      if (this.game && fall > 6.5) this.game.shake(2.2, 0.16);
      this.refreshAir();
      this.jumpCut = false;
      Events.emit('player:land', {
        x: this.centerX(), y: this.feetY(), fall,
        ground: this.groundEntity ? this.groundEntity.type : 'tile',
      });
    }

    triggerSpring(spring, pound) {
      this.springCd = 12;
      const power = spring.type === 'meteor' ? (pound ? 13.5 : 10.5) : (pound ? 12 : 9.4);
      this.vy = -power * this.grav;
      this.onGround = false;
      this.refreshAir();
      this.jumpCut = false;
      PB.Audio.sfx(spring.type === 'meteor' ? 'meteor' : 'spring');
      if (PB.Gfx) {
        PB.Gfx.particles.sparkleRing(this.centerX(), this.feetY(), spring.type === 'meteor' ? '#f49cff' : PAL_ACCENT(this));
        PB.Gfx.particles.emitBurst(this.centerX(), this.feetY(), 'spark', 9);
      }
      if (this.game) this.game.shake(3, 0.18);
      Events.emit('player:spring', { x: this.centerX(), y: this.feetY(), meteor: spring.type === 'meteor', pound });
    }

    // ------------------------------------------------------------- skills
    useSkill(down) {
      const form = this.currentForm;
      // 星隙形态：只要场上还有星棱，第二次按 J 永远优先瞬移（不受技能冷却阻挡）
      if (form === 'warp' && this.world.warpStar && !this.world.warpStar.dead &&
        this.teleportLock <= 0 && this.warpThrowLock <= 0) {
        this.warpTeleport(this.world.warpStar);
        Events.emit('player:skill', { form: 'warp', secondary: !!down, x: this.centerX(), y: this.centerY() });
        return;
      }
      if (this.skillCd > 0) return;
      if (!this.forms[form]) {
        if (this.game) this.game.toast('还没有获得棱镜 / NO PRISM YET', '先找到对应形态的祭坛。', 'info');
        return;
      }
      switch (form) {
        case 'solar': this.skillSolar(); break;
        case 'cryo': down ? this.skillCryoBlock() : this.skillCryoPulse(); break;
        case 'grav': down ? this.skillGravityPulse() : this.skillGravityFlip(); break;
        case 'warp': this.skillWarp(); break;
        default: break;
      }
      Events.emit('player:skill', { form, secondary: !!down, x: this.centerX(), y: this.centerY() });
    }

    skillSolar() {
      const aim = Input.aimVector(this.facing);
      const len = Math.hypot(aim.x, aim.y) || 1;
      const dx = aim.x / len, dy = aim.y / len;
      const px = this.centerX() + dx * 9;
      const py = this.centerY() + dy * 5;
      PB.Ents.spawnFireball(this.world, px, py, dx * 4.6, dy * 4.2 - 0.4);
      this.skillCd = 0.32;
      this.facing = dx !== 0 ? Math.sign(dx) : this.facing;
      PB.Audio.sfx('fireball');
      if (this.echoState === 'recording') this.recordEvent('solar', { dx, dy });
      Events.emit('player:skill', { form: 'solar', x: px, y: py });
    }

    skillCryoPulse() {
      const cx = this.centerX(), cy = this.centerY();
      const res = this.world.freezeArea(cx, cy, 76, 'player');
      this.skillCd = 1.0;
      if (PB.Gfx) PB.Gfx.particles.frostPulse(cx, cy, PAL_CYAN);
      if (this.game && this.game.bossActive && this.game.boss) this.game.boss.onFormPulse('cryo', cx, cy);
      if (this.echoState === 'recording') this.recordEvent('cryo', {});
      Events.emit('player:skill', { form: 'cryo', x: cx, y: cy, result: res });
      if (this.game && res.water + res.lava + res.enemies + res.lanterns === 0) {
        // 空放也有微小反馈
        PB.Audio.sfx('freeze', { vol: 0.25 });
      }
    }

    skillCryoBlock() {
      if (this.summonedBlock && !this.summonedBlock.dead) {
        this.summonedBlock.shatter();
      }
      const w = 16, h = 12;
      const x = Math.floor((this.centerX() - w / 2) / T) * T;
      const y = this.y + this.h;
      // 检查空间
      for (const e of this.world.entities) {
        if (!e.solid || e.dead) continue;
        const r = e.rect();
        if (U.rectsOverlap(x, y, w, h, r.x, r.y, r.w, r.h)) return;
      }
      for (const { tx, ty } of this.world.tilesInRect(x, y, w, h)) {
        if (this.world.isSolidTile(tx, ty)) return;
      }
      const block = new PB.Ents.IceBlock(this.world, 0, 0, { life: C.ICE_BLOCK_LIFE, summoned: true });
      block.x = x; block.y = y; block.w = w; block.h = h;
      this.world.addEntity(block);
      this.summonedBlock = block;
      this.skillCd = 0.85;
      this.refreshAir();
      PB.Audio.sfx('freeze', { vol: 0.7 });
      if (PB.Gfx) PB.Gfx.particles.sparkleRing(x + w / 2, y + h / 2, PAL_CYAN);
      if (this.echoState === 'recording') this.recordEvent('cryoBlock', { x, y });
      Events.emit('player:cryoBlock', { x: x + w / 2, y: y + h / 2 });
    }

    skillGravityFlip() {
      this.grav *= -1;
      if (this.state === 'pound') this.state = 'normal';
      this.vy = -this.vy * 0.55 - 1.4 * this.grav;
      this.onGround = false;
      this.coyote = 0;
      this.refreshAir();
      this.jumpCut = false;
      this.skillCd = 0.34;
      PB.Audio.sfx('flip');
      if (this.game) this.game.shake(3.5, 0.3);
      if (PB.Gfx) {
        PB.Gfx.particles.gravityPulse(this.centerX(), this.centerY(), PAL_VIOLET);
        PB.Gfx.particles.emitBurst(this.centerX(), this.centerY(), 'gravity', 12);
      }
      if (this.echoState === 'recording') this.recordEvent('gravFlip', {});
      Events.emit('player:gravityFlip', { x: this.centerX(), y: this.centerY(), grav: this.grav });
    }

    skillGravityPulse() {
      const n = this.world.gravityPulse(this.centerX(), this.centerY(), 80);
      this.skillCd = 1.15;
      if (PB.Gfx) PB.Gfx.particles.gravityPulse(this.centerX(), this.centerY(), PAL_VIOLET);
      if (this.game && this.game.bossActive && this.game.boss) this.game.boss.onFormPulse('grav', this.centerX(), this.centerY());
      if (this.echoState === 'recording') this.recordEvent('gravPulse', {});
      Events.emit('player:gravityPulse', { x: this.centerX(), y: this.centerY(), count: n });
    }

    skillWarp() {
      const star = this.world.warpStar;
      if (star && !star.dead && star.life > 0) {
        this.warpTeleport(star);
        return;
      }
      const aim = Input.aimVector(this.facing);
      const len = Math.hypot(aim.x, aim.y) || 1;
      const dx = aim.x / len, dy = aim.y / len;
      const px = this.centerX() + dx * 10;
      const py = this.centerY() + dy * 8;
      PB.Ents.spawnWarpStar(this.world, px, py, dx * 7.2, dy * 7.2);
      this.warpThrowLock = 0.12;
      this.teleportLock = 0.1;
      this.skillCd = 0.12;
      this.facing = dx !== 0 ? Math.sign(dx) : this.facing;
      PB.Audio.sfx('warpThrow');
      if (this.echoState === 'recording') this.recordEvent('warpThrow', { dx, dy });
      Events.emit('player:warpThrow', { x: px, y: py, dx, dy });
    }

    warpTeleport(star) {
      if (this.teleportLock > 0) return;
      const ox = this.x, oy = this.y;
      const ovx = this.vx, ovy = this.vy;
      if (star.attachedEntity && star.attachedEntity.type === 'boss') {
        const boss = star.attachedEntity.boss;
        this.x = boss.x - this.w / 2;
        this.y = boss.y + 28 - this.h;
        boss.onWarpSwap();
        Events.emit('player:warpSwap', { x: this.centerX(), y: this.centerY(), entity: 'boss' });
      } else if (star.attachedEntity && !star.attachedEntity.dead) {
        const ent = star.attachedEntity;
        const ex = ent.x, ey = ent.y;
        this.x = ent.centerX() - this.w / 2;
        this.y = ent.y + ent.h - this.h;
        if (ent.type === 'barrel' || ent.type === 'crate') {
          ent.x = ox + (this.w - ent.w) / 2;
          ent.y = oy + this.h - ent.h;
          ent.vy = -6;
          ent.vx = -Math.sign(ovx) * 2;
        } else {
          ent.x = ox + (this.w - ent.w) / 2;
          ent.y = oy + this.h - ent.h;
          ent.frozen = 0;
          ent.thaw && ent.thaw();
        }
        Events.emit('player:warpSwap', {
          x: this.centerX(), y: this.centerY(), entity: ent.type,
        });
      } else {
        this.x = star.centerX() - this.w / 2;
        this.y = star.centerY() - this.h / 2;
        Events.emit('player:warpTeleport', { x: this.centerX(), y: this.centerY() });
      }
      if (this.game && this.game.bossActive && this.game.boss) {
        this.game.boss.onWarpNear(this.centerX(), this.centerY());
      }
      // 防止落进墙里
      let guard = 0;
      while (this.insideSolid() && guard++ < 16) this.y -= 2;
      this.vx = ovx; this.vy = ovy;
      this.onGround = false;
      this.refreshAir();
      star.dead = true;
      if (this.world.warpStar === star) this.world.warpStar = null;
      this.teleportLock = 0.25;
      this.warpThrowLock = 0;
      this.skillCd = 0.45;
      PB.Audio.sfx('warp');
      if (this.game) this.game.shake(2.5, 0.18);
      if (PB.Gfx) {
        PB.Gfx.particles.warpBurst(ox + this.w / 2, oy + this.h / 2);
        PB.Gfx.particles.warpBurst(this.centerX(), this.centerY());
      }
      if (this.echoState === 'recording') this.recordEvent('warpTeleport', {});
    }

    insideSolid() {
      for (const { tx, ty } of this.world.tilesInRect(this.x, this.y, this.w, this.h)) {
        if (this.world.isSolidTile(tx, ty)) return true;
      }
      return false;
    }

    // ------------------------------------------------------------- echo
    onEchoPressed() {
      if (!this.arts.echo) {
        if (this.game) this.game.toast('尚未获得回响 / ECHO SEALED', '在遗迹深处找到回响祭坛。', 'info');
        return;
      }
      if (this.echoState === 'idle') {
        this.startEchoRecording();
      } else if (this.echoState === 'recording') {
        this.finishEchoRecording();
      }
    }

    startEchoRecording() {
      this.echoState = 'recording';
      this.echoTimer = 0;
      this.echoSamples = [];
      this.echoEvents = [];
      this.echoSampleTick = 0;
      this.recordSample(0);
      PB.Audio.sfx('echoStart');
      if (this.game) this.game.toast('录制回响 / RECORDING ECHO', '再次按 F 提前释放；4 秒后自动成形。', 'info');
      Events.emit('echo:start', { x: this.centerX(), y: this.centerY() });
    }

    recordSample(dt) {
      this.echoTimer += dt;
      this.echoSampleTick += 1;
      if (this.echoSampleTick % 2 === 0 || this.echoSamples.length === 0) {
        this.echoSamples.push({
          t: this.echoTimer,
          x: this.x, y: this.y,
          dir: this.facing,
          form: this.currentForm,
          anim: this.animName,
        });
      }
      if (this.echoTimer >= C.ECHO_RECORD) this.finishEchoRecording();
    }

    recordEvent(type, data) {
      if (this.echoState !== 'recording') return;
      this.echoEvents.push({ t: this.echoTimer, type, data, x: this.x, y: this.y });
    }

    finishEchoRecording() {
      if (this.echoState !== 'recording') return;
      this.echoState = 'cool';
      const duration = Math.min(C.ECHO_RECORD + 0.05, Math.max(0.4, this.echoTimer));
      const samples = this.echoSamples.slice();
      if (samples.length === 0) samples.push({ t: 0, x: this.x, y: this.y, dir: this.facing, form: this.currentForm, anim: 'idle' });
      const events = this.echoEvents.slice();
      if (this.game) {
        const echo = new PB.Ents.EchoEntity(this.world, samples, events, duration, this);
        this.world.addEntity(echo);
      }
      this.echoCooldown = C.ECHO_COOLDOWN;
      this.echoTimer = 0;
      Events.emit('echo:finish', { duration });
    }

    updateEcho(dt) {
      // 录制计时由 recordSample 推进，避免重复累计。
    }

    replayEchoEvent(ev, echo) {
      const cx = echo.centerX(), cy = echo.centerY();
      if (ev.type === 'solar') {
        const d = ev.data || { dx: echo.dir || 1, dy: 0 };
        PB.Ents.spawnFireball(this.world, cx + d.dx * 8, cy + d.dy * 6, d.dx * 4.2, d.dy * 4.0 - 0.4, { echo: true });
      } else if (ev.type === 'cryo') {
        this.world.freezeArea(cx, cy, 46, 'echo');
        if (PB.Gfx) PB.Gfx.particles.frostPulse(cx, cy, '#ffd966');
      } else if (ev.type === 'gravPulse') {
        this.world.gravityPulse(cx, cy, 60);
        if (PB.Gfx) PB.Gfx.particles.gravityPulse(cx, cy, '#ffd966');
      } else if (ev.type === 'gravFlip') {
        if (PB.Gfx) PB.Gfx.particles.gravityRune(cx, cy);
      } else if (ev.type === 'warpThrow' || ev.type === 'warpTeleport' || ev.type === 'dash') {
        if (PB.Gfx) PB.Gfx.particles.warpBurst(cx, cy);
      } else if (ev.type === 'cryoBlock') {
        if (PB.Gfx) PB.Gfx.particles.sparkleRing(cx, cy, '#ffd966');
      }
    }

    checkEchoHeadBounce() {
      if (!this.onGround || !this.groundEntity || this.groundEntity.type !== 'echo') return;
      if (this.springCd > 0) return;
      this.springCd = 6;
      this.vy = -6.8 * this.grav;
      this.onGround = false;
      this.refreshAir();
      PB.Audio.sfx('spring', { vol: 0.7 });
      if (PB.Gfx) PB.Gfx.particles.sparkleRing(this.centerX(), this.feetY(), '#ffd966');
      Events.emit('echo:headBounce', { x: this.centerX(), y: this.feetY() });
    }

    // ------------------------------------------------------------- damage / death
    damage(amount, dir, source) {
      if (!this.alive || this.invuln > 0 || this.state === 'dash') return;
      this.hearts -= amount;
      this.invuln = C.INVULN;
      this.flash = 0.25;
      this.vx = (dir || 1) * 3.2;
      this.vy = -3.6 * this.grav;
      this.state = 'normal';
      this.setHeightSafe();
      PB.Audio.sfx('hurt');
      if (this.game) {
        this.game.shake(5, 0.35);
        this.game.addHitstop(0.06);
      }
      Events.emit('player:hurt', { x: this.centerX(), y: this.centerY(), source, dir });
      if (this.hearts <= 0) {
        this.die(source || 'enemy');
      }
    }

    setHeightSafe() {
      if (this.h !== C.P_H) {
        this.setHeight(C.P_H);
        if (this.insideSolid()) this.setHeight(C.P_SLIDE_H);
      }
    }

    kill(reason) {
      if (!this.alive) return;
      this.die(reason);
    }

    die(reason) {
      if (!this.alive) return;
      this.alive = false;
      this.deadT = 0;
      this.deathReason = reason;
      this.vy = -5.5 * this.grav;
      this.vx = 0;
      this.echoState = 'idle';
      PB.Audio.sfx('death');
      if (this.game) {
        this.game.shake(7, 0.5);
        this.game.onPlayerDied(reason);
      }
      Events.emit('player:died', { reason, x: this.centerX(), y: this.centerY() });
    }

    updateHazards(world) {
      if (!this.alive) return;
      const hz = world.hazardAt(this);
      if (hz) {
        if (hz.type === 'spike') {
          this.damage(1, this.facing * -1, 'spike');
          if (this.alive) {
            // 从尖刺上弹开
            this.vy = -5 * this.grav;
            this.vx = -this.facing * 2.4;
            this.invuln = Math.max(this.invuln, 0.6);
          }
        } else {
          this.kill(hz.type);
        }
      }
    }

    fullHeal() {
      this.hearts = this.maxHearts;
      this.invuln = Math.max(this.invuln, 0.6);
    }

    // ------------------------------------------------------------- entity interactions
    interactEntities(world, game) {
      const attacking = this.state === 'dash' || this.state === 'slide' || this.state === 'pound';
      for (const e of world.entities) {
        if (e.dead) continue;
        const overlap = U.rectsOverlap(this.x, this.y, this.w, this.h, e.x, e.y, e.w, e.h);
        if (!overlap) continue;
        if (e instanceof PB.Ents.Enemy) {
          if (e.frozen > 0) {
            if (attacking) e.kick(this.state === 'slide' ? this.slideDir : (Math.sign(this.vx) || this.facing));
            continue;
          }
          const feetToEnemy = this.grav > 0 ? (this.y + this.h) - e.y : (e.y + e.h) - this.y;
          const descending = this.vy * this.grav > 0.55;
          const stomp = descending && feetToEnemy < 15 && feetToEnemy > -4;
          if (stomp) {
            e.hurt(1, this.facing, 'stomp');
            this.vy = -6.6 * this.grav;
            this.onGround = false;
            this.refreshAir();
            this.stats.stomps++;
            if (game) game.addHitstop(0.04);
            PB.Audio.sfx('doubleJump', { vol: 0.5 });
            if (PB.Gfx) PB.Gfx.particles.sparkle(this.centerX(), e.y, PAL_ACCENT(this));
            Events.emit('player:stomp', { x: this.centerX(), y: e.y, type: e.type });
          } else if (attacking) {
            // 冲刺/滑铲/砸地的伤害已在各自 update 中结算
          } else {
            this.damage(1, this.centerX() < e.centerX() ? 1 : -1, 'enemy');
          }
        } else if (e.type === 'iceblock' && attacking) {
          e.kick(this.state === 'slide' ? this.slideDir : (Math.sign(this.vx) || this.facing));
        } else if (e.type === 'fossil' && attacking) {
          e.shatter();
        } else if (e.type === 'barrel' && attacking) {
          e.ignite(0.16);
        } else if (e.type === 'armoredWall' && this.vehicle && this.vehicle.type === 'mech' && this.state === 'dash') {
          e.hit(1);
        } else if (e.type === 'turret' && attacking) {
          e.hurt(1);
        }
      }
    }

    // ------------------------------------------------------------- vehicles
    mount(type, entity) {
      if (this.vehicle || this.mountCooldown > 0) return;
      if (this.game && this.game.bossActive) return;
      this.vehicle = { type, mount: entity, t: 0 };
      this.mountEntity = entity;
      this.mountCooldown = 0.8;
      this.state = 'normal';
      this.setHeight(C.P_H);
      this.vx = 0; this.vy = 0;
      if (type === 'mech') this.vehicleHp = 3;
      this.cartSpeed = 0;
      if (type === 'glider') {
        // 从地面起飞：给一个短暂的离地宽限与上升初速
        this.vehicle.grace = 0.9;
        this.vy = -3.6 * this.grav;
        this.onGround = false;
      }
      PB.Audio.sfx('menuConfirm');
      if (this.game) this.game.toast(
        type === 'cart' ? '熔核矿车 / CINDER CART' : type === 'glider' ? '霜翼滑翔翼 / FROSTWING' : '棱镜机兵 / PRISM STRIDER',
        type === 'cart' ? '←→ 加减速 · Space 跳 · ↓ 下车' : type === 'glider' ? '按住跳跃上升 · ↓ 俯冲 · 落地收起' : 'J 棱镜炮 · Shift 冲撞 · ↓ 离开',
        'info'
      );
      Events.emit('vehicle:mount', { type });
    }

    dismount() {
      if (!this.vehicle) return;
      const v = this.vehicle;
      this.vehicle = null;
      if (this.mountEntity) {
        this.mountEntity.ridden = false;
        this.mountEntity.x = this.x - (this.mountEntity.w - this.w) / 2;
        this.mountEntity.y = this.feetY() - this.mountEntity.h;
        this.mountEntity = null;
      }
      this.mountCooldown = 1.1;
      this.vx = Math.sign(this.vx) * Math.min(Math.abs(this.vx), 2);
      this.vy = -2 * this.grav;
      PB.Audio.setVehicle(null, false);
      PB.Audio.sfx('menuBack');
      Events.emit('vehicle:dismount', { type: v.type });
    }

    updateVehicle(dt, world, game) {
      const v = this.vehicle;
      v.t += dt;
      this.invuln = Math.max(this.invuln, 0.1);
      if (v.type === 'cart') this.updateCart(dt, world);
      else if (v.type === 'glider') this.updateGlider(dt, world);
      else this.updateMech(dt, world);
      if (!this.vehicle) return;
      // 车辆撞击敌人
      for (const e of world.entities) {
        if (e.dead) continue;
        if (!(e instanceof PB.Ents.Enemy)) continue;
        if (U.rectsOverlap(this.x, this.y, this.w, this.h, e.x, e.y, e.w, e.h)) {
          if (e.frozen > 0) e.kick(Math.sign(this.vx) || 1);
          else e.hurt(3, Math.sign(this.vx) || 1, 'vehicle');
        }
      }
      this.interactEntities(world, game);
      this.updateHazards(world);
    }

    updateCart(dt, world) {
      const throttle = Input.axisX();
      const boost = Input.isDown('dash') && this.springCd <= 0;
      const max = boost ? 7.6 : 5.4;
      if (throttle !== 0) {
        this.cartSpeed = U.approach(this.cartSpeed, throttle * max, 0.14);
        this.facing = throttle;
      } else {
        this.cartSpeed = U.approach(this.cartSpeed, 0, 0.035);
      }
      if (boost && Math.abs(this.cartSpeed) > 1) {
        this.cartSpeed = Math.sign(this.cartSpeed) * max;
      }
      if (Input.consume('jump') && this.onGround) {
        this.vy = -7.2 * this.grav;
        this.onGround = false;
        PB.Audio.sfx('jump');
      }
      if (Input.consume('down')) { this.dismount(); return; }
      this.vx = this.cartSpeed;
      this.vy += 0.5 * this.grav;
      this.vy = U.clamp(this.vy, -C.MAX_FALL, C.MAX_FALL);
      world.moveX(this, this.vx);
      if (this.hitWall) this.cartSpeed = 0;
      world.moveY(this, this.vy);
      const probe = world.groundProbe(this);
      this.onGround = probe.solid;
      if (this.onGround) this.vy = 0;
      if (this.game) PB.Audio.setVehicle('cart', true, Math.abs(this.cartSpeed));
      if (this.game && Math.abs(this.cartSpeed) > 4) this.game.shake(0.6, 0.05);
      if (this.springCd > 0) this.springCd--;
      if (this.onGround) {
        const sp = world.springUnder(this);
        if (sp && this.springCd <= 0) {
          this.springCd = 12;
          this.vy = -9.8 * this.grav;
          this.onGround = false;
          PB.Audio.sfx('spring');
        }
      }
    }

    updateGlider(dt, world) {
      const ax = Input.axisX();
      const up = Input.isDown('up') || Input.isDown('jump');
      const down = Input.isDown('down');
      this.vx = U.approach(this.vx, ax * 4.3, 0.12);
      if (up) this.vy = U.approach(this.vy, -2.1, 0.1);
      else if (down) this.vy = U.approach(this.vy, 4.2, 0.13);
      else this.vy = U.approach(this.vy, 0.55, 0.05);
      if (Input.consume('dash') && this.gliderBoost <= 0) {
        this.gliderBoost = 0.7;
        this.vx += this.facing * 4.5;
        PB.Audio.sfx('dash');
      }
      this.gliderBoost = Math.max(0, this.gliderBoost - dt);
      if (Math.abs(this.vx) > 0.4) this.facing = Math.sign(this.vx);
      world.moveX(this, this.vx);
      if (this.hitWall) {
        this.vx = -this.vx * 0.2;
        if (this.game) this.game.shake(3, 0.2);
      }
      world.moveY(this, this.vy);
      // 滑翔翼不得飞出世界上边界
      if (this.y < 6) { this.y = 6; if (this.vy < 0) this.vy = 0; }
      if (this.vehicle.grace > 0) this.vehicle.grace -= dt;
      const probe = world.groundProbe(this);
      if (probe.solid && this.vehicle.grace <= 0) {
        this.dismount();
        return;
      }
      if (PB.Gfx) {
        if (Math.random() < 0.5) PB.Gfx.particles.windStreak(this.x - this.facing * 8, this.centerY() + U.rand(-4, 4), this.facing);
        if (this.vy < -0.5) PB.Gfx.particles.updraft(this.centerX(), this.y + this.h);
      }
      if (this.game) PB.Audio.setVehicle('glider', true, Math.abs(this.vx));
    }

    updateMech(dt, world) {
      const ax = Input.axisX();
      this.vx = U.approach(this.vx, ax * 1.7, 0.12);
      if (ax) this.facing = ax;
      if (Input.consume('jump') && this.onGround) {
        this.vy = -6.4 * this.grav;
        this.onGround = false;
      }
      if (Input.consume('dash')) {
        this.vx = this.facing * 5.4;
        if (this.game) this.game.shake(2, 0.12);
        PB.Audio.sfx('dash');
      }
      if (Input.consume('down')) { this.dismount(); return; }
      if (Input.consume('skill')) {
        PB.Ents.spawnMechBolt(world, this.centerX() + this.facing * 12, this.centerY() - 2, this.facing);
        PB.Audio.sfx('dash', { vol: 0.5 });
        this.skillCd = 0.35;
      }
      this.vy += 0.48 * this.grav;
      this.vy = U.clamp(this.vy, -C.MAX_FALL, 8);
      world.moveX(this, this.vx);
      world.moveY(this, this.vy);
      const probe = world.groundProbe(this);
      this.onGround = probe.solid;
      if (this.onGround) {
        this.vy = 0;
        if (this.springCd <= 0) {
          const sp = world.springUnder(this);
          if (sp) { this.triggerSpring(sp, false); this.onGround = false; }
        }
      }
      if (this.game) PB.Audio.setVehicle('mech', true, Math.abs(this.vx));
      // 载具受击
      if (this.invuln <= 0) {
        for (const e of world.entities) {
          if (e.dead || !(e instanceof PB.Ents.Enemy)) continue;
          if (U.rectsOverlap(this.x, this.y, this.w, this.h, e.x, e.y, e.w, e.h)) {
            this.vehicleHp--;
            this.invuln = 0.8;
            if (this.game) this.game.shake(4, 0.2);
            if (this.vehicleHp <= 0) {
              if (PB.Gfx) PB.Gfx.particles.explosion(this.centerX(), this.centerY());
              this.dismount();
              this.damage(1, this.facing, 'mech');
            }
            break;
          }
        }
      }
    }

    // ------------------------------------------------------------- ghost trail
    updateGhosts(dt) {
      for (const g of this.ghosts) g.life -= dt;
      this.ghosts = this.ghosts.filter((g) => g.life > 0);
      if (this.slowActive) {
        if (Math.random() < 0.16) this.ghosts.push({ x: this.x, y: this.y, facing: this.facing, form: this.currentForm, anim: this.animName, life: 0.18 });
      }
    }

    // ------------------------------------------------------------- animation / draw
    chooseAnim() {
      if (this.state === 'slide') return 'slide';
      if (this.state === 'dash') return 'dash';
      if (this.state === 'pound') return 'spin';
      if (this.spinT > 0) return 'spin';
      if (this.wallSliding) return 'wall';
      if (!this.onGround) {
        const falling = this.vy * this.grav > 0.6;
        return falling ? 'fall' : 'jump';
      }
      if (Math.abs(this.vx) > 0.35) {
        const idx = Math.floor(this.animT * (8 + Math.abs(this.vx) * 2.4)) % RUN_ANIM.length;
        return RUN_ANIM[idx];
      }
      return Math.floor(this.animT * 2.2) % 2 ? 'idle2' : 'idle';
    }

    draw(ctx, cam) {
      if (!this.alive && this.deadT > 0.9) return;
      this.animName = this.chooseAnim();
      const formId = this.forms[this.currentForm] ? this.currentForm : 'base';
      const form = this.form();
      const accent = form ? form.color : '#7ef0e0';

      // 冲刺残影
      for (const g of this.ghosts) {
        const spr = PB.Sprites.player(g.form === 'base' ? 'base' : g.form, g.anim);
        ctx.save();
        ctx.globalAlpha = g.life * 4 * 0.25;
        PB.Sprites.draw(ctx, spr, g.x + (this.w - spr.width) / 2, g.y + this.h - spr.height, g.facing < 0);
        ctx.restore();
      }

      // 玩家影子
      if (this.onGround && this.grav > 0) {
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = '#05060b';
        ctx.fillRect(Math.round(this.centerX()) - 5, Math.round(this.y + this.h) + 1, 10, 2);
        ctx.fillRect(Math.round(this.centerX()) - 3, Math.round(this.y + this.h) + 3, 6, 1);
        ctx.restore();
      }

      // 载具
      if (this.vehicle) this.drawVehicle(ctx, accent);

      // 围巾/披风
      this.drawScarf(ctx, accent);

      // 形态光环
      if (form) {
        const cp = PB.Chains ? PB.Chains.countDone() : 0;
        ctx.save();
        const a = 0.09 + (cp >= 8 ? 0.03 : 0) + Math.sin(this.t * 3) * 0.025;
        ctx.globalAlpha = a;
        ctx.fillStyle = form.color;
        ctx.beginPath();
        ctx.arc(this.centerX(), this.centerY(), 16 + (cp >= 8 ? 2 : 0), 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = '#fff6dc';
        ctx.beginPath();
        ctx.arc(this.centerX(), this.centerY() - 6, 6, 0, TAU);
        ctx.fill();
        if (cp >= 8) {
          ctx.globalAlpha = 0.13 + U.animate(this.t, 0.7) * 0.06;
          ctx.strokeStyle = cp >= 12 ? '#ffd966' : form.color;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(this.centerX(), this.centerY(), 20, this.t, this.t + Math.PI * 1.2); ctx.stroke();
          ctx.beginPath(); ctx.arc(this.centerX(), this.centerY(), 20, this.t + Math.PI, this.t + Math.PI * 2.2); ctx.stroke();
        }
        ctx.restore();
      }

      // 本体
      let frame = this.animName;
      if (this.vehicle && this.vehicle.type === 'mech') {
        // 机兵外壳由 drawVehicle 绘制，不再画完整身体
        this.drawPilotHead(ctx, accent);
        return;
      }
      if (this.vehicle && this.vehicle.type === 'cart') frame = 'ride';
      if (this.echoState === 'recording') {
        ctx.save();
        ctx.globalAlpha = 0.35 + Math.sin(this.t * 12) * 0.15;
        ctx.fillStyle = '#ffd966';
        ctx.beginPath(); ctx.arc(this.centerX(), this.centerY(), 15, 0, TAU); ctx.fill();
        ctx.restore();
      }
      const spr = PB.Sprites.player(formId, frame);
      const outline = PB.Sprites.outline(formId, frame);
      const invulnFlicker = this.invuln > 0 && Math.floor(this.t * 22) % 2 === 0;
      ctx.save();
      if (invulnFlicker) ctx.globalAlpha *= 0.42;
      const isInverted = this.grav < 0;
      if (frame === 'spin') {
        const ang = (this.spinT > 0 ? this.t * 18 : this.t * 6) % TAU;
        if (outline) PB.Sprites.drawRotated(ctx, outline, this.centerX(), this.centerY(), ang, this.facing < 0, 0.5);
        PB.Sprites.drawRotated(ctx, spr, this.centerX(), this.centerY(), ang, this.facing < 0, 1);
      } else if (frame === 'slide') {
        const px = this.centerX();
        const py = this.grav > 0 ? this.y + this.h : this.y;
        ctx.translate(Math.round(px), Math.round(py));
        if (this.facing < 0) ctx.scale(-1, 1);
        if (isInverted) ctx.scale(1, -1);
        if (outline) {
          ctx.globalAlpha *= 0.5;
          ctx.drawImage(outline, -outline.width / 2, isInverted ? -1 : -outline.height + 1);
          ctx.globalAlpha = ctx.globalAlpha / 0.5;
        }
        ctx.drawImage(spr, -spr.width / 2, isInverted ? 0 : -spr.height);
      } else {
        const cx = this.centerX();
        const anchorY = isInverted ? this.y : this.y + this.h;
        ctx.translate(Math.round(cx), Math.round(anchorY));
        if (this.facing < 0) ctx.scale(-1, 1);
        if (isInverted) ctx.scale(1, -1);
        if (outline) {
          ctx.globalAlpha *= 0.5;
          ctx.drawImage(outline, -outline.width / 2, -outline.height + 1);
          ctx.globalAlpha = ctx.globalAlpha / 0.5;
        }
        ctx.drawImage(spr, -spr.width / 2, -spr.height);
      }
      ctx.restore();

      // 形态粒子
      if (this.state === 'dash' && Math.random() < 0.6 && PB.Gfx) {
        PB.Gfx.particles.dashTrail(this.centerX(), this.centerY(), Math.sign(this.vx) || this.facing, accent);
      }
      if (this.slowActive) {
        ctx.save();
        ctx.globalAlpha = 0.22 + Math.sin(this.t * 8) * 0.05;
        ctx.strokeStyle = '#7ef0e0';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(this.centerX(), this.centerY(), 16, this.t * 0.6, this.t * 0.6 + Math.PI * 1.4); ctx.stroke();
        ctx.restore();
      }
    }

    drawPilotHead(ctx, accent) {
      const x = Math.round(this.centerX()), y = Math.round(this.y + 2);
      ctx.fillStyle = '#1c2742';
      ctx.fillRect(x - 4, y - 2, 8, 8);
      ctx.fillStyle = '#f1d2b1';
      ctx.fillRect(x - 3, y, 6, 5);
      ctx.fillStyle = '#fffbe8';
      ctx.fillRect(x - 2, y + 2, 1, 1);
      ctx.fillRect(x + 1, y + 2, 1, 1);
      ctx.fillStyle = accent;
      ctx.fillRect(x - 4, y - 3, 8, 1);
    }

    drawVehicle(ctx, accent) {
      const v = this.vehicle;
      if (!v) return;
      if (v.type === 'cart') {
        PB.Ents.drawVehicle(ctx, 'cart', this.x - 8, this.y + this.h - 13, 26, 16, this.t, true);
        // 车轮尘
        if (Math.abs(this.vx) > 2 && Math.random() < 0.4 && PB.Gfx) {
          PB.Gfx.particles.dust(this.x - 4, this.y + this.h, -Math.sign(this.vx));
        }
      } else if (v.type === 'glider') {
        // 滑翔翼在角色身后
        const x = Math.round(this.centerX()), y = Math.round(this.y);
        ctx.fillStyle = '#7fd8df';
        ctx.globalAlpha = 0.9;
        ctx.fillRect(x - 20, y + 4, 12, 3);
        ctx.fillRect(x + 8, y + 4, 12, 3);
        ctx.fillRect(x - 24, y + 2, 6, 2);
        ctx.fillRect(x + 18, y + 2, 6, 2);
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#c8fbff';
        ctx.fillRect(x - 17, y + 3, 7, 1);
        ctx.fillRect(x + 10, y + 3, 7, 1);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#2b3552';
        ctx.fillRect(x - 4, y + 6, 8, 2);
        if (Math.random() < 0.4 && PB.Gfx) PB.Gfx.particles.windStreak(x - 14, y + 8 + U.rand(-2, 4), -this.facing);
      } else if (v.type === 'mech') {
        PB.Ents.drawVehicle(ctx, 'mech', this.x - 6, this.y + this.h - 28, 22, 28, this.t, true);
        // 机兵护盾和受损火花
        if (this.vehicleHp < 3) {
          ctx.save();
          ctx.globalAlpha = 0.2 + Math.sin(this.t * 15) * 0.1;
          ctx.fillStyle = this.vehicleHp === 1 ? '#e85a63' : '#ffd966';
          ctx.fillRect(this.x - 4, this.y + this.h - 24, 2, 2);
          ctx.restore();
        }
      }
    }

    drawScarf(ctx, accent) {
      const cp = PB.Chains ? PB.Chains.countDone() : 0;
      const main = cp >= 12 ? '#ffd966' : accent;
      const tip = cp >= 12 ? '#fff2c4' : '#ffe6b0';
      const len = this.state === 'dash' ? 12 : this.state === 'slide' ? 8 : 6;
      const back = -this.facing;
      const wob = Math.sin(this.t * 9) * 1.4 + (this.onGround ? Math.abs(this.vx) * 0.3 : 1.4);
      const y0 = this.y + 10;
      for (let i = 0; i < len; i++) {
        const px = this.centerX() + back * (5 + i);
        const py = y0 + Math.sin(this.t * 8 - i * 0.7) * (wob * (i / len)) + (this.grav < 0 ? -i : i) * 0.4;
        ctx.globalAlpha = 0.8 - i * 0.035;
        ctx.fillStyle = i % 3 === 0 ? tip : main;
        ctx.fillRect(Math.round(px), Math.round(py), 2, i > len - 2 ? 1 : 2);
      }
      ctx.globalAlpha = 1;
    }
  }

  function PAL_ACCENT(p) {
    const f = p.form();
    return f ? f.color : '#7ef0e0';
  }
  const PAL_CYAN = '#7ef0e0';
  const PAL_VIOLET = '#b48cff';
  const PAL_GOLD = '#ffd966';

  PB.Player = Player;
})();
