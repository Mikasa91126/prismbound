/* ============================================================
   sprites.js — 全部像素美术以字符画内嵌于代码
   主角、敌人、道具都支持形态调色板重映射与缓存。
   ============================================================ */
(function () {
  'use strict';
  const PB = window.PB;

  // ---------------------------------------------------------------- palettes
  const BASE = {
    O: '#080a12',
    H: '#1c2742',
    h: '#2c3b60',
    S: '#f1d2b1',
    s: '#caa584',
    E: '#fffbe8',
    W: '#ffffff',
    B: '#141a29',
    b: '#2b3552',
    G: '#f2c46a',
    g: '#b98d3f',
    R: '#e85a63',
  };

  const FORM_PAL = {
    base: { C: '#1e3350', c: '#142238', A: '#7ef0e0', a: '#3d9aab', T: '#d8fbff' },
    solar: { C: '#4a2d33', c: '#2c1a22', A: '#ff9f45', a: '#c95a2e', T: '#ffd27a' },
    cryo: { C: '#1f3350', c: '#141f34', A: '#66e6ff', a: '#2b93b8', T: '#c8fbff' },
    grav: { C: '#2b2149', c: '#1a132e', A: '#b68cff', a: '#6e49d8', T: '#e8d7ff' },
    warp: { C: '#33203f', c: '#1f1229', A: '#f49cff', a: '#a24fe0', T: '#ffe1ff' },
    echo: { C: '#4a3a1c', c: '#2e2310', A: '#ffd966', a: '#c79a2e', T: '#fff1b8', E: '#fff6c9' },
  };

  const ENEMY_PAL = {
    slime: {
      O: '#122012', C: '#4f8f4a', c: '#2f6135', A: '#8fce6a', W: '#d8ffb0', E: '#0c120c',
    },
    bat: {
      O: '#120c1e', C: '#4b3b6d', c: '#2c2147', A: '#9a7bd6', W: '#e7dcff', E: '#ff6b7d',
    },
    sentinel: {
      O: '#100e18', C: '#4b4a63', c: '#2b2a3d', A: '#c8a96a', a: '#8b6f3a', W: '#f6e6b4', E: '#ffcf6b',
    },
    lantern: {
      O: '#160f0c', C: '#8a4a2d', c: '#5c2e1c', A: '#ffb454', a: '#e37234', W: '#fff0bd', E: '#fff7dc',
    },
    cryoLantern: {
      O: '#0b1420', C: '#3a6b86', c: '#25495e', A: '#8ff5ff', a: '#3aa9c4', W: '#e8ffff', E: '#ffffff',
    },
    barrel: {
      O: '#170e08', C: '#7c4326', c: '#4f2a17', A: '#c9874b', a: '#8d5a2c', W: '#e8b36a', E: '#2b160b',
    },
    crate: {
      O: '#170f09', C: '#7a5630', c: '#4d341c', A: '#b98a4f', a: '#8c6132', W: '#e2bb7a', E: '#2b1a0d',
    },
    stone: {
      O: '#0c0d14', C: '#565b74', c: '#343849', A: '#8b91ad', a: '#656b86', W: '#d4d9e8', E: '#c4f6ff',
    },
  };

  const TAU = Math.PI * 2;

  function normalize(rows, width, height, name) {
    const out = [];
    for (let i = 0; i < height; i++) {
      let r = rows[i] == null ? '' : String(rows[i]);
      if (r.length < width) r = r + '.'.repeat(width - r.length);
      if (r.length > width) r = r.slice(0, width);
      out.push(r);
    }
    if (rows.length !== height) {
      console.warn(`[sprite] ${name}: expected ${height} rows, got ${rows.length}`);
    }
    return out;
  }

  // ---------------------------------------------------------------- player parts
  const UPPER = [
    '....OOOO....',
    '...OHHHHO...',
    '..OHHHHHHO..',
    '..OHSSSSHO..',
    '..OHSEESHO..',
    '..OHSSSSHO..',
    '...OHSSHO...',
    '...OCCCCO...',
    '.OCCAAAACCO.',
    'OCCAAAAAACCO',
    'OCCAAAAAACCO',
    '.OCCAAAACCO.',
    '..OCCCCCCO..',
    '...OCCCCCO..',
  ].map((r) => r.length === 12 ? r : r);

  const LEGS = {
    stand: [
      '...OCC..CCO.',
      '...OCC..CCO.',
      '...OBB..BBO.',
      '..OBBB..BBBO',
      '.OBBBB..BBBB',
      '..OOOO..OOOO',
    ],
    stand2: [
      '...OCC..CCO.',
      '...OCC..CCO.',
      '...OBB..BBO.',
      '..OBBO..OBBO',
      '..OOOO..OOOO',
      '............',
    ],
    run0: [
      '...OCC..CCO.',
      '..OCC....CCO',
      '..OBB....BBO',
      '.OBBBO..BBBB',
      '.OBBO....OBBO',
      '..OO......OO',
    ],
    run1: [
      '...OCC..CCO.',
      '...OCC..CCO.',
      '..OBB....BBO',
      '.OBBO....OBBO',
      '.OOO......OO.',
      '............',
    ],
    run2: [
      '...OCC..CCO.',
      '..OCC....CCO',
      '..OBB....BBO',
      '.OBBO..BBBBO',
      '.OBO....OBBO',
      '..O......OO.',
    ],
    run3: [
      '...OCC..CCO.',
      '...OCC..CCO.',
      '...OBB..BBO.',
      '..OBBO..OBBO',
      '..OOO....OOO',
      '............',
    ],
    jump: [
      '...OCC..CCO.',
      '...OCC..CCO.',
      '..OBBO..OBBO',
      '..OOOO..OOOO',
      '............',
      '............',
    ],
    fall: [
      '...OCC..CCO.',
      '..OCC....CCO',
      '..OBB....BBO',
      '.OBBO....OBBO',
      '.OOO......OO.',
      '............',
    ],
    wall: [
      '...OCC..CCO.',
      '...OCC..CCO.',
      '...OBB..BBO.',
      '..OBBBO..BBO',
      '..OBBO...OOO',
      '..OOO.......',
    ],
    dash: [
      '...OCC..CCO.',
      '..OCC...CCO.',
      '..OBB...BBO.',
      '.OBBO..BBBO.',
      '.OOO...OOOO.',
      '............',
    ],
  };

  const SLIDE = [
    '.....OOOOOO...',
    '...OOCCAAAACO.',
    '..OCCAAAAAACCO',
    '..OHSSSSSSHHO.',
    '..OHSEESSSHHO.',
    '...OHSSSSHHO..',
    '..OCCAAAAAACO.',
    '.OCCCAAAAACCO.',
    '..OBB....BBO..',
    '..OOO....OOO..',
  ];

  const SPIN = [
    '...OOOOOO...',
    '..OHHHHHHO..',
    '.OHHSSSSHHO.',
    '.OHSEESSSHO.',
    'OHHSSSSSSHHO',
    'OHSSSSSSSSHO',
    '.OHSSSSSHHO.',
    '.OCCAAAACCO.',
    '..OCCAAACCO.',
    '..OCCCCCO...',
    '...OOOOO....',
    '............',
  ];

  const SEATED = [
    '....OOOO....',
    '...OHHHHO...',
    '..OHHHHHHO..',
    '..OHSSSSHO..',
    '..OHSEESHO..',
    '..OHSSSSHO..',
    '...OHSSHO...',
    '..OCCAAAACO.',
    '.OCCAAAAAACO',
    '.OCCAAAAAACO',
    '..OCCCCCCO..',
    '...OCC..CC..',
    '...OBB..BB..',
    '...OOO..OO..',
  ];

  // ---------------------------------------------------------------- enemy art
  const ENEMY_ROWS = {
    slime: [
      '..............',
      '....OOOOOO....',
      '..OOCCCCCCCO..',
      '.OCCCCCCCCCCO.',
      '.OCCECCCCCECO.',
      'OCCCCCCCCCCCCO',
      'OCCWCCCCCCWCCO',
      'OCCCCCCCCCCCCO',
      '.OCCCCCCCCCCO.',
      '..OOOOOOOOOO..',
    ],
    slimeSquash: [
      '..............',
      '..............',
      '...OOOOOOOO...',
      '.OOCCCCCCCCCO.',
      'OCCECCCCCCCECO',
      'OCCCCCCCCCCCCO',
      'OCCWCCCCCCWCCO',
      '.OCCCCCCCCCCO.',
      '..OOOOOOOOOO..',
      '..............',
    ],
    bat: [
      '..............',
      '..OO......OO..',
      '.OAAO....OAAO.',
      'OAAAAO..OAAAAO',
      'OAAAAAOOAAAAAO',
      '.OAAACCCCCAAO.',
      '..OAAECCEAAO..',
      '...OOCCCCCOO..',
      '.....OOOO.....',
    ],
    batDown: [
      '..............',
      '..............',
      '.....OOOO.....',
      '...OOCCCCCOO..',
      '..OAAECCEAAO..',
      '.OAAACCCCCAAO.',
      'OAAAAAOOAAAAAO',
      'OAAO......OAAO',
      '.OO........OO.',
    ],
    sentinel: [
      '.....OOOOOO.....',
      '....OCCCCCCO....',
      '...OCACCCACCO...',
      '...OCCCCCCCCO...',
      '...OCCWCCWCCCO..',
      '....OCCCCCCCO...',
      '...OCCCCCCCCCO..',
      '..OCACCCCCCACCO.',
      '..OCCCCCCCCCCCO.',
      '..OCCAAAAAAACCO.',
      '..OCCAAAAAAACCO.',
      '..OCCCCCCCCCCCO.',
      '...OCCCCCCCCO...',
      '...OCC..CCCO....',
      '...OC....CCO....',
      '...OC....CCO....',
      '..OBBO..OBBO....',
      '..OBBO..OBBO....',
      '..OOOO..OOOO....',
      '................',
    ],
    barrel: [
      '...OOOOOOOO...',
      '..OACCCCCCAO..',
      '.OCCCCCCCCCCO.',
      '.OCAAAAAAAAACO',
      '.OCCCCCCCCCCO.',
      '.OCCCCCCCCCCO.',
      '.OCAAAAAAAAACO',
      '.OCCCCCCCCCCO.',
      '.OCCCCCCCCCCO.',
      '.OCAAAAAAAAACO',
      '.OCCCCCCCCCCO.',
      '..OCCCCCCCAO..',
      '...OOOOOOOO...',
      '..............',
    ],
    crate: [
      '..............',
      '.OOOOOOOOOOOO.',
      '.OCCCCCCCCCCAO',
      '.OCACCCCCCCACO',
      '.OCCCAAAAACCO.',
      '.OCCCAAAAACCO.',
      '.OCCCAAAAACCO.',
      '.OCCCCCCCCACO.',
      '.OCACCCCCCCCO.',
      '.OCCCCCCCCCAO.',
      '.OCCCCCCCCACO.',
      '.OCCCCCCCCCAO.',
      '.OOOOOOOOOOOO.',
      '..............',
    ],
    lantern: [
      '......OO......',
      '.....OAAO.....',
      '....OAAAAO....',
      '...OAAWWAAO...',
      '...OAAWWAAO...',
      '....OAAAAO....',
      '.....OAAO.....',
      '...OOOOOOOO...',
      '..OCCOOOOCCO..',
      '..OCCCCCCCCO..',
      '..OCCAAAAACCO.',
      '..OCCAAAAACCO.',
      '..OCCCCCCCCO..',
      '..OCCCCCCCCO..',
      '...OOOOOOOO...',
      '......OO......',
    ],
    checkpoint: [
      '......OO......',
      '.....OAAO.....',
      '....OAAAAO....',
      '....OAAAAO....',
      '.....OAAO.....',
      '......OO......',
      '.....OAAO.....',
      '....OAAAAO....',
      '....OAAAAO....',
      '.....OAAO.....',
      '......OO......',
      '......OO......',
      '.....OAAO.....',
      '.....OAAO.....',
      '.....OAAO.....',
      '.....OAAO.....',
      '.....OAAO.....',
      '....OAAAAO....',
      '....OAAAAO....',
      '...OAAAAAAO...',
      '...OAAAAAAO...',
      '...OOOOOOOO...',
      '....OOOOOO....',
      '..............',
    ],
    portal: [
      '..........OOOOOOOO..........',
      '.......OOOAAAAAAAAOOO.......',
      '.....OOAAAAAAAAAAAAAAOO.....',
      '....OAAAAAAAAAAAAAAAAAAO....',
      '...OAAAAAAAAAAAAAAAAAAAAO...',
      '..OAAAAAAAAAAAAAAAAAAAAAAO..',
      '..OAAAAWWWWWWWWWWWWWWAAAAO..',
      '.OAAAAWWWWWWWWWWWWWWWWAAAAO.',
      '.OAAAWWWWWWWWWWWWWWWWWWAAAO.',
      'OAAAAWWWWWWWWWWWWWWWWWWAAAAO',
      'OAAAAWWWWWWWWWWWWWWWWWWAAAAO',
      'OAAAAWWWWWWWWWWWWWWWWWWAAAAO',
      'OAAAAWWWWWWWWWWWWWWWWWWAAAAO',
      '.OAAAWWWWWWWWWWWWWWWWWWAAAO.',
      '.OAAAAWWWWWWWWWWWWWWWWAAAAO.',
      '..OAAAAWWWWWWWWWWWWWWAAAAO..',
      '..OAAAAAAAAAAAAAAAAAAAAAAO..',
      '...OAAAAAAAAAAAAAAAAAAAAO...',
      '....OAAAAAAAAAAAAAAAAAAO....',
      '.....OOAAAAAAAAAAAAAAOO.....',
      '.......OOOAAAAAAAAOOO.......',
      '..........OOOOOOOO..........',
    ],
    shrine: [
      '...........OO...........',
      '..........OAAO..........',
      '.........OAAAAO.........',
      '........OAAAAAAO........',
      '.......OAAWWWWAAO.......',
      '.......OAAWWWWAAO.......',
      '........OAAAAAAO........',
      '.........OAAAAO.........',
      '..........OAAO..........',
      '.....OOOOOOOOOOOOOO.....',
      '....OCCCCCCCCCCCCCCO....',
      '...OCCAAAAAAAAAAAAACCO..',
      '...OCCACCCCCCCCCCCACCO..',
      '...OCCACCCCCCCCCCCACCO..',
      '...OCCACCCCCCCCCCCACCO..',
      '...OCCAAAAAAAAAAAAACCO..',
      '...OCCCCCCCCCCCCCCO.....',
      '....OOOOOOOOOOOOOO......',
      '.....OCCCCCCCCCCCO......',
      '.....OCCCCCCCCCCCO......',
      '.....OCCCCCCCCCCCO......',
      '.....OCCCCCCCCCCCO......',
      '....OOOOOOOOOOOOOOO.....',
      '...OCCCCCCCCCCCCCCCO....',
      '...OCCCCCCCCCCCCCCCO....',
      '...OOOOOOOOOOOOOOOOO....',
      '........................',
      '........................',
    ],
    grandShard: [
      '.....OOOO.....',
      '....OAAAAO....',
      '...OAAWWAAO...',
      '..OAAWWWWAAO..',
      '.OAAWWWWWWAAO.',
      '.OAWWWWWWWWAAO',
      'OAAWWWWWWWWAAO',
      'OAWWWWWWWWWWAAO',
      '.OAWWWWWWWWAAO',
      '.OAAWWWWWWAAO.',
      '..OAAWWWWAAO..',
      '...OAAWWAAO...',
      '....OAAAAO....',
      '.....OOOO.....',
      '..............',
      '..............',
    ],
    sign: [
      '..............',
      '..OOOOOOOOOO..',
      '.OCCCCCCCCCCAO',
      '.OCAAAAAAAAACO',
      '.OCACCCCCCCACO',
      '.OCACACACACACO',
      '.OCACCCCCCCACO',
      '.OCAAAAAAAAACO',
      '.OCCCCCCCCCCCO',
      '..OOOOOOOOOO..',
      '......OC......',
      '......OC......',
      '......OC......',
      '......OC......',
      '.....OBBO.....',
      '.....OOOO.....',
    ],
    spring: [
      '................',
      '..OOOOOOOOOOOO..',
      '.OAAAAAAAAAAAAO.',
      '.OAWWAAAAAAWWAAO',
      '.OAAAAAAAAAAAAO.',
      '..OOOOOOOOOOOO..',
      '....OCCCCCCCO...',
      '....OCCCCCCCO...',
      '...OCCCCCCCCCO..',
      '...OOOOOOOOOOO..',
    ],
    springMeteor: [
      '................',
      '..OOOOOOOOOOOO..',
      '.OAAWWAAAAWWAAAO',
      '.OAWWWWAAWWWWAAO',
      '.OAAWWAAAAWWAAAO',
      '..OOOOOOOOOOOO..',
      '....OCCCCCCCO...',
      '...OCCCCCCCCCO..',
      '..OCCCCCCCCCCCO.',
      '..OOOOOOOOOOOOO.',
    ],
  };

  // ---------------------------------------------------------------- builder
  const cache = new Map();
  const outlineCache = new Map();

  function build(rows, palette, width, height, key) {
    const w = width || Math.max(...rows.map((r) => r.length));
    const h = height || rows.length;
    const norm = normalize(rows, w, h, key);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < h; y++) {
      const row = norm[y];
      for (let x = 0; x < w; x++) {
        const ch = row[x];
        if (!ch || ch === '.') continue;
        const col = palette[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return canvas;
  }

  function paletteFor(formId) {
    return Object.assign({}, BASE, FORM_PAL[formId] || FORM_PAL.solar);
  }

  const Sprites = {
    cache,
    BASE,
    FORM_PAL,
    ENEMY_PAL,

    init() {
      // 预生成主角全部形态/帧，避免游戏中卡顿
      const names = ['idle', 'idle2', 'run0', 'run1', 'run2', 'run3', 'run4', 'run5',
        'jump', 'fall', 'wall', 'dash', 'slide', 'spin', 'hurt', 'ride'];
      for (const form of ['base', 'solar', 'cryo', 'grav', 'warp', 'echo']) {
        for (const name of names) {
          this.player(form, name);
          this.outline(form, name);
        }
      }
      for (const e of Object.keys(ENEMY_ROWS)) {
        this.enemy(e, 0);
        this.enemy(e, 1);
      }
      this._ready = true;
    },

    _key(parts) { return parts.join('|'); },

    player(formId, frame) {
      const key = this._key(['p', formId, frame]);
      if (cache.has(key)) return cache.get(key);      let rows, w = 12, h = 20;
      if (frame === 'slide') {
        rows = SLIDE; w = 14; h = 10;
      } else if (frame === 'spin') {
        rows = SPIN; w = 12; h = 12;
      } else if (frame === 'ride') {
        rows = SEATED; w = 12; h = 14;
      } else {
        let upper = UPPER;
        let legs;
        switch (frame) {
          case 'idle': legs = LEGS.stand; break;
          case 'idle2': legs = LEGS.stand2; break;
          case 'run0': legs = LEGS.run0; break;
          case 'run1': legs = LEGS.run1; break;
          case 'run2': legs = LEGS.run2; break;
          case 'run3': legs = LEGS.run3; break;
          case 'run4': legs = LEGS.run1; break;
          case 'run5': legs = LEGS.run3; break;
          case 'jump': legs = LEGS.jump; break;
          case 'fall': legs = LEGS.fall; break;
          case 'wall': legs = LEGS.wall; break;
          case 'dash': legs = LEGS.dash; break;
          case 'hurt': legs = LEGS.stand2; break;
          default: legs = LEGS.stand;
        }
        rows = upper.concat(legs);
        w = 12; h = 20;
      }
      const canvas = build(rows, paletteFor(formId), w, h, `player/${formId}/${frame}`);
      cache.set(key, canvas);
      return canvas;
    },

    outline(formId, frame, color) {
      const spr = this.player(formId, frame);
      const col = color || (formId === 'echo' ? '#ffd966' : (FORM_PAL[formId] && (FORM_PAL[formId].T || FORM_PAL[formId].A)) || '#fff6dc');
      const key = this._key(['o', formId, frame, col]);
      if (outlineCache.has(key)) return outlineCache.get(key);
      const tmp = document.createElement('canvas');
      tmp.width = spr.width; tmp.height = spr.height;
      const tctx = tmp.getContext('2d');
      tctx.imageSmoothingEnabled = false;
      tctx.drawImage(spr, 0, 0);
      tctx.globalCompositeOperation = 'source-in';
      tctx.fillStyle = col;
      tctx.fillRect(0, 0, tmp.width, tmp.height);
      const out = document.createElement('canvas');
      out.width = spr.width + 2; out.height = spr.height + 2;
      const octx = out.getContext('2d');
      octx.imageSmoothingEnabled = false;
      octx.drawImage(tmp, 0, 1);
      octx.drawImage(tmp, 2, 1);
      octx.drawImage(tmp, 1, 0);
      octx.drawImage(tmp, 1, 2);
      outlineCache.set(key, out);
      return out;
    },

    enemy(type, frame = 0, paletteName) {
      const key = this._key(['e', type, frame, paletteName || '']);
      if (cache.has(key)) return cache.get(key);
      let rows = ENEMY_ROWS[type];
      if (!rows) {
        rows = ENEMY_ROWS.slime;
        type = 'slime';
      }
      if (Array.isArray(rows)) {
        // 单帧
      } else {
        rows = rows[frame ? 1 : 0] || rows[0];
      }
      let pal = ENEMY_PAL[paletteName || type] || ENEMY_PAL.slime;
      if (type === 'slime' && frame === 1) {
        rows = ENEMY_ROWS.slimeSquash;
      }
      if (type === 'bat') {
        rows = frame ? ENEMY_ROWS.batDown : ENEMY_ROWS.bat;
      }
      if (type === 'lantern' && paletteName === 'cryoLantern') {
        pal = ENEMY_PAL.cryoLantern;
      }
      const w = Math.max(...rows.map((r) => r.length));
      const canvas = build(rows, pal, w, rows.length, `enemy/${type}/${frame}`);
      cache.set(key, canvas);
      return canvas;
    },

    prop(type) {
      const key = this._key(['prop', type]);
      if (cache.has(key)) return cache.get(key);
      let rows = ENEMY_ROWS[type];
      if (!rows) return null;
      const palette = ENEMY_PAL[type] || ENEMY_PAL.stone;
      const w = Math.max(...rows.map((r) => r.length));
      const canvas = build(rows, palette, w, rows.length, `prop/${type}`);
      cache.set(key, canvas);
      return canvas;
    },

    // 自绘通用接口
    makeCanvas(w, h) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      return { canvas: c, ctx };
    },

    draw(ctx, spr, x, y, flip = false, alpha = 1) {
      if (!spr) return;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (alpha !== 1) ctx.globalAlpha *= alpha;
      const px = Math.round(x), py = Math.round(y);
      if (flip) {
        ctx.translate(px + spr.width, py);
        ctx.scale(-1, 1);
        ctx.drawImage(spr, 0, 0);
      } else {
        ctx.drawImage(spr, px, py);
      }
      ctx.restore();
    },

    // 以中心旋转（用于二段跳的卷身旋转）
    drawRotated(ctx, spr, cx, cy, angle, flip = false, alpha = 1) {
      if (!spr) return;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(Math.round(cx), Math.round(cy));
      ctx.rotate(angle);
      if (flip) ctx.scale(-1, 1);
      if (alpha !== 1) ctx.globalAlpha *= alpha;
      ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
      ctx.restore();
    },

    tinted(formId) {
      const key = this._key(['p', 'echo', formId]);
      return cache.get(key);
    },

    enemyPalette(type) { return ENEMY_PAL[type] || ENEMY_PAL.slime; },
  };

  PB.Sprites = Sprites;
})();
