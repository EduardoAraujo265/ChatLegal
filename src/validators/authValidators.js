const { body } = require('express-validator');

const loginValidator = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Informe um e-mail válido.')
    .customSanitizer((valor) => valor.toLowerCase()),
  body('senha').isString().notEmpty().withMessage('Informe a senha.'),
];

module.exports = { loginValidator };
