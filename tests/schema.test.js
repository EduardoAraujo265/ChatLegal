const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { config, resetarBanco } = require('./helpers/ambiente');
const { conectar } = require('../database/connection');
const { ensureSchema, tabelaExiste, colunaExiste } = require('../database/schema');

const mysql = config.dbClient === 'mysql';

// Esquema do projeto ANTES desta versão (duas tabelas separadas, sem papel nem e-mail único).
const ESQUEMA_ANTIGO = mysql
  ? `CREATE TABLE usuarios (
       id int NOT NULL AUTO_INCREMENT, nome varchar(498) DEFAULT NULL, email varchar(255) DEFAULT NULL,
       telefone char(11) DEFAULT NULL, senha varchar(255) DEFAULT NULL, PRIMARY KEY (id));
     CREATE TABLE admins (
       id int NOT NULL AUTO_INCREMENT, nome varchar(500) DEFAULT NULL, email varchar(255) DEFAULT NULL,
       senha varchar(255) DEFAULT NULL, PRIMARY KEY (id));`
  : `CREATE TABLE public.usuarios (
       id SERIAL PRIMARY KEY, nome character varying(498), email character varying(253),
       telefone character(11), senha character varying(253));
     CREATE TABLE public.admins (
       id SERIAL PRIMARY KEY, nome character varying(500), email character varying(253),
       senha character varying(253));`;

function capturar() {
  const info = [];
  const avisos = [];
  return { logger: { info: (m) => info.push(m), warn: (m) => avisos.push(m) }, info, avisos };
}

async function comConexao(fn) {
  const conn = await conectar(config);
  try {
    return await fn(conn);
  } finally {
    await conn.close();
  }
}

test('banco novo: cria as tabelas, e rodar de novo não muda nada', async () => {
  await resetarBanco({ criarEsquema: false });

  await ensureSchema(config, { logger: capturar().logger });
  await comConexao(async (conn) => {
    assert.ok(await tabelaExiste(conn, 'usuarios'));
    assert.ok(await tabelaExiste(conn, 'mensagens'));
    assert.ok(await colunaExiste(conn, 'usuarios', 'papel'));
    assert.ok(await colunaExiste(conn, 'usuarios', 'criado_em'));
    assert.equal(await tabelaExiste(conn, 'admins'), false);
  });

  const segunda = capturar();
  await ensureSchema(config, { logger: segunda.logger });
  assert.deepEqual(segunda.avisos, []);
  assert.ok(
    !segunda.info.some((m) => /adicionada|migrados|renomeada|índice único criado/.test(m)),
    `a segunda execução não deveria alterar nada, mas: ${segunda.info.join(' | ')}`
  );
});

