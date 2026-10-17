const test = require('node:test');
const assert = require('node:assert/strict');
const { resetarBanco, iniciarServidor, criarContas, Cliente } = require('./helpers/ambiente');

let servidor;
let ana;
let bia;
const novo = () => new Cliente(servidor.url);

test.before(async () => {
  await resetarBanco();
  servidor = await iniciarServidor();
  await criarContas([
    { nome: 'Ana', email: 'ana@exemplo.com' },
    { nome: 'Bia', email: 'bia@exemplo.com', papel: 'admin' },
  ]);
  ana = novo();
  bia = novo();
  await ana.entrar('ana@exemplo.com');
  await bia.entrar('bia@exemplo.com');
});
test.after(() => servidor.fechar());

test('sem login: 401 para ler e para escrever', async () => {
  assert.equal((await novo().get('/mensagens')).status, 401);
  assert.equal((await novo().post('/mensagens', { texto: 'oi' })).status, 401);
});

test('conta comum e admin conseguem conversar; a resposta traz o autor', async () => {
  const r1 = await ana.post('/mensagens', { texto: '  Oi, pessoal!  ' });
  assert.equal(r1.status, 201);
  assert.equal(r1.corpo.mensagem.texto, 'Oi, pessoal!'); // espaços das pontas removidos
  assert.equal(r1.corpo.mensagem.autor, 'Ana');

  const r2 = await bia.post('/mensagens', { texto: 'Olá, Ana!' });
  assert.equal(r2.status, 201);
  assert.equal(r2.corpo.mensagem.autor, 'Bia');
  assert.ok(r2.corpo.mensagem.id > r1.corpo.mensagem.id);
});

test('as duas contas enxergam a mesma conversa, em ordem cronológica', async () => {
  const daAna = (await ana.get('/mensagens')).corpo.mensagens;
  const daBia = (await bia.get('/mensagens')).corpo.mensagens;
  assert.deepEqual(daAna, daBia);
  assert.deepEqual(daAna.map((m) => m.texto), ['Oi, pessoal!', 'Olá, Ana!']);
});

test('?depois=<id> devolve só as mensagens novas (usado pelo polling)', async () => {
  const antes = (await ana.get('/mensagens')).corpo.mensagens;
  const ultimoId = antes[antes.length - 1].id;

  assert.deepEqual((await ana.get(`/mensagens?depois=${ultimoId}`)).corpo.mensagens, []);

  await bia.post('/mensagens', { texto: 'nova 1' });
  await bia.post('/mensagens', { texto: 'nova 2' });
  const novas = (await ana.get(`/mensagens?depois=${ultimoId}`)).corpo.mensagens;
  assert.deepEqual(novas.map((m) => m.texto), ['nova 1', 'nova 2']);
  assert.equal((await ana.get('/mensagens?depois=abc')).status, 400);
});

test('histórico inicial traz só as 50 últimas, da mais antiga para a mais nova', async () => {
  const db = require('../src/config/database');
  for (let i = 1; i <= 60; i++) {
    await db.run('INSERT INTO mensagens (usuario_id, texto) VALUES (NULL, ?)', [`em massa ${i}`]);
  }
  const mensagens = (await ana.get('/mensagens')).corpo.mensagens;
  assert.equal(mensagens.length, 50);
  assert.equal(mensagens[49].texto, 'em massa 60');
  assert.equal(mensagens[0].texto, 'em massa 11');
  assert.deepEqual(mensagens.map((m) => m.id), [...mensagens.map((m) => m.id)].sort((a, b) => a - b));
  assert.equal(mensagens[0].autor, null); // sem autor = "Usuário removido" na tela
});

test('validação: vazia, só espaços, 501 caracteres e tipo errado → 400; exatamente 500 → 201', async () => {
  assert.equal((await ana.post('/mensagens', { texto: '' })).status, 400);
  assert.equal((await ana.post('/mensagens', { texto: '   \n  ' })).status, 400);
  assert.equal((await ana.post('/mensagens', { texto: 'a'.repeat(501) })).status, 400);
  assert.equal((await ana.post('/mensagens', { texto: 12345 })).status, 400);
  assert.equal((await ana.post('/mensagens', {})).status, 400);
  assert.equal((await ana.post('/mensagens', { texto: 'a'.repeat(500) })).status, 201);
});

test('emojis (4 bytes em UTF-8, inclusive sequências com ZWJ) vão e voltam intactos', async () => {
  const texto = 'Bora 🚀 com 👩‍💻 e 🇧🇷 — ação, coração, “aspas”';
  const r = await ana.post('/mensagens', { texto });
  assert.equal(r.status, 201);
  assert.equal(r.corpo.mensagem.texto, texto);

  const ultimas = (await bia.get('/mensagens')).corpo.mensagens;
  assert.equal(ultimas[ultimas.length - 1].texto, texto);
});

test('emojis contam como 1 caractere no limite de 500', async () => {
  const r = await ana.post('/mensagens', { texto: '🚀'.repeat(500) });
  assert.equal(r.status, 201);
  assert.equal((await ana.post('/mensagens', { texto: '🚀'.repeat(501) })).status, 400);
});

test('quebras de linha são preservadas', async () => {
  const r = await ana.post('/mensagens', { texto: 'linha 1\nlinha 2' });
  assert.equal(r.corpo.mensagem.texto, 'linha 1\nlinha 2');
});

test('o horário gravado é o instante real (sem erro de fuso horário)', async () => {
  const r = await ana.post('/mensagens', { texto: 'que horas são?' });
  const diferenca = Math.abs(Date.now() - new Date(r.corpo.mensagem.criadoEm).getTime());
  assert.ok(diferenca < 10_000, `diferença de ${diferenca} ms (um erro de fuso daria horas)`);
});

test('texto com HTML é devolvido como dado puro (escapar é papel da tela)', async () => {
  const perigoso = '<img src=x onerror=alert(1)>';
  const r = await ana.post('/mensagens', { texto: perigoso });
  assert.equal(r.corpo.mensagem.texto, perigoso);
});
