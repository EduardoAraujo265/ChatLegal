/**
 * Cria um administrador (ou promove uma conta existente e redefine a senha dela).
 *
 *   npm run create-admin                 # pergunta nome, e-mail e senha
 *   npm run create-admin -- --nome "Ana" --email ana@exemplo.com --senha "minhaSenha123"
 *
 * Dica: para não deixar a senha no histórico do terminal, use a variável ADMIN_SENHA
 * ou deixe o script perguntar.
 */
const { fromEnv } = require('../database/config');
const { conectar } = require('../database/connection');
const { salvarAdmin } = require('../database/admin');
const { criarPrompt } = require('./prompt');
const { explicarErro } = require('./erros');

function lerArgumentos(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  const args = lerArgumentos(process.argv.slice(2));
  let config;
  let prompt;

  try {
    config = fromEnv();
    prompt = criarPrompt();

    const nome = args.nome || (await prompt.ask('Nome do admin', { padrao: 'Admin', obrigatorio: true }));
    const email = args.email || (await prompt.ask('E-mail do admin', { obrigatorio: true }));
    const senha =
      args.senha ||
      process.env.ADMIN_SENHA ||
      (await prompt.ask('Senha (mínimo 8 caracteres)', { obrigatorio: true, secreto: true }));
    prompt.close();

    if (!EMAIL_VALIDO.test(email)) throw new Error('E-mail inválido.');
    if (senha.length < 8) throw new Error('A senha precisa ter ao menos 8 caracteres.');
    if (Buffer.byteLength(senha) > 72) throw new Error('A senha pode ter no máximo 72 bytes (limite do bcrypt).');

    const conn = await conectar(config);
    try {
      const resultado = await salvarAdmin(conn, { nome, email, senha });
      console.log(
        resultado === 'criado'
          ? `Admin "${email}" criado com sucesso.`
          : `A conta "${email}" já existia: agora é admin e a senha foi redefinida.`
      );
    } finally {
      await conn.close();
    }
  } catch (err) {
    if (prompt) prompt.close();
    console.error(`\nErro: ${explicarErro(err, config)}`);
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === '42P01') console.error('Rode antes: npm run db:init');
    process.exit(1);
  }
}

main();
