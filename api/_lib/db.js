const postgres = require('postgres');

let client;

module.exports = function getDatabase() {
  if (client) return client;

  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error('Defina SUPABASE_DB_URL com a connection string do Supabase.');
  }

  client = postgres(connectionString, {
    ssl: 'require',
    prepare: false,
    max: 1,
    connect_timeout: 10,
    idle_timeout: 20,
  });
  return client;
};
