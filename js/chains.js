/* ============================================================
   chains.js — 16 种炼金连携图鉴
   跨系统事件追踪、即时完成反馈、持久化与里程碑奖励
   ============================================================ */
(function () {
  'use strict';
  const PB = window.PB;
  const { Events, U } = PB;

  const DEFS = [
    {
      id: 'firstSpark', num: 1, icon: 'flame', color: '#ffb454',
      zh: '星火初燃', en: 'FIRST SPARK', goal: 1,
      hintZh: '用烈焰火球点燃藤蔓或炸药桶。',
      hintEn: 'Ignite a vine or barrel with a Solar ember.',
      loreZh: '遗迹记得每一粒火星。',
      loreEn: 'The ruins remember every spark.',
      rewardZh: '棱光印记 ×1',
    },
    {
      id: 'chainBlaze', num: 2, icon: 'chain', color: '#ff8a4c',
      zh: '连环炽爆', en: 'CHAIN BLAZE', goal: 3,
      hintZh: '让 3 只炸药桶在一次连锁中爆炸。',
      hintEn: 'Detonate three barrels in a single chain.',
      loreZh: '火光连成一条短暂的项链。',
      loreEn: 'Firelight strung into a brief necklace.',
      rewardZh: '棱光印记 ×1',
    },
    {
      id: 'steamrise', num: 3, icon: 'steam', color: '#e8fbff',
      zh: '蒸汽天梯', en: 'STEAMRISE', goal: 1,
      hintZh: '让火球落入水面，乘蒸汽柱上升 4 格。',
      hintEn: 'Ember into water; ride the steam up four tiles.',
      loreZh: '水与火短暂和解，托举起旅人。',
      loreEn: 'Water and fire call a truce, just long enough to lift you.',
      rewardZh: '棱光印记 ×1',
    },
    {
      id: 'frostspan', num: 4, icon: 'frost', color: '#6ee7ff',
      zh: '霜桥飞渡', en: 'FROSTSPAN', goal: 8,
      hintZh: '在一块霜晶浮桥上连续踩过 8 格冰面。',
      hintEn: 'Cross eight frozen water tiles before they thaw.',
      loreZh: '脚下每一步，都是被按住的浪。',
      loreEn: 'Every footstep is a wave held still.',
      rewardZh: '棱光印记 ×1',
    },
    {
      id: 'obsidianForge', num: 5, icon: 'obsidian', color: '#ff9f45',
      zh: '黑曜铸路', en: 'OBSIDIAN FORGE', goal: 1,
      hintZh: '冻结熔岩，并站上冷却出的黑曜石板。',
      hintEn: 'Freeze lava and stand upon the obsidian.',
      loreZh: '最炽热的东西，也能成为脚下的路。',
      loreEn: 'Even the hottest thing can become a road.',
      rewardZh: '棱光印记 ×1',
    },
    {
      id: 'lanternAscent', num: 6, icon: 'lantern', color: '#8ff5ff',
      zh: '灯灵之阶', en: 'LANTERN ASCENT', goal: 2,
      hintZh: '一次腾空内，在两盏被驯服的灯笼灵上连跳。',
      hintEn: 'Bounce between two tamed lanterns in one airtime.',
      loreZh: '被温柔对待的火焰，愿意借你一脚。',
      loreEn: 'A gently tamed flame will lend you a step.',
      rewardZh: '棱光印记 ×1',
    },
    {
      id: 'iceBowling', num: 7, icon: 'bowling', color: '#9feaf7',
      zh: '保龄冰球', en: 'ICE BOWLING', goal: 2,
      hintZh: '冻结敌人成冰块，踢出去撞倒 2 个同伴。',
      hintEn: 'Kick a frozen foe into two of its kin.',
      loreZh: '霜晶球道，全中才好。',
      loreEn: 'A frost lane. A perfect strike is only polite.',
      rewardZh: '棱光印记 ×1',
    },
    {
      id: 'iceCradle', num: 8, icon: 'cradle', color: '#c8fbff',
      zh: '冰晶摇篮', en: 'ICE CRADLE', goal: 1,
      hintZh: '在空中召唤冰块，再从它侧面蹬墙跳走。',
      hintEn: 'Summon an ice block midair, then wall-jump off it.',
      loreZh: '临时摇篮也能托住一次远行。',
      loreEn: 'Even a temporary cradle can hold one journey.',
      rewardZh: '棱光印记 ×1',
    },
    {
      id: 'waveSlide', num: 9, icon: 'wave', color: '#7ef0e0',
      zh: '滑铲跃冲', en: 'WAVE-SLIDE', goal: 1,
      hintZh: '滑铲中起跳，滞空超过半秒并飞出 3 格。',
      hintEn: 'Jump from a slide; stay airborne half a second and travel far.',
      loreZh: '把地面的速度偷到空中。',
      loreEn: 'Steal the ground-speed and carry it into the sky.',
      rewardZh: '棱光印记 ×1',
    },
    {
      id: 'groundbreaker', num: 10, icon: 'pound', color: '#ffd966',
      zh: '裂地冲击', en: 'GROUNDBREAKER', goal: 2,
      hintZh: '用砸地击碎裂缝地板，并在 2 秒内击倒敌人。',
      hintEn: 'Shatter cracked stone with a pound, then fell a foe quickly.',
      loreZh: '向下的力量，也能打开一条向下的路。',
      loreEn: 'A downward force can open a downward road.',
      rewardZh: '棱光印记 ×1',
    },
    {
      id: 'invertedAmbush', num: 11, icon: 'gravity', color: '#b48cff',
      zh: '倒悬奇袭', en: 'INVERTED AMBUSH', goal: 1,
      hintZh: '在重力倒转状态下击败一名敌人。',
      hintEn: 'Defeat an enemy while your gravity is inverted.',
      loreZh: '从天而降，只不过“天”在脚下。',
      loreEn: 'Strike from above — above just happens to be below.',
      rewardZh: '棱光印记 ×1',
    },
    {
      id: 'antigravityFireworks', num: 12, icon: 'barrel', color: '#f49cff',
      zh: '反重力烟火', en: 'ANTI-GRAVITY FIREWORKS', goal: 1,
      hintZh: '用重力脉冲翻转炸药桶，让它在“上坠”时开花。',
      hintEn: 'Invert a barrel with a gravity pulse and let it burst upward.',
      loreZh: '让坠落换个方向，烟花就会朝天花板盛开。',
      loreEn: 'Turn falling inside out; fireworks bloom toward the ceiling.',
      rewardZh: '棱光印记 ×1',
    },
    {
      id: 'quantumSwap', num: 13, icon: 'warp', color: '#f49cff',
      zh: '量子换位', en: 'QUANTUM SWAP', goal: 1,
      hintZh: '把星棱钉在移动的敌人或炸药桶上，再与其换位。',
      hintEn: 'Stick a warp star to a foe or barrel, then swap places.',
      loreZh: '谁规定“这里”只能站着原来的你？',
      loreEn: 'Who decided that “here” must still be you?',
      rewardZh: '棱光印记 ×1',
    },
    {
      id: 'echoRelay', num: 14, icon: 'echo', color: '#ffd966',
      zh: '回响接力', en: 'ECHO RELAY', goal: 1,
      hintZh: '踩上自己的回响分身头顶，再在空中击败一名敌人。',
      hintEn: 'Stomp your own Echo, then defeat a foe before landing.',
      loreZh: '过去的你，也会替现在的你垫一脚。',
      loreEn: 'Your past self will lend your present self a step.',
      rewardZh: '棱光印记 ×1',
    },
    {
      id: 'chronoParry', num: 15, icon: 'clock', color: '#7ef0e0',
      zh: '时停弹反', en: 'CHRONO PARRY', goal: 1,
      hintZh: '在子弹时间中踩踏或冲刺弹反一枚能量弹。',
      hintEn: 'Deflect an energy orb during bullet time.',
      loreZh: '当世界慢下来，危险也能成为武器。',
      loreEn: 'When the world slows, danger becomes a weapon.',
      rewardZh: '棱光印记 ×1',
    },
    {
      id: 'prismResonance', num: 16, icon: 'prism', color: '#ffe1ff',
      zh: '万象共鸣', en: 'PRISM RESONANCE', goal: 6,
      hintZh: '30 秒内依次使用四种形态、回响与子弹时间。',
      hintEn: 'Within 30s, use all four forms, your Echo, and bullet time.',
      loreZh: '四色归一，万象发出同一个音。',
      loreEn: 'Four hues become one; all things resound as a single note.',
      rewardZh: '真实结局条件之一',
    },
  ];

  const BY_ID = {};
  DEFS.forEach((d) => (BY_ID[d.id] = d));

  const Chains = {
    defs: DEFS,
    byId: BY_ID,
    game: null,
    state: {},
    milestoneShown: {},
    initialized: false,

    init(game) {
      this.game = game;
      if (this.initialized) return;
      this.initialized = true;
      for (const d of DEFS) this.resetState(d.id);
      const n = this.countDone();
      for (const m of [4, 8, 12, 16]) if (n >= m) this.milestoneShown[m] = true;
      this.bindEvents();
    },

    resetState(id) {
      this.state[id] = { progress: 0, startedAt: 0, meta: {}, last: 0 };
    },
    resetAllTransient() {
      for (const d of DEFS) {
        if (this.isDone(d.id)) continue;
        this.resetState(d.id);
      }
    },
    onLevelStart() { this.resetAllTransient(); },
    onPlayerDeath() { this.resetAllTransient(); },

    isDone(id) {
      return !!(PB.Save.data.chains && PB.Save.data.chains[id] && PB.Save.data.chains[id].done);
    },
    countDone() {
      return DEFS.filter((d) => this.isDone(d.id)).length;
    },
    progressOf(id) {
      const def = BY_ID[id];
      const st = this.state[id];
      if (!def) return 0;
      if (this.isDone(id)) return 1;
      return U.clamp((st ? st.progress : 0) / def.goal, 0, 1);
    },
    getState(id) { return this.state[id] || { progress: 0 }; },

    complete(id, detail) {
      const def = BY_ID[id];
      if (!def || this.isDone(id)) return;
      PB.Save.data.chains = PB.Save.data.chains || {};
      PB.Save.data.chains[id] = { done: true, date: Date.now(), count: (PB.Save.data.chains[id] && PB.Save.data.chains[id].count || 0) + 1 };
      PB.Save.save();
      const st = this.state[id];
      if (st) st.progress = def.goal;
      if (this.game) this.game.onChainComplete(def, detail);
      Events.emit('chain:complete', { id, def });
      this.checkMilestone();
    },

    setProgress(id, v, meta) {
      const def = BY_ID[id];
      if (!def || this.isDone(id)) return;
      const st = this.state[id];
      st.progress = Math.min(def.goal, v);
      if (meta) Object.assign(st.meta, meta);
      if (st.progress >= def.goal) this.complete(id);
      else if (this.game) this.game.onChainProgress(def, st.progress);
    },

    addProgress(id, n, meta) {
      const def = BY_ID[id];
      if (!def || this.isDone(id)) return;
      const st = this.state[id];
      this.setProgress(id, st.progress + n, meta);
    },

    checkMilestone() {
      const n = this.countDone();
      const milestones = [4, 8, 12, 16];
      for (const m of milestones) {
        if (n >= m && !this.milestoneShown[m]) {
          this.milestoneShown[m] = true;
          if (this.game) this.game.onChainMilestone(m);
        }
      }
    },

    // ------------------------------------------------------------------ events
    bindEvents() {
      const on = (evt, fn) => Events.on(evt, (d) => {
        const p = this.game && this.game.player;
        if (!p && !['chain'].includes(evt)) return;
        fn(d || {}, p);
      });

      on('vine:burn', (d) => {
        if (!this.isDone('firstSpark')) this.setProgress('firstSpark', 1);
      });
      on('barrel:ignite', () => {
        if (!this.isDone('firstSpark')) this.setProgress('firstSpark', 1);
      });
      on('barrel:explode', (d) => {
        // 连环炽爆
        if (this.isDone('chainBlaze')) return;
        const st = this.state.chainBlaze;
        const now = performance.now() / 1000;
        if (!st.meta.times) st.meta.times = [];
        st.meta.times = st.meta.times.filter((t) => now - t < 1.2);
        st.meta.times.push(now);
        this.setProgress('chainBlaze', st.meta.times.length);
      });
      on('steam:enter', () => {
        const st = this.state.steamrise;
        st.meta.startY = this.game.player.y;
        st.meta.active = true;
      });
      on('steam:exit', (d) => {
        if (this.isDone('steamrise')) return;
        if (!d || !d.rise) return;
        if (d.rise >= 52) this.setProgress('steamrise', 1);
      });
      on('frost:step', (d) => {
        if (this.isDone('frostspan')) return;
        const st = this.state.frostspan;
        if (!st.meta.tiles) st.meta.tiles = new Map();
        const now = performance.now() / 1000;
        st.meta.tiles.set(`${d.tx},${d.ty}`, now);
        for (const [k, t] of st.meta.tiles) if (now - t > 8) st.meta.tiles.delete(k);
        this.setProgress('frostspan', st.meta.tiles.size);
      });
      on('obsidian:stand', () => this.setProgress('obsidianForge', 1));
      on('lantern:bounce', () => {
        if (this.isDone('lanternAscent')) return;
        const st = this.state.lanternAscent;
        const now = performance.now() / 1000;
        st.meta.lastBounce = now;
        st.meta.bounces = (st.meta.bounces || 0) + 1;
        this.setProgress('lanternAscent', st.meta.bounces);
      });
      on('player:land', (d) => {
        const st = this.state.lanternAscent;
        if (d && d.ground === 'lantern') return; // 踩在灯笼灵上不算落地
        if (st && st.meta.lastBounce && performance.now() / 1000 - st.meta.lastBounce > 1.2) {
          st.meta.bounces = 0;
          if (!this.isDone('lanternAscent')) st.progress = 0;
        }
      });
      on('ice:kick', () => {
        const st = this.state.iceBowling;
        st.meta.kickAt = performance.now() / 1000;
        st.meta.hits = 0;
      });
      on('ice:bowling', (d) => {
        const st = this.state.iceBowling;
        if (!st.meta.kickAt || performance.now() / 1000 - st.meta.kickAt > 2.5) return;
        st.meta.hits = (st.meta.hits || 0) + (d.count || 1);
        this.setProgress('iceBowling', st.meta.hits);
      });
      on('ice:cradle', () => this.setProgress('iceCradle', 1));
      on('player:waveslide', (d) => {
        const st = this.state.waveSlide;
        st.meta.start = performance.now() / 1000;
        st.meta.x = this.game.player.x;
      });
      on('player:land', () => {
        if (this.isDone('waveSlide')) return;
        const st = this.state.waveSlide;
        if (!st.meta.start) return;
        const dt = performance.now() / 1000 - st.meta.start;
        const dx = Math.abs(this.game.player.x - (st.meta.x || 0));
        if (dt > 0.5 && dx > 42) this.setProgress('waveSlide', 1);
        st.meta.start = 0;
      });
      on('cracked:break', () => {
        const st = this.state.groundbreaker;
        st.meta.crackAt = performance.now() / 1000;
        st.meta.kills = 0;
        this.setProgress('groundbreaker', 1);
      });
      on('enemy:kill', (d) => {
        const st = this.state.groundbreaker;
        if (st.meta.crackAt && performance.now() / 1000 - st.meta.crackAt < 2.2) {
          this.setProgress('groundbreaker', 2);
        }
        if (this.game.player && this.game.player.grav < 0) {
          this.setProgress('invertedAmbush', 1);
        }
      });
      on('barrel:flip', () => {
        this.state.antigravityFireworks.meta.flipAt = performance.now() / 1000;
      });
      on('barrel:explode', () => {
        const st = this.state.antigravityFireworks;
        if (st.meta.flipAt && performance.now() / 1000 - st.meta.flipAt < 5) this.setProgress('antigravityFireworks', 1);
      });
      on('player:warpSwap', () => this.setProgress('quantumSwap', 1));
      on('echo:headBounce', () => {
        const st = this.state.echoRelay;
        st.meta.echoAt = performance.now() / 1000;
      });
      on('player:stomp', () => {
        const st = this.state.echoRelay;
        if (st.meta.echoAt && performance.now() / 1000 - st.meta.echoAt < 4) this.setProgress('echoRelay', 1);
      });
      on('orb:deflect', (d) => {
        if (d && d.slow) this.setProgress('chronoParry', 1);
      });
      on('player:skill', (d) => this.onResonance('form:' + d.form));
      on('echo:finish', () => this.onResonance('echo'));
      on('bullet:on', () => this.onResonance('bullet'));
      on('player:died', () => this.resetAllTransient());
      on('level:start', () => this.resetAllTransient());
    },

    onResonance(key) {
      if (this.isDone('prismResonance')) return;
      const st = this.state.prismResonance;
      const now = performance.now() / 1000;
      if (!st.meta.events) st.meta.events = new Map();
      st.meta.events.set(key, now);
      for (const [k, t] of st.meta.events) if (now - t > 30) st.meta.events.delete(k);
      const need = ['form:solar', 'form:cryo', 'form:grav', 'form:warp', 'echo', 'bullet'];
      const have = need.filter((k) => st.meta.events.has(k)).length;
      this.setProgress('prismResonance', have);
    },

    // ------------------------------------------------------------------ rewards
    rewards() {
      const n = this.countDone();
      return [
        { at: 4, id: 'trail1', zh: '棱光尾迹', en: 'PRISM TRAIL', done: n >= 4 },
        { at: 8, id: 'aura1', zh: '回响光晕', en: 'ECHO AURA', done: n >= 8 },
        { at: 12, id: 'gold1', zh: '鎏金围巾', en: 'GILDED SCARF', done: n >= 12 },
        { at: 16, id: 'true', zh: '真实终章', en: 'TRUE FINALE', done: n >= 16 },
      ];
    },

    serializeProgress() {
      const out = {};
      for (const d of DEFS) {
        out[d.id] = {
          done: this.isDone(d.id),
          progress: this.progressOf(d.id),
        };
      }
      return out;
    },
  };

  PB.Chains = Chains;
})();
