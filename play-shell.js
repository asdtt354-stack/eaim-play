/* EAIM 연주실 공용 — 왼쪽 위 "연주실" 홈 버튼 (모든 방 공통) */
(function(){
  const a=document.createElement('a');
  a.href='index.html'; a.textContent='🎹 연주실';
  a.setAttribute('aria-label','연주실 대문으로');
  a.style.cssText='position:fixed;top:12px;left:12px;z-index:5000;font:700 13px/1 "Noto Serif KR",serif;color:#fff;background:rgba(31,23,48,.85);border:1px solid rgba(212,168,67,.6);border-radius:20px;padding:8px 14px;text-decoration:none;backdrop-filter:blur(6px);box-shadow:0 2px 10px rgba(0,0,0,.3)';
  document.body.appendChild(a);
  const p=new URLSearchParams(location.search); if(p.get('embed')==='1') a.style.display='none';
})();
