/**
 * Lê a configuração de conexão do banco a partir das variáveis de ambiente (.env).
 * Usada pelos scripts e pelos testes; não exige JWT_SECRET (que só o servidor precisa).
 */
require('dotenv').config({ quiet: true });

function fromEnv(overrides = {}) {
  const dbClient = overrides.dbClient || process.env.DB_CLIENT || 'mysql';

  if (!['mysql', 'postgres'].includes(dbClient)) {
    throw new Error('DB_CLIENT deve ser "mysql" ou "postgres".');
  }

  const config = {
    dbClient,
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || (dbClient === 'mysql' ? 3306 : 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    ...overrides,
  };

  const faltando = ['user', 'database'].filter((chave) => !config[chave]);
  if (faltando.length > 0) {
    const nomes = { user: 'DB_USER', database: 'DB_NAME' };
    throw new Error(
      `Configuração incompleta: defina ${faltando.map((k) => nomes[k]).join(', ')} no .env (veja .env.example).`
    );
  }
  return config;
}

module.exports = { fromEnv };
