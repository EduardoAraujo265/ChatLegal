// Formato das entidades na API. A senha (hash) nunca sai daqui.

function usuarioDTO(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    email: linha.email,
    telefone: linha.telefone || null,
    papel: linha.papel,
    criadoEm: linha.criado_em,
  };
}

function mensagemDTO(linha) {
  return {
    id: linha.id,
    usuarioId: linha.usuario_id,
    autor: linha.autor || null, // null = conta removida
    texto: linha.texto,
    criadoEm: linha.criado_em,
  };
}

module.exports = { usuarioDTO, mensagemDTO };
