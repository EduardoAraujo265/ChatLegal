import { api } from './api.js';
import { atualizarUsuarioNoTopo, iniciarShell } from './shell.js';
import {
  aguardar,
  criarAvatar,
  EMAIL_VALIDO,
  formatarData,
  formatarTelefone,
  limparErroAoDigitar,
  limparErros,
  mostrarErros,
  toast,
} from './ui.js';

// ---------- estado (espelhado na URL, então F5 e "voltar" mantêm filtros e página) ----------

const PADRAO = { pagina: 1, limite: 10, nome: '', email: '', telefone: '', papel: '', ordenar: 'criado', direcao: 'desc' };
const LIMITES = [10, 25, 50, 100];
const ORDENAVEIS = ['nome', 'email', 'criado'];
const FILTROS = ['nome', 'email', 'telefone', 'papel'];

function lerDaUrl() {
  const params = new URLSearchParams(location.search);
  const inteiro = (valor) => {
    const numero = Number.parseInt(valor, 10);
    return Number.isFinite(numero) && numero >= 1 ? numero : null;
  };
  const texto = (chave) => (params.get(chave) || '').slice(0, 100);
  const limite = inteiro(params.get('limite'));
  const papel = params.get('papel');
  const direcao = params.get('direcao');

  return {
    pagina: inteiro(params.get('pagina')) ?? PADRAO.pagina,
    limite: LIMITES.includes(limite) ? limite : PADRAO.limite,
    nome: texto('nome'),
    email: texto('email'),
    telefone: texto('telefone'),
    papel: ['usuario', 'admin'].includes(papel) ? papel : '',
    ordenar: ORDENAVEIS.includes(params.get('ordenar')) ? params.get('ordenar') : PADRAO.ordenar,
    direcao: ['asc', 'desc'].includes(direcao) ? direcao : PADRAO.direcao,
  };
}

const estado = lerDaUrl();

function escreverNaUrl() {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(estado)) {
    if (valor !== PADRAO[chave]) params.set(chave, valor); // só o que foge do padrão
  }
  const texto = params.toString();
  history.replaceState(null, '', texto ? `?${texto}` : location.pathname);
}

const temFiltro = () => FILTROS.some((chave) => estado[chave] !== '');

function montarConsulta() {
  const params = new URLSearchParams({
    pagina: estado.pagina,
    limite: estado.limite,
    ordenar: estado.ordenar,
    direcao: estado.direcao,
  });
  for (const chave of FILTROS) {
    if (estado[chave]) params.set(chave, estado[chave]);
  }
  return params;
}

// ---------- elementos ----------

const $ = (id) => document.getElementById(id);
const tabela = $('tabela');
const corpo = $('corpo');
const resumo = $('resumo');
const listaPaginas = $('paginas');
const formFiltros = $('filtros');
const botaoLimpar = $('limpar');
const seletorLimite = $('limite');
const entradas = { nome: $('filtroNome'), email: $('filtroEmail'), telefone: $('filtroTelefone'), papel: $('filtroPapel') };

const dialogoUsuario = $('dialogoUsuario');
const formUsuario = $('formUsuario');
const dialogoExcluir = $('dialogoExcluir');

let eu;
let controlador = null; // cancela a consulta anterior quando uma nova começa
let sequencia = 0;
let usuariosDaPagina = new Map();

// ---------- tabela ----------

function celula(texto, classe) {
  const td = document.createElement('td');
  if (classe) td.className = classe;
  td.textContent = texto;
  return td;
}

function botaoAcao(texto, classe, acao, usuario, desabilitado = false) {
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = `btn btn--pequeno ${classe}`;
  botao.textContent = texto;
  botao.dataset.acao = acao;
  botao.dataset.id = usuario.id;
  botao.setAttribute('aria-label', `${texto} ${usuario.nome}`);
  botao.disabled = desabilitado;
  return botao;
}

