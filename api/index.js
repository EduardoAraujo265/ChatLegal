const app = require('../src/app');

// Em ambiente serverless (Vercel) não chamamos app.listen(); apenas
// exportamos o app para que a plataforma o invoque a cada requisição.
module.exports = app;
