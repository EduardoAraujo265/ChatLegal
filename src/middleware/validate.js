const { validationResult } = require('express-validator');
const { ehFormulario, redirecionarComErro } = require('../utils/formulario');

function validate(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Um erro por campo (o primeiro), na ordem em que aparecem.
    const vistos = new Set();
    const lista = errors
      .array()
      .filter((e) => !vistos.has(e.path) && vistos.add(e.path))
      .map((e) => ({ campo: e.path, mensagem: e.msg }));

    if (ehFormulario(req)) {
      if (lista.some((e) => e.campo === 'confirmarSenha')) return redirecionarComErro(req, res, 'senhas');
      return redirecionarComErro(req, res, 'dados', lista.map((e) => e.campo));
    }

    return res.status(400).json({ message: 'Dados inválidos', errors: lista });
  }

  return next();
}

module.exports = validate;
