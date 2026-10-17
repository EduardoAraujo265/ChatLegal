const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

/**
 * Cria uma conta de administrador ou, se o e-mail já existir, promove a conta
 * a admin e redefine a senha. `conn` vem de database/connection.js.
 * Retorna 'criado' ou 'atualizado'.
 */
async function salvarAdmin(conn, { nome, email, senha }) {
  const emailNormalizado = String(email).trim().toLowerCase();
  const hash = await bcrypt.hash(senha, SALT_ROUNDS);

  const existente = await conn.query('SELECT id FROM usuarios WHERE email = ?', [emailNormalizado]);

  if (existente.length > 0) {
    await conn.query("UPDATE usuarios SET papel = 'admin', senha = ? WHERE id = ?", [
      hash,
      existente[0].id,
    ]);
    return 'atualizado';
  }

  await conn.query("INSERT INTO usuarios (nome, email, senha, papel) VALUES (?, ?, ?, 'admin')", [
    nome,
    emailNormalizado,
    hash,
  ]);
  return 'criado';
}

module.exports = { salvarAdmin };