test('banco antigo: atualiza usuarios, migra os admins e preserva todos os dados', async () => {
  await resetarBanco({ criarEsquema: false });
  const hash = bcrypt.hashSync('SenhaDoAdmin1', 4);

  await comConexao(async (conn) => {
    await conn.query(ESQUEMA_ANTIGO);
    for (const [nome, email, tel, senha] of [
      ['João da Silva', 'joao@x.com', '21999990000', 'hash-joao'],
      ['Maria (usuária)', 'maria@x.com', '21977770000', 'hash-maria'],
    ]) {
      await conn.query('INSERT INTO usuarios (nome, email, telefone, senha) VALUES (?, ?, ?, ?)', [nome, email, tel, senha]);
    }
    for (const [nome, email, senha] of [
      ['Eduardo', 'Admin@Faeterj.br', hash], // migra normalmente (e-mail vai para minúsculas)
      ['Maria Chefe', 'maria@x.com', hash], // conflito: o e-mail já é de uma conta comum
      ['Sem Hash', 'semhash@x.com', 'senha-em-texto-puro'], // senha não é bcrypt: não dá para migrar
    ]) {
      await conn.query('INSERT INTO admins (nome, email, senha) VALUES (?, ?, ?)', [nome, email, senha]);
    }
  });

  const r1 = capturar();
  await ensureSchema(config, { logger: r1.logger });

  await comConexao(async (conn) => {
    assert.ok(await colunaExiste(conn, 'usuarios', 'papel'), 'coluna papel criada');
    assert.ok(await colunaExiste(conn, 'usuarios', 'criado_em'), 'coluna criado_em criada');

    const contas = await conn.query('SELECT nome, email, telefone, senha, papel FROM usuarios ORDER BY id');
    const porEmail = Object.fromEntries(contas.map((c) => [c.email, c]));

    // dados antigos intactos
    assert.equal(porEmail['joao@x.com'].nome, 'João da Silva');
    assert.equal(porEmail['joao@x.com'].telefone, '21999990000');
    assert.equal(porEmail['joao@x.com'].senha, 'hash-joao');
    assert.equal(porEmail['joao@x.com'].papel, 'usuario');
    assert.equal(porEmail['maria@x.com'].papel, 'usuario', 'o conflito NÃO promove a conta comum a admin');

    // admin migrado: mesmo hash, e-mail em minúsculas, papel admin
    assert.equal(porEmail['admin@faeterj.br'].papel, 'admin');
    assert.equal(porEmail['admin@faeterj.br'].senha, hash);
    assert.equal(porEmail['admin@faeterj.br'].nome, 'Eduardo');
    assert.equal(porEmail['semhash@x.com'], undefined, 'admin sem hash bcrypt não é migrado');

    assert.ok(await tabelaExiste(conn, 'admins'), 'admins é mantida enquanto houver pendências');
  });

  assert.equal(r1.avisos.length, 1);
  assert.match(r1.avisos[0], /maria@x\.com/);
  assert.match(r1.avisos[0], /semhash@x\.com/);
  assert.match(r1.avisos[0], /create-admin/);

  // índice único agora existe
  await comConexao(async (conn) => {
    await assert.rejects(
      conn.query('INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)', ['Clone', 'joao@x.com', 'x']),
      (err) => err.code === 'ER_DUP_ENTRY' || err.code === '23505'
    );
  });

  // a pessoa resolve as pendências...
  await comConexao(async (conn) => {
    await conn.query("UPDATE usuarios SET papel = 'admin' WHERE email = 'maria@x.com'");
    await conn.query("DELETE FROM admins WHERE email = 'semhash@x.com'");
  });

  // ...e a próxima execução aposenta a tabela antiga sem mexer nos dados
  const r2 = capturar();
  await ensureSchema(config, { logger: r2.logger });
  assert.deepEqual(r2.avisos, []);
  await comConexao(async (conn) => {
    assert.equal(await tabelaExiste(conn, 'admins'), false);
    assert.ok(await tabelaExiste(conn, 'admins_legado'), 'dados antigos preservados em admins_legado');
    const [{ total }] = await conn.query('SELECT COUNT(*) AS total FROM usuarios');
    assert.equal(Number(total), 3);
  });

  const r3 = capturar();
  await ensureSchema(config, { logger: r3.logger });
  assert.deepEqual(r3.avisos, []);
  assert.ok(!r3.info.some((m) => /migrados|renomeada/.test(m)), 'terceira execução não migra de novo');
});

test('banco antigo com e-mails repetidos: avisa e NÃO cria o índice único (sem apagar nada)', async () => {
  await resetarBanco({ criarEsquema: false });
  await comConexao(async (conn) => {
    await conn.query(ESQUEMA_ANTIGO);
    for (const nome of ['Primeiro', 'Segundo']) {
      await conn.query('INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)', [nome, 'repetido@x.com', 'h']);
    }
  });

  const r = capturar();
  await ensureSchema(config, { logger: r.logger });

  assert.equal(r.avisos.length, 1);
  assert.match(r.avisos[0], /repetido@x\.com/);
  await comConexao(async (conn) => {
    const [{ total }] = await conn.query('SELECT COUNT(*) AS total FROM usuarios');
    assert.equal(Number(total), 2, 'nenhum registro é apagado');
  });
});
