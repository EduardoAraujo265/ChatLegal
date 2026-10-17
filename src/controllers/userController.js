const bcrypt = require('bcryptjs');
const { matchedData } = require('express-validator');
const userRepository = require('../repositories/userRepository');
const { isUniqueViolation } = require('../config/database');
const { calcularPaginacao } = require('../utils/paginacao');
const { usuarioDTO } = require('../utils/serializadores');

const SALT_ROUNDS = 10;
const LIMITE_PADRAO = 10;

const emailEmUso = {
  message: 'Este e-mail já está cadastrado.',
  errors: [{ campo: 'email', mensagem: 'Este e-mail já está cadastrado.' }],
};

async function listar(req, res) {
  const q = matchedData(req, { locations: ['query'] });
  const filtros = { nome: q.nome, email: q.email, telefone: q.telefone, papel: q.papel };
  const limite = q.limite ?? LIMITE_PADRAO;

  const total = await userRepository.contar(filtros);
  // Se a página pedida não existe mais (ex.: apagou o último item da última página),
  // calcularPaginacao devolve a mais próxima válida.
  const paginacao = calcularPaginacao({ total, pagina: q.pagina ?? 1, limite });

  const linhas = await userRepository.listar(filtros, {
    limite,
    offset: (paginacao.pagina - 1) * limite,
    ordenar: q.ordenar,
    direcao: q.direcao,
  });

  res.status(200).json({ dados: linhas.map(usuarioDTO), paginacao });
}

async function criar(req, res) {
  const { nome, email, telefone, senha, papel } = matchedData(req);

  if (await userRepository.findByEmail(email)) return res.status(409).json(emailEmUso);

  try {
    const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
    const usuario = await userRepository.create({ nome, email, telefone: telefone ?? null, senhaHash, papel });
    return res.status(201).json({ message: 'Usuário criado com sucesso', usuario: usuarioDTO(usuario) });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json(emailEmUso);
    throw err;
  }
}

async function atualizar(req, res) {
  const id = Number(req.params.id);
  const { senha, ...campos } = matchedData(req, { locations: ['body'] });

  if (Object.keys(campos).length === 0 && !senha) {
    return res.status(400).json({ message: 'Informe ao menos um campo para atualizar.' });
  }

  const atual = await userRepository.findById(id);
  if (!atual) return res.status(404).json({ message: 'Usuário não encontrado' });

  // Evita que o último admin se tranque para fora do painel por engano.
  if (id === req.usuario.id && campos.papel && campos.papel !== req.usuario.papel) {
    return res.status(400).json({ message: 'Você não pode alterar o próprio papel.' });
  }

  if (campos.email) {
    const dono = await userRepository.findByEmail(campos.email);
    if (dono && dono.id !== id) return res.status(409).json(emailEmUso);
  }

  try {
    if (senha) campos.senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
    const usuario = await userRepository.update(id, campos);
    return res.status(200).json({ message: 'Usuário atualizado com sucesso', usuario: usuarioDTO(usuario) });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json(emailEmUso);
    throw err;
  }
}

async function remover(req, res) {
  const id = Number(req.params.id);

  if (id === req.usuario.id) {
    return res.status(400).json({ message: 'Você não pode excluir a própria conta.' });
  }

  const removido = await userRepository.remove(id);
  if (!removido) return res.status(404).json({ message: 'Usuário não encontrado' });

  return res.status(200).json({ message: 'Usuário removido com sucesso' });
}

module.exports = { listar, criar, atualizar, remover };
