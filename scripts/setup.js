/**
 * Setup interativo: pergunta os dados do banco, gera o .env (com um JWT_SECRET aleatório),
 * cria o banco e as tabelas (mesma rotina do `npm run db:init`) e cadastra o primeiro admin.
 *
 *   npm run setup
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { conectar } = require('../database/connection');
const { ensureSchema } = require('../database/schema');
const { salvarAdmin } = require('../database/admin');
const { criarPrompt } = require('./prompt');
const { explicarErro } = require('./erros');

const ENV_PATH = path.join(__dirname, '..', '.env');

async function main() {
  const prompt = criarPrompt();
  let config;

  try {
    console.log('=== Setup do CRUD Node + Chat ===\n');

    if (fs.existsSync(ENV_PATH) && !(await prompt.askYesNo('Já existe um .env. Sobrescrever?', false))) {
      console.log('Setup cancelado, .env mantido como estava.');
      return;
    }

    const dbClient = (
      await prompt.ask('Banco de dados (mysql/postgres)', { padrao: 'mysql', obrigatorio: true })
    ).toLowerCase();
    if (!['mysql', 'postgres'].includes(dbClient)) {
      throw new Error('O banco precisa ser "mysql" ou "postgres".');
    }

    const host = await prompt.ask('Host do banco', { padrao: 'localhost', obrigatorio: true });
    const port = await prompt.ask('Porta do banco', {
      padrao: dbClient === 'mysql' ? '3306' : '5432',
      obrigatorio: true,
    });
    const user = await prompt.ask('Usuário do banco', { padrao: 'root', obrigatorio: true });
    const password = (await prompt.ask('Senha do banco', { secreto: true })) || '';
    const database = await prompt.ask('Nome do banco de dados', { padrao: 'crud_nodejs', obrigatorio: true });
    const appPort = await prompt.ask('Porta do servidor Node', { padrao: '5000', obrigatorio: true });

    config = { dbClient, host, port: Number(port), user, password, database };

    fs.writeFileSync(
      ENV_PATH,
      [
        `DB_CLIENT=${dbClient}`,
        `DB_HOST=${host}`,
        `DB_USER=${user}`,
        `DB_PASSWORD=${password}`,
        `DB_NAME=${database}`,
        `DB_PORT=${port}`,
        `JWT_SECRET=${crypto.randomBytes(48).toString('hex')}`,
        `PORT=${appPort}`,
        'NODE_ENV=development',
        '',
      ].join('\n')
    );
    console.log(`\n.env criado em ${ENV_PATH}\n`);

    if (await prompt.askYesNo('Criar o banco de dados e as tabelas agora?', true)) {
      await ensureSchema(config);
    }

    if (await prompt.askYesNo('Cadastrar o primeiro administrador agora?', true)) {
      const nome = await prompt.ask('Nome do admin', { padrao: 'Admin', obrigatorio: true });
      const email = await prompt.ask('E-mail do admin', { obrigatorio: true });
      const senha = await prompt.ask('Senha do admin (mínimo 8 caracteres)', { obrigatorio: true, secreto: true });

      if (senha.length < 8) throw new Error('A senha precisa ter ao menos 8 caracteres.');

      const conn = await conectar(config);
      try {
        await salvarAdmin(conn, { nome, email, senha });
        console.log(`Admin "${email}" cadastrado com sucesso.`);
      } finally {
        await conn.close();
      }
    }

    console.log('\nTudo pronto! Para subir o servidor:\n  npm start   (ou npm run dev)\n');
  } catch (err) {
    console.error(`\nErro durante o setup: ${explicarErro(err, config)}`);
    process.exitCode = 1;
  } finally {
    prompt.close();
  }
}

main();
