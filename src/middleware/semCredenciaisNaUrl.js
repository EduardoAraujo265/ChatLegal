// Senhas e tokens só trafegam no CORPO de um POST ou em cookies. Se alguém (um formulário
// quebrado, um link antigo, um script) tentar mandá-los pela URL, o servidor não processa nada:
// devolve o navegador à mesma página sem a query string (limpando barra de endereço e histórico).
const CHAVES_SECRETAS = ['senha', 'password', 'confirmarSenha', 'token'];

function semCredenciaisNaUrl(req, res, next) {
  const query = req.query || {};
  if (!CHAVES_SECRETAS.some((chave) => Object.hasOwn(query, chave))) return next();

  if (req.method === 'GET' || req.method === 'HEAD') return res.redirect(303, req.path);

  return res.status(400).json({ message: 'Nunca envie senhas pela URL. Use o corpo da requisição (POST).' });
}

module.exports = semCredenciaisNaUrl;
