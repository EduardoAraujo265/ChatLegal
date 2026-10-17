// Importado como PRIMEIRA linha de cada página.
//
// 1) Marca que o script carregou. O CSS esconde o aviso "scripts não carregaram" quando este atributo
//    existe; se o arquivo nunca chegar, o atributo nunca aparece e o aviso surge sozinho depois de 5 s
//    (sem depender de JavaScript).
document.documentElement.setAttribute('data-app', 'js');

// 2) Se o script carregar mas algo quebrar, mostra o motivo na tela em vez de falhar em silêncio.
function mostrarFalha(detalhe) {
  const aviso = document.querySelector('.aviso-scripts');
  if (!aviso || aviso.hasAttribute('data-falha')) return; // mostra só o primeiro erro
  aviso.setAttribute('data-falha', '');
  const alvo = aviso.querySelector('.aviso-scripts__detalhe');
  if (alvo) alvo.textContent = detalhe;
}

window.addEventListener('error', (evento) => {
  const arquivo = (evento.filename || '').split('/').pop();
  mostrarFalha(`${evento.message}${arquivo ? ` (${arquivo}:${evento.lineno})` : ''}`);
});

window.addEventListener('unhandledrejection', (evento) => {
  const motivo = evento.reason;
  mostrarFalha(String((motivo && motivo.message) || motivo || 'erro desconhecido'));
});
