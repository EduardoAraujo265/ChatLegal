import './diagnostico.js';
import { api } from './api.js';
import { iniciarShell } from './shell.js';
import { criarAvatar, matizDe, toast } from './ui.js';

// O chat usa polling (perguntar "tem novidade?" a cada poucos segundos) em vez de WebSocket:
// funciona igual em servidor tradicional e em serverless (Vercel), onde conexões longas não existem.
const INTERVALO_MS = 3000;
const LIMITE_TEXTO = 500; // igual ao do servidor (conta caracteres, não bytes)
const AVISAR_A_PARTIR_DE = 400;
const AGRUPAR_ATE_MS = 5 * 60 * 1000;

const lista = document.getElementById('mensagens');
const vazio = document.getElementById('vazio');
const aviso = document.getElementById('aviso');
const botaoNovas = document.getElementById('novas');
const form = document.getElementById('compositor');
const campo = document.getElementById('texto');
const botaoEnviar = document.getElementById('enviar');
const contador = document.getElementById('contador');

const formatarHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const formatarDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let eu;
let ultimoId = 0;
let anterior = null; // { usuarioId, quando, dia } da última mensagem desenhada
let consultando = false;
let enviando = false;
let falhas = 0;
const desenhadas = new Set();

// ---------- datas ----------

const chaveDoDia = (data) => `${data.getFullYear()}-${data.getMonth()}-${data.getDate()}`;

function rotuloDoDia(data) {
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);

  if (chaveDoDia(data) === chaveDoDia(hoje)) return 'Hoje';
  if (chaveDoDia(data) === chaveDoDia(ontem)) return 'Ontem';
  return formatarDia.format(data);
}

// ---------- rolagem ----------

const pertoDoFim = () => lista.scrollHeight - lista.scrollTop - lista.clientHeight < 80;

function rolarParaOFim(suave = false) {
  lista.scrollTo({ top: lista.scrollHeight, behavior: suave && !reduzMovimento ? 'smooth' : 'auto' });
}

lista.addEventListener('scroll', () => {
  if (pertoDoFim()) botaoNovas.hidden = true;
});

botaoNovas.addEventListener('click', () => {
  rolarParaOFim(true);
  botaoNovas.hidden = true;
});

// ---------- desenhar mensagens ----------

function criarMensagem(mensagem, { minha, continua }) {
  const autor = mensagem.autor ?? 'Usuário removido';

  const item = document.createElement('li');
  item.className = ['msg', minha && 'msg--minha', continua && 'msg--continua'].filter(Boolean).join(' ');
  item.dataset.id = mensagem.id;

  if (!minha) {
    // Em mensagens seguidas do mesmo autor o avatar some, mas a coluna continua reservada.
    item.append(continua ? document.createElement('span') : criarAvatar(autor));
  }

  const balao = document.createElement('div');
  balao.className = 'msg__balao';

  if (!minha && !continua) {
    const nome = document.createElement('span');
    nome.className = 'msg__autor';
    nome.textContent = autor;
    nome.style.setProperty('--matiz', matizDe(autor));
    balao.append(nome);
  }

  const texto = document.createElement('p');
  texto.className = 'msg__texto';
  texto.textContent = mensagem.texto; // textContent: HTML digitado por alguém nunca é interpretado

  const hora = document.createElement('time');
  hora.className = 'msg__hora';
  hora.dateTime = mensagem.criadoEm;
  hora.textContent = formatarHora.format(new Date(mensagem.criadoEm));

  balao.append(texto, hora);
  item.append(balao);
  return item;
}

