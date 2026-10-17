-- Esquema MySQL. Todos os comandos usam IF NOT EXISTS: pode ser executado várias vezes.
-- Para criar (e atualizar bancos antigos) automaticamente, prefira: npm run db:init
--
-- utf8mb4 é obrigatório para o chat guardar emojis (o "utf8" antigo do MySQL tem só 3 bytes).

-- Contas de acesso. O papel define o que cada conta pode fazer:
--   usuario -> usa o chat
--   admin   -> usa o chat e gerencia contas no painel
-- A coluna `senha` guarda o HASH bcrypt, nunca a senha em texto puro.
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id`        int          NOT NULL AUTO_INCREMENT,
  `nome`      varchar(498) NOT NULL,
  `email`     varchar(255) NOT NULL,
  `telefone`  char(11)     DEFAULT NULL,
  `senha`     varchar(255) NOT NULL,
  `papel`     enum('usuario','admin') NOT NULL DEFAULT 'usuario',
  `criado_em` timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_usuarios_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mensagens do chat. Se a conta for excluída, a mensagem fica e o autor vira NULL
-- ("Usuário removido" na tela), preservando o histórico da conversa.
CREATE TABLE IF NOT EXISTS `mensagens` (
  `id`         bigint       NOT NULL AUTO_INCREMENT,
  `usuario_id` int          DEFAULT NULL,
  `texto`      varchar(500) NOT NULL,
  `criado_em`  timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mensagens_usuario` (`usuario_id`),
  CONSTRAINT `fk_mensagens_usuario` FOREIGN KEY (`usuario_id`)
    REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
