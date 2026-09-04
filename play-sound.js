/* ═══════════════════════════════════════════════════════════
   EAIM 연주실 — 진짜 악기 소리 (play-sound.js)
   FluidR3 GM 사운드폰트(공개, CDN)의 악기 녹음을 불러와 연주합니다.
   · SampleKit  : 기존 Web Audio(AudioContext) 앱용 (합주실·작곡실)
   · toneSampler: Tone.js 앱용 (건반실)
   샘플을 못 받으면 각 앱은 원래의 합성음으로 자동 대체합니다.
   ═══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const CDN = 'https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@gh-pages/FluidR3_GM/';
  const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const SHARP = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };
  const midi = (n) => { const m = String(n).match(/^([A-G])([#b]?)(-?\d)$/); if (!m) return null; let i = NAMES.indexOf(m[1] + (m[2] === '#' ? '' : m[2])); if (m[2] === '#') i = NAMES.indexOf(SHARP[m[1] + '#']); return 12 * (Number(m[3]) + 1) + i; };
  const nameOf = (mi) => NAMES[mi % 12] + (Math.floor(mi / 12) - 1);
  const url = (inst, mi) => `${CDN}${inst}-mp3/${nameOf(mi)}.mp3`;

  // GM 악기 이름 (자주 쓰는 것만)
  const INSTRUMENTS = {
    piano: 'acoustic_grand_piano', epiano: 'electric_piano_1', harpsichord: 'harpsichord',
    xylophone: 'xylophone', marimba: 'marimba', vibraphone: 'vibraphone', bell: 'tubular_bells', celesta: 'celesta',
    guitar: 'acoustic_guitar_steel', nylon: 'acoustic_guitar_nylon', eguitar: 'electric_guitar_clean', bass: 'acoustic_bass', ebass: 'electric_bass_finger',
    violin: 'violin', viola: 'viola', cello: 'cello', strings: 'string_ensemble_1',
    flute: 'flute', clarinet: 'clarinet', oboe: 'oboe', bassoon: 'bassoon', sax: 'alto_sax', recorder: 'recorder',
    trumpet: 'trumpet', horn: 'french_horn', trombone: 'trombone', brass: 'brass_section',
    choir: 'choir_aahs', synth: 'lead_2_sawtooth', pad: 'pad_2_warm', organ: 'church_organ',
  };
  const gm = (k) => INSTRUMENTS[k] || k;

  /* ── Web Audio용 ── */
  class SampleKit {
    constructor(ctx, inst, { low = 36, high = 96, step = 3 } = {}) {
      this.ctx = ctx; this.inst = gm(inst); this.buffers = {}; this.ready = false; this.failed = false;
      this.bases = []; for (let m = low; m <= high; m += step) this.bases.push(m);
    }
    async load(onProgress) {
      let ok = 0;
      await Promise.all(this.bases.map(async (m) => {
        try { const r = await fetch(url(this.inst, m)); if (!r.ok) throw 0; const ab = await r.arrayBuffer(); this.buffers[m] = await this.ctx.decodeAudioData(ab); ok++; onProgress && onProgress(ok, this.bases.length); }
        catch { /* 일부 음 실패는 무시 */ }
      }));
      this.ready = ok > 0; this.failed = !this.ready; return this.ready;
    }
    nearest(mi) { let best = null, d = 1e9; for (const b in this.buffers) { const dd = Math.abs(b - mi); if (dd < d) { d = dd; best = Number(b); } } return best; }
    /** note: 'C4' 또는 MIDI 번호 또는 주파수(Hz). time: ctx 시각. dur: 초. dest: 출력 노드. gain: 0~1 */
    play(note, time, dur, dest, gain = 0.8, opts = {}) {
      if (!this.ready) return null;
      let mi = typeof note === 'number' ? (note > 127 ? Math.round(69 + 12 * Math.log2(note / 440)) : note) : midi(note);
      if (mi == null) return null;
      const base = this.nearest(mi); if (base == null) return null;
      const src = this.ctx.createBufferSource(); src.buffer = this.buffers[base];
      src.playbackRate.value = Math.pow(2, (mi - base) / 12);
      const g = this.ctx.createGain(); const t = time ?? this.ctx.currentTime;
      const a = opts.attack ?? 0.005, rel = opts.release ?? 0.25, d = Math.max(0.05, dur || 0.5);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + a);
      g.gain.setValueAtTime(gain, t + d); g.gain.linearRampToValueAtTime(0.0001, t + d + rel);
      src.connect(g); g.connect(dest || this.ctx.destination);
      src.start(t); src.stop(t + d + rel + 0.05);
      return { src, gain: g, stop: (when) => { const w = when ?? this.ctx.currentTime; g.gain.cancelScheduledValues(w); g.gain.setValueAtTime(g.gain.value, w); g.gain.linearRampToValueAtTime(0.0001, w + rel); try { src.stop(w + rel + 0.05); } catch {} } };
    }
  }

  /* ── Tone.js용 ── */
  function toneSampler(inst, { low = 36, high = 96, step = 3, release = 1, onload, onerror } = {}) {
    if (!global.Tone) throw new Error('Tone.js가 필요해요');
    const urls = {}; for (let m = low; m <= high; m += step) urls[nameOf(m)] = `${nameOf(m)}.mp3`;
    // onload/onerror는 생성자 옵션으로만 동작함 (나중에 .onload = 를 붙여도 호출되지 않음)
    return new global.Tone.Sampler({ urls, baseUrl: `${CDN}${gm(inst)}-mp3/`, release, onload, onerror });
  }

  global.EAIMSound = { SampleKit, toneSampler, INSTRUMENTS, midi, nameOf, CDN };

  /* ═══ 코드 이론 (요즘 팝·K-pop 코드까지) ═══ */
  const PC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const FLAT = { 'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B','Fb':'E' };
  const QUAL = {
    '':[0,4,7], 'maj':[0,4,7], 'm':[0,3,7], 'min':[0,3,7], '-':[0,3,7],
    '7':[0,4,7,10], 'maj7':[0,4,7,11], 'm7':[0,3,7,10], 'mmaj7':[0,3,7,11],
    'sus2':[0,2,7], 'sus4':[0,5,7], 'sus':[0,5,7], '7sus4':[0,5,7,10], '9sus4':[0,5,7,10,14],
    'add9':[0,4,7,14], 'add2':[0,4,7,14], 'madd9':[0,3,7,14], 'add4':[0,4,5,7], 'add11':[0,4,7,17],
    '2':[0,4,7,14], 'sus2sus4':[0,2,5,7], 'add2sus4':[0,2,5,7],
    '9':[0,4,7,10,14], 'm9':[0,3,7,10,14], 'maj9':[0,4,7,11,14], 'add9maj7':[0,4,7,11,14],
    '6':[0,4,7,9], 'm6':[0,3,7,9], '69':[0,4,7,9,14], '6/9':[0,4,7,9,14],
    'dim':[0,3,6], 'dim7':[0,3,6,9], 'm7b5':[0,3,6,10], 'ø':[0,3,6,10], 'aug':[0,4,8], '+':[0,4,8],
    '7b9':[0,4,7,10,13], '11':[0,4,7,10,14,17], '13':[0,4,7,10,14,21],
  };
  function parseChord(tok) {
    if (!tok) return null;
    let t = String(tok).trim().replace(/[()]/g,'').replace(/△|Δ/g,'maj7').replace(/°/g,'dim');
    const m = t.match(/^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/);
    if (!m) return null;
    const norm = (r) => { r = r[0].toUpperCase() + (r[1] || ''); return FLAT[r] || r; };
    const root = norm(m[1]); if (!PC.includes(root)) return null;
    let q = (m[2] || '').replace(/M7/g,'maj7').replace(/Maj/g,'maj').replace(/MAJ/g,'maj').replace(/mi(?=n?7|n?$)/,'m').replace(/min/,'m');
    if (!(q in QUAL)) { q = q.toLowerCase(); if (!(q in QUAL)) { const base = q.replace(/[^a-z0-9#+ø]/g,''); if (!(base in QUAL)) return null; q = base; } }
    const bass = m[3] ? norm(m[3]) : null;
    const iv = QUAL[q];
    const type = iv[1] === 3 ? 'm' : (iv.includes(10) ? '7' : '');   // 옛 앱 호환용 단순 분류
    return { root, quality: q, intervals: iv, bass, type, name: root + q + (bass ? '/' + bass : '') };
  }
  const pcOf = (root, iv) => PC[(PC.indexOf(root) + iv) % 12];
  const tones = (c) => c.intervals.map(i => pcOf(c.root, i));
  /** 연주용 음 배열 (옥타브 포함). 9·11·13은 위 옥타브, 베이스는 따로 */
  function voicing(c, oct = 4) {
    const ri = PC.indexOf(c.root);
    return c.intervals.map(i => { const n = ri + i; return PC[n % 12] + (oct + Math.floor(n / 12)); });
  }
  const bassNote = (c, oct = 2) => (c.bass || c.root) + oct;
  /** 단순화: 트라이어드로 */
  const simplify = (c) => ({ ...c, quality: c.type === 'm' ? 'm' : '', intervals: c.type === 'm' ? [0,3,7] : [0,4,7], name: c.root + (c.type === 'm' ? 'm' : '') + (c.bass ? '/' + c.bass : '') });

  /* ═══ 반주 패턴 (박 단위 이벤트) — 요즘 팝 위주 ═══
     각 이벤트: { at: 박(0부터, 소수 가능), what: 'bass'|'chord'|'top'|'arp:i'|'stab', len: 박, vel: 0~1 } */
  const PATTERNS = {
    whole:   { name:'온음 (한 번)',        beats:4, ev:[{at:0,what:'bass',len:4,vel:.8},{at:0,what:'chord',len:4,vel:.6}] },
    beat4:   { name:'4비트',               beats:4, ev:[0,1,2,3].map(b=>({at:b,what:'chord',len:.5,vel:.6})) },
    beat8:   { name:'8비트',               beats:4, ev:[0,.5,1,1.5,2,2.5,3,3.5].map(b=>({at:b,what:'chord',len:.3,vel:b%1?.4:.6})) },
    ballad:  { name:'발라드 (쿵 짝짝짝)',   beats:4, ev:[{at:0,what:'bass',len:1,vel:.9},{at:1,what:'top',len:.8,vel:.55},{at:2,what:'top',len:.8,vel:.55},{at:3,what:'top',len:.8,vel:.55}] },
    kpop:    { name:'K-pop 발라드 아르페지오', beats:4, ev:[{at:0,what:'bass',len:4,vel:.8},{at:0,what:'arp:0',len:.6,vel:.6},{at:.5,what:'arp:2',len:.6,vel:.5},{at:1,what:'arp:top',len:.6,vel:.55},{at:1.5,what:'arp:2',len:.6,vel:.45},{at:2,what:'arp:1',len:.6,vel:.5},{at:2.5,what:'arp:2',len:.6,vel:.45},{at:3,what:'arp:top',len:.6,vel:.55},{at:3.5,what:'arp:2',len:.6,vel:.45}] },
    pop16:   { name:'16비트 팝 (싱커페이션)', beats:4, ev:[{at:0,what:'bass',len:1.5,vel:.9},{at:0,what:'chord',len:1.2,vel:.65},{at:1.5,what:'chord',len:.4,vel:.5},{at:2,what:'bass',len:1.5,vel:.9},{at:2,what:'chord',len:.9,vel:.6},{at:2.75,what:'stab',len:.25,vel:.45},{at:3.5,what:'chord',len:.5,vel:.55},{at:3.5,what:'bass',len:.5,vel:.8}] },
    rnb:     { name:'R&B 그루브',           beats:4, ev:[{at:0,what:'bass',len:1,vel:.9},{at:0,what:'chord',len:.6,vel:.6},{at:1.5,what:'stab',len:.3,vel:.45},{at:2.5,what:'bass',len:.5,vel:.8},{at:2.5,what:'chord',len:.9,vel:.6},{at:3.75,what:'stab',len:.25,vel:.4}] },
    dance:   { name:'댄스 (4온더플로어)',    beats:4, ev:[{at:0,what:'bass',len:.5,vel:.9},{at:1,what:'bass',len:.5,vel:.9},{at:2,what:'bass',len:.5,vel:.9},{at:3,what:'bass',len:.5,vel:.9},{at:.5,what:'stab',len:.3,vel:.55},{at:1.5,what:'stab',len:.3,vel:.55},{at:2.5,what:'stab',len:.3,vel:.55},{at:3.5,what:'stab',len:.3,vel:.55}] },
    synth:   { name:'신스팝 (패드 + 스탭)',   beats:4, ev:[{at:0,what:'chord',len:4,vel:.35},{at:0,what:'bass',len:.75,vel:.9},{at:.75,what:'bass',len:.5,vel:.7},{at:1.5,what:'bass',len:.5,vel:.9},{at:2.5,what:'bass',len:.5,vel:.9},{at:3.25,what:'bass',len:.5,vel:.7},{at:1.5,what:'stab',len:.3,vel:.5},{at:3.5,what:'stab',len:.3,vel:.5}] },
    waltz:   { name:'왈츠 3박',             beats:3, ev:[{at:0,what:'bass',len:1,vel:.9},{at:1,what:'top',len:.8,vel:.55},{at:2,what:'top',len:.8,vel:.55}] },
  };
  /** 패턴 이벤트를 실제 음으로 풀기. play(notesArray, atBeat, lenBeat, vel) 콜백 */
  function renderPattern(patKey, c, play, beats) {
    const P = PATTERNS[patKey] || PATTERNS.beat4;
    const v = voicing(c, 4), top = v.slice(1), bass = bassNote(c, 2), bassHi = bassNote(c, 3);
    const stab = v.length >= 4 ? v.slice(1) : v;                     // 텐션 있는 코드는 3음 이상 위 성부만
    const arpSet = v.length >= 4 ? [bassHi, v[1], v[2], v[3]] : [bassHi, v[1], v[2], v[0].replace(/\d/, m => +m + 1)];
    const nb = beats || P.beats;
    P.ev.forEach(e => {
      if (e.at >= nb) return;
      if (e.what === 'bass') play([bass], e.at, e.len, e.vel);
      else if (e.what === 'chord') play(v, e.at, e.len, e.vel);
      else if (e.what === 'top') play(top, e.at, e.len, e.vel);
      else if (e.what === 'stab') play(stab, e.at, e.len, e.vel);
      else if (e.what.startsWith('arp:')) { const k = e.what.slice(4); play([k === 'top' ? arpSet[3] : arpSet[+k]], e.at, e.len, e.vel); }
    });
  }
  global.EAIMChord = { parse: parseChord, tones, voicing, bassNote, simplify, PATTERNS, renderPattern, PC, QUAL };
})(window);
