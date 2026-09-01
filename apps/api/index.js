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

app.listen(PORT, '127.0.0.1', () => {
  console.log(`scorer-api listening on 127.0.0.1:${PORT}, scores in ${SCORES_DIR}`);
});
