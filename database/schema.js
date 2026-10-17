/**
 * Geração e atualização do esquema do banco (MySQL ou PostgreSQL).
 *
 * ensureSchema() pode ser executada quantas vezes quiser (é idempotente) e serve para:
 *   1. instalações novas  -> cria o banco e as tabelas `usuarios` e `mensagens`;
 *   2. instalações antigas -> acrescenta o que falta SEM apagar dados:
 *        - colunas `papel` e `criado_em` em `usuarios`
 *        - índice único de e-mail
 *        - migra a antiga tabela `admins` para `usuarios` (papel = 'admin')
 */
const fs = require('fs');
const path = require('path');
const { conectar } = require('./connection');

const consoleLogger = {
  info: (msg) => console.log(msg),
  warn: (msg) => console.warn(`⚠️  ${msg}`),
};

// ---------- consultas ao catálogo (information_schema funciona nos dois bancos) ----------

const schemaAtual = (conn) => (conn.dialeto === 'mysql' ? 'DATABASE()' : 'current_schema()');

async function tabelaExiste(conn, tabela) {
  const linhas = await conn.query(
    `SELECT 1 AS ok FROM information_schema.tables
      WHERE table_schema = ${schemaAtual(conn)} AND table_name = ?`,
    [tabela]
  );
  return linhas.length > 0;
}

async function colunaExiste(conn, tabela, coluna) {
  const linhas = await conn.query(
    `SELECT 1 AS ok FROM information_schema.columns
      WHERE table_schema = ${schemaAtual(conn)} AND table_name = ? AND column_name = ?`,
    [tabela, coluna]
  );
  return linhas.length > 0;
}

async function indiceExiste(conn, tabela, indice) {
  const sql =
    conn.dialeto === 'mysql'
      ? `SELECT 1 AS ok FROM information_schema.statistics
          WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`
      : `SELECT 1 AS ok FROM pg_indexes
          WHERE schemaname = current_schema() AND tablename = ? AND indexname = ?`;
  return (await conn.query(sql, [tabela, indice])).length > 0;
}

// ---------- etapas ----------

async function criarBanco(config, logger) {
  const conn = await conectar(config, { semBanco: true });
  try {
    if (config.dbClient === 'mysql') {
      const nome = config.database.replace(/`/g, '``');
      await conn.query(
        `CREATE DATABASE IF NOT EXISTS \`${nome}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
    } else {
      const existe = await conn.query('SELECT 1 AS ok FROM pg_database WHERE datname = ?', [
        config.database,
      ]);
      if (existe.length === 0) {
        await conn.query(`CREATE DATABASE "${config.database.replace(/"/g, '""')}"`);
      }
    }
  } finally {
    await conn.close();
  }
  logger.info(`Banco "${config.database}" verificado/criado.`);
}

async function atualizarTabelaUsuarios(conn, logger) {
  const mysql = conn.dialeto === 'mysql';

  if (!(await colunaExiste(conn, 'usuarios', 'papel'))) {
    await conn.query(
      mysql
        ? "ALTER TABLE usuarios ADD COLUMN papel ENUM('usuario','admin') NOT NULL DEFAULT 'usuario'"
        : "ALTER TABLE usuarios ADD COLUMN papel VARCHAR(10) NOT NULL DEFAULT 'usuario' CHECK (papel IN ('usuario','admin'))"
    );
    logger.info('Tabela usuarios: coluna "papel" adicionada (todas as contas existentes = usuario).');
  }

  if (!(await colunaExiste(conn, 'usuarios', 'criado_em'))) {
    await conn.query(
      mysql
        ? 'ALTER TABLE usuarios ADD COLUMN criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'
        : 'ALTER TABLE usuarios ADD COLUMN criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()'
    );
    logger.info('Tabela usuarios: coluna "criado_em" adicionada.');
  }

  if (!(await indiceExiste(conn, 'usuarios', 'uq_usuarios_email'))) {
    const duplicados = await conn.query(
      `SELECT email, COUNT(*) AS total FROM usuarios
        WHERE email IS NOT NULL GROUP BY email HAVING COUNT(*) > 1`
    );

    if (duplicados.length > 0) {
      const lista = duplicados.map((d) => d.email).join(', ');
      logger.warn(
        `Há e-mails repetidos em usuarios (${lista}); o índice único NÃO foi criado. ` +
          'Remova ou corrija as duplicatas no painel e rode "npm run db:init" de novo.'
      );
      return;
    }

    await conn.query(
      mysql
        ? 'ALTER TABLE usuarios ADD UNIQUE KEY uq_usuarios_email (email)'
        : 'ALTER TABLE usuarios ADD CONSTRAINT uq_usuarios_email UNIQUE (email)'
    );
    logger.info('Tabela usuarios: índice único de e-mail criado.');
  }
}

