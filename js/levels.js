/* ============================================================
   levels.js — 四章主题关卡 + 沙盒
   地图用小型构建器拼装：地形、危险、装饰与实体坐标
   全部以代码描述，ZERO external assets。
   ============================================================ */
(function () {
  'use strict';
  const PB = window.PB;

  const H = 28;

  class MapBuilder {
    constructor(w = 60, h = H) {
      this.w = w;
      this.h = h;
      this.grid = Array.from({ length: h }, () => Array(w).fill('.'));
      this.ents = [];
    }
    set(x, y, ch) {
      if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
      this.grid[y][x] = ch;
    }
    get(x, y) {
      if (x < 0 || x >= this.w || y < 0 || y >= this.h) return '.';
      return this.grid[y][x];
    }
    fill(x, y, w, h, ch) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, ch);
      return this;
    }
    clear(x, y, w, h) { return this.fill(x, y, w, h, '.'); }
    ground(x, w, top = 22, ch = '#') { return this.fill(x, top, w, this.h - top, ch); }
    platform(x, y, w, ch = '=') { return this.fill(x, y, w, 1, ch); }
    spikes(x, y, w, dir = 'up') {
      const ch = dir === 'up' ? '^' : dir === 'down' ? 'v' : dir === 'left' ? '<' : '>';
      return this.fill(x, y, w, 1, ch);
    }
    water(x, y, w, h) { return this.fill(x, y, w, h, '~'); }
    lava(x, y, w, h) { return this.fill(x, y, w, h, '!'); }
    vine(x, y, w, h) { return this.fill(x, y, w, h, '%'); }
    cracks(x, y, w, h) { return this.fill(x, y, w, h, 'c'); }
    fake(x, y, w, h) { return this.fill(x, y, w, h, '?'); }
    pillar(x, y, w, h, ch = '#') { return this.fill(x, y, w, h, ch); }
    spring(x, y, meteor = false) { return this.set(x, y, meteor ? 'M' : 'S'); }
    rail(x, y, w) { for (let i = 0; i < w; i++) this.set(x + i, y, '_'); return this; }
    ent(type, tx, ty, ...args) {
      this.ents.push({ type, tx, ty, args });
      return this;
    }
    shardRow(x, y, n, step = 1) {
      for (let i = 0; i < n; i++) this.ent('shard', x + i * step, y);
      return this;
    }
    shardArc(x, y, n, step = 1, rise = 0.5) {
      for (let i = 0; i < n; i++) {
        const yy = Math.round(y - Math.sin((i / Math.max(1, n - 1)) * Math.PI) * rise * n * 0.35);
        this.ent('shard', x + i * step, yy);
      }
      return this;
    }
    rows() {
      const rows = this.grid.map((r) => r.join(''));
      if (rows.length !== this.h) throw new Error('map height mismatch');
      return rows;
    }
    section() {
      return { w: this.w, h: this.h, rows: this.rows(), ents: this.ents };
    }
  }

  // ---------------------------------------------------------------- sign copy
  const SIGNS = {
    move: {
      zh: '← → 移动 · Space 跳跃\n按住跳跃键可以跳得更高',
      en: 'MOVE ← →   JUMP SPACE\nHOLD JUMP TO SOAR HIGHER',
    },
    jumpGap: {
      zh: '缺口并不可怕，助跑起跳。\n空中再按一次跳跃，可旋身二段跳。',
      en: 'RUN, THEN LEAP.\nPRESS JUMP IN AIR TO SPIN AGAIN.',
    },
    wall: {
      zh: '贴墙下滑时按跳跃蹬墙。\n左右交替，能一直向上。',
      en: 'SLIDE ON A WALL, THEN JUMP OFF.\nALTERNATE WALLS TO CLIMB.',
    },
    slide: {
      zh: '奔跑中按 ↓ 滑铲。\n压低身体，钻过一格高的窄洞。',
      en: 'PRESS ↓ WHILE RUNNING TO SLIDE.\nSLIP THROUGH ONE-TILE GAPS.',
    },
    dash: {
      zh: 'Shift + 方向 八向冲刺。\n滑铲中起跳，会化作超速的滑铲跃冲。',
      en: 'SHIFT + DIRECTION: EIGHT-WAY DASH.\nJUMP FROM A SLIDE FOR A WAVE-SLIDE.',
    },
    solar: {
      zh: '烈焰火花 · 按 J 投出弹跳火球\n点燃藤蔓，引爆桶，落入水中会升起蒸汽柱。',
      en: 'SOLAR SPARK · J THROWS A BOUNCING EMBER.\nBURN VINES · CHAIN BARRELS · STEAM WATER.',
    },
    vines: {
      zh: '枯藤挡住了去路。\n用一枚火球，把它们烧成通路。',
      en: 'DEAD VINES BAR THE WAY.\nONE EMBER WILL TURN THEM TO ASH.',
    },
    barrel: {
      zh: '炸药桶会被火球点燃，并引爆附近的桶。\n连锁爆炸可以震开裂缝岩层。',
      en: 'EMBER IGNITES BARRELS; BLASTS CHAIN.\nCHAINED BLASTS SHATTER CRACKED STONE.',
    },
    echo: {
      zh: '回响祭坛 · 获得「回响分身」\n点按 F 录制 4 秒；金色分身会复刻你的路径与元素技能。',
      en: 'ECHO SHRINE · GAIN THE ECHO CLONE.\nTAP F TO RECORD 4s; THE GOLDEN YOU REPLAYS IT.',
    },
    plateDoor: {
      zh: '石门的机关需要持续的重量。\n让回响分身替你站上压力板，再穿过门。',
      en: 'THE DOOR NEEDS CONTINUOUS WEIGHT.\nLET YOUR ECHO HOLD THE PLATE.',
    },
    pound: {
      zh: '空中按 Shift + ↓ 陨石砸地。\n震飞敌人，砸碎脚下的裂缝地板。',
      en: 'IN AIR, SHIFT + ↓ FOR A METEOR POUND.\nSHOCKWAVE FOES, SMASH CRACKED FLOORS.',
    },
    moving: {
      zh: '移动平台不会等你。\n算好节奏，借力越过深渊。',
      en: 'THE PLATFORM WAITS FOR NO ONE.\nRIDE ITS RHYTHM ACROSS.',
    },
    steam: {
      zh: '火球击入水面，会蒸腾出一根托举之柱。\n乘着蒸汽，登上本来够不到的高处。',
      en: 'AN EMBER IN WATER RAISES A STEAM COLUMN.\nRIDE IT TO UNREACHABLE HEIGHTS.',
    },
    goal: {
      zh: '棱镜门已苏醒。\n穿过它，前往下一片失色的土地。',
      en: 'THE PRISM GATE AWAKENS.\nSTEP THROUGH TO THE NEXT FADED LAND.',
    },
    cryo: {
      zh: '霜晶形态 · 按 J 释放霜华脉冲\n冻结水面、熔岩、灯笼灵与敌人。空中 ↓+J 凝结冰台。',
      en: 'CRYO CRYSTAL · J RELEASES A FROST PULSE.\nFREEZE WATER, LAVA, LANTERNS, FOES. ↓+J ICE STEP.',
    },
    water: {
      zh: '深水会吞没旅人。\n用霜华脉冲把水面冻成一座霜晶浮桥。',
      en: 'DEEP WATER SWALLOWS TRAVELERS.\nFREEZE IT INTO A FROST BRIDGE.',
    },
    lava: {
      zh: '熔岩过于炽热，无法触碰。\n霜晶能把它凝成短暂的黑曜石板。',
      en: 'LAVA IS CERTAIN DEATH.\nCRYO COOLS IT INTO BRIEF OBSIDIAN.',
    },
    lantern: {
      zh: '火焰灯笼灵可以被驯服。\n冻结后它会成为会弹跳的悬浮踏板。',
      en: 'FLAME LANTERNS CAN BE TAMED.\nFROZEN, THEY BECOME BOUNCING STEPS.',
    },
    iceBowling: {
      zh: '被冰封的敌人是完美的保龄球。\n滑铲或冲刺把它踢出去，撞倒同伴。',
      en: 'FROZEN FOES MAKE PERFECT BOWLING BALLS.\nSLIDE OR DASH TO KICK THEM INTO OTHERS.',
    },
    cart: {
      zh: '熔核矿车 · 触碰即上车\n← → 加速 / 减速，Space 跳跃，↓ 下车。',
      en: 'CINDER CART · TOUCH TO RIDE.\n←→ THROTTLE · SPACE JUMP · ↓ DISMOUNT.',
    },
    grav: {
      zh: '星蚀重力 · 点按 J 翻转自身重力\n↓+J 重力脉冲可翻转敌人、木箱与炸药桶。',
      en: 'GRAVITON VOID · J INVERTS YOUR GRAVITY.\n↓+J PULSES FOES, CRATES AND BARRELS UPSIDE DOWN.',
    },
    flip: {
      zh: '天穹也是地面。\n翻转重力，倒悬行走，再从上方奇袭。',
      en: 'THE SKY IS ALSO A FLOOR.\nINVERT, WALK UPSIDE DOWN, STRIKE FROM ABOVE.',
    },
    chrono: {
      zh: '时砂祭坛 · 获得「子弹时间」\n按住 L 或 V 减速世界；在时停中踩踏/冲刺弹反能量弹。',
      en: 'CHRONO SHRINE · GAIN BULLET TIME.\nHOLD L / V TO SLOW THE WORLD. DEFLECT ORBS.',
    },
    glider: {
      zh: '霜翼滑翔翼 · 触碰即乘\n按住跳跃借上升气流爬升，↓ 俯冲加速。',
      en: 'FROSTWING GLIDER · TOUCH TO RIDE.\nHOLD JUMP TO RIDE UPDRAFTS · ↓ TO DIVE.',
    },
    warp: {
      zh: '星隙折跃 · 按 J 抛出星棱，再按 J 瞬移\n保留动量；钉在敌人/桶上时与其量子换位。',
      en: 'WARP PRISM · J THROWS A STAR-PRISM; J AGAIN WARPS.\nKEEP MOMENTUM. SWAP WITH WHAT IT STICKS TO.',
    },
    fake: {
      zh: '有些墙只是世界的一道褶。\n星隙形态下，假墙会泛起翡翠微光。',
      en: 'SOME WALLS ARE ONLY A FOLD IN THE WORLD.\nIN WARP FORM, FALSE WALLS SHIMMER EMERALD.',
    },
    mech: {
      zh: '棱镜机兵 · 触碰即驾驶\nJ 发射棱镜炮，Shift 冲撞，能硬闯尖刺与路障。',
      en: 'PRISM STRIDER · TOUCH TO PILOT.\nJ FIRES THE PRISM CANNON · SHIFT RAMS.',
    },
    turret: {
      zh: '棱镜炮塔会发射可弹反的能量弹。\n按住 L/V 减速，踩踏或冲刺把它打回去。',
      en: 'TURRETS FIRE DEFLECTABLE ORBS.\nHOLD L/V TO SLOW TIME; STOMP OR DASH THEM BACK.',
    },
    barrelFlip: {
      zh: '重力脉冲会让炸药桶向上坠落。\n让它撞上天花板，炸开上方的裂岩。',
      en: 'A GRAVITY PULSE SENDS BARRELS FALLING UPWARD.\nLET IT BURST AGAINST THE CRACKED CEILING.',
    },
    meteor: {
      zh: '陨石弹簧：普通落地会弹起。\n空中 Shift+↓ 砸上去，触发双倍弹射。',
      en: 'METEOR SPRING: LAND TO BOUNCE.\nPOUND ONTO IT (SHIFT+DOWN) FOR A DOUBLE LAUNCH.',
    },
    warpGap: {
      zh: '缺口太宽，跳不过去。\n抛出星棱，再按 J，让距离折叠。',
      en: 'THE GAP IS TOO WIDE.\nTHROW A STAR-PRISM, PRESS J, AND FOLD THE DISTANCE.',
    },
    bossGate: {
      zh: '大棱镜就在前方。\n它已经等了很久。',
      en: 'THE GRAND PRISM LIES AHEAD.\nIT HAS BEEN WAITING A LONG TIME.',
    },
  };

  function sec(w, fn) {
    const b = new MapBuilder(w, H);
    fn(b);
    return b.section();
  }

  // ================================================================ CHAPTER 1
  const ch1s1 = sec(60, (b) => {
    b.ground(0, 20, 22);
    b.ground(23, 37, 22);
    // 教学平台与墙跳塔
    b.platform(12, 19, 4, '=');
    b.pillar(27, 13, 2, 7);
    b.pillar(34, 13, 2, 7);
    b.platform(30, 12, 3, '=');
    // 神殿与藤蔓、炸药桶
    b.ground(47, 13, 22);
    b.vine(50, 18, 3, 4);
    b.ent('shrine', 44, 22, 'solar');
    b.ent('checkpoint', 46, 22);
    b.ent('slime', 17, 22);
    b.ent('slime', 31, 22);
    b.ent('slime', 56, 22);
    b.ent('barrel', 53, 22);
    b.ent('barrel', 54, 22);
    b.ent('barrel', 55, 22);
    b.ent('grand', 31, 10, 'ch1a');
    b.ent('shard', 31, 11);
    b.ent('sign', 4, 22, 'move');
    b.ent('sign', 10, 22, 'jumpGap');
    b.ent('sign', 25, 22, 'wall');
    b.ent('sign', 47, 22, 'solar');
    b.ent('sign', 49, 22, 'vines');
    b.shardRow(5, 20, 3);
    b.shardRow(13, 17, 3);
    b.shardRow(30, 10, 2);
    b.shardRow(40, 20, 3);
    b.shardRow(51, 16, 3);
    b.ent('start', 3, 22);
  });

  const ch1s2 = sec(60, (b) => {
    b.ground(0, 21, 22);
    b.ground(32, 28, 22);
    // 滑铲窄洞
    b.fill(8, 20, 13, 1, '#');
    // 冲刺深沟
    b.ground(21, 6, 22);
    // 墙跳塔（秘藏）
    b.pillar(37, 12, 2, 8);
    b.pillar(42, 12, 2, 8);
    b.platform(39, 11, 2, '=');
    // 回响祭坛与配重门
    b.ground(44, 16, 22);
    // 门墙：两侧石柱与门楣，只有开启配重门才能通过
    b.fill(53, 14, 1, 8, '#');
    b.fill(55, 14, 1, 8, '#');
    b.fill(54, 14, 1, 5, '#');
    b.fill(53, 19, 1, 3, '#');
    b.fill(55, 19, 1, 3, '#');
    b.ent('shrine', 47, 22, 'echo');
    b.ent('plate', 50, 22, 'ch1door');
    b.ent('door', 54, 22, 'ch1door', 3);
    b.ent('checkpoint', 57, 22);
    b.ent('grand', 40, 9, 'ch1b');
    b.ent('shard', 12, 21);
    b.ent('shard', 14, 21);
    b.ent('shard', 16, 21);
    b.ent('shard', 24, 17);
    b.ent('shard', 27, 16);
    b.ent('shard', 30, 17);
    b.ent('slime', 23, 22);
    b.ent('bat', 34, 12);
    b.ent('slime', 45, 22);
    b.ent('sign', 3, 22, 'slide');
    b.ent('sign', 22, 22, 'dash');
    b.ent('sign', 36, 22, 'wall');
    b.ent('sign', 48, 22, 'echo');
    b.ent('sign', 49, 22, 'plateDoor');
    b.shardRow(9, 21, 3);
    b.shardRow(33, 20, 3, 1);
    b.ent('start', 3, 22, true);
  });

  const ch1s3 = sec(60, (b) => {
    b.ground(0, 21, 22);
    // 裂地密室
    b.cracks(8, 22, 3, 1);
    b.clear(4, 23, 13, 4);
    b.fill(4, 27, 13, 1, '#');
    b.fill(3, 23, 1, 4, '#');
    b.fill(17, 23, 1, 4, '#');
    b.spring(9, 26, false);
    b.ent('slime', 13, 27);
    b.ent('grand', 10, 25, 'ch1c');
    b.shardRow(7, 25, 3);
    // 中段沟壑 + 移动平台
    b.clear(22, 22, 14, 6);
    b.spikes(22, 27, 14, 'up');
    b.ent('movingPlatform', 25, 20, 4, 3, 0, 4.2, 0);
    b.ent('movingPlatform', 32, 18, 3, 2.5, 1, 3.6, 0.45);
    b.ground(36, 24, 22);
    b.spring(39, 22, true);
    b.ent('sign', 37, 22, 'meteor');
    // 蒸汽秘径
    b.clear(43, 22, 3, 5);
    b.water(43, 24, 3, 4);
    b.spikes(43, 23, 3, 'down');
    b.platform(41, 13, 6, '=');
    b.ent('shard', 43, 12);
    b.ent('shard', 44, 12);
    b.ent('shard', 45, 12);
    // 终段
    b.vine(50, 18, 2, 4);
    b.ent('slime', 49, 22);
    b.ent('wisp', 34, 17);
    b.ent('slime', 39, 22);
    b.ent('bat', 48, 13);
    b.ent('barrel', 40, 22);
    b.ent('barrel', 41, 22);
    b.ent('checkpoint', 38, 22);
    b.ent('portal', 55, 22, 'ch1');
    b.ent('sign', 2, 22, 'pound');
    b.ent('sign', 20, 22, 'moving');
    b.ent('sign', 42, 22, 'steam');
    b.ent('sign', 52, 22, 'goal');
    b.shardRow(30, 16, 3);
    b.shardRow(45, 20, 3);
    b.ent('start', 3, 22, true);
  });

  // ================================================================ CHAPTER 2
  const ch2s1 = sec(72, (b) => {
    b.ground(0, 72, 22);
    // 与地面齐平的液面：冻结后直接成为可行走的桥
    b.clear(17, 22, 4, 6); b.water(17, 22, 4, 6);
    b.clear(39, 22, 4, 6); b.lava(39, 22, 4, 6);
    // 灯笼高台与冰晶洞
    b.platform(24, 19, 3, '=');
    b.platform(28, 16, 4, '=');
    b.pillar(46, 19, 2, 3);
    // 铜线激光门
    b.fill(65, 17, 1, 5, '#');
    b.fill(67, 17, 1, 5, '#');
    b.ent('shrine', 5, 22, 'cryo');
    b.ent('sign', 3, 22, 'cryo');
    b.ent('sign', 15, 22, 'water');
    b.ent('sign', 25, 22, 'lantern');
    b.ent('sign', 27, 22, 'iceBowling');
    b.ent('sign', 37, 22, 'lava');
    b.ent('sign', 59, 22, 'coil');
    b.ent('checkpoint', 13, 22);
    b.ent('checkpoint', 56, 22);
    b.ent('slime', 28, 22);
    b.ent('slime', 30, 22);
    b.ent('slime', 32, 22);
    b.ent('bat', 35, 11);
    b.ent('wisp', 41, 15);
    b.ent('lantern', 26, 17);
    b.ent('lantern', 44, 15);
    b.ent('fossil', 48, 22);
    b.ent('fossil', 50, 22);
    b.ent('iceblock', 51, 22);
    b.ent('barrel', 34, 22);
    b.ent('barrel', 35, 22);
    b.ent('coil', 61, 20, 'ch2gate');
    b.ent('gate', 66, 22, 'ch2gate', 5, 'v');
    b.ent('grand', 31, 13, 'ch2a');
    b.ent('start', 3, 22);
    b.shardRow(18, 20, 2);
    b.shardRow(29, 14, 3);
    b.shardRow(40, 20, 2);
    b.shardRow(48, 16, 3);
    b.ent('shard', 63, 18);
  });

  const ch2s2 = sec(72, (b) => {
    b.ground(0, 17, 22);
    // 熔岩湖与三座石岛：更长的矿车助跑线
    b.clear(17, 22, 31, 6);
    b.lava(17, 22, 31, 6);
    b.ground(20, 5, 21);
    b.ground(29, 5, 20);
    b.ground(38, 5, 19);
    b.ground(48, 24, 22);
    b.rail(0, 21, 17);
    b.rail(20, 20, 5);
    b.rail(29, 19, 5);
    b.rail(38, 18, 5);
    b.rail(48, 21, 24);
    b.ent('checkpoint', 4, 22);
    b.ent('sign', 6, 22, 'cart');
    b.ent('cartMount', 7, 22);
    b.ent('barrel', 22, 21);
    b.ent('barrel', 23, 21);
    b.ent('slime', 31, 20);
    b.ent('barrel', 40, 19);
    b.ent('barrel', 41, 19);
    b.ent('bat', 34, 12);
    b.ent('checkpoint', 40, 19);
    b.ent('checkpoint', 51, 22);
    b.ent('sign', 53, 22, 'lantern');
    b.ent('lantern', 56, 15);
    b.ent('lantern', 59, 15);
    b.platform(54, 17, 3, '=');
    b.platform(58, 13, 3, '=');
    b.ent('grand', 58, 8, 'ch2b');
    b.ent('iceblock', 64, 22);
    b.ent('fossil', 66, 22);
    b.ent('start', 3, 22);
    b.shardRow(19, 18, 3);
    b.shardRow(30, 16, 3);
    b.shardRow(55, 11, 2);
    b.shardRow(62, 19, 3);
  });

  const ch2s3 = sec(72, (b) => {
    b.ground(0, 9, 22);
    b.clear(9, 22, 8, 6); b.water(9, 22, 8, 6);
    b.ground(17, 4, 22);
    b.clear(21, 22, 5, 6); b.lava(21, 22, 5, 6);
    b.ground(26, 10, 22);
    b.platform(30, 18, 4, '=');
    b.platform(36, 15, 5, '=');
    b.ground(41, 31, 22);
    b.clear(48, 22, 6, 6); b.lava(48, 22, 6, 6);
    b.ent('movingPlatform', 49, 19, 3, 3, 0, 4.4, 0.15);
    b.ground(54, 18, 22);
    b.ent('checkpoint', 5, 22);
    b.ent('checkpoint', 27, 22);
    b.ent('checkpoint', 57, 22);
    b.ent('sign', 7, 22, 'water');
    b.ent('sign', 19, 22, 'lava');
    b.ent('sign', 29, 22, 'lantern');
    b.ent('sign', 46, 22, 'moving');
    b.ent('sign', 65, 22, 'goal');
    b.ent('lantern', 32, 16);
    b.ent('lantern', 37, 13);
    b.ent('fossil', 43, 22);
    b.ent('fossil', 44, 22);
    b.ent('iceblock', 46, 22);
    b.ent('slime', 33, 22);
    b.ent('bat', 50, 13);
    b.ent('portal', 68, 22, 'ch2');
    b.ent('grand', 38, 12, 'ch2c');
    b.ent('start', 3, 22);
    b.shardRow(10, 20, 2);
    b.shardRow(31, 16, 3);
    b.shardRow(50, 16, 2);
    b.shardRow(59, 20, 3);
  });

  // ================================================================ CHAPTER 3
  const ch3s1 = sec(72, (b) => {
    b.ground(0, 21, 22);
    // 深渊与悬浮天花板：翻转重力沿天花背面行走
    b.clear(21, 22, 12, 6);
    b.spikes(21, 27, 12, 'up');
    b.fill(18, 9, 15, 2, '#');
    b.ground(33, 39, 22);
    // 裂岩穹顶：用重力脉冲把桶送上去炸开
    b.cracks(36, 14, 4, 2);
    b.ent('barrel', 37, 22);
    b.ent('shrine', 5, 22, 'grav');
    b.ent('sign', 3, 22, 'grav');
    b.ent('sign', 16, 22, 'flip');
    b.ent('sign', 33, 22, 'barrelFlip');
    b.ent('checkpoint', 9, 22);
    b.ent('checkpoint', 34, 22);
    b.ent('wisp', 26, 16);
    b.ent('bat', 28, 7);
    b.ent('crate', 34, 22);
    b.ent('checkpoint', 49, 22);
    b.ent('chronoShrine', 52, 22);
    b.ent('sign', 50, 22, 'chrono');
    b.ent('turret', 60, 15);
    b.ent('sign', 56, 22, 'turret');
    b.ent('checkpoint', 68, 22);
    b.ent('grand', 37, 11, 'ch3a');
    b.ent('start', 3, 22);
    b.shardRow(23, 14, 3);
    b.shardRow(38, 11, 3);
    b.shardRow(56, 18, 3);
    b.shardRow(64, 18, 3);
  });

  const ch3s2 = sec(72, (b) => {
    b.ground(0, 19, 22);
    b.clear(19, 22, 14, 6);
    b.spikes(19, 27, 14, 'up');
    b.fill(16, 10, 17, 2, '#');
    b.platform(22, 18, 3, '=');
    b.platform(28, 16, 3, '=');
    b.ground(33, 39, 22);
    // 配重门墙
    b.fill(47, 14, 1, 8, '#');
    b.fill(49, 14, 1, 8, '#');
    b.fill(48, 14, 1, 5, '#');
    b.fill(47, 19, 1, 3, '#');
    b.fill(49, 19, 1, 3, '#');
    b.ent('checkpoint', 15, 22);
    b.ent('checkpoint', 36, 22);
    b.ent('checkpoint', 66, 22);
    b.ent('sign', 16, 22, 'flip');
    b.ent('sign', 42, 22, 'plateDoor');
    b.ent('sign', 54, 22, 'turret');
    b.ent('plate', 44, 22, 'ch3door');
    b.ent('door', 48, 22, 'ch3door', 3);
    b.ent('turret', 58, 14);
    b.ent('crate', 34, 22);
    b.ent('barrel', 38, 22);
    b.ent('bat', 25, 8);
    b.ent('grand', 24, 13, 'ch3b');
    b.ent('start', 3, 22);
    b.shardRow(24, 17, 3);
    b.shardRow(35, 13, 3);
    b.shardRow(55, 18, 3);
    b.shardRow(62, 19, 2);
  });

  const ch3s3 = sec(80, (b) => {
    b.ground(0, 12, 22);
    b.ground(66, 14, 22);
    b.clear(12, 22, 54, 6);
    b.spikes(12, 27, 54, 'up');
    // 半途的空中平台
    b.fill(36, 14, 4, 2, '#');
    b.ent('checkpoint', 4, 22);
    b.ent('sign', 6, 22, 'glider');
    b.ent('gliderMount', 8, 21);
    b.ent('ring', 18, 13, 2);
    b.ent('ring', 26, 9, 2);
    b.ent('ring', 33, 13, 2);
    b.ent('ring', 43, 10, 2);
    b.ent('ring', 52, 14, 2);
    b.ent('ring', 60, 8, 2);
    b.ent('checkpoint', 38, 14);
    b.ent('gliderMount', 39, 13);
    b.ent('grand', 30, 5, 'ch3c');
    b.ent('checkpoint', 68, 22);
    b.ent('portal', 75, 22, 'ch3');
    b.ent('sign', 72, 22, 'goal');
    b.ent('start', 3, 22);
    b.shardRow(20, 17, 3);
    b.shardRow(46, 16, 3);
    b.shardRow(70, 19, 3);
  });

  // ================================================================ CHAPTER 4
  const ch4s1 = sec(72, (b) => {
    b.ground(0, 32, 22);
    b.clear(32, 22, 10, 6);
    b.spikes(32, 27, 10, 'up');
    b.ground(42, 30, 22);
    // 折跃目标柱
    b.pillar(43, 19, 1, 3);
    // 假墙密室：x23 的墙体可以穿过
    b.fill(23, 17, 1, 5, '?');
    b.fill(24, 17, 3, 5, '.');
    b.fill(27, 17, 1, 5, '#');
    b.fill(23, 17, 5, 1, '#');
    b.ent('grand', 25, 20, 'ch4a');
    b.ent('shrine', 5, 22, 'warp');
    b.ent('sign', 3, 22, 'warp');
    b.ent('sign', 21, 22, 'fake');
    b.ent('sign', 30, 22, 'warpGap');
    b.ent('checkpoint', 14, 22);
    b.ent('checkpoint', 44, 22);
    b.ent('turret', 56, 15);
    b.ent('sign', 55, 22, 'turret');
    b.ent('wisp', 50, 13);
    b.ent('barrel', 58, 22);
    b.ent('barrel', 59, 22);
    b.ent('checkpoint', 66, 22);
    b.ent('start', 3, 22);
    b.shardRow(10, 20, 3);
    b.shardRow(34, 20, 3);
    b.shardRow(52, 17, 3);
    b.shardRow(62, 20, 3);
  });

  const ch4s2 = sec(72, (b) => {
    b.ground(0, 72, 22);
    b.clear(14, 22, 2, 6);
    b.spikes(14, 27, 2, 'up');
    b.spring(14, 26, false);
    b.spring(15, 26, false);
    b.clear(30, 22, 2, 6);
    b.spikes(30, 27, 2, 'up');
    b.spring(30, 26, false);
    b.spring(31, 26, false);
    b.ent('armoredWall', 24, 22, 2, 5);
    b.ent('armoredWall', 46, 22, 2, 5);
    b.ent('mechMount', 6, 22);
    b.ent('mechMount', 20, 22);
    b.ent('mechMount', 40, 22);
    b.ent('sign', 3, 22, 'mech');
    b.ent('sign', 23, 22, 'bossGate');
    b.ent('checkpoint', 4, 22);
    b.ent('checkpoint', 18, 22);
    b.ent('checkpoint', 44, 22);
    b.ent('checkpoint', 62, 22);
    b.ent('slime', 27, 22);
    b.ent('barrel', 28, 22);
    b.ent('slime', 38, 22);
    b.ent('barrel', 39, 22);
    b.platform(50, 16, 4, '=');
    b.platform(56, 13, 4, '=');
    b.ent('grand', 52, 13, 'ch4b');
    b.ent('grand', 58, 10, 'ch4c');
    b.ent('turret', 54, 18);
    b.ent('start', 3, 22, true);
    b.shardRow(22, 18, 3);
    b.shardRow(42, 18, 3);
    b.shardRow(64, 19, 3);
  });

  const ch4boss = sec(64, (b) => {
    b.ground(0, 64, 22);
    b.pillar(0, 0, 1, 28);
    b.pillar(63, 0, 1, 28);
    b.clear(22, 22, 3, 6);
    b.water(22, 22, 3, 6);
    b.clear(39, 22, 3, 6);
    b.water(39, 22, 3, 6);
    b.platform(25, 17, 4, '=');
    b.platform(35, 17, 4, '=');
    b.ent('checkpoint', 14, 22);
    b.ent('sign', 28, 22, 'bossGate');
    b.ent('bossTrigger', 32, 22, 'boss');
    b.ent('start', 3, 22, true);
    b.shardRow(20, 15, 3);
    b.shardRow(41, 15, 3);
  });

  // ================================================================ sandbox
  const sandboxSec = sec(100, (b) => {
    b.ground(0, 100, 22);
    b.clear(20, 22, 8, 6);
    b.water(20, 23, 8, 5);
    b.clear(34, 22, 8, 6);
    b.lava(34, 23, 8, 5);
    b.platform(30, 16, 3, '=');
    b.platform(45, 16, 3, '=');
    b.pillar(56, 12, 2, 8);
    b.pillar(62, 12, 2, 8);
    b.ent('shrine', 4, 22, 'solar');
    b.ent('shrine', 7, 22, 'cryo');
    b.ent('shrine', 10, 22, 'grav');
    b.ent('shrine', 13, 22, 'warp');
    b.ent('shrine', 15, 22, 'echo');
    b.ent('chronoShrine', 17, 22);
    b.ent('lantern', 29, 14);
    b.ent('lantern', 44, 14);
    b.ent('barrel', 48, 22);
    b.ent('barrel', 49, 22);
    b.ent('crate', 51, 22);
    b.ent('iceblock', 53, 22);
    b.ent('slime', 27, 22);
    b.ent('bat', 40, 12);
    b.ent('checkpoint', 30, 22);
    b.ent('cartMount', 70, 22);
    b.ent('gliderMount', 76, 18);
    b.ent('mechMount', 86, 22);
    b.ent('start', 3, 22);
    b.shardRow(20, 15, 5);
    b.ent('grand', 58, 9, 'sandbox');
  });

  // ---------------------------------------------------------------- chapters
  const CHAPTERS = [
    {
      id: 'ember', num: 1, theme: 'ember', music: 'ember', accent: '#ffb454',
      nameZh: '烬野遗迹', nameEn: 'EMBERFIELD RUINS',
      subtitleZh: '余烬之下，仍有未熄的光。',
      subtitleEn: 'Beneath the embers, a light still breathes.',
      sections: [ch1s1, ch1s2, ch1s3],
      forms: ['solar'],
    },
    {
      id: 'frost', num: 2, theme: 'frost', music: 'frost', accent: '#6ee7ff',
      nameZh: '霜火峡谷', nameEn: 'FROSTFIRE GORGE',
      subtitleZh: '一半是凝固的河，一半是燃烧的雪。',
      subtitleEn: 'Half frozen river, half burning snow.',
      sections: [ch2s1, ch2s2, ch2s3],
      forms: ['cryo'],
    },
    {
      id: 'rift', num: 3, theme: 'rift', music: 'rift', accent: '#f49cff',
      nameZh: '星隙折叠城', nameEn: 'STAR-RIFT FOLD CITY',
      subtitleZh: '城市被折进天空，重力忘了方向。',
      subtitleEn: 'The city folds into the sky; gravity forgets its way.',
      sections: [ch3s1, ch3s2, ch3s3],
      forms: ['grav'],
    },
    {
      id: 'summit', num: 4, theme: 'summit', music: 'summit', accent: '#ffd966',
      nameZh: '棱镜之巅', nameEn: 'PRISM SUMMIT',
      subtitleZh: '所有失色的光，都在这里等待归位。',
      subtitleEn: 'Every faded color waits here to return.',
      sections: [ch4s1, ch4s2, ch4boss],
      forms: ['warp'],
    },
  ];

  const SANDBOX = {
    id: 'sandbox', num: 0, theme: 'summit', music: 'summit',
    nameZh: '棱镜沙盒', nameEn: 'PRISM SANDBOX',
    subtitleZh: '测试一切。', subtitleEn: 'Test everything.',
    sections: [sandboxSec], forms: [],
  };

  // ---------------------------------------------------------------- compose
  function compose(chapter) {
    let width = 0;
    for (const s of chapter.sections) width += s.w;
    const rows = Array.from({ length: H }, () => []);
    const ents = [];
    let offset = 0;
    for (const s of chapter.sections) {
      for (let y = 0; y < H; y++) {
        rows[y].push(s.rows[y] || '.'.repeat(s.w));
      }
      for (const e of s.ents) {
        const ent = { ...e, tx: e.tx + offset };
        if (ent.type === 'start') ent.x = ent.tx;
        ents.push(ent);
      }
      offset += s.w;
    }
    return {
      chapter,
      width,
      height: H,
      rows: rows.map((r) => r.join('')),
      ents,
      pixelW: width * PB.C.TILE,
      pixelH: H * PB.C.TILE,
    };
  }

  PB.Levels = {
    H,
    MapBuilder,
    SIGNS,
    CHAPTERS,
    SANDBOX,
    compose,
    get(index) { return CHAPTERS[index]; },
    count() { return CHAPTERS.length; },
    getSign(id) { return SIGNS[id] || { zh: id, en: id }; },
  };
})();
