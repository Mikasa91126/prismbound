/* ============================================================
   ui.js — 960×540 清晰双语 UI
   标题、HUD、炼金图鉴、祭坛、章节卡、暂停、结局
   ============================================================ */
(function () {
  'use strict';
  const PB = window.PB;
  const { U, Font, C, Input } = PB;
  const TAU = Math.PI * 2;

  const COL = {
    bg: '#070a14',
    panel: 'rgba(10,15,30,.93)',
    panel2: 'rgba(17,26,50,.92)',
    panelSoft: 'rgba(10,16,32,.75)',
    line: 'rgba(110,160,200,.32)',
    lineSoft: 'rgba(110,160,200,.16)',
    gold: '#f2c46a',
    goldBright: '#ffe6a0',
    goldDim: '#a77b32',
    cyan: '#7ef0e0',
    cyanDim: '#3d9aab',
    violet: '#b48cff',
    pink: '#f49cff',
    red: '#e85a63',
    green: '#7be3a4',
    text: '#e8f0ff',
    muted: '#93a3c4',
    dim: '#5d6b8c',
    white: '#ffffff',
  };

  const ITEM_LABELS = {
    continue: ['继续旅程', 'CONTINUE'],
    new: ['新的旅程', 'NEW JOURNEY'],
    chapters: ['章节选择', 'CHAPTER SELECT'],
    codex: ['炼金图鉴', 'ALCHEMY CODEX'],
    settings: ['设置', 'SETTINGS'],
    controls: ['操作说明', 'CONTROLS'],
    resume: ['回到旅途', 'RESUME'],
    restart: ['回到信标', 'RESTART CHECKPOINT'],
    title: ['返回标题', 'QUIT TO TITLE'],
    music: ['音乐音量', 'MUSIC VOLUME'],
    sfx: ['音效音量', 'SFX VOLUME'],
    shake: ['镜头震动', 'SCREEN SHAKE'],
    flashes: ['光效强度', 'LIGHT FLASHES'],
    back: ['返回', 'BACK'],
  };

  const FORM_ORDER = ['solar', 'cryo', 'grav', 'warp'];

  const UI = {
    COL,

    // ---------------------------------------------------------------- draw entry
    draw(game, ctx) {
      ctx.imageSmoothingEnabled = false;
      this.hits = [];
      this.drawVignette(ctx);
      switch (game.state) {
        case 'title': this.drawTitleNew(game, ctx); this.drawFrame(ctx); return;
        case 'confirmNew': this.drawTitleBackdrop(game, ctx); this.drawConfirmNew(game, ctx); this.drawFrame(ctx); return;
        case 'chapters': this.drawTitleBackdrop(game, ctx); this.drawChapters(game, ctx); this.drawFrame(ctx); return;
        case 'intro': this.drawIntro(game, ctx); this.drawFrame(ctx); return;
        case 'ending': this.drawEnding(game, ctx); this.drawFrame(ctx); return;
        case 'chapterClear': this.drawChapterClear(game, ctx); this.drawFrame(ctx); return;
        case 'codex': this.drawCodex(game, ctx); this.drawFrame(ctx); return;
        case 'settings': this.drawReturnBackdrop(game, ctx); this.drawSettings(game, ctx); this.drawFrame(ctx); return;
        case 'controls': this.drawReturnBackdrop(game, ctx); this.drawControls(game, ctx); this.drawFrame(ctx); return;
        case 'dead': this.drawHUD(game, ctx, true); this.drawDead(game, ctx); this.drawFrame(ctx); return;
        case 'paused':
          this.drawHUD(game, ctx, true);
          this.dim(ctx, 0.62);
          this.drawPause(game, ctx);
          this.drawFrame(ctx);
          return;
        case 'chapterCard':
          this.drawChapterCard(game, ctx);
          this.drawFrame(ctx);
          return;
        case 'shrine':
          this.drawHUD(game, ctx, true);
          this.dim(ctx, 0.55);
          this.drawShrine(game, ctx);
          this.drawFrame(ctx);
          return;
        case 'play':
        default:
          this.drawHUD(game, ctx, false);
          if (game.chainBanner) this.drawChainBanner(game, ctx);
          this.drawFrame(ctx);
          return;
      }
    },

    // ---------------------------------------------------------------- primitives
    // 菜单点击区域：绘制时登记，供 Game 的鼠标/触屏处理命中
    addHit(x, y, w, h, index, kind) {
      (this.hits || (this.hits = [])).push({ x, y, w, h, index, kind });
    },

    hitTest(px, py) {
      const hs = this.hits || [];
      for (let i = hs.length - 1; i >= 0; i--) {
        const r = hs[i];
        if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r;
      }
      return null;
    },

    dim(ctx, a = 0.6, color = '#05070e') {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, C.UI_W, C.UI_H);
      ctx.restore();
    },

    drawVignette(ctx) {
      ctx.save();
      const g = ctx.createRadialGradient(480, 270, 160, 480, 270, 620);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.66, 'rgba(2,4,10,.06)');
      g.addColorStop(1, 'rgba(2,4,10,.44)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, C.UI_W, C.UI_H);
      ctx.restore();
    },

    drawFrame(ctx) {
      ctx.save();
      ctx.strokeStyle = 'rgba(200,235,245,.08)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, C.UI_W - 2, C.UI_H - 2);
      // 四角小装饰
      ctx.strokeStyle = 'rgba(242,196,106,.35)';
      ctx.lineWidth = 1;
      const d = 12;
      for (const [x, y, sx, sy] of [[7, 7, 1, 1], [C.UI_W - 7, 7, -1, 1], [7, C.UI_H - 7, 1, -1], [C.UI_W - 7, C.UI_H - 7, -1, -1]]) {
        ctx.beginPath();
        ctx.moveTo(x + sx * d, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + sy * d);
        ctx.stroke();
      }
      ctx.restore();
    },

    panel(ctx, x, y, w, h, opt = {}) {
      const fill = opt.fill || COL.panel;
      const border = opt.border || COL.line;
      const accent = opt.accent;
      const notch = opt.notch == null ? 9 : opt.notch;
      const alpha = opt.alpha == null ? 1 : opt.alpha;
      x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(x + notch, y);
      ctx.lineTo(x + w - notch, y);
      ctx.lineTo(x + w, y + notch);
      ctx.lineTo(x + w, y + h - notch);
      ctx.lineTo(x + w - notch, y + h);
      ctx.lineTo(x + notch, y + h);
      ctx.lineTo(x, y + h - notch);
      ctx.lineTo(x, y + notch);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.stroke();
      if (accent) {
        ctx.strokeStyle = accent;
        ctx.globalAlpha = alpha * 0.8;
        ctx.beginPath();
        ctx.moveTo(x + notch, y + 1);
        ctx.lineTo(x + w - notch, y + 1);
        ctx.stroke();
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = accent;
        ctx.fillRect(x + notch, y + 3, Math.min(70, w - notch * 2), 1);
      }
      // 内阴影
      ctx.globalAlpha = alpha * 0.28;
      ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
      ctx.restore();
    },

    divider(ctx, x, y, w, color = COL.line) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, 1);
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.fillRect(x, y + 1, w, 1);
      ctx.restore();
    },

    keycap(ctx, label, x, y, opt = {}) {
      return Font.keycap(ctx, label, x, y, Object.assign({
        color: '#dff8ff', border: 'rgba(126,240,224,.36)', bg: 'rgba(14,22,42,.95)',
        scale: 1, padX: 5, padY: 4,
      }, opt));
    },

    diamond(ctx, cx, cy, rx, ry, fill, stroke, lw = 1) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - ry);
      ctx.lineTo(cx + rx, cy);
      ctx.lineTo(cx, cy + ry);
      ctx.lineTo(cx - rx, cy);
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
    },

    bar(ctx, x, y, w, h, pct, color, bg = 'rgba(255,255,255,.09)') {
      ctx.save();
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, Math.round(w * U.clamp(pct, 0, 1)), h);
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      if (pct > 0.03) ctx.fillRect(x, y, Math.max(1, Math.round(w * U.clamp(pct, 0, 1))), 1);
      ctx.restore();
    },

    progressDots(ctx, x, y, n, active, color = COL.gold) {
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i === active ? color : 'rgba(255,255,255,.18)';
        this.diamond(ctx, x + i * 14, y, 3, 4, ctx.fillStyle);
      }
    },

    // ---------------------------------------------------------------- title
    drawShrineCrystal(ctx, cx, cy, size, time, color, glow, alpha = 1) {
      ctx.save();
      ctx.globalAlpha = alpha;
      for (let i = 3; i >= 1; i--) {
        ctx.globalAlpha = alpha * 0.035 * i;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(cx, cy, size * (0.8 + i * 0.24), 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = alpha;
      const top = cy - size * 1.25;
      const bottom = cy + size * 1.15;
      const l = cx - size * 0.62, r = cx + size * 0.62;
      const shoulderY = cy - size * 0.18;
      const facets = [
        [[cx, top], [l, shoulderY], [cx, cy + size * 0.18]],
        [[cx, top], [r, shoulderY], [cx, cy + size * 0.18]],
        [[l, shoulderY], [cx, bottom], [cx, cy + size * 0.18]],
        [[r, shoulderY], [cx, bottom], [cx, cy + size * 0.18]],
      ];
      const cols = [
        U.colorLerp(color, '#ffffff', 0.3),
        U.colorLerp(color, '#12081c', 0.28),
        U.colorLerp(color, '#ffffff', 0.08),
        U.colorLerp(color, '#12081c', 0.12),
      ];
      facets.forEach((f, i) => {
        ctx.fillStyle = cols[i];
        ctx.beginPath();
        f.forEach(([px, py], j) => (j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = U.rgba('#ffffff', 0.16);
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cx, cy - size * 0.45);
      ctx.lineTo(cx + size * 0.16, cy);
      ctx.lineTo(cx, cy + size * 0.55);
      ctx.lineTo(cx - size * 0.16, cy);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 7; i++) {
        const a = time * 0.7 + i * TAU / 7;
        const rx = cx + Math.cos(a) * (size * 1.3);
        const ry = cy + Math.sin(a) * (size * 0.9);
        ctx.fillStyle = i % 2 ? '#ffffff' : glow;
        ctx.globalAlpha = alpha * (0.35 + (i % 3) * 0.15);
        ctx.fillRect(Math.round(rx), Math.round(ry), i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
      }
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.ellipse(cx, cy + size * 1.32, size * 0.8, size * 0.16, 0, 0, TAU); ctx.fill();
      ctx.restore();
    },

    drawTitleNew(game, ctx) {
      // 深邃的左侧书写区 + 右侧菜单，保留背景的星河与山脊
      const t = game.realTime;
      ctx.save();
      const g = ctx.createLinearGradient(0, 0, C.UI_W, C.UI_H);
      g.addColorStop(0, 'rgba(3,5,13,.9)');
      g.addColorStop(0.52, 'rgba(4,7,16,.58)');
      g.addColorStop(1, 'rgba(4,6,15,.7)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, C.UI_W, C.UI_H);

      // 棱镜射出的四色光束
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const c = [COL.gold, COL.cyan, COL.violet, COL.pink][i];
        ctx.globalAlpha = 0.028 + Math.sin(t * 0.6 + i) * 0.008;
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(192, 118 + i * 7);
        ctx.lineTo(210, 124 + i * 7);
        ctx.lineTo(640, 30 + i * 30);
        ctx.lineTo(640, 48 + i * 30);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      // 背景中的巨大棱镜轮廓
      ctx.save();
      ctx.globalAlpha = 0.035;
      ctx.strokeStyle = '#9feef0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(300, 60);
      ctx.lineTo(420, 180);
      ctx.lineTo(300, 300);
      ctx.lineTo(180, 180);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // 古老拱门剪影
      ctx.fillStyle = 'rgba(10,12,25,.55)';
      ctx.beginPath();
      ctx.moveTo(30, 540);
      ctx.lineTo(30, 382);
      ctx.quadraticCurveTo(92, 300, 158, 382);
      ctx.lineTo(158, 540);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(15,18,34,.55)';
      ctx.fillRect(250, 348, 18, 192);
      ctx.fillRect(360, 372, 14, 168);
      ctx.fillRect(228, 340, 172, 6);

      // 地面
      ctx.fillStyle = 'rgba(5,8,17,.9)';
      ctx.beginPath();
      ctx.moveTo(0, 506);
      for (let x = 0; x <= C.UI_W; x += 32) ctx.lineTo(x, 500 + Math.sin(x * 0.013) * 6 + Math.sin(x * 0.041 + 2) * 3);
      ctx.lineTo(C.UI_W, C.UI_H);
      ctx.lineTo(0, C.UI_H);
      ctx.closePath();
      ctx.fill();

      // 漂浮棱晶
      for (let i = 0; i < 16; i++) {
        const px = 60 + U.hash2(i, 2, 7) * 520 + Math.sin(t * 0.3 + i) * 6;
        const py = 70 + U.hash2(i, 9, 4) * 350 + Math.cos(t * 0.4 + i) * 5;
        const col = [COL.gold, COL.cyan, COL.violet, COL.pink][i % 4];
        ctx.globalAlpha = 0.12 + (Math.sin(t * 1.4 + i) + 1) * 0.08;
        ctx.fillStyle = col;
        this.diamond(ctx, Math.round(px), Math.round(py), 2, 3, col);
      }
      ctx.globalAlpha = 1;

      // 徽记 + 标题
      this.drawPrism(ctx, 206, 130, 54, t, 0.96);
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = COL.gold;
      ctx.fillRect(86, 170, 64, 1);
      ctx.restore();
      Font.cn(ctx, 'A ZERO-ASSET PIXEL ALCHEMY ADVENTURE', 164, 170, 9, 'rgba(242,196,106,.62)', { weight: 500, font: Font.mono, letterSpacing: '1px' });

      // 中文标题
      const grad = ctx.createLinearGradient(86, 204, 500, 262);
      grad.addColorStop(0, '#fff7dc');
      grad.addColorStop(0.5, '#ffd27a');
      grad.addColorStop(1, '#9feef0');
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = '800 52px ' + Font.cnStack;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
      ctx.fillStyle = 'rgba(2,4,10,.9)';
      ctx.fillText('棱 镜 奇 旅', 90, 250);
      ctx.fillStyle = grad;
      ctx.fillText('棱 镜 奇 旅', 88, 248);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.restore();

      Font.pixel(ctx, 'PRISMBOUND', 88, 260, {
        scale: 6, color: '#f1f6ff', shadow: 'rgba(2,4,10,.95)', spacing: 1,
      });
      Font.pixel(ctx, 'ECHOES OF THE STAR RIFT', 90, 310, { scale: 1, color: COL.gold });
      Font.cn(ctx, '霜火与星隙之诗  ·  原创 2D 横版像素炼金平台冒险', 90, 330, 11, 'rgba(200,215,240,.62)', { weight: 500 });
      Font.cn(ctx, '每一枚像素、每一个音符与每一段回声，皆由代码在运行时生成。', 90, 348, 10, 'rgba(160,180,210,.48)', { weight: 500 });
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = COL.gold;
      ctx.fillRect(90, 364, 338, 1);
      ctx.globalAlpha = 1;
      Font.pixel(ctx, '4 PRISMS  ·  16 ALCHEMY CHAINS  ·  3 VEHICLES', 90, 376, { scale: 1, color: 'rgba(242,196,106,.62)' });
      Font.pixel(ctx, '60HZ PHYSICS  ·  ZERO ASSETS  ·  7 CHIP TRACKS', 90, 390, { scale: 1, color: 'rgba(159,238,240,.42)' });
      ctx.restore();

      // 小露米与棱晶台
      this.panel(ctx, 470, 470, 138, 10, { fill: 'rgba(8,12,24,.9)', border: 'rgba(126,240,224,.22)', notch: 3 });
      const spr = PB.Sprites.player('base', 'idle');
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = COL.cyan;
      ctx.beginPath(); ctx.arc(512, 440, 40, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.drawImage(spr, 493, 410, spr.width * 3, spr.height * 3);
      // 头顶浮晶
      ctx.globalAlpha = 0.45 + Math.sin(t * 2) * 0.2;
      ctx.fillStyle = COL.gold;
      this.diamond(ctx, 540, 400, 3, 5, COL.gold);
      ctx.globalAlpha = 1;
      ctx.restore();

      // 菜单
      const items = game.titleItems();
      const mx = 632, my = 150, mw = 300, mh = 344;
      this.panel(ctx, mx, my, mw, mh, { fill: 'rgba(8,13,27,.9)', border: 'rgba(126,240,224,.26)', accent: COL.cyan });
      Font.cn(ctx, '旅 程', mx + 22, my + 26, 16, COL.text, { weight: 700 });
      Font.pixel(ctx, 'JOURNEY', mx + 22, my + 39, { scale: 1, color: COL.muted });
      if (PB.Save.hasProgress()) {
        this.keycap(ctx, 'SAVE', mx + mw - 64, my + 18, { color: COL.green, border: 'rgba(123,227,164,.4)', padX: 6 });
      }
      this.divider(ctx, mx + 20, my + 52, mw - 40, COL.lineSoft);
      const rowH = 36;
      items.forEach((item, i) => {
        const lab = ITEM_LABELS[item] || [item, item];
        const y = my + 64 + i * rowH;
        const sel = i === game.ui.titleIndex;
        this.addHit(mx + 12, y - 4, mw - 24, 30, i, 'title');
        if (sel) {
          const bg = ctx.createLinearGradient(mx + 12, y, mx + mw - 12, y);
          bg.addColorStop(0, 'rgba(126,240,224,.16)');
          bg.addColorStop(1, 'rgba(126,240,224,0)');
          ctx.fillStyle = bg;
          ctx.fillRect(mx + 12, y - 4, mw - 24, 30);
          ctx.fillStyle = COL.cyan;
          ctx.fillRect(mx + 12, y - 4, 2, 30);
          this.diamond(ctx, mx + 26, y + 10, 4, 5, COL.cyan);
        }
        Font.cn(ctx, lab[0], mx + 40, y + 7, 15, sel ? COL.cyan : COL.text, { weight: sel ? 700 : 500 });
        Font.cn(ctx, lab[1], mx + 40, y + 21, 9, sel ? 'rgba(126,240,224,.72)' : 'rgba(130,150,185,.55)', { weight: 500, font: Font.mono, letterSpacing: '1px' });
      });
      ctx.save();
      ctx.globalAlpha = 0.55 + U.animate(t, 0.9) * 0.35;
      Font.cn(ctx, '↑↓ / 鼠标 选择', mx + 20, my + mh - 18, 9, COL.dim, { weight: 500 });
      this.keycap(ctx, 'ENTER', mx + mw - 82, my + mh - 30, { color: COL.goldBright, border: 'rgba(242,196,106,.45)', padX: 6 });
      ctx.restore();

      // 进度与页脚
      const done = PB.Chains.countDone();
      Font.pixel(ctx, `CHAINS ${done}/16`, 636, 508, { scale: 1, color: 'rgba(170,190,220,.55)' });
      this.diamond(ctx, 748, 512, 3, 4, COL.gold);
      Font.pixel(ctx, `GRAND ${game.grandCount()}/12`, 758, 508, { scale: 1, color: 'rgba(170,190,220,.55)' });
      Font.pixel(ctx, `SHARDS ${game.stats ? game.stats.shards || 0 : 0}`, 850, 508, { scale: 1, color: 'rgba(170,190,220,.55)' });
      Font.pixel(ctx, `V${C.VERSION}`, 90, 508, { scale: 1, color: 'rgba(160,180,215,.35)' });
      Font.cn(ctx, 'CREATED WITH CLAUDE CODE · 零外部素材 · ZERO ASSETS', 90, 522, 9, 'rgba(160,180,215,.32)', { weight: 500, font: Font.mono });
      Font.cn(ctx, '按 M 静音', 632, 522, 9, COL.dim, { weight: 500 });
      ctx.restore();
    },

    drawTitleBackdrop(game, ctx) {
      // Gfx 已绘制天空；这里加一层暗化与地面轮廓，为标题文字让出对比度
      ctx.save();
      const g = ctx.createLinearGradient(0, 0, C.UI_W, C.UI_H);
      g.addColorStop(0, 'rgba(4,6,14,.78)');
      g.addColorStop(0.55, 'rgba(4,6,14,.26)');
      g.addColorStop(1, 'rgba(4,6,14,.62)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, C.UI_W, C.UI_H);
      // 地面剪影
      ctx.fillStyle = 'rgba(6,9,22,.85)';
      ctx.beginPath();
      ctx.moveTo(0, 500);
      for (let x = 0; x <= C.UI_W; x += 40) {
        ctx.lineTo(x, 492 + Math.sin(x * 0.01) * 10 + Math.sin(x * 0.031 + 1) * 4);
      }
      ctx.lineTo(C.UI_W, C.UI_H);
      ctx.lineTo(0, C.UI_H);
      ctx.closePath();
      ctx.fill();
      // 漂浮棱晶
      const t = game.realTime;
      for (let i = 0; i < 18; i++) {
        const px = 70 + U.hash2(i, 3, 5) * 820 + Math.sin(t * 0.25 + i) * 7;
        const py = 70 + U.hash2(i, 7, 9) * 380 + Math.cos(t * 0.32 + i) * 5;
        const cc = [COL.gold, COL.cyan, COL.violet, COL.pink][i % 4];
        ctx.globalAlpha = 0.15 + (Math.sin(t * 1.2 + i) + 1) * 0.12;
        ctx.fillStyle = cc;
        const s = i % 5 === 0 ? 3 : 2;
        this.diamond(ctx, Math.round(px), Math.round(py), s, s + 2, cc);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    },

    drawTitle(game, ctx) {
      this.drawTitleBackdrop(game, ctx);
      const t = game.realTime;
      // 棱镜标志与光束
      const px = 238, py = 126;
      this.drawPrism(ctx, px, py, 66, t, 1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const c = [COL.gold, COL.cyan, COL.violet, COL.pink][i];
        ctx.globalAlpha = 0.055 + Math.sin(t * 0.6 + i) * 0.015;
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(px - 6, py + 8 + i * 3);
        ctx.lineTo(80, 360 + i * 18);
        ctx.lineTo(170, 380 + i * 18);
        ctx.lineTo(px + 14, py + 10 + i * 3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // 中文标题
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const grad = ctx.createLinearGradient(86, 208, 500, 260);
      grad.addColorStop(0, '#fff6d4');
      grad.addColorStop(0.5, '#ffd27a');
      grad.addColorStop(1, '#a8f3e5');
      ctx.fillStyle = 'rgba(4,6,14,.8)';
      ctx.font = '800 46px ' + Font.cnStack;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '8px';
      ctx.fillText('棱 镜 奇 旅', 90, 260);
      ctx.fillStyle = grad;
      ctx.fillText('棱 镜 奇 旅', 88, 258);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.restore();

      // 英文主标题（手工像素字）
      Font.pixel(ctx, 'PRISMBOUND', 88, 274, {
        scale: 6, color: '#f3f7ff', shadow: 'rgba(4,6,14,.9)', spacing: 1,
      });
      Font.pixel(ctx, 'ECHOES OF THE STAR RIFT', 90, 326, {
        scale: 1, color: COL.gold, spacing: 1,
      });
      Font.cn(ctx, '霜火与星隙之诗', 90, 350, 13, COL.muted, { weight: 500 });
      Font.pixel(ctx, 'A TALE OF FROSTFIRE & STAR-RIFT', 90, 365, { scale: 1, color: 'rgba(160,180,215,.55)' });
      Font.cn(ctx, '一款由代码、像素与音符铸成的原创 2D 炼金平台冒险', 90, 392, 12, 'rgba(200,215,240,.66)', { weight: 500 });
      Font.pixel(ctx, 'AN ORIGINAL 2D PIXEL ALCHEMY PLATFORMER', 90, 408, { scale: 1, color: 'rgba(150,170,205,.48)' });

      // 小露米站在棱晶上
      const spr = PB.Sprites.player('base', 'idle');
      const sx = 650 - 18, sy = 416;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      // 地面小台
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = 'rgba(8,12,24,.9)';
      ctx.fillRect(600, 460, 120, 6);
      ctx.fillStyle = 'rgba(126,240,224,.22)';
      ctx.fillRect(604, 460, 112, 1);
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = COL.cyan;
      ctx.beginPath(); ctx.arc(sx + 24, sy + 30, 24, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.drawImage(spr, sx, sy, spr.width * 3, spr.height * 3);
      ctx.restore();

      // 菜单
      const items = game.titleItems();
      const mx = 628, my = 196, mw = 296, mh = 288;
      this.panel(ctx, mx, my, mw, mh, { accent: COL.cyan });
      Font.cn(ctx, '旅 程', mx + 22, my + 28, 16, COL.text, { weight: 700 });
      Font.pixel(ctx, 'JOURNEY', mx + 22, my + 42, { scale: 1, color: COL.muted });
      this.divider(ctx, mx + 20, my + 52, mw - 40, COL.lineSoft);
      const rowH = 34;
      items.forEach((item, i) => {
        const lab = ITEM_LABELS[item] || [item, item];
        const y = my + 66 + i * rowH;
        const sel = i === game.ui.titleIndex;
        if (sel) {
          const grad = ctx.createLinearGradient(mx + 14, y, mx + mw - 14, y);
          grad.addColorStop(0, 'rgba(242,196,106,.18)');
          grad.addColorStop(1, 'rgba(242,196,106,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(mx + 14, y - 3, mw - 28, 29);
          ctx.fillStyle = COL.gold;
          this.diamond(ctx, mx + 26, y + 10, 4, 5, COL.gold);
        }
        Font.cn(ctx, lab[0], mx + 40, y + 7, 15, sel ? COL.goldBright : COL.text, { weight: sel ? 700 : 500 });
        Font.pixel(ctx, lab[1], mx + 40, y + 18, { scale: 1, color: sel ? 'rgba(255,230,160,.7)' : COL.dim });
      });
      const hintY = my + mh - 20;
      Font.cn(ctx, '↑↓ 选择   Enter 确认   Tab 图鉴', mx + 20, hintY, 10, COL.dim, { weight: 500 });

      // 进度摘要
      const done = PB.Chains.countDone();
      const grand = game.grandCount();
      ctx.save();
      ctx.globalAlpha = 0.85;
      Font.pixel(ctx, `CHAINS ${done}/16   GRAND ${grand}/12   SHARDS ${game.stats ? game.stats.shards || 0 : 0}`, 630, 506, { scale: 1, color: 'rgba(160,180,215,.55)' });
      Font.cn(ctx, '按 M 静音', 630, 520, 9, COL.dim, { weight: 500 });
      ctx.restore();
      // 版本
      Font.pixel(ctx, `V${C.VERSION}`, 88, 506, { scale: 1, color: 'rgba(160,180,215,.38)' });
      Font.cn(ctx, 'CREATED WITH CLAUDE CODE · ZERO ASSETS', 88, 520, 9, 'rgba(160,180,215,.35)', { weight: 500 });
    },

    drawPrism(ctx, cx, cy, size, time, alpha = 1) {
      ctx.save();
      ctx.globalAlpha = alpha;
      // 光晕
      for (let i = 3; i >= 1; i--) {
        ctx.globalAlpha = alpha * 0.045 * i;
        ctx.fillStyle = i % 2 ? COL.cyan : COL.gold;
        ctx.beginPath(); ctx.arc(cx, cy, size * (0.6 + i * 0.18), 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = alpha;
      // 四个面
      const colors = ['#ff9f45', '#6ee7ff', '#b48cff', '#f49cff'];
      const pts = [
        [cx, cy - size],
        [cx + size * 0.62, cy],
        [cx, cy + size],
        [cx - size * 0.62, cy],
      ];
      for (let i = 0; i < 4; i++) {
        const p = pts[i], q = pts[(i + 1) % 4];
        ctx.fillStyle = colors[i];
        ctx.globalAlpha = alpha * 0.75;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(p[0], p[1]);
        ctx.lineTo(q[0], q[1]);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[2][0], pts[2][1]);
      ctx.lineTo(pts[3][0], pts[3][1]);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.fillRect(cx - 1, cy - size * 0.55, 2, size * 0.5);
      // 旋转尘埃
      ctx.fillStyle = '#fff4cf';
      for (let i = 0; i < 6; i++) {
        const a = time * 0.8 + i * TAU / 6;
        ctx.globalAlpha = alpha * (0.35 + (i % 2) * 0.2);
        ctx.fillRect(Math.round(cx + Math.cos(a) * (size + 22)), Math.round(cy + Math.sin(a) * (size * 0.6 + 12)), 2, 2);
      }
      ctx.restore();
    },

    drawIntro(game, ctx) {
      this.drawTitleBackdrop(game, ctx);
      const card = Math.min(2, game.introCard || 0);
      const t = (game.realTime || 0);
      this.dim(ctx, 0.18);
      // 顶部章节眉标
      Font.pixel(ctx, 'PROLOGUE · THE NIGHT THE COLORS LEFT', 90, 54, { scale: 1, color: COL.gold, spacing: 1 });
      Font.cn(ctx, '序章', 90, 78, 13, COL.muted, { weight: 600 });

      const cx = 480, cy = 220;
      if (card === 0) {
        this.drawPrism(ctx, cx, cy - 20, 92, t, 0.85);
        // 碎裂
        for (let i = 0; i < 9; i++) {
          const a = i * 1.7 + t * 0.2;
          const rx = 120 + (i * 37) % 220;
          const ry = 60 + (i * 23) % 90;
          ctx.globalAlpha = 0.28 + (i % 3) * 0.12;
          ctx.fillStyle = ['#ff9f45', '#6ee7ff', '#b48cff', '#f49cff'][i % 4];
          this.diamond(ctx, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 4, 6, ctx.fillStyle);
        }
        ctx.globalAlpha = 1;
      } else if (card === 1) {
        // 四道折跃之光
        for (let i = 0; i < 4; i++) {
          const col = ['#ff9f45', '#6ee7ff', '#b48cff', '#f49cff'][i];
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.25;
          ctx.strokeStyle = col;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cx, 150);
          ctx.bezierCurveTo(cx + (i - 1.5) * 90, 190, cx + (i - 1.5) * 150, 260, cx + (i - 1.5) * 250, 330);
          ctx.stroke();
          ctx.restore();
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = col;
          this.diamond(ctx, cx + (i - 1.5) * 250, 330, 6, 8, col);
          ctx.globalAlpha = 1;
        }
        // 地平线
        ctx.fillStyle = 'rgba(5,8,18,.9)';
        ctx.fillRect(0, 334, C.UI_W, 120);
        for (let i = 0; i < 4; i++) {
          ctx.globalAlpha = 0.16;
          ctx.fillStyle = ['#ff9f45', '#6ee7ff', '#b48cff', '#f49cff'][i];
          ctx.fillRect(120 + i * 190, 334, 3, 60);
        }
        ctx.globalAlpha = 1;
      } else {
        // 露米与灯
        const spr = PB.Sprites.player('base', 'idle');
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = COL.cyan;
        ctx.beginPath(); ctx.arc(cx - 20, cy + 36, 62, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.drawImage(spr, cx - 60, cy - 10, spr.width * 5, spr.height * 5);
        ctx.restore();
        // 提灯
        const a = t * 2;
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = COL.gold;
        ctx.beginPath(); ctx.arc(cx + 66, cy + 28, 26, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#2c2230';
        ctx.fillRect(cx + 58, cy + 20, 16, 20);
        ctx.fillStyle = COL.goldDim;
        ctx.fillRect(cx + 60, cy + 22, 12, 16);
        ctx.fillStyle = COL.gold;
        ctx.fillRect(cx + 63, cy + 24, 6, 10);
        ctx.fillStyle = '#fff5c4';
        ctx.fillRect(cx + 65, cy + 26, 2, 5);
        ctx.globalAlpha = 0.6;
        for (let i = 0; i < 3; i++) ctx.fillRect(cx + 68 + Math.cos(a + i) * 9, cy + 26 + Math.sin(a + i) * 6, 1, 1);
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // 文本
      const lines = [
        {
          zh: '大棱镜熄灭的那一夜，世界失去了四种颜色。',
          en: 'THE NIGHT THE GRAND PRISM DIMMED, THE WORLD LOST FOUR COLORS.',
        },
        {
          zh: '四枚棱镜碎片坠入四片土地——余烬、霜火、星隙与黎明。',
          en: 'FOUR SHARDS FELL INTO FOUR LANDS — EMBER, FROSTFIRE, STAR-RIFT, AND DAWN.',
        },
        {
          zh: '提灯人露米背起空灯，踏上把颜色带回来的路。',
          en: 'LUMI THE LAMPLIGHTER LIFTS AN EMPTY LANTERN, AND WALKS TO BRING THE COLORS HOME.',
        },
      ];
      const ly = 396;
      this.panel(ctx, 150, ly, 660, 100, { fill: 'rgba(8,13,27,.85)', accent: COL.gold });
      Font.cn(ctx, lines[card].zh, 480, ly + 34, 16, COL.text, { align: 'center', weight: 600 });
      Font.cn(ctx, lines[card].en, 480, ly + 58, 8, 'rgba(185,205,235,.55)', { align: 'center', weight: 500, font: Font.mono, letterSpacing: '0.5px' });
      Font.cn(ctx, 'Enter 继续  ·  Esc 跳过', 480, ly + 82, 10, COL.dim, { align: 'center', weight: 500 });
      this.progressDots(ctx, 448, 512, 3, card, COL.gold);
      Font.cn(ctx, `${card + 1} / 3`, 480, 526, 8, COL.dim, { align: 'center', weight: 500, font: Font.mono });
    },

    // ---------------------------------------------------------------- HUD
    drawHUD(game, ctx, behind) {
      if (!game.player || !game.world) return;
      const p = game.player;
      const alpha = behind ? 0.42 : 1;
      ctx.save();
      ctx.globalAlpha = alpha;

      // 左上信息条
      this.panel(ctx, 18, 16, 452, 38, { fill: 'rgba(8,13,27,.66)', border: 'rgba(120,170,210,.22)', notch: 7, alpha: 1 });
      let hx = 30;
      for (let i = 0; i < p.maxHearts; i++) {
        const filled = i < p.hearts;
        this.diamond(ctx, hx + 8, 35, 7, 9, filled ? 'rgba(255,110,130,.95)' : null, 'rgba(255,255,255,.16)');
        if (filled) {
          this.diamond(ctx, hx + 8, 35, 4, 5, 'rgba(255,235,235,.8)');
          ctx.fillStyle = '#fff';
          ctx.fillRect(hx + 6, 32, 1, 2);
        }
        hx += 22;
      }
      hx += 12;
      // 棱晶
      this.diamond(ctx, hx + 5, 35, 5, 6, COL.gold);
      Font.pixel(ctx, `${game.stats && game.stats.shards || 0}`, hx + 15, 29, { scale: 2, color: COL.text });
      hx += 72;
      // 连携徽记
      this.drawSigil(ctx, PB.Chains.countDone(), hx + 7, 35, 8, COL.gold, false, 1);
      Font.pixel(ctx, `${PB.Chains.countDone()}/16`, hx + 19, 32, { scale: 1, color: COL.muted });
      hx += 72;
      // 大棱晶
      this.diamond(ctx, hx + 4, 35, 5, 7, COL.cyan);
      Font.pixel(ctx, `${game.grandCount()}/12`, hx + 15, 32, { scale: 1, color: COL.muted });
      // 重力反转提示
      if (p.grav < 0) {
        const bw = 188;
        this.panel(ctx, 20, 60, bw, 22, { fill: 'rgba(24,16,40,.84)', border: 'rgba(180,140,255,.55)', notch: 5 });
        Font.cn(ctx, '重力倒转', 32, 71, 10, COL.violet, { weight: 700 });
        Font.cn(ctx, 'GRAVITY INVERTED', 96, 71, 8, 'rgba(200,180,255,.6)', { weight: 500, font: Font.mono });
        ctx.save();
        ctx.globalAlpha = 0.5 + U.animate(game.realTime, 1.3) * 0.4;
        this.diamond(ctx, 194, 71, 3, 4, COL.violet);
        ctx.restore();
      }

      // 右上：章节与计时
      this.panel(ctx, 742, 16, 200, 42, { fill: 'rgba(8,13,27,.48)', border: 'rgba(120,170,210,.14)', notch: 6 });
      const ch = PB.Levels.get(game.chapterIndex);
      ctx.textAlign = 'right';
      Font.cn(ctx, ch ? ch.nameZh : '', 930, 27, 12, 'rgba(220,235,250,.8)', { align: 'right', weight: 600 });
      Font.cn(ctx, ch ? ch.nameEn : '', 930, 39, 7, 'rgba(150,170,200,.55)', { align: 'right', weight: 500, font: Font.mono, letterSpacing: '0.5px' });
      Font.pixel(ctx, U.formatTime(game.chapterTime), 930, 46, { scale: 2, color: COL.goldBright, align: 'right' });
      ctx.textAlign = 'left';

      // Boss 血条
      if (game.bossActive && game.boss) this.drawBossBar(game, ctx);

      // 连携进度小条
      if (game.lastChainProgress && !game.bossActive) {        const def = game.lastChainProgress.def;
        const val = game.lastChainProgress.value;
        const w = 240;
        this.panel(ctx, 360, 54, w, 22, { fill: 'rgba(8,13,27,.72)', border: 'rgba(242,196,106,.22)', notch: 5, alpha: 0.95 });
        Font.cn(ctx, def.zh, 372, 65, 10, COL.goldBright, { weight: 600 });
        Font.pixel(ctx, `${val}/${def.goal}`, 576, 60, { scale: 1, color: COL.gold, align: 'right' });
        this.bar(ctx, 442, 61, 128, 3, val / def.goal, def.color);
      }

      // 底部形态轮盘 / Boss 战时的精简侧栏
      if (game.bossActive) {
        this.drawBossQuickRail(game, ctx);
      } else {
        this.drawFormWheel(game, ctx);
        this.drawActionHints(game, ctx);
      }

      // 标志牌文字
      if (game.activeSign && game.state === 'play' && !game.chainBanner && !game.bossActive) this.drawSignCard(game, ctx);

      // 录制 / 车具
      this.drawRecordingChip(game, ctx);
      this.drawVehicleHUD(game, ctx);

      // 低血量红边
      if (p.hearts <= 1) {
        ctx.save();
        const a = 0.05 + (Math.sin(game.realTime * 3) + 1) * 0.03;
        const grad = ctx.createRadialGradient(480, 270, 180, 480, 270, 560);
        grad.addColorStop(0, 'rgba(232,90,99,0)');
        grad.addColorStop(1, `rgba(232,90,99,${a})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, C.UI_W, C.UI_H);
        ctx.restore();
      }

      // 提示消息
      this.drawToasts(game, ctx);
      ctx.restore();

      if (!behind && game.chainBanner) {
        // 已在 draw 中调用
      }
    },

    drawBossQuickRail(game, ctx) {
      const p = game.player;
      const x = 24, y = 112, w = 48, h = 252;
      this.panel(ctx, x, y, w, h, { fill: 'rgba(8,13,27,.66)', border: 'rgba(160,140,220,.24)', notch: 6 });
      FORM_ORDER.forEach((id, i) => {
        const f = PB.FORM_BY_ID[id];
        const unlocked = !!p.forms[id];
        const active = p.currentForm === id;
        const cx = x + w / 2, cy = y + 26 + i * 42;
        if (active) {
          ctx.globalAlpha = 0.2 + U.animate(game.realTime, 0.9) * 0.08;
          ctx.fillStyle = f.color;
          ctx.beginPath(); ctx.arc(cx, cy, 18, 0, TAU); ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.globalAlpha = unlocked ? 1 : 0.3;
        this.diamond(ctx, cx, cy, 11, 13, 'rgba(9,13,26,.95)', unlocked ? f.color : COL.dim);
        this.drawFormGlyph(ctx, id, cx, cy - 1, 9, unlocked ? f.color : COL.dim);
        Font.pixel(ctx, `${i + 1}`, cx - 19, cy - 18, { scale: 1, color: COL.muted });
        if (active) {
          ctx.fillStyle = f.color;
          ctx.fillRect(cx - 10, cy + 16, 20, 2);
        }
        ctx.globalAlpha = 1;
      });
      // Echo / Chrono
      const ey = y + h - 54;
      ctx.globalAlpha = p.arts.echo ? 1 : 0.3;
      Font.pixel(ctx, 'F', x + 10, ey, { scale: 1, color: COL.gold });
      this.drawFormGlyph(ctx, 'echo', x + 29, ey + 4, 7, p.arts.echo ? COL.gold : COL.dim);
      this.bar(ctx, x + 8, ey + 14, 32, 3, p.arts.echo ? (p.echoState === 'recording' ? p.echoTimer / 4 : (p.echoCooldown > 0 ? 1 - p.echoCooldown / C.ECHO_COOLDOWN : 1)) : 0, COL.gold);
      ctx.globalAlpha = p.arts.chrono ? 1 : 0.3;
      Font.pixel(ctx, 'L', x + 10, ey + 28, { scale: 1, color: COL.cyan });
      this.bar(ctx, x + 18, ey + 36, 24, 4, p.arts.chrono ? p.slowMeter / C.BULLET_MAX : 0, p.slowActive ? COL.white : COL.cyan);
      ctx.globalAlpha = 1;
    },

    drawFormWheel(game, ctx) {
      const p = game.player;
      const x = 18, y = 432, w = 438, h = 90;
      this.panel(ctx, x, y, w, h, { fill: 'rgba(8,13,27,.84)', border: 'rgba(120,170,210,.26)', notch: 8 });
      const form = PB.FORM_BY_ID[p.currentForm];
      ctx.save();
      if (form) {
        Font.cn(ctx, form.zh, x + 18, y + 17, 15, form.color, { weight: 700 });
        Font.cn(ctx, form.en, x + 18, y + 30, 8, 'rgba(180,200,230,.6)', { weight: 500, font: Font.mono });
      } else {
        Font.cn(ctx, '基础形态', x + 18, y + 17, 15, COL.text, { weight: 700 });
        Font.cn(ctx, 'UNBOUND', x + 18, y + 30, 8, COL.muted, { weight: 500, font: Font.mono });
      }
      const shortNames = { solar: '烈焰', cryo: '霜晶', grav: '星蚀', warp: '星隙' };
      FORM_ORDER.forEach((id, i) => {
        const f = PB.FORM_BY_ID[id];
        const unlocked = !!p.forms[id];
        const active = p.currentForm === id;
        const cx = x + 40 + i * 52;
        const cy = y + 52;
        if (active) {
          ctx.globalAlpha = 0.18 + U.animate(game.realTime, 0.9) * 0.08;
          ctx.fillStyle = f.color;
          ctx.beginPath(); ctx.arc(cx, cy, 22, 0, TAU); ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.globalAlpha = unlocked ? 1 : 0.32;
        this.diamond(ctx, cx, cy, 14, 17, 'rgba(9,13,26,.95)', unlocked ? f.color : 'rgba(220,235,250,.2)', active ? 2 : 1);
        this.drawFormGlyph(ctx, id, cx, cy - 1, 12, unlocked ? f.color : COL.dim);
        Font.pixel(ctx, `${i + 1}`, cx - 24, cy - 22, { scale: 1, color: unlocked ? COL.muted : COL.dim });
        if (!unlocked) {
          ctx.strokeStyle = 'rgba(210,225,245,.35)';
          ctx.strokeRect(cx - 3, cy - 4, 6, 5);
          ctx.beginPath(); ctx.arc(cx, cy - 5, 3, Math.PI, 0); ctx.stroke();
        }
        Font.cn(ctx, shortNames[id], cx, y + h - 10, 8, unlocked ? COL.text : COL.dim, { align: 'center', weight: 500 });
        if (active) {
          ctx.fillStyle = f.color;
          ctx.fillRect(cx - 13, cy + 21, 26, 2);
        }
        ctx.globalAlpha = 1;
      });
      // 回响
      const ex = x + 252;
      const arts = p.arts;
      ctx.globalAlpha = arts.echo ? 1 : 0.3;
      Font.pixel(ctx, 'F', ex, y + 34, { scale: 2, color: COL.gold });
      Font.cn(ctx, '回响', ex + 19, y + 41, 8, arts.echo ? COL.goldBright : COL.dim, { weight: 500 });
      this.diamond(ctx, ex + 9, y + 56, 8, 10, arts.echo ? 'rgba(242,196,106,.18)' : null, arts.echo ? COL.gold : COL.dim);
      this.drawFormGlyph(ctx, 'echo', ex + 9, y + 56, 8, arts.echo ? COL.gold : COL.dim);
      const echPct = p.echoState === 'recording' ? (p.echoTimer / C.ECHO_RECORD) : (p.echoCooldown > 0 ? 1 - p.echoCooldown / C.ECHO_COOLDOWN : 1);
      this.bar(ctx, ex - 2, y + 72, 54, 4, arts.echo ? echPct : 0, COL.gold);
      Font.cn(ctx, p.echoState === 'recording' ? '录制中' : '分身', ex + 8, y + 84, 8, arts.echo ? COL.goldBright : COL.dim, { weight: 500 });
      ctx.globalAlpha = 1;
      // 时停
      const chx = x + 330;
      ctx.globalAlpha = arts.chrono ? 1 : 0.3;
      Font.pixel(ctx, 'L.V', chx, y + 34, { scale: 2, color: COL.cyan });
      this.drawFormGlyph(ctx, 'clock', chx + 58, y + 48, 11, arts.chrono ? COL.cyan : COL.dim);
      this.bar(ctx, chx, y + 66, 88, 5, arts.chrono ? p.slowMeter / C.BULLET_MAX : 0, p.slowActive ? COL.white : COL.cyan);
      Font.cn(ctx, p.slowActive ? '时停中' : '子弹时间', chx, y + 80, 9, arts.chrono ? COL.cyan : COL.dim, { weight: 500 });
      ctx.globalAlpha = 1;
      ctx.restore();
    },

    drawFormGlyph(ctx, id, cx, cy, s, color) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      if (id === 'solar') {
        ctx.fillRect(cx - 2, cy - s * 0.6, 4, s);
        ctx.fillRect(cx - 4, cy + s * 0.1, 3, s * 0.5);
        ctx.fillRect(cx + 1, cy + s * 0.1, 3, s * 0.5);
        ctx.fillStyle = '#fff4cf';
        ctx.fillRect(cx - 1, cy - s * 0.2, 2, s * 0.45);
      } else if (id === 'cryo') {
        for (let i = 0; i < 3; i++) {
          const a = i * Math.PI / 3;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(a);
          ctx.fillRect(-1, -s, 2, s * 2);
          ctx.fillRect(-s * 0.6, -s * 0.5, 2, s * 0.4);
          ctx.fillRect(s * 0.35, s * 0.25, 2, s * 0.4);
          ctx.restore();
        }
      } else if (id === 'grav') {
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.7, 0, TAU);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillRect(cx - 2, cy - s, 4, s);
        ctx.fillRect(cx - 5, cy - s + 1, 4, 2);
        ctx.fillRect(cx + 1, cy + s - 3, 4, 2);
      } else if (id === 'warp') {
        this.diamond(ctx, cx, cy, s * 0.62, s, color);
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 1, cy - s * 0.4, 2, s * 0.8);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.arc(cx, cy, s * 1.05, 0.4, 2.4); ctx.stroke();
      } else if (id === 'echo') {
        ctx.globalAlpha = 0.7;
        this.diamond(ctx, cx - 3, cy - 2, s * 0.5, s * 0.7, null, color);
        ctx.globalAlpha = 1;
        this.diamond(ctx, cx + 3, cy + 2, s * 0.5, s * 0.7, null, color);
      } else if (id === 'clock') {
        ctx.beginPath(); ctx.arc(cx, cy, s * 0.8, 0, TAU); ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillRect(cx - 1, cy - s * 0.6, 2, s * 0.65);
        ctx.fillRect(cx - 1, cy - 1, s * 0.55, 2);
      }
      ctx.restore();
    },

    drawActionHints(game, ctx) {
      const p = game.player;
      const x = 624, y = 438, w = 318, h = 84;
      this.panel(ctx, x, y, w, h, { fill: 'rgba(8,13,27,.78)', border: 'rgba(110,160,200,.22)', notch: 8 });
      if (game.bossActive && game.boss) {
        const boss = game.boss;
        const pd = boss.phaseData ? boss.phaseData() : { color: COL.violet, hintZh: '攻击核心', hintEn: 'STRIKE THE CORE' };
        Font.cn(ctx, `棱镜守望者 · 阶段 ${boss.phase || 1}/3`, x + 16, y + 17, 12, pd.color, { weight: 700 });
        Font.cn(ctx, boss.vulnerable ? '核心暴露！冲刺 / 踩踏 / 火球' : `破盾：${pd.hintZh}`,
          x + 16, y + 38, 11, boss.vulnerable ? COL.goldBright : COL.text, { weight: 600 });
        Font.cn(ctx, boss.vulnerable ? '在子弹时间中更容易弹反能量弹。' : '靠近 Boss，用对应形态技能击碎护盾。',
          x + 16, y + 54, 9, COL.muted, { weight: 500 });
        if (boss.vulnerable) {
          this.bar(ctx, x + 16, y + 64, w - 32, 4, U.clamp(boss.vulnT / 4.3, 0, 1), COL.gold);
        } else {
          const form = PB.FORM_BY_ID[pd.form];
          this.keycap(ctx, form ? form.key : 'J', x + w - 46, y + 28, { padX: 6, color: pd.color, border: U.rgba(pd.color, 0.5) });
          Font.cn(ctx, form ? form.zh : '形态', x + w - 90, y + 58, 9, COL.muted, { align: 'right', weight: 500 });
        }
        return;
      }
      if (p.vehicle) {
        const names = { cart: ['熔核矿车', 'CINDER CART'], glider: ['霜翼滑翔翼', 'FROSTWING GLIDER'], mech: ['棱镜机兵', 'PRISM STRIDER'] };
        const nm = names[p.vehicle.type] || ['载具', 'VEHICLE'];
        Font.cn(ctx, nm[0], x + 16, y + 18, 14, COL.goldBright, { weight: 700 });
        Font.pixel(ctx, nm[1], x + 16, y + 27, { scale: 1, color: COL.muted });
        let text = '←→ 加减速 · Space 跳跃 · ↓ 下车';
        if (p.vehicle.type === 'glider') text = '按住跳跃上升 · ↓ 俯冲 · Shift 加速';
        if (p.vehicle.type === 'mech') text = 'J 棱镜炮 · Shift 冲撞 · ↓ 离开';
        Font.cn(ctx, text, x + 16, y + 50, 11, COL.text, { weight: 500 });
        if (p.vehicle.type === 'mech') {
          for (let i = 0; i < 3; i++) {
            this.diamond(ctx, x + 18 + i * 15, y + 67, 4, 5, i < p.vehicleHp ? COL.cyan : 'rgba(255,255,255,.1)');
          }
        }
        this.keycap(ctx, '↓', x + w - 48, y + 42, { padX: 6 });
        return;
      }
      const form = PB.FORM_BY_ID[p.currentForm];
      if (!form) {
        Font.cn(ctx, '寻找棱镜祭坛', x + 16, y + 20, 14, COL.text, { weight: 700 });
        Font.pixel(ctx, 'FIND A PRISM SHRINE', x + 16, y + 30, { scale: 1, color: COL.muted });
        Font.cn(ctx, '祭坛会唤醒第一种形态。', x + 16, y + 52, 11, COL.muted, { weight: 500 });
        return;
      }
      Font.cn(ctx, form.skillZh, x + 16, y + 18, 14, form.color, { weight: 700 });
      Font.pixel(ctx, form.skillEn, x + 16, y + 27, { scale: 1, color: COL.muted });
      let line1 = 'J 使用形态技能';
      let line2 = '↓ + J  次级技能';
      if (form.id === 'solar') { line1 = 'J 投出弹跳火球 · 可点燃/引爆'; line2 = '火球入水 → 蒸汽升流柱'; }
      if (form.id === 'cryo') { line1 = 'J 霜华脉冲 · 冻结/驯服/冰封'; line2 = '↓ + J  在脚下凝结临时冰块'; }
      if (form.id === 'grav') { line1 = 'J 翻转自身重力'; line2 = '↓ + J  重力脉冲 · 翻转物体'; }
      if (form.id === 'warp') { line1 = 'J 抛出星棱 / 再按瞬移'; line2 = '钉住敌人或桶 → 量子换位'; }
      Font.cn(ctx, line1, x + 16, y + 48, 10, COL.text, { weight: 500 });
      Font.cn(ctx, line2, x + 16, y + 63, 10, COL.muted, { weight: 500 });
      this.keycap(ctx, 'J', x + w - 38, y + 44, { padX: 6 });
    },

    drawSignCard(game, ctx) {
      const s = game.activeSign;
      if (!s) return;
      const x = 150, y = 84, w = 520, h = 100;
      this.panel(ctx, x, y, w, h, { fill: 'rgba(9,14,28,.94)', border: 'rgba(242,196,106,.36)', accent: COL.gold, notch: 8 });
      Font.pixel(ctx, 'WAYSTONE', x + 18, y + 13, { scale: 1, color: COL.gold });
      Font.cn(ctx, '路 标', x + 18 + 52, y + 16, 9, COL.muted, { weight: 500 });
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = COL.gold;
      ctx.fillRect(x + 18, y + 26, w - 36, 1);
      ctx.restore();
      const zhLines = String(s.zh || '').split('\n');
      let ly = y + 42;
      for (const line of zhLines.slice(0, 3)) {
        Font.cn(ctx, line, x + 18, ly, 14, COL.text, { weight: 500 });
        ly += 19;
      }
      const enLines = String(s.en || '').split('\n');
      let ey = y + h - 23;
      for (const line of enLines.slice(0, 2)) {
        Font.cn(ctx, line, x + 18, ey, 8, 'rgba(175,195,225,.55)', { weight: 500, font: Font.mono, letterSpacing: '0.5px' });
        ey += 10;
      }
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = COL.gold;
      ctx.fillRect(x + w - 32, y + 18, 2, h - 36);
      this.diamond(ctx, x + w - 31, y + h / 2, 5, 7, null, COL.gold);
      ctx.restore();
    },

    drawBossBar(game, ctx) {
      const boss = game.boss;
      const w = 480, x = 240, y = 48;
      this.panel(ctx, x, y, w, 60, { fill: 'rgba(8,12,24,.84)', border: 'rgba(180,140,255,.35)', accent: COL.violet, notch: 7 });
      Font.cn(ctx, boss.nameZh || C.BOSS_NAME, x + 16, y + 14, 13, '#efe6ff', { weight: 700 });
      Font.cn(ctx, boss.nameEn || C.BOSS_NAME_EN, x + 16, y + 24, 8, 'rgba(200,180,255,.55)', { weight: 500, font: Font.mono });
      const phase = boss.phase || 1;
      Font.pixel(ctx, `PHASE ${phase}/3`, x + w - 16, y + 11, { scale: 1, color: COL.violet, align: 'right' });
      const pct = boss.hp != null && boss.maxHp ? U.clamp(boss.hp / boss.maxHp, 0, 1) : 1;
      const segs = 3;
      const bw = w - 32;
      for (let i = 0; i < segs; i++) {
        const sx = x + 16 + i * (bw / segs);
        ctx.fillStyle = 'rgba(255,255,255,.06)';
        ctx.fillRect(sx, y + 31, bw / segs - 3, 8);
        ctx.fillStyle = i < phase - 1 ? 'rgba(180,140,255,.25)' : 'rgba(180,140,255,.12)';
        ctx.fillRect(sx, y + 31, bw / segs - 3, 8);
      }
      const phaseWidth = bw / segs;
      ctx.fillStyle = COL.violet;
      const fillTotal = pct * bw;
      ctx.fillRect(x + 16, y + 31, fillTotal, 8);
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fillRect(x + 16, y + 31, fillTotal, 1);
      ctx.fillStyle = COL.gold;
      for (let i = 1; i < segs; i++) ctx.fillRect(x + 16 + i * phaseWidth - 2, y + 29, 2, 12);
      // 当前需要的破盾方式
      const pd = boss.phaseData ? boss.phaseData() : null;
      const form = pd ? PB.FORM_BY_ID[pd.form] : null;
      const hint = boss.vulnerable
        ? '核心暴露 · 冲刺 / 踩踏 / 火球'
        : pd
          ? `破盾：${pd.hintZh}（${pd.inputZh}）· 靠近 Boss`
          : '';
      Font.cn(ctx, hint, x + 16, y + 51, 9, boss.vulnerable ? COL.goldBright : 'rgba(220,205,245,.78)', { weight: 500 });
      if (boss.vulnerable) {
        this.bar(ctx, x + w - 104, y + 48, 88, 3, U.clamp(boss.vulnT / 4.3, 0, 1), COL.gold);
      }
    },

    drawRecordingChip(game, ctx) {
      const p = game.player;
      if (!p || p.echoState !== 'recording') return;
      const t = p.echoTimer;
      const w = 196, x = 382, y = 198;
      this.panel(ctx, x, y, w, 34, { fill: 'rgba(30,24,10,.9)', border: 'rgba(255,217,102,.5)', notch: 5 });
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(game.realTime * 8) * 0.25;
      ctx.fillStyle = COL.gold;
      ctx.beginPath(); ctx.arc(x + 18, y + 17, 4, 0, TAU); ctx.fill();
      ctx.restore();
      Font.cn(ctx, '录制回响', x + 30, y + 13, 10, COL.goldBright, { weight: 600 });
      Font.pixel(ctx, `REC ${t.toFixed(1)} / 4.0`, x + 30, y + 22, { scale: 1, color: 'rgba(255,230,160,.6)' });
      this.bar(ctx, x + 120, y + 16, 62, 4, Math.min(1, t / 4), COL.gold);
      Font.pixel(ctx, 'F', x + w - 22, y + 10, { scale: 2, color: COL.gold });
    },

    drawVehicleHUD(game, ctx) {
      const p = game.player;
      if (!p || !p.vehicle) return;
      // 由 drawActionHints 展示大部分信息；这里补一条速度
      if (p.vehicle.type === 'cart') {
        const spd = Math.abs(p.cartSpeed) / 7.6;
        this.bar(ctx, 630, 508, 150, 4, spd, COL.gold);
      }
    },

    drawToasts(game, ctx) {
      if (game.bossActive) return;
      let y = game.bossActive ? 108 : 84;
      for (let i = 0; i < Math.min(3, game.toasts.length); i++) {
        const t = game.toasts[i];
        const w = 252, x = 690, h = 46;
        const a = U.clamp(t.t / 0.3, 0, 1) * U.clamp((t.max - t.t + 0.001) / 0.2, 0, 1);
        const accent = t.type === 'chain' ? COL.gold : t.type === 'grand' ? COL.cyan : t.type === 'boss' ? COL.violet : COL.cyan;
        ctx.save();
        ctx.globalAlpha = Math.min(1, a + 0.15);
        this.panel(ctx, x, y, w, h, { fill: 'rgba(8,13,27,.88)', border: U.rgba(accent, 0.35), notch: 5 });
        ctx.fillStyle = accent;
        ctx.fillRect(x + 1, y + 8, 2, h - 16);
        Font.cn(ctx, t.title, x + 14, y + 16, 12, COL.text, { weight: 600 });
        Font.pixel(ctx, t.subtitle || '', x + 14, y + 28, { scale: 1, color: 'rgba(170,190,220,.55)' });
        this.bar(ctx, x + 14, y + 40, w - 28, 2, Math.max(0, t.t / t.max), accent);
        ctx.restore();
        y += 52;
      }
    },

    drawChainBanner(game, ctx) {
      const b = game.chainBanner;
      if (!b) return;
      const def = b.def;
      const t = 1 - b.t / b.max;
      const inT = U.clamp(t / 0.12, 0, 1);
      const outT = U.clamp((b.t - 0.35) / 0.4, 0, 1);
      const scale = 0.85 + 0.15 * U.easeOutBack(inT);
      const alpha = Math.min(inT, outT);
      const cx = 480, cy = 226;
      const w = 620, h = 154;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      // 外光
      ctx.globalAlpha = alpha * 0.12;
      ctx.fillStyle = def.color;
      ctx.beginPath(); ctx.arc(0, 0, 190, 0, TAU); ctx.fill();
      ctx.globalAlpha = alpha;
      this.panel(ctx, -w / 2, -h / 2, w, h, { fill: 'rgba(9,13,26,.95)', border: U.rgba(COL.gold, 0.6), accent: COL.gold, notch: 10 });
      // 放射线
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * 0.1;
      ctx.strokeStyle = def.color;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + game.realTime * 0.2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 50, Math.sin(a) * 34);
        ctx.lineTo(Math.cos(a) * 300, Math.sin(a) * 130);
        ctx.stroke();
      }
      ctx.restore();
      // 徽记
      this.drawSigil(ctx, def.num, -212, -8, 30, def.color, true, 2.2);
      Font.cn(ctx, '炼金连携达成', -158, -44, 11, COL.gold, { weight: 700 });
      Font.pixel(ctx, 'ALCHEMY CHAIN COMPLETE', -158, -32, { scale: 1, color: 'rgba(255,230,160,.6)' });
      Font.cn(ctx, def.zh, -158, 2, 27, COL.white, { weight: 800 });
      Font.pixel(ctx, def.en, -158, 18, { scale: 2, color: def.color });
      Font.cn(ctx, def.rewardZh, -158, 50, 10, COL.muted, { weight: 500 });
      Font.pixel(ctx, `CHAIN ${PB.pad ? PB.pad(def.num) : def.num} · ${PB.Chains.countDone()}/16`, 260, 50, { scale: 1, color: COL.gold, align: 'right' });
      // 角饰
      ctx.strokeStyle = U.rgba(COL.gold, 0.5);
      ctx.strokeRect(-w / 2 + 8, -h / 2 + 8, 16, 16);
      ctx.strokeRect(w / 2 - 24, h / 2 - 24, 16, 16);
      ctx.restore();
      // 屏幕金色闪
      if (b.t > b.max - 0.12 && PB.Save.data.settings.flashes) {
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = def.color;
        ctx.fillRect(0, 0, C.UI_W, C.UI_H);
        ctx.restore();
      }
    },

    drawSigil(ctx, num, cx, cy, r, color, done, numberScale = 1.6) {
      ctx.save();
      if (done) {
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(cx, cy, r * 1.6, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
      this.diamond(ctx, cx, cy, r * 0.78, r, done ? 'rgba(20,16,8,.9)' : 'rgba(12,17,32,.8)', color, done ? 2 : 1);
      this.diamond(ctx, cx, cy, r * 0.5, r * 0.65, null, U.rgba(color, done ? 0.7 : 0.35));
      Font.pixel(ctx, String(num).padStart ? String(num).padStart(2, '0') : String(num), cx, cy - 5 * numberScale + 1, {
        scale: Math.max(1, Math.round(numberScale)), color: done ? color : U.rgba(color, 0.65), align: 'center',
      });
      if (done) {
        ctx.strokeStyle = 'rgba(255,230,160,.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 4, cy + r + 5);
        ctx.lineTo(cx + 4, cy + r + 5);
        ctx.stroke();
      }
      ctx.restore();
    },

    // ---------------------------------------------------------------- pause / settings / controls
    drawPause(game, ctx) {
      const x = 260, y = 90, w = 440, h = 360;
      this.panel(ctx, x, y, w, h, { fill: 'rgba(9,14,28,.96)', border: 'rgba(126,240,224,.28)', accent: COL.cyan });
      Font.cn(ctx, '暂 停', x + 28, y + 36, 24, COL.text, { weight: 800 });
      Font.pixel(ctx, 'PAUSED', x + 28, y + 50, { scale: 1, color: COL.cyan });
      const ch = PB.Levels.get(game.chapterIndex);
      Font.cn(ctx, ch ? `${ch.nameZh}  ·  第 ${ch.num} 章` : '', x + w - 28, y + 30, 11, COL.muted, { align: 'right', weight: 500 });
      Font.pixel(ctx, U.formatTime(game.chapterTime), x + w - 28, y + 42, { scale: 1, color: COL.dim, align: 'right' });
      this.divider(ctx, x + 24, y + 64, w - 48, COL.lineSoft);
      const items = ['resume', 'codex', 'controls', 'settings', 'restart', 'title'];
      items.forEach((it, i) => {
        const lab = ITEM_LABELS[it];
        const yy = y + 82 + i * 39;
        const sel = i === game.ui.pauseIndex;
        this.addHit(x + 20, yy - 2, w - 40, 32, i, 'pause');
        if (sel) {
          const grad = ctx.createLinearGradient(x + 20, yy, x + w - 20, yy);
          grad.addColorStop(0, 'rgba(126,240,224,.16)');
          grad.addColorStop(1, 'rgba(126,240,224,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(x + 20, yy - 2, w - 40, 32);
          ctx.fillStyle = COL.cyan;
          this.diamond(ctx, x + 32, yy + 11, 4, 5, COL.cyan);
        }
        Font.cn(ctx, lab[0], x + 48, yy + 8, 15, sel ? COL.cyan : COL.text, { weight: sel ? 700 : 500 });
        Font.pixel(ctx, lab[1], x + 48, yy + 19, { scale: 1, color: sel ? 'rgba(126,240,224,.6)' : COL.dim });
      });
      Font.cn(ctx, 'Esc 返回  ·  Enter/点击 确认', x + 28, y + h - 22, 10, COL.dim, { weight: 500 });
      Font.cn(ctx, 'F 回响 · L/V 子弹时间 · TAB 图鉴', x + w - 28, y + h - 23, 8, 'rgba(150,170,205,.4)', { align: 'right', weight: 500, font: Font.mono });
    },

    drawReturnBackdrop(game, ctx) {
      const ret = game.state === 'controls' ? game.ui.controlsReturn : game.ui.settingsReturn;
      if (ret === 'title') {
        this.drawTitleBackdrop(game, ctx);
        // 标题水印
        Font.pixel(ctx, 'PRISMBOUND', 88, 260, { scale: 4, color: 'rgba(240,245,255,.08)' });
        return;
      }
      this.drawHUD(game, ctx, true);
      this.dim(ctx, 0.8);
    },

    drawSettings(game, ctx) {
      const st = PB.Save.data.settings;
      const x = 200, y = 64, w = 560, h = 412;
      this.panel(ctx, x, y, w, h, { fill: 'rgba(9,14,28,.96)', border: 'rgba(126,240,224,.28)', accent: COL.cyan });
      Font.cn(ctx, '设 置', x + 28, y + 36, 24, COL.text, { weight: 800 });
      Font.pixel(ctx, 'SETTINGS', x + 28, y + 50, { scale: 1, color: COL.cyan });
      Font.cn(ctx, '所有音量与画面设置即时生效', x + w - 28, y + 40, 9, COL.dim, { align: 'right', weight: 500 });
      Font.cn(ctx, '声音与显示', x + 28, y + 80, 11, COL.muted, { weight: 500 });
      this.divider(ctx, x + 24, y + 92, w - 48, COL.lineSoft);
      const items = ['music', 'sfx', 'shake', 'flashes', 'back'];
      items.forEach((it, i) => {
        const yy = y + 108 + i * 48;
        const sel = i === game.ui.settingsIndex;
        this.addHit(x + 20, yy - 4, w - 40, 38, i, 'settings');
        if (sel) {
          ctx.fillStyle = 'rgba(126,240,224,.1)';
          ctx.fillRect(x + 20, yy - 4, w - 40, 38);
          ctx.fillStyle = COL.cyan;
          ctx.fillRect(x + 22, yy, 2, 28);
        }
        const lab = ITEM_LABELS[it];
        Font.cn(ctx, lab[0], x + 38, yy + 10, 14, sel ? COL.cyan : COL.text, { weight: sel ? 700 : 500 });
        Font.pixel(ctx, lab[1], x + 38, yy + 22, { scale: 1, color: sel ? 'rgba(126,240,224,.55)' : COL.dim });
        if (it === 'music' || it === 'sfx') {
          const val = it === 'music' ? st.music : st.sfx;
          const bx = x + 300, bw = 180;
          this.addHit(bx, yy + 8, bw, 16, i, 'settingsbar');
          this.bar(ctx, bx, yy + 12, bw, 8, val, sel ? COL.cyan : COL.cyanDim);
          for (let i2 = 1; i2 < 5; i2++) { ctx.fillStyle = 'rgba(8,12,22,.5)'; ctx.fillRect(bx + (bw / 5) * i2, yy + 12, 1, 8); }
          Font.pixel(ctx, `${Math.round(val * 100)}%`, x + w - 28, yy + 8, { scale: 1, color: sel ? COL.text : COL.muted, align: 'right' });
          Font.pixel(ctx, '← →', x + w - 28, yy + 20, { scale: 1, color: COL.dim, align: 'right' });
        } else if (it === 'shake' || it === 'flashes') {
          const on = it === 'shake' ? st.shake : st.flashes;
          this.keycap(ctx, on ? 'ON' : 'OFF', x + 335, yy + 5, { color: on ? COL.cyan : COL.dim, border: on ? 'rgba(126,240,224,.5)' : 'rgba(150,165,190,.25)', padX: 8 });
          Font.cn(ctx, on ? '已开启' : '已关闭', x + 430, yy + 15, 11, on ? COL.cyan : COL.dim, { weight: 500 });
          Font.pixel(ctx, 'ENTER', x + w - 28, yy + 12, { scale: 1, color: COL.dim, align: 'right' });
        } else if (it === 'back') {
          Font.pixel(ctx, 'ESC / ENTER', x + w - 28, yy + 12, { scale: 1, color: COL.dim, align: 'right' });
        }
      });
      Font.cn(ctx, '↑↓ 选择 · ←→ 调整 · Enter 切换 · Esc 返回', x + 28, y + h - 22, 10, COL.dim, { weight: 500 });
      if (st.flashes === false) {
        Font.cn(ctx, '光效已减弱，以保护对闪光敏感的玩家', x + 28, y + h - 42, 10, 'rgba(126,240,224,.5)', { weight: 500 });
      }
    },

    drawControls(game, ctx) {
      const x = 90, y = 42, w = 780, h = 456;
      this.panel(ctx, x, y, w, h, { fill: 'rgba(9,14,28,.97)', border: 'rgba(126,240,224,.28)', accent: COL.cyan });
      Font.cn(ctx, '操作说明', x + 28, y + 34, 22, COL.text, { weight: 800 });
      Font.pixel(ctx, 'CONTROLS · KEYBOARD & GAMEPAD', x + 28, y + 48, { scale: 1, color: COL.cyan });
      Font.cn(ctx, '所有按键均可即时使用；Tab 随时打开连携图鉴。', x + w - 28, y + 34, 10, COL.dim, { align: 'right', weight: 500 });
      this.divider(ctx, x + 24, y + 62, w - 48, COL.lineSoft);
      const colX = [x + 30, x + 402];
      const left = [
        ['← → / A D', '移动', 'MOVE'],
        ['SPACE / Z', '跳跃（按住更高）', 'JUMP · HOLD FOR HEIGHT'],
        ['SHIFT / X', '八向冲刺', 'EIGHT-WAY DASH'],
        ['↓（奔跑中）', '滑铲 · 滑铲中跳 = 跃冲', 'SLIDE · JUMP = WAVE-SLIDE'],
        ['空中 SHIFT+↓', '陨石砸地', 'METEOR POUND'],
        ['1 / 2 / 3 / 4', '切换四棱镜形态', 'SWITCH PRISM FORMS'],
        ['J', '当前形态技能', 'CURRENT FORM SKILL'],
      ];
      const right = [
        ['↓ + J', '次级技能（冰台 / 重力脉冲）', 'SECONDARY SKILL'],
        ['F', '录制 / 释放回响分身', 'ECHO CLONE'],
        ['L / V（按住）', '子弹时间', 'BULLET TIME'],
        ['TAB', '炼金连携图鉴', 'ALCHEMY CODEX'],
        ['ESC / P', '暂停', 'PAUSE'],
        ['M', '静音', 'MUTE'],
      ];
      left.forEach((r, i) => {
        const ry = y + 80 + i * 40;
        this.keycap(ctx, r[0], colX[0], ry, { color: COL.goldBright, border: 'rgba(242,196,106,.38)', padX: 7 });
        Font.cn(ctx, r[1], colX[0] + 120, ry + 7, 12, COL.text, { weight: 500 });
        Font.cn(ctx, r[2], colX[0] + 120, ry + 19, 8, COL.dim, { weight: 500, font: Font.mono, letterSpacing: '0.5px' });
      });
      right.forEach((r, i) => {
        const ry = y + 80 + i * 40;
        this.keycap(ctx, r[0], colX[1], ry, { color: COL.goldBright, border: 'rgba(242,196,106,.38)', padX: 7 });
        Font.cn(ctx, r[1], colX[1] + 120, ry + 7, 12, COL.text, { weight: 500 });
        Font.cn(ctx, r[2], colX[1] + 120, ry + 19, 8, COL.dim, { weight: 500, font: Font.mono, letterSpacing: '0.5px' });
      });
      Font.cn(ctx, '手柄：A 跳跃 / X 冲刺 / Y 技能 / B 回响 / LB·RB 切换形态与子弹时间', colX[0], y + 386, 9, 'rgba(126,240,224,.55)', { weight: 500 });
      Font.cn(ctx, '手柄：START 暂停 · 方向键 / 左摇杆移动 · 右摇杆瞄准', colX[0], y + 402, 9, 'rgba(150,170,205,.4)', { weight: 500 });
      Font.cn(ctx, 'Esc / Enter / 点击 返回', x + w - 28, y + h - 20, 10, COL.dim, { align: 'right', weight: 500 });
    },

    // ---------------------------------------------------------------- codex
    drawCodex(game, ctx) {
      // 背景
      ctx.save();
      const g = ctx.createLinearGradient(0, 0, C.UI_W, C.UI_H);
      g.addColorStop(0, 'rgba(5,8,18,.98)');
      g.addColorStop(0.55, 'rgba(9,13,26,.97)');
      g.addColorStop(1, 'rgba(13,16,34,.98)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, C.UI_W, C.UI_H);
      // 背景细线
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = COL.cyan;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 80 + i * 56);
        ctx.lineTo(C.UI_W, 40 + i * 56);
        ctx.stroke();
      }
      ctx.restore();

      Font.cn(ctx, '炼金连携图鉴', 38, 40, 25, COL.text, { weight: 800 });
      Font.pixel(ctx, 'ALCHEMY CODEX', 38, 55, { scale: 2, color: COL.gold });
      Font.cn(ctx, '所有机制皆可自由组合；完成连携，点亮棱镜。', 38, 80, 11, COL.muted, { weight: 500 });
      const done = PB.Chains.countDone();
      Font.pixel(ctx, `${String(done).padStart(2, '0')} / 16`, 922, 32, { scale: 2, color: COL.gold, align: 'right' });
      Font.cn(ctx, '已达成', 922, 52, 10, COL.muted, { align: 'right', weight: 500 });
      this.panel(ctx, 832, 62, 90, 24, { fill: 'rgba(9,14,27,.9)', border: 'rgba(126,240,224,.35)', notch: 4 });
      Font.cn(ctx, '关闭 ESC', 877, 78, 10, COL.cyan, { align: 'center', weight: 600 });
      this.addHit(832, 62, 90, 24, 0, 'codexClose');

      const gridX = 36, gridY = 100, cw = 141, chh = 88, gapX = 12, gapY = 10;
      for (let i = 0; i < 16; i++) {
        const def = PB.Chains.defs[i];
        const col = i % 4, row = Math.floor(i / 4);
        const x = gridX + col * (cw + gapX);
        const y = gridY + row * (chh + gapY);
        const sel = i === game.ui.codexIndex;
        this.addHit(x, y, cw, chh, i, 'codex');
        const complete = PB.Chains.isDone(def.id);
        const pct = PB.Chains.progressOf(def.id);
        this.panel(ctx, x, y, cw, chh, {
          fill: sel ? 'rgba(20,29,52,.96)' : 'rgba(9,14,27,.82)',
          border: sel ? U.rgba(def.color, 0.8) : complete ? U.rgba(COL.gold, 0.35) : 'rgba(110,160,200,.14)',
          notch: 6,
        });
        // 编号徽记
        this.drawSigil(ctx, def.num, x + 24, y + 26, 14, complete ? COL.gold : def.color, complete, 1.2);
        Font.cn(ctx, def.zh, x + 42, y + 18, 13, sel ? COL.white : complete ? COL.goldBright : COL.text, { weight: 600 });
        Font.pixel(ctx, def.en.length > 17 ? def.en.slice(0, 17) : def.en, x + 42, y + 29, { scale: 1, color: complete ? 'rgba(255,230,160,.6)' : COL.dim });
        this.bar(ctx, x + 14, y + 48, cw - 28, 3, pct, complete ? COL.gold : def.color);
        Font.pixel(ctx, complete ? 'COMPLETE' : `${Math.round(pct * 100)}%`, x + 14, y + 56, { scale: 1, color: complete ? COL.gold : COL.dim });
        if (complete) {
          ctx.save();
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = COL.gold;
          ctx.strokeRect(x + cw - 24, y + 48, 10, 10);
          ctx.beginPath();
          ctx.moveTo(x + cw - 22, y + 53);
          ctx.lineTo(x + cw - 19, y + 57);
          ctx.lineTo(x + cw - 15, y + 50);
          ctx.stroke();
          ctx.restore();
        }
        // 小装饰
        ctx.globalAlpha = complete ? 0.5 : 0.18;
        ctx.fillStyle = def.color;
        ctx.fillRect(x + cw - 20, y + 12, 2, 2);
        ctx.globalAlpha = 1;
      }

      // 里程碑
      const rewards = PB.Chains.rewards();
      const ry = 508;
      Font.cn(ctx, '里程碑', 38, ry - 7, 11, COL.muted, { weight: 600 });
      rewards.forEach((r, i) => {
        const x = 38 + i * 150;
        ctx.fillStyle = r.done ? COL.gold : 'rgba(255,255,255,.12)';
        this.diamond(ctx, x + 7, ry + 8, 5, 7, r.done ? COL.gold : null, r.done ? COL.gold : 'rgba(255,255,255,.18)');
        Font.cn(ctx, r.zh, x + 18, ry + 5, 10, r.done ? COL.goldBright : COL.dim, { weight: 500 });
        Font.pixel(ctx, `${r.at}/16`, x + 18, ry + 15, { scale: 1, color: r.done ? COL.gold : COL.dim });
      });

      // 详情
      const def = PB.Chains.defs[game.ui.codexIndex];
      const dx = 652, dy = 100, dw = 272, dh = 376;
      this.panel(ctx, dx, dy, dw, dh, { fill: 'rgba(9,14,27,.9)', border: U.rgba(def.color, 0.4), accent: def.color, notch: 8 });
      this.drawSigil(ctx, def.num, dx + dw / 2, dy + 48, 28, def.color, PB.Chains.isDone(def.id), 2.0);
      Font.cn(ctx, def.zh, dx + dw / 2, dy + 96, 24, COL.white, { align: 'center', weight: 800 });
      Font.pixel(ctx, def.en, dx + dw / 2, dy + 112, { scale: 2, color: def.color, align: 'center' });
      this.divider(ctx, dx + 20, dy + 128, dw - 40, COL.lineSoft);
      const complete = PB.Chains.isDone(def.id);
      const pct = PB.Chains.progressOf(def.id);
      Font.cn(ctx, complete ? '已达成 · COMPLETE' : '进行中 · IN PROGRESS', dx + 22, dy + 146, 10, complete ? COL.gold : COL.muted, { weight: 600 });
      this.bar(ctx, dx + 22, dy + 156, dw - 44, 4, pct, def.color);
      // 条件
      Font.cn(ctx, '达成条件', dx + 22, dy + 178, 11, COL.gold, { weight: 600 });
      const zhLines = Font.wrap(ctx, def.hintZh, dw - 44, 12, 500);
      zhLines.forEach((line, i) => Font.cn(ctx, line, dx + 22, dy + 194 + i * 17, 12, COL.text, { weight: 500 }));
      const enLines = Font.wrap(ctx, def.hintEn, dw - 44, 9, 500, Font.mono);
      enLines.slice(0, 3).forEach((line, i) => Font.cn(ctx, line, dx + 22, dy + 260 + i * 12, 9, COL.dim, { weight: 500, font: Font.mono }));
      // 故事
      const loreY = dy + 300;
      Font.cn(ctx, '棱镜记忆', dx + 22, loreY, 10, COL.gold, { weight: 600 });
      const loreZh = Font.wrap(ctx, def.loreZh, dw - 44, 11, 500);
      loreZh.slice(0, 2).forEach((line, i) => Font.cn(ctx, line, dx + 22, loreY + 15 + i * 16, 11, COL.muted, { weight: 500 }));
      const loreEn = Font.wrap(ctx, def.loreEn, dw - 44, 9, 500, Font.mono);
      loreEn.slice(0, 2).forEach((line, i) => Font.cn(ctx, line, dx + 22, loreY + 50 + i * 11, 9, 'rgba(120,140,175,.6)', { weight: 500, font: Font.mono }));

      // 底部提示
      Font.cn(ctx, '方向键选择 · TAB / ESC 关闭', 652, 516, 10, COL.dim, { weight: 500 });
      Font.pixel(ctx, 'EVERY MECHANIC CAN CHAIN', 924, 502, { scale: 1, color: 'rgba(150,170,205,.35)', align: 'right' });
    },

    // ---------------------------------------------------------------- chapter cards / clear
    drawChapterCard(game, ctx) {
      const ch = PB.Levels.get(game.chapterIndex);
      if (!ch) return;
      const t = game.cardT;
      const a = U.clamp(t / 0.35, 0, 1);
      const out = U.clamp((t - 2.2) / 0.4, 0, 1);
      const alpha = Math.min(a, 1 - out * 0.1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(4,7,16,.78)';
      ctx.fillRect(0, 0, C.UI_W, C.UI_H);
      // 横幅
      const slide = (1 - U.easeOutCubic(U.clamp(t / 0.7, 0, 1))) * 40;
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = 'rgba(8,13,27,.9)';
      ctx.fillRect(0, 190, C.UI_W, 168);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ch.accent || COL.gold;
      ctx.fillRect(120, 190, C.UI_W - 240, 1);
      ctx.fillRect(120, 357, C.UI_W - 240, 1);
      // 巨大的章节号水印
      ctx.save();
      ctx.globalAlpha = alpha * 0.08;
      Font.pixel(ctx, String(ch.num).padStart(2, '0'), 806, 226, { scale: 10, color: ch.accent || COL.gold, align: 'center' });
      ctx.restore();
      Font.cn(ctx, `第 ${String(ch.num).padStart(2, '0')} 章`, 130, 214, 12, ch.accent || COL.gold, { weight: 600 });
      Font.pixel(ctx, `CHAPTER ${String(ch.num).padStart(2, '0')}`, 130, 228, { scale: 1, color: 'rgba(242,196,106,.55)', spacing: 1 });
      Font.cn(ctx, ch.nameZh, 128 - slide, 268, 42, COL.white, { weight: 800 });
      Font.pixel(ctx, ch.nameEn, 130, 292, { scale: 3, color: ch.accent || COL.gold });
      Font.cn(ctx, ch.subtitleZh, 130, 326, 13, 'rgba(210,225,245,.7)', { weight: 500 });
      Font.cn(ctx, ch.subtitleEn, 130, 342, 8, 'rgba(150,170,205,.5)', { weight: 500, font: Font.mono });
      // 右侧棱镜
      this.drawPrism(ctx, 790, 274, 54, game.realTime, 0.9);
      Font.cn(ctx, 'ENTER 继续', 130, 380, 11, COL.gold, { weight: 600 });
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(0, 0, C.UI_W, 190);
      ctx.fillRect(0, 358, C.UI_W, C.UI_H - 358);
      ctx.restore();
    },

    drawChapterClear(game, ctx) {
      this.dim(ctx, 0.64);
      const data = game.ui.clearData || {};
      const ch = data.chapter || PB.Levels.get(game.chapterIndex);
      const x = 250, y = 92, w = 460, h = 356;
      this.panel(ctx, x, y, w, h, { fill: 'rgba(9,14,28,.96)', border: 'rgba(242,196,106,.4)', accent: COL.gold });
      Font.cn(ctx, '章节完成', x + w / 2, y + 46, 28, COL.white, { align: 'center', weight: 800 });
      Font.pixel(ctx, 'CHAPTER CLEAR', x + w / 2, y + 64, { scale: 2, color: COL.gold, align: 'center' });
      Font.cn(ctx, ch ? ch.nameZh : '', x + w / 2, y + 100, 15, COL.muted, { align: 'center', weight: 500 });
      this.divider(ctx, x + 30, y + 118, w - 60, COL.lineSoft);
      const rows = [
        ['通关时间', 'TIME', U.formatTime(data.time || 0)],
        ['最佳记录', 'BEST', U.formatTime(data.best || 0) + (data.isNewBest ? '  NEW!' : '')],
        ['本章棱晶', 'SHARDS', String(data.shards || 0)],
        ['连携达成', 'CHAINS', `${data.chains || 0} / 16`],
      ];
      rows.forEach((r, i) => {
        const yy = y + 142 + i * 32;
        Font.cn(ctx, r[0], x + 40, yy, 12, COL.muted, { weight: 500 });
        Font.pixel(ctx, r[1], x + 40, yy + 11, { scale: 1, color: COL.dim });
        Font.pixel(ctx, r[2], x + w - 40, yy - 6, { scale: 2, color: i === 1 && data.isNewBest ? COL.gold : COL.text, align: 'right' });
      });
      const next = PB.Levels.get(game.chapterIndex + 1);
      if (next) {
        Font.cn(ctx, '下一章', x + 40, y + 278, 10, COL.muted, { weight: 500 });
        Font.cn(ctx, `${next.nameZh}  ·  ${next.nameEn}`, x + 40, y + 296, 13, next.accent || COL.gold, { weight: 600 });
      }
      Font.cn(ctx, 'ENTER 继续旅程', x + w / 2, y + h - 24, 11, COL.gold, { align: 'center', weight: 600 });
    },

    drawDead(game, ctx) {
      const p = game.player;
      const a = U.clamp(game.deathT / 0.8, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      const g = ctx.createRadialGradient(480, 270, 80, 480, 270, 620);
      g.addColorStop(0, 'rgba(10,4,10,.55)');
      g.addColorStop(1, 'rgba(8,2,8,.94)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, C.UI_W, C.UI_H);
      ctx.globalAlpha = a * 0.8;
      Font.cn(ctx, '棱 光 熄 灭', 480, 228, 36, '#e8b0b8', { align: 'center', weight: 800 });
      Font.pixel(ctx, 'LIGHT FADED', 480, 252, { scale: 2, color: 'rgba(232,90,99,.75)', align: 'center' });
      const reasons = { water: '深水吞没了灯火', lava: '熔岩熄灭了脚印', spike: '棱刺刺破了光', void: '坠入了没有回响的深渊', enemy: '被暗影击碎了棱光' };
      Font.cn(ctx, reasons[game.deathReason] || '棱光碎裂在旅途中', 480, 292, 12, 'rgba(210,180,190,.6)', { align: 'center', weight: 500 });
      this.progressDots(ctx, 440, 332, 4, Math.min(3, Math.floor(game.deathT * 2)), COL.cyan);
      Font.cn(ctx, '回响重构中…', 480, 360, 11, 'rgba(126,240,224,.6)', { align: 'center', weight: 500 });
      Font.cn(ctx, 'Enter 立即重试', 480, 386, 10, COL.dim, { align: 'center', weight: 500 });
      ctx.restore();
    },

    // ---------------------------------------------------------------- shrine
    drawShrine(game, ctx) {
      const d = game.ui.shrineData;
      if (!d) return;
      const form = PB.FORM_BY_ID[d.formId];
      const color = d.isEcho ? COL.gold : d.isChrono ? COL.cyan : (form ? form.color : COL.gold);
      const nameZh = d.isEcho ? '回响分身' : d.isChrono ? '子弹时间' : form ? form.zh : '棱镜';
      const nameEn = d.isEcho ? 'ECHO CLONE' : d.isChrono ? 'BULLET TIME' : form ? form.en : 'PRISM';
      const reveal = U.clamp(d.t / 0.6, 0, 1);
      ctx.save();
      ctx.globalAlpha = reveal;
      // 背景光
      const grad = ctx.createRadialGradient(320, 232, 30, 320, 232, 500);
      grad.addColorStop(0, U.rgba(color, 0.3));
      grad.addColorStop(0.48, U.rgba(color, 0.08));
      grad.addColorStop(1, 'rgba(4,6,14,0.94)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, C.UI_W, C.UI_H);
      // 左：形态水晶
      this.drawShrineCrystal(ctx, 300, 224, 92, game.realTime, color, '#ffffff', 0.98);
      for (let i = 0; i < 14; i++) {
        const a = game.realTime * 0.3 + i * TAU / 14;
        ctx.globalAlpha = reveal * (0.14 + (i % 3) * 0.08);
        ctx.fillStyle = color;
        this.diamond(ctx, 300 + Math.cos(a) * (150 + i * 3), 224 + Math.sin(a) * (82 + i), 2, 3, color);
      }
      ctx.globalAlpha = reveal;
      Font.cn(ctx, '棱镜觉醒', 300, 386, 12, U.rgba(color, 0.9), { align: 'center', weight: 700, letterSpacing: '4px' });
      Font.cn(ctx, 'PRISM AWAKENED', 300, 401, 8, 'rgba(170,190,220,.5)', { align: 'center', weight: 500, font: Font.mono, letterSpacing: '1px' });
      // 右：文本
      const x = 492, y = 72, w = 408, h = 396;
      this.panel(ctx, x, y, w, h, { fill: 'rgba(8,13,27,.92)', border: U.rgba(color, 0.4), accent: color, notch: 9 });
      Font.cn(ctx, nameZh, x + 28, y + 40, 30, COL.white, { weight: 800 });
      Font.pixel(ctx, nameEn, x + 28, y + 61, { scale: 3, color });
      this.keycap(ctx, 'NEW', x + w - 68, y + 24, { color, border: U.rgba(color, 0.5), padX: 7 });
      this.divider(ctx, x + 28, y + 82, w - 56, U.rgba(color, 0.28));
      let descZh, descEn, verseZh, verseEn, skillZh, skillEn;
      if (d.isEcho) {
        descZh = '点按 F 录制 4 秒行动；再次按 F 可提前释放。金色分身会复刻你的路径与元素技能，能替你踩住机关，也能成为你踩踏的垫脚石。';
        descEn = 'TAP F TO RECORD 4s; TAP AGAIN TO RELEASE. THE GOLDEN ECHO REPLAYS YOUR PATH AND SKILLS — IT CAN HOLD SWITCHES, AND YOU CAN STOMP ITS HEAD.';
        verseZh = '过去的你，也会替现在的你垫一脚。';
        verseEn = 'YOUR PAST SELF WILL LEND YOUR PRESENT SELF A STEP.';
        skillZh = '回响分身'; skillEn = 'ECHO CLONE';
      } else if (d.isChrono) {
        descZh = '按住 L 或 V 让世界慢下来。子弹时间里，踩踏或冲刺可以弹反能量弹；音乐与时间都会为你屏住呼吸。';
        descEn = 'HOLD L / V TO SLOW THE WORLD. IN BULLET TIME, STOMP OR DASH TO DEFLECT ENERGY ORBS.';
        verseZh = '当世界慢下来，危险也能成为武器。';
        verseEn = 'WHEN THE WORLD SLOWS, DANGER BECOMES A WEAPON.';
        skillZh = '子弹时间'; skillEn = 'BULLET TIME';
      } else {
        descZh = form.descZh;
        descEn = form.descEn;
        verseZh = form.verse;
        verseEn = form.verseEn;
        skillZh = form.skillZh; skillEn = form.skillEn;
      }
      const body = Font.wrap(ctx, descZh, w - 56, 13, 500);
      body.slice(0, 6).forEach((line, i) => Font.cn(ctx, line, x + 28, y + 110 + i * 19, 13, COL.text, { weight: 500 }));
      const bodyEn = Font.wrap(ctx, descEn, w - 56, 9, 500, Font.mono);
      const enY = y + 110 + Math.min(body.length, 6) * 19 + 10;
      bodyEn.slice(0, 3).forEach((line, i) => Font.cn(ctx, line, x + 28, enY + i * 12, 9, 'rgba(150,170,205,.55)', { weight: 500, font: Font.mono }));
      // 条件/机制速览
      const bullets = d.isEcho
        ? ['点按 F 开始录制；再次按 F 提前释放', '金色分身复刻路径与元素技能', '可压住机关，可踩头弹跳']
        : d.isChrono
          ? ['按住 L / V 减速世界与音乐', '子弹时间中踩踏 / 冲刺弹反能量弹', '时停能量会自动回复']
          : d.formId === 'solar'
            ? ['点燃藤蔓 · 引爆联动炸药桶', '铜线通电 · 激光门断电', '火球入水 → 蒸汽升流柱']
            : d.formId === 'cryo'
              ? ['水面 → 霜晶桥 · 熔岩 → 黑曜石', '驯服火焰灯笼灵 · 冰封敌人', '↓+J 召唤临时冰块']
              : d.formId === 'grav'
                ? ['J 翻转自身重力 · 倒悬行走', '↓+J 重力脉冲翻转敌人与物体', '切换形态后仍保留倒悬状态']
                : ['J 抛出星棱；再按 J 瞬移', '星棱钉住目标 → 量子换位', '假墙在星隙形态下泛起翡翠微光'];
      bullets.forEach((line, i) => {
        const by = y + 262 + i * 13;
        ctx.fillStyle = U.rgba(color, 0.75);
        this.diamond(ctx, x + 32, by, 2, 3, color);
        Font.cn(ctx, line, x + 44, by, 10, 'rgba(210,225,245,.72)', { weight: 500 });
      });
      // Verse
      const vy = y + h - 86;
      Font.cn(ctx, `“${verseZh}”`, x + 28, vy, 12, U.rgba(color, 0.95), { weight: 600 });
      Font.cn(ctx, verseEn, x + 28, vy + 16, 8, 'rgba(150,170,205,.5)', { weight: 500, font: Font.mono });
      // Skill key
      const ky = y + h - 42;
      this.keycap(ctx, d.isEcho ? 'F' : d.isChrono ? 'L/V' : 'J', x + 28, ky - 7, { color, border: U.rgba(color, 0.5), padX: 7 });
      Font.cn(ctx, skillZh, x + 88, ky, 12, COL.text, { weight: 600 });
      Font.cn(ctx, skillEn, x + 88, ky + 12, 8, COL.dim, { weight: 500, font: Font.mono });
      // 底部提示
      Font.cn(ctx, 'ENTER / J 继续', 480, 510, 10, 'rgba(200,220,245,.55)', { align: 'center', weight: 500 });
      ctx.restore();
    },

    // ---------------------------------------------------------------- confirm / chapter select
    drawConfirmNew(game, ctx) {
      this.dim(ctx, 0.5);
      const x = 270, y = 180, w = 420, h = 190;
      this.panel(ctx, x, y, w, h, { fill: 'rgba(9,14,28,.97)', border: 'rgba(232,90,99,.45)', accent: COL.red });
      Font.cn(ctx, '开始新的旅程？', x + w / 2, y + 42, 22, COL.white, { align: 'center', weight: 800 });
      Font.pixel(ctx, 'START A NEW JOURNEY?', x + w / 2, y + 60, { scale: 1, color: COL.red, align: 'center' });
      Font.cn(ctx, '这会清除已有的形态、连携与章节进度。', x + w / 2, y + 94, 12, COL.muted, { align: 'center', weight: 500 });
      Font.pixel(ctx, 'ALL FORMS, CHAINS AND CHAPTER PROGRESS WILL BE ERASED.', x + w / 2, y + 110, { scale: 1, color: 'rgba(150,170,205,.45)', align: 'center' });
      const yes = game.ui.confirmIndex === 0;
      const drawBtn = (labelZh, labelEn, cx, selected, color) => {
        this.panel(ctx, cx - 80, y + 132, 160, 34, {
          fill: selected ? U.rgba(color, 0.16) : 'rgba(8,13,27,.7)',
          border: selected ? color : 'rgba(110,160,200,.2)', notch: 5,
        });
        Font.cn(ctx, labelZh, cx, y + 145, 12, selected ? color : COL.muted, { align: 'center', weight: 600 });
        Font.pixel(ctx, labelEn, cx, y + 155, { scale: 1, color: selected ? U.rgba(color, 0.6) : COL.dim, align: 'center' });
      };
      drawBtn('清除并开始', 'ERASE & BEGIN', x + w / 2 - 90, yes, COL.red);
      drawBtn('返回', 'BACK', x + w / 2 + 90, !yes, COL.cyan);
      this.addHit(x + w / 2 - 90 - 80, y + 132, 160, 34, 0, 'confirm');
      this.addHit(x + w / 2 + 90 - 80, y + 132, 160, 34, 1, 'confirm');
      ctx.restore();
    },

    drawChapters(game, ctx) {
      this.dim(ctx, 0.45);
      const x = 230, y = 96, w = 500, h = 352;
      this.panel(ctx, x, y, w, h, { fill: 'rgba(9,14,28,.96)', border: 'rgba(126,240,224,.3)', accent: COL.cyan });
      Font.cn(ctx, '章节选择', x + 28, y + 36, 22, COL.white, { weight: 800 });
      Font.pixel(ctx, 'CHAPTER SELECT', x + 28, y + 50, { scale: 1, color: COL.cyan });
      Font.cn(ctx, '已解锁的章节；未抵达的章节仍在等待。', x + w - 28, y + 40, 10, COL.dim, { align: 'right', weight: 500 });
      this.divider(ctx, x + 24, y + 64, w - 48, COL.lineSoft);
      const unlocked = PB.Save.data.chapter + 1;
      PB.Levels.CHAPTERS.forEach((ch, i) => {
        const yy = y + 82 + i * 58;
        const sel = i === game.ui.chapterIndex;
        this.addHit(x + 20, yy - 4, w - 40, 48, i, 'chapters');
        const locked = i >= unlocked;
        if (sel) {
          ctx.fillStyle = 'rgba(126,240,224,.1)';
          ctx.fillRect(x + 20, yy - 4, w - 40, 48);
          ctx.fillStyle = COL.cyan;
          ctx.fillRect(x + 22, yy, 2, 40);
        }
        ctx.globalAlpha = locked ? 0.3 : 1;
        Font.pixel(ctx, `0${ch.num}`, x + 38, yy + 5, { scale: 2, color: locked ? COL.dim : COL.gold });
        Font.cn(ctx, ch.nameZh, x + 90, yy + 13, 16, sel ? COL.cyan : COL.text, { weight: sel ? 700 : 500 });
        Font.pixel(ctx, ch.nameEn, x + 90, yy + 25, { scale: 1, color: locked ? COL.dim : COL.muted });
        if (locked) {
          Font.pixel(ctx, 'SEALED', x + w - 34, yy + 15, { scale: 1, color: COL.dim, align: 'right' });
        } else {
          const best = PB.Save.data.bestTime[ch.id];
          Font.pixel(ctx, best ? `BEST ${U.formatTime(best)}` : 'NOT CLEARED', x + w - 34, yy + 15, { scale: 1, color: best ? COL.green : COL.dim, align: 'right' });
        }
        ctx.globalAlpha = 1;
      });
      Font.cn(ctx, '↑↓ / 点击 选择 · Enter 出发 · Esc 返回', x + w / 2, y + h - 20, 10, COL.dim, { align: 'center', weight: 500 });
    },

    // ---------------------------------------------------------------- ending
    drawEnding(game, ctx) {
      const t = game.endingT || 0;
      const st = game.endingStats || {};
      ctx.save();
      const g = ctx.createLinearGradient(0, 0, 0, C.UI_H);
      g.addColorStop(0, 'rgba(4,7,16,.96)');
      g.addColorStop(0.6, 'rgba(7,10,22,.97)');
      g.addColorStop(1, 'rgba(9,12,26,.99)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, C.UI_W, C.UI_H);
      // 极光带
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        ctx.globalAlpha = 0.05 + i * 0.012;
        ctx.fillStyle = [COL.gold, COL.cyan, COL.violet, COL.pink, COL.white][i];
        ctx.beginPath();
        ctx.moveTo(0, 140 + i * 24);
        for (let x = 0; x <= C.UI_W; x += 30) {
          ctx.lineTo(x, 140 + i * 24 + Math.sin(x * 0.012 + t * 0.5 + i) * 20);
        }
        ctx.lineTo(C.UI_W, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      // 大棱镜
      this.drawPrism(ctx, 480, 154, 54, t * 0.6, 0.9);
      // 标题
      ctx.globalAlpha = U.clamp((t - 0.4) / 1.2, 0, 1);
      Font.cn(ctx, st.trueEnd ? '万象共鸣' : '黎明重铸', 480, 246, 32, COL.white, { align: 'center', weight: 800 });
      Font.pixel(ctx, st.trueEnd ? 'PRISM RESONANCE' : 'DAWN REFORGED', 480, 270, { scale: 2, color: st.trueEnd ? COL.gold : COL.cyan, align: 'center' });
      ctx.globalAlpha = U.clamp((t - 1.0) / 1.2, 0, 1);
      const lines = st.trueEnd
        ? ['四色归一，万象发出同一个音。', '棱镜记住了你的每一次连携与每一次跌倒。', 'THE FOUR HUES BECOME ONE; ALL THINGS RESOUND AS A SINGLE NOTE.']
        : ['大棱镜重新亮起，四种颜色回到大地。', '露米把空灯挂回门前，天亮了。', 'THE GRAND PRISM SHINES AGAIN; FOUR COLORS RETURN TO THE WORLD.'];
      lines.forEach((line, i) => {
        if (i < 2) Font.cn(ctx, line, 480, 306 + i * 22, 13, i === 0 ? COL.text : COL.muted, { align: 'center', weight: 500 });
        else Font.pixel(ctx, line, 480, 352, { scale: 1, color: 'rgba(150,170,205,.45)', align: 'center' });
      });
      // 统计
      ctx.globalAlpha = U.clamp((t - 1.8) / 1.2, 0, 1);
      const stats = [
        ['旅程时长', 'TIME', U.formatTime(st.time || 0)],
        ['棱晶', 'SHARDS', String(st.shards || 0)],
        ['连携', 'CHAINS', `${st.chains || 0}/16`],
        ['大棱晶', 'GRAND', `${st.grand || 0}/12`],
        ['跌倒', 'FALLS', String(st.deaths || 0)],
      ];
      stats.forEach((s, i) => {
        const x = 190 + i * 120;
        Font.cn(ctx, s[0], x, 394, 9, COL.muted, { align: 'center', weight: 500 });
        Font.pixel(ctx, s[2], x, 408, { scale: 2, color: COL.gold, align: 'center' });
        Font.pixel(ctx, s[1], x, 424, { scale: 1, color: 'rgba(150,170,205,.35)', align: 'center' });
      });
      // credits
      ctx.globalAlpha = U.clamp((t - 2.8) / 1.5, 0, 1);
      this.divider(ctx, 280, 444, 400, COL.lineSoft);
      Font.cn(ctx, '原创概念 / 系统 / 像素美术 / 关卡 / 音乐与音效合成', 480, 462, 9, 'rgba(190,205,230,.5)', { align: 'center', weight: 500 });
      Font.pixel(ctx, 'WRITTEN ENTIRELY IN CODE · CREATED WITH CLAUDE CODE', 480, 475, { scale: 1, color: 'rgba(150,170,205,.35)', align: 'center' });
      Font.cn(ctx, st.trueEnd ? 'TRUE FINALE UNLOCKED · 16/16' : '回到标题，继续寻找尚未点亮的连携。', 480, 500, 9, st.trueEnd ? COL.gold : COL.dim, { align: 'center', weight: 500 });
      if (t > 2.2) {
        ctx.globalAlpha = 0.5 + U.animate(t, 0.8) * 0.4;
        Font.cn(ctx, 'ENTER 返回标题', 480, 520, 10, COL.gold, { align: 'center', weight: 500 });
      }
      ctx.restore();
    },
  };

  PB.UI = UI;
})();
