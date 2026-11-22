/* ============================================================
   music.js — 原创芯片配乐数据
   一首贯穿全程的四音动机在四种地域中变形：
   E–G–B–A（希望）→ 小调（霜火）→ 奇数拍（折叠城）
   → 大调（黎明）。音符均由代码驱动的合成器演奏。
   ============================================================ */
(function () {
  'use strict';
  const PB = window.PB;
  const U = PB.U;

  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  function tokens(str) { return String(str).trim().split(/\s+/).filter(Boolean); }
  function fit(str, steps, label) {
    const a = tokens(str);
    if (a.length !== steps) {
      console.warn(`[music] ${label}: ${a.length} steps, expected ${steps}`);
      while (a.length < steps) a.push('.');
      a.length = steps;
    }
    return a.join(' ');
  }
  function padChord(chord, steps, label) {
    return fit(chord + ' ' + '- '.repeat(steps - 1), steps, label);
  }
  function arpGen(notes, rhythm, label) {
    const chars = String(rhythm).split('');
    const out = [];
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (c === '.' || c === ' ') out.push('.');
      else out.push(notes[(+c) % notes.length]);
    }
    return fit(out.join(' '), chars.length, label);
  }
  function bassGen(roots, rhythm, label) {
    const chars = String(rhythm).split('');
    const out = [];
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (c === '.' || c === ' ') out.push('.');
      else out.push(roots[(+c) % roots.length]);
    }
    return fit(out.join(' '), chars.length, label);
  }
  function cycle(n, order) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(order[i % order.length]);
    return out;
  }
  function repeatOrder(n, order) { return cycle(n, order); }

  // --------------------------------------------------------------- common drums
  const D = {
    eA: 'k . . h s . . h k . h . s . . h',
    eB: 'k . h . s . h . k . h k s . h .',
    eFill: 'k . . h s . . h k . k . s s s s',
    fA: 'k . h . s . h k k . h . s . h .',
    fB: 'k . h k s . h . k . h . s h h .',
    fFill: 'k k h . s . h k k . h . s s s s',
    sA: 'k . . h s . . h k . h . s . . h',
    sB: 'k . h . s . h k k . h . s . h .',
    sFill: 'k . . h s . . h k k k . s s s s',
    rA: 'k . . . . s . . . . k . . . . s . . . .',
    rB: 'k . . . h s . . . . k . . . s . . . h .',
    rFill: 'k . . . . s . . . . k . . k s s . h . .',
    bA: 'k . h k s . h . k k h . s . h h',
    bB: 'k k h . s . h k k . h k s h h .',
    bFill: 'k k h k s . h k k k h k s s s s',
    tA: 'h . . h . . h . h . . h . . h .',
    tB: 'k . . . h . . . k . . . h . . .',
    endA: 'h . . . . . h . . . . . h . . .',
  };

  // --------------------------------------------------------------- songs
  const songs = {};

  // 1. TITLE — Prism Awakens ------------------------------------------------
  {
    const steps = 16;
    const chords = ['E4/G4/B4/D5', 'C4/E4/G4/B4', 'G3/B3/D4/F#4', 'D4/F#4/A4/C#5'];
    const bassRoots = [['E2', 'B1', 'E3', 'B1'], ['C2', 'G1', 'C3', 'G1'], ['G1', 'D2', 'G2', 'D2'], ['D2', 'A1', 'D3', 'A1']];
    const arpNotes = [['E4', 'G4', 'B4', 'D5'], ['C4', 'E4', 'G4', 'B4'], ['G3', 'B3', 'D4', 'F#4'], ['D4', 'F#4', 'A4', 'C#5']];
    const arpRhythm = '0...2...1...3...';
    const lead = [
      'E5 - - - B4 - - - G5 - - - A4 - - -',
      'C5 - - - G4 - - - E5 - - - D5 - - -',
      'B4 - - - D5 - - - G5 - - - F#5 - - -',
      'A4 - - - D5 - - - C#5 - - - A4 - - -',
      'E5 - - G5 - B5 - A5 - G5 - E5 - D5 - .',
      'C5 - - E5 - G5 - F#5 - E5 - C5 - D5 - .',
      'B4 - - D5 - G5 - F#5 - G5 - D5 - B4 - .',
      'A4 - - C#5 - E5 - D5 - C#5 - A4 - F#4 - .',
    ];
    const padPatterns = chords.map((c, i) => padChord(c, steps, `title pad ${i}`));
    const arpPatterns = arpNotes.map((n, i) => arpGen(n, arpRhythm, `title arp ${i}`));
    const bassPatterns = bassRoots.map((r, i) => bassGen(r, '0...1...2...1...', `title bass ${i}`));
    songs.title = {
      bpm: 84, stepsPerBar: 16, bars: 8, swing: 0,
      tracks: [
        { instrument: 'pad', gain: 0.035, reverb: 0.5, pan: 0, minIntensity: 0.05, patterns: padPatterns, order: cycle(8, [0, 1, 2, 3]) },
        { instrument: 'bass', gain: 0.075, reverb: 0.18, pan: 0, minIntensity: 0.12, patterns: bassPatterns, order: cycle(8, [0, 1, 2, 3]) },
        { instrument: 'arp', gain: 0.032, reverb: 0.3, pan: -0.22, delay: 0.32, minIntensity: 0.22, patterns: arpPatterns, order: cycle(8, [0, 1, 2, 3]) },
        { instrument: 'lead', gain: 0.06, reverb: 0.35, pan: 0.08, delay: 0.3, minIntensity: 0.4, patterns: lead.map((s, i) => fit(s, 16, `title lead ${i}`)), order: cycle(8, [0, 1, 2, 3, 4, 5, 6, 7]) },
        { instrument: 'bell', gain: 0.028, reverb: 0.55, pan: 0.3, delay: 0.2, minIntensity: 0.58, patterns: arpPatterns, order: cycle(8, [0, 1, 2, 3]) },
        { instrument: 'drums', gain: 0.08, minIntensity: 0.78, patterns: [fit(D.tB, 16, 'title drums')], order: [0, 0, 0, 0, 0, 0, 0, 0] },
      ],
    };
  }

  // 2. EMBERFIELD -------------------------------------------------------------
  {
    const steps = 16;
    const chords = ['E4/G4/B4', 'C4/E4/G4', 'G3/B3/D4', 'D4/F#4/A4'];
    const roots = [['E2', 'B1', 'E3', 'B1'], ['C2', 'G1', 'C3', 'G1'], ['G1', 'D2', 'G2', 'D2'], ['D2', 'A1', 'D3', 'A1']];
    const arps = [
      ['E4', 'G4', 'B4', 'E5'],
      ['C4', 'E4', 'G4', 'C5'],
      ['G3', 'B3', 'D4', 'G4'],
      ['D4', 'F#4', 'A4', 'D5'],
    ];
    const arpRhythm = '0.2.1.3.0.2.1.3.';
    const lead = [
      'E5 - - G5 B5 - A5 - G5 - E5 - D5 - E5 -',
      'C5 - - E5 G5 - A5 - B5 - A5 - G5 - E5 -',
      'D5 - - G5 B5 - D6 - B5 - A5 - G5 - D5 -',
      'F#5 - - A5 D6 - C6 - A5 - F#5 - E5 - D5 -',
      'G5 - B5 - E6 - D6 - B5 - G5 - A5 - B5 -',
      'E5 - G5 - C6 - B5 - G5 - E5 - D5 - E5 -',
      'B5 - D6 - G6 - F#6 - D6 - B5 - A5 - G5 -',
      'A5 - D6 - F#6 - E6 - D6 - A5 - F#5 - D5 -',
    ];
    const counter = [
      'B4 - G4 - E4 - G4 - B4 - E5 - D5 - B4 -',
      'G4 - E4 - C4 - E4 - G4 - C5 - B4 - G4 -',
      'D4 - B3 - G3 - B3 - D4 - G4 - F#4 - D4 -',
      'A3 - F#3 - D3 - F#3 - A3 - D4 - C#4 - A3 -',
      'E4 - B4 - G4 - B4 - E5 - G5 - F#5 - E5 -',
      'C4 - G4 - E4 - G4 - C5 - E5 - D5 - C5 -',
      'G3 - D4 - B3 - D4 - G4 - B4 - A4 - G4 -',
      'D3 - A3 - F#3 - A3 - D4 - F#4 - E4 - D4 -',
    ];
    songs.ember = {
      bpm: 132, stepsPerBar: 16, bars: 16, swing: 0.06,
      tracks: [
        { instrument: 'pad', gain: 0.026, reverb: 0.4, minIntensity: 0.08, patterns: chords.map((c, i) => padChord(c, steps, `ember pad ${i}`)), order: cycle(16, [0, 1, 2, 3]) },
        { instrument: 'bass', gain: 0.09, reverb: 0.08, minIntensity: 0.12, patterns: [
          bassGen(roots[0], '0..0..1.0..0.2.1', 'ember bass 0'),
          bassGen(roots[1], '0..0..1.0..0.2.1', 'ember bass 1'),
          bassGen(roots[2], '0..0..1.0..0.2.1', 'ember bass 2'),
          bassGen(roots[3], '0..0..1.0..0.2.1', 'ember bass 3'),
        ], order: cycle(16, [0, 1, 2, 3]) },
        { instrument: 'arp', gain: 0.028, reverb: 0.2, pan: -0.28, delay: 0.24, minIntensity: 0.4, patterns: arps.map((n, i) => arpGen(n, arpRhythm, `ember arp ${i}`)), order: cycle(16, [0, 1, 2, 3]) },
        { instrument: 'lead', gain: 0.065, reverb: 0.22, pan: 0.1, delay: 0.24, minIntensity: 0.44, patterns: lead.map((s, i) => fit(s, 16, `ember lead ${i}`)), order: cycle(16, [0, 1, 2, 3, 4, 5, 6, 7]) },
        { instrument: 'lead2', gain: 0.028, reverb: 0.35, pan: -0.35, delay: 0.32, minIntensity: 0.82, patterns: counter.map((s, i) => fit(s, 16, `ember counter ${i}`)), order: cycle(16, [0, 1, 2, 3, 4, 5, 6, 7]) },
        { instrument: 'drums', gain: 0.105, minIntensity: 0.35, patterns: [D.eA, D.eB, D.eFill].map((s, i) => fit(s, 16, `ember drums ${i}`)), order: cycle(16, [0, 0, 1, 0, 0, 1, 0, 2]) },
      ],
    };
  }

  // 3. FROSTFIRE -------------------------------------------------------------
  {
    const steps = 16;
    const chords = ['B3/D4/F#4', 'G3/B3/D4', 'E3/G3/B3', 'F#3/A#3/C#4'];
    const roots = [['B1', 'F#2', 'B2', 'A1'], ['G1', 'D2', 'G2', 'F#1'], ['E1', 'B1', 'E2', 'D2'], ['F#1', 'C#2', 'F#2', 'E2']];
    const arps = [
      ['B4', 'D5', 'F#5', 'B5'],
      ['G4', 'B4', 'D5', 'G5'],
      ['E4', 'G4', 'B4', 'E5'],
      ['F#4', 'A#4', 'C#5', 'F#5'],
    ];
    const arpRhythm = '0213021302130213';
    const lead = [
      'B4 - D5 - F#5 - A5 - B5 - A5 - F#5 - D5 -',
      'G4 - B4 - D5 - F#5 - G5 - F#5 - D5 - B4 -',
      'E4 - G4 - B4 - D5 - E5 - D5 - B4 - G4 -',
      'F#4 - A#4 - C#5 - E5 - F#5 - E5 - C#5 - A#4 -',
      'F#5 - B5 - D6 - C#6 - B5 - F#5 - A5 - F#5 -',
      'D5 - G5 - B5 - A5 - G5 - D5 - F#5 - D5 -',
      'B4 - E5 - G5 - F#5 - E5 - B4 - D5 - B4 -',
      'C#5 - F#5 - A#5 - B5 - A#5 - F#5 - E5 - C#5 -',
    ];
    const counter = [
      'D5 - B4 - F#4 - B4 - D5 - F#5 - E5 - D5 -',
      'B4 - G4 - D4 - G4 - B4 - D5 - C#5 - B4 -',
      'G4 - E4 - B3 - E4 - G4 - B4 - A4 - G4 -',
      'A#4 - F#4 - C#4 - F#4 - A#4 - C#5 - B4 - A#4 -',
      'B4 - F#5 - D5 - F#5 - B5 - D6 - C#6 - B5 -',
      'G4 - D5 - B4 - D5 - G5 - B5 - A5 - G5 -',
      'E4 - B4 - G4 - B4 - E5 - G5 - F#5 - E5 -',
      'F#4 - C#5 - A#4 - C#5 - F#5 - A#5 - G#5 - F#5 -',
    ];
    const drumPatterns = [D.fA, D.fB, D.fFill].map((s, i) => fit(s, 16, `frost drums ${i}`));
    songs.frost = {
      bpm: 140, stepsPerBar: 16, bars: 16, swing: 0,
      tracks: [
        { instrument: 'pad', gain: 0.025, reverb: 0.45, minIntensity: 0.08, patterns: chords.map((c, i) => padChord(c, steps, `frost pad ${i}`)), order: cycle(16, [0, 1, 2, 3]) },
        { instrument: 'bass', gain: 0.085, reverb: 0.08, minIntensity: 0.12, patterns: roots.map((r, i) => bassGen(r, '0.0.1.0.0.0.2.1.', `frost bass ${i}`)), order: cycle(16, [0, 1, 2, 3]) },
        { instrument: 'arp', gain: 0.03, reverb: 0.18, pan: -0.3, delay: 0.2, minIntensity: 0.4, patterns: arps.map((n, i) => arpGen(n, arpRhythm, `frost arp ${i}`)), order: cycle(16, [0, 1, 2, 3]) },
        { instrument: 'bell', gain: 0.02, reverb: 0.5, pan: 0.32, delay: 0.25, minIntensity: 0.62, patterns: arps.map((n, i) => arpGen(n, '0...2...1...3...', `frost bell ${i}`)), order: cycle(16, [0, 1, 2, 3]) },
        { instrument: 'lead', gain: 0.062, reverb: 0.2, pan: 0.06, delay: 0.22, minIntensity: 0.44, patterns: lead.map((s, i) => fit(s, 16, `frost lead ${i}`)), order: cycle(16, [0, 1, 2, 3, 4, 5, 6, 7]) },
        { instrument: 'lead2', gain: 0.026, reverb: 0.3, pan: -0.36, delay: 0.3, minIntensity: 0.85, patterns: counter.map((s, i) => fit(s, 16, `frost counter ${i}`)), order: cycle(16, [0, 1, 2, 3, 4, 5, 6, 7]) },
        { instrument: 'drums', gain: 0.1, minIntensity: 0.35, patterns: drumPatterns, order: cycle(16, [0, 0, 1, 0, 2, 0, 1, 0]) },
      ],
    };
  }

  // 4. STAR-RIFT FOLD (5/4) --------------------------------------------------
  {
    const steps = 20;
    const chords = ['F#3/A3/C#4', 'D3/F#3/A3', 'A2/C#3/E3', 'E3/G#3/B3'];
    const roots = [['F#2', 'C#3', 'A2', 'E2'], ['D2', 'A2', 'F#2', 'C#2'], ['A1', 'E2', 'C#2', 'G#1'], ['E2', 'B2', 'G#2', 'D2']];
    const arps = [
      ['F#4', 'A4', 'C#5', 'F#5'],
      ['D4', 'F#4', 'A4', 'D5'],
      ['A3', 'C#4', 'E4', 'A4'],
      ['E4', 'G#4', 'B4', 'E5'],
    ];
    const arpRhythm = '0.2.1.3.0.2.1.3.2.1.';
    const lead = [
      'F#4 - - A4 - C#5 - - E5 - - C#5 - - A4 - - - - -',
      'D4 - - F#4 - A4 - - C#5 - - A4 - - F#4 - - - - -',
      'A4 - - C#5 - E5 - - G#5 - - E5 - - C#5 - - - - -',
      'E4 - - G#4 - B4 - - D5 - - B4 - - G#4 - - - - -',
      'C#5 - E5 - F#5 - E5 - C#5 - A4 - F#4 - - A4 - C#5 - -',
      'D5 - C#5 - A4 - F#4 - A4 - C#5 - D5 - E5 - F#5 - - -',
      'E5 - - C#5 - A4 - - E5 - - A5 - - E5 - - - - -',
      'B4 - - G#4 - E4 - - B4 - - E5 - - B4 - - - - -',
    ];
    const counterRhythm = '0...1...2...3...1...';
    songs.rift = {
      bpm: 96, stepsPerBar: 20, bars: 8, swing: 0,
      tracks: [
        { instrument: 'pad', gain: 0.032, reverb: 0.55, minIntensity: 0.06, patterns: chords.map((c, i) => padChord(c, steps, `rift pad ${i}`)), order: cycle(8, [0, 1, 2, 3]) },
        { instrument: 'bass', gain: 0.08, reverb: 0.15, minIntensity: 0.12, patterns: roots.map((r, i) => bassGen(r, '0.....3.....2.....1.', `rift bass ${i}`)), order: cycle(8, [0, 1, 2, 3]) },
        { instrument: 'arp', gain: 0.026, reverb: 0.3, pan: -0.3, delay: 0.35, minIntensity: 0.35, patterns: arps.map((n, i) => arpGen(n, arpRhythm, `rift arp ${i}`)), order: cycle(8, [0, 1, 2, 3]) },
        { instrument: 'bell', gain: 0.024, reverb: 0.6, pan: 0.34, delay: 0.3, minIntensity: 0.55, patterns: arps.map((n, i) => arpGen(n, counterRhythm, `rift bell ${i}`)), order: cycle(8, [0, 1, 2, 3]) },
        { instrument: 'lead', gain: 0.058, reverb: 0.42, pan: 0.08, delay: 0.36, minIntensity: 0.42, patterns: lead.map((s, i) => fit(s, 20, `rift lead ${i}`)), order: cycle(8, [0, 1, 2, 3, 4, 5, 6, 7]) },
        { instrument: 'drums', gain: 0.085, minIntensity: 0.3, patterns: [D.rA, D.rB, D.rFill].map((s, i) => fit(s, 20, `rift drums ${i}`)), order: cycle(8, [0, 0, 1, 0, 0, 2, 1, 0]) },
      ],
    };
  }

  // 5. PRISM SUMMIT ----------------------------------------------------------
  {
    const steps = 16;
    const chords = ['D4/F4/A4', 'A#3/D4/F4', 'F3/A3/C4', 'C4/E4/G4'];
    const roots = [['D2', 'A2', 'D3', 'A1'], ['A#1', 'F2', 'A#2', 'F1'], ['F1', 'C2', 'F2', 'C2'], ['C2', 'G2', 'C3', 'G1']];
    const arps = [
      ['D4', 'F4', 'A4', 'D5'],
      ['A#3', 'D4', 'F4', 'A#4'],
      ['F3', 'A3', 'C4', 'F4'],
      ['C4', 'E4', 'G4', 'C5'],
    ];
    const arpRhythm = '0.2.1.3.0.2.1.3.';
    const lead = [
      'D5 - F5 - A5 - G5 - F5 - E5 - D5 - C5 -',
      'A#4 - D5 - F5 - G5 - A5 - G5 - F5 - D5 -',
      'C5 - F5 - A5 - G5 - F5 - C5 - A4 - F4 -',
      'G4 - C5 - E5 - G5 - A5 - G5 - E5 - C5 -',
      'A5 - D6 - F6 - E6 - D6 - A5 - F5 - A5 -',
      'F5 - A#5 - D6 - C6 - A#5 - F5 - D5 - F5 -',
      'C6 - A5 - F5 - A5 - C6 - F6 - E6 - C6 -',
      'G5 - C6 - E6 - D6 - C6 - G5 - E5 - G5 -',
    ];
    const counter = [
      'F4 - A4 - D5 - C5 - A4 - F4 - E4 - D4 -',
      'D4 - F4 - A#4 - A4 - F4 - D4 - C4 - A#3 -',
      'A3 - C4 - F4 - E4 - C4 - A3 - G3 - F3 -',
      'E4 - G4 - C5 - B4 - G4 - E4 - D4 - C4 -',
      'F5 - A5 - D6 - C6 - A5 - F5 - E5 - F5 -',
      'D5 - F5 - A#5 - A5 - F5 - D5 - C5 - D5 -',
      'A5 - C6 - F6 - E6 - C6 - A5 - G5 - A5 -',
      'G5 - B5 - E6 - D6 - B5 - G5 - F5 - G5 -',
    ];
    songs.summit = {
      bpm: 148, stepsPerBar: 16, bars: 16, swing: 0.04,
      tracks: [
        { instrument: 'pad', gain: 0.03, reverb: 0.45, minIntensity: 0.06, patterns: chords.map((c, i) => padChord(c, steps, `summit pad ${i}`)), order: cycle(16, [0, 1, 2, 3]) },
        { instrument: 'choir', gain: 0.02, reverb: 0.6, minIntensity: 0.72, patterns: chords.map((c, i) => padChord(c, steps, `summit choir ${i}`)), order: cycle(16, [0, 1, 2, 3]) },
        { instrument: 'bass', gain: 0.095, reverb: 0.08, minIntensity: 0.1, patterns: roots.map((r, i) => bassGen(r, '0..0..1.0..0.2.1', `summit bass ${i}`)), order: cycle(16, [0, 1, 2, 3]) },
        { instrument: 'arp', gain: 0.03, reverb: 0.2, pan: -0.3, delay: 0.22, minIntensity: 0.34, patterns: arps.map((n, i) => arpGen(n, arpRhythm, `summit arp ${i}`)), order: cycle(16, [0, 1, 2, 3]) },
        { instrument: 'lead', gain: 0.068, reverb: 0.24, pan: 0.08, delay: 0.26, minIntensity: 0.4, patterns: lead.map((s, i) => fit(s, 16, `summit lead ${i}`)), order: cycle(16, [0, 1, 2, 3, 4, 5, 6, 7]) },
        { instrument: 'lead2', gain: 0.028, reverb: 0.35, pan: -0.36, delay: 0.32, minIntensity: 0.78, patterns: counter.map((s, i) => fit(s, 16, `summit counter ${i}`)), order: cycle(16, [0, 1, 2, 3, 4, 5, 6, 7]) },
        { instrument: 'drums', gain: 0.11, minIntensity: 0.32, patterns: [D.sA, D.sB, D.sFill].map((s, i) => fit(s, 16, `summit drums ${i}`)), order: cycle(16, [0, 0, 1, 0, 0, 1, 2, 0]) },
      ],
    };
  }

  // 6. THE PRISM WARDEN ------------------------------------------------------
  {
    const steps = 16;
    const chords = ['C#4/E4/G#4', 'A3/C#4/E4', 'F#3/A3/C#4', 'G#3/C4/D#4'];
    const roots = [['C#2', 'G#2', 'C#3', 'G#1'], ['A1', 'E2', 'A2', 'E2'], ['F#1', 'C#2', 'F#2', 'C#2'], ['G#1', 'D#2', 'G#2', 'D#2']];
    const arps = [
      ['C#4', 'E4', 'G#4', 'C#5'],
      ['A3', 'C#4', 'E4', 'A4'],
      ['F#3', 'A3', 'C#4', 'F#4'],
      ['G#3', 'C4', 'D#4', 'G#4'],
    ];
    const arpRhythm = '0213021302130213';
    const lead = [
      'C#5 . C#5 . E5 . D#5 . C#5 . B4 . G#4 . B4 .',
      'A4 . C#5 . E5 . D5 . C#5 . A4 . E4 . A4 .',
      'F#4 . A4 . C#5 . B4 . A4 . F#4 . C#4 . F#4 .',
      'G#4 . C5 . D#5 . C5 . B4 . G#4 . D#4 . G#4 .',
      'C#5 E5 G#5 E5 C#5 . B4 C#5 D#5 E5 D#5 C#5 B4 . G#4 .',
      'A4 C#5 E5 C#5 A4 . G#4 A4 B4 C#5 B4 A4 G#4 . E4 .',
      'F#4 A4 C#5 A4 F#4 . E4 F#4 G#4 A4 G#4 F#4 E4 . C#4 .',
      'G#4 C5 D#5 C5 G#4 . F#4 G#4 A#4 C5 A#4 G#4 F#4 . D#4 .',
    ];
    const counter = [
      'G#4 - E4 - C#4 - E4 - G#4 - C#5 - B4 - G#4 -',
      'E4 - C#4 - A3 - C#4 - E4 - A4 - G#4 - E4 -',
      'C#4 - A3 - F#3 - A3 - C#4 - F#4 - E4 - C#4 -',
      'D#4 - C4 - G#3 - C4 - D#4 - G#4 - G4 - D#4 -',
      'C#5 - G#4 - E4 - G#4 - C#5 - E5 - D#5 - C#5 -',
      'A4 - E4 - C#4 - E4 - A4 - C#5 - B4 - A4 -',
      'F#4 - C#4 - A3 - C#4 - F#4 - A4 - G#4 - F#4 -',
      'G#4 - D#4 - C4 - D#4 - G#4 - C5 - B4 - G#4 -',
    ];
    const drums = [
      D.bA,
      D.bB,
      D.bFill,
      'k . h k s . h . k k h . s s h h',
    ].map((s, i) => fit(s, 16, `boss drums ${i}`));
    songs.boss = {
      bpm: 158, stepsPerBar: 16, bars: 16, swing: 0,
      tracks: [
        { instrument: 'pad', gain: 0.028, reverb: 0.4, minIntensity: 0.05, patterns: chords.map((c, i) => padChord(c, steps, `boss pad ${i}`)), order: cycle(16, [0, 1, 2, 3]) },
        { instrument: 'choir', gain: 0.022, reverb: 0.55, minIntensity: 0.55, patterns: chords.map((c, i) => padChord(c, steps, `boss choir ${i}`)), order: cycle(16, [0, 1, 2, 3]) },
        { instrument: 'bass', gain: 0.105, reverb: 0.08, minIntensity: 0.08, patterns: roots.map((r, i) => bassGen(r, '0.0.0.1.0.0.2.1.', `boss bass ${i}`)), order: cycle(16, [0, 1, 2, 3]) },
        { instrument: 'arp', gain: 0.03, reverb: 0.16, pan: -0.32, delay: 0.18, minIntensity: 0.3, patterns: arps.map((n, i) => arpGen(n, arpRhythm, `boss arp ${i}`)), order: cycle(16, [0, 1, 2, 3]) },
        { instrument: 'lead', gain: 0.078, reverb: 0.22, pan: 0.06, delay: 0.2, minIntensity: 0.38, patterns: lead.map((s, i) => fit(s, 16, `boss lead ${i}`)), order: cycle(16, [0, 1, 2, 3, 4, 5, 6, 7]) },
        { instrument: 'lead2', gain: 0.03, reverb: 0.32, pan: -0.36, delay: 0.26, minIntensity: 0.82, patterns: counter.map((s, i) => fit(s, 16, `boss counter ${i}`)), order: cycle(16, [0, 1, 2, 3, 4, 5, 6, 7]) },
        { instrument: 'drums', gain: 0.125, minIntensity: 0.25, patterns: drums, order: cycle(16, [0, 0, 1, 0, 3, 0, 1, 2]) },
      ],
    };
  }

  // 7. DAWN REFORGED ---------------------------------------------------------
  {
    const steps = 16;
    const chords = ['E4/G#4/B4', 'B3/D#4/F#4', 'C#4/E4/G#4', 'A3/C#4/E4'];
    const roots = [['E2', 'B1', 'E3', 'B1'], ['B1', 'F#2', 'B2', 'F#2'], ['C#2', 'G#2', 'C#3', 'G#2'], ['A1', 'E2', 'A2', 'E2']];
    const arps = [
      ['E4', 'G#4', 'B4', 'E5'],
      ['B3', 'D#4', 'F#4', 'B4'],
      ['C#4', 'E4', 'G#4', 'C#5'],
      ['A3', 'C#4', 'E4', 'A4'],
    ];
    const lead = [
      'E5 - - G#5 - B5 - - C#6 - - B5 - G#5 - -',
      'F#5 - - B5 - D#6 - - B5 - - F#5 - D#5 - -',
      'G#5 - - C#6 - E6 - - C#6 - - G#5 - E5 - -',
      'A4 - - C#5 - E5 - - A5 - - E5 - C#5 - -',
      'B5 - C#6 - E6 - D#6 - C#6 - B5 - G#5 - B5 -',
      'D#6 - - B5 - F#5 - - D#5 - - B4 - D#5 - -',
      'E6 - - C#6 - G#5 - - E5 - - C#5 - E5 - -',
      'A5 - - E5 - C#5 - - A4 - - E4 - A4 - -',
    ];
    const counter = [
      'B4 - G#4 - E4 - G#4 - B4 - E5 - D#5 - B4 -',
      'F#4 - D#4 - B3 - D#4 - F#4 - B4 - A4 - F#4 -',
      'G#4 - E4 - C#4 - E4 - G#4 - C#5 - B4 - G#4 -',
      'E4 - C#4 - A3 - C#4 - E4 - A4 - G#4 - E4 -',
      'G#5 - E5 - B4 - E5 - G#5 - B5 - A5 - G#5 -',
      'F#5 - D#5 - B4 - D#5 - F#5 - A5 - G#5 - F#5 -',
      'C#5 - G#4 - E4 - G#4 - C#5 - E5 - D#5 - C#5 -',
      'A4 - E4 - C#4 - E4 - A4 - C#5 - B4 - A4 -',
    ];
    songs.ending = {
      bpm: 88, stepsPerBar: 16, bars: 8, swing: 0.03,
      tracks: [
        { instrument: 'pad', gain: 0.03, reverb: 0.55, minIntensity: 0.05, patterns: chords.map((c, i) => padChord(c, steps, `ending pad ${i}`)), order: cycle(8, [0, 1, 2, 3]) },
        { instrument: 'bass', gain: 0.065, reverb: 0.2, minIntensity: 0.1, patterns: roots.map((r, i) => bassGen(r, '0...1...2...1...', `ending bass ${i}`)), order: cycle(8, [0, 1, 2, 3]) },
        { instrument: 'bell', gain: 0.027, reverb: 0.6, pan: 0.28, delay: 0.28, minIntensity: 0.25, patterns: arps.map((n, i) => arpGen(n, '0...2...1...3...', `ending bell ${i}`)), order: cycle(8, [0, 1, 2, 3]) },
        { instrument: 'lead', gain: 0.055, reverb: 0.42, pan: 0.06, delay: 0.3, minIntensity: 0.35, patterns: lead.map((s, i) => fit(s, 16, `ending lead ${i}`)), order: cycle(8, [0, 1, 2, 3, 4, 5, 6, 7]) },
        { instrument: 'lead2', gain: 0.024, reverb: 0.4, pan: -0.36, delay: 0.34, minIntensity: 0.7, patterns: counter.map((s, i) => fit(s, 16, `ending counter ${i}`)), order: cycle(8, [0, 1, 2, 3, 4, 5, 6, 7]) },
        { instrument: 'drums', gain: 0.05, minIntensity: 0.8, patterns: [fit(D.endA, 16, 'ending drums')], order: [0, 0, 0, 0, 0, 0, 0, 0] },
      ],
    };
  }

  PB.SONGS = songs;
})();
