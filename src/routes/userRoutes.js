const { Router } = require('express');
const controller = require('../controllers/userController');
const { requireAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  criarUsuarioValidator,
  atualizarUsuarioValidator,
  idParamValidator,
  listarUsuariosValidator,
} = require('../validators/userValidators');

const router = Router();

// Gerenciar contas é coisa de admin: quem só se cadastrou pelo site recebe 403.
router.use(requireAdmin);

router.get('/', listarUsuariosValidator, validate, controller.listar);
router.post('/', criarUsuarioValidator, validate, controller.criar);
router.patch('/:id', idParamValidator, atualizarUsuarioValidator, validate, controller.atualizar);
router.delete('/:id', idParamValidator, validate, controller.remover);

module.exports = router;