function criarLinha(usuario) {
  const linha = document.createElement('tr');
  const souEu = usuario.id === eu.id;

  const pessoa = document.createElement('div');
  pessoa.className = 'pessoa';
  const nome = document.createElement('span');
  nome.className = 'pessoa__nome';
  nome.textContent = usuario.nome;
  nome.title = usuario.nome;
  pessoa.append(criarAvatar(usuario.nome, { pequeno: true }), nome);
  if (souEu) {
    const voce = document.createElement('span');
    voce.className = 'pessoa__voce';
    voce.textContent = '(você)';
    pessoa.append(voce);
  }
  const celulaNome = document.createElement('td');
  celulaNome.append(pessoa);

  const selo = document.createElement('span');
  selo.className = usuario.papel === 'admin' ? 'selo selo--admin' : 'selo selo--usuario';
  selo.textContent = usuario.papel === 'admin' ? 'Administrador' : 'Usuário';
  const celulaPapel = document.createElement('td');
  celulaPapel.append(selo);

  const acoes = document.createElement('td');
  acoes.className = 'acoes';
  const excluir = botaoAcao('Excluir', 'btn--texto-perigo', 'excluir', usuario, souEu);
  if (souEu) excluir.title = 'Você não pode excluir a própria conta';
  acoes.append(botaoAcao('Editar', 'btn--secundario', 'editar', usuario), ' ', excluir);

  linha.append(
    celulaNome,
    celula(usuario.email, 'celula-suave'),
    celula(formatarTelefone(usuario.telefone), 'celula-suave numero'),
    celulaPapel,
    celula(formatarData(usuario.criadoEm), 'celula-suave numero'),
    acoes
  );
  return linha;
}

function mostrarEstadoNaTabela(mensagem, acao) {
  const linha = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = 6;
  td.className = 'tabela__estado';
  td.append(mensagem);

  if (acao) {
    td.append(document.createElement('br'));
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'btn btn--secundario';
    botao.textContent = acao.texto;
    botao.addEventListener('click', acao.aoClicar);
    td.append(botao);
  }
  linha.append(td);
  corpo.replaceChildren(linha);
}

function atualizarCabecalhos() {
  for (const botao of document.querySelectorAll('.ordenar')) {
    const ativo = botao.dataset.ordem === estado.ordenar;
    botao.closest('th').setAttribute('aria-sort', ativo ? (estado.direcao === 'asc' ? 'ascending' : 'descending') : 'none');
  }
}

// ---------- resumo e índice de páginas ----------

function textoDoResumo(paginacao) {
  if (paginacao.total === 0) return temFiltro() ? 'Nenhum usuário corresponde aos filtros.' : 'Nenhum usuário cadastrado.';

  const inicio = (paginacao.pagina - 1) * paginacao.limite + 1;
  const fim = Math.min(paginacao.pagina * paginacao.limite, paginacao.total);
  const unidade = paginacao.total === 1 ? 'usuário' : 'usuários';
  return `Mostrando ${inicio} a ${fim} de ${paginacao.total} ${unidade}${temFiltro() ? ' (filtrados)' : ''}`;
}

function botaoDePagina(rotulo, { pagina, desabilitado = false, atual = false, seta = null, descricao }) {
  const item = document.createElement('li');
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = seta ? 'pagina pagina--seta' : 'pagina';
  botao.disabled = desabilitado;
  botao.dataset.pagina = pagina;
  if (descricao) botao.setAttribute('aria-label', descricao);
  if (atual) botao.setAttribute('aria-current', 'page');

  if (seta) {
    // No celular só o símbolo aparece; o nome completo vem do aria-label.
    const glifo = document.createElement('span');
    glifo.className = 'pagina__glifo';
    glifo.setAttribute('aria-hidden', 'true');
    glifo.textContent = seta === 'anterior' ? '‹' : '›';

    const texto = document.createElement('span');
    texto.className = 'pagina__rotulo';
    texto.textContent = rotulo;

    botao.append(...(seta === 'anterior' ? [glifo, texto] : [texto, glifo]));
  } else {
    botao.textContent = rotulo;
  }

  item.append(botao);
  return item;
}

function desenharPaginas({ pagina, totalPaginas, paginas }) {
  const tinhaFoco = listaPaginas.contains(document.activeElement);
  const itens = [botaoDePagina('Anterior', { pagina: pagina - 1, desabilitado: pagina <= 1, seta: 'anterior', descricao: 'Página anterior' })];

  for (const item of paginas) {
    if (item === '…') {
      const reticencias = document.createElement('li');
      reticencias.className = 'paginacao__reticencias';
      reticencias.setAttribute('aria-hidden', 'true');
      reticencias.textContent = '…';
      itens.push(reticencias);
    } else {
      itens.push(botaoDePagina(String(item), { pagina: item, atual: item === pagina, descricao: `Página ${item}` }));
    }
  }
  itens.push(botaoDePagina('Próxima', { pagina: pagina + 1, desabilitado: pagina >= totalPaginas, seta: 'proxima', descricao: 'Próxima página' }));
  listaPaginas.replaceChildren(...itens);

  // Reconstruir a lista tira o foco do botão clicado; devolve para a página atual.
  if (tinhaFoco) listaPaginas.querySelector('[aria-current="page"]')?.focus();
}

listaPaginas.addEventListener('click', (evento) => {
  const botao = evento.target.closest('button[data-pagina]');
  if (!botao || botao.disabled) return;
  estado.pagina = Number(botao.dataset.pagina);
  carregar();
});

