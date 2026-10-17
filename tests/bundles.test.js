const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { construir, PAGINAS } = require('../scripts/buildWeb');

const RAIZ = path.join(__dirname, '..');
const lerPublico = (...partes) => fs.readFileSync(path.join(RAIZ, 'public', ...partes), 'utf8');

test('os scripts em public/js estão em dia com o código-fonte de web/ (rode "npm run build:web" se falhar)', () => {
  const gerados = construir();
  assert.deepEqual(Object.keys(gerados).sort(), Object.keys(PAGINAS).map((n) => `${n}.js`).sort());

  for (const [nome, codigo] of Object.entries(gerados)) {
    assert.equal(lerPublico('js', nome), codigo, `public/js/${nome} está desatualizado: rode "npm run build:web"`);
  }
});

test('cada bundle é um script clássico (não módulo) e não depende de recursos modernos demais', () => {
  for (const nome of Object.keys(construir())) {
    const codigo = lerPublico('js', nome);

    // new vm.Script analisa como script comum: um import/export no topo lançaria SyntaxError
    assert.doesNotThrow(() => new vm.Script(codigo, { filename: nome }), `${nome} não é um script clássico válido`);
    assert.doesNotMatch(codigo, /^\s*(import|export)\s/m, `${nome} ainda tem import/export`);
    // compilado para ES2017: sem ??= nem encadeamento opcional (?.), que navegadores mais antigos não entendem
    assert.doesNotMatch(codigo, /\?\?=|\?\.[A-Za-z_(\[]/, `${nome} usa sintaxe moderna demais`);
  }
});

test('o primeiro comando de cada bundle marca <html data-app> (é isso que esconde o aviso de falha)', () => {
  for (const nome of Object.keys(construir())) {
    const codigo = lerPublico('js', nome);
    assert.match(codigo, /setAttribute\("data-app", "js"\)/, nome);
    assert.ok(codigo.indexOf('data-app') < codigo.indexOf('fetch('), `${nome}: a marcação precisa vir antes do resto`);
  }
});

test('as páginas carregam UM script clássico (sem type="module") e têm o aviso de falha', () => {
  const esperado = {
    'login.html': 'entrar.js',
    'cadastro.html': 'criar-conta.js',
    'chat.html': 'sala.js',
    'dashboard.html': 'usuarios.js',
  };
  for (const [pagina, bundle] of Object.entries(esperado)) {
    const html = lerPublico(pagina);
    const scripts = html.match(/<script\b[^>]*>/g) || [];
    assert.equal(scripts.length, 1, `${pagina}: esperado 1 script, achei ${scripts.length}`);
    assert.match(scripts[0], new RegExp(`^<script defer src="/js/${bundle}">$`), `${pagina}: ${scripts[0]}`);
    assert.doesNotMatch(html, /type="module"/);
    assert.match(html, /class="aviso-scripts"/, `${pagina}: falta o aviso de falha`);
    assert.match(html, /class="aviso-scripts__detalhe"/);
  }
});

test('o CSS do aviso aparece sozinho (sem JS) quando data-app não existe', () => {
  const css = lerPublico('css', 'app.css');
  assert.match(css, /html:not\(\[data-app\]\) \.aviso-scripts \{[^}]*animation: surgir-aviso 0\.01s 5s forwards/);
  assert.match(css, /html \.aviso-scripts\[data-falha\]/);
});
