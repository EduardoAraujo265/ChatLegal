/* GERADO por "npm run build:web" a partir de web/. Não edite este arquivo. */
(() => {
  // web/diagnostico.js
  document.documentElement.setAttribute("data-app", "js");
  function mostrarFalha(detalhe) {
    const aviso = document.querySelector(".aviso-scripts");
    if (!aviso || aviso.hasAttribute("data-falha")) return;
    aviso.setAttribute("data-falha", "");
    const alvo = aviso.querySelector(".aviso-scripts__detalhe");
    if (alvo) alvo.textContent = detalhe;
  }
  window.addEventListener("error", (evento) => {
    const arquivo = (evento.filename || "").split("/").pop();
    mostrarFalha(`${evento.message}${arquivo ? ` (${arquivo}:${evento.lineno})` : ""}`);
  });
  window.addEventListener("unhandledrejection", (evento) => {
    const motivo = evento.reason;
    mostrarFalha(String(motivo && motivo.message || motivo || "erro desconhecido"));
  });

  // web/api.js
  var ApiError = class extends Error {
    constructor(message, status, errors = []) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.errors = errors;
    }
  };
  var ROTAS_DE_ACESSO = ["/auth/login", "/auth/cadastro"];
  async function api(caminho, { metodo = "GET", corpo, sinal } = {}) {
    let resposta;
    try {
      resposta = await fetch(caminho, {
        method: metodo,
        headers: corpo !== void 0 ? { "Content-Type": "application/json" } : void 0,
        body: corpo !== void 0 ? JSON.stringify(corpo) : void 0,
        signal: sinal,
        credentials: "same-origin"
      });
    } catch (erro) {
      if (erro.name === "AbortError") throw erro;
      throw new ApiError("N\xE3o foi poss\xEDvel conectar ao servidor. Verifique sua conex\xE3o.", 0);
    }
    let dados = null;
    try {
      dados = await resposta.json();
    } catch (e) {
    }
    if (!resposta.ok) {
      if (resposta.status === 401 && !ROTAS_DE_ACESSO.includes(caminho)) {
        location.assign("/login");
      }
      throw new ApiError((dados == null ? void 0 : dados.message) || "N\xE3o foi poss\xEDvel concluir a a\xE7\xE3o.", resposta.status, (dados == null ? void 0 : dados.errors) || []);
    }
    return dados;
  }

  // web/ui.js
  function limparErros(form2) {
    form2.querySelectorAll(".campo__erro").forEach((el) => el.textContent = "");
    form2.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    const geral = form2.querySelector(".form__erro");
    if (geral) geral.textContent = "";
  }
  function mostrarErros(form2, erros = [], mensagemGeral = "") {
    var _a, _b;
    let primeiroInvalido = null;
    const semCampo = [];
    for (const { campo, mensagem } of erros) {
      const entrada = form2.elements[campo];
      const alvo = form2.querySelector(`#erro-${campo}`);
      if (!entrada || !alvo) {
        semCampo.push(mensagem);
        continue;
      }
      alvo.textContent = mensagem;
      entrada.setAttribute("aria-invalid", "true");
      const descritores = new Set((entrada.getAttribute("aria-describedby") || "").split(" ").filter(Boolean));
      descritores.add(alvo.id);
      entrada.setAttribute("aria-describedby", [...descritores].join(" "));
      primeiroInvalido != null ? primeiroInvalido : primeiroInvalido = entrada;
    }
    const geral = form2.querySelector(".form__erro");
    if (geral) {
      geral.textContent = semCampo.length > 0 ? semCampo.join(" ") : erros.length === 0 ? mensagemGeral : "";
    }
    (_b = (_a = primeiroInvalido || (geral && geral.textContent ? geral : null)) == null ? void 0 : _a.focus) == null ? void 0 : _b.call(_a);
  }
  function limparErroAoDigitar(form2) {
    form2.addEventListener("input", (evento) => {
      const entrada = evento.target;
      if (!entrada.name) return;
      entrada.removeAttribute("aria-invalid");
      const alvo = form2.querySelector(`#erro-${entrada.name}`);
      if (alvo) alvo.textContent = "";
    });
  }
  async function aguardar(botao2, promessa) {
    botao2.setAttribute("aria-busy", "true");
    try {
      return await promessa;
    } finally {
      botao2.removeAttribute("aria-busy");
    }
  }

  // web/login.js
  var form = document.getElementById("form");
  var botao = form.querySelector('button[type="submit"]');
  var enviando = false;
  limparErroAoDigitar(form);
  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (enviando) return;
    limparErros(form);
    const dados = Object.fromEntries(new FormData(form));
    const erros = [];
    if (!dados.email.trim()) erros.push({ campo: "email", mensagem: "Informe seu e-mail." });
    if (!dados.senha) erros.push({ campo: "senha", mensagem: "Informe sua senha." });
    if (erros.length > 0) return mostrarErros(form, erros);
    enviando = true;
    try {
      await aguardar(botao, api("/auth/login", { metodo: "POST", corpo: { email: dados.email.trim(), senha: dados.senha } }));
      location.assign("/chat");
    } catch (erro) {
      mostrarErros(form, erro.errors, erro.message);
      enviando = false;
    }
  });
})();