// ---------- carregar ----------

async function carregar() {
  controlador?.abort();
  controlador = new AbortController();
  const minhaVez = ++sequencia;

  tabela.setAttribute('aria-busy', 'true');
  botaoLimpar.hidden = !temFiltro();
  atualizarCabecalhos();

  try {
    const { dados, paginacao } = await api(`/usuarios?${montarConsulta()}`, { sinal: controlador.signal });

    estado.pagina = paginacao.pagina; // o servidor ajusta páginas que deixaram de existir
    escreverNaUrl();

    usuariosDaPagina = new Map(dados.map((usuario) => [usuario.id, usuario]));
    if (dados.length === 0) {
      mostrarEstadoNaTabela(
        temFiltro() ? 'Nenhum usuário corresponde a esses filtros.' : 'Ainda não há usuários cadastrados.',
        temFiltro() ? { texto: 'Limpar filtros', aoClicar: limparFiltros } : null
      );
    } else {
      corpo.replaceChildren(...dados.map(criarLinha));
    }

    resumo.textContent = textoDoResumo(paginacao);
    desenharPaginas(paginacao);
  } catch (erro) {
    if (erro.name === 'AbortError') return;
    if (erro.status === 403) return location.assign('/chat'); // perdeu o acesso de admin

    mostrarEstadoNaTabela(erro.message, { texto: 'Tentar de novo', aoClicar: carregar });
    resumo.textContent = '';
    listaPaginas.replaceChildren();
  } finally {
    if (minhaVez === sequencia) tabela.removeAttribute('aria-busy');
  }
}

// ---------- filtros e ordenação ----------

let esperaDigitacao;

function aplicarFiltros(imediato) {
  clearTimeout(esperaDigitacao);
  const aplicar = () => {
    for (const chave of FILTROS) estado[chave] = entradas[chave].value.trim();
    estado.pagina = 1;
    carregar();
  };
  if (imediato) aplicar();
  else esperaDigitacao = setTimeout(aplicar, 300); // espera a pessoa parar de digitar
}

function limparFiltros() {
  for (const chave of FILTROS) entradas[chave].value = '';
  aplicarFiltros(true);
  entradas.nome.focus();
}

for (const chave of ['nome', 'email', 'telefone']) {
  entradas[chave].addEventListener('input', () => aplicarFiltros(false));
}
entradas.papel.addEventListener('change', () => aplicarFiltros(true));
formFiltros.addEventListener('submit', (evento) => {
  evento.preventDefault();
  aplicarFiltros(true);
});
botaoLimpar.addEventListener('click', limparFiltros);

seletorLimite.addEventListener('change', () => {
  estado.limite = Number(seletorLimite.value);
  estado.pagina = 1;
  carregar();
});

document.querySelector('thead').addEventListener('click', (evento) => {
  const botao = evento.target.closest('.ordenar');
  if (!botao) return;

  const coluna = botao.dataset.ordem;
  if (estado.ordenar === coluna) {
    estado.direcao = estado.direcao === 'asc' ? 'desc' : 'asc';
  } else {
    estado.ordenar = coluna;
    estado.direcao = coluna === 'criado' ? 'desc' : 'asc'; // datas: mais recentes primeiro
  }
  estado.pagina = 1;
  carregar();
});

// ---------- criar e editar ----------

let editando = null;
let salvando = false;

const campoSenha = $('usuarioSenha');
const campoPapel = $('usuarioPapelCampo');

function abrirFormulario(usuario) {
  editando = usuario;
  formUsuario.reset();
  limparErros(formUsuario);

  $('tituloUsuario').textContent = usuario ? 'Editar usuário' : 'Novo usuário';
  $('salvarUsuario').textContent = usuario ? 'Salvar alterações' : 'Criar usuário';
  $('rotuloSenha').textContent = usuario ? 'Nova senha' : 'Senha';
  $('ajuda-senha').textContent = usuario
    ? 'Deixe em branco para manter a senha atual.'
    : 'Mínimo de 8 caracteres.';

  if (usuario) {
    formUsuario.elements.nome.value = usuario.nome;
    formUsuario.elements.email.value = usuario.email;
    formUsuario.elements.telefone.value = usuario.telefone ? formatarTelefone(usuario.telefone) : '';
    campoPapel.value = usuario.papel;
  }

  // O admin não pode rebaixar a si mesmo (o servidor também recusa).
  campoPapel.disabled = Boolean(usuario && usuario.id === eu.id);
  $('ajuda-papel').hidden = !campoPapel.disabled;

  dialogoUsuario.showModal();
  formUsuario.elements.nome.focus();
}

