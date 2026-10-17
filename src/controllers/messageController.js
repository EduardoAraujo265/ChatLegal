const { matchedData } = require('express-validator');
const messageRepository = require('../repositories/messageRepository');
const { mensagemDTO } = require('../utils/serializadores');

const HISTORICO_INICIAL = 50;
const MAXIMO_POR_CONSULTA = 100;

/**
 * Sem parâmetros: as últimas mensagens (carga inicial do chat).
 * Com ?depois=<id>: só o que chegou depois dessa mensagem (o chat consulta isso a cada poucos segundos).
 */
async function listar(req, res) {
  const { depois } = matchedData(req, { locations: ['query'] });

  const linhas =
    depois === undefined
      ? await messageRepository.ultimas(HISTORICO_INICIAL)
      : await messageRepository.depoisDe(depois, MAXIMO_POR_CONSULTA);

  res.status(200).json({ mensagens: linhas.map(mensagemDTO) });
}

async function criar(req, res) {
  const { texto } = matchedData(req, { locations: ['body'] });
  const mensagem = await messageRepository.criar({ usuarioId: req.usuario.id, texto });

  res.status(201).json({ mensagem: mensagemDTO(mensagem) });
}

module.exports = { listar, criar };
