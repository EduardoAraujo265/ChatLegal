/** Traduz erros comuns de conexão com o banco em mensagens que dizem o que fazer. */
function explicarErro(err, config) {
  const onde = config ? `${config.host}:${config.port}` : 'o servidor de banco';

  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return `Não consegui conectar em ${onde}. O servidor de banco está ligado e o DB_HOST/DB_PORT estão corretos?`;
  }
  if (err.code === 'ER_ACCESS_DENIED_ERROR' || err.code === '28P01') {
    return 'Usuário ou senha do banco recusados. Confira DB_USER e DB_PASSWORD no .env.';
  }
  if (err.code === 'ER_DBACCESS_DENIED_ERROR' || err.code === '42501' || err.code === 'ER_SPECIFIC_ACCESS_DENIED_ERROR') {
    return 'O usuário do banco não tem permissão para criar o banco/tabelas (precisa de CREATE e ALTER).';
  }
  return err.message;
}

module.exports = { explicarErro };
