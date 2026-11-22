/* ============================================================
   game.js — 状态机、章节流程、摄像机、存档与所有系统集成
   ============================================================ */
(function () {
  'use strict';
  const PB = window.PB;
  const { C, U, Input, Events } = PB;

  const PAUSE_ITEMS = ['resume', 'codex', 'controls', 'settings', 'restart', 'title'];
  const SETTINGS_ITEMS = ['music', 'sfx', 'shake', 'flashes', 'back'];

  class Game {
    constructor() {
      this.state = 'boot';
      this.realTime = 0;
      this.acc = 0;
      this.hitstop = 0;
      this.statusTimer = 0;
      this.camera = { x: 0, y: 0 };
      this.shakeX = 0; this.shakeY = 0;
      this.shakeT = 0; this.shakePower = 0;
      this.world = null;
      this.player = null;
      this.boss = null;
      this.bossActive = false;
      this.chapterIndex = 0;
      this.chapterTime = 0;
      this.chapterShards = 0;
      this.collectedShards = new Set();
      this.deathT = 0;
      this.deathReason = null;
      this.cardT = 0;
      this.introT = 0;
      this.introCard = 0;
      this.endingT = 0;
      this.endingStats = null;
      this.themeOverride = 'summit';
      this.toasts = [];
      this.chainBanner = null;
      this.lastChainProgress = null;
      this.activeSign = null;
      this._signs = new Map();
      this.ui = {
        titleIndex: 0,
        pauseIndex: 0,
        codexIndex: 0,
        settingsIndex: 0,
        chapterIndex: 0,
        codexReturn: 'title',
        settingsReturn: 'title',
        controlsReturn: 'title',
        previousState: 'title',
        confirmMode: null,
        selectedChapter: 0,
      };
      this.stats = null;
      this.lastCheckpointToast = -99;
      this.vehicle = null;
      this._lastSlow = false;
      this._savedAt = 0;
      this.fade = 0;
      this.fadeColor = '#000';
      this.debugNoClip = false;
      this.debugGod = false;
    }

    init() {
      PB.Save.load();
      this.stats = PB.Save.data.stats;
      this.collectedShards = new Set(Object.keys(PB.Save.data.collectedShards || {}));
      Input.init();
      PB.Sprites.init();
      PB.Gfx.init();
      PB.Chains.init(this);
      this.applyAudioSettings();
      this.state = 'title';
      this.themeOverride = 'summit';
      this.ui.titleIndex = PB.Save.hasProgress() ? 0 : 0;
      PB.Audio.playMusic('title');
      this.bindDebug();
      window.addEventListener('beforeunload', () => this.persist(false));
      document.addEventListener('visibilitychange', () => {
        if (window.PB_NO_AUTOPAUSE) return;
        if (document.hidden && this.state === 'play') this.pauseGame(true);
      });
      // 隐藏启动遮罩
      const boot = U.byId('boot');
      if (boot) setTimeout(() => boot.classList.add('hide'), 120);
    }

    applyAudioSettings() {
      const st = PB.Save.data.settings;
      PB.Audio.setVolumes(st.music, st.sfx);
      PB.Audio.setMuted(!!st.muted);
    }

    persist(save = true) {
      if (!PB.Save.data) return;
      PB.Save.data.stats = this.stats;
      if (save) PB.Save.save();
    }

    // ------------------------------------------------------------- frame
    frame(dt) {
      dt = Math.min(0.05, Math.max(0.001, dt));
      this.realTime += dt;
      Input.update(dt);

      if (Input.consume('mute')) {
        const st = PB.Save.data.settings;
        st.muted = !st.muted;
        PB.Audio.setMuted(st.muted);
        PB.Save.save();
        this.toast(st.muted ? '声音已静音' : '声音已开启', st.muted ? 'AUDIO MUTED' : 'AUDIO ON', 'info');
      }

      this.updateState(dt);
      this.updateEffects(dt);
      this.updateCamera(dt);

      // 音乐与粒子
      const slow = this.player && this.player.slowActive;
      if (this._lastSlow !== slow) {
        this._lastSlow = slow;
        PB.Audio.setTimeScale(slow ? C.BULLET_SCALE : 1);
      }
      PB.Audio.setIntensity(this.audioIntensity());
      PB.Audio.update();
      let particleScale = 1;
      if (this.state === 'paused' || this.state === 'codex' || this.state === 'settings' || this.state === 'controls' || this.state === 'shrine' || this.state === 'confirmNew' || this.state === 'chapters') particleScale = 0.25;
      PB.Gfx.update(dt * particleScale * (slow ? 0.5 : 1));

      // 存档节流
      if (this.realTime - this._savedAt > 8) {
        this._savedAt = this.realTime;
        this.persist(true);
      }

      PB.Gfx.render(this);
      Input.endFrame();
    }

    audioIntensity() {
      if (this.bossActive) return 1;
      if (this.state === 'title' || this.state === 'intro') return 0.55;
      if (this.state === 'ending') return 0.45;
      if (this.player && this.player.vehicle) return 0.92;
      if (this.chainBanner) return 0.88;
      return 0.65;
    }

    updateState(dt) {
      switch (this.state) {
        case 'title': this.updateTitle(dt); break;
        case 'confirmNew': this.updateConfirmNew(dt); break;
        case 'chapters': this.updateChapters(dt); break;
        case 'intro': this.updateIntro(dt); break;
        case 'chapterCard':
          this.cardT += dt;
          if (this.cardT > 0.4 && (Input.consume('confirm') || Input.consume('jump') || Input.consume('pause') || Input.pointer.clicked)) {
            this.beginPlay();
          } else if (this.cardT > 2.6) {
            this.beginPlay();
          }
          break;
        case 'play': this.updatePlay(dt); break;
        case 'paused': this.updatePaused(dt); break;
        case 'codex': this.updateCodex(dt); break;
        case 'settings': this.updateSettings(dt); break;
        case 'controls': this.updateControls(dt); break;
        case 'shrine': this.updateShrine(dt); break;
        case 'chapterClear': this.updateChapterClear(dt); break;
        case 'dead': this.updateDead(dt); break;
        case 'ending': this.updateEnding(dt); break;
        default: break;
      }
    }

    // ------------------------------------------------------------- title / menus
    titleItems() {
      const has = PB.Save.hasProgress();
      const items = [];
      if (has) items.push('continue');
      items.push('new');
      if (PB.Save.data.chapter > 0) items.push('chapters');
      items.push('codex', 'settings', 'controls');
      return items;
    }

    // 鼠标/触屏：命中测试与悬停
    pickHit(kind) {
      const p = Input.pointer;
      if (!p.active || !PB.UI) return null;
      const hit = PB.UI.hitTest(p.x, p.y);
      return hit && hit.kind === kind ? hit : null;
    }

    hoverHit(kind) {
      if (!Input.pointer.moved) return null;
      return this.pickHit(kind);
    }

    updateTitle(dt) {
      this.themeOverride = 'summit';
      PB.Audio.setDucked(false);
      this.camera.x = 30 + Math.sin(this.realTime * 0.05) * 18;
      this.camera.y = 0;
      const items = this.titleItems();
      if (this.ui.titleIndex >= items.length) this.ui.titleIndex = 0;
      const hov = this.hoverHit('title');
      if (hov && hov.index < items.length) this.ui.titleIndex = hov.index;
      let moved = false;
      if (Input.consume('up')) { this.ui.titleIndex = (this.ui.titleIndex - 1 + items.length) % items.length; moved = true; }
      if (Input.consume('down')) { this.ui.titleIndex = (this.ui.titleIndex + 1) % items.length; moved = true; }
      if (moved) PB.Audio.sfx('menuMove');
      const pHit = Input.pointer.clicked ? this.pickHit('title') : null;
      if (pHit && pHit.index < items.length) {
        this.ui.titleIndex = pHit.index;
        PB.Audio.sfx('menuConfirm');
        this.activateTitle(items[pHit.index]);
        return;
      }
      if (Input.consume('confirm') || Input.consume('jump')) {
        PB.Audio.sfx('menuConfirm');
        this.activateTitle(items[this.ui.titleIndex]);
      }
    }

    activateTitle(item) {
      if (item === 'continue') this.continueGame();
      else if (item === 'new') {
        if (PB.Save.hasProgress()) { this.ui.confirmMode = 'new'; this.ui.previousState = 'title'; this.setState('confirmNew'); }
        else this.startNewJourney();
      } else if (item === 'chapters') {
        this.ui.chapterIndex = 0;
        this.setState('chapters');
      } else if (item === 'codex') this.openCodex('title');
      else if (item === 'settings') this.openSettings('title');
      else if (item === 'controls') this.openControls('title');
    }

    updateConfirmNew(dt) {
      this.ui.confirmIndex = this.ui.confirmIndex == null ? 1 : this.ui.confirmIndex;
      const hov = this.hoverHit('confirm');
      if (hov) this.ui.confirmIndex = hov.index;
      if (Input.consume('up') || Input.consume('down') || Input.consume('left') || Input.consume('right')) {
        this.ui.confirmIndex = 1 - this.ui.confirmIndex;
        PB.Audio.sfx('menuMove');
      }
      const pHit = Input.pointer.clicked ? this.pickHit('confirm') : null;
      if (pHit) {
        this.ui.confirmIndex = pHit.index;
        this.confirmNewChoice();
        return;
      }
      if (Input.consume('confirm') || Input.consume('jump')) {
        this.confirmNewChoice();
      } else if (Input.consume('pause') || Input.consume('back')) {
        PB.Audio.sfx('menuBack');
        this.setState('title');
      }
    }

    confirmNewChoice() {
      if (this.ui.confirmIndex === 0) {
        PB.Audio.sfx('menuConfirm');
        PB.Save.reset();
        this.stats = PB.Save.data.stats;
        this.startNewJourney();
      } else {
        PB.Audio.sfx('menuBack');
        this.setState('title');
      }
    }

    updateChapters(dt) {
      const count = Math.min(PB.Levels.CHAPTERS.length, PB.Save.data.chapter + 1);
      this.ui.chapterIndex = U.clamp(this.ui.chapterIndex, 0, count - 1);
      const hov = this.hoverHit('chapters');
      if (hov && hov.index < count) this.ui.chapterIndex = hov.index;
      let moved = false;
      if (Input.consume('up')) { this.ui.chapterIndex = (this.ui.chapterIndex - 1 + count) % count; moved = true; }
      if (Input.consume('down')) { this.ui.chapterIndex = (this.ui.chapterIndex + 1) % count; moved = true; }
      if (moved) PB.Audio.sfx('menuMove');
      const pHit = Input.pointer.clicked ? this.pickHit('chapters') : null;
      if (pHit) {
        if (pHit.index < count) {
          this.ui.chapterIndex = pHit.index;
          PB.Audio.sfx('menuConfirm');
          this.loadChapter(this.ui.chapterIndex, false);
        } else {
          PB.Audio.sfx('menuBack');
        }
        return;
      }
      if (Input.consume('confirm') || Input.consume('jump')) {
        PB.Audio.sfx('menuConfirm');
        this.loadChapter(this.ui.chapterIndex, false);
      } else if (Input.consume('pause') || Input.consume('back')) {
        PB.Audio.sfx('menuBack');
        this.setState('title');
      }
    }

    startNewJourney() {
      this.collectedShards.clear();
      PB.Save.data.collectedShards = {};
      this.stats = PB.Save.data.stats;
      this.introCard = 0;
      this.introT = 0;
      this.themeOverride = 'summit';
      this.setState('intro');
      PB.Audio.playMusic('title');
      PB.Save.data.seenIntro = false;
      PB.Save.save();
    }

    updateIntro(dt) {
      this.introT += dt;
      if (Input.consume('confirm') || Input.consume('jump') || Input.consume('right') || Input.pointer.clicked) {
        PB.Audio.sfx('menuConfirm');
        this.introCard++;
        this.introT = 0;
        if (this.introCard >= 3) this.finishIntro();
      } else if (Input.consume('pause') || Input.consume('back')) {
        this.finishIntro();
      } else if (this.introT > 5.2) {
        this.introCard++;
        this.introT = 0;
        if (this.introCard >= 3) this.finishIntro();
      }
    }

    finishIntro() {
      PB.Save.data.seenIntro = true;
      PB.Save.save();
      this.loadChapter(0, false);
    }

    continueGame() {
      const cp = PB.Save.data.checkpoint;
      let chapter = cp && cp.chapter != null ? cp.chapter : PB.Save.data.chapter;
      chapter = U.clamp(chapter, 0, PB.Levels.CHAPTERS.length - 1);
      this.loadChapter(chapter, true);
    }

    // ------------------------------------------------------------- chapter setup
    loadChapter(index, useCheckpoint) {
      this.chapterIndex = U.clamp(index, 0, PB.Levels.CHAPTERS.length - 1);
      const chapter = PB.Levels.get(this.chapterIndex);
      PB.Save.data.chapter = Math.max(PB.Save.data.chapter || 0, this.chapterIndex);
      let spawn = null;
      if (useCheckpoint) {
        const cp = PB.Save.data.checkpoint;
        if (cp && cp.chapter === this.chapterIndex) spawn = { x: cp.x, y: cp.y };
      }
      this.world = new PB.World(this.chapterIndex, {
        collected: this.collectedShards,
        spawn,
      });
      this.world.game = this;
      const sp = spawn || this.world.spawn;
      this.player = new PB.Player(this.world, sp.x, sp.y, this);
      this.world.player = this.player;
      this.adjustPlayerSpawn();
      this.boss = null;
      this.bossActive = false;
      this.chapterTime = 0;
      this.chapterShards = 0;
      this.cardT = 0;
      this.acc = 0;
      this.hitstop = 0;
      this.shakeT = 0;
      this.shakePower = 0;
      if (PB.Gfx) PB.Gfx.particles.list.length = 0;
      this.chainBanner = null;
      this.lastChainProgress = null;
      this.toasts = [];
      this.activeSign = null;
      this._signs.clear();
      this.themeOverride = null;
      this.snapCamera();
      // 检查点实体点亮
      if (spawn) {
        for (const e of this.world.entities) {
          if (e.type === 'checkpoint' && Math.abs(e.x - sp.x) < 40 && Math.abs(e.y - sp.y) < 60) e.active = true;
        }
      }
      PB.Save.data.stats = this.stats;
      PB.Save.save();
      PB.Audio.setDucked(false);
      PB.Audio.playMusic(chapter.music);
      PB.Audio.setVehicle(null, false);
      PB.Audio.sfx('shrine', { vol: 0.5 });
      Events.emit('level:start', { chapter: this.chapterIndex });
      PB.Chains.onLevelStart();
      this.setState('chapterCard');
      this.cardT = 0;
      this.ui.codexIndex = 0;
    }

    adjustPlayerSpawn() {
      if (!this.player || !this.world) return;
      let guard = 0;
      while (this.player.insideSolid() && guard++ < 50) this.player.y -= 2;
      if (this.player.y > this.world.pixelH - this.player.h - 2) this.player.y = this.world.pixelH - this.player.h - 20;
    }

    beginPlay() {
      this.setState('play');
      this.player.invuln = Math.max(this.player.invuln, 0.4);
      PB.Audio.setDucked(false);
    }

    snapCamera() {
      if (!this.player || !this.world) return;
      const p = this.player;
      this.camera.x = U.clamp(p.centerX() - C.W / 2, 0, Math.max(0, this.world.pixelW - C.W));
      this.camera.y = U.clamp(p.centerY() - C.H / 2 + 6, 0, Math.max(0, this.world.pixelH - C.H));
      this._camSnap = true;
    }

    // ------------------------------------------------------------- play
    updatePlay(dt) {
      if (Input.consume('pause')) { this.pauseGame(false); return; }
      if (Input.consume('codex')) { this.openCodex('play'); return; }
      if (Input.consume('restart')) { this.restartCheckpoint(); return; }

      // 固定 60Hz 物理步长（子弹时间通过减缓累积实现）
      const slow = this.player && this.player.slowActive;
      if (this.hitstop > 0) {
        this.hitstop -= dt;
        this.acc = Math.min(this.acc, C.STEP);
        return;
      }
      const scale = slow ? C.BULLET_SCALE : 1;
      this.acc += dt * scale;
      let steps = 0;
      while (this.acc >= C.STEP && steps < 5) {
        this.step(C.STEP);
        this.acc -= C.STEP;
        steps++;
        if (this.state !== 'play') break;
      }
      if (steps >= 5) this.acc = 0; // 防止追帧螺旋

      // 站在裂缝地板上时给一次玩法提示（每章一次）
      if (this.player && this.player.onGround && this.player.grav > 0 && this.world) {
        const p = this.player;
        const tx = Math.floor(p.centerX() / C.TILE);
        const ty = Math.floor((p.feetY() + 2) / C.TILE);
        if (this.world.tileAt(tx, ty) === 'c') {
          this._crackT = (this._crackT || 0) + dt;
          if (this._crackT > 0.6) {
            this._crackT = 0;
            if (!this._crackChapters) this._crackChapters = new Set();
            if (!this._crackChapters.has(this.chapterIndex)) {
              this._crackChapters.add(this.chapterIndex);
              this.toast('裂缝岩层在震颤 · 空中 Shift+↓ 砸穿它', 'THE CRACKED FLOOR TREMBLES · POUND IT OPEN', 'info', 3.4);
            }
          }
        } else {
          this._crackT = 0;
        }
      }
    }

    step(dt) {
      if (!this.world || !this.player) return;
      this.world.update(dt, this.player);
      if (this.player.alive) this.player.update(dt, this.world, this);
      if (this.boss && this.bossActive && this.boss.update) this.boss.update(dt, this);
      if (this.bossActive && this.boss && this.boss.arena && this.player) {
        // 将玩家限制在 Boss 竞技场内，避免跑出战斗
        this.player.x = U.clamp(this.player.x, this.boss.arena.x + 14, this.boss.arena.x + this.boss.arena.w - 14 - this.player.w);
      }
      this.chapterTime += dt;
      this.stats.playTime = (this.stats.playTime || 0) + dt;
      // 主动死亡检查
      if (!this.player.alive && this.state === 'play') {
        // onPlayerDied 已经切到 dead，这里兜底
        this.onPlayerDied(this.player.deathReason || 'void');
      }
      // 相机在一个物理步后立即跟随（渲染时还会平滑）
      if (this.world.echo === null) this.world.echo = null;
    }

    pauseGame(auto = false) {
      if (this.state !== 'play') return;
      this.ui.previousState = 'play';
      this.ui.pauseIndex = 0;
      this.setState('paused');
      PB.Audio.setDucked(true);
      PB.Audio.sfx('pause');
      if (this.player && this.player.vehicle) PB.Audio.setVehicle(this.player.vehicle.type, false);
    }

    updatePaused(dt) {
      if (Input.consume('pause') || Input.consume('back')) { this.resumeGame(); return; }
      const hov = this.hoverHit('pause');
      if (hov) this.ui.pauseIndex = hov.index;
      let moved = false;
      if (Input.consume('up')) { this.ui.pauseIndex = (this.ui.pauseIndex - 1 + PAUSE_ITEMS.length) % PAUSE_ITEMS.length; moved = true; }
      if (Input.consume('down')) { this.ui.pauseIndex = (this.ui.pauseIndex + 1) % PAUSE_ITEMS.length; moved = true; }
      if (moved) PB.Audio.sfx('menuMove');
      const pHit = Input.pointer.clicked ? this.pickHit('pause') : null;
      if (pHit) {
        this.ui.pauseIndex = pHit.index;
        PB.Audio.sfx('menuConfirm');
        this.activatePause(PAUSE_ITEMS[pHit.index]);
        return;
      }
      if (Input.consume('confirm') || Input.consume('jump')) {
        PB.Audio.sfx('menuConfirm');
        this.activatePause(PAUSE_ITEMS[this.ui.pauseIndex]);
      }
    }

    activatePause(item) {
      if (item === 'resume') this.resumeGame();
      else if (item === 'codex') this.openCodex('paused');
      else if (item === 'controls') this.openControls('paused');
      else if (item === 'settings') this.openSettings('paused');
      else if (item === 'restart') this.restartCheckpoint();
      else if (item === 'title') this.quitToTitle();
    }

    resumeGame() {
      this.setState('play');
      PB.Audio.setDucked(false);
      PB.Audio.sfx('unpause');
      if (this.player && this.player.vehicle) PB.Audio.setVehicle(this.player.vehicle.type, true, 2);
    }

    quitToTitle() {
      this.persist(true);
      this.world = null;
      this.player = null;
      this.boss = null;
      this.bossActive = false;
      this.themeOverride = 'summit';
      this.ui.titleIndex = 0;
      this.setState('title');
      PB.Audio.setDucked(false);
      PB.Audio.setVehicle(null, false);
      PB.Audio.playMusic('title');
    }

    openCodex(from) {
      this.ui.codexReturn = from;
      this.ui.codexIndex = this.ui.codexIndex || 0;
      this.setState('codex');
      PB.Audio.setDucked(true);
      PB.Audio.sfx('menuConfirm');
    }

    updateCodex(dt) {
      if (Input.consume('codex') || Input.consume('pause') || Input.consume('back')) { this.closeCodex(); return; }
      const hov = this.hoverHit('codex');
      if (hov) this.ui.codexIndex = hov.index;
      if (Input.pointer.clicked) {
        if (this.pickHit('codexClose')) { this.closeCodex(); return; }
        const card = this.pickHit('codex');
        if (card) {
          this.ui.codexIndex = card.index;
          PB.Audio.sfx('menuMove');
          return;
        }
      }
      let moved = false;
      if (Input.consume('left')) { this.ui.codexIndex = (this.ui.codexIndex + 15) % 16; moved = true; }
      if (Input.consume('right')) { this.ui.codexIndex = (this.ui.codexIndex + 1) % 16; moved = true; }
      if (Input.consume('up')) { this.ui.codexIndex = (this.ui.codexIndex + 12) % 16; moved = true; }
      if (Input.consume('down')) { this.ui.codexIndex = (this.ui.codexIndex + 4) % 16; moved = true; }
      if (moved) PB.Audio.sfx('menuMove');
    }

    closeCodex() {
      PB.Audio.sfx('menuBack');
      if (this.ui.codexReturn === 'paused') this.setState('paused');
      else if (this.ui.codexReturn === 'play') { this.setState('play'); PB.Audio.setDucked(false); }
      else this.setState('title');
    }

    openSettings(from) {
      this.ui.settingsReturn = from;
      this.ui.settingsIndex = 0;
      this.setState('settings');
      PB.Audio.sfx('menuConfirm');
      PB.Audio.setDucked(true);
    }

    updateSettings(dt) {
      const st = PB.Save.data.settings;
      if (Input.consume('pause') || Input.consume('back')) { this.closeSettings(); return; }
      const hov = this.hoverHit('settings');
      if (hov) this.ui.settingsIndex = hov.index;
      let moved = false;
      if (Input.consume('up')) { this.ui.settingsIndex = (this.ui.settingsIndex - 1 + SETTINGS_ITEMS.length) % SETTINGS_ITEMS.length; moved = true; }
      if (Input.consume('down')) { this.ui.settingsIndex = (this.ui.settingsIndex + 1) % SETTINGS_ITEMS.length; moved = true; }
      const item = SETTINGS_ITEMS[this.ui.settingsIndex];
      let delta = 0;
      if (Input.consume('left')) delta = -0.08;
      if (Input.consume('right')) delta = 0.08;
      if (delta) {
        if (item === 'music') { st.music = U.clamp(st.music + delta, 0, 1); PB.Audio.setVolumes(st.music, null); }
        else if (item === 'sfx') { st.sfx = U.clamp(st.sfx + delta, 0, 1); PB.Audio.setVolumes(null, st.sfx); }
        PB.Save.save();
        PB.Audio.sfx('menuMove');
      }
      if (moved) PB.Audio.sfx('menuMove');
      if (Input.pointer.clicked) {
        const bar = this.pickHit('settingsbar');
        if (bar) {
          const val = U.clamp((Input.pointer.x - bar.x) / bar.w, 0, 1);
          const it = SETTINGS_ITEMS[bar.index];
          if (it === 'music') { st.music = val; PB.Audio.setVolumes(st.music, null); }
          else if (it === 'sfx') { st.sfx = val; PB.Audio.setVolumes(null, st.sfx); }
          this.ui.settingsIndex = bar.index;
          PB.Save.save();
          PB.Audio.sfx('menuMove');
          return;
        }
        const row = this.pickHit('settings');
        if (row) {
          this.ui.settingsIndex = row.index;
          const it = SETTINGS_ITEMS[row.index];
          if (it === 'shake') { st.shake = !st.shake; PB.Audio.sfx('menuConfirm'); PB.Save.save(); }
          else if (it === 'flashes') { st.flashes = !st.flashes; PB.Audio.sfx('menuConfirm'); PB.Save.save(); }
          else if (it === 'back') this.closeSettings();
          else PB.Audio.sfx('menuConfirm');
          return;
        }
      }
      if (Input.consume('confirm') || Input.consume('jump')) {
        if (item === 'shake') { st.shake = !st.shake; PB.Audio.sfx('menuConfirm'); PB.Save.save(); }
        else if (item === 'flashes') { st.flashes = !st.flashes; PB.Audio.sfx('menuConfirm'); PB.Save.save(); }
        else if (item === 'back') this.closeSettings();
        else PB.Audio.sfx('menuConfirm');
      }
    }

    closeSettings() {
      PB.Audio.sfx('menuBack');
      if (this.ui.settingsReturn === 'paused') this.setState('paused');
      else if (this.ui.settingsReturn === 'play') { this.setState('play'); PB.Audio.setDucked(false); }
      else this.setState('title');
    }

    openControls(from) {
      this.ui.controlsReturn = from;
      this.setState('controls');
      PB.Audio.sfx('menuConfirm');
      PB.Audio.setDucked(true);
    }

    updateControls(dt) {
      if (Input.consume('pause') || Input.consume('back') || Input.consume('confirm') || Input.consume('jump') || Input.pointer.clicked) {
        PB.Audio.sfx('menuBack');
        if (this.ui.controlsReturn === 'paused') this.setState('paused');
        else if (this.ui.controlsReturn === 'play') { this.setState('play'); PB.Audio.setDucked(false); }
        else this.setState('title');
      }
    }

    openShrine(formId, shrine) {
      const isForm = !!PB.FORM_BY_ID[formId];
      const isEcho = formId === 'echo';
      const isChrono = formId === 'chrono';
      let newly = false;
      if (isForm) {
        if (!PB.Save.data.forms[formId]) {
          PB.Save.unlockForm(formId);
          this.player.onFormUnlocked(formId);
          this.player.setForm(formId, true);
          newly = true;
        }
      } else if (isEcho) {
        if (!PB.Save.data.arts.echo) { PB.Save.unlockArt('echo'); this.player.onArtUnlocked('echo'); newly = true; }
      } else if (isChrono) {
        if (!PB.Save.data.arts.chrono) { PB.Save.unlockArt('chrono'); this.player.onArtUnlocked('chrono'); newly = true; }
      }
      if (shrine) {
        this.setCheckpoint({
          chapter: this.chapterIndex,
          x: shrine.tx * C.TILE + 3,
          y: shrine.ty * C.TILE - C.P_H,
          id: `${this.chapterIndex}:shrine:${formId}`,
        }, null, true);
      }
      if (!newly) {
        this.player.fullHeal();
        this.toast('棱镜回应了你', 'PRISM ANSWERS', 'info');
        PB.Audio.sfx('checkpoint');
        return;
      }
      this.ui.shrineData = { formId, isForm, isEcho, isChrono, t: 0 };
      this.setState('shrine');
      PB.Audio.setDucked(true);
      PB.Audio.sfx('shrine');
      PB.Gfx.flashScreen(PB.FORM_BY_ID[formId] ? PB.FORM_BY_ID[formId].color : '#7ef0e0', 0.25);
      this.shake(3, 0.4);
    }

    updateShrine(dt) {
      const d = this.ui.shrineData;
      if (!d) { this.setState('play'); return; }
      d.t += dt;
      if (d.t > 0.55 && (Input.consume('confirm') || Input.consume('jump') || Input.consume('skill') || Input.consume('pause') || Input.pointer.clicked)) {
        this.setState('play');
        PB.Audio.setDucked(false);
        this.player.invuln = 1;
        PB.Gfx.flashScreen('#ffffff', 0.1);
      }
    }

    // ------------------------------------------------------------- events
    setCheckpoint(cp, entity, silent) {
      PB.Save.data.checkpoint = cp;
      PB.Save.save();
      if (this.player) this.player.fullHeal();
      if (!silent) {
        this.toast('棱镜信标已点亮', 'CHECKPOINT LIT', 'info');
        this.lastCheckpointToast = this.realTime;
        this.shake(1.5, 0.2);
      }
    }

    collectShard(n, x, y) {
      this.stats.shards = (this.stats.shards || 0) + n;
      this.chapterShards += n;
      this.shardFlash = 0.25;
      const pitch = Math.min(6, this.chapterShards % 7);
      PB.Audio.sfx('shard', { pitch });
      this.persist(false);
    }

    markShardCollected(key) {
      if (!key) return;
      this.collectedShards.add(key);
      if (PB.Save.data.collectedShards) PB.Save.data.collectedShards[key] = true;
      PB.Save.save();
    }

    collectGrand(id, x, y) {
      PB.Save.data.grand[id] = true;
      PB.Save.save();
      this.toast('拾得大棱晶', 'GRAND PRISM RECOVERED', 'grand');
      PB.Audio.sfx('grand');
      this.shake(4, 0.3);
      PB.Gfx.flashScreen('#d8fbff', 0.24);
      const count = this.grandCount();
      if (count === 12) {
        if (this.player) {
          this.player.maxHearts++;
          this.player.fullHeal();
        }
        this.toast('十二大棱晶齐聚', 'TWELVE GRAND PRISMS', 'grand');
      }
    }

    grandCount() { return Object.keys(PB.Save.data.grand || {}).filter((k) => PB.Save.data.grand[k]).length; }

    showSign(id, ent) {
      if (this.state !== 'play') return;
      this._signs.set(ent, id);
      const signs = PB.Levels.SIGNS;
      this.activeSign = { id, ...(signs[id] || { zh: id, en: id }) };
    }
    hideSign(ent) {
      this._signs.delete(ent);
      if (this._signs.size === 0) this.activeSign = null;
    }
    clearSigns() { this._signs.clear(); this.activeSign = null; }

    toast(title, subtitle, type = 'info', duration = 2.6) {
      this.toasts.push({ title, subtitle, type, t: duration, max: duration });
      if (this.toasts.length > 4) this.toasts.shift();
    }

    onChainProgress(def, n) {
      this.lastChainProgress = { def, value: n, t: 3.0 };
    }

    onChainComplete(def, detail) {
      this.chainBanner = { def, t: 4.2, max: 4.2 };
      this.lastChainProgress = null;
      this.addHitstop(0.1);
      this.shake(4, 0.35);
      PB.Audio.sfx('chain');
      PB.Gfx.flashScreen(def.color, 0.3);
      this.persist(true);
    }

    onChainMilestone(m) {
      const rewards = { 4: '棱光尾迹已解锁', 8: '回响光晕已解锁', 12: '鎏金围巾已解锁', 16: '真实终章已解锁' };
      this.toast(`连携里程碑 · ${m}/16`, rewards[m] || 'PRISM MILESTONE', 'chain', 3.4);
      PB.Gfx.flashScreen('#ffd966', 0.22);
    }

    onBulletTime(on) {
      Events.emit(on ? 'bullet:on' : 'bullet:off', {});
      PB.Audio.setTimeScale(on ? C.BULLET_SCALE : 1);
    }

    // ------------------------------------------------------------- damage / death
    addHitstop(seconds) {
      this.hitstop = Math.max(this.hitstop, seconds);
    }

    shake(power, time) {
      if (!PB.Save.data.settings.shake) return;
      this.shakePower = Math.max(this.shakePower, power);
      this.shakeT = Math.max(this.shakeT, time);
    }

    onPlayerDied(reason) {
      if (this.state === 'dead') return;
      this.stats.deaths = (this.stats.deaths || 0) + 1;
      this.deathReason = reason;
      this.deathT = 0;
      this.setState('dead');
      this.clearSigns();
      PB.Audio.setDucked(true);
      PB.Audio.setVehicle(null, false);
      PB.Save.save();
      this.chainBanner = null;
      this.lastChainProgress = null;
    }

    updateDead(dt) {
      if (this.player) this.player.deadT += dt;
      this.deathT += dt;
      if (this.deathT > 0.5 && (Input.consume('confirm') || Input.consume('jump') || Input.pointer.clicked)) this.respawn();
      else if (this.deathT > 2.1) this.respawn();
    }

    respawn() {
      const cp = PB.Save.data.checkpoint;
      let spawn = cp && cp.chapter === this.chapterIndex ? { x: cp.x, y: cp.y } : null;
      const keepForm = this.player ? this.player.currentForm : null;
      this.world = new PB.World(this.chapterIndex, { collected: this.collectedShards, spawn });
      this.world.game = this;
      const sp = spawn || this.world.spawn;
      this.player = new PB.Player(this.world, sp.x, sp.y, this);
      this.world.player = this.player;
      if (keepForm && this.player.forms[keepForm]) this.player.currentForm = keepForm;
      this.adjustPlayerSpawn();
      this.player.invuln = 1.1;
      this.boss = null;
      this.bossActive = false;
      this.chapterTime = Math.max(0, this.chapterTime);
      this.chainBanner = null;
      this.clearSigns();
      this.acc = 0;
      this.hitstop = 0;
      this.shakeT = 0;
      this.shakePower = 0;
      if (PB.Gfx) PB.Gfx.particles.list.length = 0;
      this.snapCamera();
      this.setState('play');
      PB.Audio.setDucked(false);
      PB.Audio.setVehicle(null, false);
      PB.Audio.playMusic(PB.Levels.get(this.chapterIndex).music, { restart: false });
      PB.Gfx.flashScreen('#9feaf7', 0.24);
      Events.emit('level:respawn', { chapter: this.chapterIndex });
      PB.Chains.onLevelStart();
    }

    restartCheckpoint() {
      PB.Audio.sfx('menuBack');
      this.respawn();
    }

    // ------------------------------------------------------------- chapter clear / boss / ending
    portalReached(goalId, portal) {
      if (this.state !== 'play') return;
      const chapter = PB.Levels.get(this.chapterIndex);
      const prevBest = PB.Save.data.bestTime[chapter.id];
      if (!prevBest || this.chapterTime < prevBest) PB.Save.data.bestTime[chapter.id] = this.chapterTime;
      this.ui.clearData = {
        chapter,
        time: this.chapterTime,
        best: PB.Save.data.bestTime[chapter.id],
        shards: this.chapterShards,
        chains: PB.Chains.countDone(),
        isNewBest: !prevBest || this.chapterTime <= prevBest,
      };
      const next = this.chapterIndex + 1;
      if (next < PB.Levels.CHAPTERS.length) {
        PB.Save.data.chapter = Math.max(PB.Save.data.chapter || 0, next);
        PB.Save.data.checkpoint = null;
      }
      PB.Save.save();
      this.setState('chapterClear');
      PB.Audio.setVehicle(null, false);
      PB.Audio.setDucked(true);
      PB.Audio.sfx('grand');
      this.shake(3, 0.4);
      PB.Gfx.flashScreen('#ffd966', 0.3);
    }

    updateChapterClear(dt) {
      this.cardT += dt;
      if (this.cardT > 0.7 && (Input.consume('confirm') || Input.consume('jump') || Input.pointer.clicked)) {
        const next = this.chapterIndex + 1;
        if (next < PB.Levels.CHAPTERS.length) this.loadChapter(next, false);
        else this.quitToTitle();
      }
    }

    startBoss(id, trigger) {
      if (this.bossActive) return;
      this.bossActive = true;
      this.clearSigns();
      if (this.player && this.player.vehicle) {
        this.player.dismount();
        PB.Audio.setVehicle(null, false);
      }
      this.setCheckpoint({
        chapter: this.chapterIndex,
        x: this.player.x,
        y: this.player.y,
        id: `${this.chapterIndex}:boss`,
      }, null, true);
      this.player.fullHeal();
      const arenaW = C.W;
      const cx = trigger.x + trigger.w / 2;
      const arena = {
        x: U.clamp(cx - arenaW / 2, 0, Math.max(0, this.world.pixelW - arenaW)),
        y: 0, w: arenaW, h: this.world.pixelH,
      };
      if (PB.Boss) this.boss = new PB.Boss(this, id, arena);
      PB.Audio.playMusic('boss', { restart: true });
      PB.Audio.setDucked(false);
      this.toast('棱镜守望者', PB.C.BOSS_NAME_EN, 'boss', 3.2);
      this.shake(6, 0.8);
      PB.Gfx.flashScreen('#b48cff', 0.32);
      Events.emit('boss:start', { id });
    }

    bossDefeated() {
      if (this.state === 'ending') return;
      this.bossActive = false;
      PB.Save.data.completed = true;
      const trueEnd = PB.Chains.countDone() >= 16;
      this.endingStats = {
        time: this.stats.playTime || 0,
        deaths: this.stats.deaths || 0,
        shards: this.stats.shards || 0,
        chains: PB.Chains.countDone(),
        grand: this.grandCount(),
        trueEnd,
      };
      if (trueEnd) PB.Save.data.trueEnding = true;
      PB.Save.data.chapter = PB.Levels.CHAPTERS.length - 1;
      PB.Save.save();
      this.endingT = 0;
      this.setState('ending');
      PB.Audio.setDucked(false);
      PB.Audio.playMusic('ending', { restart: true });
      PB.Audio.setVehicle(null, false);
      PB.Gfx.flashScreen('#fff2c4', 0.5);
      this.shake(8, 1.2);
      PB.Audio.sfx('bossDie');
      Events.emit('boss:defeated', {});
    }

    updateEnding(dt) {
      this.endingT += dt;
      if (this.endingT > 2 && (Input.consume('confirm') || Input.consume('jump') || Input.consume('pause') || Input.pointer.clicked)) {
        this.quitToTitle();
      }
    }

    // ------------------------------------------------------------- camera / effects
    updateCamera(dt) {
      if (this.state === 'title' || this.state === 'intro') {
        this.shakeX = 0; this.shakeY = 0;
        return;
      }
      if (!this.world || !this.player) return;
      const p = this.player;
      let tx, ty;
      if (this.bossActive && this.boss && this.boss.arena) {
        tx = this.boss.arena.x + this.boss.arena.w / 2 - C.W / 2;
        ty = this.boss.arena.y + this.boss.arena.h / 2 - C.H / 2;
      } else {
        const look = p.facing * 20 + p.vx * 8;
        const lookY = U.clamp(p.vy * 3.2, -18, 22);
        tx = p.centerX() + look - C.W / 2;
        ty = p.centerY() + lookY - C.H / 2 + 6;
        if (p.vehicle && p.vehicle.type === 'glider') {
          tx += p.facing * 20;
          ty -= 10;
        }
      }
      const maxX = Math.max(0, this.world.pixelW - C.W);
      const maxY = Math.max(0, this.world.pixelH - C.H);
      tx = U.clamp(tx, 0, maxX);
      ty = U.clamp(ty, 0, maxY);
      if (this._camSnap) {
        this.camera.x = tx; this.camera.y = ty; this._camSnap = false;
      } else {
        this.camera.x = U.damp(this.camera.x, tx, 9, dt);
        this.camera.y = U.damp(this.camera.y, ty, 7, dt);
      }
      // 镜头震动
      if (this.shakeT > 0) {
        this.shakeT -= dt;
        const s = this.shakePower * Math.min(1, this.shakeT * 3);
        this.shakeX = (Math.random() * 2 - 1) * s;
        this.shakeY = (Math.random() * 2 - 1) * s;
        if (this.shakeT <= 0) { this.shakePower = 0; this.shakeX = 0; this.shakeY = 0; }
      } else { this.shakeX = 0; this.shakeY = 0; }
    }

    updateEffects(dt) {
      for (const t of this.toasts) t.t -= dt;
      this.toasts = this.toasts.filter((t) => t.t > 0);
      if (this.chainBanner) {
        this.chainBanner.t -= dt;
        if (this.chainBanner.t <= 0) this.chainBanner = null;
      }
      if (this.lastChainProgress) {
        this.lastChainProgress.t -= dt;
        if (this.lastChainProgress.t <= 0) this.lastChainProgress = null;
      }
      if (this.shardFlash > 0) this.shardFlash -= dt;
    }

    setState(s) {
      this.state = s;
      Input.reset();
    }

    // ------------------------------------------------------------- debug
    bindDebug() {
      if (!window.PB) return;
      PB.DEBUG = {
        game: this,
        unlockAll: () => {
          for (const f of PB.FORMS) { PB.Save.data.forms[f.id] = true; this.player && (this.player.forms[f.id] = true); }
          PB.Save.data.arts.echo = true; PB.Save.data.arts.chrono = true;
          if (this.player) { this.player.arts.echo = true; this.player.arts.chrono = true; this.player.currentForm = 'solar'; }
          PB.Save.save();
        },
        loadChapter: (i) => { this.loadChapter(i, false); this.beginPlay(); },
        teleport: (tx, ty) => { if (this.player) { this.player.x = tx; this.player.y = ty; this.snapCamera(); } },
        setForm: (id) => { this.player && this.player.setForm(id, true); },
        heal: () => { this.player && this.player.fullHeal(); },
        god: (v = true) => { this.debugGod = v; },
        unlockForms: () => {
          for (const f of PB.FORMS) {
            PB.Save.data.forms[f.id] = true;
            if (this.player) this.player.forms[f.id] = true;
          }
          PB.Save.save();
        },
        unlockArts: () => {
          PB.Save.data.arts.echo = true; PB.Save.data.arts.chrono = true;
          if (this.player) { this.player.arts.echo = true; this.player.arts.chrono = true; }
          PB.Save.save();
        },
        chain: (id) => PB.Chains.complete(id),
        boss: () => this.startBoss('boss', { x: this.player.x + 120, y: this.player.y, w: 1, h: 1 }),
        state: () => ({
          state: this.state, player: this.player && {
            x: this.player.x, y: this.player.y, vx: this.player.vx, vy: this.player.vy,
            onGround: this.player.onGround, form: this.player.currentForm, hearts: this.player.hearts,
          },
          chapter: this.chapterIndex, bossActive: this.bossActive,
          chains: PB.Chains.countDone(),
        }),
      };
    }
  }

  PB.Game = new Game();
})();
