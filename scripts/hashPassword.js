/**
 * Gera o hash bcrypt de uma senha, para ser inserido manualmente na
 * coluna `senha` da tabela `admins`.
 *
 * Uso:
 *   node scripts/hashPassword.js "minhaSenhaSuperSecreta"
 */
const bcrypt = require('bcryptjs');

const senha = process.argv[2];

if (!senha) {
  console.error('Uso: node scripts/hashPassword.js "sua-senha"');
  process.exit(1);
}

bcrypt.hash(senha, 10).then((hash) => {
  console.log(hash);
});
