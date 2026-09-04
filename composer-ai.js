/* ═══════════════════════════════════════════════════════════
   EAIM 작곡실 — AI 애드온 (composer-ai.js)
   · ✨ AI 동기 제안: 이야기·감정·리듬을 읽고 4박(또는 3박) 멜로디 씨앗을 제안
   · 🤔 탐구 질문: 학생 이야기에 맞춘 질문 + 답변 피드백
   · 🎵 노래로 만들기: 이야기를 가사로, 멜로디 특징을 살려 Lyria 30초
   composer.html 의 </body> 앞에 play-key.js 다음으로 넣습니다.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.EAIMKey) return;
  const $ = (id) => document.getElementById(id);
  const css = document.createElement('style');
  css.textContent = `
  .ai-btn{background:linear-gradient(135deg,#6C5CE7,#a29bfe);color:#fff;border:none;padding:8px 14px;border-radius:20px;font-family:'Jua';cursor:pointer;font-size:.95em}
  .ai-btn:disabled{opacity:.5;cursor:wait}
  .ai-box{background:#f0f0ff;border:2px dashed #6C5CE7;border-radius:12px;padding:12px;margin-top:10px;text-align:left;font-size:.95em;line-height:1.6;color:#2d3436;white-space:pre-wrap}
  .ai-st{font-size:.85em;color:#636e72;margin-top:6px}
  `;
  document.head.appendChild(css);
  const EMO = { happy:'기쁨', excited:'신남', surprised:'놀람', sad:'슬픔', lonely:'외로움', angry:'화남', scary:'무서움', dream:'신비', proud:'뿌듯', calm:'평온' };
  const NAMES = ['도','레','미','파','솔','라','시','도↑','레↑','미↑','파↑','솔↑'];

  /* ── ③ 작곡: AI 동기 제안 ── */
  function injectMotif() {
    const host = document.querySelector('#step-3 .note-len-opts'); if (!host || $('ai-motif')) return;
    const wrap = document.createElement('div'); wrap.style.cssText = 'text-align:center;margin:6px 0 10px';
    wrap.innerHTML = `<button class="ai-btn" id="ai-motif">✨ 내 이야기로 동기 제안받기</button><div class="ai-st" id="ai-motif-st" style="color:#dfe6e9"></div>`;
    host.parentNode.insertBefore(wrap, host);
    $('ai-motif').onclick = suggestMotif;
  }
  async function suggestMotif() {
    const st = $('ai-motif-st'), btn = $('ai-motif');
    btn.disabled = true; st.textContent = '이야기를 읽고 멜로디 씨앗을 떠올리는 중…';
    try {
      const beats = current.maxBeats;
      const d = await EAIMKey.gemini(`중학생이 작곡 수업에서 쓴 이야기와 감정으로 ${beats}박짜리 멜로디 동기(씨앗)를 하나 제안해 주세요.
사용 가능한 음: 다장조 도(0) 레(1) 미(2) 파(3) 솔(4) 라(5) 시(6) 도↑(7) 레↑(8) 미↑(9) 파↑(10) 솔↑(11). 숫자 인덱스로 답하세요.
음 길이(len)는 0.5(반박) 1(한박) 2(두박) 3(세박) 중에서, 합이 정확히 ${beats}이 되게.
감정에 맞는 방향성(예: 기쁨=상행·도약, 슬픔=하행·순차, 신비=파·시 활용)을 살리고, 2~6음으로.
JSON만: {"notes":[{"idx":0,"len":1},...],"why":"한 문장 설명(학생에게 말하듯)"}
감정: ${EMO[current.emo] || current.emo || '(없음)'}
이야기: ${current.text || '(없음)'}
리듬: ${current.rhythm || '(없음)'}`, { json: true, temperature: .9, maxTokens: 400 });
      const notes = (d.notes || []).filter(n => Number.isInteger(n.idx) && n.idx >= 0 && n.idx < 12);
      let sum = notes.reduce((a, n) => a + Number(n.len || 1), 0);
      if (!notes.length) throw new Error('제안이 비어 있어요. 다시 눌러보세요.');
      if (Math.abs(sum - beats) > .01) { // 길이 보정: 마지막 음으로 맞춤
        const last = notes[notes.length - 1]; last.len = Math.max(.5, Number(last.len || 1) + (beats - sum));
      }
      resetMelody();
      const LEN = { 0.5:'eighth', 1:'quarter', 2:'half', 3:'dotted' };
      notes.forEach(n => { const mode = LEN[Number(n.len)] || 'quarter'; setNoteLen(mode); addNote(scale[n.idx].f, n.idx); });
      st.textContent = `💡 ${d.why || ''}  (${notes.map(n => NAMES[n.idx]).join(' ')}) — 마음에 안 들면 🔄 다시 쓰기 후 직접 눌러 넣어도 돼요`;
    } catch (e) { st.textContent = '❌ ' + e.message; }
    finally { btn.disabled = false; }
  }

  /* ── ④ 탐구: 맞춤 질문 + 피드백 ── */
  const origRefresh = window.refreshQuestion;
  window.refreshQuestion = async function () {
    origRefresh && origRefresh();
    if (!(await EAIMKey.get())) return;               // 키 없으면 기존 질문 보따리 그대로
    const q = $('inquiry-q'); const prev = q.innerText; q.innerText = '이야기를 읽고 질문을 만드는 중…';
    try {
      const mel = current.melody.map(n => NAMES[n.idx]).join(' ');
      const t = await EAIMKey.gemini(`중학생이 방금 만든 짧은 음악에 대해 "정답이 없는 탐구 질문" 하나를 한국어로 만들어 주세요. 학생의 이야기 속 구체적 장면·감정과 멜로디의 특징(음의 오르내림, 리듬 변주)을 연결해서, 학생이 자기 선택을 돌아보게 하는 질문. 한 문장, 40자 내외, 질문만.
감정: ${EMO[current.emo] || ''} / 이야기: ${current.text || ''} / 리듬: ${current.rhythm || ''} / 멜로디: ${mel} / 변주: 리듬 ${current.rhythmVars.join(',')} 음높이 ${current.pitchVars.join(',')}`, { temperature: .9, maxTokens: 120 });
      q.innerText = t.replace(/^["“]|["”]$/g, '');
    } catch { q.innerText = prev; }
  };
  function injectFeedback() {
    const ta = $('inquiry-a'); if (!ta || $('ai-fb')) return;
    const wrap = document.createElement('div'); wrap.style.cssText = 'text-align:center;margin-top:8px';
    wrap.innerHTML = `<button class="ai-btn" id="ai-fb">💬 내 생각에 대해 한마디 듣기</button><div id="ai-fb-box" class="ai-box" style="display:none"></div>`;
    ta.parentNode.appendChild(wrap);
    $('ai-fb').onclick = async () => {
      const box = $('ai-fb-box'); const a = ta.value.trim();
      if (a.length < 10) { box.style.display = 'block'; box.textContent = '먼저 생각을 두세 문장 적어주세요.'; return; }
      box.style.display = 'block'; box.textContent = '읽는 중…';
      try {
        box.textContent = await EAIMKey.gemini(`음악 선생님으로서 중학생의 탐구 답변에 3문장 이내로 답해 주세요. 평가하지 말고, 학생이 쓴 표현 하나를 그대로 인용해 되짚어 주고, 음악 요소(음높이·리듬·빠르기·반복) 중 하나와 연결한 "다음 질문" 하나로 끝내세요. 존댓말, 따뜻하게.
질문: ${$('inquiry-q').innerText}
학생 답변: ${a}
이야기: ${current.text || ''} / 감정: ${EMO[current.emo] || ''}`, { temperature: .7, maxTokens: 300 });
      } catch (e) { box.textContent = '❌ ' + e.message; }
    };
  }

  /* ── ④ 노래로 만들기 (Lyria 30초) ── */
  function injectSong() {
    const grid = document.querySelector('#step-4 .save-grid'); if (!grid || $('ai-song')) return;
    const wrap = document.createElement('div'); wrap.style.cssText = 'margin-top:14px;text-align:center';
    wrap.innerHTML = `<button class="ai-btn" id="ai-song" style="padding:12px 22px;font-size:1.05em">🎵 내 이야기로 노래 만들기 (30초)</button>
      <div class="ai-st" id="ai-song-st"></div><div id="ai-song-box" style="display:none;margin-top:8px"><audio id="ai-song-audio" controls style="width:100%"></audio><a id="ai-song-dl" class="btn-main" style="display:inline-block;margin-top:8px;background:#00b894;text-decoration:none">⬇ 노래 저장</a><div class="ai-box" id="ai-song-lyr"></div></div>`;
    grid.parentNode.insertBefore(wrap, grid);
    $('ai-song').onclick = makeSong;
  }
  async function makeSong() {
    const btn = $('ai-song'), st = $('ai-song-st'); btn.disabled = true; st.textContent = '노래를 만들고 있어요 (30초~1분)…';
    try {
      const blocks = timeline.length ? timeline : [current];
      const story = blocks.map(b => b.text).filter(Boolean).join('\n');
      const emo = EMO[blocks[0].emo] || '';
      const rhythm = { ballad:'gentle piano ballad', hiphop:'laid-back hip hop beat', march:'bright marching band feel', waltz:'3/4 waltz', funk:'funky 16th-note groove', bossa:'bossa nova' }[blocks[0].rhythm] || 'pop';
      const mel = blocks[0].melody.map(n => NAMES[n.idx]).join(' ');
      const dir = blocks[0].melody.length > 1 ? (blocks[0].melody[blocks[0].melody.length - 1].idx > blocks[0].melody[0].idx ? 'rising' : 'falling') : 'gentle';
      const r = await EAIMKey.lyria(`A 30-second song for a Korean middle-school music class. Style: ${rhythm}, mood: ${emo}, ${Math.round(90 * (blocks[0].tempo || 1))} BPM. The main melody motif moves ${dir} in C major (solfege: ${mel}); keep the melody simple and singable, one clear vocal, no rap. Sing the lyrics in Korean exactly as written.

Lyrics:
[Verse]
${story}`);
      const url = `data:${r.mime};base64,${r.b64}`;
      $('ai-song-audio').src = url; $('ai-song-dl').href = url; $('ai-song-dl').download = (story.split('\n')[0] || 'my_story').slice(0, 20) + '.mp3';
      $('ai-song-lyr').textContent = r.text || story; $('ai-song-box').style.display = 'block';
      st.textContent = '✅ 완성. 내가 만든 멜로디와 AI가 부른 노래를 비교해 들어보세요 — 어디가 닮았나요?';
    } catch (e) { st.textContent = '❌ ' + e.message; }
    finally { btn.disabled = false; }
  }

  /* ── 단계가 바뀔 때마다 버튼 붙이기 ── */
  const origNext = window.nextStep;
  window.nextStep = function (n) { origNext.apply(this, arguments); setTimeout(() => { if (n === 3) injectMotif(); if (n === 4) { injectFeedback(); injectSong(); } }, 0); };
  const origFinish = window.saveAndFinish;
  window.saveAndFinish = function () { origFinish.apply(this, arguments); setTimeout(() => { injectFeedback(); injectSong(); }, 0); };
  // 키 상태 표시
  EAIMKey.get().then(k => { const el = document.querySelector('#intro-screen .intro-box'); if (el && !k) { const d = document.createElement('div'); d.style.cssText = 'font-size:.8em;color:#ffeaa7;margin-top:10px'; d.textContent = 'ℹ️ AI 동기 제안·노래 만들기는 선생님 키가 있을 때 열려요 (없어도 작곡은 됩니다)'; el.appendChild(d); } });
})();
