// =========================================================
// ABA "📜 Roteiros" (hash #transcritos)
// Transcreve vídeos do Instagram, TikTok e YouTube pela Supadata,
// chamada direto do navegador, e guarda tudo na tabela roteiros.
// A chave da Supadata NÃO fica em arquivo: ela é colada no painel e
// guardada na tabela configuracoes (só a dona lê e grava).
// O painel avisa esta aba pelo evento "painel:aba" (js/admin.js, mostrarAba).
// =========================================================
(function () {
  "use strict";

  const ABA = "transcritos";
  const API = "https://api.supadata.ai/v1";
  const CHAVE_CONFIG = "supadata_api_key";
  const ESPERA_MAX = 6 * 60 * 1000;

  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
  const tempoTxt = (s) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}min${s % 60 ? " " + String(s % 60).padStart(2, "0") + "s" : ""}`);
  const fmtData = (iso) => { if (!iso) return ""; const d = new Date(String(iso).length <= 10 ? iso + "T12:00:00" : iso); return isNaN(d) ? "" : d.toLocaleDateString("pt-BR"); };

  // ---------- estado ----------
  const st = {
    pronto: false,
    sec: null,
    lista: [],
    chave: "",
    saldo: null,
    filtro: "todos",
    busca: "",
    deQuem: "outra",
    emAndamento: new Set(),
    tocando: new Set(),
    faltaSql: false
  };

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

  // =========================================================
  // LINKS
  // =========================================================
  function limparLink(bruto) {
    let t = String(bruto || "").trim();
    if (!t) return "";
    if (!/^https?:\/\//i.test(t) && /^(www\.|m\.|vm\.|vt\.)?(instagram|tiktok|youtube|youtu)\./i.test(t)) t = "https://" + t;
    let u;
    try { u = new URL(t); } catch (e) { return t; }
    u.hash = "";
    u.pathname = u.pathname.replace(/\/reels\//i, "/reel/");
    const tira = [];
    u.searchParams.forEach((_, k) => { if (/^(igsh|igshid|utm_.*|si|feature|is_from_webapp|sender_device|_r|_t)$/i.test(k)) tira.push(k); });
    tira.forEach((k) => u.searchParams.delete(k));
    if (/instagram\.com$/i.test(u.hostname)) u.search = "";
    return u.toString();
  }
  function fonteDoLink(link) {
    const h = (() => { try { return new URL(link).hostname.toLowerCase(); } catch (e) { return ""; } })();
    if (/instagram\.com$/.test(h)) return "instagram";
    if (/tiktok\.com$/.test(h)) return "tiktok";
    if (/(youtube\.com|youtu\.be)$/.test(h)) return "youtube";
    return "outro";
  }
  function perfilDoLink(link) {
    let m = String(link).match(/instagram\.com\/([A-Za-z0-9_.]+)\/(?:reel|p|tv)\//i);
    if (m && !/^(reel|reels|p|tv|stories)$/i.test(m[1])) return "@" + m[1];
    m = String(link).match(/tiktok\.com\/@([A-Za-z0-9_.]+)/i);
    if (m) return "@" + m[1];
    m = String(link).match(/youtube\.com\/@([A-Za-z0-9_.-]+)/i);
    if (m) return "@" + m[1];
    return "";
  }
  const idYoutube = (l) => { const m = String(l || "").match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/); return m ? m[1] : null; };
  function embedDoLink(link) {
    const l = String(link || "");
    let m = l.match(/instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
    if (m) return { src: `https://www.instagram.com/reel/${m[1]}/embed`, tipo: "instagram" };
    const yt = idYoutube(l);
    if (yt) return { src: `https://www.youtube.com/embed/${yt}`, tipo: "youtube" };
    m = l.match(/tiktok\.com\/.*\/video\/(\d+)/i) || l.match(/tiktok\.com\/embed\/v2\/(\d+)/i);
    if (m) return { src: `https://www.tiktok.com/embed/v2/${m[1]}`, tipo: "tiktok" };
    return null;
  }
  const NOME_FONTE = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", outro: "Escrito na mão" };
  const EMOJI_FONTE = { instagram: "📸", tiktok: "🎵", youtube: "▶️", outro: "✍️" };

  // =========================================================
  // BANCO
  // =========================================================
  const banco = () => window.banco;
  function erroBanco(err) {
    const msg = String((err && (err.message || err.details)) || "");
    const cod = String((err && err.code) || "");
    if (cod === "42P01" || cod === "PGRST205" || cod === "42703" || cod === "PGRST204" || /column|does not exist|could not find/i.test(msg)) {
      st.faltaSql = true;
      return "Falta rodar o arquivo sql-roteiros.sql no Supabase (SQL Editor). Depois é só recarregar esta página.";
    }
    if (cod === "42501" || /row-level security|permission/i.test(msg)) return "O banco não deixou gravar. Confira se você entrou com o seu e-mail.";
    if (/fetch|network|failed/i.test(msg)) return "Sem conexão com o banco. Confira sua internet e tente de novo.";
    return "Não consegui salvar no banco agora. Tente de novo em instantes.";
  }
  async function carregarLista() {
    const { data, error } = await banco().from("roteiros").select("*").order("criado_em", { ascending: false }).limit(500);
    if (error) { aviso("erro", erroBanco(error)); st.lista = []; return; }
    st.lista = data || [];
  }
  async function carregarChave() {
    const { data, error } = await banco().from("configuracoes").select("valor").eq("chave", CHAVE_CONFIG).maybeSingle();
    if (error) { st.chave = ""; if (/configuracoes/.test(error.message || "") || error.code === "PGRST205" || error.code === "42P01") st.faltaSql = true; return; }
    st.chave = (data && data.valor) || "";
  }
  async function salvarChave(valor) {
    const { error } = await banco().from("configuracoes").upsert({ chave: CHAVE_CONFIG, valor, updated_at: new Date().toISOString() }, { onConflict: "chave" });
    if (error) throw new Error(erroBanco(error));
    st.chave = valor;
  }
  async function inserir(linha) {
    let { data, error } = await banco().from("roteiros").insert(linha).select().single();
    if (error) throw new Error(erroBanco(error));
    st.lista.unshift(data);
    return data;
  }
  async function atualizar(id, linha) {
    const { data, error } = await banco().from("roteiros").update(linha).eq("id", id).select().single();
    if (error) throw new Error(erroBanco(error));
    const i = st.lista.findIndex((r) => r.id === id);
    if (i >= 0) st.lista[i] = data; else st.lista.unshift(data);
    return data;
  }
  async function remover(id) {
    const { error } = await banco().from("roteiros").delete().eq("id", id);
    if (error) throw new Error(erroBanco(error));
    st.lista = st.lista.filter((r) => r.id !== id);
  }

  // =========================================================
  // SUPADATA
  // =========================================================
  class ErroSupa extends Error {
    constructor(tipo, texto) { super(texto); this.tipo = tipo; }
  }
  function traduzSupa(status, corpo) {
    const codigo = String((corpo && (corpo.error || corpo.code)) || "").toLowerCase();
    const detalhe = String((corpo && (corpo.details || corpo.message)) || "");
    if (codigo === "limit-exceeded" || status === 429) {
      if (/plan usage/i.test(detalhe)) return new ErroSupa("cota", "Acabaram os créditos do mês na Supadata. Eles voltam quando o plano renovar (ou dá pra mudar de plano no site deles).");
      if (/rate limit/i.test(detalhe)) return new ErroSupa("pressa", "Foram muitos pedidos seguidos. Espera 1 minuto e tenta de novo.");
      return new ErroSupa("pressa", "A Supadata pediu uma pausa. Espera 1 minuto e tenta de novo.");
    }
    if (status === 401 || status === 403 || codigo === "unauthorized" || codigo === "invalid-api-key")
      return new ErroSupa("chave", "A chave da Supadata não foi aceita. Confira se copiou ela inteira e salve de novo.");
    if (codigo === "upgrade-required" || status === 402)
      return new ErroSupa("cota", "Esse tipo de vídeo não entra no plano grátis da Supadata.");
    if (codigo === "transcript-unavailable" || status === 206)
      return new ErroSupa("vazio", "Não achei fala nesse vídeo. Costuma ser reel só com música ou só com texto na tela.");
    if (codigo === "not-found" || status === 404)
      return new ErroSupa("link", "Não achei esse vídeo. Ele pode ser privado, de conta fechada ou ter sido apagado.");
    if (codigo === "invalid-request" || status === 400)
      return new ErroSupa("link", "Esse link não parece ser de um vídeo que dá pra transcrever. Confira se copiou o link do vídeo (e não do perfil).");
    return new ErroSupa("outro", "A Supadata não conseguiu transcrever agora. Tente de novo daqui a pouco.");
  }
  async function chamar(caminho, sinal) {
    let r;
    try {
      r = await fetch(API + caminho, { headers: { "x-api-key": st.chave }, signal: sinal });
    } catch (e) {
      if (e && e.name === "AbortError") throw new ErroSupa("tempo", "Demorou demais e eu parei de esperar. Tente de novo mais tarde.");
      throw new ErroSupa("rede", "Não consegui falar com o serviço de transcrição. Confira sua internet e tente de novo.");
    }
    let corpo = null;
    try { corpo = await r.json(); } catch (e) { corpo = null; }
    return { status: r.status, corpo };
  }
  function textoDoConteudo(content) {
    if (Array.isArray(content)) {
      const segmentos = content.map((s) => ({ ini: Math.round(Number(s.offset || 0) / 100) / 10, texto: String(s.text || "").trim() })).filter((s) => s.texto);
      return { texto: segmentos.map((s) => s.texto).join(" ").replace(/\s+/g, " ").trim(), segmentos };
    }
    return { texto: String(content || "").trim(), segmentos: null };
  }
  async function transcreverNaSupadata(link, aoEsperar) {
    const ctrl = new AbortController();
    const inicio = Date.now();
    const limite = setTimeout(() => ctrl.abort(), ESPERA_MAX);
    try {
      const q = new URLSearchParams({ url: link, mode: "auto", text: "true", lang: "pt" });
      let { status, corpo } = await chamar("/transcript?" + q.toString(), ctrl.signal);
      if (status === 202 && corpo && corpo.jobId) {
        const job = corpo.jobId;
        while (true) {
          if (Date.now() - inicio > ESPERA_MAX) throw new ErroSupa("tempo", "Passou de 6 minutos e o vídeo ainda não ficou pronto. Tente de novo mais tarde.");
          await dorme(5000);
          if (aoEsperar) aoEsperar();
          const res = await chamar("/transcript/" + encodeURIComponent(job), ctrl.signal);
          if (res.status >= 400 && res.status !== 404) throw traduzSupa(res.status, res.corpo);
          const s = String((res.corpo && res.corpo.status) || "").toLowerCase();
          if (s === "completed") { corpo = res.corpo; status = 200; break; }
          if (s === "failed") {
            const e = res.corpo && res.corpo.error;
            throw traduzSupa(400, typeof e === "object" ? e : { error: e || "falhou" });
          }
        }
      }
      if (status !== 200) throw traduzSupa(status, corpo);
      const lang = String((corpo && corpo.lang) || "").toLowerCase();
      const { texto, segmentos } = textoDoConteudo(corpo && corpo.content);
      if (!texto || lang === "none") throw new ErroSupa("vazio", "Não achei fala nesse vídeo. Costuma ser reel só com música ou só com texto na tela.");
      return { texto, segmentos };
    } finally {
      clearTimeout(limite);
    }
  }
  async function buscarSaldo() {
    if (!st.chave) { st.saldo = null; return; }
    try {
      const { status, corpo } = await chamar("/me");
      if (status === 200 && corpo) st.saldo = { plano: corpo.plan, max: Number(corpo.maxCredits) || 0, usado: Number(corpo.usedCredits) || 0 };
      else st.saldo = { erro: traduzSupa(status, corpo).message };
    } catch (e) { st.saldo = { erro: e.message }; }
    pintarChave();
  }

  // =========================================================
  // TELA
  // =========================================================
  function montar() {
    const sec = st.sec;
    sec.innerHTML = `
    <div class="rs-pagina">
      <div class="rs-cabeca">
        <div>
          <h2>📜 Roteiros</h2>
          <p>Cole o link de um reel e eu transcrevo. Serve pros seus e pros das outras, com etiqueta pra você separar.</p>
        </div>
        <button type="button" class="btn" id="rs-estudar">🧠 Estudar com o Claude</button>
      </div>

      <div class="rs-caixa">
        <div class="rs-linha">
          <input class="entrada rs-link" id="rs-link" type="url" inputmode="url" autocomplete="off"
            placeholder="Cole aqui: instagram.com/reel/... · tiktok.com/... · youtube.com/..." aria-label="Link do vídeo">
          <select class="entrada rs-quem" id="rs-quem" aria-label="De quem é o vídeo">
            <option value="outra">De outra pessoa</option>
            <option value="meu">Meu</option>
          </select>
          <button type="button" class="btn btn-principal" id="rs-transcrever">🎧 Transcrever</button>
          <button type="button" class="btn" id="rs-manual">+ Escrever na mão</button>
        </div>
        <div id="rs-aviso" class="rs-aviso" aria-live="polite" hidden></div>
        <div class="rs-chave" id="rs-chave"></div>
      </div>

      <div class="rs-biblio-cabeca">
        <h3>📚 Biblioteca</h3>
        <span class="rs-conta" id="rs-conta"></span>
      </div>
      <div class="cr-busca rs-busca">
        <svg class="traco" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>
        <input type="search" id="rs-busca" placeholder="Buscar na transcrição, no perfil, no título ou nas notas" aria-label="Buscar">
      </div>
      <div class="cr-chips rs-chips" id="rs-chips"></div>
      <div class="rs-lista" id="rs-lista"></div>
    </div>`;

    $("#rs-quem", sec).value = st.deQuem;
    $("#rs-quem", sec).addEventListener("change", (e) => { st.deQuem = e.target.value; });
    $("#rs-link", sec).addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); clicouTranscrever(); } });
    $("#rs-transcrever", sec).addEventListener("click", clicouTranscrever);
    $("#rs-manual", sec).addEventListener("click", () => abrirEditor(null, { de_quem: st.deQuem }));
    $("#rs-estudar", sec).addEventListener("click", estudarComClaude);
    $("#rs-busca", sec).addEventListener("input", (e) => { st.busca = e.target.value; pintarLista(); });
  }

  function aviso(tipo, html, botoes) {
    const a = st.sec && $("#rs-aviso", st.sec);
    if (!a) return;
    if (!tipo) { a.hidden = true; a.innerHTML = ""; return; }
    a.hidden = false;
    a.className = "rs-aviso rs-aviso-" + tipo;
    a.innerHTML = `<div class="rs-aviso-txt">${html}</div>` + (botoes && botoes.length ? `<div class="rs-aviso-botoes">${botoes.map((b, i) => `<button type="button" class="btn btn-mini" data-av="${i}">${b.texto}</button>`).join("")}</div>` : "");
    (botoes || []).forEach((b, i) => $(`[data-av="${i}"]`, a).addEventListener("click", b.acao));
  }

  function pintarChave() {
    const box = st.sec && $("#rs-chave", st.sec);
    if (!box) return;
    const fim = st.chave ? st.chave.slice(-4) : "";
    let saldo = "";
    if (st.chave && st.saldo && !st.saldo.erro) {
      const pct = st.saldo.max ? Math.min(100, Math.round((st.saldo.usado / st.saldo.max) * 100)) : 0;
      saldo = `<span class="rs-saldo" title="Plano ${esc(st.saldo.plano || "")}"><span class="rs-barra"><i style="width:${pct}%"></i></span>${st.saldo.usado} de ${st.saldo.max} créditos usados</span>`;
    } else if (st.chave && st.saldo && st.saldo.erro) {
      saldo = `<span class="rs-saldo rs-saldo-erro">${esc(st.saldo.erro)}</span>`;
    } else if (st.chave) {
      saldo = `<span class="rs-saldo">conferindo o saldo…</span>`;
    }
    box.innerHTML = `
      <label for="rs-chave-campo">🔑 Chave da Supadata</label>
      <div class="rs-chave-linha">
        <input class="entrada" id="rs-chave-campo" type="password" autocomplete="off" spellcheck="false"
          placeholder="${st.chave ? "Salva: termina em " + esc(fim) + " (cole outra pra trocar)" : "Cole aqui a sua API key da Supadata"}">
        <button type="button" class="btn" id="rs-chave-salvar">💾 Salvar</button>
        ${saldo}
      </div>`;
    const campo = $("#rs-chave-campo", box);
    const salvar = async () => {
      const v = campo.value.trim();
      if (!v) { toast("Cole a chave antes de salvar.", true); campo.focus(); return; }
      if (v.length < 12 || /\s/.test(v)) { toast("Essa chave parece incompleta. Copie de novo no site da Supadata.", true); return; }
      try {
        await salvarChave(v);
        toast("Chave salva ✓");
        aviso(null);
        st.saldo = null;
        pintarChave();
        buscarSaldo();
      } catch (e) { toast(e.message, true); }
    };
    $("#rs-chave-salvar", box).addEventListener("click", salvar);
    campo.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); salvar(); } });
  }

  function explicarChave() {
    aviso("aviso", `<b>🔑 Falta a chave da Supadata.</b> É de graça e leva 2 minutos:
      <ol class="rs-passos">
        <li>Crie uma conta grátis em <a href="https://supadata.ai" target="_blank" rel="noopener">supadata.ai</a> (100 créditos por mês, sem cartão).</li>
        <li>No painel deles, copie a sua <b>API key</b>.</li>
        <li>Cole no campo <b>Chave da Supadata</b> aqui embaixo e clique em Salvar.</li>
      </ol>`);
    const c = $("#rs-chave-campo", st.sec);
    if (c) { c.focus(); c.closest(".rs-chave").classList.add("rs-pisca"); setTimeout(() => c.closest(".rs-chave") && c.closest(".rs-chave").classList.remove("rs-pisca"), 1600); }
  }

  // ---------- filtros e lista ----------
  const tagsDe = (r) => String(r.etiquetas || "").split(",").map((t) => t.trim()).filter(Boolean);
  function filtrados() {
    const b = st.busca.trim().toLowerCase();
    return st.lista.filter((r) => {
      if (st.filtro === "meu" && r.de_quem !== "meu") return false;
      if (st.filtro === "outra" && r.de_quem === "meu") return false;
      if (st.filtro.startsWith("tag:") && !tagsDe(r).map((t) => t.toLowerCase()).includes(st.filtro.slice(4))) return false;
      if (b) {
        const alvo = [r.transcricao, r.perfil, r.titulo, r.notas, r.legenda].join(" ").toLowerCase();
        if (!alvo.includes(b)) return false;
      }
      return true;
    });
  }
  function pintarChips() {
    const box = $("#rs-chips", st.sec);
    const tags = [...new Set(st.lista.flatMap(tagsDe).map((t) => t.toLowerCase()))].sort();
    const chips = [{ v: "todos", t: "Todos" }, { v: "meu", t: "💛 Meus" }, { v: "outra", t: "👀 De outras" }, ...tags.map((t) => ({ v: "tag:" + t, t: "#" + t }))];
    if (!chips.some((c) => c.v === st.filtro)) st.filtro = "todos";
    box.innerHTML = chips.map((c) => `<button type="button" class="cr-chip${st.filtro === c.v ? " ativo" : ""}" data-f="${esc(c.v)}">${esc(c.t)}</button>`).join("");
    $$("[data-f]", box).forEach((b) => b.addEventListener("click", () => { st.filtro = b.dataset.f; pintarChips(); pintarLista(); }));
  }
  function capaHtml(r) {
    const fonte = r.origem || "outro";
    const emb = embedDoLink(r.link);
    if (st.tocando.has(r.id) && emb) {
      return `<div class="rs-capa rs-tocando rs-${emb.tipo}"><iframe src="${esc(emb.src)}" title="Vídeo" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; clipboard-write" allowfullscreen></iframe></div>`;
    }
    const yt = idYoutube(r.link);
    let img = "";
    if (yt) img = `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
    else if (r.capa && !/cdninstagram|fbcdn|tiktokcdn/i.test(r.capa)) img = r.capa;
    const fundo = img ? `<img src="${esc(img)}" alt="" loading="lazy" onerror="this.remove()">` : `<span class="rs-capa-emoji">${EMOJI_FONTE[fonte] || "🎬"}</span>`;
    const botao = emb ? `<button type="button" class="rs-ver" data-ver="${esc(r.id)}">▶ ver vídeo</button>`
      : r.link ? `<a class="rs-ver" href="${esc(r.link)}" target="_blank" rel="noopener">↗ abrir link</a>` : "";
    return `<div class="rs-capa rs-capa-${esc(fonte)}">${fundo}${botao}</div>`;
  }
  function cardHtml(r) {
    const status = r.status || "pronto";
    const meu = r.de_quem === "meu";
    const linhas = String(r.transcricao || "").split(/(?<=[.!?])\s+|\n+/).filter(Boolean).slice(0, 3).join(" ");
    const tags = tagsDe(r).map((t) => `<span class="rs-tag">#${esc(t)}</span>`).join("");
    const ativo = st.emAndamento.has(r.id);
    let corpo;
    if (status === "processando") {
      corpo = `<div class="rs-estado rs-estado-proc"><span class="rs-relogio" aria-hidden="true">⏳</span>
        <span>${ativo ? "Transcrevendo agora… pode continuar usando o painel." : "Essa transcrição ficou pela metade (a aba foi fechada no meio)."}</span></div>`;
    } else if (status === "falhou") {
      corpo = `<div class="rs-estado rs-estado-erro">⚠️ <span>${esc(r.erro || "Não deu certo dessa vez.")}</span></div>`;
    } else {
      corpo = linhas ? `<p class="rs-trecho">${esc(linhas)}</p>` : `<p class="rs-trecho rs-vazio-txt">Sem transcrição ainda. Clique em Editar pra escrever.</p>`;
    }
    const acoes = [];
    if (status === "processando" && !ativo) acoes.push(`<button type="button" class="btn btn-mini" data-de-novo="${esc(r.id)}">🔁 Tentar de novo</button>`);
    if (status === "falhou") {
      acoes.push(`<button type="button" class="btn btn-mini" data-editar="${esc(r.id)}" data-assim="1">📝 Abrir mesmo assim</button>`);
      if (r.link) acoes.push(`<button type="button" class="btn btn-mini" data-de-novo="${esc(r.id)}">🔁 Tentar de novo</button>`);
    }
    if (status === "pronto") {
      acoes.push(`<button type="button" class="btn btn-mini" data-copiar="${esc(r.id)}"${r.transcricao ? "" : " disabled"}>📋 Copiar transcrição</button>`);
      acoes.push(`<button type="button" class="btn btn-mini" data-editar="${esc(r.id)}">✏️ Editar</button>`);
    }
    if (!ativo) acoes.push(`<button type="button" class="btn btn-mini btn-perigo" data-apagar="${esc(r.id)}">🗑 Apagar</button>`);
    return `<article class="rs-card${st.tocando.has(r.id) ? " rs-card-tocando" : ""}" data-id="${esc(r.id)}">
      ${capaHtml(r)}
      <div class="rs-info">
        <div class="rs-topo-card">
          <span class="rs-dono ${meu ? "rs-dono-meu" : "rs-dono-outra"}">${meu ? "💛 Meu" : "👀 De outra"}</span>
          <span class="rs-fonte">${EMOJI_FONTE[r.origem] || "🎬"} ${esc(NOME_FONTE[r.origem] || "Outro")}</span>
          <span class="rs-data">${esc(fmtData(r.data_post) || fmtData(r.criado_em))}</span>
        </div>
        <h4>${r.titulo ? esc(r.titulo) : '<span class="rs-sem-titulo">Sem título</span>'}</h4>
        ${r.perfil ? `<div class="rs-perfil">${esc(r.perfil.startsWith("@") ? r.perfil : "@" + r.perfil)}</div>` : ""}
        ${tags ? `<div class="rs-tags">${tags}</div>` : ""}
        ${corpo}
        <div class="rs-acoes">${acoes.join("")}</div>
      </div>
    </article>`;
  }
  function pintarLista() {
    const box = $("#rs-lista", st.sec);
    if (!box) return;
    const lista = filtrados();
    $("#rs-conta", st.sec).textContent = st.lista.length ? `${lista.length} de ${st.lista.length}` : "";
    if (!st.lista.length) {
      box.innerHTML = `<div class="vazio rs-vazio">🎬 Sua biblioteca ainda está vazia. Cole o link de um reel lá em cima e clique em Transcrever.</div>`;
      return;
    }
    if (!lista.length) { box.innerHTML = `<div class="vazio rs-vazio">🔎 Nada encontrado com esse filtro.</div>`; return; }
    box.innerHTML = lista.map(cardHtml).join("");
    const acha = (id) => st.lista.find((r) => String(r.id) === String(id));
    $$("[data-ver]", box).forEach((b) => b.addEventListener("click", () => { const r = acha(b.dataset.ver); st.tocando.add(r.id); pintarLista(); }));
    $$("[data-copiar]", box).forEach((b) => b.addEventListener("click", async () => {
      const r = acha(b.dataset.copiar);
      if (await copiar(r.transcricao || "")) { b.textContent = "copiado ✓"; setTimeout(() => { b.textContent = "📋 Copiar transcrição"; }, 1800); }
    }));
    $$("[data-editar]", box).forEach((b) => b.addEventListener("click", () => abrirEditor(acha(b.dataset.editar), null, b.dataset.assim ? "Escreva o texto do vídeo na mão e salve." : "")));
    $$("[data-apagar]", box).forEach((b) => b.addEventListener("click", () => apagarRoteiro(acha(b.dataset.apagar))));
    $$("[data-de-novo]", box).forEach((b) => b.addEventListener("click", () => { const r = acha(b.dataset.deNovo); executar(r.link, r.de_quem, r); }));
  }
  function pintarTudo() { pintarChips(); pintarLista(); }

  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); return true; }
    catch (e) {
      const t = document.createElement("textarea");
      t.value = texto; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
      t.remove();
      if (!ok) toast("Não consegui copiar. Selecione o texto e copie na mão.", true);
      return ok;
    }
  }

  // =========================================================
  // TRANSCREVER
  // =========================================================
  async function clicouTranscrever() {
    const campo = $("#rs-link", st.sec);
    const bruto = campo.value.trim();
    if (!bruto) { aviso("erro", "📎 Cole o link do vídeo no campo antes de clicar em Transcrever."); campo.focus(); return; }
    const link = limparLink(bruto);
    let valido = /^https?:\/\//i.test(link);
    try { const u = new URL(link); if (!u.hostname.includes(".")) valido = false; } catch (e) { valido = false; }
    if (!valido) { aviso("erro", "🤔 Isso não parece um link. Copie o link do vídeo (ele começa com https://) e cole aqui."); campo.focus(); return; }
    if (!st.chave) { explicarChave(); return; }
    if (st.faltaSql) { aviso("erro", "Falta rodar o arquivo sql-roteiros.sql no Supabase (SQL Editor). Depois é só recarregar esta página."); return; }
    const igual = st.lista.find((r) => r.link && limparLink(r.link) === link);
    if (igual) {
      aviso("aviso", `📌 Esse vídeo já está na sua biblioteca${igual.titulo ? ` (<b>${esc(igual.titulo)}</b>)` : ""}. Transcrever de novo gasta mais um crédito.`, [
        { texto: "Ver o que já tenho", acao: () => { aviso(null); abrirEditor(igual); } },
        { texto: "Transcrever de novo", acao: () => { aviso(null); campo.value = ""; executar(link, st.deQuem, igual); } }
      ]);
      return;
    }
    campo.value = "";
    executar(link, st.deQuem, null);
  }

  async function executar(link, deQuem, existente) {
    if (!st.chave) { explicarChave(); return; }
    const fonte = fonteDoLink(link);
    let linha;
    try {
      if (existente) linha = await atualizar(existente.id, { status: "processando", erro: null, link });
      else linha = await inserir({ origem: fonte, link, perfil: perfilDoLink(link) || null, de_quem: deQuem === "meu" ? "meu" : "outra", titulo: "", status: "processando" });
    } catch (e) { aviso("erro", esc(e.message)); return; }
    st.emAndamento.add(linha.id);
    pintarTudo();

    const inicio = Date.now();
    const atualizarAviso = () => {
      const s = Math.round((Date.now() - inicio) / 1000);
      aviso("andamento", `<span class="rs-relogio" aria-hidden="true">⏳</span> <b>Ouvindo o vídeo… ${tempoTxt(s)}.</b> Costuma levar de 3 a 4 minutos, pode deixar a aba aberta.`);
    };
    atualizarAviso();
    const relogio = setInterval(atualizarAviso, 5000);

    try {
      const { texto, segmentos } = await transcreverNaSupadata(link, null);
      const pronto = await atualizar(linha.id, { transcricao: texto, segmentos: segmentos || null, status: "pronto", erro: null });
      st.emAndamento.delete(linha.id);
      clearInterval(relogio);
      aviso("ok", "✅ Pronto. Revisa, dá um nome e salva.");
      pintarTudo();
      abrirEditor(pronto, null, "✅ Pronto. Revisa, dá um nome e salva.");
    } catch (err) {
      clearInterval(relogio);
      st.emAndamento.delete(linha.id);
      const msg = err instanceof ErroSupa ? err.message : "Algo deu errado na transcrição. Tente de novo.";
      try { await atualizar(linha.id, { status: "falhou", erro: msg }); } catch (e) { /* segue */ }
      pintarTudo();
      const r = st.lista.find((x) => x.id === linha.id);
      if (err.tipo === "vazio") {
        aviso("aviso", "🎵 " + esc(msg), [{ texto: "📝 Guardar assim mesmo", acao: () => { aviso(null); abrirEditor(r, null, "Escreva o texto do vídeo na mão e salve."); } }]);
      } else if (err.tipo === "chave") {
        aviso("erro", "🔑 " + esc(msg));
      } else {
        aviso("erro", "⚠️ " + esc(msg));
      }
    }
    buscarSaldo();
  }

  // =========================================================
  // EDITAR / APAGAR
  // =========================================================
  let dlg = null;
  function janela() {
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.className = "janela larga rs-janela";
    dlg.innerHTML = `<form method="dialog" novalidate>
      <div class="janela-cabeca"><div><small class="janela-sobretitulo">📜 Roteiros</small><h2 id="rs-j-titulo">Editar roteiro</h2></div>
        <button class="icone-btn" type="button" data-fechar aria-label="Fechar"><svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="janela-corpo" id="rs-j-corpo"></div>
      <div class="janela-rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn btn-principal" id="rs-j-salvar">💾 Salvar</button></div>
    </form>`;
    document.body.appendChild(dlg);
    $$("[data-fechar]", dlg).forEach((b) => b.addEventListener("click", () => dlg.close()));
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    return dlg;
  }
  function abrirEditor(r, padrao, faixa) {
    const d = janela();
    const v = r || Object.assign({ de_quem: "outra" }, padrao || {});
    const novo = !r;
    $("#rs-j-titulo", d).textContent = novo ? "✍️ Escrever na mão" : "✏️ Editar roteiro";
    const campo = (nome, rotulo, valor, tipo = "text", extra = "") =>
      `<div class="campo"><label for="rs-f-${nome}">${rotulo}</label><input id="rs-f-${nome}" name="${nome}" type="${tipo}" value="${esc(valor || "")}" ${extra}></div>`;
    $("#rs-j-corpo", d).innerHTML = `
      ${faixa ? `<p class="faixa faixa-ok">${esc(faixa)}</p>` : ""}
      ${campo("titulo", "Título", v.titulo, "text", 'placeholder="Ex.: gancho do antes e depois"')}
      <div class="linha-campos">
        <div class="campo"><label for="rs-f-de_quem">De quem</label>
          <select id="rs-f-de_quem" name="de_quem"><option value="outra"${v.de_quem !== "meu" ? " selected" : ""}>👀 De outra pessoa</option><option value="meu"${v.de_quem === "meu" ? " selected" : ""}>💛 Meu</option></select></div>
        ${campo("perfil", "Perfil (@)", v.perfil, "text", 'placeholder="@perfil"')}
      </div>
      <div class="linha-campos">
        ${campo("link", "Link do vídeo", v.link, "url", 'placeholder="https://..."')}
        ${campo("data_post", "Data de postagem", v.data_post, "date")}
      </div>
      ${campo("etiquetas", "Tags (separadas por vírgula)", v.etiquetas, "text", 'placeholder="skincare, gancho forte, review"')}
      <div class="campo"><label for="rs-f-legenda">Legenda do post</label><textarea id="rs-f-legenda" name="legenda" rows="3">${esc(v.legenda || "")}</textarea></div>
      <div class="campo"><label for="rs-f-transcricao">Transcrição</label><textarea id="rs-f-transcricao" name="transcricao" class="rs-transcricao" rows="12">${esc(v.transcricao || "")}</textarea></div>
      <div class="campo"><label for="rs-f-notas">Minhas notas</label><textarea id="rs-f-notas" name="notas" rows="3" placeholder="O que chamou sua atenção nesse vídeo?">${esc(v.notas || "")}</textarea></div>`;
    const btn = $("#rs-j-salvar", d);
    const novoBtn = btn.cloneNode(true);
    btn.replaceWith(novoBtn);
    novoBtn.addEventListener("click", async () => {
      const f = {};
      $$("#rs-j-corpo [name]", d).forEach((el) => { f[el.name] = el.value.trim(); });
      const link = f.link ? limparLink(f.link) : "";
      if (link && !/^https?:\/\//i.test(link)) { toast("O link precisa começar com https://", true); return; }
      let perfil = f.perfil.replace(/^@+/, "");
      const linha = {
        titulo: f.titulo,
        de_quem: f.de_quem === "meu" ? "meu" : "outra",
        perfil: perfil ? "@" + perfil : null,
        link: link || null,
        data_post: f.data_post || null,
        etiquetas: f.etiquetas.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean).join(", ") || null,
        legenda: f.legenda || null,
        transcricao: f.transcricao || null,
        notas: f.notas || null,
        status: "pronto",
        erro: null
      };
      novoBtn.disabled = true;
      try {
        if (novo) { linha.origem = link ? fonteDoLink(link) : "outro"; await inserir(linha); }
        else await atualizar(r.id, linha);
        d.close();
        toast("Salvo ✓");
        aviso(null);
        pintarTudo();
      } catch (e) { toast(e.message, true); }
      novoBtn.disabled = false;
    });
    if (!d.open) d.showModal();
    setTimeout(() => { const t = $(r && r.transcricao && !r.titulo ? "#rs-f-titulo" : (novo ? "#rs-f-titulo" : "#rs-f-titulo"), d); if (t) t.focus(); }, 30);
  }
  async function apagarRoteiro(r) {
    const d = janela();
    $("#rs-j-titulo", d).textContent = "🗑 Apagar roteiro";
    $("#rs-j-corpo", d).innerHTML = `<p style="margin:0">Apagar <b>${esc(r.titulo || "este roteiro")}</b>${r.perfil ? " de " + esc(r.perfil) : ""}? Não dá pra desfazer.</p>`;
    const btn = $("#rs-j-salvar", d);
    const b2 = btn.cloneNode(false);
    b2.className = "btn btn-perigo"; b2.id = "rs-j-salvar"; b2.textContent = "🗑 Apagar";
    btn.replaceWith(b2);
    b2.addEventListener("click", async () => {
      b2.disabled = true;
      try { await remover(r.id); d.close(); toast("Apagado"); pintarTudo(); }
      catch (e) { toast(e.message, true); b2.disabled = false; }
    });
    d.addEventListener("close", () => { b2.className = "btn btn-principal"; b2.textContent = "💾 Salvar"; }, { once: true });
    if (!d.open) d.showModal();
  }

  // =========================================================
  // ESTUDAR COM O CLAUDE
  // =========================================================
  async function estudarComClaude() {
    const outras = st.lista.filter((r) => r.de_quem !== "meu" && (r.status || "pronto") === "pronto" && String(r.transcricao || "").trim()).slice(0, 10);
    if (!outras.length) { aviso("aviso", "🧠 Ainda não tenho vídeos de outras creators transcritos. Transcreva alguns marcados como <b>De outra pessoa</b> e volte aqui."); return; }
    const blocos = outras.map((r, i) => `VÍDEO ${i + 1}\nPerfil: ${r.perfil || "não informado"}${r.titulo ? "\nTítulo: " + r.titulo : ""}\nTranscrição:\n${String(r.transcricao).trim()}`).join("\n\n----------\n\n");
    const prompt = `Sou criadora de conteúdo UGC e estou estudando o que outras creators estão postando. Abaixo estão as transcrições de ${outras.length} vídeos recentes de outras perfis.

Quero que você analise e me entregue, em português do Brasil, sem usar travessão:

1. Assuntos em alta: quais temas aparecem mais e por que eles devem estar funcionando.
2. Expressões que estão prendendo: palavras e frases que se repetem ou que seguram a atenção, com o trecho real de onde saíram.
3. Padrões de gancho: agrupe os ganchos (as primeiras frases) por tipo e mostre um exemplo real de cada padrão, copiado da transcrição.
4. Cinco roteiros novos no MEU assunto, reaproveitando a ESTRUTURA desses vídeos (o tipo de gancho, a ordem dos blocos, o ritmo e o tipo de chamada final), nunca o conteúdo. Para cada roteiro: gancho, desenvolvimento e chamada final, escritos do jeito que a gente fala de verdade na câmera, sem ficar robotizado nem com cara de propaganda.

Meu assunto: [escreva aqui o seu nicho e os produtos que você usa]

${blocos}`;
    if (await copiar(prompt)) {
      aviso("ok", `🧠 Prompt copiado com ${outras.length} ${outras.length === 1 ? "vídeo" : "vídeos"} de outras creators. Abra o <a href="https://claude.ai/new" target="_blank" rel="noopener">Claude</a>, cole e troque o trecho <b>[escreva aqui o seu nicho...]</b> pelo seu assunto.`);
    }
  }

  // =========================================================
  // ABRIR A ABA
  // =========================================================
  async function abrir() {
    st.sec = document.getElementById("aba-" + ABA);
    if (!st.sec || !window.banco) return;
    if (!st.pronto) {
      st.pronto = true;
      montar();
      $("#rs-lista", st.sec).innerHTML = `<div class="vazio rs-vazio">⏳ Carregando a biblioteca…</div>`;
      await Promise.all([carregarLista(), carregarChave()]);
      pintarChave();
      pintarTudo();
      if (st.faltaSql) aviso("erro", "Falta rodar o arquivo sql-roteiros.sql no Supabase (SQL Editor). Depois é só recarregar esta página.");
      buscarSaldo();
    } else {
      // volta para a aba: atualiza a lista sem perder o que está em andamento
      await carregarLista();
      pintarTudo();
    }
  }
  document.addEventListener("painel:aba", (e) => { if (e.detail === ABA) abrir(); });
})();
