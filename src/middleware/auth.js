const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userRepository = require('../repositories/userRepository');

/**
 * Descobre quem está logado a partir do cookie. Além de validar o token, consulta o banco:
 * assim uma conta excluída (ou rebaixada de admin) perde o acesso na hora, sem esperar o
 * token expirar. Devolve o usuário (sem senha) ou null.
 */
async function autenticar(req) {
  const token = req.cookies && req.cookies.token;
  if (!token) return null;

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    return null;
  }
  return userRepository.findById(payload.id);
}

// ---------- rotas da API (respondem JSON) ----------

async function requireAuth(req, res, next) {
  const usuario = await autenticar(req);
  if (!usuario) {
    return res.status(401).json({ message: 'Sessão expirada. Entre novamente.' });
  }
  req.usuario = usuario;
  return next();
}

function exigirAdmin(req, res, next) {
  if (req.usuario.papel !== 'admin') {
    return res.status(403).json({ message: 'Acesso restrito a administradores.' });
  }
  return next();
}

const requireAdmin = [requireAuth, exigirAdmin];

// ---------- páginas HTML (respondem com redirecionamento) ----------

/** Só deixa passar quem está logado (e, com { admin: true }, quem é admin). */
function paginaProtegida({ admin = false } = {}) {
  return async (req, res, next) => {
    const usuario = await autenticar(req);
    if (!usuario) return res.redirect('/login');
    if (admin && usuario.papel !== 'admin') return res.redirect('/chat');

    req.usuario = usuario;
    // Evita que o botão "voltar" mostre a página guardada no cache depois do logout.
    res.set('Cache-Control', 'no-store');
    return next();
  };
}

/** Login e cadastro: quem já está logado vai direto para o chat. */
async function paginaPublica(req, res, next) {
  const usuario = await autenticar(req);
  if (usuario) return res.redirect('/chat');
  return next();
}

module.exports = { autenticar, requireAuth, requireAdmin, paginaProtegida, paginaPublica };
