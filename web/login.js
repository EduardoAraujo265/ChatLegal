import './diagnostico.js';
import { api } from './api.js';
import { aguardar, limparErroAoDigitar, limparErros, mostrarErros } from './ui.js';

const form = document.getElementById('form');
const botao = form.querySelector('button[type="submit"]');
let enviando = false;

limparErroAoDigitar(form);

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (enviando) return;
  limparErros(form);

  const dados = Object.fromEntries(new FormData(form));
  const erros = [];
  if (!dados.email.trim()) erros.push({ campo: 'email', mensagem: 'Informe seu e-mail.' });
  if (!dados.senha) erros.push({ campo: 'senha', mensagem: 'Informe sua senha.' });
  if (erros.length > 0) return mostrarErros(form, erros);

  enviando = true;
  try {
    await aguardar(botao, api('/auth/login', { metodo: 'POST', corpo: { email: dados.email.trim(), senha: dados.senha } }));
    location.assign('/chat');
  } catch (erro) {
    mostrarErros(form, erro.errors, erro.message);
    enviando = false;
  }
});
