const { body, param, query } = require('express-validator');

const PAPEIS = ['usuario', 'admin'];
const ORDENACOES = ['id', 'nome', 'email', 'criado'];

const somenteDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');

// ---------- campos reutilizáveis (cadastro público e painel de admin) ----------

const campoNome = (chain) =>
  chain
    .trim()
    .notEmpty()
    .withMessage('Informe o nome.')
    .bail()
    .isLength({ max: 498 })
    .withMessage('O nome pode ter no máximo 498 caracteres.');

const campoEmail = (chain) =>
  chain
    .trim()
    .isEmail()
    .withMessage('Informe um e-mail válido.')
    .bail()
    .isLength({ max: 255 })
    .withMessage('O e-mail pode ter no máximo 255 caracteres.')
    .customSanitizer((valor) => valor.toLowerCase());

// Aceita "(21) 99999-9999": só os dígitos são guardados. Vazio = sem telefone.
const campoTelefone = (chain) =>
  chain
    .customSanitizer(somenteDigitos)
    .custom((valor) => valor === '' || /^[0-9]{10,11}$/.test(valor))
    .withMessage('O telefone deve ter 10 ou 11 dígitos (com DDD).')
    .customSanitizer((valor) => valor || null);

// O bcrypt ignora tudo depois do 72º byte; por isso o limite explícito.
const campoSenha = (chain) =>
  chain
    .isString()
    .withMessage('Informe a senha.')
    .bail()
    .isLength({ min: 8 })
    .withMessage('A senha deve ter ao menos 8 caracteres.')
    .bail()
    .custom((valor) => Buffer.byteLength(valor) <= 72)
    .withMessage('A senha pode ter no máximo 72 bytes.');

// ---------- cadastro público: o papel nunca é aceito do cliente ----------

const cadastroValidator = [
  campoNome(body('nome')),
  campoEmail(body('email')),
  campoTelefone(body('telefone').optional({ values: 'undefined' })),
  campoSenha(body('senha')),
  // O site com JavaScript já confere isso no navegador e não envia o campo; o formulário clássico envia.
  body('confirmarSenha')
    .optional({ values: 'undefined' })
    .custom((valor, { req }) => valor === req.body.senha)
    .withMessage('As senhas não são iguais.'),
];

// ---------- painel de admin ----------

const criarUsuarioValidator = [
  ...cadastroValidator,
  body('papel').optional().isIn(PAPEIS).withMessage('Papel inválido.'),
];

// PATCH de verdade: cada campo é opcional, mas se vier precisa ser válido.
const atualizarUsuarioValidator = [
  campoNome(body('nome').optional()),
  campoEmail(body('email').optional()),
  campoTelefone(body('telefone').optional({ values: 'undefined' })),
  // Senha em branco = manter a atual.
  campoSenha(body('senha').optional({ values: 'falsy' })),
  body('papel').optional().isIn(PAPEIS).withMessage('Papel inválido.'),
];

const idParamValidator = [param('id').isInt({ min: 1 }).withMessage('ID inválido.').toInt()];

const listarUsuariosValidator = [
  query('pagina').optional().isInt({ min: 1 }).withMessage('Página inválida.').toInt(),
  query('limite').optional().isInt({ min: 1, max: 100 }).withMessage('Limite inválido (1 a 100).').toInt(),
  query('nome').optional().trim().isLength({ max: 100 }),
  query('email').optional().trim().isLength({ max: 100 }),
  query('telefone').optional().trim().isLength({ max: 30 }),
  query('papel').optional({ values: 'falsy' }).isIn(PAPEIS).withMessage('Papel inválido.'),
  query('ordenar').optional().isIn(ORDENACOES).withMessage('Ordenação inválida.'),
  query('direcao').optional().isIn(['asc', 'desc']).withMessage('Direção inválida.'),
];

module.exports = {
  cadastroValidator,
  criarUsuarioValidator,
  atualizarUsuarioValidator,
  idParamValidator,
  listarUsuariosValidator,
};
