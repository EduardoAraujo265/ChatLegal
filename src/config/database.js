const mysql = require('mysql2/promise');
const pg = require('pg');
const env = require('./env');

const isPostgres = env.dbClient === 'postgres';

// BIGINT/COUNT(*) chegam como string no driver do PostgreSQL; nossos valores cabem em Number.
pg.types.setTypeParser(pg.types.builtins.INT8, (valor) => Number(valor));

let pool;

/**
 * Pool de conexões único (singleton) com o banco configurado em DB_CLIENT.
 * Usar pool em vez de uma única conexão evita que o servidor pare de funcionar
 * após a primeira queda de conexão.
 */
function getPool() {
  if (pool) return pool;

  if (isPostgres) {
    pool = new pg.Pool({
      host: env.dbHost,
      user: env.dbUser,
      password: env.dbPassword,
      database: env.dbName,
      port: env.dbPort || 5432,
      max: env.dbPoolSize,
    });
  } else {
    pool = mysql.createPool({
      host: env.dbHost,
      user: env.dbUser,
      password: env.dbPassword,
      database: env.dbName,
      port: env.dbPort || 3306,
      waitForConnections: true,
      connectionLimit: env.dbPoolSize,
      // utf8mb4: sem isso o driver usa 3 bytes por caractere e emojis do chat quebram.
      charset: 'utf8mb4',
      // Datas sempre em UTC: o driver interpreta como UTC e cada conexão nova fixa o fuso da sessão.
      timezone: 'Z',
    });
    pool.pool.on('connection', (conexao) => {
      conexao.query("SET time_zone = '+00:00'", (err) => {
        if (err) console.error('Não foi possível fixar o fuso da sessão MySQL em UTC:', err.message);
      });
    });
  }

  return pool;
}

// Escreve-se SQL com "?" como marcador; para o PostgreSQL ele vira $1, $2, ...
function paraPostgres(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/** Executa um SELECT e devolve as linhas. */
async function all(sql, params = []) {
  if (isPostgres) {
    const { rows } = await getPool().query(paraPostgres(sql), params);
    return rows;
  }
  const [rows] = await getPool().query(sql, params);
  return rows;
}

/** Executa um SELECT e devolve a primeira linha (ou null). */
async function one(sql, params = []) {
  const rows = await all(sql, params);
  return rows[0] || null;
}

/**
 * Executa INSERT/UPDATE/DELETE. Devolve { insertId, affectedRows }.
 * No PostgreSQL, INSERTs ganham "RETURNING id" automaticamente.
 */
async function run(sql, params = []) {
  if (isPostgres) {
    const insercao = /^\s*INSERT/i.test(sql);
    const texto = insercao && !/RETURNING/i.test(sql) ? `${sql} RETURNING id` : sql;
    const resultado = await getPool().query(paraPostgres(texto), params);
    return { insertId: insercao ? resultado.rows[0].id : null, affectedRows: resultado.rowCount };
  }
  const [resultado] = await getPool().query(sql, params);
  return { insertId: resultado.insertId, affectedRows: resultado.affectedRows };
}

/** Violação de índice único (ex.: e-mail repetido), nos dois bancos. */
function isUniqueViolation(err) {
  return err && (err.code === 'ER_DUP_ENTRY' || err.code === '23505');
}

/**
 * Tabela ou coluna que o código espera e o banco não tem: o código foi atualizado mas
 * o banco ainda é o de uma versão anterior (falta rodar `npm run db:init`).
 */
function isSchemaError(err) {
  return Boolean(err) && ['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE', '42703', '42P01'].includes(err.code);
}

// ---------- busca "contém", sem diferenciar maiúsculas de minúsculas ----------

/** Escapa %, _ e o próprio caractere de escape para que o texto digitado seja literal. */
function escapeLike(texto) {
  return String(texto).replace(/[!%_]/g, '!$&');
}

/** Condição SQL "coluna contém ?" (use com `%${escapeLike(valor)}%` como parâmetro). */
function like(coluna) {
  return `LOWER(${coluna}) LIKE LOWER(?) ESCAPE '!'`;
}

async function close() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = { getPool, all, one, run, isPostgres, isUniqueViolation, isSchemaError, escapeLike, like, close };
