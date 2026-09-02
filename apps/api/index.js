// Reconstruction of the scorer backend lost in the 2026-03-17 server wipe.
// The deployed frontend (scorer.bak build, Nov 2025) calls exactly four endpoints,
// all under /api/ (nginx proxies /api/ -> :3005 with the path preserved):
//   POST /api/auth/login   {accessCode}  -> sets session cookie
//   GET  /api/auth/check                 -> {authenticated}
//   POST /api/auth/logout
//   POST /api/match/email  {...match, to} -> archives JSON to SCORES_DIR, emails via SendGrid
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');

const PORT = process.env.PORT || 3005;
const ACCESS_CODE = process.env.ACCESS_CODE || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const SCORES_DIR = process.env.SCORES_DIR || path.join(__dirname, 'data');
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@minimomentum.co.uk';
// Only ever send to this address regardless of what the client asks for.
const EMAIL_TO_ALLOWLIST = ['info@momentumnetball.co.uk'];
const COOKIE = 'scorer_session';
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

if (!ACCESS_CODE || !SESSION_SECRET) {
  console.error('ACCESS_CODE and SESSION_SECRET must be set');
  process.exit(1);
}
fs.mkdirSync(SCORES_DIR, { recursive: true });

const sign = (value) =>
  crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');

const makeToken = () => {
  const payload = String(Date.now() + SESSION_TTL_MS);
  return `${payload}.${sign(payload)}`;
};

const validToken = (token) => {
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = sign(payload);
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  return Number(payload) > Date.now();
};

const getToken = (req) => {
  const raw = req.headers.cookie || '';
  const match = raw.split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  return match ? match.slice(COOKIE.length + 1) : null;
};

const app = express();
app.use(express.json({ limit: '1mb' }));

