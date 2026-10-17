import { api } from './api.js';
import { aguardar, EMAIL_VALIDO, limparErroAoDigitar, limparErros, mostrarErros } from './ui.js';

const form = document.getElementById('form');
const botao = form.querySelector('button[type="submit"]');
let enviando = false;

limparErroAoDigitar(form);

function validar(dados) {
  const erros = [];
  const digitos = dados.telefone.replace(/\D/g, '');

  if (!dados.nome.trim()) erros.push({ campo: 'nome', mensagem: 'Informe seu nome.' });
  if (!EMAIL_VALIDO.test(dados.email.trim())) erros.push({ campo: 'email', mensagem: 'Informe um e-mail válido.' });
  if (digitos && !/^\d{10,11}$/.test(digitos)) {
    erros.push({ campo: 'telefone', mensagem: 'O telefone deve ter 10 ou 11 dígitos (com DDD).' });
  }
  if (dados.senha.length < 8) {
    erros.push({ campo: 'senha', mensagem: 'A senha deve ter ao menos 8 caracteres.' });
  } else if (new TextEncoder().encode(dados.senha).length > 72) {
    erros.push({ campo: 'senha', mensagem: 'A senha pode ter no máximo 72 bytes.' });
  } else if (dados.confirmarSenha !== dados.senha) {
    erros.push({ campo: 'confirmarSenha', mensagem: 'As senhas não são iguais.' });
  }
  return erros;
}

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (enviando) return;
  limparErros(form);

  const dados = Object.fromEntries(new FormData(form));
  const erros = validar(dados);
  if (erros.length > 0) return mostrarErros(form, erros);

  enviando = true;
  try {
    await aguardar(
      botao,
      api('/auth/cadastro', {
        metodo: 'POST',
        corpo: { nome: dados.nome.trim(), email: dados.email.trim(), telefone: dados.telefone.trim(), senha: dados.senha },
      })
    );
    location.assign('/chat'); // a conta já nasce logada
  } catch (erro) {
    mostrarErros(form, erro.errors, erro.message);
    enviando = false;
  }
});
