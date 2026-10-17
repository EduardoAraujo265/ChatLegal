const test = require('node:test');
const assert = require('node:assert/strict');
const { resetarBanco, iniciarServidor, criarContas, Cliente } = require('./helpers/ambiente');

let servidor;
let admin; // cliente logado como admin
let adminConta;
const isPostgres = (process.env.DB_CLIENT || 'mysql') === 'postgres';

const novo = () => new Cliente(servidor.url);
const lista = (qs = '') => admin.get(`/usuarios${qs}`);

test.before(async () => {
  await resetarBanco();
  servidor = await iniciarServidor();

  [adminConta] = await criarContas([{ nome: 'Chefe Admin', email: 'admin@exemplo.com', papel: 'admin' }]);

  // 24 contas: 22 com nomes "Pessoa NN", mais três com "ana" no nome para testar a busca.
  const base = Array.from({ length: 21 }, (_, i) => ({
    nome: `Pessoa ${String(i + 1).padStart(2, '0')}`,
    email: `pessoa${i + 1}@exemplo.com`,
    telefone: `2198000${String(1000 + i)}`,
  }));
  await criarContas([
    ...base,
    { nome: 'Ana Souza', email: 'ana.souza@dominio.org', telefone: '21977770001' },
    { nome: 'Mariana Lima', email: 'mari@exemplo.com', telefone: '11966660002' },
    { nome: 'Joana Dias', email: 'joana@exemplo.com', telefone: '21955550003', papel: 'admin' },
  ]);

  admin = novo();
  await admin.entrar('admin@exemplo.com');
});
test.after(() => servidor.fechar());

// ---------- quem pode acessar ----------

test('sem login: 401. Conta comum: 403. Admin: 200', async () => {
  assert.equal((await novo().get('/usuarios')).status, 401);

  const comum = novo();
  await comum.post('/auth/cadastro', { nome: 'Curioso', email: 'curioso@exemplo.com', senha: 'senha1234' });
  assert.equal((await comum.get('/usuarios')).status, 403);
  assert.equal((await comum.post('/usuarios', { nome: 'X' })).status, 403);
  assert.equal((await comum.delete('/usuarios/1')).status, 403);

  assert.equal((await lista()).status, 200);
});

test('a listagem nunca expõe a senha', async () => {
  const r = await lista();
  assert.equal(JSON.stringify(r.corpo).toLowerCase().includes('senha'), false);
  assert.deepEqual(Object.keys(r.corpo.dados[0]).sort(), ['criadoEm', 'email', 'id', 'nome', 'papel', 'telefone']);
});

// ---------- paginação ----------

test('paginação: total, páginas e quantidade por página', async () => {
  // 1 admin + 21 + 3 = 25 contas (+1 do teste anterior que se cadastrou = 26)
  const total = (await lista('?limite=100')).corpo.paginacao.total;
  assert.ok(total >= 25);

  const p1 = (await lista('?limite=10&pagina=1')).corpo;
  assert.equal(p1.dados.length, 10);
  assert.equal(p1.paginacao.pagina, 1);
  assert.equal(p1.paginacao.limite, 10);
  assert.equal(p1.paginacao.totalPaginas, Math.ceil(total / 10));
  assert.deepEqual(p1.paginacao.paginas, [1, 2, 3]);

  const ultima = (await lista(`?limite=10&pagina=${p1.paginacao.totalPaginas}`)).corpo;
  assert.equal(ultima.dados.length, total % 10 || 10);
});

test('as páginas não repetem nem perdem registros', async () => {
  const ids = [];
  const { totalPaginas } = (await lista('?limite=7')).corpo.paginacao;
  assert.ok(totalPaginas >= 4);
  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    const r = (await lista(`?limite=7&pagina=${pagina}`)).corpo;
    ids.push(...r.dados.map((u) => u.id));
  }
  const todos = (await lista('?limite=100')).corpo.dados.map((u) => u.id);
  assert.deepEqual(ids, todos);
  assert.equal(new Set(ids).size, ids.length);
});

test('página além do fim é ajustada para a última; ordem padrão é do mais novo para o mais antigo', async () => {
  const r = (await lista('?limite=10&pagina=999')).corpo;
  assert.equal(r.paginacao.pagina, r.paginacao.totalPaginas);
  assert.ok(r.dados.length > 0);

  const ids = (await lista('?limite=100')).corpo.dados.map((u) => u.id);
  assert.deepEqual(ids, [...ids].sort((a, b) => b - a));
});

