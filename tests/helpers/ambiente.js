/**
 * Infraestrutura dos testes: banco de testes isolado, servidor em porta aleatória
 * e um cliente HTTP que guarda cookies (como um navegador).
 *
 * Os testes usam as credenciais do .env, mas SEMPRE um banco separado, "<DB_NAME>_test"
 * (ou DB_NAME_TEST). Esse banco é apagado e recriado a cada arquivo de teste.
 * Para testar PostgreSQL: DB_CLIENT=postgres DB_PORT=5432 npm test
 */
process.env.NODE_ENV = 'test';

const bcrypt = require('bcryptjs');
const { fromEnv } = require('../../database/config'); // também carrega o .env
const { conectar } = require('../../database/connection');
const { ensureSchema } = require('../../database/schema');

const base = fromEnv();
const nomeBancoTeste = process.env.DB_NAME_TEST || `${base.database}_test`;

if (!nomeBancoTeste.endsWith('_test')) {
  throw new Error(`Por segurança, o banco de testes precisa terminar com "_test" (recebido: ${nomeBancoTeste}).`);
}

process.env.DB_NAME = nomeBancoTeste;
process.env.DB_HOST = process.env.DB_HOST || base.host;
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? base.password;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-usado-apenas-nos-testes-automatizados-0123456789';

const config = { ...base, database: nomeBancoTeste };
const silencioso = { info() {}, warn() {} };

/** Apaga todas as tabelas do banco de testes e recria o esquema do zero. */
async function resetarBanco({ criarEsquema = true } = {}) {
  await ensureSchema(config, { logger: silencioso }); // garante que o banco exista
  const conn = await conectar(config);
  try {
    const tabelas = await conn.query(
      `SELECT table_name AS nome FROM information_schema.tables
        WHERE table_schema = ${conn.dialeto === 'mysql' ? 'DATABASE()' : 'current_schema()'}`
    );
    if (conn.dialeto === 'mysql') await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const { nome, NOME, table_name } of tabelas) {
      const alvo = nome || NOME || table_name;
      await conn.query(conn.dialeto === 'mysql' ? `DROP TABLE IF EXISTS \`${alvo}\`` : `DROP TABLE IF EXISTS "${alvo}" CASCADE`);
    }
    if (conn.dialeto === 'mysql') await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    await conn.close();
  }
  if (criarEsquema) await ensureSchema(config, { logger: silencioso });
}

/** Sobe o app em uma porta livre. Retorna { url, fechar }. */
async function iniciarServidor() {
  const app = require('../../src/app');
  const servidor = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const url = `http://127.0.0.1:${servidor.address().port}`;

  return {
    url,
    async fechar() {
      await new Promise((resolve) => servidor.close(resolve));
      await require('../../src/config/database').close();
    },
  };
}

// Hash gerado uma vez só: bcrypt é lento de propósito e criar dezenas de contas ficaria demorado.
const SENHA_PADRAO = 'senha12345';
const HASH_PADRAO = bcrypt.hashSync(SENHA_PADRAO, 4);

/** Insere contas direto no banco (rápido). Retorna as linhas criadas (com id). */
async function criarContas(lista) {
  const db = require('../../src/config/database');
  const criadas = [];
  for (const c of lista) {
    const { insertId } = await db.run(
      'INSERT INTO usuarios (nome, email, telefone, senha, papel) VALUES (?, ?, ?, ?, ?)',
      [c.nome, c.email, c.telefone ?? null, HASH_PADRAO, c.papel || 'usuario']
    );
    criadas.push({ ...c, id: insertId, senha: SENHA_PADRAO });
  }
  return criadas;
}

/** Cliente HTTP com cookie jar. Não segue redirecionamentos (para podermos conferi-los). */
class Cliente {
  constructor(url) {
    this.url = url;
    this.cookie = '';
  }

  async req(metodo, caminho, corpo, { contentType } = {}) {
    const headers = {};
    if (corpo !== undefined) headers['Content-Type'] = contentType || 'application/json';
    if (this.cookie) headers.Cookie = this.cookie;

    const res = await fetch(this.url + caminho, {
      method: metodo,
      redirect: 'manual',
      headers,
      // com `contentType` o corpo já vem pronto (ex.: formulário urlencoded); sem ele, é JSON
      body: corpo === undefined ? undefined : contentType ? corpo : JSON.stringify(corpo),
    });

    for (const linha of res.headers.getSetCookie()) {
      const [par] = linha.split(';');
      const [nome, ...resto] = par.split('=');
      const valor = resto.join('=');
      if (nome.trim() === 'token') this.cookie = valor ? par : '';
    }

    const tipo = res.headers.get('content-type') || '';
    const texto = await res.text();
    return {
      status: res.status,
      corpo: tipo.includes('json') ? JSON.parse(texto) : null,
      texto,
      location: res.headers.get('location'),
      headers: res.headers,
    };
  }

  /** Envia como um <form method="post"> sem JavaScript (application/x-www-form-urlencoded). */
  form(caminho, dados) {
    return this.req('POST', caminho, new URLSearchParams(dados).toString(), {
      contentType: 'application/x-www-form-urlencoded',
    });
  }

  get(caminho) { return this.req('GET', caminho); }
  post(caminho, corpo = {}) { return this.req('POST', caminho, corpo); }
  patch(caminho, corpo = {}) { return this.req('PATCH', caminho, corpo); }
  delete(caminho) { return this.req('DELETE', caminho); }

  async entrar(email, senha = SENHA_PADRAO) {
    const r = await this.post('/auth/login', { email, senha });
    if (r.status !== 200) throw new Error(`Login de teste falhou (${r.status}): ${r.texto}`);
    return r;
  }
}

module.exports = { config, resetarBanco, iniciarServidor, criarContas, Cliente, SENHA_PADRAO };
