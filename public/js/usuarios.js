/* GERADO por "npm run build:web" a partir de web/. Não edite este arquivo. */
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };

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
  async function api(caminho, { metodo = "GET", corpo: corpo2, sinal } = {}) {
    let resposta;
    try {
      resposta = await fetch(caminho, {
        method: metodo,
        headers: corpo2 !== void 0 ? { "Content-Type": "application/json" } : void 0,
        body: corpo2 !== void 0 ? JSON.stringify(corpo2) : void 0,
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
  function formatarTelefone(digitos) {
    if (!digitos) return "\u2014";
    const d = String(digitos);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return d;
  }
  function formatarData(iso) {
    return new Date(iso).toLocaleDateString("pt-BR");
  }
  function toast(texto, tipo = "ok") {
    let area = document.getElementById("avisos");
    if (!area) {
      area = document.createElement("div");
      area.id = "avisos";
      area.className = "avisos";
      document.body.append(area);
    }
    const aviso = document.createElement("div");
    aviso.className = tipo === "erro" ? "aviso aviso--erro" : "aviso";
    aviso.setAttribute("role", tipo === "erro" ? "alert" : "status");
    aviso.textContent = texto;
    area.append(aviso);
    setTimeout(() => aviso.remove(), tipo === "erro" ? 6e3 : 4e3);
  }
  function limparErros(form) {
    form.querySelectorAll(".campo__erro").forEach((el) => el.textContent = "");
    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    const geral = form.querySelector(".form__erro");
    if (geral) geral.textContent = "";
  }
  function mostrarErros(form, erros = [], mensagemGeral = "") {
    var _a, _b;
    let primeiroInvalido = null;
    const semCampo = [];
    for (const { campo, mensagem } of erros) {
      const entrada = form.elements[campo];
      const alvo = form.querySelector(`#erro-${campo}`);
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
    const geral = form.querySelector(".form__erro");
    if (geral) {
      geral.textContent = semCampo.length > 0 ? semCampo.join(" ") : erros.length === 0 ? mensagemGeral : "";
    }
    (_b = (_a = primeiroInvalido || (geral && geral.textContent ? geral : null)) == null ? void 0 : _a.focus) == null ? void 0 : _b.call(_a);
  }
  function limparErroAoDigitar(form) {
    form.addEventListener("input", (evento) => {
      const entrada = evento.target;
      if (!entrada.name) return;
      entrada.removeAttribute("aria-invalid");
      const alvo = form.querySelector(`#erro-${entrada.name}`);
      if (alvo) alvo.textContent = "";
    });
  }
  async function aguardar(botao, promessa) {
    botao.setAttribute("aria-busy", "true");
    try {
      return await promessa;
    } finally {
      botao.removeAttribute("aria-busy");
    }
  }
  var EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  function atualizarUsuarioNoTopo(usuario) {
    document.getElementById("usuarioAvatar").replaceChildren(criarAvatar(usuario.nome, { pequeno: true }));
    document.getElementById("usuarioNome").textContent = usuario.nome;
  }

  // web/dashboard.js
  var PADRAO = { pagina: 1, limite: 10, nome: "", email: "", telefone: "", papel: "", ordenar: "criado", direcao: "desc" };
  var LIMITES = [10, 25, 50, 100];
  var ORDENAVEIS = ["nome", "email", "criado"];
  var FILTROS = ["nome", "email", "telefone", "papel"];
  function lerDaUrl() {
    var _a;
    const params = new URLSearchParams(location.search);
    const inteiro = (valor) => {
      const numero = Number.parseInt(valor, 10);
      return Number.isFinite(numero) && numero >= 1 ? numero : null;
    };
    const texto = (chave) => (params.get(chave) || "").slice(0, 100);
    const limite = inteiro(params.get("limite"));
    const papel = params.get("papel");
    const direcao = params.get("direcao");
    return {
      pagina: (_a = inteiro(params.get("pagina"))) != null ? _a : PADRAO.pagina,
      limite: LIMITES.includes(limite) ? limite : PADRAO.limite,
      nome: texto("nome"),
      email: texto("email"),
      telefone: texto("telefone"),
      papel: ["usuario", "admin"].includes(papel) ? papel : "",
      ordenar: ORDENAVEIS.includes(params.get("ordenar")) ? params.get("ordenar") : PADRAO.ordenar,
      direcao: ["asc", "desc"].includes(direcao) ? direcao : PADRAO.direcao
    };
  }
  var estado = lerDaUrl();
  function escreverNaUrl() {
    const params = new URLSearchParams();
    for (const [chave, valor] of Object.entries(estado)) {
      if (valor !== PADRAO[chave]) params.set(chave, valor);
    }
    const texto = params.toString();
    history.replaceState(null, "", texto ? `?${texto}` : location.pathname);
  }
  var temFiltro = () => FILTROS.some((chave) => estado[chave] !== "");
  function montarConsulta() {
    const params = new URLSearchParams({
      pagina: estado.pagina,
      limite: estado.limite,
      ordenar: estado.ordenar,
      direcao: estado.direcao
    });
    for (const chave of FILTROS) {
      if (estado[chave]) params.set(chave, estado[chave]);
    }
    return params;
  }
  var $ = (id) => document.getElementById(id);
  var tabela = $("tabela");
  var corpo = $("corpo");
  var resumo = $("resumo");
  var listaPaginas = $("paginas");
  var formFiltros = $("filtros");
  var botaoLimpar = $("limpar");
  var seletorLimite = $("limite");
  var entradas = { nome: $("filtroNome"), email: $("filtroEmail"), telefone: $("filtroTelefone"), papel: $("filtroPapel") };
  var dialogoUsuario = $("dialogoUsuario");
  var formUsuario = $("formUsuario");
  var dialogoExcluir = $("dialogoExcluir");
  var eu;
  var controlador = null;
  var sequencia = 0;
  var usuariosDaPagina = /* @__PURE__ */ new Map();
  function celula(texto, classe) {
    const td = document.createElement("td");
    if (classe) td.className = classe;
    td.textContent = texto;
    return td;
  }
  function botaoAcao(texto, classe, acao, usuario, desabilitado = false) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = `btn btn--pequeno ${classe}`;
    botao.textContent = texto;
    botao.dataset.acao = acao;
    botao.dataset.id = usuario.id;
    botao.setAttribute("aria-label", `${texto} ${usuario.nome}`);
    botao.disabled = desabilitado;
    return botao;
  }
  function criarLinha(usuario) {
    const linha = document.createElement("tr");
    const souEu = usuario.id === eu.id;
    const pessoa = document.createElement("div");
    pessoa.className = "pessoa";
    const nome = document.createElement("span");
    nome.className = "pessoa__nome";
    nome.textContent = usuario.nome;
    nome.title = usuario.nome;
    pessoa.append(criarAvatar(usuario.nome, { pequeno: true }), nome);
    if (souEu) {
      const voce = document.createElement("span");
      voce.className = "pessoa__voce";
      voce.textContent = "(voc\xEA)";
      pessoa.append(voce);
    }
    const celulaNome = document.createElement("td");
    celulaNome.append(pessoa);
    const selo = document.createElement("span");
    selo.className = usuario.papel === "admin" ? "selo selo--admin" : "selo selo--usuario";
    selo.textContent = usuario.papel === "admin" ? "Administrador" : "Usu\xE1rio";
    const celulaPapel = document.createElement("td");
    celulaPapel.append(selo);
    const acoes = document.createElement("td");
    acoes.className = "acoes";
    const excluir = botaoAcao("Excluir", "btn--texto-perigo", "excluir", usuario, souEu);
    if (souEu) excluir.title = "Voc\xEA n\xE3o pode excluir a pr\xF3pria conta";
    acoes.append(botaoAcao("Editar", "btn--secundario", "editar", usuario), " ", excluir);
    linha.append(
      celulaNome,
      celula(usuario.email, "celula-suave"),
      celula(formatarTelefone(usuario.telefone), "celula-suave numero"),
      celulaPapel,
      celula(formatarData(usuario.criadoEm), "celula-suave numero"),
      acoes
    );
    return linha;
  }
  function mostrarEstadoNaTabela(mensagem, acao) {
    const linha = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.className = "tabela__estado";
    td.append(mensagem);
    if (acao) {
      td.append(document.createElement("br"));
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "btn btn--secundario";
      botao.textContent = acao.texto;
      botao.addEventListener("click", acao.aoClicar);
      td.append(botao);
    }
    linha.append(td);
    corpo.replaceChildren(linha);
  }
  function atualizarCabecalhos() {
    for (const botao of document.querySelectorAll(".ordenar")) {
      const ativo = botao.dataset.ordem === estado.ordenar;
      botao.closest("th").setAttribute("aria-sort", ativo ? estado.direcao === "asc" ? "ascending" : "descending" : "none");
    }
  }
  function textoDoResumo(paginacao) {
    if (paginacao.total === 0) return temFiltro() ? "Nenhum usu\xE1rio corresponde aos filtros." : "Nenhum usu\xE1rio cadastrado.";
    const inicio = (paginacao.pagina - 1) * paginacao.limite + 1;
    const fim = Math.min(paginacao.pagina * paginacao.limite, paginacao.total);
    const unidade = paginacao.total === 1 ? "usu\xE1rio" : "usu\xE1rios";
    return `Mostrando ${inicio} a ${fim} de ${paginacao.total} ${unidade}${temFiltro() ? " (filtrados)" : ""}`;
  }
  function botaoDePagina(rotulo, { pagina, desabilitado = false, atual = false, seta = null, descricao }) {
    const item = document.createElement("li");
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = seta ? "pagina pagina--seta" : "pagina";
    botao.disabled = desabilitado;
    botao.dataset.pagina = pagina;
    if (descricao) botao.setAttribute("aria-label", descricao);
    if (atual) botao.setAttribute("aria-current", "page");
    if (seta) {
      const glifo = document.createElement("span");
      glifo.className = "pagina__glifo";
      glifo.setAttribute("aria-hidden", "true");
      glifo.textContent = seta === "anterior" ? "\u2039" : "\u203A";
      const texto = document.createElement("span");
      texto.className = "pagina__rotulo";
      texto.textContent = rotulo;
      botao.append(...seta === "anterior" ? [glifo, texto] : [texto, glifo]);
    } else {
      botao.textContent = rotulo;
    }
    item.append(botao);
    return item;
  }
  function desenharPaginas({ pagina, totalPaginas, paginas }) {
    var _a;
    const tinhaFoco = listaPaginas.contains(document.activeElement);
    const itens = [botaoDePagina("Anterior", { pagina: pagina - 1, desabilitado: pagina <= 1, seta: "anterior", descricao: "P\xE1gina anterior" })];
    for (const item of paginas) {
      if (item === "\u2026") {
        const reticencias = document.createElement("li");
        reticencias.className = "paginacao__reticencias";
        reticencias.setAttribute("aria-hidden", "true");
        reticencias.textContent = "\u2026";
        itens.push(reticencias);
      } else {
        itens.push(botaoDePagina(String(item), { pagina: item, atual: item === pagina, descricao: `P\xE1gina ${item}` }));
      }
    }
    itens.push(botaoDePagina("Pr\xF3xima", { pagina: pagina + 1, desabilitado: pagina >= totalPaginas, seta: "proxima", descricao: "Pr\xF3xima p\xE1gina" }));
    listaPaginas.replaceChildren(...itens);
    if (tinhaFoco) (_a = listaPaginas.querySelector('[aria-current="page"]')) == null ? void 0 : _a.focus();
  }
  listaPaginas.addEventListener("click", (evento) => {
    const botao = evento.target.closest("button[data-pagina]");
    if (!botao || botao.disabled) return;
    estado.pagina = Number(botao.dataset.pagina);
    carregar();
  });
  async function carregar() {
    controlador == null ? void 0 : controlador.abort();
    controlador = new AbortController();
    const minhaVez = ++sequencia;
    tabela.setAttribute("aria-busy", "true");
    botaoLimpar.hidden = !temFiltro();
    atualizarCabecalhos();
    try {
      const { dados, paginacao } = await api(`/usuarios?${montarConsulta()}`, { sinal: controlador.signal });
      estado.pagina = paginacao.pagina;
      escreverNaUrl();
      usuariosDaPagina = new Map(dados.map((usuario) => [usuario.id, usuario]));
      if (dados.length === 0) {
        mostrarEstadoNaTabela(
          temFiltro() ? "Nenhum usu\xE1rio corresponde a esses filtros." : "Ainda n\xE3o h\xE1 usu\xE1rios cadastrados.",
          temFiltro() ? { texto: "Limpar filtros", aoClicar: limparFiltros } : null
        );
      } else {
        corpo.replaceChildren(...dados.map(criarLinha));
      }
      resumo.textContent = textoDoResumo(paginacao);
      desenharPaginas(paginacao);
    } catch (erro) {
      if (erro.name === "AbortError") return;
      if (erro.status === 403) return location.assign("/chat");
      mostrarEstadoNaTabela(erro.message, { texto: "Tentar de novo", aoClicar: carregar });
      resumo.textContent = "";
      listaPaginas.replaceChildren();
    } finally {
      if (minhaVez === sequencia) tabela.removeAttribute("aria-busy");
    }
  }
  var esperaDigitacao;
  function aplicarFiltros(imediato) {
    clearTimeout(esperaDigitacao);
    const aplicar = () => {
      for (const chave of FILTROS) estado[chave] = entradas[chave].value.trim();
      estado.pagina = 1;
      carregar();
    };
    if (imediato) aplicar();
    else esperaDigitacao = setTimeout(aplicar, 300);
  }
  function limparFiltros() {
    for (const chave of FILTROS) entradas[chave].value = "";
    aplicarFiltros(true);
    entradas.nome.focus();
  }
  for (const chave of ["nome", "email", "telefone"]) {
    entradas[chave].addEventListener("input", () => aplicarFiltros(false));
  }
  entradas.papel.addEventListener("change", () => aplicarFiltros(true));
  formFiltros.addEventListener("submit", (evento) => {
    evento.preventDefault();
    aplicarFiltros(true);
  });
  botaoLimpar.addEventListener("click", limparFiltros);
  seletorLimite.addEventListener("change", () => {
    estado.limite = Number(seletorLimite.value);
    estado.pagina = 1;
    carregar();
  });
  document.querySelector("thead").addEventListener("click", (evento) => {
    const botao = evento.target.closest(".ordenar");
    if (!botao) return;
    const coluna = botao.dataset.ordem;
    if (estado.ordenar === coluna) {
      estado.direcao = estado.direcao === "asc" ? "desc" : "asc";
    } else {
      estado.ordenar = coluna;
      estado.direcao = coluna === "criado" ? "desc" : "asc";
    }
    estado.pagina = 1;
    carregar();
  });
  var editando = null;
  var salvando = false;
  var campoSenha = $("usuarioSenha");
  var campoPapel = $("usuarioPapelCampo");
  function abrirFormulario(usuario) {
    editando = usuario;
    formUsuario.reset();
    limparErros(formUsuario);
    $("tituloUsuario").textContent = usuario ? "Editar usu\xE1rio" : "Novo usu\xE1rio";
    $("salvarUsuario").textContent = usuario ? "Salvar altera\xE7\xF5es" : "Criar usu\xE1rio";
    $("rotuloSenha").textContent = usuario ? "Nova senha" : "Senha";
    $("ajuda-senha").textContent = usuario ? "Deixe em branco para manter a senha atual." : "M\xEDnimo de 8 caracteres.";
    if (usuario) {
      formUsuario.elements.nome.value = usuario.nome;
      formUsuario.elements.email.value = usuario.email;
      formUsuario.elements.telefone.value = usuario.telefone ? formatarTelefone(usuario.telefone) : "";
      campoPapel.value = usuario.papel;
    }
    campoPapel.disabled = Boolean(usuario && usuario.id === eu.id);
    $("ajuda-papel").hidden = !campoPapel.disabled;
    dialogoUsuario.showModal();
    formUsuario.elements.nome.focus();
  }
  function validar(dados, criando) {
    const erros = [];
    const digitos = dados.telefone.replace(/\D/g, "");
    if (!dados.nome.trim()) erros.push({ campo: "nome", mensagem: "Informe o nome." });
    if (!EMAIL_VALIDO.test(dados.email.trim())) erros.push({ campo: "email", mensagem: "Informe um e-mail v\xE1lido." });
    if (digitos && !/^\d{10,11}$/.test(digitos)) {
      erros.push({ campo: "telefone", mensagem: "O telefone deve ter 10 ou 11 d\xEDgitos (com DDD)." });
    }
    if ((criando || dados.senha) && dados.senha.length < 8) {
      erros.push({ campo: "senha", mensagem: "A senha deve ter ao menos 8 caracteres." });
    } else if (new TextEncoder().encode(dados.senha).length > 72) {
      erros.push({ campo: "senha", mensagem: "A senha pode ter no m\xE1ximo 72 bytes." });
    }
    return erros;
  }
  limparErroAoDigitar(formUsuario);
  formUsuario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (salvando) return;
    limparErros(formUsuario);
    const campos = formUsuario.elements;
    const dados = {
      nome: campos.nome.value,
      email: campos.email.value,
      telefone: campos.telefone.value,
      senha: campos.senha.value
    };
    const erros = validar(dados, !editando);
    if (erros.length > 0) return mostrarErros(formUsuario, erros);
    const corpoRequisicao = { nome: dados.nome.trim(), email: dados.email.trim(), telefone: dados.telefone.trim() };
    if (dados.senha) corpoRequisicao.senha = dados.senha;
    if (!campoPapel.disabled) corpoRequisicao.papel = campoPapel.value;
    salvando = true;
    try {
      const botao = $("salvarUsuario");
      const resposta = editando ? await aguardar(botao, api(`/usuarios/${editando.id}`, { metodo: "PATCH", corpo: corpoRequisicao })) : await aguardar(botao, api("/usuarios", { metodo: "POST", corpo: corpoRequisicao }));
      dialogoUsuario.close();
      toast(editando ? "Altera\xE7\xF5es salvas." : "Usu\xE1rio criado.");
      if (editando && editando.id === eu.id) {
        eu = __spreadValues(__spreadValues({}, eu), resposta.usuario);
        atualizarUsuarioNoTopo(eu);
      }
      if (!editando) estado.pagina = 1;
      await carregar();
    } catch (erro) {
      mostrarErros(formUsuario, erro.errors, erro.message);
    } finally {
      salvando = false;
    }
  });
  $("novo").addEventListener("click", () => abrirFormulario(null));
  $("cancelarUsuario").addEventListener("click", () => dialogoUsuario.close());
  var excluindo = null;
  function pedirExclusao(usuario) {
    excluindo = usuario;
    const nome = document.createElement("strong");
    nome.textContent = usuario.nome;
    $("textoExcluir").replaceChildren(
      "Excluir ",
      nome,
      "? Esta a\xE7\xE3o n\xE3o pode ser desfeita. As mensagens dessa conta continuam no chat, sem identifica\xE7\xE3o do autor."
    );
    dialogoExcluir.showModal();
  }
  $("confirmarExcluir").addEventListener("click", async () => {
    if (!excluindo) return;
    const botao = $("confirmarExcluir");
    try {
      await aguardar(botao, api(`/usuarios/${excluindo.id}`, { metodo: "DELETE" }));
      toast("Usu\xE1rio exclu\xEDdo.");
    } catch (erro) {
      toast(erro.message, "erro");
    } finally {
      dialogoExcluir.close();
      excluindo = null;
      carregar();
    }
  });
  $("cancelarExcluir").addEventListener("click", () => dialogoExcluir.close());
  for (const dialogo of [dialogoUsuario, dialogoExcluir]) {
    dialogo.addEventListener("click", (evento) => {
      if (evento.target === dialogo) dialogo.close();
    });
  }
  corpo.addEventListener("click", (evento) => {
    const botao = evento.target.closest("button[data-acao]");
    if (!botao || botao.disabled) return;
    const usuario = usuariosDaPagina.get(Number(botao.dataset.id));
    if (!usuario) return;
    if (botao.dataset.acao === "editar") abrirFormulario(usuario);
    else pedirExclusao(usuario);
  });
  async function iniciar() {
    try {
      eu = await iniciarShell();
    } catch (e) {
      return;
    }
    if (eu.papel !== "admin") return location.assign("/chat");
    for (const chave of FILTROS) entradas[chave].value = estado[chave];
    seletorLimite.value = String(estado.limite);
    mostrarEstadoNaTabela("Carregando\u2026");
    await carregar();
  }
  iniciar();
})();