test('parâmetros de paginação inválidos devolvem 400', async () => {
  assert.equal((await lista('?limite=0')).status, 400);
  assert.equal((await lista('?limite=101')).status, 400);
  assert.equal((await lista('?pagina=0')).status, 400);
  assert.equal((await lista('?pagina=abc')).status, 400);
  assert.equal((await lista('?ordenar=senha')).status, 400);
  assert.equal((await lista('?papel=root')).status, 400);
});

// ---------- filtros ----------

test('filtro por nome: contém, sem diferenciar maiúsculas', async () => {
  const r = (await lista('?nome=ANA')).corpo;
  assert.deepEqual(r.dados.map((u) => u.nome).sort(), ['Ana Souza', 'Joana Dias', 'Mariana Lima']);
  assert.equal(r.paginacao.total, 3);
});

test('filtro por e-mail', async () => {
  const r = (await lista('?email=dominio.org')).corpo;
  assert.deepEqual(r.dados.map((u) => u.nome), ['Ana Souza']);
});

test('filtro por telefone aceita número formatado', async () => {
  const r = (await lista(`?telefone=${encodeURIComponent('(11) 96666')}`)).corpo;
  assert.deepEqual(r.dados.map((u) => u.nome), ['Mariana Lima']);
});

test('filtro por papel', async () => {
  const r = (await lista('?papel=admin')).corpo;
  assert.deepEqual(r.dados.map((u) => u.nome).sort(), ['Chefe Admin', 'Joana Dias']);
  assert.ok(r.dados.every((u) => u.papel === 'admin'));
});

test('filtros combinados (E): nome + papel; e o total reflete o filtro', async () => {
  const r = (await lista('?nome=ana&papel=admin')).corpo;
  assert.deepEqual(r.dados.map((u) => u.nome), ['Joana Dias']);
  assert.equal(r.paginacao.total, 1);
  assert.equal(r.paginacao.totalPaginas, 1);
});

test('filtro sem resultado: lista vazia, total 0, uma página', async () => {
  const r = (await lista('?nome=zzzzzz')).corpo;
  assert.deepEqual(r.dados, []);
  assert.equal(r.paginacao.total, 0);
  assert.equal(r.paginacao.totalPaginas, 1);
  assert.equal(r.paginacao.pagina, 1);
});

test('filtros e paginação funcionam juntos', async () => {
  const p1 = (await lista('?nome=pessoa&limite=10&pagina=1')).corpo;
  const p3 = (await lista('?nome=pessoa&limite=10&pagina=3')).corpo;
  assert.equal(p1.paginacao.total, 21);
  assert.equal(p1.paginacao.totalPaginas, 3);
  assert.equal(p1.dados.length, 10);
  assert.equal(p3.dados.length, 1);
});

test('%, _ e ! digitados na busca valem como texto literal (não como curinga)', async () => {
  await criarContas([
    { nome: '100% Real', email: 'cem@exemplo.com' },
    { nome: 'Joao_Silva', email: 'joao_s@exemplo.com' },
    { nome: 'Uau! Grande', email: 'uau@exemplo.com' },
  ]);
  assert.deepEqual((await lista(`?nome=${encodeURIComponent('%')}`)).corpo.dados.map((u) => u.nome), ['100% Real']);
  assert.deepEqual((await lista(`?nome=${encodeURIComponent('_')}`)).corpo.dados.map((u) => u.nome), ['Joao_Silva']);
  assert.deepEqual((await lista(`?nome=${encodeURIComponent('!')}`)).corpo.dados.map((u) => u.nome), ['Uau! Grande']);
});

test('tentativa de SQL injection na busca é tratada como texto comum', async () => {
  const r = await lista(`?nome=${encodeURIComponent("' OR '1'='1")}`);
  assert.equal(r.status, 200);
  assert.equal(r.corpo.paginacao.total, 0);
});

test('busca ignora acentos (MySQL, collation utf8mb4_unicode_ci)', { skip: isPostgres && 'PostgreSQL diferencia acentos' }, async () => {
  await criarContas([{ nome: 'José Álvares', email: 'jose@exemplo.com' }]);
  assert.deepEqual((await lista('?nome=jose%20alvares')).corpo.dados.map((u) => u.nome), ['José Álvares']);
});

// ---------- ordenação ----------

test('ordenar por nome (crescente e decrescente)', async () => {
  const asc = (await lista('?ordenar=nome&direcao=asc&limite=100')).corpo.dados.map((u) => u.nome);
  const desc = (await lista('?ordenar=nome&direcao=desc&limite=100')).corpo.dados.map((u) => u.nome);
  const esperado = [...asc].sort((a, b) => a.localeCompare(b, 'pt'));
  assert.equal(asc.length, desc.length);
  assert.deepEqual(asc.slice(0, 3), esperado.slice(0, 3));
  assert.deepEqual(desc, [...asc].reverse());
});