function validar(dados, criando) {
  const erros = [];
  const digitos = dados.telefone.replace(/\D/g, '');

  if (!dados.nome.trim()) erros.push({ campo: 'nome', mensagem: 'Informe o nome.' });
  if (!EMAIL_VALIDO.test(dados.email.trim())) erros.push({ campo: 'email', mensagem: 'Informe um e-mail válido.' });
  if (digitos && !/^\d{10,11}$/.test(digitos)) {
    erros.push({ campo: 'telefone', mensagem: 'O telefone deve ter 10 ou 11 dígitos (com DDD).' });
  }
  if ((criando || dados.senha) && dados.senha.length < 8) {
    erros.push({ campo: 'senha', mensagem: 'A senha deve ter ao menos 8 caracteres.' });
  } else if (new TextEncoder().encode(dados.senha).length > 72) {
    erros.push({ campo: 'senha', mensagem: 'A senha pode ter no máximo 72 bytes.' });
  }
  return erros;
}

limparErroAoDigitar(formUsuario);

formUsuario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (salvando) return;
  limparErros(formUsuario);

  const campos = formUsuario.elements;
  const dados = {
    nome: campos.nome.value,
    email: campos.email.value,
    telefone: campos.telefone.value,
    senha: campos.senha.value,
  };

  const erros = validar(dados, !editando);
  if (erros.length > 0) return mostrarErros(formUsuario, erros);

  const corpoRequisicao = { nome: dados.nome.trim(), email: dados.email.trim(), telefone: dados.telefone.trim() };
  if (dados.senha) corpoRequisicao.senha = dados.senha;
  if (!campoPapel.disabled) corpoRequisicao.papel = campoPapel.value;

  salvando = true;
  try {
    const botao = $('salvarUsuario');
    const resposta = editando
      ? await aguardar(botao, api(`/usuarios/${editando.id}`, { metodo: 'PATCH', corpo: corpoRequisicao }))
      : await aguardar(botao, api('/usuarios', { metodo: 'POST', corpo: corpoRequisicao }));

    dialogoUsuario.close();
    toast(editando ? 'Alterações salvas.' : 'Usuário criado.');

    if (editando && editando.id === eu.id) {
      eu = { ...eu, ...resposta.usuario };
      atualizarUsuarioNoTopo(eu);
    }
    if (!editando) estado.pagina = 1; // o novo usuário aparece no topo da lista padrão
    await carregar();
  } catch (erro) {
    mostrarErros(formUsuario, erro.errors, erro.message);
  } finally {
    salvando = false;
  }
});

$('novo').addEventListener('click', () => abrirFormulario(null));
$('cancelarUsuario').addEventListener('click', () => dialogoUsuario.close());

// ---------- excluir ----------

let excluindo = null;

function pedirExclusao(usuario) {
  excluindo = usuario;
  const nome = document.createElement('strong');
  nome.textContent = usuario.nome;
  $('textoExcluir').replaceChildren(
    'Excluir ',
    nome,
    '? Esta ação não pode ser desfeita. As mensagens dessa conta continuam no chat, sem identificação do autor.'
  );
  dialogoExcluir.showModal();
}

$('confirmarExcluir').addEventListener('click', async () => {
  if (!excluindo) return;
  const botao = $('confirmarExcluir');
  try {
    await aguardar(botao, api(`/usuarios/${excluindo.id}`, { metodo: 'DELETE' }));
    toast('Usuário excluído.');
  } catch (erro) {
    toast(erro.message, 'erro');
  } finally {
    dialogoExcluir.close();
    excluindo = null;
    carregar();
  }
});

$('cancelarExcluir').addEventListener('click', () => dialogoExcluir.close());

// Clicar fora da caixa (no fundo escurecido) fecha o diálogo.
for (const dialogo of [dialogoUsuario, dialogoExcluir]) {
  dialogo.addEventListener('click', (evento) => {
    if (evento.target === dialogo) dialogo.close();
  });
}

corpo.addEventListener('click', (evento) => {
  const botao = evento.target.closest('button[data-acao]');
  if (!botao || botao.disabled) return;

  const usuario = usuariosDaPagina.get(Number(botao.dataset.id));
  if (!usuario) return;
  if (botao.dataset.acao === 'editar') abrirFormulario(usuario);
  else pedirExclusao(usuario);
});

// ---------- início ----------

async function iniciar() {
  try {
    eu = await iniciarShell();
  } catch {
    return; // sem sessão: a camada de API já redirecionou para /login
  }
  if (eu.papel !== 'admin') return location.assign('/chat');

  for (const chave of FILTROS) entradas[chave].value = estado[chave];
  seletorLimite.value = String(estado.limite);

  mostrarEstadoNaTabela('Carregando…');
  await carregar();
}

iniciar();
