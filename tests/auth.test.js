const test = require('node:test');
const assert = require('node:assert/strict');
const { resetarBanco, iniciarServidor, criarContas, Cliente } = require('./helpers/ambiente');

let servidor;
const novo = () => new Cliente(servidor.url);

test.before(async () => {
  await resetarBanco();
  servidor = await iniciarServidor();
});
test.after(() => servidor.fechar());

const DADOS = { nome: 'Ana Souza', email: 'Ana@Exemplo.com', telefone: '(21) 99999-9999', senha: 'senha1234' };

test('cadastro cria a conta, normaliza os dados e já deixa a pessoa logada', async () => {
  const c = novo();
  const r = await c.post('/auth/cadastro', DADOS);

  assert.equal(r.status, 201);
  assert.equal(r.corpo.usuario.email, 'ana@exemplo.com'); // minúsculas
  assert.equal(r.corpo.usuario.telefone, '21999999999'); // só dígitos
  assert.equal(r.corpo.usuario.papel, 'usuario');
  assert.equal(JSON.stringify(r.corpo).includes('senha'), false, 'a resposta não pode conter a senha');

  const eu = await c.get('/auth/eu');
  assert.equal(eu.status, 200);
  assert.equal(eu.corpo.usuario.nome, 'Ana Souza');
});

test('cadastro ignora um "papel" enviado pelo cliente (ninguém vira admin se cadastrando)', async () => {
  const r = await novo().post('/auth/cadastro', {
    nome: 'Espertinho', email: 'esperto@exemplo.com', senha: 'senha1234', papel: 'admin',
  });
  assert.equal(r.status, 201);
  assert.equal(r.corpo.usuario.papel, 'usuario');
});

test('telefone é opcional no cadastro', async () => {
  const r = await novo().post('/auth/cadastro', { nome: 'Sem Fone', email: 'semfone@exemplo.com', senha: 'senha1234' });
  assert.equal(r.status, 201);
  assert.equal(r.corpo.usuario.telefone, null);
});

test('cadastro com e-mail repetido (mesmo com outra caixa) devolve 409 apontando o campo', async () => {
  const r = await novo().post('/auth/cadastro', { ...DADOS, email: 'ANA@exemplo.com' });
  assert.equal(r.status, 409);
  assert.equal(r.corpo.errors[0].campo, 'email');
});

test('cadastro valida os campos e devolve um erro por campo', async () => {
  const r = await novo().post('/auth/cadastro', { nome: '  ', email: 'nao-e-email', telefone: '123', senha: 'curta' });
  assert.equal(r.status, 400);
  const campos = r.corpo.errors.map((e) => e.campo).sort();
  assert.deepEqual(campos, ['email', 'nome', 'senha', 'telefone']);
});

test('senha com mais de 72 bytes é recusada (o bcrypt cortaria o resto em silêncio)', async () => {
  const r = await novo().post('/auth/cadastro', { nome: 'Longa', email: 'longa@exemplo.com', senha: 'a'.repeat(73) });
  assert.equal(r.status, 400);
  assert.equal(r.corpo.errors[0].campo, 'senha');
});

test('login correto cria a sessão; a resposta nunca traz a senha', async () => {
  const c = novo();
  const r = await c.post('/auth/login', { email: 'ana@exemplo.com', senha: 'senha1234' });
  assert.equal(r.status, 200);
  assert.equal(JSON.stringify(r.corpo).includes('senha'), false);
  assert.equal((await c.get('/auth/eu')).status, 200);
});

test('login aceita o e-mail em qualquer caixa', async () => {
  const r = await novo().post('/auth/login', { email: 'ANA@Exemplo.COM', senha: 'senha1234' });
  assert.equal(r.status, 200);
});

test('senha errada e e-mail inexistente recebem exatamente a mesma resposta', async () => {
  const c1 = novo();
  const c2 = novo();
  const errada = await c1.post('/auth/login', { email: 'ana@exemplo.com', senha: 'errada-errada' });
  const inexistente = await c2.post('/auth/login', { email: 'ninguem@exemplo.com', senha: 'senha1234' });

  assert.equal(errada.status, 401);
  assert.equal(inexistente.status, 401);
  assert.equal(errada.corpo.message, inexistente.corpo.message);
  assert.equal(c1.cookie, '', 'não pode criar cookie em login falho');
});

test('sem login, /auth/eu responde 401', async () => {
  assert.equal((await novo().get('/auth/eu')).status, 401);
});

test('logout encerra a sessão', async () => {
  const c = novo();
  await c.entrar('ana@exemplo.com', 'senha1234');
  assert.equal((await c.post('/auth/logout')).status, 200);
  assert.equal((await c.get('/auth/eu')).status, 401);
});

test('a sessão de uma conta excluída deixa de valer imediatamente', async () => {
  const [conta] = await criarContas([{ nome: 'Vai Sair', email: 'vaisair@exemplo.com' }]);
  const c = novo();
  await c.entrar(conta.email);
  assert.equal((await c.get('/auth/eu')).status, 200);

  await require('../src/config/database').run('DELETE FROM usuarios WHERE id = ?', [conta.id]);
  assert.equal((await c.get('/auth/eu')).status, 401);
});

test('JSON malformado devolve 400 em português, não um erro 500', async () => {
  const res = await fetch(`${servidor.url}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ isso nao e json',
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).message, /JSON/);
});
