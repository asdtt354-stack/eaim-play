// EAIM 연주실 — LALAL.AI 스템 분리 서버 함수 (Vercel)
// 위치: 저장소 루트의 api/lalal.js  → 배포되면 https://eaim-play.vercel.app/api/lalal
// Vercel 프로젝트 → Settings → Environment Variables 에 두 개 추가:
//   LALAL_KEY  = LALAL.AI API 라이선스 키 (lalal.ai/api 에서 구매·발급)
//   SPLIT_PIN  = 선생님만 아는 숫자 (예: 4827) — 앱에서 분리 버튼을 쓸 때 입력
// 키는 이 서버에만 있고 학생 브라우저에는 절대 내려가지 않습니다.

export const config = { api: { bodyParser: false }, maxDuration: 60 };

const LALAL = 'https://www.lalal.ai/api';

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function json(res, status, obj) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-pin, x-filename');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.status(status).json(obj);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 200, { ok: true });
  const key = process.env.LALAL_KEY, pin = process.env.SPLIT_PIN;
  if (!key) return json(res, 500, { error: 'LALAL_KEY 환경변수가 없어요. Vercel 설정에서 추가하세요.' });
  if (pin && req.headers['x-pin'] !== pin) return json(res, 401, { error: 'PIN이 맞지 않아요' });

  const action = (req.query && req.query.action) || 'check';
  const auth = { Authorization: `license ${key}` };

  try {
    if (action === 'upload') {
      // 브라우저가 압축한 mp3 를 그대로 전달 (Vercel 요청 본문 한도 약 4.5MB → 앱이 모노 64kbps 로 줄여서 보냄)
      const buf = await readBody(req);
      const name = decodeURIComponent(req.headers['x-filename'] || 'song.mp3');
      const r = await fetch(`${LALAL}/upload/`, { method: 'POST', headers: { ...auth, 'Content-Disposition': `attachment; filename="${name.replace(/"/g, '')}"` }, body: buf });
      const d = await r.json().catch(async () => ({ raw: await r.text() }));
      return json(res, r.ok ? 200 : 502, d);
    }
    if (action === 'split') {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      const form = new URLSearchParams({ id: body.id, stem: body.stem || 'vocals', splitter: body.splitter || 'phoenix' });
      const r = await fetch(`${LALAL}/split/`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
      const d = await r.json().catch(async () => ({ raw: await r.text() }));
      return json(res, r.ok ? 200 : 502, d);
    }
    if (action === 'check') {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      const form = new URLSearchParams({ id: body.id });
      const r = await fetch(`${LALAL}/check/`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
      const d = await r.json().catch(async () => ({ raw: await r.text() }));
      return json(res, r.ok ? 200 : 502, d);
    }
    if (action === 'ping') return json(res, 200, { ok: true, hasKey: !!key, pinRequired: !!pin });
    return json(res, 400, { error: 'action은 upload / split / check 중 하나' });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
}
