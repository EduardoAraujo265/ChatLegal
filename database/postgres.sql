-- Esquema PostgreSQL. Todos os comandos usam IF NOT EXISTS: pode ser executado várias vezes.
-- Para criar (e atualizar bancos antigos) automaticamente, prefira: npm run db:init

-- Contas de acesso. O papel define o que cada conta pode fazer:
--   usuario -> usa o chat
--   admin   -> usa o chat e gerencia contas no painel
-- A coluna "senha" guarda o HASH bcrypt, nunca a senha em texto puro.
CREATE TABLE IF NOT EXISTS usuarios (
    id        SERIAL PRIMARY KEY,
    nome      VARCHAR(498) NOT NULL,
    email     VARCHAR(255) NOT NULL,
    telefone  CHAR(11),
    senha     VARCHAR(255) NOT NULL,
    papel     VARCHAR(10)  NOT NULL DEFAULT 'usuario' CHECK (papel IN ('usuario', 'admin')),
    criado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_usuarios_email UNIQUE (email)  -- a aplicação sempre grava e-mails em minúsculas
);

-- Mensagens do chat. Se a conta for excluída, a mensagem fica e o autor vira NULL
-- ("Usuário removido" na tela), preservando o histórico da conversa.
CREATE TABLE IF NOT EXISTS mensagens (
    id         BIGSERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios (id) ON DELETE SET NULL,
    texto      VARCHAR(500) NOT NULL,
    criado_em  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensagens_usuario ON mensagens (usuario_id);
