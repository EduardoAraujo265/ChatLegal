const express = require('express');
const controller = require('../controllers/authController');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { limiteLogin, limiteCadastro } = require('../middleware/rateLimit');
const { loginValidator } = require('../validators/authValidators');
const { cadastroValidator } = require('../validators/userValidators');

const router = express.Router();

// Só login e cadastro aceitam também o formulário HTML clássico (o restante da API é JSON).
const formulario = express.urlencoded({ extended: false, limit: '10kb' });

router.post('/login', limiteLogin, formulario, loginValidator, validate, controller.login);
router.post('/cadastro', limiteCadastro, formulario, cadastroValidator, validate, controller.cadastro);
router.post('/logout', controller.logout);
router.get('/eu', requireAuth, controller.eu);

// Login nunca acontece por GET: explica em vez de responder "rota não encontrada".
const soPost = (req, res) =>
  res
    .set('Allow', 'POST')
    .status(405)
    .json({ message: 'Método não permitido. Use POST e envie os dados no corpo da requisição.' });

router.all('/login', soPost);
router.all('/cadastro', soPost);

module.exports = router;