function adicionar(mensagens) {
  const estavaNoFim = pertoDoFim();
  let chegouAlgo = false;
  let euEnviei = false;

  for (const mensagem of mensagens) {
    if (desenhadas.has(mensagem.id)) continue; // o envio e o polling podem trazer a mesma mensagem
    desenhadas.add(mensagem.id);
    ultimoId = Math.max(ultimoId, mensagem.id);

    const quando = new Date(mensagem.criadoEm);
    const dia = chaveDoDia(quando);

    if (!anterior || anterior.dia !== dia) {
      const divisor = document.createElement('li');
      divisor.className = 'dia';
      divisor.textContent = rotuloDoDia(quando);
      lista.append(divisor);
    }

    const minha = mensagem.usuarioId === eu.id;
    const continua =
      anterior !== null &&
      anterior.dia === dia &&
      mensagem.usuarioId !== null &&
      anterior.usuarioId === mensagem.usuarioId &&
      quando - anterior.quando < AGRUPAR_ATE_MS;

    lista.append(criarMensagem(mensagem, { minha, continua }));
    anterior = { usuarioId: mensagem.usuarioId, quando, dia };

    chegouAlgo = true;
    if (minha) euEnviei = true;
  }

  vazio.hidden = desenhadas.size > 0;

  if (chegouAlgo) {
    // Só puxa a tela para baixo se a pessoa já estava lendo o fim; senão oferece o atalho.
    if (estavaNoFim || euEnviei) rolarParaOFim();
    else botaoNovas.hidden = false;
  }
}

// ---------- conexão ----------

function mostrarAviso(texto) {
  aviso.textContent = texto ?? '';
  aviso.hidden = !texto;
}

async function consultarNovidades() {
  if (consultando || document.hidden) return; // aba em segundo plano não precisa consultar
  consultando = true;
  try {
    const { mensagens } = await api(`/mensagens?depois=${ultimoId}`);
    adicionar(mensagens);
    falhas = 0;
    mostrarAviso(null);
  } catch (erro) {
    falhas += 1;
    if (falhas >= 2) mostrarAviso('Sem conexão. Tentando de novo…');
  } finally {
    consultando = false;
  }
}

async function carregarHistorico() {
  try {
    const { mensagens } = await api('/mensagens');
    adicionar(mensagens);
    rolarParaOFim();
    lista.setAttribute('aria-busy', 'false');
    mostrarAviso(null);
    setInterval(consultarNovidades, INTERVALO_MS);
  } catch (erro) {
    mostrarAviso('Não foi possível carregar as mensagens. Tentando de novo…');
    setTimeout(carregarHistorico, INTERVALO_MS);
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && ultimoId > 0) consultarNovidades(); // voltou para a aba: atualiza já
});

// ---------- escrever ----------

const contarCaracteres = (texto) => Array.from(texto).length;

function atualizarCampo() {
  campo.style.height = 'auto';
  campo.style.height = `${Math.min(campo.scrollHeight, 140)}px`;

  const tamanho = contarCaracteres(campo.value.trim());
  const longoDemais = tamanho > LIMITE_TEXTO;

  botaoEnviar.disabled = enviando || tamanho === 0 || longoDemais;

  contador.hidden = tamanho < AVISAR_A_PARTIR_DE;
  contador.textContent = `${tamanho}/${LIMITE_TEXTO}`;
  contador.dataset.alerta = longoDemais ? 'limite' : tamanho >= LIMITE_TEXTO - 20 ? 'perto' : '';
}

campo.addEventListener('input', atualizarCampo);

campo.addEventListener('keydown', (evento) => {
  // Enter envia; Shift+Enter quebra a linha. `isComposing` evita enviar no meio de um acento/IME.
  if (evento.key === 'Enter' && !evento.shiftKey && !evento.isComposing) {
    evento.preventDefault();
    if (!botaoEnviar.disabled) form.requestSubmit();
  }
});

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const texto = campo.value.trim();
  if (!texto || enviando || contarCaracteres(texto) > LIMITE_TEXTO) return;

  enviando = true;
  botaoEnviar.disabled = true;
  try {
    const { mensagem } = await api('/mensagens', { metodo: 'POST', corpo: { texto } });
    campo.value = '';
    adicionar([mensagem]);
    rolarParaOFim(true);
  } catch (erro) {
    toast(erro.message, 'erro'); // o rascunho fica no campo para tentar de novo
  } finally {
    enviando = false;
    atualizarCampo();
    campo.focus();
  }
});

// ---------- início ----------

async function iniciar() {
  try {
    eu = await iniciarShell();
  } catch {
    return; // sem sessão: a camada de API já redirecionou para /login
  }
  carregarHistorico();
  campo.focus();
}

iniciar();
