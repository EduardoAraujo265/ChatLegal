/**
 * Gera os scripts que o navegador carrega: UM arquivo clássico por página, em public/js/.
 *
 *   npm run build:web
 *
 * O código-fonte fica em web/ (módulos ES, divididos em api.js, ui.js, shell.js e um arquivo por
 * página). O resultado (public/js/*.js) vai para o repositório, então o deploy NÃO precisa rodar
 * nenhum build, e os testes (tests/bundles.test.js) acusam se ele estiver desatualizado.
 *
 * Por que não carregar os módulos direto? Cada página dependeria de 3 a 4 arquivos encadeados;
 * se qualquer um falhar (bloqueador de anúncios, cache velho, proxy, navegador antigo), a página
 * inteira morre. Com um arquivo só, e transpilado para ES2017, há muito menos o que dar errado.
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const RAIZ = path.join(__dirname, '..');
const SAIDA = path.join(RAIZ, 'public', 'js');

// nome do arquivo gerado -> módulo de entrada
const PAGINAS = {
  entrar: 'web/login.js',
  'criar-conta': 'web/cadastro.js',
  sala: 'web/chat.js',
  usuarios: 'web/dashboard.js',
};

/** Compila tudo em memória. Retorna { 'entrar.js': '...código...', ... }. */
function construir() {
  const resultado = esbuild.buildSync({
    absWorkingDir: RAIZ,
    entryPoints: PAGINAS,
    outdir: SAIDA,
    bundle: true,
    format: 'iife',
    target: ['es2017'],
    legalComments: 'none',
    banner: { js: '/* GERADO por "npm run build:web" a partir de web/. Não edite este arquivo. */' },
    write: false,
    logLevel: 'silent',
  });

  const arquivos = {};
  for (const saida of resultado.outputFiles) arquivos[path.basename(saida.path)] = saida.text;
  return arquivos;
}

function escrever() {
  const arquivos = construir();
  fs.mkdirSync(SAIDA, { recursive: true });

  for (const existente of fs.readdirSync(SAIDA)) {
    if (existente.endsWith('.js') && !(existente in arquivos)) fs.unlinkSync(path.join(SAIDA, existente)); // sobras antigas
  }
  for (const [nome, codigo] of Object.entries(arquivos)) {
    fs.writeFileSync(path.join(SAIDA, nome), codigo);
    console.log(`public/js/${nome}  (${(Buffer.byteLength(codigo) / 1024).toFixed(1)} KB)`);
  }
}

if (require.main === module) escrever();

module.exports = { construir, PAGINAS };
