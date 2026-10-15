// =========================================================
// CRIATIVIDADE > BIBLIOTECA EDITORIAL (hash #editorial)
// Acompanha perfis de referência e mostra os posts que saíram da curva
// (curtidas comparadas com a mediana do próprio perfil).
// - Perfis: tabela biblioteca_perfis. Posts: tabela biblioteca (só a dona lê e grava).
// - Buscar: função biblioteca acao "buscar" (Apify, assíncrono) e depois
//   acao "recolher" de tempos em tempos até os posts chegarem.
// - Analisar: função biblioteca acao "analisar" (Groq): ideia, ângulo, gancho,
//   estrutura narrativa, composição visual e CTA. Se for Reel, transcreve antes
//   pela Supadata (window.painelSupadata, mesma chave da página Transcrever vídeo).
// Obs.: js/biblioteca.js é outra coisa (Referências de roteiro), por isso o nome editorial.
// =========================================================
(function () {
  "use strict";

  const ABA = "editorial";
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const banco = () => window.banco;
  const fmtData = (iso) => { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("pt-BR"); };
  const fmtNum = (n) => { n = Number(n) || 0; if (n >= 1e6) return (n / 1e6).toFixed(1).replace(".", ",").replace(",0", "") + " mi"; if (n >= 1e4) return (n / 1e3).toFixed(1).replace(".", ",").replace(",0", "") + " mil"; return n.toLocaleString("pt-BR"); };
  const ehVideo = (p) => p.tipo === "Reel" || p.tipo === "Vídeo";

  const st = { pronto: false, perfis: [], posts: [], perfil: "todos", busca: "", ordem: "curva", tipo: "todos", analisando: [], buscando: false, faltaTabela: false, timer: null };

  let tempoToast = null;
  function toast(texto, erro) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = texto;
    t.classList.toggle("erro", Boolean(erro));
    t.classList.add("visivel");
    clearTimeout(tempoToast);
    tempoToast = setTimeout(() => t.classList.remove("visivel"), erro ? 5200 : 2600);
  }

  // ---------- banco ----------
  async function carregar() {
    const [a, b] = await Promise.all([
      banco().from("biblioteca_perfis").select("*").order("criado_em"),
      banco().from("biblioteca").select("*").order("publicado_em", { ascending: false, nullsFirst: false }).limit(5000),
    ]);
    const erro = a.error || b.error;
    if (erro) { st.faltaTabela = /biblioteca/.test(erro.message || "") || erro.code === "42P01" || erro.code === "PGRST205"; st.perfis = []; st.posts = []; return; }
    st.perfis = a.data || [];
    st.posts = b.data || [];
    calcularCurva();
  }
  // mediana de curtidas de cada perfil: "x vezes a média" = curtidas / mediana
  function calcularCurva() {
    const por = {};
    st.posts.forEach((p) => { (por[p.perfil] = por[p.perfil] || []).push(Number(p.curtidas) || 0); });
    const med = {};
    Object.entries(por).forEach(([k, v]) => { v.sort((x, y) => x - y); med[k] = v[Math.floor(v.length / 2)] || 0; });
    st.posts.forEach((p) => { const m = med[p.perfil]; p._vezes = m ? (Number(p.curtidas) || 0) / m : 0; });
  }
  async function chamar(corpo) {
    const { data, error } = await banco().functions.invoke("biblioteca", { body: corpo });
    let msg = data && data.error;
    if (error) { try { msg = (await error.context.json()).error; } catch (e) { /* segue */ } msg = msg || "A função não respondeu agora."; }
    if (msg) throw new Error(msg);
    return data;
  }
  function usuarioLimpo(bruto) {
    const s = String(bruto || "").trim();
    const tk = s.match(/tiktok\.com\/@([\w.]+)/i);
    if (tk) return { rede: "tiktok", usuario: tk[1].toLowerCase() };
    const ig = s.match(/instagram\.com\/([\w.]+)/i);
    const u = (ig ? ig[1] : s).replace(/^@/, "").toLowerCase();
    return /^[\w.]{2,30}$/.test(u) && !["p", "reel", "reels", "tv", "explore", "stories"].includes(u) ? { rede: "instagram", usuario: u } : null;
  }

  // ---------- buscar e recolher ----------
  async function buscar(usuario) {
    if (st.buscando && !usuario) return;
    if (!st.perfis.length) { toast("Adicione um perfil primeiro.", true); return; }
    const jaAcompanhando = st.buscando;
    st.buscando = true; pintar();
    try {
      const r = await chamar({ acao: "buscar", usuario });
      if (!r.iniciados || !r.iniciados.length) throw new Error("Não consegui pedir os posts agora. Tente de novo daqui a pouco.");
      toast(`Buscando os posts de ${r.iniciados.length} perfil${r.iniciados.length > 1 ? "s" : ""}. Leva de 1 a 3 minutos.`);
      await carregar();
      if (!jaAcompanhando) acompanhar();
    } catch (e) { if (!jaAcompanhando) st.buscando = false; toast(e.message, true); }
    pintar();
  }
  // pergunta ao servidor a cada 20s se o Apify terminou (até 8 minutos)
  function acompanhar() {
    clearTimeout(st.timer);
    let voltas = 0;
    const passo = async () => {
      voltas++;
      try {
        const r = await chamar({ acao: "recolher" });
        if (r.novos) { await carregar(); pintar(); }
        if (r.pendentes && voltas < 24) { st.buscando = true; st.timer = setTimeout(passo, 20000); return; }
        if (r.novos || voltas > 1) toast("Biblioteca atualizada.");
      } catch (e) { toast(e.message, true); }
      st.buscando = false;
      await carregar(); pintar();
    };
    st.buscando = true;
    st.timer = setTimeout(passo, 15000);
  }

  // ---------- análise ----------
  async function analisar(p) {
    if (st.analisando.includes(p.id)) return;
    st.analisando.push(p.id); pintarLista();
    try {
      let transcricao;
      if (!p.transcricao && p.rede === "instagram" && ehVideo(p) && window.painelSupadata && window.painelSupadata.transcrever) {
        try { transcricao = (await window.painelSupadata.transcrever(p.link)).texto || undefined; } catch (e) { /* sem fala ou sem chave: analisa só com legenda e capa */ }
      }
      const r = await chamar({ acao: "analisar", id: p.id, transcricao });
      const i = st.posts.findIndex((x) => x.id === p.id);
      if (i >= 0) { st.posts[i] = { ...st.posts[i], analise: r.analise, transcricao: transcricao || st.posts[i].transcricao }; p = st.posts[i]; }
    } catch (e) { toast(e.message, true); }
    st.analisando = st.analisando.filter((x) => x !== p.id);
    pintarLista();
    return p;
  }

  // ---------- tela ----------
  const ic = {
    livro: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>',
    coracao: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    balao: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4A8 8 0 1 1 20 12z"/></svg>',
    olho: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    play: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"/></svg>',
    lupa: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
    mais: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    girar: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4.5h-4.5"/></svg>',
    x: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    brilho: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
  };

  function filtrados() {
    const b = st.busca.trim().toLowerCase();
    const l = st.posts.filter((p) => {
      if (st.perfil !== "todos" && p.perfil !== st.perfil) return false;
      if (st.tipo === "videos" && !ehVideo(p)) return false;
      if (st.tipo === "curva" && p._vezes < 2) return false;
      if (!b) return true;
      const a = p.analise || {};
      return [p.perfil, p.legenda, p.transcricao, a.ideia, a.angulo, a.gancho].join(" ").toLowerCase().includes(b);
    });
    const ord = { curva: (x, y) => y._vezes - x._vezes, curtidas: (x, y) => (y.curtidas || 0) - (x.curtidas || 0), comentarios: (x, y) => (y.comentarios || 0) - (x.comentarios || 0),
      recentes: (x, y) => String(y.publicado_em || "").localeCompare(String(x.publicado_em || "")) }[st.ordem];
    return l.sort(ord);
  }

  function montar(sec) {
    sec.innerHTML = `<div class="cr-pagina cr-pagina-larga bib">
      <header class="cr-cabeca cr-cabeca-linha"><div><h2>Biblioteca editorial</h2><p>Acompanhe perfis de referência, ache os posts que performaram muito acima da média e entenda a ideia, o ângulo, o gancho, a estrutura, o visual e o CTA de cada um.</p></div>
        <div class="cr-acoes-topo"><button class="btn btn-principal" type="button" id="bib-buscar"></button></div></header>
      <div class="bib-numeros" id="bib-numeros"></div>
      <div class="bib-perfis">
        <form class="bib-add" id="bib-add"><input class="entrada" id="bib-usuario" placeholder="@perfil ou link do Instagram / TikTok" aria-label="Perfil de referência"><button class="btn" type="submit">${ic.mais}Adicionar perfil</button></form>
        <div class="cr-chips" id="bib-chips"></div>
      </div>
      <div class="bib-barra">
        <div class="cr-busca bib-busca"><input type="search" id="bib-busca" placeholder="Buscar por perfil, legenda, ideia ou gancho..." aria-label="Buscar"></div>
        <select class="entrada" id="bib-tipo" aria-label="Mostrar"><option value="todos">Todos os posts</option><option value="curva">Só acima da média (2x ou mais)</option><option value="videos">Só Reels e vídeos</option></select>
        <select class="entrada" id="bib-ordem" aria-label="Ordenar"><option value="curva">Mais acima da média</option><option value="curtidas">Mais curtidos</option><option value="comentarios">Mais comentados</option><option value="recentes">Mais recentes</option></select>
      </div>
      <div id="bib-lista"></div>
    </div>`;
    $("#bib-buscar", sec).addEventListener("click", () => buscar());
    $("#bib-add", sec).addEventListener("submit", async (e) => {
      e.preventDefault();
      const u = usuarioLimpo($("#bib-usuario", sec).value);
      if (!u) { toast("Escreva o @ do perfil ou cole o link dele.", true); return; }
      if (st.perfis.some((p) => p.rede === u.rede && p.usuario === u.usuario)) { toast("Esse perfil já está na biblioteca."); return; }
      const { error } = await banco().from("biblioteca_perfis").insert(u);
      if (error) { toast("Não consegui salvar: " + error.message, true); return; }
      $("#bib-usuario", sec).value = "";
      await carregar(); pintar();
      buscar(u.usuario);
    });
    $("#bib-busca", sec).addEventListener("input", (e) => { st.busca = e.target.value; pintarLista(); });
    $("#bib-ordem", sec).addEventListener("change", (e) => { st.ordem = e.target.value; pintarLista(); });
    $("#bib-tipo", sec).addEventListener("change", (e) => { st.tipo = e.target.value; pintarLista(); });
  }

  function pintar() {
    const sec = document.getElementById("aba-" + ABA);
    if (!sec || !$("#bib-lista", sec)) return;
    const somar = (k) => st.posts.reduce((s, p) => s + (Number(p[k]) || 0), 0);
    $("#bib-numeros", sec).innerHTML = [["Perfis monitorados", st.perfis.length], ["Reels na biblioteca", st.posts.filter(ehVideo).length], ["Curtidas totais", fmtNum(somar("curtidas"))], ["Comentários totais", fmtNum(somar("comentarios"))]]
      .map(([t, n]) => `<div class="lab-num"><b>${n}</b><span>${t}</span></div>`).join("");
    const bt = $("#bib-buscar", sec);
    bt.disabled = st.buscando;
    bt.innerHTML = st.buscando ? `${ic.girar}Buscando posts…` : `${ic.girar}Atualizar posts`;
    const qtd = (u) => st.posts.filter((p) => p.perfil === u).length;
    $("#bib-chips", sec).innerHTML = `<button type="button" class="cr-chip${st.perfil === "todos" ? " ativo" : ""}" data-p="todos">Todos</button>` +
      st.perfis.map((p) => `<span class="cr-chip bib-chip${st.perfil === p.usuario ? " ativo" : ""}" data-p="${esc(p.usuario)}" role="button" tabindex="0">@${esc(p.usuario)}${p.rede === "tiktok" ? " · TikTok" : ""} <small>${p.run_id ? "buscando…" : qtd(p.usuario)}</small><button type="button" class="bib-tirar" data-tirar="${p.id}" aria-label="Tirar @${esc(p.usuario)}">${ic.x}</button></span>`).join("");
    $$("[data-p]", sec).forEach((b) => b.addEventListener("click", (e) => { if (e.target.closest("[data-tirar]")) return; st.perfil = b.dataset.p; pintar(); }));
    $$("[data-tirar]", sec).forEach((b) => b.addEventListener("click", async () => {
      const p = st.perfis.find((x) => String(x.id) === b.dataset.tirar);
      if (!p || !confirm(`Parar de acompanhar @${p.usuario}? Os posts dele saem da biblioteca.`)) return;
      await banco().from("biblioteca").delete().eq("rede", p.rede).eq("perfil", p.usuario);
      const { error } = await banco().from("biblioteca_perfis").delete().eq("id", p.id);
      if (error) { toast(error.message, true); return; }
      if (st.perfil === p.usuario) st.perfil = "todos";
      await carregar(); pintar();
    }));
    pintarLista();
  }

  function pintarLista() {
    const sec = document.getElementById("aba-" + ABA);
    const caixa = sec && $("#bib-lista", sec);
    if (!caixa) return;
    if (st.faltaTabela) { caixa.innerHTML = `<p class="faixa faixa-erro">As tabelas da Biblioteca editorial ainda não existem no banco.</p>`; return; }
    const lista = filtrados();
    if (!lista.length) {
      caixa.innerHTML = `<p class="cr-vazio">${ic.livro}${!st.perfis.length ? "Adicione perfis de referência para começar. O painel busca os últimos 30 posts de cada um." : st.buscando ? "Buscando os posts… eles aparecem aqui sozinhos." : st.posts.length ? "Nada nesse filtro." : "Clique em Atualizar posts para trazer os posts dos perfis."}</p>`;
      return;
    }
    caixa.innerHTML = `<div class="bib-grade">` + lista.slice(0, 200).map((p) => {
      const a = p.analise;
      const vezes = p._vezes >= 1.5 ? `<span class="bib-vezes${p._vezes >= 3 ? " forte" : ""}">${p._vezes.toFixed(1).replace(".", ",")}x a média</span>` : "";
      const primeira = String(p.legenda || "").split("\n").find((l) => l.trim()) || "";
      return `<article class="bib-card" data-id="${p.id}">
        <div class="bib-capa">${p.capa ? `<img src="${esc(p.capa)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}${ehVideo(p) ? `<span class="bib-play">${ic.play}</span>` : ""}${vezes}</div>
        <div class="bib-corpo">
          <div class="bib-topo"><b>@${esc(p.perfil)}</b><small>${esc(p.tipo || "")}${p.publicado_em ? " · " + fmtData(p.publicado_em) : ""}</small></div>
          <p class="bib-legenda">${esc(a && a.ideia ? a.ideia : primeira) || "<i>Sem legenda</i>"}</p>
          <div class="bib-metricas"><span>${ic.coracao}${fmtNum(p.curtidas)}</span><span>${ic.balao}${fmtNum(p.comentarios)}</span>${p.visualizacoes ? `<span>${ic.olho}${fmtNum(p.visualizacoes)}</span>` : ""}</div>
          <div class="bib-acoes"><a class="btn" href="${esc(p.link)}" target="_blank" rel="noopener">${ic.play}Ver ${ehVideo(p) ? "Reel" : "post"}</a>
            <button class="btn${a ? "" : " btn-principal"}" type="button" data-analise ${st.analisando.includes(p.id) ? "disabled" : ""}>${st.analisando.includes(p.id) ? "Analisando…" : a ? "Ver análise" : ic.brilho + "Analisar"}</button></div>
        </div>
      </article>`;
    }).join("") + `</div>` + (lista.length > 200 ? `<p class="cr-sub">Mostrando 200 de ${lista.length}. Use a busca ou os filtros.</p>` : "");
    $$(".bib-card", caixa).forEach((c) => $("[data-analise]", c).addEventListener("click", async () => {
      let p = st.posts.find((x) => String(x.id) === c.dataset.id);
      if (!p) return;
      if (!p.analise) p = await analisar(p);
      if (p && p.analise) abrir(p);
    }));
  }

  // ---------- janela da análise ----------
  let dlg = null;
  function abrir(p) {
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.className = "janela larga";
      document.body.appendChild(dlg);
      dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    }
    const a = p.analise || {};
    const bloco = (t, v) => v ? `<section class="lab-bloco"><small>${t}</small><p>${esc(v)}</p></section>` : "";
    dlg.innerHTML = `<div class="janela-cabeca"><div><small class="janela-sobretitulo">Biblioteca editorial</small><h2>@${esc(p.perfil)} · ${esc(p.tipo || "post")}</h2></div>
        <button class="icone-btn" type="button" data-fechar aria-label="Fechar">${ic.x}</button></div>
      <div class="janela-corpo lab-janela">
        <div class="bib-resumo"><span>${ic.coracao}${fmtNum(p.curtidas)} curtidas</span><span>${ic.balao}${fmtNum(p.comentarios)} comentários</span>${p.visualizacoes ? `<span>${ic.olho}${fmtNum(p.visualizacoes)} views</span>` : ""}${p._vezes ? `<span class="bib-vezes${p._vezes >= 3 ? " forte" : ""}">${p._vezes.toFixed(1).replace(".", ",")}x a média do perfil</span>` : ""}</div>
        ${a.por_que_saiu_da_curva ? `<section class="lab-bloco lab-destaque"><small>Por que saiu da curva</small><p>${esc(a.por_que_saiu_da_curva)}</p></section>` : ""}
        <div class="bib-tres">${bloco("Ideia", a.ideia)}${bloco("Ângulo", a.angulo)}${bloco("Gancho", a.gancho)}</div>
        ${a.estrutura && a.estrutura.length ? `<section class="lab-bloco"><small>Estrutura narrativa</small><ol class="bib-estrutura">${a.estrutura.map((e) => `<li><b>${esc(e.parte)}</b>${esc(e.texto)}</li>`).join("")}</ol></section>` : ""}
        <div class="bib-dois">${bloco("Composição visual", a.composicao_visual)}${bloco("CTA", a.cta)}</div>
        ${a.como_usar ? `<section class="lab-bloco lab-destaque"><small>Como usar no seu UGC</small><p>${esc(a.como_usar)}</p></section>` : ""}
        ${p.transcricao ? `<section class="lab-bloco"><small>O que a pessoa fala</small><p class="lab-texto">${esc(p.transcricao)}</p></section>` : ""}
        ${p.legenda ? `<section class="lab-bloco"><small>Legenda</small><p class="lab-texto">${esc(p.legenda)}</p></section>` : ""}
      </div>
      <div class="janela-rodape lab-rodape">
        <a class="btn" href="${esc(p.link)}" target="_blank" rel="noopener">${ic.play}Ver ${ehVideo(p) ? "Reel" : "post"}</a>
        <button class="btn" type="button" data-refazer>Analisar de novo</button>
        <span style="flex:1"></span>
        ${p.rede === "instagram" ? `<button class="btn" type="button" data-lab>Mandar para o Laboratório</button>` : ""}
        <button class="btn btn-principal" type="button" data-quadro>Mandar para Meus roteiros</button>
      </div>`;
    $("[data-fechar]", dlg).addEventListener("click", () => dlg.close());
    $("[data-refazer]", dlg).addEventListener("click", async (e) => { e.target.disabled = true; e.target.textContent = "Analisando…"; const n = await analisar(p); if (n) abrir(n); });
    const lab = $("[data-lab]", dlg);
    if (lab) lab.addEventListener("click", async () => {
      const codigo = (String(p.link).match(/\/(?:p|reel|reels|tv)\/([\w-]+)/) || [])[1] || p.post_id;
      const link = `https://www.instagram.com/${ehVideo(p) ? "reel" : "p"}/${codigo}/`;
      const { error } = await banco().from("laboratorio").upsert({ link, codigo, perfil: p.perfil, tipo: p.tipo, legenda: p.legenda, transcricao: p.transcricao || null, status: "novo", etapa: "Nova" }, { onConflict: "link", ignoreDuplicates: true });
      if (error) { toast("Não consegui mandar: " + error.message, true); return; }
      toast("Post mandado para o Laboratório criativo.");
    });
    $("[data-quadro]", dlg).addEventListener("click", async () => {
      if (!window.painelRoteiros || !window.painelRoteiros.salvarNoQuadro) { toast("Abra Meus roteiros uma vez e tente de novo.", true); return; }
      const conteudo = [a.gancho && "GANCHO (referência):\n" + a.gancho, a.ideia && "IDEIA:\n" + a.ideia, a.angulo && "ÂNGULO:\n" + a.angulo,
        a.estrutura && a.estrutura.length && "ESTRUTURA:\n" + a.estrutura.map((e, k) => `${k + 1}. ${e.parte}: ${e.texto}`).join("\n"),
        a.composicao_visual && "VISUAL:\n" + a.composicao_visual, a.cta && "CTA:\n" + a.cta, a.como_usar && "COMO USAR:\n" + a.como_usar, "REFERÊNCIA:\n" + p.link].filter(Boolean).join("\n\n");
      const ok = await window.painelRoteiros.salvarNoQuadro({ id: "bib" + p.id + "-" + Date.now().toString(36), titulo: a.ideia || "Referência de @" + p.perfil, plataforma: p.rede === "tiktok" ? "TikTok" : "Instagram", status: "Em aberto", finalidade: "Conteúdos", etapa: "Ideias", conteudo, gancho: a.gancho || "", formato: p.tipo || "", referencia: p.link, dataPublicacao: "" });
      if (ok) { dlg.close(); toast("Mandado para Meus roteiros (coluna Ideias)."); }
    });
    if (!dlg.open) dlg.showModal();
  }

  async function abrirAba() {
    const sec = document.getElementById("aba-" + ABA);
    if (!sec) return;
    if (!st.pronto) { montar(sec); st.pronto = true; }
    await carregar();
    pintar();
    // uma busca que ficou rodando (ela saiu da página antes de terminar)
    if (!st.buscando && st.perfis.some((p) => p.run_id)) { acompanhar(); pintar(); }
  }
  document.addEventListener("painel:aba", (e) => { if (e.detail === ABA) abrirAba(); });
  if (location.hash === "#" + ABA) setTimeout(abrirAba, 600);
})();
