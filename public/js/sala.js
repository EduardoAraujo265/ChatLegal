/* GERADO por "npm run build:web" a partir de web/. Não edite este arquivo. */
(() => {
  // web/diagnostico.js
  document.documentElement.setAttribute("data-app", "js");
  function mostrarFalha(detalhe) {
    const aviso2 = document.querySelector(".aviso-scripts");
    if (!aviso2 || aviso2.hasAttribute("data-falha")) return;
    aviso2.setAttribute("data-falha", "");
    const alvo = aviso2.querySelector(".aviso-scripts__detalhe");
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
  var MATIZES = [190, 210, 235, 265, 295, 325, 355, 15];
  function matizDe(texto) {
    let hash = 0;
    for (const caractere of String(texto)) hash = hash * 31 + caractere.codePointAt(0) >>> 0;
    return MATIZES[hash % MATIZES.length];
  }
  function iniciais(nome) {
    const partes = String(nome).trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return "?";
    const primeira = Array.from(partes[0])[0];
    const ultima = partes.length > 1 ? Array.from(partes[partes.length - 1])[0] : "";
    return (primeira + ultima).toUpperCase();
  }
  function criarAvatar(nome, { pequeno = false } = {}) {
    const avatar = document.createElement("span");
    avatar.className = pequeno ? "avatar avatar--pequeno" : "avatar";
    avatar.textContent = iniciais(nome);
    avatar.style.setProperty("--matiz", matizDe(nome));
    avatar.setAttribute("aria-hidden", "true");
    return avatar;
  }
  function toast(texto, tipo = "ok") {
    let area = document.getElementById("avisos");
    if (!area) {
      area = document.createElement("div");
      area.id = "avisos";
      area.className = "avisos";
      document.body.append(area);
    }
    const aviso2 = document.createElement("div");
    aviso2.className = tipo === "erro" ? "aviso aviso--erro" : "aviso";
    aviso2.setAttribute("role", tipo === "erro" ? "alert" : "status");
    aviso2.textContent = texto;
    area.append(aviso2);
    setTimeout(() => aviso2.remove(), tipo === "erro" ? 6e3 : 4e3);
  }

  // web/shell.js
  async function iniciarShell() {
    const { usuario } = await api("/auth/eu");
    document.getElementById("usuarioAvatar").replaceChildren(criarAvatar(usuario.nome, { pequeno: true }));
    document.getElementById("usuarioNome").textContent = usuario.nome;
    document.getElementById("usuarioPapel").hidden = usuario.papel !== "admin";
    document.getElementById("usuario").hidden = false;
    if (usuario.papel === "admin") {
      document.querySelectorAll("[data-somente-admin]").forEach((el) => el.hidden = false);
    }
    document.getElementById("sair").addEventListener("click", async () => {
      try {
        await api("/auth/logout", { metodo: "POST" });
      } finally {
        location.assign("/login");
      }
    });
    return usuario;
  }

  // web/chat.js
  var INTERVALO_MS = 3e3;
  var LIMITE_TEXTO = 500;
  var AVISAR_A_PARTIR_DE = 400;
  var AGRUPAR_ATE_MS = 5 * 60 * 1e3;
  var lista = document.getElementById("mensagens");
  var vazio = document.getElementById("vazio");
  var aviso = document.getElementById("aviso");
  var botaoNovas = document.getElementById("novas");
  var form = document.getElementById("compositor");
  var campo = document.getElementById("texto");
  var botaoEnviar = document.getElementById("enviar");
  var contador = document.getElementById("contador");
  var formatarHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
  var formatarDia = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  var reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var eu;
  var ultimoId = 0;
  var anterior = null;
  var consultando = false;
  var enviando = false;
  var falhas = 0;
  var desenhadas = /* @__PURE__ */ new Set();
  var chaveDoDia = (data) => `${data.getFullYear()}-${data.getMonth()}-${data.getDate()}`;
  function rotuloDoDia(data) {
    const hoje = /* @__PURE__ */ new Date();
    const ontem = /* @__PURE__ */ new Date();
    ontem.setDate(hoje.getDate() - 1);
    if (chaveDoDia(data) === chaveDoDia(hoje)) return "Hoje";
    if (chaveDoDia(data) === chaveDoDia(ontem)) return "Ontem";
    return formatarDia.format(data);
  }
  var pertoDoFim = () => lista.scrollHeight - lista.scrollTop - lista.clientHeight < 80;
  function rolarParaOFim(suave = false) {
    lista.scrollTo({ top: lista.scrollHeight, behavior: suave && !reduzMovimento ? "smooth" : "auto" });
  }
  lista.addEventListener("scroll", () => {
    if (pertoDoFim()) botaoNovas.hidden = true;
  });
  botaoNovas.addEventListener("click", () => {
    rolarParaOFim(true);
    botaoNovas.hidden = true;
  });
  function criarMensagem(mensagem, { minha, continua }) {
    var _a;
    const autor = (_a = mensagem.autor) != null ? _a : "Usu\xE1rio removido";
    const item = document.createElement("li");
    item.className = ["msg", minha && "msg--minha", continua && "msg--continua"].filter(Boolean).join(" ");
    item.dataset.id = mensagem.id;
    if (!minha) {
      item.append(continua ? document.createElement("span") : criarAvatar(autor));
    }
    const balao = document.createElement("div");
    balao.className = "msg__balao";
    if (!minha && !continua) {
      const nome = document.createElement("span");
      nome.className = "msg__autor";
      nome.textContent = autor;
      nome.style.setProperty("--matiz", matizDe(autor));
      balao.append(nome);
    }
    const texto = document.createElement("p");
    texto.className = "msg__texto";
    texto.textContent = mensagem.texto;
    const hora = document.createElement("time");
    hora.className = "msg__hora";
    hora.dateTime = mensagem.criadoEm;
    hora.textContent = formatarHora.format(new Date(mensagem.criadoEm));
    balao.append(texto, hora);
    item.append(balao);
    return item;
  }
  function adicionar(mensagens) {
    const estavaNoFim = pertoDoFim();
    let chegouAlgo = false;
    let euEnviei = false;
    for (const mensagem of mensagens) {
      if (desenhadas.has(mensagem.id)) continue;
      desenhadas.add(mensagem.id);
      ultimoId = Math.max(ultimoId, mensagem.id);
      const quando = new Date(mensagem.criadoEm);
      const dia = chaveDoDia(quando);
      if (!anterior || anterior.dia !== dia) {
        const divisor = document.createElement("li");
        divisor.className = "dia";
        divisor.textContent = rotuloDoDia(quando);
        lista.append(divisor);
      }
      const minha = mensagem.usuarioId === eu.id;
      const continua = anterior !== null && anterior.dia === dia && mensagem.usuarioId !== null && anterior.usuarioId === mensagem.usuarioId && quando - anterior.quando < AGRUPAR_ATE_MS;
      lista.append(criarMensagem(mensagem, { minha, continua }));
      anterior = { usuarioId: mensagem.usuarioId, quando, dia };
      chegouAlgo = true;
      if (minha) euEnviei = true;
    }
    vazio.hidden = desenhadas.size > 0;
    if (chegouAlgo) {
      if (estavaNoFim || euEnviei) rolarParaOFim();
      else botaoNovas.hidden = false;
    }
  }
  function mostrarAviso(texto) {
    aviso.textContent = texto != null ? texto : "";
    aviso.hidden = !texto;
  }
  async function consultarNovidades() {
    if (consultando || document.hidden) return;
    consultando = true;
    try {
      const { mensagens } = await api(`/mensagens?depois=${ultimoId}`);
      adicionar(mensagens);
      falhas = 0;
      mostrarAviso(null);
    } catch (erro) {
      falhas += 1;
      if (falhas >= 2) mostrarAviso("Sem conex\xE3o. Tentando de novo\u2026");
    } finally {
      consultando = false;
    }
  }
  async function carregarHistorico() {
    try {
      const { mensagens } = await api("/mensagens");
      adicionar(mensagens);
      rolarParaOFim();
      lista.setAttribute("aria-busy", "false");
      mostrarAviso(null);
      setInterval(consultarNovidades, INTERVALO_MS);
    } catch (erro) {
      mostrarAviso("N\xE3o foi poss\xEDvel carregar as mensagens. Tentando de novo\u2026");
      setTimeout(carregarHistorico, INTERVALO_MS);
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && ultimoId > 0) consultarNovidades();
  });
  var contarCaracteres = (texto) => Array.from(texto).length;
  function atualizarCampo() {
    campo.style.height = "auto";
    campo.style.height = `${Math.min(campo.scrollHeight, 140)}px`;
    const tamanho = contarCaracteres(campo.value.trim());
    const longoDemais = tamanho > LIMITE_TEXTO;
    botaoEnviar.disabled = enviando || tamanho === 0 || longoDemais;
    contador.hidden = tamanho < AVISAR_A_PARTIR_DE;
    contador.textContent = `${tamanho}/${LIMITE_TEXTO}`;
    contador.dataset.alerta = longoDemais ? "limite" : tamanho >= LIMITE_TEXTO - 20 ? "perto" : "";
  }
  campo.addEventListener("input", atualizarCampo);
  campo.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" && !evento.shiftKey && !evento.isComposing) {
      evento.preventDefault();
      if (!botaoEnviar.disabled) form.requestSubmit();
    }
  });
  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const texto = campo.value.trim();
    if (!texto || enviando || contarCaracteres(texto) > LIMITE_TEXTO) return;
    enviando = true;
    botaoEnviar.disabled = true;
    try {
      const { mensagem } = await api("/mensagens", { metodo: "POST", corpo: { texto } });
      campo.value = "";
      adicionar([mensagem]);
      rolarParaOFim(true);
    } catch (erro) {
      toast(erro.message, "erro");
    } finally {
      enviando = false;
      atualizarCampo();
      campo.focus();
    }
  });
  async function iniciar() {
    try {
      eu = await iniciarShell();
    } catch (e) {
      return;
    }
    carregarHistorico();
    campo.focus();
  }
  iniciar();
})();
