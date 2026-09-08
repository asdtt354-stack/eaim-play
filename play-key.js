/* ═══════════════════════════════════════════════════════════
   EAIM 연주실 — Gemini 키 찾기 (play-key.js)
   연주실은 뮤지컬메이커와 주소가 달라서 그쪽 키를 못 봅니다.
   순서대로 찾아요:
   1) 이 기기에 선생님이 저장한 키 (연주실 대문 → 선생님 설정)
   2) 뮤지컬메이커가 같은 주소에 남긴 키 (같은 저장소에 둘 때)
   3) 주소에 ?teacher=UID 가 있으면 Firestore 설정에서 읽기 (초대 링크)
   ═══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const FB_KEY = 'AIzaSyBalg0f5x0ydfHxn_nzgZ1pAELvJw6PzoY', PROJECT = 'eaim-classroom';
  const P = new URLSearchParams(location.search);
  const teacher = P.get('teacher') || '';
  let cache = null;

  async function fromFirestore(uid) {
    try {
      const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/teachers/${uid}/meta/settings?key=${FB_KEY}`);
      if (!r.ok) return '';
      const d = await r.json();
      const on = d.fields?.mediaOn?.booleanValue; if (on === false) return '';
      return d.fields?.apiKey?.stringValue || '';
    } catch { return ''; }
  }
  async function get() {
    if (cache) return cache;
    const local = (localStorage.getItem('eaim_play_api') || localStorage.getItem('mm_teacher_api') || '').trim();
    if (local) return (cache = local);
    if (teacher) { const k = await fromFirestore(teacher); if (k) { sessionStorage.setItem('eaim_play_api_session', k); return (cache = k); } }
    const ss = sessionStorage.getItem('eaim_play_api_session'); if (ss) return (cache = ss);
    return '';
  }
  function set(k) { k = (k || '').trim(); if (k) localStorage.setItem('eaim_play_api', k); else localStorage.removeItem('eaim_play_api'); cache = null; }
  function has() { return !!((localStorage.getItem('eaim_play_api') || localStorage.getItem('mm_teacher_api') || sessionStorage.getItem('eaim_play_api_session') || '').trim()) || !!teacher; }
  /** 다른 방으로 갈 때 ?teacher= 를 그대로 붙여줌 */
  function link(href) { if (!teacher) return href; const g = P.get('group'); return href + (href.includes('?') ? '&' : '?') + 'teacher=' + encodeURIComponent(teacher) + (g ? '&group=' + encodeURIComponent(g) : ''); }
  const NO_KEY_MSG = 'AI 기능을 쓰려면 Gemini 키가 필요해요. 연주실 대문의 "선생님 설정"에서 한 번 넣어두거나, 선생님이 준 초대 링크(?teacher=…)로 들어오세요.';

  /* ── 줄 서기 + 재시도: 같은 기기에서 동시에 여러 요청이 나가지 않게, 429/503이면 기다렸다 다시 ── */
  let chain = Promise.resolve();
  function queued(fn) { const run = chain.then(fn, fn); chain = run.catch(() => {}); return run; }
  async function withRetry(doFetch, onWait) {
    const delays = [2000, 4000, 8000, 15000];
    for (let i = 0; ; i++) {
      const r = await doFetch();
      if (r.ok) return r;
      if ((r.status === 429 || r.status === 503 || r.status === 500) && i < delays.length) {
        const ra = Number(r.headers.get('retry-after')) * 1000;
        const wait = ra > 0 ? Math.min(ra, 30000) : delays[i];
        onWait && onWait(Math.round(wait / 1000), i + 1);
        await new Promise(res => setTimeout(res, wait));
        continue;
      }
      return r;
    }
  }
  const waitMsg = (sec, n) => { try { const t = document.getElementById('toast'); if (t) { t.textContent = `⏳ 요청이 몰려서 ${sec}초 기다렸다 다시 보내요 (${n}번째)`; t.style.display = 'block'; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = 'none', sec * 1000); } } catch {} };

  /** 깨진 JSON 살리기: 4/4 같은 값, 코드펜스, 앞뒤 잡글, 끝 쉼표 */
  function safeJSON(txt) {
    let t = String(txt || '').replace(/```json|```/g, '').trim();
    try { return JSON.parse(t); } catch {}
    const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) t = t.slice(a, b + 1);
    t = t.replace(/:\s*(\d+)\s*\/\s*(\d+)/g, (m, x) => ': ' + x)      // "beats": 4/4 → 4
         .replace(/,\s*([}\]])/g, '$1')                                  // 끝 쉼표
         .replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'"); // 예쁜 따옴표
    try { return JSON.parse(t); } catch {}
    // 값 안의 큰따옴표를 작은따옴표로 (문자열 내부 " 만)
    t = t.replace(/"([^"\n]*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g, (m, k, v) => `"${k}": "${v.replace(/"/g, "'")}"`);
    return JSON.parse(t);
  }

  /** 공용 Gemini 텍스트 호출 (JSON 모드 옵션) */
  async function gemini(prompt, { json = false, temperature = .7, maxTokens = 1024, parts = null } = {}) {
    const k = await get(); if (!k) throw new Error(NO_KEY_MSG);
    const body = { contents: [{ parts: parts || [{ text: prompt }] }], generationConfig: { temperature, maxOutputTokens: maxTokens } };
    if (json) body.generationConfig.responseMimeType = 'application/json';
    return queued(async () => {
      const r = await withRetry(() => fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k }, body: JSON.stringify(body) }), waitMsg);
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(r.status === 429 ? '지금 요청이 너무 많아요. 30초쯤 뒤에 다시 눌러주세요.' : (e?.error?.message || ('오류 ' + r.status))); }
      const d = await r.json(); const txt = d.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      if (!json) return txt.trim();
      try { return safeJSON(txt); }
      catch (e) {
        // 한 번 더: 답을 JSON 으로만 고쳐 달라고
        const fix = { contents: [{ parts: [{ text: '다음 텍스트를 올바른 JSON 하나로만 고쳐서 출력하세요. 숫자 자리에는 숫자만(예: 4/4는 4), 설명·코드펜스 금지.\n\n' + txt }] }], generationConfig: { temperature: 0, maxOutputTokens: maxTokens, responseMimeType: 'application/json' } };
        const r2 = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k }, body: JSON.stringify(fix) });
        const d2 = await r2.json().catch(() => ({})); const t2 = d2.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
        try { return safeJSON(t2); } catch { throw new Error('AI 답을 읽지 못했어요. 한 번 더 눌러보세요.'); }
      }
    });
  }
  /** Lyria 30초 클립 → { b64, mime, text } */
  async function lyria(prompt, full = false) {
    const k = await get(); if (!k) throw new Error(NO_KEY_MSG);
    const model = full ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';
    return queued(async () => {
      const r = await withRetry(() => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }), waitMsg);
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(r.status === 429 ? '노래 생성 요청이 몰려 있어요. 1분쯤 뒤에 다시 눌러주세요.' : (e?.error?.message || ('오류 ' + r.status))); }
      const d = await r.json(); const ps = d.candidates?.[0]?.content?.parts || [];
      const a = ps.find(p => p.inlineData); if (!a) throw new Error('노래가 나오지 않았어요. 문장을 조금 바꿔보세요.');
      return { b64: a.inlineData.data, mime: a.inlineData.mimeType || 'audio/mpeg', text: ps.filter(p => p.text).map(p => p.text).join('\n') };
    });
  }
  /* ── 수업 상황 신호: 학생이 어느 방 몇 단계인지 (초대 링크로 들어온 경우만) ── */
  let lastPing = 0;
  async function ping(room, step, extra = {}) {
    if (!teacher) return;
    const name = (localStorage.getItem('eaim_jam_name') || '').trim(); if (!name) return;
    const now = Date.now(); if (now - lastPing < 15000 && !extra.force) return; lastPing = now;
    const group = P.get('group') || '';
    const id = encodeURIComponent(name.replace(/[\/\s]/g, '_') + (group ? '@' + group.replace(/[\/\s]/g, '_') : ''));
    const fields = { name: { stringValue: name }, group: { stringValue: group }, room: { stringValue: room }, step: { stringValue: String(step) }, ts: { integerValue: String(now) } };
    try { await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/teachers/${teacher}/presence/${id}?key=${FB_KEY}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) }); } catch {}
  }
  /* ── 파일(사진·PDF) → Gemini에 보낼 이미지 base64. PDF는 pdf.js로 첫 페이지를 그려서, 큰 사진은 1600px로 줄여서 ── */
  let pdfjsReady = null;
  function loadPdfjs() {
    if (pdfjsReady) return pdfjsReady;
    pdfjsReady = new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'; sc.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; res(window.pdfjsLib); }; sc.onerror = () => rej(new Error('PDF 도구를 불러오지 못했어요 (인터넷 확인)')); document.head.appendChild(sc); });
    return pdfjsReady;
  }
  async function fileToImage(file, { maxSide = 1600, page = 1 } = {}) {
    const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
    let canvas, pageCount = 1;
    if (isPdf) {
      const pdfjs = await loadPdfjs();
      const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      pageCount = doc.numPages;
      const pg = await doc.getPage(Math.min(page, doc.numPages));
      const v0 = pg.getViewport({ scale: 1 }); const scale = Math.min(2, maxSide / Math.max(v0.width, v0.height));
      const vp = pg.getViewport({ scale }); canvas = document.createElement('canvas'); canvas.width = vp.width; canvas.height = vp.height;
      const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
      await pg.render({ canvasContext: g, viewport: vp }).promise;
    } else {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('이미지를 읽지 못했어요')); i.src = URL.createObjectURL(file); });
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      canvas = document.createElement('canvas'); canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    const dataUrl = canvas.toDataURL('image/jpeg', .9);
    return { mime: 'image/jpeg', b64: dataUrl.split(',')[1], dataUrl, isPdf, pageCount };
  }
  /** 파일 → 이미지 여러 장 (PDF는 앞에서부터 maxPages 쪽까지). 배열에 pageTotal 을 달아 줍니다. */
  async function fileToImages(file, { maxSide = 1600, maxPages = 4 } = {}) {
    const first = await fileToImage(file, { maxSide, page: 1 });
    const out = [first];
    const total = first.pageCount || 1;
    for (let p = 2; p <= Math.min(total, maxPages); p++) {
      try { out.push(await fileToImage(file, { maxSide, page: p })); } catch { break; }
    }
    out.pageTotal = total;
    return out;
  }

  global.EAIMKey = { fileToImage, fileToImages, get, set, has, link, gemini, lyria, queued, withRetry, teacher, group: P.get('group') || '', ping, NO_KEY_MSG };
})(window);
