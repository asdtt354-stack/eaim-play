/* ═══════════════════════════════════════════════════════════
   EAIM 연주실 — AI 연결 공용 모듈 (play-key.js)  v0.3 (2026-09-17)
   · Gemini 키를 브라우저에 두지 않습니다. 모든 AI 요청은 같은 주소의 서버 함수
     api/ai 로 보내고, 키는 Vercel 환경변수(GEMINI_KEY)에만 있습니다. (공통 규칙 6-1)
   · AI는 선생님 초대 링크(?teacher=UID)로 들어왔을 때만 켜집니다.
     서버가 그 선생님의 AI 켜기/끄기(meta/settings.mediaOn)를 확인합니다.
   · 심사·시연용 체험 링크(?demo=…)도 그대로 전달합니다.
   · 방 파일들이 쓰던 이름(get, has, gemini, lyria, NO_KEY_MSG …)은 그대로 둡니다.
     get() 은 이제 키가 아니라 "AI를 쓸 수 있으면 'relay', 아니면 ''" 을 돌려줍니다.
   ═══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  const FB_KEY = 'AIzaSyBalg0f5x0ydfHxn_nzgZ1pAELvJw6PzoY', PROJECT = 'eaim-classroom'; // Firebase 웹 설정값(공개) — 수업 상황 신호용
  const AI_URL = 'api/ai';   // 상대 경로 (공통 규칙 10-1)
  const P = new URLSearchParams(location.search);
  const teacher = P.get('teacher') || '';
  const demo = P.get('demo') || '';   // 심사·시연용 체험 링크 (2026-09-17)

  /* ── 예전 방식으로 이 기기에 남아 있던 키 지우기 (더 이상 쓰지 않음) ── */
  try { localStorage.removeItem('eaim_play_api'); sessionStorage.removeItem('eaim_play_api_session'); } catch {}

  /* ── AI 사용 가능 여부 (서버에 물어보고 1분 기억) ── */
  let reason = (teacher || demo) ? 'AI 연결을 확인하는 중이에요. 잠시 뒤 다시 눌러 주세요.' : 'AI 기능은 선생님이 준 초대 링크(QR)로 들어왔을 때 쓸 수 있어요.';
  let statusCache = null, statusAt = 0;
  async function status() {
    if (!teacher && !demo) return { ok: false, reason };
    if (statusCache && Date.now() - statusAt < 60000) return statusCache;
    try {
      const r = await fetch(`${AI_URL}?action=ping&teacher=${encodeURIComponent(teacher)}${demo ? '&demo=' + encodeURIComponent(demo) : ''}`, { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      statusCache = r.ok ? { ok: !!d.ok, reason: d.reason || '' } : { ok: false, reason: r.status === 404 ? 'AI 서버 함수(api/ai)가 아직 배포되지 않았어요.' : 'AI 서버 응답 오류 ' + r.status };
    } catch { statusCache = { ok: false, reason: 'AI 서버에 연결하지 못했어요. 인터넷을 확인해 주세요.' }; }
    statusAt = Date.now();
    if (!statusCache.ok) reason = statusCache.reason;
    return statusCache;
  }
  async function get() { return (await status()).ok ? 'relay' : ''; }
  function set() { /* 키는 이제 서버에만 둡니다 — 기기에 저장하지 않음 */ }
  function has() { return !!(teacher || demo); }
  /** 다른 방으로 갈 때 ?teacher= 를 그대로 붙여줌 */
  function link(href) { if (!teacher && !demo) return href; const g = P.get('group'); const q = [teacher ? 'teacher=' + encodeURIComponent(teacher) : '', g ? 'group=' + encodeURIComponent(g) : '', demo ? 'demo=' + encodeURIComponent(demo) : ''].filter(Boolean).join('&'); return href + (href.includes('?') ? '&' : '?') + q; }

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

  /** 서버 함수로 보내기 → Gemini 원래 응답 JSON */
  function relay(model, contents, generationConfig) {
    return fetch(AI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacher, demo, model, contents, generationConfig }) });
  }
  async function failMsg(r, busyMsg) {
    const e = await r.json().catch(() => ({}));
    const m = e?.error?.message || '';
    if (r.status === 404 && !m) return 'AI 서버 함수(api/ai)가 아직 배포되지 않았어요.';
    if (r.status === 403 || r.status === 413) { statusCache = null; return m || 'AI를 쓸 수 없는 상태예요.'; }
    if (r.status === 429) return m || busyMsg;
    return m || ('오류 ' + r.status);
  }
  async function ready() { const s = await status(); if (!s.ok) throw new Error(s.reason || reason); }

  /** 공용 Gemini 텍스트 호출 (JSON 모드 옵션) */
  async function gemini(prompt, { json = false, temperature = .7, maxTokens = 1024, parts = null } = {}) {
    await ready();
    const contents = [{ parts: parts || [{ text: prompt }] }];
    const gc = { temperature, maxOutputTokens: maxTokens };
    if (json) gc.responseMimeType = 'application/json';
    return queued(async () => {
      const r = await withRetry(() => relay('text', contents, gc), waitMsg);
      if (!r.ok) throw new Error(await failMsg(r, '지금 요청이 너무 많아요. 30초쯤 뒤에 다시 눌러주세요.'));
      const d = await r.json(); const txt = d.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      if (!json) return txt.trim();
      try { return safeJSON(txt); }
      catch (e) {
        // 한 번 더: 답을 JSON 으로만 고쳐 달라고
        const fix = [{ parts: [{ text: '다음 텍스트를 올바른 JSON 하나로만 고쳐서 출력하세요. 숫자 자리에는 숫자만(예: 4/4는 4), 설명·코드펜스 금지.\n\n' + txt }] }];
        const r2 = await relay('text', fix, { temperature: 0, maxOutputTokens: maxTokens, responseMimeType: 'application/json' });
        const d2 = await r2.json().catch(() => ({})); const t2 = d2.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
        try { return safeJSON(t2); } catch { throw new Error('AI 답을 읽지 못했어요. 한 번 더 눌러보세요.'); }
      }
    });
  }
  /** Lyria 30초 클립 → { b64, mime, text } */
  async function lyria(prompt, full = false) {
    await ready();
    return queued(async () => {
      const r = await withRetry(() => relay(full ? 'music-full' : 'music', [{ parts: [{ text: prompt }] }]), waitMsg);
      if (!r.ok) throw new Error(await failMsg(r, '노래 생성 요청이 몰려 있어요. 1분쯤 뒤에 다시 눌러주세요.'));
      const d = await r.json(); const ps = d.candidates?.[0]?.content?.parts || [];
      const a = ps.find(p => p.inlineData); if (!a) throw new Error('노래가 나오지 않았어요. 문장을 조금 바꿔보세요.');
      return { b64: a.inlineData.data, mime: a.inlineData.mimeType || 'audio/mpeg', text: ps.filter(p => p.text).map(p => p.text).join('\n') };
    });
  }
  /* ── 수업 상황 신호: 학생이 어느 방 몇 단계인지 (초대 링크로 들어온 경우만) ──
     ※ 문서 ID가 이름+모둠인 점은 기록 통일 단계(반+번호)에서 바꿀 예정 — 이번에는 그대로 둠 */
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
    let canvas;
    if (isPdf) {
      const pdfjs = await loadPdfjs();
      const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
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
    return { mime: 'image/jpeg', b64: dataUrl.split(',')[1], dataUrl, isPdf };
  }

  global.EAIMKey = { fileToImage, get, set, has, link, gemini, lyria, queued, withRetry, teacher, group: P.get('group') || '', ping, status };
  // 방 파일들이 쓰는 안내 문구 — 지금 AI를 못 쓰는 실제 이유를 보여줌 (규칙 6-3: 원인에 맞는 실패 문구)
  Object.defineProperty(global.EAIMKey, 'NO_KEY_MSG', { get: () => reason, enumerable: true });
  if (teacher || demo) status();   // 미리 확인해 두기
})(window);
