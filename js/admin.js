// =========================================================
// PAINEL DA MARI (admin)
// Abas: Portfólio, Marcas, Calendário, Campanhas e Checklist.
// Tudo lê e grava no Supabase (tabelas criadas pelo banco.sql).
// Se faltar uma tabela ou um campo, o painel avisa e continua funcionando.
// =========================================================
(async function () {
  "use strict";

  // Espera a conferência de sessão feita no começo da página
  const sessao = await window.sessaoPronta;
  if (!sessao) return;
  document.documentElement.classList.remove("conferindo");
  const banco = window.banco;
  const BIB = window.Biblioteca || null;

  // Visitas feitas por você no portfólio, neste navegador, não entram nas métricas.
  // Dá para ligar a contagem na aba Portfólio (útil para testar).
  const CHAVE_CONTAR = "mb_contar_minhas_visitas";
  const contarMinhas = () => { try { return localStorage.getItem(CHAVE_CONTAR) === "1"; } catch (e) { return false; } };
  function aplicarContagem() {
    try {
      if (contarMinhas()) localStorage.removeItem("mb_nao_contar_visita");
      else localStorage.setItem("mb_nao_contar_visita", "1");
    } catch (e) {}
  }
  aplicarContagem();
  let atualizadoEm = null;

  // ---------------------------------------------------------
  // AJUDANTES
  // ---------------------------------------------------------
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const numero = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const moeda = (v) => numero(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const chaveDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const paraData = (iso) => { if (!iso) return null; const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number); return a ? new Date(a, m - 1, d) : null; };
  const hoje = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const hojeChave = () => chaveDia(new Date());
  const fmtData = (iso) => { const d = paraData(iso); return d ? d.toLocaleDateString("pt-BR") : ""; };
  const diasAte = (iso) => { const d = paraData(iso); return d ? Math.round((d - hoje()) / 86400000) : null; };
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const idYoutube = (link) => { const m = String(link || "").match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/); return m ? m[1] : null; };
  const soDigitos = (t) => String(t || "").replace(/\D/g, "");
  const linkWhats = (tel) => { let d = soDigitos(tel); if (!d) return ""; if (d.length <= 11) d = "55" + d; return `https://wa.me/${d}`; };
  const arroba = (ig) => String(ig || "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?].*$/, "").replace(/^@/, "");

  const ICONE = {
    mais: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    baixar: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 19h14"/></svg>',
    editar: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
    apagar: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/></svg>',
    olho: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    olhoFechado: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.2A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.2 6.6C3.6 8.3 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    alca: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r=".9"/><circle cx="15" cy="6" r=".9"/><circle cx="9" cy="12" r=".9"/><circle cx="15" cy="12" r=".9"/><circle cx="9" cy="18" r=".9"/><circle cx="15" cy="18" r=".9"/></svg>',
    estrela: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/></svg>',
    esquerda: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    direita: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    whats: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l4.8-1.3A9.5 9.5 0 1 0 12 2.5zm5.5 13.4c-.2.6-1.3 1.2-1.8 1.3-.5 0-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.2.5.1.6 0l.9-1c.2-.3.4-.2.6-.1l2 1c.3.1.4.2.5.3.1.2.1.7-.1 1.3z"/></svg>'
  };

  // Mensagem rápida no rodapé da tela
  let tempoToast = null;
  function avisar(texto, erro) {
    const t = $("#toast");
    t.textContent = texto;
    t.classList.toggle("erro", Boolean(erro));
    t.classList.add("visivel");
    clearTimeout(tempoToast);
    tempoToast = setTimeout(() => t.classList.remove("visivel"), erro ? 5200 : 2600);
  }

  // ---------------------------------------------------------
  // DADOS (com proteção: se faltar tabela ou campo, avisa e segue)
  // ---------------------------------------------------------
  const dados = { videos: [], marcas: [], calendario: [], campanhas: [], marcados: [], visitas: [], roteiros: [] };
  const faltando = {};

  function traduzErro(err, tabela) {
    const cod = String((err && err.code) || "");
    const msg = String((err && (err.message || err.details)) || "");
    const achou = (msg.match(/column "?([\w.]+)"?/i) || msg.match(/the '([\w]+)' column/i) || [])[1];
    const coluna = achou ? achou.split(".").pop() : "";
    if (cod === "42P01" || cod === "PGRST205" || /does not exist|could not find the table/i.test(msg) && !coluna)
      return `A tabela "${tabela}" não existe no banco ainda. Rode o arquivo banco.sql no Supabase (SQL Editor).`;
    if (cod === "42703" || cod === "PGRST204" || coluna)
      return `Falta o campo "${coluna || "?"}" na tabela "${tabela}". Rode o arquivo banco.sql de novo no Supabase.`;
    if (cod === "42501" || /permission|row-level security/i.test(msg))
      return `O banco não deixou mexer em "${tabela}". Confira se as regras do banco.sql foram aplicadas e se você entrou com o seu e-mail.`;
    if (cod === "23514") return `Um dos valores não é aceito pela tabela "${tabela}". Confira as opções escolhidas.`;
    if (/fetch|network|failed/i.test(msg)) return "Sem conexão com o banco. Confira sua internet e tente de novo.";
    return `Não foi possível usar a tabela "${tabela}" (${msg || "erro desconhecido"}).`;
  }

  function mostrarAvisos() {
    const lista = Object.values(faltando);
    $("#avisos").innerHTML = lista.map((t) => `<p class="faixa faixa-aviso">${esc(t)}</p>`).join("");
  }

  async function carregar(tabela, ajuste) {
    try {
      let q = banco.from(tabela).select("*");
      if (ajuste) q = ajuste(q);
      const { data, error } = await q;
      if (error) throw error;
      dados[tabela] = Array.isArray(data) ? data : [];
      delete faltando[tabela];
    } catch (err) {
      dados[tabela] = [];
      faltando[tabela] = traduzErro(err, tabela);
    }
    mostrarAvisos();
  }

  // Visitas podem passar de mil: busca em páginas
  async function carregarVisitas() {
    const inicio = hoje(); inicio.setDate(inicio.getDate() - 13);
    const todas = [];
    try {
      for (let pag = 0; pag < 50; pag++) {
        const { data, error } = await banco.from("visitas").select("*").gte("data", inicio.toISOString())
          .order("data", { ascending: true }).range(pag * 1000, pag * 1000 + 999);
        if (error) throw error;
        todas.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      dados.visitas = todas;
      delete faltando.visitas;
    } catch (err) {
      dados.visitas = [];
      faltando.visitas = traduzErro(err, "visitas");
    }
    mostrarAvisos();
  }

  async function gravar(tabela, linha, id) {
    try {
      const q = id != null ? banco.from(tabela).update(linha).eq("id", id) : banco.from(tabela).insert(linha);
      const { error } = await q;
      if (error) throw error;
      return true;
    } catch (err) {
      avisar(traduzErro(err, tabela), true);
      return false;
    }
  }
  async function apagar(tabela, id) {
    try {
      const { error } = await banco.from(tabela).delete().eq("id", id);
      if (error) throw error;
      return true;
    } catch (err) {
      avisar(traduzErro(err, tabela), true);
      return false;
    }
  }

  // ---------------------------------------------------------
  // JANELA (formulários e confirmações)
  // ---------------------------------------------------------
  const janela = $("#janela");
  $("#janela-fechar").addEventListener("click", () => janela.close());
  janela.addEventListener("click", (e) => { if (e.target === janela) janela.close(); });
  // ao fechar, tira vídeos que estavam tocando dentro da janela
  janela.addEventListener("close", () => $$("#janela-corpo iframe").forEach((f) => f.remove()));
  function abrirJanela({ titulo, corpo, botoes = [], larga = false, extraLarga = false, sobretitulo = "", aoAbrir }) {
    $("#janela-titulo").textContent = titulo;
    $("#janela-corpo").innerHTML = corpo;
    const rodape = $("#janela-rodape");
    rodape.innerHTML = "";
    rodape.hidden = botoes.length === 0;
    botoes.forEach((b) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "btn " + (b.classe || "");
      el.innerHTML = b.texto;
      el.addEventListener("click", async () => {
        if (!b.acao) { janela.close(); return; }
        el.disabled = true;
        const fechar = await b.acao();
        el.disabled = false;
        if (fechar !== false) janela.close();
      });
      rodape.appendChild(el);
    });
    janela.classList.toggle("larga", larga);
    janela.classList.toggle("extra-larga", extraLarga);
    $("#janela-sobretitulo").textContent = sobretitulo;
    $("#janela-sobretitulo").hidden = !sobretitulo;
    if (!janela.open) janela.showModal();
    if (aoAbrir) aoAbrir($("#janela-corpo"));
    const primeiro = $("#janela-corpo input:not([type=checkbox]), #janela-corpo select, #janela-corpo textarea");
    if (primeiro) setTimeout(() => primeiro.focus(), 30);
  }
  function confirmar(texto, rotulo = "Apagar", classe = "btn-perigo") {
    return new Promise((ok) => {
      let resposta = false;
      abrirJanela({
        titulo: "Confirmar",
        corpo: `<p style="margin:0">${esc(texto)}</p>`,
        botoes: [{ texto: "Cancelar" }, { texto: rotulo, classe, acao: () => { resposta = true; } }]
      });
      janela.addEventListener("close", () => ok(resposta), { once: true });
    });
  }
  // Monta um campo de formulário
  function campo({ nome, rotulo, tipo = "text", valor = "", opcoes, lista, obrigatorio, passo, dica }) {
    const req = obrigatorio ? " required" : "";
    const id = "f-" + nome;
    let entrada;
    if (tipo === "select") {
      entrada = `<select id="${id}" name="${nome}">${opcoes.map((o) => { const v = typeof o === "object" ? o.v : o; const t = typeof o === "object" ? o.t : o; return `<option value="${esc(v)}"${String(v) === String(valor) ? " selected" : ""}>${esc(t)}</option>`; }).join("")}</select>`;
    } else if (tipo === "textarea") {
      entrada = `<textarea id="${id}" name="${nome}">${esc(valor)}</textarea>`;
    } else {
      const dl = lista ? ` list="${id}-lista"` : "";
      entrada = `<input id="${id}" name="${nome}" type="${tipo}" value="${esc(valor)}"${req}${dl}${passo ? ` step="${passo}"` : ""}>` +
        (lista ? `<datalist id="${id}-lista">${lista.map((o) => `<option value="${esc(o)}">`).join("")}</datalist>` : "");
    }
    return `<div class="campo"><label for="${id}">${esc(rotulo)}${obrigatorio ? " *" : ""}</label>${entrada}${dica ? `<small style="color:var(--suave);font-size:11px">${esc(dica)}</small>` : ""}</div>`;
  }
  const marcaCheck = (nome, rotulo, ligado) => `<label class="check-linha"><input type="checkbox" name="${nome}"${ligado ? " checked" : ""}> ${esc(rotulo)}</label>`;
  function lerFormulario() {
    const f = {};
    $$("#janela-corpo [name]").forEach((el) => { f[el.name] = el.type === "checkbox" ? el.checked : el.value.trim(); });
    return f;
  }
  const nulo = (v) => (v === "" || v == null ? null : v);

  // Baixar CSV que abre certinho no Excel (com acento)
  function baixarCSV(nomeArquivo, cabecalho, linhas) {
    const celula = (v) => { const t = String(v == null ? "" : v).replace(/\r?\n/g, " "); return /[;"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const texto = "﻿" + [cabecalho, ...linhas].map((l) => l.map(celula).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = nomeArquivo;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // Desenha uma aba sem deixar um erro derrubar o painel inteiro
  function desenhar(id, fn) {
    try { fn(); }
    catch (err) {
      console.error(err);
      $("#aba-" + id).innerHTML = `<p class="faixa faixa-erro">Algo deu errado ao montar esta aba. As outras continuam funcionando. Detalhe: ${esc(err.message)}</p>`;
    }
  }

  // ---------------------------------------------------------
  // MENU E ABAS
  // ---------------------------------------------------------
  const TITULOS = { portfolio: "Portfólio", marcas: "Marcas", calendario: "Planner", campanhas: "UGC's & Publis", roteiros: "Roteiros", checklist: "Checklist portfólio", dashboard: "Dashboard",
    prospeccao: "Prospecção", followups: "Follow-ups", candidaturas: "Candidaturas", trafego: "Tráfego Pago", quadro: "Quadro de roteiros",
    financeiro: "Financeiro CNPJ: geral", financeirocpf: "Financeiro CPF", tiktokshop: "TikTok Shop", config: "Configurações" };
  // Abas do painel que são páginas do aplicativo Gestão UGC (aba do painel: página do aplicativo)
  const PAGINAS_APP = { dashboard: "dashboard", calendario: "planner", campanhas: "jobs", prospeccao: "prospeccao", followups: "followups",
    candidaturas: "candidaturas", trafego: "trafego", quadro: "roteiros", financeiro: "financeiro", 
    tiktokshop: "tiktokshop", config: "config", financeirocpf: "financeirocpf" };
  let abaAtual = "portfolio";
  function mostrarAba(nome) {
    if (nome === "gestao") nome = "dashboard"; // a antiga aba Gestão UGC virou várias abas
    if (nome === "performance") nome = "financeiro"; // Performance agora fica dentro de Financeiro CNPJ: geral
    if (!TITULOS[nome]) nome = "portfolio";
    abaAtual = nome;
    // Planner (antigo Calendário) e UGC's & Publis (antiga Campanhas) são páginas do aplicativo Gestão UGC
    const paginaApp = PAGINAS_APP[nome] || "";
    const secao = paginaApp ? "gestao" : nome;
    $$(".aba").forEach((s) => { s.hidden = s.id !== "aba-" + secao; });
    $$(".menu-item").forEach((b) => { b.classList.toggle("ativo", b.dataset.aba === nome); b.setAttribute("aria-current", b.dataset.aba === nome ? "page" : "false"); });
    const botao = $(`.menu-item[data-aba="${nome}"]`);
    if (botao) abrirSecao(botao.closest(".menu-secao"), true);
    abrirGrupo(botao && botao.dataset.pai ? botao.dataset.pai : (botao && botao.classList.contains("tem-sub") ? nome : ""));
    $("#titulo-aba").textContent = TITULOS[nome];
    document.title = TITULOS[nome] + " | Painel Mari Bonetto";
    if (location.hash !== "#" + nome) history.replaceState(null, "", "#" + nome);
    $("#painel").classList.remove("menu-aberto");
    if (secao === "gestao") abrirGestao(paginaApp, nome === "config");
    $("#btn-olho").hidden = secao !== "gestao";
  }
  // Aplicativo de gestão UGC: abre dentro do painel, com o mesmo login e o mesmo banco
  // Uma cópia só do aplicativo serve as duas abas (Gestão UGC e Planner), assim uma nunca
  // apaga o que a outra salvou. Trocar de aba só troca a página dentro dele.
  function abrirGestao(pagina, comBarra) {
    const sec = $("#aba-gestao");
    sec.classList.toggle("so-planner", !comBarra);
    const quadro = sec.querySelector("iframe");
    if (quadro) {
      quadro.contentWindow.postMessage({ pagina, so: true }, location.origin);
      return;
    }
    const extra = `&pagina=${pagina}&so=1`;
    sec.innerHTML = `<div class="gestao-barra"><span>Tudo do seu aplicativo fica salvo no Supabase, com cópias de segurança automáticas.</span><span class="gestao-acoes"><button class="btn" type="button" id="gestao-copias">Cópias de segurança</button></span></div>
      <iframe class="gestao-app" src="gestao/?v=${encodeURIComponent(window.VERSAO_PAINEL || "")}${extra}" title="Gestão UGC"></iframe>`;
    $("#gestao-copias").addEventListener("click", abrirCopias);
  }
  // Cópias de segurança do aplicativo: o banco guarda uma cópia sozinho (a cada 30 min de uso
  // e sempre antes de uma mudança grande). Aqui dá para ver, baixar e voltar para uma delas.
  async function abrirCopias() {
    const uid = sessao.user.id;
    const [{ data: copias, error }, { data: atual }] = await Promise.all([
      banco.from("app_state_copias").select("id, motivo, criado_em").eq("user_id", uid).order("criado_em", { ascending: false }).limit(200),
      banco.from("app_state").select("updated_at").eq("user_id", uid).maybeSingle()
    ]);
    if (error) { avisar("Não consegui abrir as cópias: " + error.message, true); return; }
    const quando = (d) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const linhas = (copias || []).map((c) => `<li class="copia-linha"><span><b>${esc(quando(c.criado_em))}</b><small>${esc(c.motivo)}</small></span>
        <span class="gestao-acoes"><button class="btn" type="button" data-baixar="${c.id}">Baixar</button><button class="btn" type="button" data-voltar="${c.id}">Voltar para esta</button></span></li>`).join("");
    abrirJanela({
      titulo: "Cópias de segurança",
      sobretitulo: "Gestão UGC",
      corpo: `<p class="copia-intro">O banco guarda uma cópia de tudo sozinho: a cada 30 minutos de uso e sempre antes de uma mudança grande (por exemplo, se muita coisa sumir de uma vez). ${atual ? "Última vez que o aplicativo salvou: <b>" + esc(quando(atual.updated_at)) + "</b>." : ""}</p>
        <p><button class="btn" type="button" id="copia-agora">Fazer uma cópia agora</button></p>
        ${linhas ? `<ul class="copia-lista">${linhas}</ul>` : '<p class="vazio">Ainda não tem nenhuma cópia. A primeira aparece depois que você usar o aplicativo.</p>'}`,
      botoes: [{ texto: "Fechar" }],
      larga: true,
      aoAbrir: (corpo) => {
        corpo.querySelector("#copia-agora").addEventListener("click", async () => {
          const { data: a } = await banco.from("app_state").select("data").eq("user_id", uid).maybeSingle();
          if (!a) { avisar("Ainda não tem nada salvo no aplicativo.", true); return; }
          const { error: e } = await banco.from("app_state_copias").insert({ user_id: uid, data: a.data, motivo: "feita por você" });
          if (e) { avisar("Não consegui fazer a cópia: " + e.message, true); return; }
          avisar("Cópia feita!"); abrirCopias();
        });
        corpo.querySelectorAll("[data-baixar]").forEach((b) => b.addEventListener("click", async () => {
          const { data: c, error: e } = await banco.from("app_state_copias").select("data, criado_em").eq("id", b.dataset.baixar).single();
          if (e) { avisar("Não consegui baixar: " + e.message, true); return; }
          const url = URL.createObjectURL(new Blob([JSON.stringify(c.data, null, 2)], { type: "application/json" }));
          const a = document.createElement("a");
          a.href = url; a.download = "gestao-ugc-copia-" + c.criado_em.slice(0, 16).replace(/[T:]/g, "-") + ".json";
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        }));
        corpo.querySelectorAll("[data-voltar]").forEach((b) => b.addEventListener("click", async () => {
          if (!(await confirmar("Voltar o aplicativo para esta cópia? O que está lá agora também fica guardado como cópia, então dá para desfazer.", "Voltar para esta cópia", "btn-principal"))) { abrirCopias(); return; }
          const { data: c, error: e } = await banco.from("app_state_copias").select("data").eq("id", b.dataset.voltar).single();
          if (e) { avisar("Não consegui ler a cópia: " + e.message, true); return; }
          const { data: a } = await banco.from("app_state").select("data").eq("user_id", uid).maybeSingle();
          if (a) await banco.from("app_state_copias").insert({ user_id: uid, data: a.data, motivo: "antes de voltar uma cópia" });
          const { error: e2 } = await banco.from("app_state").upsert({ user_id: uid, data: c.data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
          if (e2) { avisar("Não consegui voltar a cópia: " + e2.message, true); return; }
          const quadro = $("#aba-gestao iframe");
          if (quadro) quadro.src = quadro.src;
          janela.close();
          avisar("Pronto! O aplicativo voltou para a cópia escolhida.");
        }));
      }
    });
  }
  // Olho dos valores: esconde e mostra os valores em reais do aplicativo (fica lembrado neste navegador)
  function lerOcultar() { try { return localStorage.getItem("ocultarValores") === "1"; } catch (e) { return false; } }
  let ocultoAgora = lerOcultar();
  function pintarOlho() {
    const oculto = ocultoAgora;
    const b = $("#btn-olho");
    b.classList.toggle("oculto", oculto);
    b.setAttribute("aria-pressed", oculto ? "true" : "false");
    $("#olho-texto").textContent = oculto ? "Mostrar valores" : "Ocultar valores";
  }
  $("#btn-olho").addEventListener("click", () => {
    const oculto = ocultoAgora = !ocultoAgora;
    try { localStorage.setItem("ocultarValores", oculto ? "1" : "0"); } catch (e) { /* segue só nesta tela */ }
    pintarOlho();
    const quadro = $("#aba-gestao iframe");
    if (quadro) quadro.contentWindow.postMessage({ ocultarValores: oculto }, location.origin);
  });
  pintarOlho();

  // Títulos do menu (meu site, minha rotina...) abrem e fecham; fica lembrado neste navegador.
  // A seção da página aberta sempre fica aberta.
  let secoesAbertas = {};
  try { secoesAbertas = JSON.parse(localStorage.getItem("menuSecoes") || "{}"); } catch (e) { secoesAbertas = {}; }
  function abrirSecao(secao, aberta) {
    if (!secao) return;
    secao.classList.toggle("fechada", !aberta);
    secao.querySelector(".menu-grupo").setAttribute("aria-expanded", aberta ? "true" : "false");
    secoesAbertas[secao.dataset.secao] = aberta;
    try { localStorage.setItem("menuSecoes", JSON.stringify(secoesAbertas)); } catch (e) { /* segue sem lembrar */ }
  }
  $$(".menu-secao").forEach((secao) => {
    if (secoesAbertas[secao.dataset.secao] !== true) abrirSecao(secao, false); // começa fechada até você abrir
    secao.querySelector(".menu-grupo").addEventListener("click", () => abrirSecao(secao, secao.classList.contains("fechada")));
  });

  // Grupos do menu (Marcas, Roteiros): as páginas ligadas a eles só aparecem quando o grupo está aberto
  let grupoAberto = "";
  function abrirGrupo(pai) {
    grupoAberto = pai;
    $$(".menu-item.sub").forEach((b) => { b.hidden = b.dataset.pai !== pai; });
    $$(".menu-item.tem-sub").forEach((b) => { const aberto = b.dataset.aba === pai; b.classList.toggle("aberto", aberto); b.setAttribute("aria-expanded", aberto ? "true" : "false"); });
  }
  $$(".menu-item").forEach((b) => b.addEventListener("click", () => {
    // clicar de novo no grupo que já está aberto fecha a lista
    if (b.classList.contains("tem-sub") && abaAtual === b.dataset.aba && grupoAberto === b.dataset.aba) { abrirGrupo(""); return; }
    mostrarAba(b.dataset.aba);
  }));
  // o aplicativo pede para trocar de aba quando você clica num atalho dele (ex.: do Dashboard para UGC's & Publis)
  window.addEventListener("message", (e) => {
    // o olho de dentro do aplicativo (Dashboard) avisa o painel para o botão do topo ficar igual
    if (e.origin === location.origin && e.data && "ocultarValores" in e.data && !e.data.aba) { ocultoAgora = Boolean(e.data.ocultarValores); pintarOlho(); return; }
    if (e.origin !== location.origin || !e.data || !e.data.aba || !TITULOS[e.data.aba]) return;
    mostrarAba(e.data.aba);
  });
  window.addEventListener("hashchange", () => { const h = location.hash.replace("#", ""); if (h && h !== abaAtual) mostrarAba(h); });
  $("#btn-menu").addEventListener("click", () => $("#painel").classList.add("menu-aberto"));
  $("#menu-fundo").addEventListener("click", () => $("#painel").classList.remove("menu-aberto"));
  $("#menu-email").textContent = sessao.user.email;
  $("#btn-sair").addEventListener("click", async () => { await banco.auth.signOut(); location.replace("../login/"); });
  banco.auth.onAuthStateChange((evento, s) => { if (evento === "SIGNED_OUT" || !s) location.replace("../login/"); });

  const exemploTag = (l) => (l && l.exemplo ? '<span class="etiqueta e-exemplo">exemplo</span>' : "");

  // =========================================================
  // 1. PORTFÓLIO
  // =========================================================
  const NICHOS_SITE = ["Beleza", "Skincare", "Moda", "Casa e decoração", "Fitness", "Maternidade", "Tech"];
  const FORMATOS = ["Unboxing", "Demonstração", "Depoimento", "Antes e depois", "Problema e solução", "Rotina", "Comparativo", "Lista de dicas", "Anúncio", "Narração"];

  function maisFrequente(lista) {
    const conta = {};
    lista.forEach((v) => { const k = String(v || "").trim(); if (k) conta[k] = (conta[k] || 0) + 1; });
    const ordem = Object.entries(conta).sort((a, b) => b[1] - a[1]);
    return ordem;
  }

  function desenharPortfolio() {
    const sec = $("#aba-portfolio");
    const visitas = dados.visitas;
    const total = visitas.length;
    const hc = hojeChave();
    const deHoje = visitas.filter((v) => chaveDia(new Date(v.data)) === hc).length;
    const noAr = dados.videos.filter((v) => v.visivel && !v.exemplo);
    const nichos = maisFrequente(noAr.map((v) => v.nicho));
    const origens = maisFrequente(visitas.map((v) => v.origem || "Direto"));

    // últimos 14 dias
    const dias = [];
    for (let i = 13; i >= 0; i--) { const d = hoje(); d.setDate(d.getDate() - i); dias.push({ chave: chaveDia(d), data: d, n: 0 }); }
    const porDia = Object.fromEntries(dias.map((d) => [d.chave, d]));
    visitas.forEach((v) => { const k = chaveDia(new Date(v.data)); if (porDia[k]) porDia[k].n++; });
    const maior = Math.max(0, ...dias.map((d) => d.n));

    const topoOrigem = origens.length ? origens[0][0] : "";
    const hora = atualizadoEm ? atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
    sec.innerHTML = `
      <div class="ferramentas" style="margin-bottom:10px">
        <span style="font-size:11.5px;color:var(--suave)">${hora ? `Atualizado às ${hora}. Os números se atualizam sozinhos a cada minuto.` : "Carregando os números..."}</span>
        <div class="direita">
          <label class="check-linha" style="margin:0;font-size:11.5px;color:var(--suave)" title="Desligado: quando você abre o seu portfólio neste navegador, a visita não entra na conta.">
            <input type="checkbox" id="contar-minhas"${contarMinhas() ? " checked" : ""}> Contar minhas visitas neste navegador</label>
          <button class="btn" type="button" id="btn-atualizar">Atualizar</button>
        </div>
      </div>
      <div class="numeros">
        <div class="numero"><small>Visitas em 14 dias</small><strong>${total}</strong></div>
        <div class="numero"><small>Visitas hoje</small><strong>${deHoje}</strong></div>
        <div class="numero"><small>Vídeos no ar</small><strong>${noAr.length}</strong></div>
        <div class="numero"><small>Nicho mais forte</small><strong>${nichos.length ? esc(nichos[0][0]) : "-"}</strong><em>${nichos.length ? plural(nichos[0][1], "vídeo", "vídeos") : "preencha o nicho dos vídeos"}</em></div>
        <div class="numero"><small>De onde mais vêm</small><strong>${topoOrigem ? esc(topoOrigem) : "-"}</strong><em>${topoOrigem ? Math.round((origens[0][1] / total) * 100) + "% das visitas" : "ainda sem visitas"}</em></div>
      </div>
      <div class="duas-colunas">
        <div class="bloco">
          <div class="bloco-titulo"><h2>Visitas nos últimos 14 dias</h2></div>
          ${total === 0
            ? `<p class="vazio">Quando as pessoas começarem a visitar o seu portfólio, aqui vai aparecer uma barrinha por dia mostrando quantas visitas chegaram em cada um dos últimos 14 dias.</p>`
            : `<div class="grafico" role="img" aria-label="Visitas por dia nos últimos 14 dias">${dias.map((d) => `
                <div class="coluna${d.chave === hc ? " hoje" : ""}" title="${d.data.toLocaleDateString("pt-BR")}: ${plural(d.n, "visita", "visitas")}">
                  <span class="valor">${d.n || ""}</span>
                  <span class="barra" style="height:${maior > 0 ? (d.n / maior) * 100 : 0}%"></span>
                  <span class="dia">${d.data.getDate()}</span>
                </div>`).join("")}</div>`}
        </div>
        <div class="bloco">
          <div class="bloco-titulo"><h2>Por onde as pessoas chegaram</h2></div>
          ${origens.length === 0
            ? `<p class="vazio">Aqui vai aparecer de onde vieram as visitas (Instagram, Google, WhatsApp, link direto) assim que chegarem as primeiras.</p>`
            : `<ul class="origens">${origens.map(([nome, n]) => `<li><span>${esc(nome)}</span><b>${n}</b><span class="trilho"><i style="width:${Math.round((n / total) * 100)}%"></i></span></li>`).join("")}</ul>`}
        </div>
      </div>
      <div class="bloco">
        <div class="bloco-titulo"><h2>Meus vídeos</h2>
          <button class="btn btn-principal" type="button" id="video-novo">${ICONE.mais}Adicionar vídeo</button></div>
        ${faltando.videos ? `<p class="vazio">${esc(faltando.videos)}</p>` : dados.videos.length === 0 ? `<p class="vazio">Nenhum vídeo ainda. Clique em "Adicionar vídeo".</p>` : `
        <div class="tabela-caixa"><table class="tabela" id="tabela-videos">
          <thead><tr><th style="width:34px"><span class="sr-only">Ordem</span></th><th>Título</th><th>Marca</th><th>Nicho</th><th>Formato</th><th>Destaque</th><th class="acoes">Ações</th></tr></thead>
          <tbody>${dados.videos.map((v) => `
            <tr data-id="${v.id}" class="${v.visivel ? "" : "escondido"}">
              <td><button class="alca" type="button" aria-label="Arrastar para mudar a ordem (ou use as setas do teclado)">${ICONE.alca}</button></td>
              <td class="titulo-video curto">${esc(v.titulo)}${exemploTag(v)}${idYoutube(v.link) ? "" : '<span class="etiqueta e-amarela">sem link do YouTube</span>'}</td>
              <td>${esc(v.marca)}</td><td>${esc(v.nicho)}</td><td>${esc(v.formato)}</td><td>${esc(v.destaque)}</td>
              <td class="acoes">
                <button class="icone-btn" type="button" data-acao="olho" title="${v.visivel ? "No site. Clique para esconder" : "Escondido. Clique para mostrar no site"}" aria-label="${v.visivel ? "Esconder do site" : "Mostrar no site"}">${v.visivel ? ICONE.olho : ICONE.olhoFechado}</button>
                <button class="icone-btn" type="button" data-acao="editar" aria-label="Editar">${ICONE.editar}</button>
                <button class="icone-btn" type="button" data-acao="apagar" aria-label="Apagar">${ICONE.apagar}</button>
              </td>
            </tr>`).join("")}</tbody>
        </table></div>
        <p style="font-size:11.5px;color:var(--suave);margin:8px 2px 0">Arraste pela alcinha para mudar a ordem em que os vídeos aparecem no site. O olhinho mostra ou esconde do site.</p>`}
      </div>`;

    $("#video-novo").addEventListener("click", () => formVideo());
    $("#btn-atualizar").addEventListener("click", () => atualizarPortfolio(true));
    $("#contar-minhas").addEventListener("change", (e) => {
      try { localStorage.setItem(CHAVE_CONTAR, e.target.checked ? "1" : "0"); } catch (er) {}
      aplicarContagem();
      avisar(e.target.checked ? "Pronto: suas visitas ao portfólio neste navegador vão contar." : "Suas visitas neste navegador não vão mais contar.");
    });
    const tabela = $("#tabela-videos");
    if (!tabela) return;
    tabela.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-acao]");
      if (!btn) return;
      const v = dados.videos.find((x) => String(x.id) === btn.closest("tr").dataset.id);
      if (!v) return;
      if (btn.dataset.acao === "editar") formVideo(v);
      if (btn.dataset.acao === "olho") {
        if (await gravar("videos", { visivel: !v.visivel }, v.id)) { avisar(v.visivel ? "Vídeo escondido do site" : "Vídeo de volta no site"); await recarregar("videos"); }
      }
      if (btn.dataset.acao === "apagar") {
        if (await confirmar(`Apagar o vídeo "${v.titulo}"? Ele sai do site também.`) && await apagar("videos", v.id)) { avisar("Vídeo apagado"); await recarregar("videos"); }
      }
    });
    ativarArrastar(tabela);
  }

  // Arrastar pela alcinha (funciona com mouse e com o dedo) e setas do teclado
  function ativarArrastar(tabela) {
    const corpo = tabela.tBodies[0];
    let linha = null, alvo = null, emCima = false;
    corpo.addEventListener("pointerdown", (e) => {
      const alca = e.target.closest(".alca");
      if (!alca) return;
      e.preventDefault();
      linha = alca.closest("tr");
      linha.classList.add("arrastando");
      alca.setPointerCapture(e.pointerId);
    });
    corpo.addEventListener("pointermove", (e) => {
      if (!linha) return;
      $$("tr", corpo).forEach((tr) => tr.classList.remove("alvo-cima", "alvo-baixo"));
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const tr = el && el.closest("#tabela-videos tbody tr");
      if (!tr || tr === linha) { alvo = null; return; }
      const r = tr.getBoundingClientRect();
      emCima = e.clientY < r.top + r.height / 2;
      tr.classList.add(emCima ? "alvo-cima" : "alvo-baixo");
      alvo = tr;
    });
    const soltar = async () => {
      if (!linha) return;
      $$("tr", corpo).forEach((tr) => tr.classList.remove("alvo-cima", "alvo-baixo", "arrastando"));
      if (alvo) {
        if (emCima) corpo.insertBefore(linha, alvo); else corpo.insertBefore(linha, alvo.nextSibling);
        await salvarOrdem($$("tr", corpo).map((tr) => tr.dataset.id));
      }
      linha = null; alvo = null;
    };
    corpo.addEventListener("pointerup", soltar);
    corpo.addEventListener("pointercancel", soltar);
    corpo.addEventListener("keydown", async (e) => {
      const alca = e.target.closest(".alca");
      if (!alca || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      e.preventDefault();
      const tr = alca.closest("tr");
      const vizinho = e.key === "ArrowUp" ? tr.previousElementSibling : tr.nextElementSibling;
      if (!vizinho) return;
      if (e.key === "ArrowUp") corpo.insertBefore(tr, vizinho); else corpo.insertBefore(vizinho, tr);
      const id = tr.dataset.id;
      await salvarOrdem($$("tr", corpo).map((x) => x.dataset.id));
      const nova = $(`#tabela-videos tr[data-id="${id}"] .alca`);
      if (nova) nova.focus();
    });
  }
  async function salvarOrdem(ids) {
    const mudancas = ids.map((id, i) => ({ id, ordem: i + 1 })).filter((m) => {
      const v = dados.videos.find((x) => String(x.id) === String(m.id));
      return v && v.ordem !== m.ordem;
    });
    if (!mudancas.length) return;
    const resultados = await Promise.all(mudancas.map((m) => gravar("videos", { ordem: m.ordem }, m.id)));
    if (resultados.every(Boolean)) avisar("Ordem salva. O site já mostra assim.");
    await recarregar("videos");
  }

  function formVideo(v) {
    const novo = !v;
    v = v || { visivel: true };
    abrirJanela({
      titulo: novo ? "Adicionar vídeo" : "Editar vídeo",
      corpo:
        campo({ nome: "titulo", rotulo: "Título", valor: v.titulo, obrigatorio: true }) +
        campo({ nome: "link", rotulo: "Link do YouTube", valor: v.link, obrigatorio: true, dica: "Pode ser link de Shorts ou de vídeo normal. É ele que toca no site." }) +
        `<div class="linha-campos">` +
        campo({ nome: "marca", rotulo: "Marca", valor: v.marca, lista: dados.marcas.map((m) => m.nome).filter(Boolean) }) +
        campo({ nome: "destaque", rotulo: "Destaque", valor: v.destaque, dica: 'Ex.: "+470k" ou "2,4M views"' }) +
        campo({ nome: "nicho", rotulo: "Nicho", valor: v.nicho, lista: NICHOS_SITE }) +
        campo({ nome: "formato", rotulo: "Formato", valor: v.formato, lista: FORMATOS }) +
        `</div>` +
        marcaCheck("visivel", "Mostrar no site", v.visivel !== false) +
        (v.exemplo ? marcaCheck("exemplo", "É linha de exemplo (não aparece no site)", true) : ""),
      botoes: [
        ...(novo ? [] : [{ texto: ICONE.apagar + "Apagar", classe: "btn-perigo", acao: async () => {
          if (await confirmar(`Apagar o vídeo "${v.titulo}"?`) && await apagar("videos", v.id)) { avisar("Vídeo apagado"); await recarregar("videos"); }
        } }]),
        { texto: "Cancelar" },
        { texto: "Salvar", classe: "btn-principal", acao: async () => {
          const f = lerFormulario();
          if (!f.titulo || !f.link) { avisar("Preencha o título e o link.", true); return false; }
          if (!idYoutube(f.link)) { avisar("Esse link não parece do YouTube. O site só toca vídeos do YouTube.", true); return false; }
          const linha = { titulo: f.titulo, link: f.link, marca: nulo(f.marca), destaque: nulo(f.destaque), nicho: nulo(f.nicho), formato: nulo(f.formato), visivel: f.visivel };
          if ("exemplo" in f) linha.exemplo = f.exemplo;
          if (novo) linha.ordem = Math.max(0, ...dados.videos.map((x) => numero(x.ordem))) + 1;
          if (!(await gravar("videos", linha, novo ? null : v.id))) return false;
          avisar(novo ? "Vídeo adicionado. Já está no site." : "Vídeo salvo. O site já mostra a mudança.");
          await recarregar("videos");
        } }
      ]
    });
  }

  // =========================================================
  // 2. MARCAS
  // =========================================================
  const SITUACOES = [{ v: "lead", t: "Lead" }, { v: "conversando", t: "Conversando" }, { v: "cliente", t: "Cliente" }, { v: "parada", t: "Parada" }];
  const nomeSituacao = (s) => (SITUACOES.find((x) => x.v === s) || { t: s || "" }).t;
  const estadoMarcas = { busca: "", situacao: "" };

  function marcasFiltradas() {
    const b = estadoMarcas.busca.toLowerCase().replace(/^@/, "");
    return dados.marcas.filter((m) => {
      if (estadoMarcas.situacao && m.situacao !== estadoMarcas.situacao) return false;
      if (!b) return true;
      return [m.nome, arroba(m.instagram), m.email].some((c) => String(c || "").toLowerCase().includes(b));
    });
  }

  function desenharMarcas() {
    const sec = $("#aba-marcas");
    if (!$("#marcas-ferramentas")) {
      sec.innerHTML = `
        <div class="ferramentas" id="marcas-ferramentas">
          <input class="entrada" type="search" id="marcas-busca" placeholder="Buscar por nome, @ ou e-mail" aria-label="Buscar marcas">
          <select class="entrada" id="marcas-situacao" aria-label="Filtrar por situação"><option value="">Todas as situações</option>${SITUACOES.map((s) => `<option value="${s.v}">${s.t}</option>`).join("")}</select>
          <div class="direita">
            <button class="btn" type="button" id="marcas-csv">${ICONE.baixar}Baixar CSV</button>
            <button class="btn btn-principal" type="button" id="marcas-nova">${ICONE.mais}Adicionar marca</button>
          </div>
        </div>
        <div id="marcas-lista"></div>`;
      $("#marcas-busca").addEventListener("input", (e) => { estadoMarcas.busca = e.target.value.trim(); desenharListaMarcas(); });
      $("#marcas-situacao").addEventListener("change", (e) => { estadoMarcas.situacao = e.target.value; desenharListaMarcas(); });
      $("#marcas-nova").addEventListener("click", () => formMarca());
      $("#marcas-csv").addEventListener("click", () => {
        const lista = marcasFiltradas();
        baixarCSV(`marcas-${hojeChave()}.csv`, ["Marca", "Instagram", "E-mail", "Telefone", "Situação", "Observação", "Último contato"],
          lista.map((m) => [m.nome, m.instagram, m.email, m.telefone, nomeSituacao(m.situacao), m.obs, fmtData(m.ultimo_contato)]));
      });
    }
    desenharListaMarcas();
  }

  function desenharListaMarcas() {
    const caixa = $("#marcas-lista");
    if (faltando.marcas) { caixa.innerHTML = `<p class="vazio">${esc(faltando.marcas)}</p>`; return; }
    const lista = marcasFiltradas();
    if (!lista.length) { caixa.innerHTML = `<p class="vazio">${dados.marcas.length ? "Nenhuma marca encontrada com essa busca." : "Sua base ainda está vazia. Clique em \"Adicionar marca\" ou espere os contatos do formulário do site."}</p>`; return; }
    caixa.innerHTML = `
      <div class="tabela-caixa"><table class="tabela">
        <thead><tr><th>Marca</th><th>Instagram</th><th>E-mail</th><th>Telefone</th><th>Situação</th><th>Observação</th><th>Último contato</th></tr></thead>
        <tbody>${lista.map((m) => {
          const ig = arroba(m.instagram);
          const wa = linkWhats(m.telefone);
          return `<tr class="clicavel" data-id="${m.id}">
            <td><b style="font-weight:500">${esc(m.nome)}</b>${exemploTag(m)}</td>
            <td>${ig ? `<a class="link-mini" href="https://instagram.com/${encodeURIComponent(ig)}" target="_blank" rel="noopener">@${esc(ig)}</a>` : ""}</td>
            <td>${m.email ? `<a class="link-mini" href="mailto:${esc(m.email)}">${esc(m.email)}</a>` : ""}</td>
            <td style="white-space:nowrap">${esc(m.telefone)}${wa ? `<a class="whats" href="${wa}" target="_blank" rel="noopener" title="Abrir no WhatsApp" aria-label="Abrir WhatsApp de ${esc(m.nome)}">${ICONE.whats}</a>` : ""}</td>
            <td><span class="pilula p-${esc(m.situacao)}">${esc(nomeSituacao(m.situacao))}</span></td>
            <td class="curto" title="${esc(m.obs)}">${esc(m.obs)}</td>
            <td style="white-space:nowrap">${fmtData(m.ultimo_contato)}</td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>
      <p style="font-size:11.5px;color:var(--suave);margin:8px 2px 0">${plural(lista.length, "marca", "marcas")}. Clique na linha para editar.</p>`;
    $("tbody", caixa).addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      const tr = e.target.closest("tr");
      const m = tr && dados.marcas.find((x) => String(x.id) === tr.dataset.id);
      if (m) formMarca(m);
    });
  }

  function formMarca(m) {
    const novo = !m;
    m = m || { situacao: "lead", ultimo_contato: hojeChave() };
    abrirJanela({
      titulo: novo ? "Adicionar marca" : "Editar marca",
      corpo:
        campo({ nome: "nome", rotulo: "Marca", valor: m.nome, obrigatorio: true }) +
        `<div class="linha-campos">` +
        campo({ nome: "instagram", rotulo: "Instagram", valor: m.instagram, dica: "Ex.: @marca" }) +
        campo({ nome: "email", rotulo: "E-mail", valor: m.email, tipo: "email" }) +
        campo({ nome: "telefone", rotulo: "Telefone / WhatsApp", valor: m.telefone, dica: "Com DDD. Ex.: 11999999999" }) +
        campo({ nome: "situacao", rotulo: "Situação", tipo: "select", valor: m.situacao, opcoes: SITUACOES }) +
        campo({ nome: "ultimo_contato", rotulo: "Último contato", tipo: "date", valor: m.ultimo_contato || "" }) +
        `</div>` +
        campo({ nome: "obs", rotulo: "Observação", tipo: "textarea", valor: m.obs }) +
        (m.exemplo ? marcaCheck("exemplo", "É linha de exemplo", true) : ""),
      botoes: [
        ...(novo ? [] : [{ texto: ICONE.apagar + "Apagar", classe: "btn-perigo", acao: async () => {
          if (await confirmar(`Apagar a marca "${m.nome}" da sua base?`) && await apagar("marcas", m.id)) { avisar("Marca apagada"); await recarregar("marcas"); }
        } }]),
        { texto: "Cancelar" },
        { texto: "Salvar", classe: "btn-principal", acao: async () => {
          const f = lerFormulario();
          if (!f.nome) { avisar("Preencha o nome da marca.", true); return false; }
          const linha = { nome: f.nome, instagram: nulo(f.instagram), email: nulo(f.email), telefone: nulo(f.telefone), situacao: f.situacao, ultimo_contato: nulo(f.ultimo_contato), obs: nulo(f.obs) };
          if ("exemplo" in f) linha.exemplo = f.exemplo;
          if (!(await gravar("marcas", linha, novo ? null : m.id))) return false;
          avisar(novo ? "Marca adicionada" : "Marca salva");
          await recarregar("marcas");
        } }
      ]
    });
  }

  // =========================================================
  // 3. CALENDÁRIO
  // =========================================================
  const TIPOS_CAL = ["gravar", "editar", "postar"];
  const NOME_TIPO = { gravar: "Gravar", editar: "Editar", postar: "Postar", prazo: "Prazo de campanha" };
  const estadoCal = { mes: (() => { const d = hoje(); d.setDate(1); return d; })(), tipo: "" };
  const SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

  function itensDoCalendario() {
    const itens = dados.calendario
      .filter((c) => !estadoCal.tipo || c.tipo === estadoCal.tipo)
      .map((c) => ({ dia: String(c.data || "").slice(0, 10), texto: c.titulo + (c.marca ? " · " + c.marca : ""), classe: "t-" + c.tipo, feito: c.status === "feito", origem: "cal", linha: c }));
    if (!estadoCal.tipo) {
      dados.campanhas.filter((c) => c.prazo).forEach((c) => {
        itens.push({ dia: String(c.prazo).slice(0, 10), texto: "Prazo: " + c.campanha + (c.cliente ? " · " + c.cliente : ""), classe: "t-prazo", feito: c.status === "Entregue", origem: "camp", linha: c });
      });
    }
    return itens;
  }

  function desenharCalendario() {
    const sec = $("#aba-calendario");
    const mes = estadoCal.mes;
    const primeiro = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const diasNoMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
    const recuo = (primeiro.getDay() + 6) % 7;
    const semanas = Math.ceil((recuo + diasNoMes) / 7);
    const inicio = new Date(primeiro); inicio.setDate(1 - recuo);
    const itens = itensDoCalendario();
    const porDia = {};
    itens.forEach((it) => { (porDia[it.dia] = porDia[it.dia] || []).push(it); });
    const hc = hojeChave();

    let celulas = "";
    for (let i = 0; i < semanas * 7; i++) {
      const d = new Date(inicio); d.setDate(inicio.getDate() + i);
      const k = chaveDia(d);
      const lista = porDia[k] || [];
      const fora = d.getMonth() !== mes.getMonth();
      celulas += `<div class="cal-dia${fora ? " fora" : ""}${k === hc ? " hoje" : ""}" data-dia="${k}">
        <span class="cal-num">${d.getDate()}</span>
        <button class="cal-mais-btn" type="button" data-novo="${k}" aria-label="Adicionar em ${d.toLocaleDateString("pt-BR")}">+</button>
        ${lista.slice(0, 3).map((it, j) => `<button type="button" class="cal-item ${it.classe}${it.feito ? " feito" : ""}" data-item="${k}|${j}" title="${esc(NOME_TIPO[it.classe.slice(2)] + ": " + it.texto)}">${esc(it.texto)}</button>`).join("")}
        ${lista.length > 3 ? `<button type="button" class="cal-ver-mais" data-ver="${k}">+${lista.length - 3} mais</button>` : ""}
      </div>`;
    }

    // Ficou pra trás
    const atrasados = [
      ...dados.calendario.filter((c) => c.status !== "feito" && c.data && diasAte(c.data) < 0).map((c) => ({ tipo: "cal", linha: c, dias: -diasAte(c.data), titulo: c.titulo, marca: c.marca, rotulo: NOME_TIPO[c.tipo] || c.tipo })),
      ...dados.campanhas.filter((c) => c.status !== "Entregue" && c.prazo && diasAte(c.prazo) < 0).map((c) => ({ tipo: "camp", linha: c, dias: -diasAte(c.prazo), titulo: "Prazo: " + c.campanha, marca: c.cliente, rotulo: "Campanha" }))
    ].sort((a, b) => b.dias - a.dias);

    const nomeMesBruto = mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const nomeMes = nomeMesBruto.charAt(0).toUpperCase() + nomeMesBruto.slice(1);
    sec.innerHTML = `
      <div class="cal-cabeca">
        <button class="icone-btn" type="button" id="cal-antes" aria-label="Mês anterior">${ICONE.esquerda}</button>
        <h2>${esc(nomeMes)}</h2>
        <button class="icone-btn" type="button" id="cal-depois" aria-label="Próximo mês">${ICONE.direita}</button>
        <button class="btn" type="button" id="cal-hoje">Este mês</button>
        <div class="chips" role="group" aria-label="Filtrar por tipo">
          ${[["", "Todos"], ...TIPOS_CAL.map((t) => [t, NOME_TIPO[t]])].map(([v, t]) => `<button type="button" class="chip${estadoCal.tipo === v ? " ativo" : ""}" data-tipo="${v}">${t}</button>`).join("")}
        </div>
        <div class="direita" style="margin-left:auto"><button class="btn btn-principal" type="button" id="cal-novo">${ICONE.mais}Adicionar</button></div>
      </div>
      <div class="cal-grade">${SEMANA.map((s) => `<div class="cal-semana">${s}</div>`).join("")}${celulas}</div>
      <div class="legenda"><span><i class="t-gravar"></i>Gravar</span><span><i class="t-editar"></i>Editar</span><span><i class="t-postar"></i>Postar</span><span><i class="t-prazo"></i>Prazo de campanha (vem da aba Campanhas)</span></div>
      <div class="bloco" style="margin-top:16px">
        <div class="bloco-titulo"><h2>Ficou pra trás</h2></div>
        ${atrasados.length === 0 ? `<p class="vazio">Nada atrasado. Tudo em dia.</p>` : `<ul class="lista-simples">${atrasados.map((a, i) => `
          <li><div class="cresce"><b style="font-weight:500">${esc(a.titulo)}</b>${exemploTag(a.linha)}<br><small>${esc(a.rotulo)}${a.marca ? " · " + esc(a.marca) : ""}</small></div>
          <span class="etiqueta e-vermelha">há ${plural(a.dias, "dia", "dias")}</span>
          ${a.tipo === "cal" ? `<button class="btn" type="button" data-feito="${i}">Marcar feito</button>` : `<button class="btn" type="button" data-camp="${i}">Abrir</button>`}</li>`).join("")}</ul>`}
      </div>`;

    $("#cal-antes").addEventListener("click", () => { estadoCal.mes = new Date(mes.getFullYear(), mes.getMonth() - 1, 1); desenharCalendario(); });
    $("#cal-depois").addEventListener("click", () => { estadoCal.mes = new Date(mes.getFullYear(), mes.getMonth() + 1, 1); desenharCalendario(); });
    $("#cal-hoje").addEventListener("click", () => { const d = hoje(); d.setDate(1); estadoCal.mes = d; desenharCalendario(); });
    $("#cal-novo").addEventListener("click", () => formCalendario(null, hc));
    $$(".chip", sec).forEach((c) => c.addEventListener("click", () => { estadoCal.tipo = c.dataset.tipo; desenharCalendario(); }));
    $(".cal-grade", sec).addEventListener("click", (e) => {
      const item = e.target.closest("[data-item]");
      if (item) { const [k, j] = item.dataset.item.split("|"); abrirItem(porDia[k][Number(j)]); return; }
      const ver = e.target.closest("[data-ver]");
      if (ver) { abrirDia(ver.dataset.ver, porDia[ver.dataset.ver] || []); return; }
      const novo = e.target.closest("[data-novo]");
      if (novo) { formCalendario(null, novo.dataset.novo); return; }
      const dia = e.target.closest(".cal-dia");
      if (dia) formCalendario(null, dia.dataset.dia);
    });
    $$("[data-feito]", sec).forEach((b) => b.addEventListener("click", async () => {
      const a = atrasados[Number(b.dataset.feito)];
      if (await gravar("calendario", { status: "feito" }, a.linha.id)) { avisar("Marcado como feito"); await recarregar("calendario"); }
    }));
    $$("[data-camp]", sec).forEach((b) => b.addEventListener("click", () => { mostrarAba("campanhas"); formCampanha(atrasados[Number(b.dataset.camp)].linha); }));
  }

  function abrirItem(it) {
    if (!it) return;
    if (it.origem === "camp") { mostrarAba("campanhas"); formCampanha(it.linha); return; }
    formCalendario(it.linha);
  }
  function abrirDia(k, lista) {
    abrirJanela({
      titulo: paraData(k).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }),
      corpo: `<ul class="lista-simples">${lista.map((it, i) => `<li><span class="pilula ${it.classe}">${esc(NOME_TIPO[it.classe.slice(2)])}</span><div class="cresce" style="${it.feito ? "text-decoration:line-through;color:var(--suave)" : ""}">${esc(it.texto)}</div><button class="btn" type="button" data-abrir="${i}">Abrir</button></li>`).join("")}</ul>`,
      botoes: [{ texto: "Fechar" }, { texto: ICONE.mais + "Adicionar neste dia", classe: "btn-principal", acao: () => { setTimeout(() => formCalendario(null, k), 0); } }],
      aoAbrir: (corpo) => $$("[data-abrir]", corpo).forEach((b) => b.addEventListener("click", () => { janela.close(); setTimeout(() => abrirItem(lista[Number(b.dataset.abrir)]), 0); }))
    });
  }

  function formCalendario(c, dia) {
    const novo = !c;
    c = c || { tipo: estadoCal.tipo || "gravar", data: dia || hojeChave(), status: "a fazer" };
    abrirJanela({
      titulo: novo ? "Adicionar ao calendário" : "Editar item do calendário",
      corpo:
        campo({ nome: "titulo", rotulo: "O que fazer", valor: c.titulo, obrigatorio: true }) +
        `<div class="linha-campos">` +
        campo({ nome: "marca", rotulo: "Marca", valor: c.marca, lista: dados.marcas.map((m) => m.nome).filter(Boolean) }) +
        campo({ nome: "data", rotulo: "Data", tipo: "date", valor: String(c.data || "").slice(0, 10) }) +
        campo({ nome: "tipo", rotulo: "Tipo", tipo: "select", valor: c.tipo, opcoes: TIPOS_CAL.map((t) => ({ v: t, t: NOME_TIPO[t] })) }) +
        campo({ nome: "status", rotulo: "Status", tipo: "select", valor: c.status, opcoes: [{ v: "a fazer", t: "A fazer" }, { v: "feito", t: "Feito" }] }) +
        `</div>` +
        (c.exemplo ? marcaCheck("exemplo", "É linha de exemplo", true) : ""),
      botoes: [
        ...(novo ? [] : [{ texto: ICONE.apagar + "Apagar", classe: "btn-perigo", acao: async () => {
          if (await confirmar(`Apagar "${c.titulo}" do calendário?`) && await apagar("calendario", c.id)) { avisar("Apagado"); await recarregar("calendario"); }
        } }]),
        { texto: "Cancelar" },
        { texto: "Salvar", classe: "btn-principal", acao: async () => {
          const f = lerFormulario();
          if (!f.titulo || !f.data) { avisar("Preencha o que fazer e a data.", true); return false; }
          const linha = { titulo: f.titulo, marca: nulo(f.marca), data: f.data, tipo: f.tipo, status: f.status };
          if ("exemplo" in f) linha.exemplo = f.exemplo;
          if (!(await gravar("calendario", linha, novo ? null : c.id))) return false;
          avisar(novo ? "Adicionado ao calendário" : "Salvo");
          await recarregar("calendario");
        } }
      ]
    });
  }

  // =========================================================
  // 4. CAMPANHAS
  // =========================================================
  const STATUS = ["Briefing", "Roteiro", "Aprovação Roteiro", "Gravação", "Edição", "Aprovado", "Entregue"];
  const estadoCamp = { filtro: "todas", busca: "", col: "prazo", dir: 1 };
  const COLUNAS = [
    { id: "favorita", rotulo: "", valor: (c) => (c.favorita ? 0 : 1) },
    { id: "campanha", rotulo: "Campanha", valor: (c) => String(c.campanha || "").toLowerCase() },
    { id: "cliente", rotulo: "Cliente", valor: (c) => String(c.cliente || "").toLowerCase() },
    { id: "tipo", rotulo: "Tipo", valor: (c) => String(c.tipo || "").toLowerCase() },
    { id: "status", rotulo: "Status", valor: (c) => { const i = STATUS.indexOf(c.status); return i < 0 ? 99 : i; } },
    { id: "qtd", rotulo: "Qtd", valor: (c) => numero(c.qtd), num: true },
    { id: "valor", rotulo: "Valor", valor: (c) => numero(c.valor), num: true },
    { id: "prazo", rotulo: "Prazo", valor: (c) => c.prazo || null },
    { id: "pagamento", rotulo: "Pagamento", valor: (c) => (c.pagamento === "pago" ? 1 : 0) }
  ];

  function campanhasFiltradas() {
    const b = estadoCamp.busca.toLowerCase();
    let lista = dados.campanhas.filter((c) => {
      if (estadoCamp.filtro === "ativas" && !c.ativa) return false;
      if (estadoCamp.filtro === "finalizadas" && c.ativa) return false;
      return !b || [c.campanha, c.cliente].some((x) => String(x || "").toLowerCase().includes(b));
    });
    const col = COLUNAS.find((x) => x.id === estadoCamp.col) || COLUNAS[7];
    lista = lista.slice().sort((a, z) => {
      const va = col.valor(a), vz = col.valor(z);
      if (va == null && vz == null) return 0;
      if (va == null) return 1;   // vazios sempre no fim
      if (vz == null) return -1;
      const r = typeof va === "number" ? va - vz : String(va).localeCompare(String(vz), "pt-BR");
      return r * estadoCamp.dir;
    });
    return lista;
  }

  function avisoPrazo(c) {
    if (!c.prazo || c.status === "Entregue") return "";
    const d = diasAte(c.prazo);
    if (d < 0) return `<span class="etiqueta e-vermelha">atrasado ${plural(-d, "dia", "dias")}</span>`;
    if (d === 0) return `<span class="etiqueta e-amarela">vence hoje</span>`;
    if (d <= 3) return `<span class="etiqueta e-amarela">vence em ${plural(d, "dia", "dias")}</span>`;
    return "";
  }

  function desenharCampanhas() {
    const sec = $("#aba-campanhas");
    if (!$("#camp-ferramentas")) {
      sec.innerHTML = `
        <div class="numeros" id="camp-numeros"></div>
        <div class="ferramentas" id="camp-ferramentas">
          <div class="chips" role="group" aria-label="Filtrar campanhas">
            <button type="button" class="chip ativo" data-f="todas">Todas</button>
            <button type="button" class="chip" data-f="ativas">Ativas</button>
            <button type="button" class="chip" data-f="finalizadas">Finalizadas</button>
          </div>
          <input class="entrada" type="search" id="camp-busca" placeholder="Buscar campanha ou cliente" aria-label="Buscar campanhas">
          <div class="direita">
            <button class="btn" type="button" id="camp-csv">${ICONE.baixar}Baixar CSV</button>
            <button class="btn btn-principal" type="button" id="camp-nova">${ICONE.mais}Adicionar campanha</button>
          </div>
        </div>
        <div id="camp-lista"></div>`;
      $$("[data-f]", sec).forEach((b) => b.addEventListener("click", () => {
        estadoCamp.filtro = b.dataset.f;
        $$("[data-f]", sec).forEach((x) => x.classList.toggle("ativo", x === b));
        desenharListaCampanhas();
      }));
      $("#camp-busca").addEventListener("input", (e) => { estadoCamp.busca = e.target.value.trim(); desenharListaCampanhas(); });
      $("#camp-nova").addEventListener("click", () => formCampanha());
      $("#camp-csv").addEventListener("click", () => {
        baixarCSV(`campanhas-${hojeChave()}.csv`, ["Favorita", "Campanha", "Cliente", "Tipo", "Status", "Qtd", "Valor", "Prazo", "Pagamento", "Ativa"],
          campanhasFiltradas().map((c) => [c.favorita ? "sim" : "", c.campanha, c.cliente, c.tipo, c.status, numero(c.qtd), numero(c.valor).toFixed(2).replace(".", ","), fmtData(c.prazo), c.pagamento === "pago" ? "Pago" : "Pendente", c.ativa ? "sim" : "não"]));
      });
    }
    // Faixa de números (linhas de exemplo não entram na conta)
    const reais = dados.campanhas.filter((c) => !c.exemplo);
    const valorTotal = reais.reduce((s, c) => s + numero(c.valor), 0);
    const qtdTotal = reais.reduce((s, c) => s + numero(c.qtd), 0);
    const aReceber = reais.filter((c) => c.pagamento !== "pago").reduce((s, c) => s + numero(c.valor), 0);
    const recebido = reais.filter((c) => c.pagamento === "pago").reduce((s, c) => s + numero(c.valor), 0);
    $("#camp-numeros").innerHTML = `
      <div class="numero"><small>Total de campanhas</small><strong>${reais.length}</strong></div>
      <div class="numero"><small>Ativas</small><strong>${reais.filter((c) => c.ativa).length}</strong></div>
      <div class="numero"><small>Valor total</small><strong>${moeda(valorTotal)}</strong><em>${qtdTotal > 0 ? moeda(valorTotal / qtdTotal) + " por vídeo" : "ticket médio aparece com os vídeos"}</em></div>
      <div class="numero"><small>A receber</small><strong>${moeda(aReceber)}</strong><em>${moeda(recebido)} já recebido</em></div>`;
    desenharListaCampanhas();
  }

  function desenharListaCampanhas() {
    const caixa = $("#camp-lista");
    if (faltando.campanhas) { caixa.innerHTML = `<p class="vazio">${esc(faltando.campanhas)}</p>`; return; }
    const lista = campanhasFiltradas();
    const cab = COLUNAS.map((c) => {
      const ativa = estadoCamp.col === c.id;
      const seta = ativa ? (estadoCamp.dir === 1 ? "↑" : "↓") : "↕";
      const rot = c.id === "favorita" ? '<span class="sr-only">Favorita</span>' + ICONE.estrela.replace('class="traco"', 'class="traco" style="width:13px;height:13px;vertical-align:-2px"') : c.rotulo;
      return `<th class="ordena${ativa ? " ativa" : ""}${c.num ? " num" : ""}" data-col="${c.id}" aria-sort="${ativa ? (estadoCamp.dir === 1 ? "ascending" : "descending") : "none"}" tabindex="0">${rot}<span class="seta" aria-hidden="true">${seta}</span></th>`;
    }).join("");
    caixa.innerHTML = !lista.length
      ? `<p class="vazio">${dados.campanhas.length ? "Nenhuma campanha com esse filtro." : "Nenhuma campanha ainda. Clique em \"Adicionar campanha\"."}</p>`
      : `<div class="tabela-caixa"><table class="tabela">
          <thead><tr>${cab}</tr></thead>
          <tbody>${lista.map((c) => {
            const st = STATUS.indexOf(c.status);
            return `<tr class="clicavel${c.favorita ? " favorita" : ""}" data-id="${c.id}">
              <td><button type="button" class="estrela${c.favorita ? " ligada" : ""}" data-estrela aria-label="${c.favorita ? "Tirar destaque" : "Destacar campanha"}" aria-pressed="${c.favorita ? "true" : "false"}">${ICONE.estrela}</button></td>
              <td><b style="font-weight:500">${esc(c.campanha)}</b>${exemploTag(c)}</td>
              <td>${esc(c.cliente)}</td>
              <td><span class="pilula ${c.tipo === "Publicidade" ? "p-publicidade" : "p-conteudo"}">${esc(c.tipo)}</span></td>
              <td><span class="pilula p-st${st < 0 ? 0 : st}">${esc(c.status)}</span></td>
              <td class="num">${numero(c.qtd)}</td>
              <td class="num">${moeda(c.valor)}</td>
              <td style="white-space:nowrap">${fmtData(c.prazo)}${avisoPrazo(c)}</td>
              <td><button type="button" class="pilula ${c.pagamento === "pago" ? "p-pago" : "p-pendente"}" data-pag style="border:0;cursor:pointer" title="Clique para marcar como ${c.pagamento === "pago" ? "pendente" : "pago"}">${c.pagamento === "pago" ? "Pago" : "Pendente"}</button></td>
            </tr>`;
          }).join("")}</tbody>
        </table></div>`;
    $$("th.ordena", caixa).forEach((th) => {
      const ordenar = () => {
        if (estadoCamp.col === th.dataset.col) estadoCamp.dir *= -1;
        else { estadoCamp.col = th.dataset.col; estadoCamp.dir = 1; }
        desenharListaCampanhas();
      };
      th.addEventListener("click", ordenar);
      th.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ordenar(); } });
    });
    const corpo = $("tbody", caixa);
    if (!corpo) return;
    corpo.addEventListener("click", async (e) => {
      const tr = e.target.closest("tr");
      const c = tr && dados.campanhas.find((x) => String(x.id) === tr.dataset.id);
      if (!c) return;
      if (e.target.closest("[data-estrela]")) {
        if (await gravar("campanhas", { favorita: !c.favorita }, c.id)) await recarregar("campanhas");
        return;
      }
      if (e.target.closest("[data-pag]")) {
        const novo = c.pagamento === "pago" ? "pendente" : "pago";
        if (await gravar("campanhas", { pagamento: novo }, c.id)) { avisar(novo === "pago" ? "Marcado como pago" : "Marcado como pendente"); await recarregar("campanhas"); }
        return;
      }
      formCampanha(c);
    });
  }

  function formCampanha(c) {
    const novo = !c;
    c = c || { tipo: "Conteúdo", status: "Briefing", qtd: 1, valor: 0, pagamento: "pendente", ativa: true };
    abrirJanela({
      titulo: novo ? "Adicionar campanha" : "Editar campanha",
      corpo:
        campo({ nome: "campanha", rotulo: "Campanha", valor: c.campanha, obrigatorio: true }) +
        `<div class="linha-campos">` +
        campo({ nome: "cliente", rotulo: "Cliente", valor: c.cliente, lista: dados.marcas.map((m) => m.nome).filter(Boolean) }) +
        campo({ nome: "tipo", rotulo: "Tipo", tipo: "select", valor: c.tipo, opcoes: ["Conteúdo", "Publicidade"] }) +
        campo({ nome: "status", rotulo: "Status", tipo: "select", valor: c.status, opcoes: STATUS }) +
        campo({ nome: "prazo", rotulo: "Prazo", tipo: "date", valor: c.prazo || "" }) +
        campo({ nome: "qtd", rotulo: "Quantidade de vídeos", tipo: "number", valor: numero(c.qtd), passo: "1" }) +
        campo({ nome: "valor", rotulo: "Valor total (R$)", tipo: "number", valor: numero(c.valor), passo: "0.01" }) +
        campo({ nome: "pagamento", rotulo: "Pagamento", tipo: "select", valor: c.pagamento, opcoes: [{ v: "pendente", t: "Pendente" }, { v: "pago", t: "Pago" }] }) +
        `</div>` +
        marcaCheck("ativa", "Campanha ativa (desmarque quando finalizar)", c.ativa !== false) +
        marcaCheck("favorita", "Destacar com estrela", Boolean(c.favorita)) +
        (c.exemplo ? marcaCheck("exemplo", "É linha de exemplo (não entra nas contas)", true) : ""),
      botoes: [
        ...(novo ? [] : [{ texto: ICONE.apagar + "Apagar", classe: "btn-perigo", acao: async () => {
          if (await confirmar(`Apagar a campanha "${c.campanha}"?`) && await apagar("campanhas", c.id)) { avisar("Campanha apagada"); await recarregar("campanhas"); }
        } }]),
        { texto: "Cancelar" },
        { texto: "Salvar", classe: "btn-principal", acao: async () => {
          const f = lerFormulario();
          if (!f.campanha) { avisar("Preencha o nome da campanha.", true); return false; }
          const linha = { campanha: f.campanha, cliente: nulo(f.cliente), tipo: f.tipo, status: f.status, prazo: nulo(f.prazo), qtd: Math.max(0, Math.round(numero(f.qtd))), valor: Math.max(0, numero(String(f.valor).replace(",", "."))), pagamento: f.pagamento, ativa: f.ativa, favorita: f.favorita };
          if ("exemplo" in f) linha.exemplo = f.exemplo;
          if (!(await gravar("campanhas", linha, novo ? null : c.id))) return false;
          avisar(novo ? "Campanha adicionada" : "Campanha salva");
          await recarregar("campanhas");
        } }
      ]
    });
  }


  // =========================================================
  // 5b. ROTEIROS (transcrição de vídeos do YouTube, Instagram e TikTok)
  // =========================================================
  const ORIGENS = [{ v: "instagram", t: "Instagram" }, { v: "tiktok", t: "TikTok" }, { v: "youtube", t: "YouTube" }, { v: "outro", t: "Outro" }];
  const TIPOS_GANCHO = ["pergunta", "promessa", "dor", "curiosidade", "polêmica", "número", "história", "prova"];
  const estadoRot = { filtro: "todos", busca: "" };

  function origemDoLink(link) {
    const l = String(link || "").toLowerCase();
    if (/instagram\.com/.test(l)) return "instagram";
    if (/tiktok\.com/.test(l)) return "tiktok";
    if (/youtube\.com|youtu\.be/.test(l)) return "youtube";
    return "outro";
  }
  function perfilDoLink(link) {
    const l = String(link || "");
    const tk = l.match(/tiktok\.com\/@([\w.]+)/i); if (tk) return tk[1];
    const ig = l.match(/instagram\.com\/(?!p\/|reel\/|reels\/|tv\/|stories\/)([\w.]+)/i); if (ig) return ig[1];
    const yt = l.match(/youtube\.com\/@([\w.-]+)/i); if (yt) return yt[1];
    return "";
  }
  // Endereço para o vídeo tocar dentro do painel
  function embedDoLink(link) {
    const l = String(link || "");
    const yt = idYoutube(l);
    if (yt) return `https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1&playsinline=1`;
    const ig = l.match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)/i);
    if (ig) return `https://www.instagram.com/${ig[1] === "reels" ? "reel" : ig[1]}/${ig[2]}/embed/`;
    const tk = l.match(/tiktok\.com\/.*\/video\/(\d+)/i) || l.match(/tiktok\.com\/embed(?:\/v2)?\/(\d+)/i);
    if (tk) return `https://www.tiktok.com/embed/v2/${tk[1]}`;
    return "";
  }
  const capaDoLink = (link) => { const yt = idYoutube(link); return yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : ""; };
  const nomeOrigem = (o) => (ORIGENS.find((x) => x.v === o) || { t: "Vídeo" }).t;
  const listaVirgula = (t) => String(t || "").split(",").map((x) => x.trim()).filter(Boolean);
  const linhas = (t) => String(t || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

  // Monta gancho, passos e CTA a partir do texto colado (sem inteligência artificial: separa as frases)
  function montarEstrutura(texto) {
    const frases = String(texto || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/).filter(Boolean);
    if (!frases.length) return null;
    let gancho = frases[0];
    let resto = frases.slice(1);
    if (gancho.length < 40 && resto.length && !/[?]$/.test(gancho)) { gancho += " " + resto[0]; resto = resto.slice(1); }
    let cta = "";
    if (resto.length > 1) cta = resto.pop();
    const tipo = /\?/.test(gancho) ? "pergunta" : /\d/.test(gancho) ? "número" : /vou te|vou mostrar|aprenda|descubra|como /i.test(gancho) ? "promessa" : "curiosidade";
    // junta as frases do meio em até 6 passos
    const passos = [];
    const tamanho = Math.max(1, Math.ceil(resto.length / 6));
    for (let i = 0; i < resto.length; i += tamanho) passos.push(resto.slice(i, i + tamanho).join(" "));
    return { gancho, gancho_tipo: tipo, desenvolvimento: passos.join("\n"), cta, titulo: gancho.slice(0, 90) };
  }

  function roteirosFiltrados() {
    const b = estadoRot.busca.toLowerCase().replace(/^@/, "");
    return dados.roteiros.filter((r) => {
      if (estadoRot.filtro === "outras" && r.de_quem !== "outra") return false;
      if (estadoRot.filtro === "meus" && r.de_quem !== "meu") return false;
      if (!b) return true;
      return [r.titulo, r.perfil, r.transcricao, r.notas, r.gancho, r.etiquetas].some((c) => String(c || "").toLowerCase().includes(b));
    });
  }

  // Chama o programa "transcrever" do Supabase e devolve a resposta (ou um erro com a mensagem em português)
  async function chamarTranscrever(corpo) {
    const { data, error } = await banco.functions.invoke("transcrever", { body: corpo });
    if (error) {
      let msg = "";
      try { msg = (await error.context.json()).erro; } catch (e) {}
      throw new Error(msg || "Não consegui falar com o programa de transcrição. Tente de novo.");
    }
    if (data && data.erro) throw new Error(data.erro);
    return data || {};
  }
  let tokscriptConectado = null;
  async function atualizarStatusTokscript(forcar) {
    if (forcar !== undefined) tokscriptConectado = forcar;
    else { try { tokscriptConectado = Boolean((await chamarTranscrever({ acao: "tokscript_status" })).conectado); } catch (e) { tokscriptConectado = null; } }
    const el = $("#rot-ts");
    if (!el) return;
    if (tokscriptConectado) {
      el.innerHTML = `<span class="rot-ts-ok">● TokScript conectado</span> <button class="btn-texto" type="button" id="rot-ts-sair">desconectar</button>`;
      $("#rot-ts-sair").addEventListener("click", async () => {
        if (!window.confirm("Desconectar o TokScript do painel?")) return;
        try { await chamarTranscrever({ acao: "tokscript_sair" }); atualizarStatusTokscript(false); avisar("TokScript desconectado"); } catch (e) { avisar(e.message, true); }
      });
    } else {
      el.innerHTML = `<button class="btn btn-mini rot-ts-btn" type="button" id="rot-ts-conectar">Conectar TokScript</button>`;
      $("#rot-ts-conectar").addEventListener("click", () => { $("#rot-conectar").hidden = false; $("#rot-conectar").scrollIntoView({ behavior: "smooth", block: "center" }); });
    }
  }

  function desenharRoteiros() {
    const sec = $("#aba-roteiros");
    if (!$("#rot-novo")) {
      sec.innerHTML = `
        <div class="rot-faixa">
          <p class="rot-faixa-sub">Cole o link de um vídeo do Instagram, TikTok ou YouTube. O painel transcreve, preenche o roteiro e deixa salvo com o vídeo tocando ao lado e as suas notas.</p>
          <form class="rot-novo" id="rot-novo">
            <input class="entrada" type="url" id="rot-link" placeholder="Cole aqui: instagram.com/reel/... · tiktok.com/... · youtube.com/..." aria-label="Link do vídeo" required>
            <select class="entrada" id="rot-dequem" aria-label="De quem é o vídeo"><option value="outra">De outra pessoa</option><option value="meu">Meu</option></select>
            <button class="btn btn-principal" type="submit">Transcrever</button>
          </form>
          <div class="rot-faixa-rodape">
            <button class="btn-texto" type="button" id="rot-mao">ou escrever um roteiro na mão</button>
            <span class="rot-ts" id="rot-ts"></span>
          </div>
        </div>
        <div class="bloco rot-conectar" id="rot-conectar" hidden>
          <div class="bloco-titulo"><h2>Conectar o TokScript (só uma vez)</h2><button class="icone-btn" type="button" id="rot-conectar-fechar" aria-label="Fechar">×</button></div>
          <ol class="rot-passos">
            <li>Clique em <button class="btn btn-mini btn-principal" type="button" id="rot-ts-abrir">Abrir o login do TokScript ↗</button> e entre com a sua conta.</li>
            <li>Depois de entrar, o navegador mostra uma página de erro (<i>"não é possível acessar esse site"</i>). <b>Isso é normal.</b></li>
            <li>Copie o endereço inteiro da barra lá em cima (começa com <code>http://localhost:3000/callback?code=</code>) e cole aqui:</li>
          </ol>
          <div class="rot-novo">
            <input class="entrada" type="text" id="rot-ts-url" placeholder="Cole aqui o endereço da página de erro" aria-label="Endereço da página de erro">
            <button class="btn btn-principal" type="button" id="rot-ts-concluir">Concluir</button>
          </div>
        </div>
        <div class="ferramentas">
          <input class="entrada" type="search" id="rot-busca" placeholder="Buscar no texto, no perfil ou nas suas notas" aria-label="Buscar roteiros">
          <div class="chips" role="group" aria-label="Filtrar roteiros" id="rot-chips"></div>
        </div>
        <div id="rot-lista"></div>`;
      $("#rot-novo").addEventListener("submit", (e) => {
        e.preventDefault();
        const link = $("#rot-link").value.trim();
        if (!/^https?:\/\//i.test(link)) { avisar("Cole o link completo do vídeo, começando com https://", true); return; }
        const origemLink = origemDoLink(link);
        formRoteiro(null, { link, de_quem: $("#rot-dequem").value, origem: origemLink, perfil: perfilDoLink(link) }, false, origemLink !== "outro");
        $("#rot-link").value = "";
      });
      $("#rot-mao").addEventListener("click", () => formRoteiro(null, { de_quem: "meu", origem: "outro" }));
      $("#rot-conectar-fechar").addEventListener("click", () => { $("#rot-conectar").hidden = true; });
      $("#rot-ts-abrir").addEventListener("click", async (e) => {
        const btn = e.currentTarget; btn.classList.add("carregando");
        const janelaLogin = window.open("about:blank", "_blank");
        try {
          const r = await chamarTranscrever({ acao: "tokscript_inicio" });
          if (janelaLogin) janelaLogin.location.href = r.url; else window.open(r.url, "_blank");
        } catch (er) { if (janelaLogin) janelaLogin.close(); avisar(er.message, true); }
        btn.classList.remove("carregando");
      });
      $("#rot-ts-concluir").addEventListener("click", async (e) => {
        const texto = $("#rot-ts-url").value.trim();
        let code = "", state = "";
        try { const u = new URL(texto); code = u.searchParams.get("code") || ""; state = u.searchParams.get("state") || ""; } catch (er) {}
        if (!code) { avisar("Esse endereço não tem o código do login. Copie o endereço inteiro da página de erro.", true); return; }
        const btn = e.currentTarget; btn.classList.add("carregando");
        try {
          await chamarTranscrever({ acao: "tokscript_finalizar", code, state });
          $("#rot-conectar").hidden = true; $("#rot-ts-url").value = "";
          avisar("TokScript conectado! Agora é só colar o link e clicar em Transcrever.");
          atualizarStatusTokscript(true);
        } catch (er) { avisar(er.message, true); }
        btn.classList.remove("carregando");
      });
      atualizarStatusTokscript();
      $("#rot-busca").addEventListener("input", (e) => { estadoRot.busca = e.target.value.trim(); desenharListaRoteiros(); });
    }
    desenharListaRoteiros();
  }

  function desenharListaRoteiros() {
    const total = dados.roteiros.length;
    const outras = dados.roteiros.filter((r) => r.de_quem === "outra").length;
    $("#rot-chips").innerHTML = [["todos", `Todos ${total}`], ["outras", `De outras ${outras}`], ["meus", `Meus ${total - outras}`]]
      .map(([v, t]) => `<button type="button" class="chip${estadoRot.filtro === v ? " ativo" : ""}" data-f="${v}">${t}</button>`).join("");
    $$("#rot-chips .chip").forEach((c) => c.addEventListener("click", () => { estadoRot.filtro = c.dataset.f; desenharListaRoteiros(); }));
    const caixa = $("#rot-lista");
    if (faltando.roteiros) { caixa.innerHTML = `<p class="vazio">${esc(faltando.roteiros)}</p>`; return; }
    const lista = roteirosFiltrados();
    if (!lista.length) { caixa.innerHTML = `<p class="vazio">${total ? "Nenhum roteiro encontrado com essa busca." : "Nenhum roteiro ainda. Cole o link de um vídeo lá em cima."}</p>`; return; }
    caixa.innerHTML = lista.map((r) => {
      const capa = capaDoLink(r.link);
      return `<article class="rot-card" data-id="${r.id}" tabindex="0">
        <div class="rot-capa rot-${esc(r.origem)}">${capa ? `<img src="${capa}" alt="" loading="lazy">` : `<span>${esc(nomeOrigem(r.origem))}</span>`}</div>
        <div class="rot-info">
          <div class="rot-topo">
            <span class="pilula ${r.de_quem === "meu" ? "p-cliente" : "p-st0"}">${r.de_quem === "meu" ? "meu" : "de outra"}</span>
            ${r.perfil ? `<b>@${esc(String(r.perfil).replace(/^@/, ""))}</b>` : ""}
            ${exemploTag(r)}
            ${embedDoLink(r.link) ? `<button type="button" class="btn btn-mini" data-tocar>▶ tocar aqui</button>` : ""}
            <span class="rot-meta">${esc(nomeOrigem(r.origem))}${r.data_post ? " · " + fmtData(r.data_post) : ""}</span>
            ${r.link ? `<a class="link-mini rot-ver" href="${esc(r.link)}" target="_blank" rel="noopener">ver vídeo ↗</a>` : ""}
          </div>
          <h3 class="rot-titulo">${esc(r.titulo || "Sem título")}</h3>
          ${r.transcricao ? `<p class="rot-trecho">${esc(String(r.transcricao).slice(0, 260))}${String(r.transcricao).length > 260 ? "..." : ""}</p>` : `<p class="rot-trecho rot-falta">Ainda sem transcrição. Clique para colar o texto do vídeo.</p>`}
          ${r.gancho ? `<p class="rot-gancho"><b>${esc((r.gancho_tipo || "gancho").toUpperCase())}</b>${esc(r.gancho)}</p>` : ""}
          ${r.notas ? `<p class="rot-nota">✎ ${esc(r.notas)}</p>` : ""}
        </div>
      </article>`;
    }).join("");
    $$(".rot-card", caixa).forEach((card) => {
      const abrir = (tocar) => { const r = dados.roteiros.find((x) => String(x.id) === card.dataset.id); if (r) formRoteiro(r, null, tocar); };
      card.addEventListener("click", (e) => { if (e.target.closest("a")) return; abrir(Boolean(e.target.closest("[data-tocar]"))); });
      card.addEventListener("keydown", (e) => { if (e.key === "Enter") abrir(false); });
    });
  }

  function blocoEstrutura(r) {
    const passos = linhas(r.desenvolvimento);
    const exprs = listaVirgula(r.expressoes);
    const tags = listaVirgula(r.etiquetas);
    if (!r.gancho && !passos.length && !r.cta && !exprs.length && !r.por_que) {
      return `<p class="rot-vazio-estrutura">Cole a transcrição embaixo e clique em <b>Montar estrutura</b>, ou preencha os campos da estrutura à mão.</p>`;
    }
    return `
      ${tags.length ? `<div class="rot-linha"><span class="rot-rotulo">A estrutura</span>${tags.map((t) => `<span class="rot-tag">${esc(t)}</span>`).join("")}</div>` : ""}
      ${r.gancho ? `<div class="rot-parte"><span class="rot-rotulo">Gancho${r.gancho_tipo ? " · " + esc(r.gancho_tipo) : ""}</span><p class="rot-destaque">${esc(r.gancho)}</p></div>` : ""}
      ${passos.length ? `<div class="rot-parte"><span class="rot-rotulo">Desenvolvimento</span><ol>${passos.map((p) => `<li>${esc(p)}</li>`).join("")}</ol></div>` : ""}
      ${r.cta ? `<div class="rot-parte"><span class="rot-rotulo">CTA</span><p class="rot-caixa">${esc(r.cta)}</p></div>` : ""}
      ${exprs.length ? `<div class="rot-parte"><span class="rot-rotulo">Expressões que usa</span><div>${exprs.map((t) => `<span class="rot-tag">${esc(t)}</span>`).join("")}</div></div>` : ""}
      ${r.por_que ? `<div class="rot-parte"><span class="rot-rotulo">Por que prende</span><p class="rot-caixa rot-porque">${esc(r.por_que)}</p></div>` : ""}`;
  }

  function formRoteiro(r, inicial, tocar, autoTranscrever) {
    const novo = !r;
    r = r || Object.assign({ de_quem: "outra", origem: "instagram" }, inicial || {});
    const embed = embedDoLink(r.link);
    abrirJanela({
      sobretitulo: novo ? "Novo roteiro" : "Editar roteiro",
      titulo: "Roteiro",
      extraLarga: true,
      corpo: `
        <div class="rot-janela">
          <div class="rot-esq">
            ${campo({ nome: "titulo", rotulo: "Título (do que é esse roteiro)", valor: r.titulo })}
            <div class="linha-campos tres">
              ${campo({ nome: "de_quem", rotulo: "De quem é", tipo: "select", valor: r.de_quem, opcoes: [{ v: "outra", t: "De outra pessoa" }, { v: "meu", t: "Meu" }] })}
              ${campo({ nome: "perfil", rotulo: "Perfil (sem @)", valor: String(r.perfil || "").replace(/^@/, "") })}
              ${campo({ nome: "data_post", rotulo: "Data do post", tipo: "date", valor: r.data_post || "" })}
            </div>
            <div class="linha-campos">
              ${campo({ nome: "origem", rotulo: "Origem", tipo: "select", valor: r.origem, opcoes: ORIGENS })}
              ${campo({ nome: "etiquetas", rotulo: "Etiquetas (separe por vírgula)", valor: r.etiquetas, dica: "Ex.: tutorial, beleza, unboxing" })}
            </div>
            ${campo({ nome: "link", rotulo: "Link do vídeo", valor: r.link })}
            <div class="rot-estrutura" id="rot-estrutura">${blocoEstrutura(r)}</div>
            <details class="rot-editar"${novo ? "" : ""}>
              <summary>Editar a estrutura (gancho, passos, CTA...)</summary>
              <div class="linha-campos">
                ${campo({ nome: "gancho", rotulo: "Gancho", valor: r.gancho })}
                ${campo({ nome: "gancho_tipo", rotulo: "Tipo de gancho", valor: r.gancho_tipo, lista: TIPOS_GANCHO })}
              </div>
              ${campo({ nome: "desenvolvimento", rotulo: "Desenvolvimento (um passo por linha)", tipo: "textarea", valor: r.desenvolvimento })}
              ${campo({ nome: "cta", rotulo: "CTA (a chamada do final)", valor: r.cta })}
              ${campo({ nome: "expressoes", rotulo: "Expressões que a pessoa usa (separe por vírgula)", valor: r.expressoes })}
              ${campo({ nome: "por_que", rotulo: "Por que prende", tipo: "textarea", valor: r.por_que })}
            </details>
            <div class="campo">
              <div class="rot-rotulo-linha"><label for="f-transcricao">Roteiro / transcrição</label>
                <span class="rot-botoes">
                  <button class="btn btn-mini btn-principal" type="button" id="rot-transcrever">✨ Transcrever e preencher</button>
                  <label class="btn btn-mini" for="rot-arquivo" title="Use se o link não puder ser baixado">Enviar o arquivo do vídeo</label>
                  <input type="file" id="rot-arquivo" accept="video/*,audio/*" hidden>
                </span></div>
              <p class="rot-status" id="rot-status" role="status" hidden></p>
              <textarea id="f-transcricao" name="transcricao" class="rot-texto" placeholder="Cole aqui o texto falado no vídeo.">${esc(r.transcricao)}</textarea>
              <small class="rot-dica">O painel baixa o vídeo pelo link, transcreve e preenche sozinho o título, o perfil, o gancho, os passos, o CTA, as expressões e por que prende. Se a rede não deixar baixar (perfil privado, por exemplo), salve o vídeo no celular ou no computador e use <b>Enviar o arquivo do vídeo</b>. Você também pode colar um texto aqui e clicar em <button class="btn-link" type="button" id="rot-montar">separar gancho, passos e CTA</button>.</small>
            </div>
            ${campo({ nome: "notas", rotulo: "Suas notas (o que te chamou atenção)", tipo: "textarea", valor: r.notas })}
            ${r.exemplo ? marcaCheck("exemplo", "É linha de exemplo", true) : ""}
          </div>
          <div class="rot-dir">
            <span class="rot-rotulo">O vídeo</span>
            <div class="rot-player" id="rot-player">${embed ? `<iframe src="${embed}" title="Vídeo do roteiro" allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write" allowfullscreen loading="lazy"></iframe>` : `<p>Cole o link do vídeo ao lado para ele aparecer aqui.${r.link ? "<br><br>Esse link não pode tocar aqui dentro (links curtos do TikTok, por exemplo). Use o link completo do vídeo, ou abra pelo botão abaixo." : ""}</p>`}</div>
            ${r.link ? `<a class="link-mini" href="${esc(r.link)}" target="_blank" rel="noopener">abrir no ${esc(nomeOrigem(r.origem))} ↗</a>` : ""}
          </div>
        </div>`,
      botoes: [
        ...(novo ? [] : [{ texto: ICONE.apagar + "Apagar", classe: "btn-perigo", acao: async () => {
          if (await confirmar(`Apagar o roteiro "${r.titulo || "sem título"}"?`) && await apagar("roteiros", r.id)) { avisar("Roteiro apagado"); await recarregar("roteiros"); }
        } }]),
        { texto: "Cancelar" },
        { texto: "✓ Salvar", classe: "btn-principal", acao: async () => {
          const f = lerFormulario();
          if (!f.titulo && !f.link && !f.transcricao) { avisar("Preencha pelo menos o título, o link ou a transcrição.", true); return false; }
          const linha = { titulo: f.titulo || (f.gancho || "").slice(0, 90) || "Roteiro sem título", de_quem: f.de_quem, perfil: nulo(f.perfil.replace(/^@/, "")), data_post: nulo(f.data_post),
            origem: f.origem, link: nulo(f.link), etiquetas: nulo(f.etiquetas), gancho: nulo(f.gancho), gancho_tipo: nulo(f.gancho_tipo), desenvolvimento: nulo(f.desenvolvimento),
            cta: nulo(f.cta), expressoes: nulo(f.expressoes), por_que: nulo(f.por_que), transcricao: nulo(f.transcricao), notas: nulo(f.notas) };
          if ("exemplo" in f) linha.exemplo = f.exemplo;
          if (!(await gravar("roteiros", linha, novo ? null : r.id))) return false;
          avisar(novo ? "Roteiro salvo" : "Roteiro atualizado");
          await recarregar("roteiros");
        } }
      ],
      aoAbrir: (corpo) => {
        const atualizarEstrutura = () => {
          const f = lerFormulario();
          $("#rot-estrutura", corpo).innerHTML = blocoEstrutura(f);
        };
        $$('[name="gancho"],[name="gancho_tipo"],[name="desenvolvimento"],[name="cta"],[name="expressoes"],[name="por_que"],[name="etiquetas"]', corpo)
          .forEach((el) => el.addEventListener("input", atualizarEstrutura));
        // Transcrição automática (Edge Function "transcrever" no Supabase, com o Groq)
        const status = $("#rot-status", corpo);
        const mostrarStatus = (t, erro) => { status.textContent = t; status.hidden = !t; status.classList.toggle("erro", Boolean(erro)); };
        const preencher = (res) => {
          const pos = (nome, valor, sobrescrever) => { const el = $(`[name="${nome}"]`, corpo); if (el && valor && (sobrescrever || !el.value.trim())) el.value = valor; };
          pos("transcricao", res.transcricao, true);
          pos("perfil", res.perfil, false);
          pos("data_post", res.data_post, false);
          if (res.origem && res.origem !== "outro") pos("origem", res.origem, true);
          const c = res.campos;
          if (c) {
            pos("titulo", c.titulo, false);
            ["gancho", "gancho_tipo", "desenvolvimento", "cta", "expressoes", "por_que"].forEach((k) => pos(k, c[k], true));
            pos("etiquetas", c.etiquetas, false);
          } else {
            const m = montarEstrutura(res.transcricao);
            if (m) { ["gancho", "gancho_tipo", "desenvolvimento", "cta"].forEach((k) => pos(k, m[k], true)); pos("titulo", m.titulo, false); }
          }
          atualizarEstrutura();
        };
        async function transcrever(arquivo) {
          const link = $('[name="link"]', corpo).value.trim();
          if (!arquivo && !/^https?:\/\//i.test(link)) { mostrarStatus("Cole o link do vídeo no campo \"Link do vídeo\" ou envie o arquivo.", true); return; }
          const temTexto = $("#f-transcricao", corpo).value.trim();
          if (temTexto && !window.confirm("Já tem uma transcrição. Trocar pela nova?")) return;
          const botoes = $$("#rot-transcrever, label[for=rot-arquivo]", corpo);
          botoes.forEach((b) => b.classList.add("carregando"));
          $("#rot-transcrever", corpo).disabled = true;
          mostrarStatus(arquivo ? "Enviando o vídeo e transcrevendo... (pode levar até 1 minuto)" : "Baixando o vídeo e transcrevendo... (pode levar até 1 minuto)");
          try {
            let corpoPedido;
            if (arquivo) {
              if (arquivo.size > 25 * 1024 * 1024) throw new Error("O arquivo é grande demais (máximo 25 MB). Use um vídeo mais curto.");
              corpoPedido = new FormData(); corpoPedido.append("arquivo", arquivo); corpoPedido.append("link", link);
            } else corpoPedido = { link };
            const data = await chamarTranscrever(corpoPedido);
            if (!data.transcricao) throw new Error("Não veio nenhuma transcrição.");
            preencher(data);
            $("details.rot-editar", corpo).open = true;
            mostrarStatus(data.campos ? "Pronto! Transcrevi e preenchi os campos. Confira e clique em Salvar." : "Transcrevi! Separei gancho, passos e CTA do meu jeito. Confira e clique em Salvar.");
          } catch (e) {
            mostrarStatus(e.message, true);
          } finally {
            botoes.forEach((b) => b.classList.remove("carregando"));
            $("#rot-transcrever", corpo).disabled = false;
          }
        }
        $("#rot-transcrever", corpo).addEventListener("click", () => transcrever(null));
        $("#rot-arquivo", corpo).addEventListener("change", (e) => { const f = e.target.files[0]; if (f) transcrever(f); e.target.value = ""; });
        if (autoTranscrever) setTimeout(() => transcrever(null), 50);
        $("#rot-montar", corpo).addEventListener("click", () => {
          const texto = $("#f-transcricao", corpo).value;
          const m = montarEstrutura(texto);
          if (!m) { avisar("Cole o texto do vídeo no campo de transcrição primeiro.", true); return; }
          const temAlgo = ["gancho", "desenvolvimento", "cta"].some((k) => $(`[name="${k}"]`, corpo).value.trim());
          if (temAlgo && !window.confirm("Trocar o gancho, os passos e o CTA que já estão preenchidos?")) return;
          ["gancho", "gancho_tipo", "desenvolvimento", "cta"].forEach((k) => { $(`[name="${k}"]`, corpo).value = m[k]; });
          if (!$('[name="titulo"]', corpo).value.trim()) $('[name="titulo"]', corpo).value = m.titulo;
          atualizarEstrutura();
          $("details.rot-editar", corpo).open = true;
          avisar("Estrutura montada. Confira e ajuste se precisar.");
        });
        // ao colar outro link, troca o vídeo, a origem e o perfil
        $('[name="link"]', corpo).addEventListener("change", (e) => {
          const link = e.target.value.trim();
          const emb = embedDoLink(link);
          $("#rot-player", corpo).innerHTML = emb ? `<iframe src="${emb}" title="Vídeo do roteiro" allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write" allowfullscreen></iframe>` : "<p>Esse link não pode tocar aqui dentro. Use o link completo do vídeo.</p>";
          if (link) $('[name="origem"]', corpo).value = origemDoLink(link);
          const perfil = perfilDoLink(link);
          if (perfil && !$('[name="perfil"]', corpo).value.trim()) $('[name="perfil"]', corpo).value = perfil;
        });
        if (tocar) $("#rot-player", corpo).scrollIntoView({ block: "center" });
      }
    });
  }

  // =========================================================
  // 5. CHECKLIST PORTFÓLIO (conteúdo do js/biblioteca.js, sem mudar nada)
  // =========================================================
  let subAba = "checklist";
  const marcadoMapa = () => Object.fromEntries(dados.marcados.map((m) => [m.chave, m.marcado !== false]));
  const revisaoMarcada = {};

  function desenharChecklist() {
    const sec = $("#aba-checklist");
    if (!BIB) { sec.innerHTML = `<p class="faixa faixa-aviso">Não encontrei o arquivo js/biblioteca.js. Confira se ele está na pasta js do projeto.</p>`; return; }
    const SUB = [["checklist", "Checklist do portfólio"], ["referencias", "Referências de vídeo"], ["roteiros", "Roteiros"], ["nichos", "Ideias por nicho"], ["revisar", "Revisar meu roteiro"]];
    sec.innerHTML = `<div class="subabas" role="tablist">${SUB.map(([id, t]) => `<button type="button" role="tab" class="subaba${subAba === id ? " ativa" : ""}" aria-selected="${subAba === id}" data-sub="${id}">${t}</button>`).join("")}</div><div id="sub-conteudo"></div>`;
    $$("[data-sub]", sec).forEach((b) => b.addEventListener("click", () => { subAba = b.dataset.sub; desenharChecklist(); }));
    const alvo = $("#sub-conteudo");
    ({ checklist: subChecklist, referencias: subReferencias, roteiros: subRoteiros, nichos: subNichos, revisar: subRevisar })[subAba](alvo);
  }

  function subChecklist(alvo) {
    const secoes = BIB.CHECKLIST || [];
    const mapa = marcadoMapa();
    const conta = (s) => s.itens.filter((_, i) => mapa[`checklist:${s.id}:${i}`]).length;
    const total = secoes.reduce((t, s) => t + s.itens.length, 0);
    const feitos = secoes.reduce((t, s) => t + conta(s), 0);
    const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
    alvo.innerHTML = `
      ${faltando.marcados ? `<p class="faixa faixa-aviso">${esc(faltando.marcados)} Enquanto isso, o que você marcar não fica salvo.</p>` : ""}
      <div class="geral"><div class="progresso" aria-hidden="true"><i style="width:${pct(feitos, total)}%"></i></div><strong>${feitos} de ${total} prontos (${pct(feitos, total)}%)</strong></div>
      ${secoes.map((s) => `
        <details class="secao" data-secao="${esc(s.id)}">
          <summary><span class="emo" aria-hidden="true">${s.emoji}</span><b>${esc(s.nome)}</b>
            <span class="conta"><span data-conta>${conta(s)} de ${s.itens.length}</span><span class="progresso"><i style="width:${pct(conta(s), s.itens.length)}%"></i></span></span>
            <small>${esc(s.resumo)}</small></summary>
          <div class="secao-corpo">
            <p class="porque"><b>Por que importa</b>${esc(s.porque)}</p>
            ${s.itens.map((it, i) => `<label class="item-check"><input type="checkbox" data-chave="checklist:${esc(s.id)}:${i}"${mapa[`checklist:${s.id}:${i}`] ? " checked" : ""}><span><b>${esc(it.t)}</b><small>${esc(it.d)}</small></span></label>`).join("")}
          </div>
        </details>`).join("")}`;
    $$("input[data-chave]", alvo).forEach((cx) => cx.addEventListener("change", async () => {
      const chave = cx.dataset.chave;
      try {
        const { error } = await banco.from("marcados").upsert({ chave, marcado: cx.checked, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
        if (error) throw error;
        const linha = dados.marcados.find((m) => m.chave === chave);
        if (linha) linha.marcado = cx.checked; else dados.marcados.push({ chave, marcado: cx.checked });
        // atualiza as barrinhas sem fechar as seções abertas
        const abertas = $$("details.secao[open]", alvo).map((d) => d.dataset.secao);
        subChecklist(alvo);
        abertas.forEach((id) => { const d = $(`details.secao[data-secao="${id}"]`, alvo); if (d) d.open = true; });
      } catch (err) {
        cx.checked = !cx.checked;
        avisar(traduzErro(err, "marcados"), true);
      }
    }));
  }

  function subReferencias(alvo) {
    const refs = BIB.REFERENCIAS || [];
    // capa = miniatura do próprio vídeo no YouTube (tenta a vertical, depois as outras)
    const capas = (id) => ["oardefault", "maxresdefault", "sddefault", "hqdefault"].map((t) => `https://i.ytimg.com/vi/${id}/${t}.jpg`);
    alvo.innerHTML = `<div class="refs">${refs.map((r, i) => {
      const id = idYoutube(r.youtube);
      const [primeira, ...resto] = id ? capas(id) : [];
      return `
      <button type="button" class="ref" data-ref="${i}">
        <div class="ref-capa cor-${esc(r.cor)}">${id ? `<img class="ref-img" src="${primeira}" data-resto='${JSON.stringify(resto)}' alt="Capa do vídeo ${esc(r.titulo)}" loading="lazy">` : ""}
          <span class="ref-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span><span class="dur">${esc(r.duracao)}</span></div>
        <div class="ref-info"><b>${esc(r.titulo)}</b><small>${esc(r.estilo)} · ${esc(r.marca)}</small></div>
      </button>`;
    }).join("")}</div>`;
    // se a capa não existir (ou vier o quadradinho cinza de 120px do YouTube), tenta a próxima
    $$(".ref-img", alvo).forEach((img) => {
      const proxima = () => { const resto = JSON.parse(img.dataset.resto || "[]"); if (!resto.length) { img.remove(); return; } img.src = resto.shift(); img.dataset.resto = JSON.stringify(resto); };
      img.addEventListener("error", proxima);
      img.addEventListener("load", () => { if (img.naturalWidth <= 120) proxima(); });
    });
    $$("[data-ref]", alvo).forEach((b) => b.addEventListener("click", () => {
      const r = refs[Number(b.dataset.ref)];
      abrirJanela({
        titulo: r.titulo,
        larga: true,
        corpo: `
          ${idYoutube(r.youtube) ? `<div class="ref-video"><iframe src="https://www.youtube-nocookie.com/embed/${idYoutube(r.youtube)}?rel=0&modestbranding=1&playsinline=1" title="Vídeo: ${esc(r.titulo)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>` : ""}
          <p style="margin:0 0 12px;color:var(--suave);font-size:12px">${esc(r.estilo)} · ${esc(r.duracao)} · ${esc(r.marca)}</p>
          <div class="ficha-campo"><b>Gancho</b><p>${esc(r.gancho)}</p></div>
          <div class="ficha-campo"><b>Por que funciona</b><p>${esc(r.porque)}</p></div>
          <div class="ficha-campo"><b>O diferencial</b><p>${esc(r.diferencial)}</p></div>
          <div class="ficha-campo"><b>Erro comum</b><p>${esc(r.erro)}</p></div>
          <div class="ficha-campo"><b>Roteiro</b><ul class="blocos-tempo">${(r.roteiro || []).map((p) => `<li><span class="tempo">${esc(p.t)}</span><span>${p.o}</span></li>`).join("")}</ul></div>`,
        botoes: [{ texto: "Fechar" }, { texto: "Abrir no YouTube", classe: "btn-principal", acao: () => { window.open(r.youtube, "_blank", "noopener"); return false; } }]
      });
    }));
  }

  function subRoteiros(alvo) {
    const tipos = BIB.TIPOS || [];
    alvo.innerHTML = tipos.map((t) => `
      <details class="secao">
        <summary><span class="emo" aria-hidden="true">${t.emoji}</span><b>${esc(t.nome)}</b><span class="conta">${esc(t.duracao)}</span><small>${esc(t.porque)}</small></summary>
        <div class="secao-corpo">
          <p class="porque"><b>Quando usar</b>${esc(t.porque)}</p>
          <ul class="blocos-tempo">${(t.beats || []).map((p) => `<li><span class="tempo">${esc(p.t)}</span><span>${p.o}</span></li>`).join("")}</ul>
          ${(t.erros || []).length ? `<p class="porque" style="margin-top:10px"><b>Erros comuns</b>${t.erros.map(esc).join("<br>")}</p>` : ""}
        </div>
      </details>`).join("");
  }

  function subNichos(alvo) {
    const nichos = BIB.NICHOS || [];
    const dicas = BIB.COMO_USAR || [];
    alvo.innerHTML = `
      ${dicas.length ? `<div class="bloco"><div class="bloco-titulo"><h2>Como usar os ganchos</h2></div><ul class="dicas">${dicas.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></div>` : ""}
      <div class="ideias">${nichos.map((n) => `
        <div class="bloco" style="margin:0">
          <div class="bloco-titulo"><h2>${n.emoji} ${esc(n.nome)}</h2></div>
          ${(n.ideias || []).map((i) => `<div class="ideia"><b>${esc(i.t)}</b><small>"${esc(i.gancho)}"</small></div>`).join("")}
        </div>`).join("")}</div>`;
  }

  function subRevisar(alvo) {
    const blocos = BIB.REVISAO || [];
    let rascunho = "";
    try { rascunho = localStorage.getItem("mb_rascunho_roteiro") || ""; } catch (e) {}
    const total = blocos.reduce((t, b) => t + b.itens.length, 0);
    const feitos = Object.values(revisaoMarcada).filter(Boolean).length;
    alvo.innerHTML = `
      <div class="revisar">
        <div>
          <label for="roteiro-texto" style="display:block;font-size:12px;color:var(--suave);margin-bottom:6px">Cole seu roteiro aqui (fica guardado só neste navegador)</label>
          <textarea id="roteiro-texto" placeholder="Cole aqui o roteiro que você quer revisar...">${esc(rascunho)}</textarea>
        </div>
        <div>
          <div class="geral"><div class="progresso" aria-hidden="true"><i style="width:${total > 0 ? Math.round((feitos / total) * 100) : 0}%"></i></div><strong>${feitos} de ${total} conferidos</strong>
            <button class="btn" type="button" id="revisao-limpar">Limpar</button></div>
          ${blocos.map((b, bi) => `
            <div class="bloco">
              <div class="bloco-titulo"><h2>${b.emoji} ${esc(b.bloco)}</h2></div>
              ${b.itens.map((it, i) => `<label class="item-check"><input type="checkbox" data-rev="${bi}:${i}"${revisaoMarcada[bi + ":" + i] ? " checked" : ""}><span><b>${esc(it.t)}</b><small>${esc(it.d)}</small></span></label>`).join("")}
            </div>`).join("")}
        </div>
      </div>`;
    $("#roteiro-texto").addEventListener("input", (e) => { try { localStorage.setItem("mb_rascunho_roteiro", e.target.value); } catch (er) {} });
    $$("[data-rev]", alvo).forEach((cx) => cx.addEventListener("change", () => { revisaoMarcada[cx.dataset.rev] = cx.checked; subRevisar(alvo); }));
    $("#revisao-limpar").addEventListener("click", () => { Object.keys(revisaoMarcada).forEach((k) => delete revisaoMarcada[k]); subRevisar(alvo); });
  }

  // ---------------------------------------------------------
  // RECARREGAR E DESENHAR
  // ---------------------------------------------------------
  const DESENHOS = {
    videos: () => desenhar("portfolio", desenharPortfolio),
    visitas: () => desenhar("portfolio", desenharPortfolio),
    marcas: () => desenhar("marcas", desenharMarcas),
    calendario: () => {},
    campanhas: () => {},
    marcados: () => desenhar("checklist", desenharChecklist),
    roteiros: () => desenhar("roteiros", desenharRoteiros)
  };
  const CONSULTAS = {
    videos: (q) => q.order("ordem", { ascending: true }).order("id", { ascending: true }),
    marcas: (q) => q.order("criado_em", { ascending: false }),
    calendario: (q) => q.order("data", { ascending: true }),
    campanhas: (q) => q.order("id", { ascending: true }),
    marcados: null,
    roteiros: (q) => q.order("criado_em", { ascending: false })
  };
  async function recarregar(tabela) {
    if (tabela === "visitas") await carregarVisitas();
    else await carregar(tabela, CONSULTAS[tabela]);
    // se a ordenação usar uma coluna que não existe, tenta sem ordenar
    if (faltando[tabela] && CONSULTAS[tabela] && /Falta o campo/.test(faltando[tabela])) await carregar(tabela);
    DESENHOS[tabela]();
  }

  // Atualiza os números do Portfólio
  async function atualizarPortfolio(manual) {
    await Promise.all([carregarVisitas(), carregar("videos", CONSULTAS.videos)]);
    atualizadoEm = new Date();
    desenhar("portfolio", desenharPortfolio);
    if (manual) avisar("Números atualizados");
  }
  // sozinho a cada minuto, só quando a aba do navegador está aberta na frente
  setInterval(() => { if (!document.hidden && !janela.open) atualizarPortfolio(false); }, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) atualizarPortfolio(false); });

  mostrarAba((location.hash || "").replace("#", "") || "portfolio");
  // Desenha logo de cara (vazio) e vai preenchendo conforme os dados chegam
  Object.values(DESENHOS).forEach((d) => d());
  await Promise.all(["marcas", "calendario", "campanhas", "marcados", "roteiros"].map((t) => recarregar(t)));
  await atualizarPortfolio(false);
})();
