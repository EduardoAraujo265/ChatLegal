// Camada única de acesso à API: JSON, cookies da sessão e erros padronizados.

export class ApiError extends Error {
  constructor(message, status, errors = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // 0 = sem conexão
    this.errors = errors; // [{ campo, mensagem }]
  }
}

// Nestas rotas um 401 significa "credenciais erradas", não "sessão expirada".
const ROTAS_DE_ACESSO = ['/auth/login', '/auth/cadastro'];

export async function api(caminho, { metodo = 'GET', corpo, sinal } = {}) {
  let resposta;
  try {
    resposta = await fetch(caminho, {
      method: metodo,
      headers: corpo !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      signal: sinal,
      credentials: 'same-origin',
    });
  } catch (erro) {
    if (erro.name === 'AbortError') throw erro; // requisição cancelada de propósito
    throw new ApiError('Não foi possível conectar ao servidor. Verifique sua conexão.', 0);
  }

  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    // resposta sem corpo JSON
  }

  if (!resposta.ok) {
    if (resposta.status === 401 && !ROTAS_DE_ACESSO.includes(caminho)) {
      location.assign('/login'); // sessão expirada
    }
    throw new ApiError(dados?.message || 'Não foi possível concluir a ação.', resposta.status, dados?.errors || []);
  }
  return dados;
}
