/**
 * Conexão avulsa (fora do pool do servidor), com a mesma interface para MySQL e PostgreSQL:
 *   conn.query(sql, params) -> array de linhas  (use "?" como marcador nos dois bancos)
 *   conn.close()
 */
function paraPostgres(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function conectar(config, { semBanco = false } = {}) {
  if (config.dbClient === 'mysql') {
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: semBanco ? undefined : config.database,
      charset: 'utf8mb4',
      multipleStatements: true,
    });

    return {
      dialeto: 'mysql',
      query: async (sql, params) => (await conn.query(sql, params))[0],
      close: () => conn.end(),
    };
  }

  const { Client } = require('pg');
  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    // O PostgreSQL exige um banco já existente para conectar; "postgres" sempre existe.
    database: semBanco ? 'postgres' : config.database,
  });
  await client.connect();

  return {
    dialeto: 'postgres',
    query: async (sql, params) => (await client.query(paraPostgres(sql), params)).rows,
    close: () => client.end(),
  };
}

module.exports = { conectar };
