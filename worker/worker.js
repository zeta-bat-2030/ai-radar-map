// 互联网情报系统 鉴权后端：Cloudflare Worker + D1
// 绑定：DB(D1)；secrets：TOKEN_SECRET, PUSH_KEY；vars：ALLOW_ORIGIN
const ITER = 100000, TTL = 12 * 3600, enc = new TextEncoder();
const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ub64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
async function pbkdf2(pw, saltHex) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const salt = Uint8Array.from(saltHex.match(/../g).map(h => parseInt(h, 16)));
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, k, 256));
}
function eq(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
async function hkey(env) { return crypto.subtle.importKey('raw', enc.encode(env.TOKEN_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); }
async function sign(env, p) { const body = b64u(enc.encode(JSON.stringify(p))); return body + '.' + b64u(await crypto.subtle.sign('HMAC', await hkey(env), enc.encode(body))); }
async function verify(env, t) {
  try { const [body, sig] = t.split('.'); if (!await crypto.subtle.verify('HMAC', await hkey(env), ub64u(sig), enc.encode(body))) return null;
    const p = JSON.parse(new TextDecoder().decode(ub64u(body))); return p.exp > Date.now() / 1000 ? p : null; } catch { return null; }
}
const cors = (env, req) => { const o = req.headers.get('Origin'); const ok = (env.ALLOW_ORIGIN || '').split(',').includes(o);
  return ok ? { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : { Vary: 'Origin' }; };
const J = (env, req, d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(env, req) } });

async function limited(env, key, max, win) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare('DELETE FROM hits WHERE ts < ?').bind(now - 86400).run();
  const r = await env.DB.prepare('SELECT COUNT(*) n FROM hits WHERE k = ? AND ts > ?').bind(key, now - win).first();
  return r.n >= max;
}
const hit = (env, key) => env.DB.prepare('INSERT INTO hits (k, ts) VALUES (?, ?)').bind(key, Math.floor(Date.now() / 1000)).run();

async function auth(env, req) {
  const t = (req.headers.get('Authorization') || '').replace(/^Bearer /, ''); const p = t && await verify(env, t); if (!p) return null;
  const u = await env.DB.prepare('SELECT username, role, status, tv FROM users WHERE username = ?').bind(p.u).first();
  return u && u.status === 'approved' && u.tv === p.tv ? u : null;  // 禁用/改状态后 tv 变化，旧 token 立即失效
}
const UN = /^[A-Za-z0-9_\-.]{3,32}$/;

export default {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname, ip = req.headers.get('CF-Connecting-IP') || '0';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, req) });
    const origin = req.headers.get('Origin');
    if (origin && !(env.ALLOW_ORIGIN || '').split(',').includes(origin)) return J(env, req, { error: 'origin' }, 403);
    try {
      const body = req.method === 'POST' && (req.headers.get('Content-Type') || '').includes('json') ? await req.json().catch(() => ({})) : {};
      if (path === '/api/health') return J(env, req, { ok: true });

      if (path === '/api/apply' && req.method === 'POST') {
        const { username: u = '', password: pw = '', reason = '' } = body;
        if (!UN.test(u) || pw.length < 8 || pw.length > 128 || reason.trim().length < 2 || reason.length > 500) return J(env, req, { error: 'invalid' }, 400);
        if (await limited(env, 'apply:' + ip, 5, 3600)) return J(env, req, { error: 'rate' }, 429);
        await hit(env, 'apply:' + ip);
        if (await env.DB.prepare('SELECT 1 FROM users WHERE username = ?').bind(u).first()) return J(env, req, { error: 'exists' }, 409);
        const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
        await env.DB.prepare("INSERT INTO users (username, salt, hash, role, status, reason, created, updated, tv) VALUES (?, ?, ?, 'user', 'pending', ?, ?, ?, 1)")
          .bind(u, salt, await pbkdf2(pw, salt), reason.trim(), Date.now(), Date.now()).run();
        return J(env, req, { ok: true, status: 'pending' });
      }

      if (path === '/api/login' && req.method === 'POST') {
        const { username: u = '', password: pw = '' } = body;
        if (await limited(env, 'login:' + ip, 10, 900) || await limited(env, 'loginu:' + u, 5, 900)) return J(env, req, { error: 'rate' }, 429);
        const row = UN.test(u) && await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(u).first();
        const h = await pbkdf2(pw, row ? row.salt : '00000000000000000000000000000000');  // 不存在也算一次，防计时探测
        if (!row || !eq(h, row.hash)) { await hit(env, 'login:' + ip); await hit(env, 'loginu:' + u); return J(env, req, { error: 'bad' }, 401); }
        if (row.status !== 'approved') return J(env, req, { error: row.status }, 403);
        const token = await sign(env, { u, role: row.role, tv: row.tv, exp: Math.floor(Date.now() / 1000) + TTL });
        return J(env, req, { token, username: u, role: row.role, exp: TTL });
      }

      if (path === '/api/me') { const u = await auth(env, req); return u ? J(env, req, { username: u.username, role: u.role }) : J(env, req, { error: 'auth' }, 401); }

      const dm = path.match(/^\/api\/data\/(events|models)$/);
      if (dm && req.method === 'GET') {
        if (!await auth(env, req)) return J(env, req, { error: 'auth' }, 401);
        const r = await env.DB.prepare('SELECT body FROM blobs WHERE name = ?').bind(dm[1]).first();
        return r ? new Response(r.body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', ...cors(env, req) } }) : J(env, req, { error: 'nodata' }, 404);
      }
      if (dm && req.method === 'POST') {   // 数据推送（本机脚本用 PUSH_KEY）
        if (!env.PUSH_KEY || !eq(req.headers.get('X-Push-Key') || '', env.PUSH_KEY)) return J(env, req, { error: 'auth' }, 401);
        const s = JSON.stringify(body); if (s.length < 10) return J(env, req, { error: 'empty' }, 400);
        await env.DB.prepare('INSERT INTO blobs (name, body, updated) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET body = excluded.body, updated = excluded.updated').bind(dm[1], s, Date.now()).run();
        return J(env, req, { ok: true, bytes: s.length });
      }

      if (path.startsWith('/api/admin/')) {
        const me = await auth(env, req); if (!me || me.role !== 'admin') return J(env, req, { error: 'forbidden' }, 403);
        if (path === '/api/admin/users' && req.method === 'GET') {
          const r = await env.DB.prepare('SELECT username, role, status, reason, created, updated FROM users ORDER BY created DESC').all(); return J(env, req, { users: r.results });
        }
        if (path === '/api/admin/action' && req.method === 'POST') {
          const { username: u, action } = body; const map = { approve: 'approved', reject: 'rejected', disable: 'disabled' };
          const row = await env.DB.prepare('SELECT role FROM users WHERE username = ?').bind(u || '').first();
          if (!row) return J(env, req, { error: 'nouser' }, 404); if (row.role === 'admin') return J(env, req, { error: 'admin-protected' }, 400);
          if (action === 'delete') { await env.DB.prepare('DELETE FROM users WHERE username = ?').bind(u).run(); return J(env, req, { ok: true }); }
          if (!map[action]) return J(env, req, { error: 'action' }, 400);
          await env.DB.prepare('UPDATE users SET status = ?, updated = ?, tv = tv + 1 WHERE username = ?').bind(map[action], Date.now(), u).run();
          return J(env, req, { ok: true, status: map[action] });
        }
      }
      return J(env, req, { error: 'notfound' }, 404);
    } catch (e) { return J(env, req, { error: 'server' }, 500); }
  }
};
