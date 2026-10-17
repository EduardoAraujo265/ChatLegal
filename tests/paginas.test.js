const test = require('node:test');
const assert = require('node:assert/strict');
const { resetarBanco, iniciarServidor, criarContas, Cliente } = require('./helpers/ambiente');

let servidor;
let visitante;
let comum;
let admin;
const novo = () => new Cliente(servidor.url);
const PAGINAS = ['/login', '/cadastro'];
const PAGINAS_PROTEGIDAS = ['/chat', '/dashboard'];

test.before(async () => {
  await resetarBanco();
  servidor = await iniciarServidor();
  await criarContas([
    { nome: 'Comum', email: 'comum@exemplo.com' },
    { nome: 'Chefe', email: 'chefe@exemplo.com', papel: 'admin' },
  ]);
  visitante = novo();
  comum = novo();
  admin = novo();
  await comum.entrar('comum@exemplo.com');
  await admin.entrar('chefe@exemplo.com');
});
test.after(() => servidor.fechar());

// ---------- navegação e permissões ----------

test('/ redireciona: visitante -> /login; logado -> /chat', async () => {
  const anonimo = await visitante.get('/');
  assert.equal(anonimo.status, 302);
  assert.equal(anonimo.location, '/login');
  assert.equal((await comum.get('/')).location, '/chat');
});

test('login e cadastro são abertos ao visitante e se alcançam um pelo outro', async () => {
  const login = await visitante.get('/login');
  const cadastro = await visitante.get('/cadastro');
  assert.equal(login.status, 200);
  assert.equal(cadastro.status, 200);
  assert.match(login.headers.get('content-type'), /text\/html/);
  assert.match(login.texto, /href="\/cadastro"/, 'o login precisa linkar para o cadastro');
  assert.match(cadastro.texto, /href="\/login"/, 'o cadastro precisa linkar para o login');
});

test('quem já está logado é levado ao chat ao abrir login ou cadastro', async () => {
  for (const caminho of ['/login', '/cadastro', '/login.html', '/cadastro.html']) {
    const r = await comum.get(caminho);
    assert.equal(r.status, 302, caminho);
    assert.equal(r.location, '/chat', caminho);
  }
});

test('/chat exige login (com ou sem .html)', async () => {
  for (const caminho of ['/chat', '/chat.html']) {
    const r = await visitante.get(caminho);
    assert.equal(r.status, 302, caminho);
    assert.equal(r.location, '/login', caminho);
  }
  const logado = await comum.get('/chat');
  assert.equal(logado.status, 200);
  assert.match(logado.headers.get('cache-control'), /no-store/);
});

test('/dashboard: visitante -> /login; conta comum -> /chat; admin -> 200', async () => {
  for (const caminho of ['/dashboard', '/dashboard.html']) {
    assert.equal((await visitante.get(caminho)).location, '/login', caminho);
    assert.equal((await comum.get(caminho)).location, '/chat', caminho);
    assert.equal((await admin.get(caminho)).status, 200, caminho);
  }
});

test('rota inexistente devolve 404 em JSON', async () => {
  const r = await visitante.get('/nao-existe');
  assert.equal(r.status, 404);
  assert.equal(r.corpo.message, 'Rota não encontrada');
});

// ---------- segurança do front-end ----------

test('CSP restrita: scripts só do próprio site, sem unsafe-inline', async () => {
  const csp = (await visitante.get('/login')).headers.get('content-security-policy');
  assert.ok(csp, 'cabeçalho Content-Security-Policy ausente');
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.match(csp, /style-src 'self'(;|$)/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.match(csp, /frame-ancestors 'none'/);
});

test('nenhuma página usa script, estilo ou evento inline (a CSP bloquearia)', async () => {
  for (const caminho of [...PAGINAS, ...PAGINAS_PROTEGIDAS]) {
    const cliente = caminho === '/dashboard' ? admin : caminho === '/chat' ? comum : visitante;
    const { texto } = await cliente.get(caminho);

    assert.doesNotMatch(texto, /<script(?![^>]*\ssrc=)[^>]*>/i, `${caminho}: <script> inline`);
    assert.doesNotMatch(texto, /\sstyle\s*=/i, `${caminho}: atributo style inline`);
    assert.doesNotMatch(texto, /\son[a-z]+\s*=/i, `${caminho}: manipulador de evento inline (onclick...)`);
    assert.doesNotMatch(texto, /https?:\/\/(?!localhost)/i, `${caminho}: recurso externo (CDN)`);
  }
});

test('todo CSS, JS, imagem e fonte referenciado existe', async () => {
  const caminhos = new Set();
  const modulosJs = new Set();

  for (const caminho of [...PAGINAS, ...PAGINAS_PROTEGIDAS]) {
    const cliente = caminho === '/dashboard' ? admin : caminho === '/chat' ? comum : visitante;
    const { texto } = await cliente.get(caminho);
    for (const [, ref] of texto.matchAll(/(?:href|src)="(\/[^"#?]+\.[a-z0-9]+)"/gi)) caminhos.add(ref);
  }

  // cada página carrega UM script autossuficiente: nenhum deles pode importar outro arquivo
  for (const js of [...caminhos].filter((c) => c.endsWith('.js'))) {
    modulosJs.add(js);
    const { texto } = await visitante.get(js);
    assert.doesNotMatch(texto, /^\s*import\s|from\s+['"]\.\//m, `${js} depende de outro arquivo`);
  }
  assert.equal(modulosJs.size, 4, `esperado 1 script por página (4), achei: ${[...modulosJs]}`);

  // fontes e imagens citadas no CSS
  const css = (await visitante.get('/css/app.css')).texto;
  for (const [, ref] of css.matchAll(/url\("(\/[^"]+)"\)/g)) caminhos.add(ref);

  assert.ok(caminhos.size >= 8, `poucos recursos encontrados: ${caminhos.size}`);
  for (const caminho of caminhos) {
    const r = await visitante.get(caminho);
    assert.equal(r.status, 200, `${caminho} -> ${r.status}`);
  }
});
