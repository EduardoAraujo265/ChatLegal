require('dotenv').config({ quiet: true });

const REQUIRED_VARS = ['DB_CLIENT', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];

// DB_PASSWORD pode ficar vazio (comum em bancos locais de desenvolvimento), mas precisa existir no .env.
const missing = REQUIRED_VARS.filter(
  (key) => process.env[key] === undefined || (process.env[key] === '' && key !== 'DB_PASSWORD')
);

if (missing.length > 0) {
  throw new Error(
    `Variáveis de ambiente obrigatórias ausentes: ${missing.join(
      ', '
    )}. Copie o arquivo .env.example para .env e preencha os valores.`
  );
}

if (!['mysql', 'postgres'].includes(process.env.DB_CLIENT)) {
  throw new Error('DB_CLIENT deve ser "mysql" ou "postgres".');
}

const nodeEnv = process.env.NODE_ENV || 'development';

if (nodeEnv === 'production' && (process.env.JWT_SECRET.length < 32 || /^troque/i.test(process.env.JWT_SECRET))) {
  console.warn('⚠️  JWT_SECRET fraco para produção: use um valor aleatório com 32+ caracteres (veja .env.example).');
}

// Atrás de proxy (Vercel, nginx, ...) o IP real do cliente vem em X-Forwarded-For.
// Só confie nesse cabeçalho se realmente houver um proxy na frente (TRUST_PROXY = nº de proxies).
const trustProxy =
  process.env.TRUST_PROXY !== undefined ? Number(process.env.TRUST_PROXY) : process.env.VERCEL ? 1 : 0;

module.exports = {
  dbClient: process.env.DB_CLIENT,
  dbHost: process.env.DB_HOST,
  dbUser: process.env.DB_USER,
  dbPassword: process.env.DB_PASSWORD,
  dbName: process.env.DB_NAME,
  dbPort: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  dbPoolSize: process.env.DB_POOL_SIZE ? Number(process.env.DB_POOL_SIZE) : 10,
  jwtSecret: process.env.JWT_SECRET,
  sessionHours: process.env.SESSION_HOURS ? Number(process.env.SESSION_HOURS) : 8,
  port: process.env.PORT ? Number(process.env.PORT) : 5000,
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  trustProxy,
};
