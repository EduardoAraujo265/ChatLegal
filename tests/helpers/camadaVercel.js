/**
 * Imita a camada que o @vercel/node coloca entre a plataforma e o Express (copiada do
 * dist/dev-server.mjs da versão 24.0.1). Rodar a aplicação por dentro dela nos testes protege
 * contra incompatibilidades que só apareceriam depois do deploy:
 *
 *  - o corpo da requisição é lido ANTES do handler e devolvido em um stream "restaurado";
 *  - req.body, req.query e req.cookies viram propriedades preguiçosas da plataforma;
 *  - res.status, res.json, res.send e res.redirect SUBSTITUEM os do Express
 *    (inclusive o redirect, que por padrão responde 307 em vez de 302).
 *
 * É uma imitação: não substitui um teste no deploy real, mas já pegou e pega muita coisa.
 */
const http = require('http');
const { PassThrough } = require('stream');
const { parse: parseQS } = require('querystring');

const tipoSemParametros = (contentType) => (contentType ? contentType.split(';')[0].trim().toLowerCase() : 'text/plain');

function lerCookies(header) {
  const cookies = {};
  for (const par of String(header || '').split(';')) {
    const i = par.indexOf('=');
    if (i > 0) cookies[par.slice(0, i).trim()] = decodeURIComponent(par.slice(i + 1).trim());
  }
  return cookies;
}

function interpretarCorpo(corpo, contentType) {
  return () => {
    const tipo = tipoSemParametros(contentType);
    if (tipo === 'application/json') {
      try {
        const texto = corpo.toString();
        return texto ? JSON.parse(texto) : {};
      } catch {
        const erro = new Error('Invalid JSON');
        erro.statusCode = 400;
        throw erro;
      }
    }
    if (tipo === 'application/x-www-form-urlencoded') return parseQS(corpo.toString());
    if (tipo === 'application/octet-stream') return corpo;
    if (tipo === 'text/plain') return corpo.toString();
    return undefined;
  };
}

function propriedadePreguicosa(objeto, nome, obter) {
  const base = { configurable: true, enumerable: true };
  const definir = (value) => Object.defineProperty(objeto, nome, { ...base, writable: true, value });
  Object.defineProperty(objeto, nome, {
    ...base,
    get: () => {
      const valor = obter();
      definir(valor);
      return valor;
    },
    set: definir,
  });
}

function enviar(req, res, corpo) {
  let pedaco = corpo;
  if (typeof pedaco === 'string') {
    if (!res.getHeader('content-type')) res.setHeader('content-type', 'text/html');
  } else if (pedaco === null) {
    pedaco = '';
  } else if (!Buffer.isBuffer(pedaco)) {
    return json(req, res, pedaco);
  }
  if (pedaco !== undefined) res.setHeader('content-length', Buffer.byteLength(pedaco));
  if (res.statusCode === 204 || res.statusCode === 304) pedaco = '';
  if (req.method === 'HEAD') res.end();
  else res.end(pedaco);
  return res;
}

function json(req, res, objeto) {
  if (!res.getHeader('content-type')) res.setHeader('content-type', 'application/json; charset=utf-8');
  return enviar(req, res, JSON.stringify(objeto));
}

async function adicionarHelpers(req, res) {
  propriedadePreguicosa(req, 'cookies', () => lerCookies(req.headers.cookie));
  propriedadePreguicosa(req, 'query', () => {
    const consulta = {};
    new URL(req.url || '/', 'http://localhost').searchParams.forEach((valor, chave) => {
      consulta[chave] = chave in consulta ? [].concat(consulta[chave], valor) : valor;
    });
    return consulta;
  });

  const contentType = req.headers['content-type'];
  let corpo = Buffer.from('');
  if (contentType !== undefined) {
    const partes = [];
    for await (const parte of req) partes.push(parte);
    corpo = Buffer.concat(partes);

    // devolve o corpo em um stream falso, como a plataforma faz
    const replica = new PassThrough();
    const on = replica.on.bind(replica);
    const onOriginal = req.on.bind(req);
    req.read = replica.read.bind(replica);
    req.on = req.addListener = (nome, cb) => (nome === 'data' || nome === 'end' ? on(nome, cb) : onOriginal(nome, cb));
    replica.write(corpo);
    replica.end();
  }
  propriedadePreguicosa(req, 'body', interpretarCorpo(corpo, contentType));

  res.status = (codigo) => {
    res.statusCode = codigo;
    return res;
  };
  res.send = (c) => enviar(req, res, c);
  res.json = (o) => json(req, res, o);
  res.redirect = (statusOuUrl, url) => {
    if (typeof statusOuUrl === 'string') {
      url = statusOuUrl;
      statusOuUrl = 307; // padrão da Vercel (o Express usaria 302)
    }
    res.writeHead(statusOuUrl, { Location: url }).end();
    return res;
  };
}

/** Sobe `app` (Express) por dentro da camada imitada. Retorna { url, fechar }. */
async function iniciarNaCamadaVercel(app) {
  const servidor = http.createServer(async (req, res) => {
    try {
      await adicionarHelpers(req, res);
      app(req, res);
    } catch (erro) {
      res.statusCode = erro.statusCode || 500;
      res.end(erro.message);
    }
  });
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));

  return {
    url: `http://127.0.0.1:${servidor.address().port}`,
    fechar: () => new Promise((resolve) => servidor.close(resolve)),
  };
}

module.exports = { iniciarNaCamadaVercel };
