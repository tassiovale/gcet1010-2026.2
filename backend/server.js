const { createServer } = require('node:http');
const { createReadStream, existsSync } = require('node:fs');
const { extname, resolve, sep } = require('node:path');
const { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } = require('node:crypto');
const getDatabase = require('../api/_lib/db');

const backendRoot = __dirname;
const frontendRoot = resolve(backendRoot, '..', 'frontend', 'dist');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8000);
const iterations = 310_000;

let schemaReady;
function ensureSchema(sql) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at BIGINT NOT NULL
      )`;
      await sql`ALTER TABLE users ENABLE ROW LEVEL SECURITY`;
      await sql`ALTER TABLE sessions ENABLE ROW LEVEL SECURITY`;
      await sql`REVOKE ALL ON TABLE users, sessions FROM anon, authenticated`;
    })().catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  }
  return schemaReady;
}

function passwordHash(password, salt = randomBytes(16)) {
  const digest = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  return `pbkdf2_sha256$${iterations}$${salt.toString('hex')}$${digest.toString('hex')}`;
}

function verifyPassword(password, stored) {
  try {
    const [algorithm, rounds, saltHex, expectedHex] = stored.split('$');
    if (algorithm !== 'pbkdf2_sha256') return false;
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = pbkdf2Sync(password, Buffer.from(saltHex, 'hex'), Number(rounds), expected.length, 'sha256');
    return expected.length === actual.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 16_384) throw new Error('payload_too_large');
  }
  try {
    const value = JSON.parse(body);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

async function handleAuth(req, res, pathname) {
  let payload;
  try {
    payload = await readJson(req);
  } catch {
    return sendJson(res, 413, { message: 'A requisição excede o tamanho permitido.' });
  }
  if (!payload) return sendJson(res, 400, { message: 'Requisição JSON inválida.' });

  const sql = getDatabase();
  await ensureSchema(sql);

  if (pathname === '/api/auth/register') {
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const password = payload.password;
    if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return sendJson(res, 400, { message: 'Informe nome e e-mail válidos.' });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 256) {
      return sendJson(res, 400, { message: 'A senha deve ter entre 8 e 256 caracteres.' });
    }
    try {
      const users = await sql`
        INSERT INTO users (name, email, password_hash)
        VALUES (${name}, ${email}, ${passwordHash(password)})
        RETURNING id, name, email
      `;
      return sendJson(res, 201, { ...users[0], id: Number(users[0].id) });
    } catch (error) {
      if (error.code === '23505') {
        return sendJson(res, 409, { message: 'Este e-mail já está cadastrado.' });
      }
      throw error;
    }
  }

  if (pathname === '/api/auth/login') {
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const password = payload.password;
    const users = await sql`SELECT id, name, email, password_hash FROM users WHERE email = ${email} LIMIT 1`;
    const user = users[0];
    if (!user || typeof password !== 'string' || !verifyPassword(password, user.password_hash)) {
      return sendJson(res, 401, { message: 'E-mail ou senha inválidos.' });
    }
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    await sql`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (${tokenHash}, ${user.id}, ${expiresAt})`;
    return sendJson(res, 200, {
      accessToken: token,
      refreshToken: token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  }

  return sendJson(res, 404, { message: 'Rota não encontrada.' });
}

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
    try {
      await handleAuth(req, res, url.pathname);
    } catch (error) {
      console.error(error);
      sendJson(res, 500, { message: 'Erro interno do servidor.' });
    }
    return;
  }
  if (url.pathname.startsWith('/api/')) return sendJson(res, 404, { message: 'Rota não encontrada.' });
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    return res.end();
  }
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = resolve(frontendRoot, relativePath);
  if (filePath !== frontendRoot && !filePath.startsWith(frontendRoot + sep)) {
    res.writeHead(403);
    return res.end();
  }
  if (!existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream' });
  if (req.method === 'HEAD') return res.end();
  createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => console.log(`Questify em http://${host}:${port}`));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
