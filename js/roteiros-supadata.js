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
  // TELA (mesmo visual da Transcrição de vídeos: classes cr-* do painel)
  // =========================================================
  const IC = {
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    arquivo: '<path d="M7 3.5h7L18.5 8v12.5H7z"/><path d="M14 3.5V8h4.5M10 13h5M10 16.5h3.5"/>',
    subir: '<path d="M7 3.5h7L18.5 8v12.5H7z"/><path d="M14 3.5V8h4.5M12.75 17.5v-6M10.25 14l2.5-2.5 2.5 2.5"/>',
    mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M6 11.5a6 6 0 0 0 12 0M12 17.5v3"/>',
    seta: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    play: '<path d="M8.5 6v12l9.5-6z"/>',
    insta: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.6"/><path d="M16.8 7.2h.01"/>',
    tiktok: '<path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 4c.4 2.4 2 4 4.5 4.3"/>',
    youtube: '<rect x="3" y="6" width="18" height="12" rx="3.5"/><path d="M10.5 9.5v5l4-2.5z"/>',
    busca: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>',
    pontos: '<path d="M6 12h.01M12 12h.01M18 12h.01"/>',
    chave: '<circle cx="8" cy="15" r="3.5"/><path d="M10.5 12.5L19 4M16 7l2.5 2.5"/>',
    lampada: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3.5a5.5 5.5 0 0 0-3.3 9.9c.7.6 1.3 1.5 1.3 2.6h4c0-1.1.6-2 1.3-2.6A5.5 5.5 0 0 0 12 3.5z"/>'
  };
  const ic = (n, t = 18) => `<svg class="traco" width="${t}" height="${t}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ""}</svg>`;
  const iconeRede = (o) => o === "instagram" ? ic("insta", 15) : o === "tiktok" ? ic("tiktok", 15) : o === "youtube" ? ic("youtube", 15) : ic("play", 13);
  const mmss = (s) => `${String(Math.floor((Number(s) || 0) / 60)).padStart(2, "0")}:${String(Math.round((Number(s) || 0) % 60)).padStart(2, "0")}`;

  function montar() {
    const sec = st.sec;
    sec.innerHTML = `
    <div class="cr-pagina rs-pagina">
      <header class="cr-cabeca cr-cabeca-linha">
        <div><h2>Transcrição de vídeos</h2><p>Cole o link, envie um vídeo ou um áudio e receba a transcrição.</p></div>
        <button type="button" class="btn rs-estudar" id="rs-estudar">${ic("lampada", 16)}Estudar com o Claude</button>
      </header>

      <section class="cr-card cr-importar">
        <div class="rs-modos-linha">
          <div class="cr-modos" role="tablist" aria-label="Como enviar">
            <button type="button" class="cr-modo ativo" data-modo="link" role="tab">${ic("link")}Link de vídeo</button>
            <button type="button" class="cr-modo" data-modo="arquivo" role="tab">${ic("arquivo")}Enviar arquivo</button>
            <button type="button" class="cr-modo" data-modo="audio" role="tab">${ic("mic")}Gravar áudio</button>
          </div>
        </div>
        <div data-painel-modo="link">
          <form class="cr-linha-link" id="rs-form-link">
            <label class="cr-campo-icone">${ic("link", 17)}<input id="rs-link" type="url" inputmode="url" autocomplete="off" placeholder="Cole o link do Instagram, TikTok ou YouTube aqui..." aria-label="Link do vídeo"></label>
            <button class="btn btn-principal cr-btn" type="submit" id="rs-transcrever">Transcrever${ic("seta", 16)}</button>
          </form>
        </div>
        <div data-painel-modo="arquivo" hidden>
          <label class="cr-soltar" id="rs-soltar">${ic("subir", 30)}<b>Arraste um vídeo ou áudio aqui, ou clique para escolher</b><small>Vídeo MP4, MOV ou AVI · áudio MP3, WAV ou M4A (até 25 MB)</small><input type="file" id="rs-arquivo" accept="video/*,audio/*,.m4a,.mp3,.wav,.ogg,.opus" hidden></label>
        </div>
        <div data-painel-modo="audio" hidden>
          <button type="button" class="cr-soltar cr-gravar" id="rs-gravar">${ic("mic", 30)}<b>Toque para gravar</b><small>até 10 minutos · toque de novo para parar e transcrever</small></button>
        </div>
        <p class="cr-formatos">Formatos aceitos: vídeo MP4, MOV e AVI · áudio MP3, WAV, M4A e OGG · até 25 MB (limite da transcrição) · <button type="button" class="rs-link-btn" id="rs-manual">escrever na mão</button></p>
        <div id="rs-aviso" class="rs-aviso" aria-live="polite" hidden></div>
        <div class="cr-rodape-card rs-rodape">
          <label class="rs-quem-mini">Vídeo
            <select id="rs-quem" aria-label="De quem é o vídeo"><option value="outra">de outra pessoa</option><option value="meu">meu</option></select>
          </label>
          <div class="rs-chave" id="rs-chave"></div>
        </div>
      </section>

      <div class="rs-biblio-cabeca">
        <h3 class="cr-secao">Transcrições recentes</h3>
        <span class="rs-conta" id="rs-conta"></span>
      </div>
      <label class="cr-busca rs-busca">${ic("busca", 17)}<input type="search" id="rs-busca" placeholder="Buscar por título, perfil, tag ou trecho da fala..." aria-label="Buscar"></label>
      <div class="cr-chips rs-chips" id="rs-chips"></div>
      <div class="cr-recentes rs-lista" id="rs-lista"></div>
    </div>`;

    $("#rs-quem", sec).value = st.deQuem;
    $("#rs-quem", sec).addEventListener("change", (e) => { st.deQuem = e.target.value; });
    $("#rs-form-link", sec).addEventListener("submit", (e) => { e.preventDefault(); clicouTranscrever(); });
    $("#rs-estudar", sec).addEventListener("click", estudarComClaude);
    $("#rs-manual", sec).addEventListener("click", () => abrirEditor(null, { de_quem: st.deQuem }));
    $("#rs-busca", sec).addEventListener("input", (e) => { st.busca = e.target.value; pintarLista(); });
    $$(".cr-modo", sec).forEach((b) => b.addEventListener("click", () => {
      $$(".cr-modo", sec).forEach((x) => x.classList.toggle("ativo", x === b));
      $$("[data-painel-modo]", sec).forEach((p) => { p.hidden = p.dataset.painelModo !== b.dataset.modo; });
      aviso(null);
    }));
    ligarArquivoEAudio(sec);
    // fecha os menus ••• ao clicar fora
    document.addEventListener("click", (e) => { if (!e.target.closest(".cr-ref-menu")) $$(".rs-lista .cr-menu").forEach((m) => { m.hidden = true; }); });
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

  // chave da Supadata: uma linha discreta no rodapé do cartão; o campo só aparece sem chave ou ao clicar em "trocar"
  let trocandoChave = false;
  function pintarChave() {
    const box = st.sec && $("#rs-chave", st.sec);
    if (!box) return;
    const fim = st.chave ? st.chave.slice(-4) : "";
    if (st.chave && !trocandoChave) {
      let saldo = "conferindo o saldo…";
      let erro = false;
      if (st.saldo && !st.saldo.erro) saldo = `${st.saldo.usado} de ${st.saldo.max} créditos usados`;
      else if (st.saldo && st.saldo.erro) { saldo = st.saldo.erro; erro = true; }
      box.innerHTML = `<span class="rs-chave-ok${erro ? " rs-chave-erro" : ""}"><i class="rs-bolinha" aria-hidden="true"></i>Supadata conectada · <span title="Chave terminada em ${esc(fim)}">${esc(saldo)}</span></span>
        <button type="button" class="rs-link-btn" id="rs-chave-trocar">trocar chave</button>`;
      $("#rs-chave-trocar", box).addEventListener("click", () => { trocandoChave = true; pintarChave(); const c = $("#rs-chave-campo", box); if (c) c.focus(); });
      return;
    }
    box.innerHTML = `<div class="rs-chave-linha">
        <label class="cr-campo-icone rs-chave-campo">${ic("chave", 16)}<input id="rs-chave-campo" type="password" autocomplete="off" spellcheck="false"
          placeholder="${st.chave ? "Cole a chave nova da Supadata" : "Cole aqui a sua chave (API key) da Supadata"}" aria-label="Chave da Supadata"></label>
        <button type="button" class="btn btn-mini" id="rs-chave-salvar">Salvar</button>
        ${st.chave ? `<button type="button" class="rs-link-btn" id="rs-chave-cancelar">cancelar</button>` : ""}
      </div>`;
    const campo = $("#rs-chave-campo", box);
    const salvar = async () => {
      const v = campo.value.trim();
      if (!v) { toast("Cole a chave antes de salvar.", true); campo.focus(); return; }
      if (v.length < 12 || /\s/.test(v)) { toast("Essa chave parece incompleta. Copie de novo no site da Supadata.", true); return; }
      try {
        await salvarChave(v);
        toast("Chave salva ");
        aviso(null);
        trocandoChave = false;
        st.saldo = null;
        pintarChave();
        buscarSaldo();
      } catch (e) { toast(e.message, true); }
    };
    $("#rs-chave-salvar", box).addEventListener("click", salvar);
    campo.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); salvar(); } });
    const cancelar = $("#rs-chave-cancelar", box);
    if (cancelar) cancelar.addEventListener("click", () => { trocandoChave = false; pintarChave(); });
  }

  function explicarChave() {
    aviso("aviso", `<b>Falta a chave da Supadata.</b> É de graça e leva 2 minutos:
      <ol class="rs-passos">
        <li>Crie uma conta grátis em <a href="https://dash.supadata.ai" target="_blank" rel="noopener">dash.supadata.ai</a> (100 créditos por mês, sem cartão).</li>
        <li>No painel deles, copie a sua <b>API key</b>.</li>
        <li>Cole no campo da chave aqui embaixo e clique em Salvar.</li>
      </ol>`);
    trocandoChave = true;
    pintarChave();
    const c = $("#rs-chave-campo", st.sec);
    if (c) c.focus();
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
        const alvo = [r.transcricao, r.perfil, r.titulo, r.notas, r.legenda, r.etiquetas].join(" ").toLowerCase();
        if (!alvo.includes(b)) return false;
      }
      return true;
    });
  }
  function pintarChips() {
    const box = $("#rs-chips", st.sec);
    const tags = [...new Set(st.lista.flatMap(tagsDe).map((t) => t.toLowerCase()))].sort();
    const chips = [{ v: "todos", t: "Todos" }, { v: "outra", t: "De outras" }, { v: "meu", t: "Meus" }, ...tags.map((t) => ({ v: "tag:" + t, t: "#" + t }))];
    if (!chips.some((c) => c.v === st.filtro)) st.filtro = "todos";
    box.innerHTML = chips.map((c) => `<button type="button" class="cr-chip${st.filtro === c.v ? " ativo" : ""}" data-f="${esc(c.v)}">${esc(c.t)}</button>`).join("");
    $$("[data-f]", box).forEach((b) => b.addEventListener("click", () => { st.filtro = b.dataset.f; pintarChips(); pintarLista(); }));
  }
  function capaHtml(r) {
    const yt = idYoutube(r.link);
    const capa = r.capa || (yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : "");
    return `<div class="cr-capa${capa ? " tem-imagem" : ""}" data-assistir="${esc(r.id)}" role="button" tabindex="0" aria-label="Assistir o vídeo">${capa ? `<img src="${esc(capa)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove('tem-imagem');this.remove()">` : `<span class="cr-capa-play">${ic("play", 18)}</span>`}
      <span class="cr-capa-assistir">${ic("play", 12)}${r.duracao ? mmss(r.duracao) : "assistir"}</span><span class="cr-capa-rede">${iconeRede(r.origem)}</span></div>`;
  }
  function linhaHtml(r) {
    const status = r.status || "pronto";
    const ativo = st.emAndamento.has(r.id);
    const meta = [NOME_FONTE[r.origem] || "Outro", r.perfil ? (r.perfil.startsWith("@") ? r.perfil : "@" + r.perfil) : "", fmtData(r.data_post) || fmtData(r.criado_em)].filter(Boolean).join(" · ");
    let estado = "";
    if (status === "processando") estado = `<span class="rs-estado-mini">${ativo ? "Transcrevendo agora…" : "Ficou pela metade"}</span>`;
    else if (status === "falhou") estado = `<span class="rs-estado-mini rs-estado-erro-mini">${esc(r.erro || "Não deu certo dessa vez.")}</span>`;
    let principal;
    if (status === "processando" && ativo) principal = `<button class="btn" type="button" disabled>Aguarde…</button>`;
    else if (status !== "pronto" && r.link) principal = `<button class="btn" type="button" data-de-novo>Tentar de novo</button>`;
    else principal = `<button class="btn" type="button" data-ver>Ver transcrição${ic("seta", 14)}</button>`;
    return `<div class="cr-recente" data-id="${esc(r.id)}">
        ${capaHtml(r)}
        <div class="cr-recente-txt"><b>${esc(r.titulo || "Sem título")}</b><small>${esc(meta)}</small>${estado}</div>
        ${principal}
        <div class="cr-ref-menu"><button type="button" class="cr-mais" data-menu aria-label="Opções">${ic("pontos", 16)}</button>
          <div class="cr-menu" hidden><button type="button" data-criar>Criar roteiro</button><button type="button" data-editar>Editar</button>${ativo ? "" : `<button type="button" data-apagar>Excluir</button>`}</div></div>
      </div>`;
  }
  function pintarLista() {
    const box = $("#rs-lista", st.sec);
    if (!box) return;
    const lista = filtrados();
    $("#rs-conta", st.sec).textContent = st.lista.length ? (lista.length === st.lista.length ? `${st.lista.length}` : `${lista.length} de ${st.lista.length}`) : "";
    if (!st.lista.length) { box.innerHTML = `<p class="cr-vazio">${ic("arquivo", 24)}Suas transcrições aparecem aqui.</p>`; return; }
    if (!lista.length) { box.innerHTML = `<p class="cr-vazio">${ic("busca", 24)}Nada encontrado com esse filtro.</p>`; return; }
    box.innerHTML = lista.map(linhaHtml).join("");
    const acha = (id) => st.lista.find((r) => String(r.id) === String(id));
    $$(".cr-recente", box).forEach((linha) => {
      const r = acha(linha.dataset.id);
      const menu = $(".cr-menu", linha);
      const ver = $("[data-ver]", linha);
      if (ver) ver.addEventListener("click", () => irPara(r, "analise"));
      const deNovo = $("[data-de-novo]", linha);
      if (deNovo) deNovo.addEventListener("click", () => executar(r.link, r.de_quem, r));
      $("[data-menu]", linha).addEventListener("click", (e) => { e.stopPropagation(); $$(".cr-menu", box).forEach((m) => { if (m !== menu) m.hidden = true; }); menu.hidden = !menu.hidden; });
      $("[data-criar]", linha).addEventListener("click", () => { menu.hidden = true; irPara(r, "criar"); });
      $("[data-editar]", linha).addEventListener("click", () => { menu.hidden = true; abrirEditor(r); });
      const apagar = $("[data-apagar]", linha);
      if (apagar) apagar.addEventListener("click", () => { menu.hidden = true; apagarRoteiro(r); });
      const capa = $("[data-assistir]", linha);
      capa.addEventListener("click", () => assistir(r));
      capa.addEventListener("keydown", (e) => { if (e.key === "Enter") assistir(r); });
    });
    buscarCapas();
  }
  function pintarTudo() { pintarChips(); pintarLista(); }

  // Ver transcrição e Criar roteiro abrem as páginas Analisar vídeo e Criar roteiro do painel (js/admin.js)
  async function irPara(r, vista) {
    if (!r) return;
    if ((r.status || "pronto") !== "pronto" || !String(r.transcricao || "").trim()) { abrirEditor(r, null, "Esse vídeo ainda não tem transcrição. Escreva o texto na mão e salve."); return; }
    if (window.painelRoteiros && window.painelRoteiros.abrir) { await window.painelRoteiros.abrir(r.id, vista); return; }
    abrirEditor(r);
  }

  // tocar o vídeo numa janela
  let dlgVideo = null;
  function assistir(r) {
    const emb = embedDoLink(r.link);
    if (!emb) { if (r.link) window.open(r.link, "_blank", "noopener"); else toast("Esse vídeo foi enviado como arquivo, então não tem link pra tocar aqui.", true); return; }
    if (!dlgVideo) {
      dlgVideo = document.createElement("dialog");
      dlgVideo.className = "janela rs-janela-video";
      document.body.appendChild(dlgVideo);
      dlgVideo.addEventListener("click", (e) => { if (e.target === dlgVideo || e.target.closest("[data-fechar]")) dlgVideo.close(); });
      dlgVideo.addEventListener("close", () => { dlgVideo.innerHTML = ""; });
    }
    dlgVideo.innerHTML = `<div class="janela-cabeca"><div><small class="janela-sobretitulo">${esc(NOME_FONTE[r.origem] || "Vídeo")}</small><h2>${esc(r.titulo || "Vídeo")}</h2></div>
        <button class="icone-btn" type="button" data-fechar aria-label="Fechar"><svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="janela-corpo"><div class="cr-player cr-player-janela"><iframe src="${esc(emb.src)}" title="Vídeo" allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write" allowfullscreen></iframe></div></div>`;
    dlgVideo.showModal();
  }

  // capas: busca as que faltam pela função capa-video (uma por vez) e guarda no banco, igual às outras páginas
  const capaTentada = new Set();
  let buscandoCapas = false;
  const capaPequena = (src) => new Promise((ok) => {
    const img = new Image();
    img.onload = () => { const l = Math.min(1, 420 / img.width); const c = document.createElement("canvas"); c.width = Math.round(img.width * l); c.height = Math.round(img.height * l);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); try { ok(c.toDataURL("image/jpeg", 0.72)); } catch (e) { ok(""); } };
    img.onerror = () => ok(""); img.src = src;
  });
  const capaDoArquivo = (arq) => new Promise((ok) => {
    if (!/^video\//.test(arq.type)) { ok(""); return; }
    const v = document.createElement("video"); const url = URL.createObjectURL(arq);
    let feito = false; const fim = (x) => { if (feito) return; feito = true; URL.revokeObjectURL(url); ok(x); };
    v.muted = true; v.playsInline = true; v.preload = "metadata"; v.src = url;
    v.onloadeddata = () => { try { v.currentTime = Math.min(1, (v.duration || 2) / 3); } catch (e) { fim(""); } };
    v.onseeked = () => { const l = Math.min(1, 420 / (v.videoWidth || 420)); const c = document.createElement("canvas"); c.width = Math.round((v.videoWidth || 420) * l); c.height = Math.round((v.videoHeight || 560) * l);
      try { c.getContext("2d").drawImage(v, 0, 0, c.width, c.height); fim(c.toDataURL("image/jpeg", 0.72)); } catch (e) { fim(""); } };
    v.onerror = () => fim(""); setTimeout(() => fim(""), 8000);
  });
  async function buscarCapas() {
    if (buscandoCapas) return; buscandoCapas = true;
    try {
      for (const r of st.lista.filter((x) => x.link && !x.capa && !idYoutube(x.link) && !capaTentada.has(x.id)).slice(0, 12)) {
        capaTentada.add(r.id);
        try {
          const { data } = await banco().functions.invoke("capa-video", { body: { link: r.link } });
          const capa = data && data.imagem ? await capaPequena(data.imagem) : "";
          if (!capa) continue;
          const { error } = await banco().from("roteiros").update({ capa }).eq("id", r.id);
          if (error) continue;
          r.capa = capa;
          const el = st.sec && $(`.rs-lista [data-assistir="${r.id}"]`, st.sec);
          if (el) { el.outerHTML = capaHtml(r); const novo = $(`.rs-lista [data-assistir="${r.id}"]`, st.sec); novo.addEventListener("click", () => assistir(r)); }
        } catch (e) { /* segue sem capa */ }
      }
    } finally { buscandoCapas = false; }
  }

  // ---------- Enviar arquivo e Gravar áudio: função transcrever do Supabase (Whisper, até 25 MB) ----------
  let ocupadoArquivo = false;
  async function transcreverArquivo(arq, extra) {
    if (ocupadoArquivo) return;
    if (st.faltaSql) { aviso("erro", "Falta rodar o arquivo sql-roteiros.sql no Supabase (SQL Editor). Depois é só recarregar esta página."); return; }
    if (arq.size > 25 * 1024 * 1024) { aviso("erro", "Esse arquivo passa de 25 MB, o limite da transcrição. Envie um arquivo menor ou cole o link."); return; }
    ocupadoArquivo = true;
    const botoes = $$("#rs-soltar, #rs-gravar, #rs-arquivo", st.sec);
    botoes.forEach((b) => { b.classList.add("rs-ocupado"); });
    const inicio = Date.now();
    const atualizarAviso = () => aviso("andamento", `<b>${esc(extra.mensagem || "Transcrevendo o arquivo")}… ${tempoTxt(Math.round((Date.now() - inicio) / 1000))}.</b> Costuma levar menos de 1 minuto.`);
    atualizarAviso();
    const relogio = setInterval(atualizarAviso, 1000);
    try {
      const corpo = new FormData();
      corpo.append("arquivo", arq, arq.name || "video.mp4");
      corpo.append("link", "");
      const capa = await capaDoArquivo(arq);
      const { data, error } = await banco().functions.invoke("transcrever", { body: corpo });
      let msg = data && data.erro;
      if (error) { try { msg = (await error.context.json()).erro; } catch (e) { /* segue */ } msg = msg || "Não consegui falar com o programa de transcrição. Tente de novo."; }
      if (msg) throw new Error(msg);
      const c = (data && data.campos) || {};
      const texto = String((data && data.transcricao) || "").trim();
      if (!texto) throw new Error("Não achei fala nesse arquivo.");
      const nulo = (v) => (v == null || String(v).trim() === "" ? null : v);
      const linha = await inserir({
        titulo: String(c.titulo || extra.titulo || "").slice(0, 120), de_quem: st.deQuem === "meu" ? "meu" : "outra", origem: "outro", link: null,
        etiquetas: nulo(c.etiquetas), gancho: nulo(c.gancho), gancho_tipo: nulo(c.gancho_tipo), desenvolvimento: nulo(c.desenvolvimento), cta: nulo(c.cta),
        expressoes: nulo(c.expressoes), por_que: nulo(c.por_que), transcricao: texto,
        segmentos: Array.isArray(data.segmentos) && data.segmentos.length ? data.segmentos : null, duracao: data.duracao || null, capa: capa || null, status: "pronto"
      });
      clearInterval(relogio);
      aviso("ok", "Pronto. Revisa, dá um nome e salva.");
      pintarTudo();
      abrirEditor(linha, null, "Pronto. Revisa, dá um nome e salva.");
    } catch (e) {
      clearInterval(relogio);
      aviso("erro", esc(e.message || "Algo deu errado na transcrição. Tente de novo."));
    }
    botoes.forEach((b) => { b.classList.remove("rs-ocupado"); });
    ocupadoArquivo = false;
  }
  function ligarArquivoEAudio(sec) {
    const usar = (arq) => { if (arq) transcreverArquivo(arq, { titulo: (arq.name || "").replace(/\.[^.]+$/, ""), mensagem: "Transcrevendo o arquivo" }); };
    $("#rs-arquivo", sec).addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; usar(f); });
    const zona = $("#rs-soltar", sec);
    ["dragenter", "dragover"].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add("arrastando"); }));
    ["dragleave", "drop"].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.remove("arrastando"); }));
    zona.addEventListener("drop", (e) => usar(e.dataTransfer.files[0]));
    let gravador = null, limite = null;
    const btn = $("#rs-gravar", sec);
    btn.addEventListener("click", async () => {
      if (gravador) { gravador.stop(); return; }
      if (ocupadoArquivo) return;
      try {
        const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
        const rec = new MediaRecorder(fluxo); const partes = [];
        rec.ondataavailable = (e) => { if (e.data && e.data.size) partes.push(e.data); };
        rec.onstop = () => {
          clearTimeout(limite); fluxo.getTracks().forEach((t) => t.stop()); gravador = null;
          btn.classList.remove("gravando"); $("b", btn).textContent = "Toque para gravar";
          const tipo = rec.mimeType || "audio/webm"; const ext = /mp4|m4a|aac/.test(tipo) ? "m4a" : /ogg/.test(tipo) ? "ogg" : "webm";
          const blob = new Blob(partes, { type: tipo });
          if (blob.size) transcreverArquivo(new File([blob], "audio." + ext, { type: tipo }), { titulo: "Áudio gravado", mensagem: "Transcrevendo o seu áudio" });
        };
        gravador = rec; rec.start(); limite = setTimeout(() => rec.state === "recording" && rec.stop(), 10 * 60000);
        btn.classList.add("gravando"); $("b", btn).textContent = "● Gravando… toque para parar";
      } catch (e) { aviso("erro", "Não consegui usar o microfone. Libere o microfone no navegador ou envie um arquivo."); }
    });
  }

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
    if (!bruto) { aviso("erro", "Cole o link do vídeo no campo antes de clicar em Transcrever."); campo.focus(); return; }
    const link = limparLink(bruto);
    let valido = /^https?:\/\//i.test(link);
    try { const u = new URL(link); if (!u.hostname.includes(".")) valido = false; } catch (e) { valido = false; }
    if (!valido) { aviso("erro", "Isso não parece um link. Copie o link do vídeo (ele começa com https://) e cole aqui."); campo.focus(); return; }
    if (!st.chave) { explicarChave(); return; }
    if (st.faltaSql) { aviso("erro", "Falta rodar o arquivo sql-roteiros.sql no Supabase (SQL Editor). Depois é só recarregar esta página."); return; }
    const igual = st.lista.find((r) => r.link && limparLink(r.link) === link);
    if (igual) {
      aviso("aviso", `Esse vídeo já está na sua biblioteca${igual.titulo ? ` (<b>${esc(igual.titulo)}</b>)` : ""}. Transcrever de novo gasta mais um crédito.`, [
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
      aviso("andamento", `<span class="rs-relogio" aria-hidden="true"></span> <b>Ouvindo o vídeo… ${tempoTxt(s)}.</b> Costuma levar de 3 a 4 minutos, pode deixar a aba aberta.`);
    };
    atualizarAviso();
    const relogio = setInterval(atualizarAviso, 5000);

    try {
      const { texto, segmentos } = await transcreverNaSupadata(link, null);
      const pronto = await atualizar(linha.id, { transcricao: texto, segmentos: segmentos || null, status: "pronto", erro: null });
      st.emAndamento.delete(linha.id);
      clearInterval(relogio);
      aviso("ok", "Pronto. Revisa, dá um nome e salva.");
      pintarTudo();
      abrirEditor(pronto, null, "Pronto. Revisa, dá um nome e salva.");
    } catch (err) {
      clearInterval(relogio);
      st.emAndamento.delete(linha.id);
      const msg = err instanceof ErroSupa ? err.message : "Algo deu errado na transcrição. Tente de novo.";
      try { await atualizar(linha.id, { status: "falhou", erro: msg }); } catch (e) { /* segue */ }
      pintarTudo();
      const r = st.lista.find((x) => x.id === linha.id);
      if (err.tipo === "vazio") {
        aviso("aviso", "" + esc(msg), [{ texto: "Guardar assim mesmo", acao: () => { aviso(null); abrirEditor(r, null, "Escreva o texto do vídeo na mão e salve."); } }]);
      } else if (err.tipo === "chave") {
        aviso("erro", "" + esc(msg));
      } else {
        aviso("erro", "" + esc(msg));
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
      <div class="janela-cabeca"><div><small class="janela-sobretitulo">Transcrições</small><h2 id="rs-j-titulo">Editar roteiro</h2></div>
        <button class="icone-btn" type="button" data-fechar aria-label="Fechar"><svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="janela-corpo" id="rs-j-corpo"></div>
      <div class="janela-rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn btn-principal" id="rs-j-salvar">Salvar</button></div>
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
    $("#rs-j-titulo", d).textContent = novo ? "Escrever na mão" : "Editar roteiro";
    const campo = (nome, rotulo, valor, tipo = "text", extra = "") =>
      `<div class="campo"><label for="rs-f-${nome}">${rotulo}</label><input id="rs-f-${nome}" name="${nome}" type="${tipo}" value="${esc(valor || "")}" ${extra}></div>`;
    $("#rs-j-corpo", d).innerHTML = `
      ${faixa ? `<p class="faixa faixa-ok">${esc(faixa)}</p>` : ""}
      ${campo("titulo", "Título", v.titulo, "text", 'placeholder="Ex.: gancho do antes e depois"')}
      <div class="linha-campos">
        <div class="campo"><label for="rs-f-de_quem">De quem</label>
          <select id="rs-f-de_quem" name="de_quem"><option value="outra"${v.de_quem !== "meu" ? " selected" : ""}>De outra pessoa</option><option value="meu"${v.de_quem === "meu" ? " selected" : ""}>Meu</option></select></div>
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
        toast("Salvo ");
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
    $("#rs-j-titulo", d).textContent = "Apagar roteiro";
    $("#rs-j-corpo", d).innerHTML = `<p style="margin:0">Apagar <b>${esc(r.titulo || "este roteiro")}</b>${r.perfil ? " de " + esc(r.perfil) : ""}? Não dá pra desfazer.</p>`;
    const btn = $("#rs-j-salvar", d);
    const b2 = btn.cloneNode(false);
    b2.className = "btn btn-perigo"; b2.id = "rs-j-salvar"; b2.textContent = "Apagar";
    btn.replaceWith(b2);
    b2.addEventListener("click", async () => {
      b2.disabled = true;
      try { await remover(r.id); d.close(); toast("Apagado"); pintarTudo(); }
      catch (e) { toast(e.message, true); b2.disabled = false; }
    });
    d.addEventListener("close", () => { b2.className = "btn btn-principal"; b2.textContent = "Salvar"; }, { once: true });
    if (!d.open) d.showModal();
  }

  // =========================================================
  // ESTUDAR COM O CLAUDE
  // =========================================================
  async function estudarComClaude() {
    const outras = st.lista.filter((r) => r.de_quem !== "meu" && (r.status || "pronto") === "pronto" && String(r.transcricao || "").trim()).slice(0, 10);
    if (!outras.length) { aviso("aviso", "Ainda não tenho vídeos de outras creators transcritos. Transcreva alguns marcados como <b>De outra pessoa</b> e volte aqui."); return; }
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
      aviso("ok", `Prompt copiado com ${outras.length} ${outras.length === 1 ? "vídeo" : "vídeos"} de outras creators. Abra o <a href="https://claude.ai/new" target="_blank" rel="noopener">Claude</a>, cole e troque o trecho <b>[escreva aqui o seu nicho...]</b> pelo seu assunto.`);
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
      $("#rs-lista", st.sec).innerHTML = `<p class="cr-vazio">Carregando as transcrições…</p>`;
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
  // aberto direto pelo endereço (#transcritos) ou recarregado: o aviso do painel pode ter saído antes deste arquivo carregar
  (function abrirSeJaEstiverNaAba(tentativas) {
    if ((location.hash || "").replace("#", "") !== ABA || st.pronto) return;
    if (window.banco && document.getElementById("aba-" + ABA)) { abrir(); return; }
    if (tentativas > 0) setTimeout(() => abrirSeJaEstiverNaAba(tentativas - 1), 300);
  })(30);
})();
