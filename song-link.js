/* ═══════════════════════════════════════════════════════════
   EAIM 연주실 — 곡 링크 (song-link.js)  v0.1 (2026-09-17)
   · 관리자 서랍(library.html)이 곡을 링크로 만들고, 밴드실(band-room.html)이 링크를 풀어 채웁니다.
   · 담는 것: 제목 · 코드 · 빠르기 · 박자 · 반주 스타일 · 기타 스트로크 · 신디 음색
     담지 않는 것: 악보 사진 · 가사 · 멜로디 (저작권 부담을 줄이기 위해)
   · 곡 정보는 주소의 # 뒤에 들어가서 서버로 전송되지 않습니다.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  const STYLES = { kpop: 'K-pop 발라드', pop16: '16비트 팝', rnb: 'R&B', dance: '댄스', synth: '신스팝', ballad: '발라드 기본', beat8: '8비트 록', waltz: '왈츠 3박' };
  const SYNTH_TONES = { auto: '자동 (스타일에 맞게)', pad: '따뜻한 패드', strings: '스트링', brass: '브라스', epiano: '일렉피아노', lead: '리드 (톱니파)' };

  const b64u = {
    enc(bytes) { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
    dec(str) { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; const bin = atob(str); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; },
  };
  async function pipe(bytes, stream) { const r = new Response(new Blob([bytes]).stream().pipeThrough(stream)); return new Uint8Array(await r.arrayBuffer()); }

  function pack(song) {
    const o = { v: 1, t: song.title || '', c: song.chords || '' };
    if (song.bpm) o.b = Number(song.bpm);
    if (song.beats) o.m = Number(song.beats);
    if (song.style) o.s = song.style;
    if (Array.isArray(song.strum) && song.strum.some(Boolean)) o.st = song.strum.map(x => x === '↓' ? 'D' : x === '↑' ? 'U' : '-').join('');
    if (o.st && song.strumSrc) o.ss = song.strumSrc;
    if (song.synthTone && song.synthTone !== 'auto') o.sy = song.synthTone;
    return o;
  }
  function unpack(o) {
    if (!o || o.v !== 1 || typeof o.c !== 'string') throw new Error('곡 링크 형식이 아니에요');
    return {
      title: String(o.t || '').slice(0, 80),
      chords: o.c.slice(0, 4000),
      bpm: Math.max(40, Math.min(220, Number(o.b) || 90)),
      beats: [2, 3, 4, 6].includes(Number(o.m)) ? Number(o.m) : 4,
      style: STYLES[o.s] ? o.s : '',
      strum: typeof o.st === 'string' ? [...o.st.slice(0, 24)].map(x => x === 'D' ? '↓' : x === 'U' ? '↑' : '') : null,
      strumSrc: ['written', 'rhythm', 'manual'].includes(o.ss) ? o.ss : '',
      synthTone: SYNTH_TONES[o.sy] ? o.sy : 'auto',
    };
  }
  async function encode(song) {
    // 오래된 태블릿·카톡 안 브라우저에서도 열리도록 압축하지 않은 형식(j)으로 만듦. 압축 형식(z)은 읽기만 지원
    const bytes = new TextEncoder().encode(JSON.stringify(pack(song)));
    return 'j' + b64u.enc(bytes);
  }
  async function decode(code) {
    const kind = code[0], body = b64u.dec(code.slice(1));
    let bytes = body;
    if (kind === 'z') {
      if (!g.DecompressionStream) throw new Error('이 브라우저는 곡 링크를 열 수 없어요. 크롬이나 최신 사파리로 열어 주세요');
      bytes = await pipe(body, new DecompressionStream('deflate-raw'));
    } else if (kind !== 'j') throw new Error('곡 링크 형식이 아니에요');
    return unpack(JSON.parse(new TextDecoder().decode(bytes)));
  }
  async function link(song, base) { return base + '#song=' + await encode(song); }
  function fromHash(h) { const m = String(h || '').match(/[#&]song=([A-Za-z0-9_-]+)/); return m ? m[1] : null; }

  g.EAIMSongLink = { encode, decode, link, fromHash, pack, unpack, STYLES, SYNTH_TONES, DRAWER_KEY: 'eaim_band_library', DEVICE_KEY: 'eaim_admin_drawer' };
})(window);
