const { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } = require('node:crypto');
const getDatabase = require('./db');

const iterations = 310_000;

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

function json(response, status, payload) {
  const body = JSON.stringify(payload);
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Length', Buffer.byteLength(body));
  return response.end(body);
}

async function ensureSchema(sql) {
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
}

module.exports = function createAuthHandler(action) {
  return async function handler(request, response) {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return json(response, 405, { message: 'Método não permitido.' });
    }
    let payload;
    try {
    if (Buffer.byteLength(JSON.stringify(request.body ?? {})) > 16_384) {
      return json(response, 413, { message: 'A requisição excede o tamanho permitido.' });
    }
    payload = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid_json');
    } catch {
      return json(response, 400, { message: 'Requisição JSON inválida.' });
    }

    try {
    const sql = getDatabase();
    await ensureSchema(sql);

    if (action === 'register') {
      const name = typeof payload.name === 'string' ? payload.name.trim() : '';
      const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
      const password = payload.password;
      if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        return json(response, 400, { message: 'Informe nome e e-mail válidos.' });
      }
      if (typeof password !== 'string' || password.length < 8 || password.length > 256) {
        return json(response, 400, { message: 'A senha deve ter entre 8 e 256 caracteres.' });
      }
      try {
        const users = await sql`
          INSERT INTO users (name, email, password_hash)
          VALUES (${name}, ${email}, ${passwordHash(password)})
          RETURNING id, name, email
        `;
        const user = users[0];
        return json(response, 201, { id: Number(user.id), name: user.name, email: user.email });
      } catch (error) {
        if (error.code === '23505') return json(response, 409, { message: 'Este e-mail já está cadastrado.' });
        throw error;
      }
    }

    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const password = payload.password;
    const users = await sql`SELECT id, name, email, password_hash FROM users WHERE email = ${email} LIMIT 1`;
    const user = users[0];
    if (!user || typeof password !== 'string' || !verifyPassword(password, user.password_hash)) {
      return json(response, 401, { message: 'E-mail ou senha inválidos.' });
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    await sql`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (${tokenHash}, ${user.id}, ${expiresAt})`;
    return json(response, 200, {
      accessToken: token,
      refreshToken: token,
      user: { id: Number(user.id), name: user.name, email: user.email },
    });
    } catch (error) {
      const code = error.message?.startsWith('Defina SUPABASE_DB_URL')
        ? 'MISSING_SUPABASE_DB_URL'
        : error.code || 'INTERNAL_ERROR';
      console.error('Questify auth request failed:', { code, error });
      const status = code === 'MISSING_SUPABASE_DB_URL' ? 503 : 500;
      const message = status === 503
        ? 'Configure SUPABASE_DB_URL no ambiente da Vercel.'
        : `Erro interno do servidor (código ${code}).`;
      return json(response, status, { message });
    }
  };
};
