/* ============================================================
   input.js — 键盘 / 手柄输入，带 0.14s 边缘缓冲
   极速点按也能被固定 60Hz 物理步捕获。
   ============================================================ */
(function () {
  'use strict';
  const PB = window.PB;
  const { U } = PB;

  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    Space: 'jump', KeyZ: 'jump', KeyK: 'jump',
    ShiftLeft: 'dash', ShiftRight: 'dash', KeyX: 'dash',
    KeyJ: 'skill', KeyE: 'skill',
    KeyF: 'echo',
    KeyL: 'slow', KeyV: 'slow',
    Tab: 'codex',
    Escape: 'pause', KeyP: 'pause',
    KeyM: 'mute',
    Enter: 'confirm', NumpadEnter: 'confirm',
    Digit1: 'form1', Numpad1: 'form1',
    Digit2: 'form2', Numpad2: 'form2',
    Digit3: 'form3', Numpad3: 'form3',
    Digit4: 'form4', Numpad4: 'form4',
    KeyQ: 'cycle',
    Backspace: 'back',
    KeyR: 'restart',
  };

  const Input = {
    down: Object.create(null),
    buffers: Object.create(null),
    bufferTime: 0.14,
    anyBuffer: 0,
    lastAction: null,
    gamepad: null,
    padPrev: [],
    padDown: Object.create(null),
    aim: { x: 0, y: 0 },
    pointer: { x: 0, y: 0, down: false, clicked: false },
    initialized: false,
    usingPad: false,
    _pendingBuffers: Object.create(null),

    init() {
      if (this.initialized) return;
      this.initialized = true;

      window.addEventListener('keydown', (e) => {
        const action = KEYMAP[e.code];
        if (action) {
          // 阻止页面滚动、Tab 切焦点、空格滚屏等
          e.preventDefault();
          if (PB.Audio) PB.Audio.unlock();
          if (!e.repeat) this._press(action);
          this.down[action] = true;
          this.usingPad = false;
        } else if (e.code === 'F5' || e.code === 'F12') {
          // 允许刷新与开发者工具
        }
      }, { passive: false });

      window.addEventListener('keyup', (e) => {
        const action = KEYMAP[e.code];
        if (action) {
          e.preventDefault();
          this.down[action] = false;
        }
      }, { passive: false });

      window.addEventListener('blur', () => this.reset());
      window.addEventListener('gamepadconnected', (e) => {
        console.info('[input] gamepad connected:', e.gamepad.id);
        this.gamepad = e.gamepad.index;
      });
      window.addEventListener('gamepaddisconnected', () => {
        this.gamepad = null;
        this.padPrev = [];
        this.padDown = Object.create(null);
      });

      const canvas = U.byId('game');
      if (canvas) {
        canvas.addEventListener('pointerdown', (e) => {
          canvas.focus();
          if (PB.Audio) PB.Audio.unlock();
          this.pointer.down = true;
          this.pointer.clicked = true;
          const r = canvas.getBoundingClientRect();
          this.pointer.x = ((e.clientX - r.left) / r.width) * PB.C.UI_W;
          this.pointer.y = ((e.clientY - r.top) / r.height) * PB.C.UI_H;
        });
        window.addEventListener('pointerup', () => { this.pointer.down = false; });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      }
      this.reset();
    },

    _press(action) {
      this.buffers[action] = this.bufferTime;
      this.anyBuffer = this.bufferTime;
      this.lastAction = action;
      PB.Events.emit('input:press', action);
    },

    reset() {
      this.down = Object.create(null);
      this.buffers = Object.create(null);
      this.padDown = Object.create(null);
      this.padPrev = [];
      this.anyBuffer = 0;
    },

    update(dt) {
      // 手柄轮询
      this._pollGamepad();
      // 缓冲计时衰减
      for (const k in this.buffers) {
        this.buffers[k] -= dt;
        if (this.buffers[k] <= 0) delete this.buffers[k];
      }
      if (this.anyBuffer > 0) this.anyBuffer -= dt;
      this.pointer.clicked = false;
    },

    endFrame() {
      // 边缘缓冲由计时器控制；这里只清掉一次性点击
      this.pointer.clicked = false;
    },

    isDown(action) {
      return !!(this.down[action] || this.padDown[action]);
    },
    pressed(action) {
      return (this.buffers[action] || 0) > 0;
    },
    consume(action) {
      if ((this.buffers[action] || 0) > 0) {
        this.buffers[action] = 0;
        return true;
      }
      return false;
    },
    consumeAny() {
      if (this.anyBuffer > 0) {
        this.anyBuffer = 0;
        this.buffers = Object.create(null);
        return true;
      }
      return false;
    },
    anyPressed() { return this.anyBuffer > 0 || this.pointer.clicked; },

    axisX() {
      if (this.isDown('left') && !this.isDown('right')) return -1;
      if (this.isDown('right') && !this.isDown('left')) return 1;
      return 0;
    },
    axisY() {
      if (this.isDown('up') && !this.isDown('down')) return -1;
      if (this.isDown('down') && !this.isDown('up')) return 1;
      return 0;
    },
    aimVector(fallbackX = 1) {
      let x = this.axisX();
      let y = this.axisY();
      // 手柄右摇杆优先做精确瞄准
      if (Math.hypot(this.aim.x, this.aim.y) > 0.38) {
        return { x: this.aim.x, y: this.aim.y };
      }
      if (x === 0 && y === 0) return { x: fallbackX, y: 0 };
      return { x, y };
    },

    _pollGamepad() {
      if (this.gamepad == null || !navigator.getGamepads) return;
      const pads = navigator.getGamepads();
      const gp = pads && pads[this.gamepad];
      if (!gp) return;
      const b = gp.buttons;
      const btn = (i) => !!(b[i] && (b[i].pressed || b[i].value > 0.45));
      const prev = this.padPrev;

      const map = {
        0: 'jump',
        1: 'echo',
        2: 'dash',
        3: 'skill',
        4: 'cycle',
        5: 'slow',
        6: 'slow',
        7: 'dash',
        9: 'pause',
        8: 'codex',
        12: 'up',
        13: 'down',
        14: 'left',
        15: 'right',
      };
      const nowDown = Object.create(null);
      for (const idx in map) {
        const action = map[idx];
        const is = btn(+idx);
        if (is) nowDown[action] = true;
        if (is && !prev[idx]) this._press(action);
      }
      const ax = gp.axes[0] || 0;
      const ay = gp.axes[1] || 0;
      const rx = gp.axes[2] || 0;
      const ry = gp.axes[3] || 0;
      if (Math.abs(ax) > 0.35) nowDown[ax < 0 ? 'left' : 'right'] = true;
      if (Math.abs(ay) > 0.45) nowDown[ay < 0 ? 'up' : 'down'] = true;
      this.aim.x = Math.abs(rx) > 0.3 ? rx : 0;
      this.aim.y = Math.abs(ry) > 0.3 ? ry : 0;
      if (Object.keys(nowDown).some((k) => k !== 'slow')) this.usingPad = true;

      this.padDown = nowDown;
      this.padPrev = [];
      for (const idx in map) this.padPrev[idx] = btn(+idx);
      // trigger 用于子弹时间
      if (b[6] && b[6].value > 0.25) this.padDown.slow = true;
      if (b[7] && b[7].value > 0.25) this.padDown.dash = true;
    },

    get connected() { return this.gamepad != null; },
  };

  PB.Input = Input;
})();
