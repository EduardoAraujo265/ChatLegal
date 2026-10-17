const test = require('node:test');
const assert = require('node:assert/strict');
const { resetarBanco, criarContas, Cliente } = require('./helpers/ambiente');
const { iniciarNaCamadaVercel } = require('./helpers/camadaVercel');

// Mesmos fluxos, mas com a aplicação rodando por dentro da camada que imita o runtime da Vercel.
let camada;
let c;
const novo = () => new Cliente(camada.url);

test.before(async () => {
  await resetarBanco();
  await criarContas([
    { nome: 'Ana', email: 'ana@exemplo.com' },
    { nome: 'Chefe', email: 'chefe@exemplo.com', papel: 'admin' },
  ]);
  camada = await iniciarNaCamadaVercel(require('../src/app'));
});
test.after(async () => {
  await camada.fechar();
  await require('../src/config/database').close();
});

test('páginas e arquivos estáticos são servidos', async () => {
  c = novo();
  for (const [caminho, tipo] of [['/login', /html/], ['/cadastro', /html/], ['/js/entrar.js', /javascript/], ['/js/sala.js', /javascript/], ['/css/app.css', /css/]]) {
    const r = await c.get(caminho);
    assert.equal(r.status, 200, caminho);
    assert.match(r.headers.get('content-type'), tipo, caminho);
  }
});

test('login e cadastro por JSON (POST de verdade) funcionam, com cookie de sessão', async () => {
  const login = await c.post('/auth/login', { email: 'ana@exemplo.com', senha: 'senha12345' });
  assert.equal(login.status, 200);
  assert.ok(c.cookie.startsWith('token='));
  assert.equal((await c.get('/auth/eu')).status, 200);

  const outro = novo();
  const cadastro = await outro.post('/auth/cadastro', { nome: 'Nova', email: 'nova@exemplo.com', senha: 'senha1234' });
  assert.equal(cadastro.status, 201);
  assert.equal((await outro.get('/auth/eu')).corpo.usuario.papel, 'usuario');
});

test('login e cadastro pelo formulário clássico: o redirecionamento preserva o cookie', async () => {
  const f = novo();
  const r = await f.form('/auth/login', { email: 'ana@exemplo.com', senha: 'senha12345' });
  assert.equal(r.status, 303);
  assert.equal(r.location, '/chat');
  assert.ok(f.cookie.startsWith('token='), 'o Set-Cookie precisa sobreviver ao redirect da plataforma');
  assert.equal((await f.get('/auth/eu')).status, 200);

  const errado = await novo().form('/auth/login', { email: 'ana@exemplo.com', senha: 'errada-errada' });
  assert.equal(errado.location, '/login?erro=credenciais');
});

test('credenciais na URL são recusadas também na camada da Vercel', async () => {
  const r = await novo().get('/login?email=a%40b.com&senha=segredo');
  assert.equal(r.status, 303);
  assert.equal(r.location, '/login');
  assert.equal((await novo().get('/auth/login')).status, 405);
});

test('redirecionamentos de página (a plataforma usa 307) levam ao lugar certo', async () => {
  const anonimo = await novo().get('/chat');
  assert.ok([302, 303, 307].includes(anonimo.status));
  assert.equal(anonimo.location, '/login');

  const logado = novo();
  await logado.entrar('ana@exemplo.com');
  assert.equal((await logado.get('/chat')).status, 200);
  assert.equal((await logado.get('/login')).location, '/chat');
});

test('API autenticada: consulta com query string, POST, PATCH e DELETE', async () => {
  const admin = novo();
  await admin.entrar('chefe@exemplo.com');

  const lista = await admin.get('/usuarios?nome=ana&limite=3&pagina=1&ordenar=nome&direcao=asc');
  assert.equal(lista.status, 200);
  assert.equal(lista.corpo.paginacao.limite, 3);

  const criado = await admin.post('/usuarios', { nome: 'Via Vercel', email: 'viavercel@exemplo.com', senha: 'senha1234' });
  assert.equal(criado.status, 201);
  const id = criado.corpo.usuario.id;
  assert.equal((await admin.patch(`/usuarios/${id}`, { nome: 'Editado' })).corpo.usuario.nome, 'Editado');
  assert.equal((await admin.delete(`/usuarios/${id}`)).status, 200);

  const msg = await admin.post('/mensagens', { texto: 'olá 🚀' });
  assert.equal(msg.status, 201);
  const novas = await admin.get(`/mensagens?depois=${msg.corpo.mensagem.id - 1}`);
  assert.equal(novas.corpo.mensagens.length, 1);
});

test('JSON malformado devolve 400 (e não derruba a função)', async () => {
  const res = await fetch(`${camada.url}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{ quebrado' });
  assert.equal(res.status, 400);
});
