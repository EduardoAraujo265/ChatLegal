const app = require('./app');
const env = require('./config/env');
const { close } = require('./config/database');

const server = app.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port}`);
});

function encerrar() {
  server.close(async () => {
    await close();
    process.exit(0);
  });
}
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
