const test = require('node:test');
const assert = require('node:assert/strict');
const { resetarBanco, iniciarServidor, criarContas, Cliente, config } = require('./helpers/ambiente');
const { ensureSchema } = require('../database/schema');

let servidor;
const novo = () => new Cliente(servidor.url);

test.before(async () => {
  await resetarBanco();
  servidor = await iniciarServidor();
  await criarContas([
    { nome: 'Ana', email: 'ana@exemplo.com' },
    { nome: 'Chefe', email: 'chefe@exemplo.com', papel: 'admin' },
  ]);
});
test.after(() => servidor.fechar());

// ---------- nenhum formulário com dado sensível pode ser enviado por GET ----------

test('todo <form> com senha ou texto digitado usa method="post"', async () => {
  const admin = novo();
  await admin.entrar('chefe@exemplo.com');
  const paginas = [
    ['/login', novo()],
    ['/cadastro', novo()],
    ['/chat', admin],
    ['/dashboard', admin],
  ];

  for (const [caminho, cliente] of paginas) {
    const { texto } = await cliente.get(caminho);
    const formularios = texto.match(/<form\b[^>]*>[\s\S]*?<\/form>/gi) || [];
    assert.ok(formularios.length > 0, `${caminho}: nenhum formulário encontrado`);

    for (const form of formularios) {
      const abertura = form.match(/<form\b[^>]*>/i)[0];
      const sensivel = /type="password"|<textarea/i.test(form);
      if (sensivel) {
        assert.match(abertura, /method="post"/i, `${caminho}: formulário com dado sensível sem method="post": ${abertura}`);
        assert.match(abertura, /action="\//i, `${caminho}: formulário sem action explícito`);
      }
    }
  }
});

// ---------- credenciais na URL: nunca processadas ----------

test('GET /auth/login e /auth/cadastro respondem 405 explicando que é preciso POST', async () => {
  for (const caminho of ['/auth/login', '/auth/cadastro']) {
    const r = await novo().get(caminho);
    assert.equal(r.status, 405, caminho);
    assert.equal(r.headers.get('allow'), 'POST');
    assert.match(r.corpo.message, /POST/);
  }
});

test('login por GET com credenciais na URL NÃO autentica e a URL é limpa por redirecionamento', async () => {
  const c = novo();
  const r = await c.get('/login?email=ana%40exemplo.com&senha=senha12345');
  assert.equal(r.status, 303);
  assert.equal(r.location, '/login', 'a query string (com a senha) precisa sumir da URL');
  assert.equal(c.cookie, '', 'não pode criar sessão');

  const viaApi = await c.get('/auth/eu?token=qualquer');
  assert.equal(viaApi.status, 303);
  assert.equal(viaApi.location, '/auth/eu');
});

test('POST com senha na URL é recusado (400)', async () => {
  const r = await novo().post('/auth/login?senha=senha12345', { email: 'ana@exemplo.com', senha: 'senha12345' });
  assert.equal(r.status, 400);
  assert.match(r.corpo.message, /URL/);
});

// ---------- login pelo formulário clássico (sem JavaScript) ----------

test('formulário clássico: login correto redireciona para /chat com sessão', async () => {
  const c = novo();
  const r = await c.form('/auth/login', { email: 'Ana@Exemplo.com', senha: 'senha12345' });
  assert.equal(r.status, 303);
  assert.equal(r.location, '/chat');
  assert.equal((await c.get('/auth/eu')).status, 200);
});

test('formulário clássico: senha errada volta ao login com o motivo, sem sessão e sem eco do que foi digitado', async () => {
  const c = novo();
  const r = await c.form('/auth/login', { email: 'ana@exemplo.com', senha: 'senha-errada-123' });
  assert.equal(r.status, 303);
  assert.equal(r.location, '/login?erro=credenciais');
  assert.equal(c.cookie, '');

  const pagina = await c.get(r.location);
  assert.match(pagina.texto, /E-mail ou senha incorretos\./);
  assert.doesNotMatch(r.location, /senha-errada/, 'a senha não pode viajar na URL de volta');
});

test('formulário clássico: campos inválidos listam quais conferir', async () => {
  const r = await novo().form('/auth/login', { email: 'nao-e-email', senha: '' });
  assert.equal(r.status, 303);
  assert.match(r.location, /^\/login\?erro=dados&campos=/);
  const pagina = await novo().get(r.location);
  assert.match(pagina.texto, /Confira os campos: e-mail, senha\./);
});

// ---------- cadastro pelo formulário clássico ----------

test('formulário clássico: cadastro cria a conta (papel usuario), entra logado e vai para /chat', async () => {
  const c = novo();
  const r = await c.form('/auth/cadastro', {
    nome: 'Sem Javascript', email: 'semjs@exemplo.com', telefone: '(21) 98888-7777',
    senha: 'senha1234', confirmarSenha: 'senha1234', papel: 'admin',
  });
  assert.equal(r.status, 303);
  assert.equal(r.location, '/chat');
  const eu = (await c.get('/auth/eu')).corpo.usuario;
  assert.equal(eu.nome, 'Sem Javascript');
  assert.equal(eu.telefone, '21988887777');
  assert.equal(eu.papel, 'usuario', 'o papel enviado pelo cliente continua sendo ignorado');
});

test('formulário clássico: cadastro com senhas diferentes, e-mail repetido e dados inválidos', async () => {
  const base = { nome: 'Fulano', email: 'fulano@exemplo.com', senha: 'senha1234', confirmarSenha: 'senha1234' };

  const diferentes = await novo().form('/auth/cadastro', { ...base, confirmarSenha: 'outra-coisa-1' });
  assert.equal(diferentes.location, '/cadastro?erro=senhas');
  assert.match((await novo().get(diferentes.location)).texto, /As senhas não são iguais\./);

  const repetido = await novo().form('/auth/cadastro', { ...base, email: 'ana@exemplo.com' });
  assert.equal(repetido.location, '/cadastro?erro=email_em_uso');
  assert.match((await novo().get(repetido.location)).texto, /Este e-mail já está cadastrado\./);

  const invalido = await novo().form('/auth/cadastro', { ...base, nome: '', senha: 'curta', confirmarSenha: 'curta' });
  assert.match(invalido.location, /^\/cadastro\?erro=dados&campos=/);
  assert.match((await novo().get(invalido.location)).texto, /Confira os campos: nome, senha\./);
});

test('a mensagem de erro vem de uma lista fixa: nada digitado na URL é refletido na página', async () => {
  const c = novo();
  const alvos = [
    '/login?erro=%3Cscript%3Ealert(1)%3C/script%3E',
    '/login?erro=constructor',
    '/login?erro=__proto__',
    '/login?erro=dados&campos=%3Cimg%20src%3Dx%3E,__proto__,constructor',
  ];
  for (const alvo of alvos) {
    const { texto, status } = await c.get(alvo);
    assert.equal(status, 200, alvo);
    assert.doesNotMatch(texto, /<script>alert|<img src=x>|function Object|\[native code\]/i, alvo);
    assert.match(texto, /<div class="form__erro" id="erro-geral" role="alert">(Confira os dados informados\.)?<\/div>/, alvo);
  }
});

test('JSON continua sendo JSON (o caminho com JavaScript não mudou)', async () => {
  const ok = await novo().post('/auth/login', { email: 'ana@exemplo.com', senha: 'senha12345' });
  assert.equal(ok.status, 200);
  assert.equal(ok.corpo.message, 'Login bem-sucedido');
  const ruim = await novo().post('/auth/login', { email: 'ana@exemplo.com', senha: 'errada-errada' });
  assert.equal(ruim.status, 401);
});

// ---------- banco desatualizado: o erro diz o que fazer ----------

test('/saude: ok no banco correto', async () => {
  const r = await novo().get('/saude');
  assert.equal(r.status, 200);
  assert.equal(r.corpo.banco, 'ok');
  assert.equal(r.corpo.estaticos, 'ok', 'os arquivos estáticos precisam existir no servidor');
  assert.match(r.corpo.versao, /^\d+\.\d+\.\d+$/);
  assert.equal(JSON.stringify(r.corpo).includes('senha'), false);
});

test('banco desatualizado: /saude e o login explicam o problema em vez de um "erro interno" genérico', async () => {
  await require('../src/config/database').run('ALTER TABLE usuarios DROP COLUMN papel');
  const silenciar = console.error;
  console.error = () => {};
  try {
    const saude = await novo().get('/saude');
    assert.equal(saude.status, 503);
    assert.equal(saude.corpo.banco, 'desatualizado');
    assert.match(saude.corpo.dica, /db:init/);

    const login = await novo().post('/auth/login', { email: 'ana@exemplo.com', senha: 'senha12345' });
    assert.equal(login.status, 503);
    assert.match(login.corpo.message, /db:init/);
  } finally {
    console.error = silenciar;
    await ensureSchema(config, { logger: { info() {}, warn() {} } }); // o db:init conserta
  }
  assert.equal((await novo().get('/saude')).status, 200);
  assert.equal((await novo().post('/auth/login', { email: 'ana@exemplo.com', senha: 'senha12345' })).status, 200);
});