// ---------- criar ----------

test('admin cria usuário com papel; e-mail repetido devolve 409; dados inválidos 400', async () => {
  const ok = await admin.post('/usuarios', { nome: 'Nova Pessoa', email: 'nova@exemplo.com', telefone: '21912345678', senha: 'senha1234', papel: 'admin' });
  assert.equal(ok.status, 201);
  assert.equal(ok.corpo.usuario.papel, 'admin');

  assert.equal((await admin.post('/usuarios', { nome: 'Outra', email: 'NOVA@exemplo.com', senha: 'senha1234' })).status, 409);
  assert.equal((await admin.post('/usuarios', { nome: '', email: 'x', senha: '1' })).status, 400);
  assert.equal((await admin.post('/usuarios', { nome: 'P', email: 'p@exemplo.com', senha: 'senha1234', papel: 'dono' })).status, 400);
});

// ---------- atualizar ----------

test('PATCH sem senha mantém a senha atual; com senha, troca', async () => {
  const [conta] = await criarContas([{ nome: 'Para Editar', email: 'editar@exemplo.com' }]);

  const r1 = await admin.patch(`/usuarios/${conta.id}`, { nome: 'Editado', telefone: '(21) 98888-7777', senha: '' });
  assert.equal(r1.status, 200);
  assert.equal(r1.corpo.usuario.nome, 'Editado');
  assert.equal(r1.corpo.usuario.telefone, '21988887777');
  await novo().entrar('editar@exemplo.com', conta.senha); // senha antiga continua valendo

  assert.equal((await admin.patch(`/usuarios/${conta.id}`, { senha: 'nova-senha-123' })).status, 200);
  assert.equal((await novo().post('/auth/login', { email: 'editar@exemplo.com', senha: conta.senha })).status, 401);
  await novo().entrar('editar@exemplo.com', 'nova-senha-123');
});

test('PATCH: telefone vazio limpa o campo; papel pode mudar; e-mail repetido é 409', async () => {
  const [conta] = await criarContas([{ nome: 'Outro', email: 'outro@exemplo.com', telefone: '21999990000' }]);

  const limpo = await admin.patch(`/usuarios/${conta.id}`, { telefone: '' });
  assert.equal(limpo.corpo.usuario.telefone, null);

  const promovido = await admin.patch(`/usuarios/${conta.id}`, { papel: 'admin' });
  assert.equal(promovido.corpo.usuario.papel, 'admin');

  assert.equal((await admin.patch(`/usuarios/${conta.id}`, { email: 'admin@exemplo.com' })).status, 409);
});

test('PATCH: id inexistente 404, id inválido 400, corpo vazio 400', async () => {
  assert.equal((await admin.patch('/usuarios/999999', { nome: 'X' })).status, 404);
  assert.equal((await admin.patch('/usuarios/abc', { nome: 'X' })).status, 400);
  assert.equal((await admin.patch(`/usuarios/${adminConta.id}`, {})).status, 400);
});

test('o admin não consegue tirar o próprio papel de admin', async () => {
  const r = await admin.patch(`/usuarios/${adminConta.id}`, { papel: 'usuario' });
  assert.equal(r.status, 400);
  assert.equal((await lista()).status, 200); // continua admin
});

// ---------- excluir ----------

test('excluir: não pode a própria conta; outra conta sim; inexistente 404', async () => {
  assert.equal((await admin.delete(`/usuarios/${adminConta.id}`)).status, 400);

  const [conta] = await criarContas([{ nome: 'Vai Embora', email: 'embora@exemplo.com' }]);
  assert.equal((await admin.delete(`/usuarios/${conta.id}`)).status, 200);
  assert.equal((await admin.delete(`/usuarios/${conta.id}`)).status, 404);
});

test('excluir uma conta preserva as mensagens dela (autor vira "removido")', async () => {
  const [conta] = await criarContas([{ nome: 'Falante', email: 'falante@exemplo.com' }]);
  const falante = novo();
  await falante.entrar(conta.email);
  const enviada = await falante.post('/mensagens', { texto: 'Mensagem que deve sobreviver' });
  assert.equal(enviada.status, 201);

  assert.equal((await admin.delete(`/usuarios/${conta.id}`)).status, 200);

  const historico = (await admin.get('/mensagens')).corpo.mensagens;
  const sobrevivente = historico.find((m) => m.texto === 'Mensagem que deve sobreviver');
  assert.ok(sobrevivente, 'a mensagem continua no histórico');
  assert.equal(sobrevivente.autor, null);
  assert.equal(sobrevivente.usuarioId, null);
});
