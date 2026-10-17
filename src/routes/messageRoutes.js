const { Router } = require('express');
const controller = require('../controllers/messageController');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { limiteMensagens } = require('../middleware/rateLimit');
const { enviarMensagemValidator, listarMensagensValidator } = require('../validators/messageValidators');

const router = Router();

// Qualquer conta logada (usuario ou admin) pode ler e escrever no chat.
router.use(requireAuth);

router.get('/', listarMensagensValidator, validate, controller.listar);
router.post('/', limiteMensagens, enviarMensagemValidator, validate, controller.criar);

module.exports = router;
