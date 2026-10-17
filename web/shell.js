// Topo compartilhado (chat e painel): quem está logado, link do painel para admins e "Sair".
import { api } from './api.js';
import { criarAvatar } from './ui.js';

export async function iniciarShell() {
  const { usuario } = await api('/auth/eu');

  document.getElementById('usuarioAvatar').replaceChildren(criarAvatar(usuario.nome, { pequeno: true }));
  document.getElementById('usuarioNome').textContent = usuario.nome;
  document.getElementById('usuarioPapel').hidden = usuario.papel !== 'admin';
  document.getElementById('usuario').hidden = false;

  if (usuario.papel === 'admin') {
    document.querySelectorAll('[data-somente-admin]').forEach((el) => (el.hidden = false));
  }

  document.getElementById('sair').addEventListener('click', async () => {
    try {
      await api('/auth/logout', { metodo: 'POST' });
    } finally {
      location.assign('/login');
    }
  });

  return usuario;
}

/** Atualiza o nome no topo (quando o admin edita a própria conta). */
export function atualizarUsuarioNoTopo(usuario) {
  document.getElementById('usuarioAvatar').replaceChildren(criarAvatar(usuario.nome, { pequeno: true }));
  document.getElementById('usuarioNome').textContent = usuario.nome;
}
