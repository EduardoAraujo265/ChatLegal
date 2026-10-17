const { body, query } = require('express-validator');

const TAMANHO_MAXIMO = 500;

const enviarMensagemValidator = [
  body('texto')
    .isString()
    .withMessage('Escreva a mensagem.')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('A mensagem não pode estar vazia.')
    .bail()
    .isLength({ max: TAMANHO_MAXIMO })
    .withMessage(`A mensagem pode ter no máximo ${TAMANHO_MAXIMO} caracteres.`),
];

const listarMensagensValidator = [
  query('depois').optional().isInt({ min: 0 }).withMessage('Parâmetro "depois" inválido.').toInt(),
];

module.exports = { enviarMensagemValidator, listarMensagensValidator };
