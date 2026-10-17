// Utilitários de interface compartilhados pelas páginas.

// ---------- avatares ----------

// Matizes frios e avermelhados: com o texto branco o contraste fica sempre acima de 4,5:1.
const MATIZES = [190, 210, 235, 265, 295, 325, 355, 15];

export function matizDe(texto) {
  let hash = 0;
  for (const caractere of String(texto)) hash = (hash * 31 + caractere.codePointAt(0)) >>> 0;
  return MATIZES[hash % MATIZES.length];
}

export function iniciais(nome) {
  const partes = String(nome).trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = Array.from(partes[0])[0];
  const ultima = partes.length > 1 ? Array.from(partes[partes.length - 1])[0] : '';
  return (primeira + ultima).toUpperCase();
}

export function criarAvatar(nome, { pequeno = false } = {}) {
  const avatar = document.createElement('span');
  avatar.className = pequeno ? 'avatar avatar--pequeno' : 'avatar';
  avatar.textContent = iniciais(nome);
  avatar.style.setProperty('--matiz', matizDe(nome));
  avatar.setAttribute('aria-hidden', 'true');
  return avatar;
}

// ---------- formatação ----------

export function formatarTelefone(digitos) {
  if (!digitos) return '—';
  const d = String(digitos);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

export function formatarData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

// ---------- avisos ----------

export function toast(texto, tipo = 'ok') {
  let area = document.getElementById('avisos');
  if (!area) {
    area = document.createElement('div');
    area.id = 'avisos';
    area.className = 'avisos';
    document.body.append(area);
  }

  const aviso = document.createElement('div');
  aviso.className = tipo === 'erro' ? 'aviso aviso--erro' : 'aviso';
  aviso.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  aviso.textContent = texto;
  area.append(aviso);

  setTimeout(() => aviso.remove(), tipo === 'erro' ? 6000 : 4000);
}

// ---------- formulários ----------

export function limparErros(form) {
  form.querySelectorAll('.campo__erro').forEach((el) => (el.textContent = ''));
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  const geral = form.querySelector('.form__erro');
  if (geral) geral.textContent = '';
}

/**
 * Mostra erros por campo (`erros` = [{ campo, mensagem }]). O que não tiver campo correspondente,
 * ou a `mensagemGeral` quando não houver lista, vai para o aviso no topo do formulário.
 */
export function mostrarErros(form, erros = [], mensagemGeral = '') {
  let primeiroInvalido = null;
  const semCampo = [];

  for (const { campo, mensagem } of erros) {
    const entrada = form.elements[campo];
    const alvo = form.querySelector(`#erro-${campo}`);

    if (!entrada || !alvo) {
      semCampo.push(mensagem);
      continue;
    }
    alvo.textContent = mensagem;
    entrada.setAttribute('aria-invalid', 'true');

    const descritores = new Set((entrada.getAttribute('aria-describedby') || '').split(' ').filter(Boolean));
    descritores.add(alvo.id);
    entrada.setAttribute('aria-describedby', [...descritores].join(' '));

    primeiroInvalido ??= entrada;
  }

  const geral = form.querySelector('.form__erro');
  if (geral) {
    geral.textContent = semCampo.length > 0 ? semCampo.join(' ') : erros.length === 0 ? mensagemGeral : '';
  }
  (primeiroInvalido || (geral && geral.textContent ? geral : null))?.focus?.();
}

// Some o erro de um campo assim que a pessoa volta a digitar nele.
export function limparErroAoDigitar(form) {
  form.addEventListener('input', (evento) => {
    const entrada = evento.target;
    if (!entrada.name) return;
    entrada.removeAttribute('aria-invalid');
    const alvo = form.querySelector(`#erro-${entrada.name}`);
    if (alvo) alvo.textContent = '';
  });
}

/** Mostra o estado "ocupado" no botão enquanto a promessa não termina. */
export async function aguardar(botao, promessa) {
  botao.setAttribute('aria-busy', 'true');
  try {
    return await promessa;
  } finally {
    botao.removeAttribute('aria-busy');
  }
}

export const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
