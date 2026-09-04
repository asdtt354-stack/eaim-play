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

  /** 공용 Gemini 텍스트 호출 (JSON 모드 옵션) */
  async function gemini(prompt, { json = false, temperature = .7, maxTokens = 1024, parts = null } = {}) {
    const k = await get(); if (!k) throw new Error(NO_KEY_MSG);
    const body = { contents: [{ parts: parts || [{ text: prompt }] }], generationConfig: { temperature, maxOutputTokens: maxTokens } };
    if (json) body.generationConfig.responseMimeType = 'application/json';
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k }, body: JSON.stringify(body) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.error?.message || ('오류 ' + r.status)); }
    const d = await r.json(); const txt = d.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    return json ? JSON.parse(txt.replace(/```json|```/g, '').trim()) : txt.trim();
  }
  /** Lyria 30초 클립 → { b64, mime, text } */
  async function lyria(prompt, full = false) {
    const k = await get(); if (!k) throw new Error(NO_KEY_MSG);
    const model = full ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.error?.message || ('오류 ' + r.status)); }
    const d = await r.json(); const ps = d.candidates?.[0]?.content?.parts || [];
    const a = ps.find(p => p.inlineData); if (!a) throw new Error('노래가 나오지 않았어요. 문장을 조금 바꿔보세요.');
    return { b64: a.inlineData.data, mime: a.inlineData.mimeType || 'audio/mpeg', text: ps.filter(p => p.text).map(p => p.text).join('\n') };
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
  global.EAIMKey = { get, set, has, link, gemini, lyria, teacher, group: P.get('group') || '', ping, NO_KEY_MSG };
})(window);
