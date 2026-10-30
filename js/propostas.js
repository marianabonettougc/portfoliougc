// =========================================================
// ORGANIZAÇÃO > PROPOSTAS (#propostas, out/2026)
// Uma tarefa agendada do Claude lê o Gmail dela todo dia de manhã (só leitura) e grava em propostas_email,
// já separando "proposta" (pessoa, agência ou marca), "plataforma" (Creators.llc, Conty, BrandLovers...) e
// "automatico" (sem trecho nem resumo, por privacidade). Aqui ela vê uma conversa por cartão (thread_id; o
// e-mail mais novo manda), responde no Gmail, vira job, salva a marca, marca "não é proposta" ou esconde o
// remetente para sempre (configuracoes "propostas_ocultar", que a tarefa respeita). Bolinha no menu = conversas
// de proposta não lidas (no item Marcas, onde Propostas é uma das abas do topo). Sem alert/confirm/prompt do navegador (painelDialogo).
// =========================================================
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const banco = () => window.banco;
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const dataCurta = (d) => { const x = new Date(d); return `${pad(x.getDate())}/${pad(x.getMonth() + 1)} ${pad(x.getHours())}:${pad(x.getMinutes())}`; };
  const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const ic = (d) => `<svg class="traco" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const IC = {
    responder: ic('<path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 6 6v1"/>'),
    job: ic('<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7"/>'),
    marca: ic('<path d="M4 12.5V5a1 1 0 0 1 1-1h7.5L20 11.5 12.5 19z"/><circle cx="8.5" cy="8.5" r="1.4"/>'),
    nao: ic('<circle cx="12" cy="12" r="8"/><path d="M6.5 6.5l11 11"/>'),
    abrir: ic('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>'),
    sim: ic('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    lapis: ic('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
    lixo: ic('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  };
  const ST_NOME = { nova: "Nova", respondida: "Respondida", contrato: "Virou job", marca_salva: "Marca salva", nao_proposta: "Não é proposta" };

  const st = { emails: [], sync: null, ocultar: [], busca: "", carregado: false, abertos: {} };
  const toast = (m, erro) => { const t = $("#toast"); if (!t) return; t.textContent = m; t.classList.toggle("erro", !!erro); t.classList.add("visivel"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("visivel"), 3200); };

  async function lerConfig(chave) {
    const { data } = await banco().from("configuracoes").select("valor").eq("chave", chave).maybeSingle();
    if (!data || !data.valor) return null;
    try { return JSON.parse(data.valor); } catch (e) { return null; }
  }
  async function gravarConfig(chave, valor) {
    const { error } = await banco().from("configuracoes").upsert({ chave, valor: JSON.stringify(valor), updated_at: new Date().toISOString() }, { onConflict: "chave" });
    if (error) throw error;
  }
  async function carregar() {
    const desde = new Date(Date.now() - 90 * 864e5).toISOString();
    const [r, sync, oc] = await Promise.all([
      banco().from("propostas_email").select("*").gte("recebido_em", desde).order("recebido_em", { ascending: false }).limit(1000),
      lerConfig("propostas_sync"), lerConfig("propostas_ocultar"),
    ]);
    if (r.error) throw r.error;
    st.emails = r.data || []; st.sync = sync;
    st.ocultar = Array.isArray(oc) ? oc : (oc && Array.isArray(oc.emails) ? oc.emails : []);
    st.carregado = true;
    pintarBolinha();
  }

  // Conversas: agrupa por thread_id; o e-mail mais novo manda no cartão
  function conversas(filtro) {
    const grupos = new Map();
    st.emails.filter(filtro).forEach((e) => { const k = e.thread_id || e.gmail_id; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(e); });
    return [...grupos.values()].map((l) => ({ chave: l[0].thread_id || l[0].gmail_id, topo: l[0], lista: l, naoLida: l.some((e) => !e.lida) }));
  }
  const ehProposta = (e) => e.tipo === "proposta" && e.status !== "nao_proposta";
  const ehPlataforma = (e) => e.tipo === "plataforma" && e.status !== "nao_proposta";
  function casaBusca(c) {
    if (!st.busca) return true;
    const q = semAcento(st.busca);
    return c.lista.some((e) => semAcento([e.de_nome, e.de_email, e.assunto, e.resumo, e.marca, e.plataforma, e.trecho].join(" ")).includes(q));
  }

  function pintarBolinha() {
    const b = $('.menu-item[data-aba="propostas"]') || $('.menu-item[data-aba="marcas"]'); if (!b) return;
    const n = conversas(ehProposta).filter((c) => c.naoLida).length;
    let s = b.querySelector(".pp-bolinha");
    if (!n) { if (s) s.remove(); return; }
    if (!s) { s = document.createElement("span"); s.className = "pp-bolinha"; b.appendChild(s); }
    s.textContent = n > 99 ? "99+" : String(n);
    s.title = n === 1 ? "1 conversa de proposta não lida" : `${n} conversas de proposta não lidas`;
  }

  function linhaSync() {
    const s = st.sync;
    if (s && s.erro) return `<span class="pp-sync erro">A última leitura falhou: ${esc(s.erro)}. Reconecte o Gmail no Claude.</span>`;
    if (s && s.em) return `<span class="pp-sync">Última leitura do e-mail: ${dataCurta(s.em)} · lê sozinho todo dia às 7h40</span>`;
    return `<span class="pp-sync">O e-mail ainda não foi lido · lê sozinho todo dia às 7h40</span>`;
  }
  const iniciais = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  function cartao(c, plataforma) {
    const e = c.topo;
    const tags = [
      e.marca ? `<span class="pp-tag">${esc(e.marca)}</span>` : "",
      plataforma && e.plataforma ? `<span class="pp-tag">${esc(e.plataforma)}</span>` : "",
      e.valor ? `<span class="pp-tag valor">${esc(e.valor)}</span>` : "",
      e.status && e.status !== "nova" ? `<span class="pp-tag st-${esc(e.status)}">${esc(ST_NOME[e.status] || e.status)}</span>` : "",
    ].join("");
    const bot = plataforma
      ? `<button class="btn btn-mini" data-acao="abrir">${IC.abrir}Abrir no e-mail</button>
         <button class="btn btn-mini" data-acao="eproposta">${IC.sim}É proposta</button>
         <button class="btn btn-mini" data-acao="naointeressa">${IC.nao}Não me interessa</button>`
      : `<button class="btn btn-mini btn-principal" data-acao="responder">${IC.responder}Responder</button>
         <button class="btn btn-mini" data-acao="job">${IC.job}Virar job</button>
         <button class="btn btn-mini" data-acao="marca">${IC.marca}Salvar marca</button>
         <button class="btn btn-mini" data-acao="naoproposta">${IC.nao}Não é proposta</button>`;
    return `<article class="pp-cartao${c.naoLida ? " nao-lida" : ""}" data-conversa="${esc(c.chave)}">
      <div class="pp-avatar" aria-hidden="true">${esc(iniciais(e.de_nome || e.de_email))}</div>
      <div class="pp-corpo">
        <div class="pp-linha1">${c.naoLida ? '<span class="pp-ponto" title="Não lida"></span>' : ""}<b>${esc(e.de_nome || e.de_email || "Sem nome")}</b><span class="pp-email">${esc(e.de_email || "")}</span><span class="pp-data">${dataCurta(e.recebido_em)}${c.lista.length > 1 ? ` · ${c.lista.length} e-mails` : ""}</span></div>
        <div class="pp-assunto">${esc(e.assunto || "(sem assunto)")}</div>
        ${e.resumo ? `<p class="pp-resumo">${esc(e.resumo)}</p>` : e.trecho ? `<p class="pp-resumo suave">${esc(e.trecho)}</p>` : ""}
        ${tags ? `<div class="pp-tags">${tags}</div>` : ""}
        <div class="pp-acoes">${bot}
          <button class="btn btn-mini" data-acao="editar" title="Editar">${IC.lapis}Editar</button>
          <button class="btn btn-mini btn-perigo" data-acao="excluir" title="Excluir do painel">${IC.lixo}Excluir</button>
        </div>
        ${e.de_email ? `<button class="pp-link" data-acao="esconder">esconder sempre ${esc(e.de_email)}</button>` : ""}
      </div>
    </article>`;
  }

  function pintar() {
    const sec = $("#aba-propostas"); if (!sec) return;
    if (!st.carregado) { sec.innerHTML = `<p class="pp-vazio">Carregando os e-mails…</p>`; return; }
    const props = conversas(ehProposta).filter(casaBusca);
    const plats = conversas(ehPlataforma).filter(casaBusca);
    const autos = st.emails.filter((e) => e.tipo === "automatico" && e.status !== "nao_proposta").filter((e) => casaBusca({ lista: [e] }));
    const naos = st.emails.filter((e) => e.status === "nao_proposta").filter((e) => casaBusca({ lista: [e] }));
    const naoLidas = conversas(ehProposta).filter((c) => c.naoLida).length;
    const linhaMini = (e, acao, texto) => `<li data-email="${e.id}"><span class="pp-mini-de">${esc(e.de_nome || e.de_email || "")}</span><span class="pp-mini-ass">${esc(e.assunto || "")}</span><span class="pp-mini-data">${dataCurta(e.recebido_em)}</span><button class="pp-link" data-mini="${acao}">${texto}</button></li>`;
    sec.innerHTML = `
      <div class="pp-topo">
        <input class="pp-busca" type="search" id="pp-busca" placeholder="Filtrar (ex.: nome da marca)" value="${esc(st.busca)}">
        ${linhaSync()}
      </div>
      <section class="pp-bloco">
        <h2 class="pp-titulo">Propostas</h2>
        <p class="pp-sub">${props.length} ${props.length === 1 ? "conversa escrita por pessoas" : "conversas escritas por pessoas"} nos últimos 90 dias · ${naoLidas} ${naoLidas === 1 ? "não lida" : "não lidas"}</p>
        <div class="pp-lista">${props.map((c) => cartao(c, false)).join("") || `<p class="pp-vazio">Nenhuma proposta${st.busca ? " com esse filtro" : " por enquanto"}.</p>`}</div>
      </section>
      <section class="pp-bloco">
        <h2 class="pp-titulo">Oportunidades em plataformas</h2>
        <p class="pp-sub">Creators.llc, Creatify, Conty, BrandLovers e parecidas · ${plats.length} ${plats.length === 1 ? "conversa" : "conversas"}</p>
        <div class="pp-lista">${plats.map((c) => cartao(c, true)).join("") || `<p class="pp-vazio">Nada de plataforma${st.busca ? " com esse filtro" : " por enquanto"}.</p>`}</div>
      </section>
      <details class="pp-dobra" ${st.abertos.auto ? "open" : ""} data-dobra="auto"><summary>E-mails automáticos (${autos.length})</summary>
        <ul class="pp-mini">${autos.map((e) => linhaMini(e, "eproposta", "é proposta")).join("") || "<li class='pp-vazio'>Nenhum.</li>"}</ul></details>
      <details class="pp-dobra" ${st.abertos.nao ? "open" : ""} data-dobra="nao"><summary>Marcados como não é proposta (${naos.length})</summary>
        <ul class="pp-mini">${naos.map((e) => linhaMini(e, "voltar", "voltar")).join("") || "<li class='pp-vazio'>Nenhum.</li>"}</ul></details>
      ${st.ocultar.length ? `<div class="pp-ocultos"><span>Escondidos sempre:</span>${st.ocultar.map((m) => `<span class="pp-chip">${esc(m)}<button type="button" data-desocultar="${esc(m)}" aria-label="Voltar a mostrar ${esc(m)}">×</button></span>`).join("")}</div>` : ""}`;
    ligar(sec);
  }

  function ligar(sec) {
    const busca = $("#pp-busca", sec);
    busca.addEventListener("input", () => { st.busca = busca.value; const pos = busca.selectionStart; pintar(); const n = $("#pp-busca"); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* campo search */ } });
    $$("[data-dobra]", sec).forEach((d) => d.addEventListener("toggle", () => { st.abertos[d.dataset.dobra] = d.open; }));
    $$(".pp-cartao [data-acao]", sec).forEach((b) => b.addEventListener("click", () => {
      const chave = b.closest("[data-conversa]").dataset.conversa;
      const lista = st.emails.filter((e) => (e.thread_id || e.gmail_id) === chave);
      acao(b.dataset.acao, lista).catch((er) => toast("Não deu certo: " + (er.message || er), true));
    }));
    $$("[data-mini]", sec).forEach((b) => b.addEventListener("click", async () => {
      const e = st.emails.find((x) => String(x.id) === b.closest("[data-email]").dataset.email); if (!e) return;
      try {
        if (b.dataset.mini === "eproposta") { await mudar([e], { tipo: "proposta", status: "nova" }); toast("Foi para Propostas."); }
        else { await mudar([e], { status: "nova" }); toast("Voltou para a lista."); }
        pintar();
      } catch (er) { toast("Não deu certo: " + er.message, true); }
    }));
    $$("[data-desocultar]", sec).forEach((b) => b.addEventListener("click", async () => {
      try { st.ocultar = st.ocultar.filter((m) => m !== b.dataset.desocultar); await gravarConfig("propostas_ocultar", st.ocultar); pintar(); toast("Esse remetente volta a aparecer nas próximas leituras."); }
      catch (er) { toast("Não deu certo: " + er.message, true); }
    }));
  }

  async function mudar(lista, campos) {
    const ids = lista.map((e) => e.id);
    const { error } = await banco().from("propostas_email").update({ ...campos, atualizado_em: new Date().toISOString() }).in("id", ids);
    if (error) throw error;
    lista.forEach((e) => Object.assign(e, campos));
    pintarBolinha();
  }
  const gmail = (e) => `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(e.thread_id || e.gmail_id)}`;

  async function acao(qual, lista) {
    const e = lista[0], D = window.painelDialogo;
    if (qual === "responder" || qual === "abrir") {
      window.open(gmail(e), "_blank", "noopener");
      await mudar(lista, qual === "responder" && e.status === "nova" ? { lida: true, status: "respondida" } : { lida: true });
    } else if (qual === "job") {
      const marca = await D.texto("Nome da marca para o job novo:", e.marca || e.de_nome || "");
      if (marca == null || !marca.trim()) return;
      const briefing = [`Veio do e-mail: ${e.assunto || ""}`, e.resumo ? `Resumo: ${e.resumo}` : "", e.trecho ? `Trecho: ${e.trecho}` : "", `Quem mandou: ${e.de_nome || ""} <${e.de_email || ""}>`, `Recebido em: ${dataCurta(e.recebido_em)}`].filter(Boolean).join("\n");
      try { localStorage.setItem("novoJobPendente", JSON.stringify({ marca: marca.trim(), briefing, quando: Date.now() })); } catch (er) { toast("O navegador não deixou guardar o job. Crie em UGC's & Publis.", true); return; }
      await mudar(lista, { status: "contrato", lida: true, marca: marca.trim() });
      location.hash = "#campanhas";
      [500, 1500, 3000].forEach((ms) => setTimeout(() => { const f = document.querySelector("#aba-gestao iframe"); if (f && f.contentWindow) f.contentWindow.postMessage({ novoJobPendente: true }, location.origin); }, ms));
      return;
    } else if (qual === "marca") {
      const nome = await D.texto("Nome da marca para salvar em Marcas:", e.marca || e.de_nome || "");
      if (nome == null || !nome.trim()) return;
      const { data: ja } = await banco().from("marcas").select("id").ilike("nome", nome.trim()).limit(1);
      if (!ja || !ja.length) {
        const { error } = await banco().from("marcas").insert({ nome: nome.trim(), email: e.de_email || null, situacao: "conversando", obs: "Veio do e-mail: " + (e.assunto || ""), ultimo_contato: hojeISO() });
        if (error) throw error;
        toast(`${nome.trim()} foi salva em Marcas.`);
      } else toast(`${nome.trim()} já estava em Marcas.`);
      await mudar(lista, { status: "marca_salva", marca: nome.trim() });
    } else if (qual === "naoproposta") {
      await mudar(lista, { status: "nao_proposta", lida: true });
      toast("Pronto. Os próximos e-mails desse remetente entram como automáticos.");
    } else if (qual === "eproposta") {
      await mudar(lista, { tipo: "proposta" }); toast("Foi para Propostas.");
    } else if (qual === "naointeressa") {
      await mudar(lista, { tipo: "automatico", lida: true }); toast("Foi para os automáticos.");
    } else if (qual === "esconder") {
      const m = (e.de_email || "").toLowerCase(); if (!m) return;
      if (!(await D.confirmar(`Esconder sempre os e-mails de ${m}? Eles passam a entrar como automáticos. Dá para desfazer no fim da página.`, { ok: "Esconder sempre" }))) return;
      if (!st.ocultar.includes(m)) st.ocultar = [...st.ocultar, m];
      await gravarConfig("propostas_ocultar", st.ocultar);
      const dele = st.emails.filter((x) => (x.de_email || "").toLowerCase() === m);
      await mudar(dele, { tipo: "automatico" });
      toast(`${m} fica escondido.`);
    } else if (qual === "editar") {
      await editar(lista); return;
    } else if (qual === "excluir") {
      if (!(await D.confirmar(`Tirar essa conversa do painel? (${lista.length === 1 ? "1 e-mail" : lista.length + " e-mails"}). Nada muda no seu Gmail.`, { ok: "Excluir", perigo: true }))) return;
      const { error } = await banco().from("propostas_email").delete().in("id", lista.map((x) => x.id));
      if (error) throw error;
      const ids = new Set(lista.map((x) => x.id)); st.emails = st.emails.filter((x) => !ids.has(x.id)); pintarBolinha();
      toast("Conversa excluída do painel.");
    }
    pintar();
  }

  // Editar: janela própria (dialog) com marca, valor, resumo, tipo e status
  function editar(lista) {
    const e = lista[0];
    return new Promise((res) => {
      const d = document.createElement("dialog"); d.className = "janela pp-janela";
      const opc = (v, l, atual) => `<option value="${v}"${v === atual ? " selected" : ""}>${l}</option>`;
      d.innerHTML = `<form method="dialog"><div class="janela-cabeca"><h2>Editar conversa</h2></div>
        <div class="janela-corpo pp-form">
          <label>Marca<input name="marca" value="${esc(e.marca || "")}"></label>
          <label>Valor<input name="valor" value="${esc(e.valor || "")}" placeholder="ex.: R$ 800"></label>
          <label>Resumo<textarea name="resumo" rows="3">${esc(e.resumo || "")}</textarea></label>
          <label>Tipo<select name="tipo">${opc("proposta", "Proposta", e.tipo)}${opc("plataforma", "Plataforma", e.tipo)}${opc("automatico", "Automático", e.tipo)}</select></label>
          <label>Status<select name="status">${Object.keys(ST_NOME).map((k) => opc(k, ST_NOME[k], e.status)).join("")}</select></label>
          <label class="pp-check"><input type="checkbox" name="lida" ${lista.every((x) => x.lida) ? "checked" : ""}> Já li</label>
        </div>
        <div class="janela-rodape"><button class="btn" value="cancelar" type="button" data-fechar>Cancelar</button><button class="btn btn-principal" type="submit">Salvar</button></div></form>`;
      document.body.appendChild(d);
      d.querySelector("[data-fechar]").onclick = () => d.close();
      d.addEventListener("close", () => { d.remove(); res(); });
      d.querySelector("form").addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        try {
          await mudar([e], { marca: fd.get("marca").trim() || null, valor: fd.get("valor").trim() || null, resumo: fd.get("resumo").trim() || null });
          await mudar(lista, { tipo: fd.get("tipo"), status: fd.get("status"), lida: fd.get("lida") === "on" });
          d.close(); pintar(); toast("Salvo.");
        } catch (er) { toast("Não salvou: " + er.message, true); }
      });
      d.showModal();
    });
  }

  async function abrir() {
    try { if (!st.carregado) pintar(); await carregar(); pintar(); }
    catch (er) { const sec = $("#aba-propostas"); if (sec) sec.innerHTML = `<p class="pp-vazio">Não consegui ler as propostas: ${esc(er.message)}</p>`; }
  }
  let abaAtual = "";
  document.addEventListener("painel:aba", (e) => { abaAtual = e.detail; if (e.detail === "propostas") abrir(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && abaAtual === "propostas") abrir(); });
  // bolinha do menu: lê ao entrar no painel e de 10 em 10 minutos
  function bolinhaDepois(ms) { setTimeout(async () => { try { if (window.banco && abaAtual !== "propostas") await carregar(); } catch (er) { /* sem login ainda */ } bolinhaDepois(10 * 60 * 1000); }, ms); }
  bolinhaDepois(2500);
  const h0 = location.hash.replace("#", ""); if (h0 === "propostas") setTimeout(() => document.dispatchEvent(new CustomEvent("painel:aba", { detail: "propostas" })), 700);
  window.painelPropostas = { carregar, pintar, st };
})();
