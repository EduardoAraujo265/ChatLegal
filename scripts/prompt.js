/**
 * Perguntas interativas no terminal (usado por setup.js e createAdmin.js).
 * `secreto: true` esconde o que é digitado (senhas).
 */
const readline = require('readline');
const { Writable } = require('stream');

function criarPrompt() {
  const saida = new Writable({
    write(chunk, encoding, callback) {
      if (!saida.mudo) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  saida.mudo = false;

  const rl = readline.createInterface({ input: process.stdin, output: saida, terminal: true });

  function ask(pergunta, { padrao, obrigatorio = false, secreto = false } = {}) {
    const sufixo = padrao ? ` (${padrao})` : '';

    return new Promise((resolve) => {
      const perguntar = () => {
        saida.mudo = false;
        rl.question(`${pergunta}${sufixo}: `, (resposta) => {
          saida.mudo = false;
          if (secreto) process.stdout.write('\n');

          const valor = secreto ? resposta || padrao : resposta.trim() || padrao;
          if (obrigatorio && !valor) {
            console.log('  -> Esse valor é obrigatório.');
            return perguntar();
          }
          resolve(valor);
        });
        saida.mudo = secreto; // silencia só depois de exibir a pergunta
      };
      perguntar();
    });
  }

  async function askYesNo(pergunta, padraoSim = true) {
    const resposta = await ask(`${pergunta} [${padraoSim ? 'S/n' : 's/N'}]`);
    if (!resposta) return padraoSim;
    return ['s', 'sim', 'y', 'yes'].includes(resposta.toLowerCase());
  }

  return { ask, askYesNo, close: () => rl.close() };
}

module.exports = { criarPrompt };
