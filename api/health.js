const getDatabase = require('./_lib/db');

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  try {
    await getDatabase()`SELECT 1`;
    return sendJson(response, 200, { status: 'ok', service: 'questify-api', database: 'connected' });
  } catch (error) {
    console.error('Questify health check failed:', error);
    const code = error.message?.startsWith('Defina SUPABASE_DB_URL') ? 'MISSING_SUPABASE_DB_URL' : error.code || 'DATABASE_CONNECTION_FAILED';
    return sendJson(response, 503, { status: 'error', service: 'questify-api', code });
  }
};

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Content-Length', Buffer.byteLength(body));
  return response.end(body);
}
