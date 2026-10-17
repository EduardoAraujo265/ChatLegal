const test = require('node:test');
const assert = require('node:assert/strict');
const { montarPaginas, calcularPaginacao } = require('../src/utils/paginacao');

test('poucas páginas: lista todas', () => {
  assert.deepEqual(montarPaginas(1, 1), [1]);
  assert.deepEqual(montarPaginas(3, 7), [1, 2, 3, 4, 5, 6, 7]);
});

test('muitas páginas: início, meio e fim com reticências e sempre 7 posições', () => {
  assert.deepEqual(montarPaginas(1, 20), [1, 2, 3, 4, 5, '…', 20]);
  assert.deepEqual(montarPaginas(4, 20), [1, 2, 3, 4, 5, '…', 20]);
  assert.deepEqual(montarPaginas(10, 20), [1, '…', 9, 10, 11, '…', 20]);
  assert.deepEqual(montarPaginas(17, 20), [1, '…', 16, 17, 18, 19, 20]);
  assert.deepEqual(montarPaginas(20, 20), [1, '…', 16, 17, 18, 19, 20]);

  for (let atual = 1; atual <= 20; atual++) {
    assert.equal(montarPaginas(atual, 20).length, 7, `página ${atual}`);
  }
});

test('calcularPaginacao arredonda para cima e nunca devolve página inexistente', () => {
  assert.equal(calcularPaginacao({ total: 25, pagina: 1, limite: 10 }).totalPaginas, 3);
  assert.equal(calcularPaginacao({ total: 30, pagina: 1, limite: 10 }).totalPaginas, 3);
  assert.equal(calcularPaginacao({ total: 0, pagina: 1, limite: 10 }).totalPaginas, 1);
  assert.equal(calcularPaginacao({ total: 25, pagina: 99, limite: 10 }).pagina, 3);
  assert.equal(calcularPaginacao({ total: 25, pagina: 0, limite: 10 }).pagina, 1);
});
