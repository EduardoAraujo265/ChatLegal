/**
 * Popula o banco com dados de demonstração (contas e mensagens de chat), para você ver
 * os filtros e a paginação do painel funcionando.
 *
 *   npm run db:seed              # 45 contas de exemplo
 *   npm run db:seed -- 120       # quantidade à sua escolha
 *
 * Todas as contas de exemplo usam a senha "senha12345".
 * Também cria o admin demo@exemplo.com (mesma senha). Não roda em produção.
 */
const bcrypt = require('bcryptjs');
const { fromEnv } = require('../database/config');
const { conectar } = require('../database/connection');
const { explicarErro } = require('./erros');

const SENHA_DEMO = 'senha12345';

const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João',
  'Karina', 'Lucas', 'Mariana', 'Nicolas', 'Olívia', 'Paulo', 'Rafaela', 'Sérgio', 'Tatiana', 'Vinícius',
  'Aline', 'Caio', 'Débora', 'Eduardo', 'Fernanda', 'Gustavo', 'Helena', 'Igor', 'Juliana', 'Leonardo'];
const SOBRENOMES = ['Almeida', 'Barbosa', 'Cardoso', 'Duarte', 'Esteves', 'Ferreira', 'Gomes', 'Henriques',
  'Lima', 'Machado', 'Nascimento', 'Oliveira', 'Pereira', 'Queiroz', 'Ribeiro', 'Santos', 'Teixeira',
  'Uchoa', 'Vieira', 'Xavier', 'Araújo', 'Batista', 'Coutinho', 'Dias', 'Freitas', 'Guimarães',
  'Moreira', 'Nogueira', 'Rocha', 'Silva'];

const CONVERSA = [
  'Bom dia, pessoal! 👋',
  'Bom dia! Alguém já viu o enunciado do trabalho de Construção de Aplicações Web?',
  'Já vi sim, a entrega é na sexta.',
  'Vocês vão usar MySQL ou Postgres?',
  'MySQL, é o que temos no laboratório.',
  'Dica: usem consultas parametrizadas, nada de concatenar texto no SQL 😉',
  'Verdade! E guardem a senha com hash, nunca em texto puro.',
  'bcrypt resolve isso em duas linhas.',
  'Alguém sabe como paginar a tabela de usuários?',
  'LIMIT e OFFSET, e um COUNT para saber quantas páginas existem.',
  'Obrigada! Vou testar agora.',
  'Funcionou aqui, valeu!',
  'Quem vai ficar para a monitoria de quinta?',
  'Eu vou, preciso tirar dúvida sobre autenticação.',
  'Levem o notebook, vamos revisar juntos.',
  'Combinado. Até lá! 🚀',
];

const semAcento = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Recusado: o seed cria contas com senha conhecida e não deve rodar em produção.');
    process.exit(1);
  }

  const quantidade = Math.max(1, Math.min(Number(process.argv[2]) || 45, 1000));
  let config;

  try {
    config = fromEnv();
    const conn = await conectar(config);

    try {
      const mysql = conn.dialeto === 'mysql';
      const hash = await bcrypt.hash(SENHA_DEMO, 10);
      const ids = [];
      let criados = 0;

      const inserirConta = async (nome, email, telefone, papel) => {
        const existente = await conn.query('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existente.length > 0) {
          ids.push(existente[0].id);
          return;
        }
        await conn.query(
          'INSERT INTO usuarios (nome, email, telefone, senha, papel) VALUES (?, ?, ?, ?, ?)',
          [nome, email, telefone, hash, papel]
        );
        const [{ id }] = await conn.query('SELECT id FROM usuarios WHERE email = ?', [email]);
        ids.push(id);
        criados++;
      };

      await inserirConta('Conta Demo', 'demo@exemplo.com', null, 'admin');

      for (let i = 0; i < quantidade; i++) {
        const nome = NOMES[i % NOMES.length];
        const sobrenome = SOBRENOMES[(i * 7 + Math.floor(i / NOMES.length)) % SOBRENOMES.length];
        const email = `${semAcento(nome)}.${semAcento(sobrenome)}${i + 1}@exemplo.com`;
        const telefone = `219${String(10000000 + ((i * 7919321) % 90000000))}`.slice(0, 11);
        await inserirConta(`${nome} ${sobrenome}`, email, telefone, 'usuario');
      }

      // mensagens espalhadas pelos últimos dias, para o chat ter histórico
      const jaTemMensagens = (await conn.query('SELECT COUNT(*) AS total FROM mensagens'))[0].total > 0;
      let mensagens = 0;

      if (!jaTemMensagens) {
        const atras = mysql ? 'NOW() - INTERVAL ? MINUTE' : "NOW() - (? * INTERVAL '1 minute')";
        for (let i = 0; i < CONVERSA.length; i++) {
          const minutos = 2880 - i * 140; // de ~2 dias atrás até agora
          await conn.query(`INSERT INTO mensagens (usuario_id, texto, criado_em) VALUES (?, ?, ${atras})`, [
            ids[(i * 5) % ids.length],
            CONVERSA[i],
            Math.max(minutos, 1),
          ]);
          mensagens++;
        }
      }

      console.log(`Contas criadas: ${criados} (as que já existiam foram mantidas).`);
      console.log(`Mensagens criadas: ${mensagens}${jaTemMensagens ? ' (o chat já tinha mensagens, nada foi adicionado)' : ''}.`);
      console.log(`\nAdmin de demonstração: demo@exemplo.com / ${SENHA_DEMO}`);
    } finally {
      await conn.close();
    }
  } catch (err) {
    console.error(`\nErro: ${explicarErro(err, config)}`);
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === '42P01') console.error('Rode antes: npm run db:init');
    process.exit(1);
  }
}

main();
