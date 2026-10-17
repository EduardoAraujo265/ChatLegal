const { all, one, run } = require('../config/database');

// LEFT JOIN: se a conta do autor foi excluída, a mensagem continua (autor = null).
const SELECT_MENSAGENS = `
  SELECT m.id, m.usuario_id, m.texto, m.criado_em, u.nome AS autor
    FROM mensagens m
    LEFT JOIN usuarios u ON u.id = m.usuario_id`;

/** As últimas `limite` mensagens, da mais antiga para a mais nova. */
async function ultimas(limite) {
  const linhas = await all(`${SELECT_MENSAGENS} ORDER BY m.id DESC LIMIT ?`, [limite]);
  return linhas.reverse();
}

/** Mensagens mais novas que `id`, em ordem cronológica (usado pelo polling do chat). */
function depoisDe(id, limite) {
  return all(`${SELECT_MENSAGENS} WHERE m.id > ? ORDER BY m.id ASC LIMIT ?`, [id, limite]);
}

async function criar({ usuarioId, texto }) {
  const { insertId } = await run('INSERT INTO mensagens (usuario_id, texto) VALUES (?, ?)', [
    usuarioId,
    texto,
  ]);
  return one(`${SELECT_MENSAGENS} WHERE m.id = ?`, [insertId]);
}

module.exports = { ultimas, depoisDe, criar };