/**
 * Antes existiam duas tabelas: `admins` (quem entrava no painel) e `usuarios` (os registros do CRUD).
 * Agora há uma só, com a coluna `papel`. Os admins antigos viram contas com papel = 'admin',
 * mantendo o mesmo e-mail e o mesmo hash de senha (continuam entrando com a senha de sempre).
 */
async function migrarAdmins(conn, logger) {
  if (!(await tabelaExiste(conn, 'admins'))) return;

  const admins = await conn.query('SELECT nome, email, senha FROM admins');
  let migrados = 0;
  const pendentes = []; // admins que precisam de atenção manual

  for (const admin of admins) {
    const email = String(admin.email || '').trim().toLowerCase();

    if (!email || !admin.senha) {
      pendentes.push(`${email || '(sem e-mail)'}: cadastro incompleto`);
      continue;
    }
    if (!/^\$2[aby]\$/.test(admin.senha)) {
      pendentes.push(`${email}: senha não está em hash bcrypt`);
      continue;
    }

    const existente = await conn.query('SELECT id, papel FROM usuarios WHERE email = ?', [email]);
    if (existente.length > 0) {
      // Já é admin em `usuarios` (migrado antes ou resolvido com create-admin): nada a fazer.
      // Se for uma conta comum, o e-mail está ocupado por outra conta e a decisão é manual.
      if (existente[0].papel !== 'admin') {
        pendentes.push(`${email}: já existe em usuarios como conta comum`);
      }
      continue;
    }

    const nome = String(admin.nome || email.split('@')[0]).slice(0, 498);
    await conn.query("INSERT INTO usuarios (nome, email, senha, papel) VALUES (?, ?, ?, 'admin')", [
      nome,
      email,
      admin.senha,
    ]);
    migrados++;
  }

  if (migrados > 0) logger.info(`Admins migrados de "admins" para "usuarios": ${migrados}.`);

  if (pendentes.length > 0) {
    logger.warn(
      `A tabela "admins" foi mantida porque ${pendentes.length} registro(s) precisam de atenção: ` +
        `${pendentes.join('; ')}. Resolva com: npm run create-admin`
    );
    return;
  }

  const destino = (await tabelaExiste(conn, 'admins_legado')) ? `admins_legado_${Date.now()}` : 'admins_legado';
  await conn.query(
    conn.dialeto === 'mysql' ? `RENAME TABLE admins TO ${destino}` : `ALTER TABLE admins RENAME TO ${destino}`
  );
  logger.info(`Tabela "admins" renomeada para "${destino}" (dados preservados; pode ser apagada depois).`);
}

// ---------- ponto de entrada ----------

async function ensureSchema(config, { logger = consoleLogger } = {}) {
  await criarBanco(config, logger);

  const conn = await conectar(config);
  try {
    const sql = fs.readFileSync(path.join(__dirname, `${config.dbClient}.sql`), 'utf8');
    await conn.query(sql);
    logger.info('Tabelas verificadas/criadas: usuarios, mensagens.');

    await atualizarTabelaUsuarios(conn, logger);
    await migrarAdmins(conn, logger);
  } finally {
    await conn.close();
  }
}

module.exports = { ensureSchema, tabelaExiste, colunaExiste };
