const fs = require('fs');
const path = require('path');
const { Router } = require('express');
const db = require('../config/database');
const env = require('../config/env');
const { version } = require('../../package.json');

const router = Router();
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

// Arquivos sem os quais as páginas não funcionam. Em serverless é possível o deploy subir sem eles.
const ESSENCIAIS = [
  'css/app.css',
  'js/entrar.js',
  'js/criar-conta.js',
  'js/sala.js',
  'js/usuarios.js',
  'login.html',
  'cadastro.html',
  'chat.html',
  'dashboard.html',
];

function verificarArquivos() {
  const faltando = ESSENCIAIS.filter((arquivo) => !fs.existsSync(path.join(PUBLIC_DIR, arquivo)));
  return faltando.length === 0
    ? { estaticos: 'ok' }
    : { estaticos: 'faltando', arquivos: faltando, dica: 'O deploy não incluiu a pasta public/. Confira o includeFiles do vercel.json.' };
}

// Verifica o que mais costuma dar errado em um deploy novo: o banco responde? A estrutura é a esperada?
async function verificarBanco() {
  try {
    await db.one('SELECT id, nome, email, senha, papel, criado_em FROM usuarios LIMIT 1');
    await db.one('SELECT id, usuario_id, texto, criado_em FROM mensagens LIMIT 1');
    return { banco: 'ok' };
  } catch (err) {
    if (db.isSchemaError(err)) {
      return { banco: 'desatualizado', dica: 'Rode "npm run db:init" com o .env apontando para este banco.' };
    }
    return { banco: 'indisponivel', codigo: err.code || 'desconhecido' };
  }
}

let ultimo = { quando: 0, resultado: null };

// Sem login e sem dados sensíveis: só diz se o banco está acessível e atualizado e se os arquivos estão no lugar.
router.get('/', async (req, res) => {
  const agora = Date.now();
  if (env.isTest || agora - ultimo.quando > 5000) {
    ultimo = { quando: agora, resultado: await verificarBanco() }; // cache curto: não deixa ninguém martelar o banco
  }
  const arquivos = verificarArquivos();

  const ok = ultimo.resultado.banco === 'ok' && arquivos.estaticos === 'ok';
  res.status(ok ? 200 : 503).set('Cache-Control', 'no-store').json({
    status: ok ? 'ok' : 'erro',
    versao: version,
    ...ultimo.resultado,
    ...arquivos,
    node: process.version,
    vercel: Boolean(process.env.VERCEL),
  });
});

module.exports = router;
