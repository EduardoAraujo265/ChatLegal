const { all, one, run, like, escapeLike } = require('../config/database');

// A senha (hash) só é lida em findByEmail, para conferir o login. Nunca vai para o front-end.
const COLUNAS_PUBLICAS = 'id, nome, email, telefone, papel, criado_em';

// Colunas pelas quais a listagem pode ser ordenada (lista fechada: o nome vai direto no SQL).
const ORDENAVEIS = { id: 'id', nome: 'nome', email: 'email', criado: 'criado_em' };

function montarFiltros({ nome, email, telefone, papel } = {}) {
  const condicoes = [];
  const params = [];

  if (nome) {
    condicoes.push(like('nome'));
    params.push(`%${escapeLike(nome)}%`);
  }
  if (email) {
    condicoes.push(like('email'));
    params.push(`%${escapeLike(email)}%`);
  }
  const digitos = telefone ? String(telefone).replace(/\D/g, '') : '';
  if (digitos) {
    condicoes.push(like('telefone'));
    params.push(`%${digitos}%`);
  }
  if (papel) {
    condicoes.push('papel = ?');
    params.push(papel);
  }

  return { where: condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '', params };
}

async function contar(filtros) {
  const { where, params } = montarFiltros(filtros);
  const linha = await one(`SELECT COUNT(*) AS total FROM usuarios ${where}`, params);
  return Number(linha.total);
}

async function listar(filtros, { limite, offset, ordenar = 'id', direcao = 'desc' }) {
  const { where, params } = montarFiltros(filtros);
  const coluna = ORDENAVEIS[ordenar] || 'id';
  const sentido = direcao === 'asc' ? 'ASC' : 'DESC';

  // `id` como desempate mantém a ordem estável entre páginas quando o valor se repete.
  return all(
    `SELECT ${COLUNAS_PUBLICAS} FROM usuarios ${where}
      ORDER BY ${coluna} ${sentido}, id ${sentido} LIMIT ? OFFSET ?`,
    [...params, limite, offset]
  );
}

function findById(id) {
  return one(`SELECT ${COLUNAS_PUBLICAS} FROM usuarios WHERE id = ?`, [id]);
}

/** Inclui o hash da senha: use apenas para autenticar. */
function findByEmail(email) {
  return one('SELECT id, nome, email, papel, senha FROM usuarios WHERE email = ?', [email]);
}

async function create({ nome, email, telefone = null, senhaHash, papel = 'usuario' }) {
  const { insertId } = await run(
    'INSERT INTO usuarios (nome, email, telefone, senha, papel) VALUES (?, ?, ?, ?, ?)',
    [nome, email, telefone, senhaHash, papel]
  );
  return findById(insertId);
}

// Só as chaves informadas são alteradas (PATCH de verdade); `senhaHash` grava na coluna `senha`.
const COLUNAS_EDITAVEIS = {
  nome: 'nome',
  email: 'email',
  telefone: 'telefone',
  senhaHash: 'senha',
  papel: 'papel',
};

async function update(id, campos) {
  const atribuicoes = [];
  const params = [];

  for (const [chave, coluna] of Object.entries(COLUNAS_EDITAVEIS)) {
    if (campos[chave] !== undefined) {
      atribuicoes.push(`${coluna} = ?`);
      params.push(campos[chave]);
    }
  }
  if (atribuicoes.length === 0) return findById(id);

  await run(`UPDATE usuarios SET ${atribuicoes.join(', ')} WHERE id = ?`, [...params, id]);
  return findById(id);
}

async function remove(id) {
  const { affectedRows } = await run('DELETE FROM usuarios WHERE id = ?', [id]);
  return affectedRows > 0;
}

module.exports = { contar, listar, findById, findByEmail, create, update, remove };
