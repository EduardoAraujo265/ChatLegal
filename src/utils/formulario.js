/**
 * Suporte a formulários HTML clássicos (POST application/x-www-form-urlencoded).
 *
 * O site funciona com JavaScript (fetch + JSON), mas login e cadastro também funcionam SEM ele:
 * se o script falhar ao carregar, o navegador envia o formulário por POST e o servidor responde com
 * redirecionamento. Nunca por GET: senha em URL vai para histórico, logs e cabeçalho Referer.
 */
const FORMULARIO = /^application\/x-www-form-urlencoded/i;

const ehFormulario = (req) => FORMULARIO.test(req.headers['content-type'] || '');

const PAGINA_DO_FORMULARIO = { '/auth/login': '/login', '/auth/cadastro': '/cadastro' };

const paginaDoFormulario = (req) => PAGINA_DO_FORMULARIO[req.originalUrl.split('?')[0]] || '/login';

// A mensagem NUNCA vem do que o usuário enviou: o redirecionamento leva só um código desta lista,
// e a página mostra o texto correspondente. Assim não há como injetar conteúdo pela URL.
const MENSAGENS = {
  credenciais: 'E-mail ou senha incorretos.',
  tentativas: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  email_em_uso: 'Este e-mail já está cadastrado.',
  senhas: 'As senhas não são iguais.',
  banco: 'O sistema está indisponível no momento. Tente novamente em instantes.',
  erro: 'Não foi possível concluir. Tente novamente em instantes.',
};

const ROTULOS_DOS_CAMPOS = {
  nome: 'nome',
  email: 'e-mail',
  telefone: 'telefone',
  senha: 'senha',
  confirmarSenha: 'confirmação da senha',
};

function redirecionarComErro(req, res, codigo, campos = []) {
  const params = new URLSearchParams({ erro: codigo });
  const conhecidos = campos.filter((campo) => Object.hasOwn(ROTULOS_DOS_CAMPOS, campo));
  if (conhecidos.length > 0) params.set('campos', conhecidos.join(','));

  return res.redirect(303, `${paginaDoFormulario(req)}?${params}`); // 303: o navegador segue com GET
}

/** Texto a exibir para ?erro=...&campos=... (vazio se o código não for conhecido). */
function mensagemDeErro(query = {}) {
  const codigo = String(query.erro || '');

  if (codigo === 'dados') {
    const rotulos = String(query.campos || '')
      .split(',')
      .filter((campo) => Object.hasOwn(ROTULOS_DOS_CAMPOS, campo))
      .map((campo) => ROTULOS_DOS_CAMPOS[campo]);
    return rotulos.length > 0 ? `Confira os campos: ${rotulos.join(', ')}.` : 'Confira os dados informados.';
  }
  return Object.hasOwn(MENSAGENS, codigo) ? MENSAGENS[codigo] : '';
}

const escaparHtml = (texto) =>
  texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

module.exports = { ehFormulario, redirecionarComErro, mensagemDeErro, escaparHtml };
