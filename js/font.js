/* ============================================================
   font.js — 内置 5×7 像素字形 + 清晰中文排版
   英文/数字使用手工像素字，中文使用系统字体在 960×540
   高清 UI 层绘制，形成双语并置的视觉语言。
   ============================================================ */
(function () {
  'use strict';
  const PB = window.PB;

  const G = {};
  function def(ch, rows) { G[ch] = rows.split('/'); }

  def('A', '01110/10001/10001/11111/10001/10001/10001');
  def('B', '11110/10001/10001/11110/10001/10001/11110');
  def('C', '01111/10000/10000/10000/10000/10000/01111');
  def('D', '11110/10001/10001/10001/10001/10001/11110');
  def('E', '11111/10000/10000/11110/10000/10000/11111');
  def('F', '11111/10000/10000/11110/10000/10000/10000');
  def('G', '01111/10000/10000/10111/10001/10001/01111');
  def('H', '10001/10001/10001/11111/10001/10001/10001');
  def('I', '11111/00100/00100/00100/00100/00100/11111');
  def('J', '00111/00010/00010/00010/10010/10010/01100');
  def('K', '10001/10010/10100/11000/10100/10010/10001');
  def('L', '10000/10000/10000/10000/10000/10000/11111');
  def('M', '10001/11011/10101/10101/10001/10001/10001');
  def('N', '10001/11001/10101/10011/10001/10001/10001');
  def('O', '01110/10001/10001/10001/10001/10001/01110');
  def('P', '11110/10001/10001/11110/10000/10000/10000');
  def('Q', '01110/10001/10001/10001/10101/10010/01101');
  def('R', '11110/10001/10001/11110/10100/10010/10001');
  def('S', '01111/10000/10000/01110/00001/00001/11110');
  def('T', '11111/00100/00100/00100/00100/00100/00100');
  def('U', '10001/10001/10001/10001/10001/10001/01110');
  def('V', '10001/10001/10001/10001/10001/01010/00100');
  def('W', '10001/10001/10001/10101/10101/11011/10001');
  def('X', '10001/10001/01010/00100/01010/10001/10001');
  def('Y', '10001/10001/01010/00100/00100/00100/00100');
  def('Z', '11111/00001/00010/00100/01000/10000/11111');
  def('0', '01110/10001/10011/10101/11001/10001/01110');
  def('1', '00100/01100/00100/00100/00100/00100/01110');
  def('2', '01110/10001/00001/00010/00100/01000/11111');
  def('3', '11110/00001/00001/01110/00001/00001/11110');
  def('4', '00010/00110/01010/10010/11111/00010/00010');
  def('5', '11111/10000/11110/00001/00001/10001/01110');
  def('6', '00110/01000/10000/11110/10001/10001/01110');
  def('7', '11111/00001/00010/00100/01000/01000/01000');
  def('8', '01110/10001/10001/01110/10001/10001/01110');
  def('9', '01110/10001/10001/01111/00001/00010/01100');
  def(' ', '00000/00000/00000/00000/00000/00000/00000');
  def('.', '00000/00000/00000/00000/00000/00000/00100');
  def(',', '00000/00000/00000/00000/00000/00100/01000');
  def(':', '00000/00100/00100/00000/00100/00100/00000');
  def(';', '00000/00100/00100/00000/00100/01000/00000');
  def('!', '00100/00100/00100/00100/00100/00000/00100');
  def('?', '01110/10001/00001/00010/00100/00000/00100');
  def("'", '00100/00100/00000/00000/00000/00000/00000');
  def('"', '01010/01010/00000/00000/00000/00000/00000');
  def('-', '00000/00000/00000/11111/00000/00000/00000');
  def('+', '00000/00100/00100/11111/00100/00100/00000');
  def('/', '00001/00010/00010/00100/01000/01000/10000');
  def('\\', '10000/01000/01000/00100/00010/00010/00001');
  def('(', '00010/00100/01000/01000/01000/00100/00010');
  def(')', '01000/00100/00010/00010/00010/00100/01000');
  def('[', '01110/01000/01000/01000/01000/01000/01110');
  def(']', '01110/00010/00010/00010/00010/00010/01110');
  def('<', '00010/00100/01000/10000/01000/00100/00010');
  def('>', '01000/00100/00010/00001/00010/00100/01000');
  def('×', '00000/10001/01010/00100/01010/10001/00000');
  def('·', '00000/00000/00000/00100/00000/00000/00000');
  def('%', '11001/11010/00010/00100/01000/01011/10011');
  def('&', '01100/10010/10100/01000/10101/10010/01101');
  def('#', '01010/01010/11111/01010/11111/01010/01010');
  def('*', '00000/10101/01110/11111/01110/10101/00000');
  def('=', '00000/00000/11111/00000/11111/00000/00000');
  def('_', '00000/00000/00000/00000/00000/00000/11111');
  def('|', '00100/00100/00100/00100/00100/00100/00100');
  def('→', '00000/00100/00010/11111/00010/00100/00000');
  def('←', '00000/00100/01000/11111/01000/00100/00000');
  def('↑', '00100/01110/10101/00100/00100/00100/00000');
  def('↓', '00100/00100/00100/10101/01110/00100/00000');
  def('♥', '00000/01010/11111/11111/01110/00100/00000');
  def('◆', '00100/01110/11111/11111/11111/01110/00100');
  def('·', '00000/00000/00000/00100/00000/00000/00000');
  def('•', '00000/00000/00100/01110/00100/00000/00000');
  def('^', '00100/01010/10001/00000/00000/00000/00000');
  def('~', '00000/00000/01001/10110/00000/00000/00000');

  const Font = {
    glyphs: G,
    cnStack: '"Microsoft YaHei UI","PingFang SC","Noto Sans SC","Source Han Sans SC","Hiragino Sans GB",sans-serif',
    mono: '"Cascadia Mono","Consolas","SFMono-Regular",monospace',

    width(text, scale = 1, spacing = 1) {
      const len = String(text).length;
      return len ? len * 5 * scale + (len - 1) * spacing * scale : 0;
    },

    pixel(ctx, text, x, y, opt = {}) {
      const scale = Math.max(1, Math.floor(opt.scale || 1));
      const spacing = opt.spacing == null ? 1 : opt.spacing;
      const color = opt.color || '#e8f0ff';
      const shadow = opt.shadow || null;
      const alpha = opt.alpha == null ? 1 : opt.alpha;
      const textStr = String(text).toUpperCase();
      const total = this.width(textStr, scale, spacing);
      let bx = Math.round(x);
      if (opt.align === 'center') bx -= Math.round(total / 2);
      else if (opt.align === 'right') bx -= total;
      const by = Math.round(y);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = alpha;
      let cursor = bx;
      for (let i = 0; i < textStr.length; i++) {
        const ch = textStr[i];
        const glyph = G[ch] || G['?'];
        for (let row = 0; row < 7; row++) {
          const bits = glyph[row];
          for (let col = 0; col < 5; col++) {
            if (bits[col] !== '1') continue;
            if (shadow) {
              ctx.fillStyle = shadow;
              ctx.fillRect(cursor + col * scale + scale, by + row * scale + scale, scale, scale);
            }
            ctx.fillStyle = color;
            ctx.fillRect(cursor + col * scale, by + row * scale, scale, scale);
          }
        }
        cursor += (5 + spacing) * scale;
      }
      ctx.restore();
      return total;
    },

    pixelHeight(scale = 1) { return 7 * scale; },

    // 中文（清晰矢量字形），y 为文字垂直中心
    cn(ctx, text, x, y, size = 14, color = '#e8f0ff', opt = {}) {
      ctx.save();
      ctx.font = `${opt.weight || 600} ${size}px ${opt.font || this.cnStack}`;
      ctx.fillStyle = color;
      ctx.textAlign = opt.align || 'left';
      ctx.textBaseline = opt.baseline || 'middle';
      ctx.globalAlpha = opt.alpha == null ? 1 : opt.alpha;
      if (opt.shadow) {
        ctx.shadowColor = opt.shadow;
        ctx.shadowOffsetY = Math.max(1, Math.round(size / 16));
        ctx.shadowBlur = 0;
      }
      if (opt.letterSpacing && 'letterSpacing' in ctx) ctx.letterSpacing = opt.letterSpacing + 'px';
      ctx.fillText(text, Math.round(x), Math.round(y));
      ctx.restore();
      return ctx.measureText ? 0 : 0;
    },

    // 中文宽度测量
    measureCn(ctx, text, size = 14, weight = 600, font) {
      ctx.save();
      ctx.font = `${weight} ${size}px ${font || this.cnStack}`;
      const w = ctx.measureText(text).width;
      ctx.restore();
      return w;
    },

    // 双语小标签：中文 + 小号像素英文
    label(ctx, zh, en, x, y, opt = {}) {
      const align = opt.align || 'left';
      const color = opt.color || '#e8f0ff';
      const sub = opt.subColor || 'rgba(180,200,235,.62)';
      const size = opt.size || 15;
      const gap = opt.gap == null ? 5 : opt.gap;
      const py = opt.pixelScale || 1;
      this.cn(ctx, zh, x, y, size, color, { align, weight: opt.weight || 700 });
      if (en) {
        this.pixel(ctx, en, x, y + size * 0.62 + gap, {
          scale: py, color: sub, align, spacing: 1,
        });
      }
    },

    wrap(ctx, text, maxWidth, size = 14, weight = 500, font) {
      ctx.save();
      ctx.font = `${weight} ${size}px ${font || this.cnStack}`;
      const tokens = [];
      const re = /[一-鿿　-〿＀-￯]|[^\s一-鿿]+|\s+/g;
      let m;
      while ((m = re.exec(text))) tokens.push(m[0]);
      const lines = [];
      let line = '';
      for (const tok of tokens) {
        const test = line + tok;
        if (ctx.measureText(test).width > maxWidth && line.trim()) {
          lines.push(line.trimEnd());
          line = tok.trimStart();
        } else {
          line = test;
        }
      }
      if (line.trim()) lines.push(line.trimEnd());
      ctx.restore();
      return lines;
    },

    paragraph(ctx, text, x, y, maxWidth, lineHeight, size, color, opt = {}) {
      const lines = this.wrap(ctx, text, maxWidth, size, opt.weight || 500, opt.font);
      const align = opt.align || 'left';
      lines.forEach((line, i) => {
        this.cn(ctx, line, x, y + i * lineHeight, size, color, {
          align, weight: opt.weight || 500, alpha: opt.alpha, font: opt.font,
        });
      });
      return lines.length;
    },

    keycap(ctx, label, x, y, opt = {}) {
      const scale = opt.scale || 1;
      const padX = opt.padX || 5;
      const h = 7 * scale + (opt.padY || 4) * 2;
      const w = this.width(label, scale, 1) + padX * 2;
      const r = opt.radius == null ? 3 : opt.radius;
      ctx.save();
      ctx.fillStyle = opt.bg || 'rgba(18,26,51,.92)';
      this.roundRect(ctx, x, y, w, h, r);
      ctx.fill();
      ctx.strokeStyle = opt.border || 'rgba(126,240,224,.42)';
      ctx.lineWidth = opt.lineWidth || 1;
      this.roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
      ctx.stroke();
      this.pixel(ctx, label, x + w / 2, y + (h - 7 * scale) / 2, {
        color: opt.color || '#dff8ff', scale, align: 'center',
      });
      ctx.restore();
      return w;
    },

    roundRect(ctx, x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    },
  };

  PB.Font = Font;
})();
