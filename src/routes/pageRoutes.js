const fs = require('fs');
const path = require('path');
const { Router } = require('express');
const { autenticar, paginaProtegida, paginaPublica } = require('../middleware/auth');
const { mensagemDeErro, escaparHtml } = require('../utils/formulario');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const enviar = (arquivo) => (req, res) => res.sendFile(path.join(PUBLIC_DIR, arquivo));

// Login e cadastro: o HTML tem um marcador onde o servidor coloca o motivo da falha quando o
// formulário foi enviado sem JavaScript (?erro=...). O texto vem de uma lista fixa, nunca da URL.
const MARCADOR = '<!--ERRO_SERVIDOR-->';
const modelos = new Map();

function paginaComMensagem(arquivo) {
  return (req, res) => {
    if (!modelos.has(arquivo)) modelos.set(arquivo, fs.readFileSync(path.join(PUBLIC_DIR, arquivo), 'utf8'));
    const html = modelos.get(arquivo).replace(MARCADOR, escaparHtml(mensagemDeErro(req.query)));
    res.set('Cache-Control', 'no-store').type('html').send(html);
  };
}

const router = Router();

router.get('/', async (req, res) => {
  const usuario = await autenticar(req);
  res.redirect(usuario ? '/chat' : '/login');
});

// Login e cadastro se alcançam um pelo outro; quem já está logado vai para o chat.
router.get(['/login', '/login.html'], paginaPublica, paginaComMensagem('login.html'));
router.get(['/cadastro', '/cadastro.html'], paginaPublica, paginaComMensagem('cadastro.html'));

// Estas páginas só são entregues a quem tem permissão (a pasta public/ não as expõe de outro jeito).
router.get(['/chat', '/chat.html'], paginaProtegida(), enviar('chat.html'));
router.get(['/dashboard', '/dashboard.html'], paginaProtegida({ admin: true }), enviar('dashboard.html'));

module.exports = router;
