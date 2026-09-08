/* EAIM 연주실 공용 — 왼쪽 위 "연주실" 홈 버튼 (모든 방 공통) */
(function(){
  const a=document.createElement('a');
  const t=new URLSearchParams(location.search).get('teacher'); a.href='index.html'+(t?'?teacher='+encodeURIComponent(t):''); a.textContent='🎹 연주실';
  a.setAttribute('aria-label','연주실 대문으로');
  a.style.cssText='position:fixed;top:12px;left:12px;z-index:5000;font:700 13px/1 "Noto Serif KR",serif;color:#fff;background:rgba(31,23,48,.85);border:1px solid rgba(212,168,67,.6);border-radius:20px;padding:8px 14px;text-decoration:none;backdrop-filter:blur(6px);box-shadow:0 2px 10px rgba(0,0,0,.3)';
  document.body.appendChild(a);
  const p=new URLSearchParams(location.search); if(p.get('embed')==='1') a.style.display='none';
  const f=document.createElement('div'); f.style.cssText='text-align:center;padding:14px 10px 24px;font:12px "Noto Sans KR",sans-serif;color:rgba(169,156,196,.55);line-height:1.8;word-break:keep-all'; f.textContent='© 2017–2026 박성애 · EAIM 교실';
  // 방마다 출처를 한 줄 더 붙일 수 있어요 (window.EAIM_CREDIT 에 문자열을 넣으면 됩니다)
  if(window.EAIM_CREDIT){const c=document.createElement('div'); c.style.cssText='margin-top:4px;font-size:11px;opacity:.85'; c.innerHTML=window.EAIM_CREDIT; f.appendChild(c);}
  document.body.appendChild(f);
})();
