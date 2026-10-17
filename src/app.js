const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const env = require('./config/env');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const messageRoutes = require('./routes/messageRoutes');
const pageRoutes = require('./routes/pageRoutes');
const healthRoutes = require('./routes/healthRoutes');
const semCredenciaisNaUrl = require('./middleware/semCredenciaisNaUrl');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();

app.set('trust proxy', env.trustProxy);

// Tudo (CSS, JS, fontes) é servido pelo próprio app, então a política pode ser bem restrita:
// nada de CDN e nenhum script ou estilo inline.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        fontSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        // Em desenvolvimento (http://localhost) esta diretiva quebra o carregamento no Safari.
        upgradeInsecureRequests: env.isProduction ? [] : null,
      },
    },
  })
);
app.use(semCredenciaisNaUrl);
app.use(express.json());
app.use(cookieParser());

app.use('/saude', healthRoutes);
app.use('/auth', authRoutes);
app.use('/usuarios', userRoutes);
app.use('/mensagens', messageRoutes);

// Páginas com controle de acesso vêm antes dos arquivos estáticos.
app.use(pageRoutes);
app.use(express.static(PUBLIC_DIR, { index: false }));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