app.post('/api/auth/login', (req, res) => {
  const code = String((req.body || {}).accessCode || '');
  const expected = ACCESS_CODE;
  const a = Buffer.from(code.toUpperCase().padEnd(64).slice(0, 64));
  const b = Buffer.from(expected.toUpperCase().padEnd(64).slice(0, 64));
  if (!crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Invalid access code' });
  }
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${makeToken()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`
  );
  res.json({ ok: true });
});

app.get('/api/auth/check', (req, res) => {
  res.json({ authenticated: validToken(getToken(req)) });
});

app.post('/api/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  res.json({ ok: true });
});

app.post('/api/match/email', async (req, res) => {
  if (!validToken(getToken(req))) return res.status(401).json({ error: 'Not authenticated' });
  const body = req.body || {};

  // Archive first — never lose a match report to an email failure.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(SCORES_DIR, `match-${stamp}.json`);
  try {
    fs.writeFileSync(file, JSON.stringify(body, null, 2));
  } catch (err) {
    console.error('Failed to archive match:', err);
    return res.status(500).json({ error: 'Failed to save match' });
  }

  let emailed = false;
  const to = EMAIL_TO_ALLOWLIST.includes(body.to) ? body.to : EMAIL_TO_ALLOWLIST[0];
  if (SENDGRID_API_KEY) {
    try {
      const subject = body.subject || `Netball Scorer match report ${new Date().toLocaleDateString('en-GB')}`;
      const text = body.text || body.summary || JSON.stringify(body, null, 2);
      const html = body.html || null;
      const content = [{ type: 'text/plain', value: String(text) }];
      if (html) content.push({ type: 'text/html', value: String(html) });
      const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: EMAIL_FROM, name: 'Netball Scorer' },
          subject,
          content,
        }),
      });
      emailed = resp.ok;
      if (!resp.ok) console.error('SendGrid error:', resp.status, await resp.text());
    } catch (err) {
      console.error('Email send failed:', err);
    }
  }
  res.json({ ok: true, emailed, saved: path.basename(file) });
});


// ---------------------------------------------------------------------------
// Live matches: append-only event log per match, shared between a scoring
// device and a stats device. One JSON file per match under MATCHES_DIR.
const MATCHES_DIR = process.env.MATCHES_DIR || path.join(SCORES_DIR, 'matches');
fs.mkdirSync(MATCHES_DIR, { recursive: true });

const matchPath = (id) => path.join(MATCHES_DIR, `${id.replace(/[^A-Za-z0-9-]/g, '')}.json`);

const loadMatch = (id) => {
  try { return JSON.parse(fs.readFileSync(matchPath(id), 'utf8')); } catch { return null; }
};
const saveMatch = (m) => fs.writeFileSync(matchPath(m.id), JSON.stringify(m));

const requireAuth = (req, res, next) => {
  if (!validToken(getToken(req))) return res.status(401).json({ error: 'Not authenticated' });
  next();
};

app.post('/api/matches', requireAuth, (req, res) => {
  const config = (req.body || {}).config;
  if (!config || !config.home || !config.away) return res.status(400).json({ error: 'config.home and config.away are required' });
  const id = `M-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const m = { id, createdAt: new Date().toISOString(), status: 'active', config, seq: 0, events: [] };
  saveMatch(m);
  res.json({ id: m.id });
});

app.get('/api/matches', requireAuth, (req, res) => {
  const status = req.query.status;
  const out = [];
  for (const f of fs.readdirSync(MATCHES_DIR)) {
    if (!f.endsWith('.json')) continue;
    try {
      const m = JSON.parse(fs.readFileSync(path.join(MATCHES_DIR, f), 'utf8'));
      if (status && m.status !== status) continue;
      out.push({ id: m.id, createdAt: m.createdAt, status: m.status, config: m.config, seq: m.seq });
    } catch {}
  }
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  res.json({ matches: out.slice(0, 50) });
});

app.get('/api/matches/:id', requireAuth, (req, res) => {
  const m = loadMatch(req.params.id);
  if (!m) return res.status(404).json({ error: 'Match not found' });
  res.json(m);
});

app.get('/api/matches/:id/events', requireAuth, (req, res) => {
  const m = loadMatch(req.params.id);
  if (!m) return res.status(404).json({ error: 'Match not found' });
  const since = Number(req.query.since || 0);
  res.json({ seq: m.seq, status: m.status, events: m.events.filter((e) => e.seq > since) });
});

app.post('/api/matches/:id/events', requireAuth, (req, res) => {
  const m = loadMatch(req.params.id);
  if (!m) return res.status(404).json({ error: 'Match not found' });
  if (m.status !== 'active') return res.status(409).json({ error: 'Match is not active' });
  const incoming = (req.body || {}).events;
  if (!Array.isArray(incoming) || incoming.length === 0) return res.status(400).json({ error: 'events array required' });
  for (const e of incoming.slice(0, 100)) {
    // idempotency: skip client ids we already have
    if (e.clientId && m.events.some((x) => x.clientId === e.clientId)) continue;
    m.seq += 1;
    m.events.push({ seq: m.seq, clientId: e.clientId || null, ts: new Date().toISOString(),
                    device: String(e.device || ''), type: String(e.type || 'note'), payload: e.payload || {} });
  }
  saveMatch(m);
  res.json({ seq: m.seq });
});

app.post('/api/matches/:id/complete', requireAuth, async (req, res) => {
  const m = loadMatch(req.params.id);
  if (!m) return res.status(404).json({ error: 'Match not found' });
  m.status = 'completed';
  m.completedAt = new Date().toISOString();
  saveMatch(m);
  // Best-effort email of the client-rendered summary, same shape as /api/match/email.
  const body = req.body || {};
  let emailed = false;
  if (SENDGRID_API_KEY && body.text) {
    try {
      const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: EMAIL_TO_ALLOWLIST[0] }] }],
          from: { email: EMAIL_FROM, name: 'Netball Scorer' },
          subject: body.subject || `Match report: ${m.config.home} v ${m.config.away}`,
          content: [{ type: 'text/plain', value: String(body.text) }],
        }),
      });
      emailed = resp.ok;
      if (!resp.ok) console.error('SendGrid error:', resp.status, await resp.text());
    } catch (err) { console.error('Email send failed:', err); }
  }
  // Best-effort push to Momentum Sports Technology (system of record).
  let mstPushed = false;
  if (process.env.MST_API_URL && process.env.MST_API_TOKEN && body.mst) {
    try {
      const resp = await fetch(`${process.env.MST_API_URL}/matches`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.MST_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body.mst),
      });
      mstPushed = resp.ok;
      if (!resp.ok) console.error('MST push error:', resp.status, await resp.text());
    } catch (err) { console.error('MST push failed:', err); }
  }
  res.json({ ok: true, emailed, mstPushed });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`scorer-api listening on 127.0.0.1:${PORT}, scores in ${SCORES_DIR}`);
});
