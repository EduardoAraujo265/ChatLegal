const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const { ehFormulario, redirecionarComErro } = require('../utils/formulario');

/**
 * Limites contra força bruta e spam. A contagem fica na memória do processo:
 * num servidor único funciona bem; em serverless (várias instâncias) é um freio parcial.
 * Nos testes automatizados o limite fica desligado.
 */
function criarLimite({ janelaMs, maximo, mensagem, chave, ignorarSucesso = false }) {
  return rateLimit({
    windowMs: janelaMs,
    limit: maximo,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.isTest,
    skipSuccessfulRequests: ignorarSucesso,
    ...(chave ? { keyGenerator: chave } : {}),
    handler: (req, res) => {
      if (ehFormulario(req)) return redirecionarComErro(req, res, 'tentativas');
      return res.status(429).json({ message: mensagem });
    },
  });
}

// Só tentativas que falharam contam (login correto não gasta o limite).
const limiteLogin = criarLimite({
  janelaMs: 15 * 60 * 1000,
  maximo: 10,
  ignorarSucesso: true,
  mensagem: 'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.',
});

const limiteCadastro = criarLimite({
  janelaMs: 60 * 60 * 1000,
  maximo: 10,
  mensagem: 'Muitos cadastros a partir deste endereço. Tente novamente mais tarde.',
});

// Por usuário (a rota exige login antes): 30 mensagens por minuto.
const limiteMensagens = criarLimite({
  janelaMs: 60 * 1000,
  maximo: 30,
  chave: (req) => `usuario:${req.usuario.id}`,
  mensagem: 'Você está enviando mensagens rápido demais. Aguarde um instante.',
});

module.exports = { limiteLogin, limiteCadastro, limiteMensagens };
