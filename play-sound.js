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
})(window);
