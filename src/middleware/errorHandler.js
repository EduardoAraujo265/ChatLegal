const { isSchemaError } = require('../config/database');

function notFound(req, res) {
  res.status(404).json({ message: 'Rota não encontrada' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Corpo JSON malformado: o body-parser do Express marca com `type`; o runtime da Vercel lança
  // um erro com `statusCode: 400` e a mensagem "Invalid JSON" ao ler req.body.
  if (err.type === 'entity.parse.failed' || err.message === 'Invalid JSON') {
    return res.status(400).json({ message: 'Corpo da requisição inválido (JSON malformado).' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Requisição grande demais.' });
  }

  if (isSchemaError(err)) {
    console.error(
      `O banco de dados não tem a estrutura que esta versão do código espera (${err.code}: ${err.sqlMessage || err.message}).\n` +
        'Rode "npm run db:init" com o .env apontando para ESTE banco.'
    );
    return res.status(503).json({
      message: 'O banco de dados está desatualizado. Quem administra o sistema precisa rodar "npm run db:init".',
    });
  }

  console.error(err);

  const status = err.status || err.statusCode || 500;
  const message = status === 500 ? 'Erro interno do servidor' : err.message || 'Erro na requisição';

  res.status(status).json({ message });
}

module.exports = { notFound, errorHandler };
