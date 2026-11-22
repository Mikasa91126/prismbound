/* ============================================================
   audio.js — 纯 Web Audio 芯片合成器
   · 多轨步进音序器（可变速、可动态增减声部）
   · 脉冲波 / 三角波 / FM 钟琴 / 噪声鼓组
   · 程序化混响、延迟、压缩与子弹时间低通
   · 数十种程序化音效，零采样文件
   ============================================================ */
(function () {
  'use strict';
  const PB = window.PB;
  const { U } = PB;

  const musicCache = new Map();
  let noiseBuffer = null;

  const Audio = {
    ctx: null,
    unlocked: false,
    failed: false,
    master: null,
    comp: null,
    musicBus: null,
    musicFilter: null,
    musicGain: null,
    sfxBus: null,
    reverb: null,
    reverbGain: null,
    delay: null,
    delaySend: null,
    pulseWaves: {},
    muted: false,
    intensity: 0.65,
    timeScale: 1,
    desiredSong: null,
    currentSong: null,
    seq: null,
    stepDur: 0,
    nextStepTime: 0,
    absStep: 0,
    barCount: 0,
    _songToken: 0,
    _ducked: false,
    _vehicle: null,
    _vehicleNodes: null,
    volumes: { music: 0.72, sfx: 0.82 },

    // ------------------------------------------------------------ setup
    unlock() {
      if (this.unlocked) {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      if (this.failed) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) throw new Error('Web Audio API unavailable');
        this.ctx = new AC({ latencyHint: 'interactive' });
        this._buildGraph();
        this.unlocked = true;
        this.setVolumes(this.volumes.music, this.volumes.sfx);
        if (this.desiredSong) this._startSong(this.desiredSong);
      } catch (err) {
        this.failed = true;
        console.warn('[audio] unavailable:', err);
      }
    },

    _buildGraph() {
      const ctx = this.ctx;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.setValueAtTime(-16, ctx.currentTime);
      this.comp.knee.setValueAtTime(18, ctx.currentTime);
      this.comp.ratio.setValueAtTime(4.5, ctx.currentTime);
      this.comp.attack.setValueAtTime(0.004, ctx.currentTime);
      this.comp.release.setValueAtTime(0.22, ctx.currentTime);
      this.comp.connect(ctx.destination);

      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.comp);

      this.musicBus = ctx.createGain();
      this.musicFilter = ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 19000;
      this.musicFilter.Q.value = 0.4;
      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = this.volumes.music;
      this.musicBus.connect(this.musicFilter);
      this.musicFilter.connect(this.musicGain);
      this.musicGain.connect(this.master);

      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = this.volumes.sfx;
      this.sfxBus.connect(this.master);

      // 程序化混响
      const revLen = Math.floor(ctx.sampleRate * 1.55);
      const impulse = ctx.createBuffer(2, revLen, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < revLen; i++) {
          const t = i / revLen;
          const decay = Math.pow(1 - t, 2.8);
          const early = i < ctx.sampleRate * 0.08 ? 0.4 : 0;
          data[i] = (Math.random() * 2 - 1) * decay * (0.85 + early);
        }
      }
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = impulse;
      this.reverbGain = ctx.createGain();
      this.reverbGain.gain.value = 0.2;
      this.reverb.connect(this.reverbGain);
      this.reverbGain.connect(this.musicFilter);

      // 附点延迟
      this.delay = ctx.createDelay(1.2);
      this.delay.delayTime.value = 0.265;
      const fb = ctx.createGain();
      fb.gain.value = 0.23;
      const damp = ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = 2600;
      this.delay.connect(damp);
      damp.connect(fb);
      fb.connect(this.delay);
      this.delaySend = ctx.createGain();
      this.delaySend.gain.value = 1;
      this.delaySend.connect(this.delay);
      this.delay.connect(this.musicFilter);

      // 噪声缓冲
      const len = Math.floor(ctx.sampleRate * 2);
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      // 脉冲波
      for (const duty of [0.125, 0.25, 0.5]) {
        const n = 40;
        const real = new Float32Array(n);
        const imag = new Float32Array(n);
        for (let k = 1; k < n; k++) {
          real[k] = 0;
          imag[k] = (2 / (k * Math.PI)) * Math.sin(Math.PI * k * duty);
        }
        this.pulseWaves[duty] = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
      }
    },

    setVolumes(music, sfx) {
      if (music != null) this.volumes.music = U.clamp(music, 0, 1);
      if (sfx != null) this.volumes.sfx = U.clamp(sfx, 0, 1);
      if (!this.ctx) return;
      if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.muted || this._ducked ? 0.0001 : this.volumes.music, this.ctx.currentTime, 0.05);
      if (this.sfxBus) this.sfxBus.gain.setTargetAtTime(this.muted ? 0.0001 : this.volumes.sfx, this.ctx.currentTime, 0.03);
    },

    setMuted(m) {
      this.muted = !!m;
      this.setVolumes();
    },

    setDucked(d) {
      this._ducked = !!d;
      this.setVolumes();
    },

    setIntensity(v) {
      this.intensity = U.clamp(v, 0, 1);
    },

    setTimeScale(v) {
      this.timeScale = U.clamp(v, 0.15, 1);
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const cutoff = 19000 * Math.pow(this.timeScale, 1.9) * (this._ducked ? 0.25 : 1);
      this.musicFilter.frequency.setTargetAtTime(Math.max(320, cutoff), now, 0.12);
      const wet = 0.2 + (1 - this.timeScale) * 0.15;
      this.reverbGain.gain.setTargetAtTime(wet, now, 0.2);
    },

    // ------------------------------------------------------------ music control
    playMusic(id, opts = {}) {
      if (!id) return;
      this.desiredSong = id;
      if (!this.unlocked) return; // 等待用户手势
      if (this.currentSong === id && this.seq && !opts.restart) return;
      const token = ++this._songToken;
      const fade = opts.fade == null ? 0.4 : opts.fade;
      if (this.seq) {
        this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.musicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, Math.max(0.02, fade / 3));
        this.seq = null;
      }
      const start = () => {
        if (token !== this._songToken) return;
        this._startSong(id);
        this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.musicGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        this.musicGain.gain.linearRampToValueAtTime(this.volumes.music, this.ctx.currentTime + fade);
      };
      if (this.ctx) setTimeout(start, Math.floor(fade * 500));
      else this._startSong(id);
    },

    stopMusic(fade = 0.4) {
      this.desiredSong = null;
      this._songToken++;
      this.seq = null;
      this.currentSong = null;
      if (this.ctx) {
        const t = this.ctx.currentTime;
        this.musicGain.gain.cancelScheduledValues(t);
        this.musicGain.gain.setTargetAtTime(0.0001, t, Math.max(0.02, fade / 3));
      }
    },

    _startSong(id) {
      const song = PB.SONGS && PB.SONGS[id];
      if (!song) {
        console.warn('[audio] unknown song', id);
        return;
      }
      this.currentSong = id;
      this.seq = this._prepareSong(song);
      this.absStep = 0;
      this.barCount = 0;
      this.baseStepDur = 60 / song.bpm / (song.stepsPerBeat || 4);
      this.nextStepTime = this.ctx.currentTime + 0.08;
      this.musicFilter.frequency.cancelScheduledValues(this.ctx.currentTime);
      this.musicFilter.frequency.setValueAtTime(19000, this.ctx.currentTime);
    },

    _prepareSong(song) {
      const tracks = (song.tracks || []).map((tr) => {
        return {
          ...tr,
          _patternCache: new Map(),
        };
      });
      return {
        song,
        tracks,
      };
    },

    _parsePattern(track, pattern) {
      if (track._patternCache.has(pattern)) return track._patternCache.get(pattern);
      const tokens = String(pattern).trim().split(/\s+/);
      const events = [];
      for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        if (tok === '.' || tok === '-' || tok === '') continue;
        // 计算延音长度
        let len = 1;
        for (let j = i + 1; j < tokens.length; j++) {
          if (tokens[j] === '-') len++;
          else break;
        }
        const notes = tok.split('/');
        events.push({ step: i, notes, len });
      }
      track._patternCache.set(pattern, events);
      return events;
    },

    update() {
      if (!this.unlocked || !this.ctx || !this.seq) return;
      const ctx = this.ctx;
      // 标签页休眠后重新同步
      if (this.nextStepTime < ctx.currentTime - 0.25) {
        this.nextStepTime = ctx.currentTime + 0.05;
      }
      const lookahead = 0.16;
      let guard = 0;
      while (this.nextStepTime < ctx.currentTime + lookahead && guard++ < 32) {
        this._scheduleStep(this.nextStepTime, this.absStep);
        const stepDur = this.baseStepDur / this.timeScale;
        this.nextStepTime += stepDur * (this.seq.song.swing ? 1 : 1);
        this.absStep++;
        if (this.absStep >= this.seq.song.bars * this.seq.song.stepsPerBar) {
          this.absStep = 0;
          this.barCount++;
        }
      }
    },

    _scheduleStep(when, absStep) {
      const seq = this.seq;
      const song = seq.song;
      const spb = song.stepsPerBar || 16;
      const step = absStep % spb;
      const bar = Math.floor(absStep / spb);
      const swing = song.swing || 0;
      const t = when + (step % 2 === 1 ? swing * this.baseStepDur / this.timeScale : 0);
      const stepDurBase = this.baseStepDur / this.timeScale;

      for (let ti = 0; ti < seq.tracks.length; ti++) {
        const tr = seq.tracks[ti];
        if (tr.minIntensity != null && this.intensity < tr.minIntensity) continue;
        if (tr.maxIntensity != null && this.intensity > tr.maxIntensity) continue;
        const patterns = tr.patterns || [];
        if (!patterns.length) continue;
        const order = tr.order || null;
        const pi = order ? order[bar % order.length] : bar % patterns.length;
        const pattern = patterns[pi % patterns.length];
        if (!pattern) continue;
        const events = this._parsePattern(tr, pattern);
        for (const ev of events) {
          if (ev.step !== step) continue;
          const human = (U.hash2(absStep, ti, 17) - 0.5) * 0.011;
          const stepDur = stepDurBase * (ev.len || 1);
          if (tr.instrument === 'drums') {
            for (const n of ev.notes) this._drum(n, t + human, tr, ti);
          } else {
            for (const n of ev.notes) {
              const freq = U.noteToFreq(n) * Math.pow(2, (tr.transpose || 0) / 12);
              if (!freq) continue;
              const gainMul = (tr.gain == null ? 0.13 : tr.gain) *
                (0.94 + U.hash2(absStep, ti, 91) * 0.12) *
                (ev.notes.length > 1 ? 0.64 : 1);
              this._musicNote(tr.instrument, freq, stepDur * (tr.gate || 0.92), t + human, gainMul, tr, ev.len || 1);
            }
          }
        }
      }
    },

    _musicNote(inst, freq, dur, when, gain, tr, steps) {
      const ctx = this.ctx;
      if (!ctx || when < ctx.currentTime - 0.05) return;
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) {
        panner.pan.value = tr.pan || 0;
        panner.connect(this.musicBus);
      }
      const dest = panner || this.musicBus;
      const g = ctx.createGain();
      g.connect(dest);
      const reverbSend = ctx.createGain();
      reverbSend.gain.value = tr.reverb == null ? 0.12 : tr.reverb;
      g.connect(reverbSend);
      reverbSend.connect(this.reverb);

      const o = [];
      const makeOsc = (type, detune, f) => {
        const osc = ctx.createOscillator();
        if (type === 'pulse12') osc.setPeriodicWave(this.pulseWaves[0.125]);
        else if (type === 'pulse25') osc.setPeriodicWave(this.pulseWaves[0.25]);
        else if (type === 'pulse50') osc.setPeriodicWave(this.pulseWaves[0.5]);
        else osc.type = type;
        osc.frequency.setValueAtTime(f, when);
        osc.detune.setValueAtTime(detune || 0, when);
        o.push(osc);
        return osc;
      };

      let filter = null;
      if (['pad', 'lead', 'lead2', 'choir'].includes(inst)) {
        filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = inst === 'pad' ? 1500 : 6000;
        filter.Q.value = 0.6;
        filter.connect(g);
      }
      const input = filter || g;

      const attack = inst === 'pad' || inst === 'choir' ? 0.09 : 0.006;
      const release = inst === 'pad' ? 0.35 : inst === 'lead' ? 0.08 : 0.09;
      const peak = Math.max(0.0001, gain);

      if (inst === 'lead' || inst === 'lead2') {
        const osc = makeOsc(inst === 'lead' ? 'pulse25' : 'pulse12', 0, freq);
        osc.connect(input);
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 5.4;
        lfoGain.gain.value = freq * 0.0065;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start(when + 0.12);
        lfo.stop(when + dur + release + 0.05);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(peak, when + attack);
        g.gain.linearRampToValueAtTime(peak * 0.72, when + Math.min(dur * 0.5, 0.16));
        g.gain.setValueAtTime(peak * 0.72, when + Math.max(attack, dur - release));
        g.gain.linearRampToValueAtTime(0.0001, when + dur + release);
        osc.start(when);
        osc.stop(when + dur + release + 0.02);
        const dsend = ctx.createGain();
        dsend.gain.value = tr.delay == null ? 0.24 : tr.delay;
        g.connect(dsend);
        dsend.connect(this.delaySend);
      } else if (inst === 'bass') {
        const osc = makeOsc('pulse12', 0, freq);
        const sub = ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(freq / 2, when);
        const sg = ctx.createGain();
        sg.gain.value = 0.35;
        sub.connect(sg);
        sg.connect(g);
        osc.connect(input);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(peak, when + 0.007);
        g.gain.linearRampToValueAtTime(peak * 0.6, when + 0.09);
        g.gain.setValueAtTime(peak * 0.6, when + Math.max(0.1, dur - 0.04));
        g.gain.linearRampToValueAtTime(0.0001, when + dur + 0.04);
        osc.start(when); osc.stop(when + dur + 0.06);
        sub.start(when); sub.stop(when + dur + 0.06);
      } else if (inst === 'pad' || inst === 'choir') {
        const oscA = makeOsc(inst === 'pad' ? 'sawtooth' : 'triangle', -5, freq);
        const oscB = makeOsc(inst === 'pad' ? 'sawtooth' : 'triangle', 6, freq * 1.003);
        oscA.connect(input); oscB.connect(input);
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = 0.35;
        lg.gain.value = freq * 0.002;
        lfo.connect(lg);
        lg.connect(oscA.frequency);
        lg.connect(oscB.frequency);
        lfo.start(when); lfo.stop(when + dur + release + 0.05);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(peak, when + attack);
        g.gain.setValueAtTime(peak * 0.84, when + Math.max(attack, dur - 0.2));
        g.gain.linearRampToValueAtTime(0.0001, when + dur + release);
        oscA.start(when); oscA.stop(when + dur + release + 0.05);
        oscB.start(when); oscB.stop(when + dur + release + 0.05);
      } else if (inst === 'bell') {
        const osc = makeOsc('sine', 0, freq);
        const osc2 = makeOsc('sine', 0, freq * 2.01);
        const g2 = ctx.createGain();
        g2.gain.value = 0.24;
        osc.connect(g); osc2.connect(g2); g2.connect(g);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(peak, when + 0.004);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.15), when + Math.min(dur, 0.5));
        g.gain.linearRampToValueAtTime(0.0001, when + Math.min(dur + 0.28, 1.4));
        osc.start(when); osc2.start(when);
        osc.stop(when + Math.min(dur + 0.3, 1.5));
        osc2.stop(when + Math.min(dur + 0.3, 1.5));
        const dsend = ctx.createGain();
        dsend.gain.value = tr.delay == null ? 0.2 : tr.delay;
        g.connect(dsend); dsend.connect(this.delaySend);
      } else if (inst === 'pluck' || inst === 'arp') {
        const osc = makeOsc(inst === 'arp' ? 'pulse12' : 'triangle', 0, freq);
        osc.connect(input);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(peak, when + 0.003);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.22), when + 0.1);
        g.gain.linearRampToValueAtTime(0.0001, when + Math.min(dur, 0.42));
        osc.start(when); osc.stop(when + Math.min(dur + 0.05, 0.55));
        const dsend = ctx.createGain();
        dsend.gain.value = inst === 'arp' ? 0.28 : 0.12;
        g.connect(dsend); dsend.connect(this.delaySend);
      } else {
        // 默认三角波
        const osc = makeOsc('triangle', 0, freq);
        osc.connect(g);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(peak, when + 0.006);
        g.gain.linearRampToValueAtTime(0.0001, when + dur);
        osc.start(when); osc.stop(when + dur + 0.02);
      }
    },

    _drum(token, when, tr, ti) {
      const ctx = this.ctx;
      const vol = (tr.gain == null ? 0.15 : tr.gain);
      const sway = (U.hash2(this.absStep, ti + 3, 5) - 0.5) * 0.05;
      const pan = tr.pan || 0;
      switch (token) {
        case 'k': this._kick(when, vol * 0.9, pan); break;
        case 'K': this._kick(when, vol * 1.25, pan); break;
        case 's': this._snare(when, vol * 0.55, pan); break;
        case 'S': this._snare(when, vol * 0.8, pan); break;
        case 'h': this._hat(when, vol * 0.17, pan, 0.035); break;
        case 'H': this._hat(when, vol * 0.22, pan, 0.14); break;
        case 'o': this._hat(when, vol * 0.2, pan, 0.25); break;
        case 't': this._tom(when, vol * 0.5, pan, 140); break;
        case 'T': this._tom(when, vol * 0.6, pan, 96); break;
        case 'c': this._crash(when, vol * 0.3, pan); break;
        default: break;
      }
      // 轻微摇摆，让鼓组不呆板
      if (sway) { /* 已通过 when 抖动实现 */ }
    },

    _kick(when, vol, pan) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, when);
      osc.frequency.exponentialRampToValueAtTime(42, when + 0.11);
      g.gain.setValueAtTime(Math.max(0.0001, vol), when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.19);
      osc.connect(g);
      g.connect(this._panner(pan));
      osc.start(when); osc.stop(when + 0.2);
    },
    _snare(when, vol, pan) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(Math.max(0.0001, vol), when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.13);
      src.connect(f); f.connect(g); g.connect(this._panner(pan));
      src.start(when); src.stop(when + 0.15);
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(190, when);
      og.gain.setValueAtTime(vol * 0.5, when);
      og.gain.exponentialRampToValueAtTime(0.0001, when + 0.065);
      o.connect(og); og.connect(this._panner(pan));
      o.start(when); o.stop(when + 0.08);
    },
    _hat(when, vol, pan, len) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 6800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(Math.max(0.0001, vol), when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + len);
      src.connect(f); f.connect(g); g.connect(this._panner(pan));
      src.start(when); src.stop(when + len + 0.02);
    },
    _tom(when, vol, pan, freq) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, when);
      o.frequency.exponentialRampToValueAtTime(freq * 0.55, when + 0.14);
      g.gain.setValueAtTime(Math.max(0.0001, vol), when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
      o.connect(g); g.connect(this._panner(pan));
      o.start(when); o.stop(when + 0.2);
    },
    _crash(when, vol, pan) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 4200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(Math.max(0.0001, vol), when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.75);
      src.connect(f); f.connect(g); g.connect(this._panner(pan));
      src.start(when); src.stop(when + 0.8);
    },

    _panner(pan) {
      if (pan == null || !this.ctx.createStereoPanner) return this.musicBus;
      const p = this.ctx.createStereoPanner();
      p.pan.value = U.clamp(pan, -1, 1);
      p.connect(this.musicBus);
      return p;
    },

    // ------------------------------------------------------------ vehicle loop
    setVehicle(type, active, speed = 0) {
      if (!this.ctx) return;
      if (!active) {
        if (this._vehicleNodes) {
          const { gain } = this._vehicleNodes;
          gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
          const nodes = this._vehicleNodes;
          setTimeout(() => {
            try { nodes.src.stop(); nodes.osc.stop(); } catch (e) {}
          }, 400);
          this._vehicleNodes = null;
        }
        this._vehicle = null;
        return;
      }
      if (!this._vehicleNodes) {
        const ctx = this.ctx;
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 380;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 58;
        const oscF = ctx.createBiquadFilter();
        oscF.type = 'lowpass'; oscF.frequency.value = 240;
        const gain = ctx.createGain();
        gain.gain.value = 0.0001;
        src.connect(f); f.connect(gain);
        osc.connect(oscF); oscF.connect(gain);
        gain.connect(this.sfxBus);
        src.start(); osc.start();
        gain.gain.setTargetAtTime(type === 'glider' ? 0.035 : 0.06, ctx.currentTime, 0.2);
        this._vehicleNodes = { src, osc, gain, f, oscF };
      }
      const n = this._vehicleNodes;
      const t = this.ctx.currentTime;
      if (type === 'glider') {
        n.f.frequency.setTargetAtTime(500 + speed * 70, t, 0.2);
        n.osc.frequency.setTargetAtTime(180 + speed * 25, t, 0.2);
        n.gain.gain.setTargetAtTime(0.03 + Math.min(speed, 8) * 0.002, t, 0.2);
      } else if (type === 'mech') {
        n.f.frequency.setTargetAtTime(300, t, 0.2);
        n.osc.frequency.setTargetAtTime(44 + speed * 4, t, 0.2);
        n.gain.gain.setTargetAtTime(0.05 + Math.min(speed, 6) * 0.003, t, 0.2);
      } else {
        n.f.frequency.setTargetAtTime(340 + speed * 55, t, 0.2);
        n.osc.frequency.setTargetAtTime(52 + speed * 8, t, 0.2);
        n.gain.gain.setTargetAtTime(0.045 + Math.min(speed, 7) * 0.003, t, 0.2);
      }
      this._vehicle = type;
    },

    // ------------------------------------------------------------ sfx
    sfx(name, opts = {}) {
      if (!this.ctx || this.muted) return;
      const vol = (opts.vol == null ? 1 : opts.vol) * this.volumes.sfx;
      const pan = opts.pan || 0;
      const t = this.ctx.currentTime + (opts.delay || 0);
      const fn = this.SFX[name];
      if (!fn) return;
      try { fn.call(this, t, vol, pan, opts); } catch (err) { /* 音频失败不应中断游戏 */ }
    },

    _tone(freq, when, dur, vol, type = 'square', freqEnd = null, pan = 0, opts = {}) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(20, freq), when);
      if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), when + dur);
      const g = ctx.createGain();
      const attack = opts.attack == null ? 0.004 : opts.attack;
      const peak = Math.max(0.0001, vol);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(peak, when + attack);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * (opts.sustain == null ? 0.02 : opts.sustain)), when + dur);
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (p) {
        p.pan.value = U.clamp(pan, -1, 1);
        p.connect(this.sfxBus);
      }
      o.connect(g);
      g.connect(p || this.sfxBus);
      if (opts.reverb) {
        const rs = ctx.createGain();
        rs.gain.value = opts.reverb;
        g.connect(rs);
        rs.connect(this.reverb);
      }
      o.start(when);
      o.stop(when + dur + 0.02);
    },

    _noise(when, dur, vol, filterType = 'highpass', f0 = 1000, f1 = null, pan = 0, opts = {}) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const f = ctx.createBiquadFilter();
      f.type = filterType;
      f.frequency.setValueAtTime(f0, when);
      if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), when + dur);
      f.Q.value = opts.q == null ? 0.8 : opts.q;
      const g = ctx.createGain();
      const peak = Math.max(0.0001, vol);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(peak, when + (opts.attack || 0.003));
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (p) { p.pan.value = U.clamp(pan, -1, 1); p.connect(this.sfxBus); }
      src.connect(f); f.connect(g); g.connect(p || this.sfxBus);
      if (opts.reverb) {
        const rs = ctx.createGain(); rs.gain.value = opts.reverb;
        g.connect(rs); rs.connect(this.reverb);
      }
      src.start(when); src.stop(when + dur + 0.02);
    },

    _chord(freqs, when, dur, vol, type = 'triangle', pan = 0) {
      for (const f of freqs) this._tone(f, when, dur, vol, type, f * 0.999, pan);
    },

    SFX: {
      jump(t, v, p) {
        this._tone(260, t, 0.11, 0.13 * v, 'square', 540, p);
        this._tone(520, t + 0.015, 0.06, 0.04 * v, 'triangle', 760, p);
      },
      doubleJump(t, v, p) {
        this._tone(360, t, 0.1, 0.12 * v, 'square', 720, p);
        this._tone(720, t + 0.06, 0.12, 0.08 * v, 'triangle', 1080, p);
        this._tone(1440, t + 0.11, 0.1, 0.045 * v, 'sine', 1800, p);
      },
      wallJump(t, v, p) {
        this._noise(t, 0.09, 0.12 * v, 'bandpass', 1600, 700, p, { q: 1.2 });
        this._tone(220, t, 0.09, 0.08 * v, 'square', 440, p);
      },
      dash(t, v, p) {
        this._noise(t, 0.16, 0.16 * v, 'bandpass', 900, 2600, p, { q: 1.4, attack: 0.01 });
        this._tone(180, t, 0.12, 0.07 * v, 'sawtooth', 90, p);
      },
      wave(t, v, p) {
        this._tone(240, t, 0.2, 0.1 * v, 'triangle', 720, p);
        this._noise(t, 0.18, 0.09 * v, 'highpass', 900, 2400, p);
      },
      land(t, v, p) {
        this._tone(120, t, 0.1, 0.1 * v, 'sine', 55, p);
        this._noise(t, 0.07, 0.05 * v, 'lowpass', 800, 200, p);
      },
      slide(t, v, p) {
        this._noise(t, 0.18, 0.08 * v, 'bandpass', 700, 300, p, { q: 0.9 });
      },
      poundCharge(t, v, p) {
        this._tone(180, t, 0.16, 0.06 * v, 'sawtooth', 520, p);
      },
      pound(t, v, p) {
        this._tone(95, t, 0.28, 0.2 * v, 'sine', 34, p);
        this._noise(t, 0.2, 0.16 * v, 'lowpass', 1200, 160, p);
        this._tone(240, t + 0.01, 0.18, 0.06 * v, 'square', 90, p);
      },
      shard(t, v, p, o) {
        const base = 880 + (o && o.pitch || 0) * 90;
        this._tone(base, t, 0.08, 0.055 * v, 'sine', base * 1.5, p);
        this._tone(base * 1.5, t + 0.045, 0.1, 0.035 * v, 'triangle', base * 2, p);
      },
      grand(t, v, p) {
        this._chord([523.25, 659.25, 783.99, 1046.5], t, 0.55, 0.06 * v, 'triangle', p);
        this._tone(1568, t + 0.12, 0.5, 0.04 * v, 'sine', 2093, p, { reverb: 0.4 });
      },
      checkpoint(t, v, p) {
        this._chord([392, 523.25, 659.25], t, 0.45, 0.055 * v, 'triangle', p);
        this._tone(1046.5, t + 0.08, 0.4, 0.03 * v, 'sine', 1046.5, p, { reverb: 0.35 });
      },
      hurt(t, v, p) {
        this._tone(320, t, 0.22, 0.12 * v, 'sawtooth', 80, p);
        this._noise(t, 0.12, 0.09 * v, 'bandpass', 700, 250, p);
      },
      death(t, v, p) {
        this._tone(440, t, 0.16, 0.1 * v, 'square', 220, p);
        this._tone(220, t + 0.16, 0.3, 0.1 * v, 'square', 110, p);
        this._tone(110, t + 0.42, 0.6, 0.09 * v, 'triangle', 55, p, { reverb: 0.4 });
      },
      freeze(t, v, p) {
        this._noise(t, 0.22, 0.12 * v, 'highpass', 3400, 7200, p, { reverb: 0.2 });
        this._chord([1046.5, 1318.5, 1568, 2093], t + 0.02, 0.25, 0.035 * v, 'sine', p);
        this._tone(2637, t + 0.1, 0.3, 0.02 * v, 'sine', 3000, p, { reverb: 0.35 });
      },
      obsidian(t, v, p) {
        this._tone(90, t, 0.3, 0.12 * v, 'sine', 38, p);
        this._noise(t, 0.22, 0.1 * v, 'lowpass', 1800, 160, p, { reverb: 0.15 });
        this._noise(t + 0.08, 0.2, 0.05 * v, 'highpass', 1200, 3200, p);
      },
      tame(t, v, p) {
        this._tone(523, t, 0.18, 0.06 * v, 'triangle', 659, p, { reverb: 0.3 });
        this._tone(784, t + 0.1, 0.3, 0.04 * v, 'sine', 1046, p, { reverb: 0.35 });
      },
      fireball(t, v, p) {
        this._noise(t, 0.14, 0.1 * v, 'bandpass', 1600, 600, p, { q: 1.5 });
        this._tone(380, t, 0.1, 0.05 * v, 'square', 180, p);
      },
      fireBounce(t, v, p) {
        this._tone(540, t, 0.055, 0.04 * v, 'square', 760, p);
      },
      ignite(t, v, p) {
        this._noise(t, 0.35, 0.11 * v, 'bandpass', 1200, 400, p, { q: 0.8, attack: 0.03 });
        this._tone(160, t, 0.25, 0.04 * v, 'sawtooth', 70, p);
      },
      barrel(t, v, p) {
        this._tone(70, t, 0.5, 0.23 * v, 'sine', 28, p);
        this._noise(t, 0.4, 0.2 * v, 'lowpass', 2400, 120, p, { reverb: 0.2 });
        this._noise(t + 0.05, 0.25, 0.1 * v, 'bandpass', 900, 300, p);
      },
      steam(t, v, p) {
        this._noise(t, 0.55, 0.09 * v, 'highpass', 1200, 3400, p, { attack: 0.06, q: 0.6 });
      },
      flip(t, v, p) {
        this._tone(160, t, 0.35, 0.1 * v, 'sine', 60, p);
        this._tone(320, t + 0.04, 0.25, 0.06 * v, 'triangle', 640, p);
        this._noise(t, 0.25, 0.07 * v, 'bandpass', 500, 1800, p);
      },
      pulse(t, v, p) {
        this._tone(110, t, 0.36, 0.17 * v, 'sine', 44, p);
        this._noise(t, 0.25, 0.1 * v, 'lowpass', 2000, 220, p);
      },
      warpThrow(t, v, p) {
        this._tone(480, t, 0.18, 0.07 * v, 'square', 1400, p);
        this._noise(t, 0.12, 0.05 * v, 'highpass', 1800, 4800, p);
      },
      warp(t, v, p) {
        for (let i = 0; i < 4; i++) this._tone(600 * Math.pow(1.5, i), t + i * 0.035, 0.12, 0.04 * v, 'sine', 600 * Math.pow(1.5, i + 1), p, { reverb: 0.3 });
        this._noise(t, 0.2, 0.08 * v, 'highpass', 1800, 5400, p);
      },
      swap(t, v, p) {
        this._tone(900, t, 0.09, 0.06 * v, 'triangle', 300, p);
        this._tone(300, t + 0.09, 0.12, 0.06 * v, 'triangle', 900, p);
      },
      echoStart(t, v, p) {
        this._tone(660, t, 0.08, 0.05 * v, 'sine', 880, p, { reverb: 0.4 });
        this._tone(990, t + 0.09, 0.1, 0.035 * v, 'sine', 1320, p, { reverb: 0.4 });
      },
      echoEnd(t, v, p) {
        this._chord([440, 554.37, 659.25, 880], t, 0.5, 0.045 * v, 'triangle', p);
        this._noise(t, 0.2, 0.03 * v, 'highpass', 2600, 6200, p);
      },
      bulletIn(t, v, p) {
        this._tone(1200, t, 0.35, 0.06 * v, 'sine', 320, p, { reverb: 0.3 });
        this._noise(t, 0.3, 0.05 * v, 'lowpass', 3000, 500, p);
      },
      bulletOut(t, v, p) {
        this._tone(300, t, 0.25, 0.05 * v, 'sine', 1200, p, { reverb: 0.25 });
      },
      deflect(t, v, p) {
        this._tone(1568, t, 0.12, 0.09 * v, 'square', 2349, p);
        this._tone(2349, t + 0.03, 0.16, 0.05 * v, 'sine', 1568, p, { reverb: 0.35 });
      },
      chain(t, v, p) {
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        notes.forEach((f, i) => this._tone(f, t + i * 0.075, 0.35, 0.055 * v, 'triangle', f, p, { reverb: 0.35 }));
        this._chord([261.63, 392, 523.25], t + 0.3, 0.6, 0.04 * v, 'pad' === 'pad' ? 'sawtooth' : 'triangle', p);
      },
      form(t, v, p) {
        this._noise(t, 0.2, 0.08 * v, 'bandpass', 700, 2400, p);
        this._tone(440, t, 0.15, 0.05 * v, 'triangle', 880, p, { reverb: 0.3 });
      },
      shrine(t, v, p) {
        this._chord([261.63, 392, 523.25, 659.25, 783.99], t, 0.9, 0.05 * v, 'triangle', p);
        this._tone(1046.5, t + 0.3, 0.8, 0.035 * v, 'sine', 1568, p, { reverb: 0.5 });
      },
      bossRoar(t, v, p) {
        this._tone(70, t, 0.9, 0.18 * v, 'sawtooth', 38, p);
        this._noise(t, 0.8, 0.13 * v, 'lowpass', 900, 180, p, { attack: 0.05 });
      },
      bossHit(t, v, p) {
        this._tone(180, t, 0.12, 0.12 * v, 'square', 70, p);
        this._noise(t, 0.1, 0.12 * v, 'bandpass', 1600, 500, p);
      },
      bossPhase(t, v, p) {
        this._tone(80, t, 0.6, 0.18 * v, 'sine', 40, p);
        this._chord([220, 261.63, 329.63], t + 0.15, 0.7, 0.06 * v, 'sawtooth', p);
        this._noise(t, 0.5, 0.08 * v, 'highpass', 1200, 5000, p);
      },
      bossDie(t, v, p) {
        for (let i = 0; i < 6; i++) {
          this._tone(880 * Math.pow(0.8, i), t + i * 0.11, 0.5, 0.06 * v, 'sine', 220, p, { reverb: 0.5 });
        }
        this._noise(t, 0.9, 0.14 * v, 'lowpass', 4000, 100, p);
      },
      menuMove(t, v, p) {
        this._tone(880, t, 0.03, 0.03 * v, 'square', 1040, p);
      },
      menuConfirm(t, v, p) {
        this._tone(660, t, 0.07, 0.05 * v, 'triangle', 990, p);
        this._tone(1320, t + 0.05, 0.1, 0.03 * v, 'sine', 1320, p);
      },
      menuBack(t, v, p) {
        this._tone(520, t, 0.06, 0.04 * v, 'triangle', 350, p);
      },
      pause(t, v, p) {
        this._tone(420, t, 0.1, 0.04 * v, 'sine', 300, p);
      },
      unpause(t, v, p) {
        this._tone(300, t, 0.1, 0.04 * v, 'sine', 480, p);
      },
      spring(t, v, p) {
        this._tone(220, t, 0.2, 0.1 * v, 'sine', 880, p);
        this._tone(440, t + 0.04, 0.25, 0.05 * v, 'triangle', 1200, p, { reverb: 0.2 });
      },
      meteor(t, v, p) {
        this._tone(140, t, 0.35, 0.13 * v, 'sine', 760, p);
        this._noise(t, 0.25, 0.1 * v, 'bandpass', 700, 3000, p);
        this._tone(2093, t + 0.2, 0.15, 0.04 * v, 'sine', 2637, p);
      },
      vehicle(t, v, p) {
        this._noise(t, 0.35, 0.08 * v, 'lowpass', 500, 1000, p);
      },
      roarmini(t, v, p) {
        this._tone(160, t, 0.4, 0.1 * v, 'sawtooth', 80, p);
      },
    },

    // 调试：用 OfflineAudioContext 检查音乐是否产生声音
    async diagnose() {
      if (!this.ctx) return { ok: false, reason: 'not unlocked' };
      return {
        ok: true,
        state: this.ctx.state,
        sampleRate: this.ctx.sampleRate,
        currentSong: this.currentSong,
        timeScale: this.timeScale,
        musicGain: this.musicGain ? this.musicGain.gain.value : null,
        sfxVolume: this.volumes.sfx,
      };
    },
  };

  PB.Audio = Audio;
})();
