/**
 * Gera as tabelas do projeto (usuarios e mensagens) usando as credenciais do .env.
 *
 *   npm run db:init
 *
 * - Cria o banco de dados se ele ainda não existir.
 * - É seguro rodar de novo: só cria/ajusta o que estiver faltando e nunca apaga dados.
 * - Em instalações antigas, atualiza a tabela `usuarios` e migra os admins (veja database/schema.js).
 */
const { fromEnv } = require('../database/config');
const { ensureSchema } = require('../database/schema');
const { explicarErro } = require('./erros');

async function main() {
  let config;
  try {
    config = fromEnv();
    console.log(`Gerando tabelas em ${config.dbClient}://${config.host}:${config.port}/${config.database}\n`);
    await ensureSchema(config);

    console.log('\nPronto! Próximos passos:');
    console.log('  npm run create-admin   # cria o primeiro administrador');
    console.log('  npm start              # sobe o servidor');
  } catch (err) {
    console.error(`\nErro: ${explicarErro(err, config)}`);
    process.exit(1);
  }
}

main();
