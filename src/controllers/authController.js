const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { matchedData } = require('express-validator');
const userRepository = require('../repositories/userRepository');
const { isUniqueViolation } = require('../config/database');
const { usuarioDTO } = require('../utils/serializadores');
const env = require('../config/env');
const { ehFormulario, redirecionarComErro } = require('../utils/formulario');

const SALT_ROUNDS = 10;

// Usado quando o e-mail não existe, para que a resposta demore o mesmo tempo que
// uma senha errada (não revela, pelo tempo de resposta, quais e-mails estão cadastrados).
const HASH_FALSO = bcrypt.hashSync('senha-que-nunca-sera-usada', SALT_ROUNDS);

const OPCOES_COOKIE = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'strict',
};

function iniciarSessao(res, usuario) {
  const token = jwt.sign({ id: usuario.id }, env.jwtSecret, { expiresIn: `${env.sessionHours}h` });
  res.cookie('token', token, { ...OPCOES_COOKIE, maxAge: env.sessionHours * 60 * 60 * 1000 });
}

async function login(req, res) {
  const { email, senha } = matchedData(req);

  const conta = await userRepository.findByEmail(email);
  const senhaConfere = await bcrypt.compare(senha, conta ? conta.senha : HASH_FALSO);

  // Mesma mensagem para "e-mail não existe" e "senha errada".
  if (!conta || !senhaConfere) {
    if (ehFormulario(req)) return redirecionarComErro(req, res, 'credenciais');
    return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
  }

  iniciarSessao(res, conta);
  if (ehFormulario(req)) return res.redirect(303, '/chat');
  return res.status(200).json({ message: 'Login bem-sucedido', usuario: usuarioDTO(conta) });
}

const emailEmUso = {
  message: 'Este e-mail já está cadastrado.',
  errors: [{ campo: 'email', mensagem: 'Este e-mail já está cadastrado.' }],
};

function conflitoDeEmail(req, res) {
  if (ehFormulario(req)) return redirecionarComErro(req, res, 'email_em_uso');
  return res.status(409).json(emailEmUso);
}

async function cadastro(req, res) {
  // matchedData devolve só os campos validados: um "papel" enviado pelo cliente é ignorado,
  // então ninguém consegue se cadastrar como admin.
  const { nome, email, telefone, senha } = matchedData(req);


  if (await userRepository.findByEmail(email)) {
    return conflitoDeEmail(req, res);
  }

  let usuario;
  try {
    const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
    usuario = await userRepository.create({ nome, email, telefone: telefone ?? null, senhaHash, papel: 'usuario' });
  } catch (err) {
    // Dois cadastros simultâneos com o mesmo e-mail: o índice único do banco decide.
    if (isUniqueViolation(err)) return conflitoDeEmail(req, res);
    throw err;
  }

  iniciarSessao(res, usuario); // já entra logado
  if (ehFormulario(req)) return res.redirect(303, '/chat');
  return res.status(201).json({ message: 'Conta criada com sucesso', usuario: usuarioDTO(usuario) });
}

function logout(req, res) {
  res.clearCookie('token', OPCOES_COOKIE).status(200).json({ message: 'Logout realizado com sucesso' });
}

function eu(req, res) {
  res.json({ usuario: usuarioDTO(req.usuario) });
}

module.exports = { login, cadastro, logout, eu };
