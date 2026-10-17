/**
 * Lista de itens do índice de páginas, sempre com no máximo 7 posições
 * (a largura do índice não "pula" ao navegar). '…' marca páginas omitidas.
 *
 *   atual=1,  total=20 -> [1, 2, 3, 4, 5, '…', 20]
 *   atual=10, total=20 -> [1, '…', 9, 10, 11, '…', 20]
 *   atual=20, total=20 -> [1, '…', 16, 17, 18, 19, 20]
 */
function montarPaginas(atual, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (atual <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (atual >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', atual - 1, atual, atual + 1, '…', total];
}

/** Calcula a paginação; uma página fora do intervalo é ajustada para a mais próxima válida. */
function calcularPaginacao({ total, pagina, limite }) {
  const totalPaginas = Math.max(1, Math.ceil(total / limite));
  const atual = Math.min(Math.max(1, pagina), totalPaginas);

  return {
    pagina: atual,
    limite,
    total,
    totalPaginas,
    paginas: montarPaginas(atual, totalPaginas),
  };
}

module.exports = { montarPaginas, calcularPaginacao };
