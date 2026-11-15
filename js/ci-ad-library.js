/* Creative Intelligence · Biblioteca de Anúncios (v2)
   Central de pesquisa, acervo e análise de anúncios reais da Meta.
   - Pesquisar: Edge Function ci-ad-library (Apify + Meta Ad Library), resultados em grade.
   - Minha biblioteca: tabela creative_intelligence_ads (todas as referências, com ou sem projeto).
   - Histórico: tabela creative_intelligence_searches (reabrir sem gastar crédito).
   - Análise com IA: ci-ad-library acao "analisar" (só o texto do anúncio e o que ela colar).
   Categoria, notas e transcrição colada ficam em creative_intelligence_ads.metadata.
   Nada aqui inventa dado: o que a Meta não devolve aparece como "não informado". */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const supa = () => window.banco;
  const raiz = () => $("#ci-biblioteca");

  const PAISES = [["BR", "Brasil"], ["US", "Estados Unidos"], ["PT", "Portugal"], ["MX", "México"], ["AR", "Argentina"], ["ES", "Espanha"], ["GB", "Reino Unido"], ["ALL", "Todos os países"]];
  const nomePais = (c) => (PAISES.find((p) => p[0] === c) || [c, c || "País não informado"])[1];
  const FORMATOS = { video: "Vídeo", image: "Imagem", carousel: "Carrossel", dynamic: "Catálogo dinâmico", text: "Texto", unknown: "Formato não informado" };
  const PLATAFORMAS = { FACEBOOK: "Facebook", INSTAGRAM: "Instagram", MESSENGER: "Messenger", THREADS: "Threads", WHATSAPP: "WhatsApp", "AUDIENCE NETWORK": "Audience Network" };
  const MAX_ANALISE = 6;

  const svg = (d) => `<svg class="cib-ic" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const IC = {
    busca: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>'),
    fora: svg('<path d="M14 5h5v5"/><path d="M19 5l-8 8"/><path d="M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"/>'),
    salvar: svg('<path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z"/>'),
    salvo: svg('<path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z"/><path d="M9.5 10.5l2 2 3.5-3.5"/>'),
    brilho: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>'),
    lixo: svg('<path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M7 7l1 12h8l1-12"/>'),
    video: svg('<rect x="3.5" y="6" width="12" height="12" rx="2"/><path d="M15.5 10.5l5-3v9l-5-3"/>'),
    imagem: svg('<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4 4 3 3-2 4 3"/>'),
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    relogio: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 1.8"/>'),
    alerta: svg('<path d="M12 4l9 15H3z"/><path d="M12 10v4"/><path d="M12 17v.2"/>'),
    repetir: svg('<path d="M4 12a8 8 0 0 1 14-5l2 2"/><path d="M20 5v4h-4"/><path d="M20 12a8 8 0 0 1-14 5l-2-2"/><path d="M4 19v-4h4"/>'),
    roteiro: svg('<path d="M7 4h8l4 4v12H7z"/><path d="M15 4v4h4"/><path d="M10 13h6M10 16.5h4"/>'),
    ideia: svg('<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6h5.4c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3z"/>'),
    grade: svg('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
  };

  const st = {
    aba: "pesquisa",
    form: { query: "", country: "BR", media: "all", active: "active", max: 20 },
    buscando: false, cronometro: null,
    resultados: [], meta: null, erro: null, vazio: false, avisoHistorico: "",
    sel: new Set(), selAcervo: new Set(),
    acervo: [], acervoPronto: false, acervoErro: "",
    filtros: { q: "", marca: "", formato: "", categoria: "", analise: "" },
    historico: [], historicoPronto: false, historicoErro: "",
    projetoId: "", ocupado: false, analisando: false,
    conta: null, contaEm: 0,
    conjuntos: [],
  };
  try { Object.assign(st.form, JSON.parse(localStorage.getItem("cib-form") || "{}")); } catch { /* sem preferência salva */ }
  try { st.conjuntos = JSON.parse(localStorage.getItem("cib-conjuntos") || "[]") || []; } catch { st.conjuntos = []; }
  try { const a = localStorage.getItem("cib-aba"); if (["pesquisa", "acervo", "historico"].includes(a)) st.aba = a; } catch { /* padrão */ }
  const lembrar = (k, v) => { try { localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); } catch { /* sem armazenamento */ } };

  // ---------- utilidades ----------
  let tempoToast = null;
  function toast(texto, erro) {
    const el = document.getElementById("toast"); if (!el) return;
    el.textContent = texto; el.classList.toggle("erro", Boolean(erro)); el.classList.add("visivel");
    clearTimeout(tempoToast); tempoToast = setTimeout(() => el.classList.remove("visivel"), erro ? 5600 : 2800);
  }
  const confirmar = (msg, op) => window.painelDialogo ? window.painelDialogo.confirmar(msg, op) : Promise.resolve(false);
  function fmtData(v) {
    if (!v) return "";
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    const d = new Date(v); return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
  }
  function fmtQuando(v) {
    const d = new Date(v); if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const urlSegura = (u) => /^https?:\/\//i.test(String(u || "")) ? String(u) : "";
  function formatoDe(a) {
    if (a && FORMATOS[a.format]) return a.format;
    const m = String((a && a.media_type) || "").toLowerCase();
    if (/v[ií]deo|video/.test(m)) return "video";
    if (/imag/.test(m)) return "image";
    if (/carross|carousel/.test(m)) return "carousel";
    return "unknown";
  }
  const plataformasDe = (a) => (Array.isArray(a.platforms) ? a.platforms : []).map((p) => PLATAFORMAS[String(p).toUpperCase().replace(/_/g, " ")] || String(p).toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase())).filter(Boolean);
  const textoDe = (a) => [a.title, a.body, a.description, a.cta_text, ...(Array.isArray(a.cards) ? a.cards.map((c) => [c.title, c.body].filter(Boolean).join(" ")) : [])].filter(Boolean).join(" ");
  function urlMeta(f) {
    const u = new URL("https://www.facebook.com/ads/library/");
    u.searchParams.set("active_status", f.active === "all" ? "all" : "active");
    u.searchParams.set("ad_type", "all"); u.searchParams.set("country", f.country || "BR");
    u.searchParams.set("q", f.query || ""); u.searchParams.set("search_type", "keyword_unordered");
    u.searchParams.set("media_type", ["video", "image"].includes(f.media) ? f.media : "all");
    return u.toString();
  }
  // linha do banco -> dados do anúncio (referências manuais antigas não têm metadata)
  function adDe(r) {
    const m = r && r.metadata && typeof r.metadata === "object" ? r.metadata : {};
    if (m.page_name || m.body || m.library_id) return m;
    return { page_name: r.title || "Referência", title: "", body: r.transcript || "", description: r.performance_note || "", snapshot_url: r.url || "", format: "unknown", platforms: r.platform ? [r.platform] : [], manual: true };
  }
  const extra = (r, k) => String((r && r.metadata && r.metadata[k]) || "");
  const projetos = () => (Array.isArray(window.ciProjetos) ? window.ciProjetos : []);
  const nomeProjeto = (id) => { const p = projetos().find((x) => x.id === id); return p ? [p.brand, p.product].filter(Boolean).join(" · ") || "Projeto sem nome" : ""; };

  // ---------- chamada da função (erros sempre com motivo e orientação) ----------
  class Falha extends Error { constructor(o) { super(o.error || "Não foi possível concluir."); this.code = o.code || ""; this.hint = o.hint || ""; } }
  async function chamar(body) {
    if (!supa()) throw new Falha({ code: "sem_banco", error: "O painel não conseguiu se conectar ao banco.", hint: "Recarregue a página." });
    let data, error;
    try { ({ data, error } = await supa().functions.invoke("ci-ad-library", { body })); }
    catch (e) { throw new Falha({ code: "rede", error: "Não consegui falar com o servidor.", hint: "Confira sua internet e tente de novo." }); }
    if (error) {
      let corpo = null;
      try { const r = error.context; if (r && typeof r.json === "function") corpo = await r.json(); } catch { /* resposta sem JSON */ }
      if (corpo && corpo.error) throw new Falha(corpo);
      const status = error.context && error.context.status;
      if (status === 401 || (corpo && /jwt/i.test(String(corpo.message || corpo.msg || "")))) throw new Falha({ code: "sessao", error: "Sua sessão expirou.", hint: "Saia do painel e entre de novo." });
      if (status === 404) throw new Falha({ code: "funcao_ausente", error: "A função de pesquisa não está publicada no Supabase.", hint: "Avise o Claude para publicar a Edge Function ci-ad-library." });
      if (status === 546 || status === 504) throw new Falha({ code: "tempo_excedido", error: "A pesquisa passou do tempo de espera.", hint: "Tente com menos resultados ou um termo mais específico." });
      if (/fetch|network/i.test(String(error.name || "") + String(error.message || ""))) throw new Falha({ code: "rede", error: "Não consegui falar com o servidor.", hint: "Confira sua internet e tente de novo." });
      throw new Falha({ code: "servidor_" + (status || "erro"), error: "O servidor respondeu com erro" + (status ? " (" + status + ")" : "") + ".", hint: "Tente de novo. Se continuar, mostre esta mensagem ao Claude." });
    }
    if (!data || data.ok === false || data.error) throw new Falha(data || { code: "sem_resposta", error: "A função respondeu vazia." });
    return data;
  }
  const erroBanco = (e) => {
    const m = String((e && e.message) || e || "");
    if (/row-level security|permission denied|JWT/i.test(m)) return "Sua sessão expirou. Saia do painel e entre de novo.";
    if (/null value in column "project_id"/i.test(m)) return "O banco ainda exige um projeto para guardar. Peça ao Claude para aplicar o ajuste de sql-creative-intelligence-library.sql.";
    if (/does not exist|schema cache/i.test(m)) return "Falta uma tabela ou coluna no banco. Aplique sql-creative-intelligence-library.sql no Supabase.";
    if (/Failed to fetch|network/i.test(m)) return "Sem conexão com o banco. Confira sua internet.";
    return m || "Erro desconhecido do banco.";
  };

  // ---------- estrutura ----------
  function montar() {
    const el = raiz(); if (!el) return;
    const atual = window.ciProjetoAtual && window.ciProjetoAtual();
    if (atual && atual.id && !st.projetoId) st.projetoId = atual.id;
    el.innerHTML = `<div class="cib">
      <div class="cib-topo">
        <div class="cib-abas" role="tablist">
          <button type="button" role="tab" data-act="aba" data-aba="pesquisa">${IC.busca}Pesquisar</button>
          <button type="button" role="tab" data-act="aba" data-aba="acervo">${IC.salvar}Minha biblioteca<span class="cib-conta" id="cib-n-acervo"></span></button>
          <button type="button" role="tab" data-act="aba" data-aba="historico">${IC.relogio}Histórico<span class="cib-conta" id="cib-n-hist"></span></button>
        </div>
        <label class="cib-vinculo" title="Referências e pesquisas novas ficam ligadas a este projeto">Guardar em<select id="cib-projeto"></select></label>
      </div>
      <div id="cib-aviso-conta"></div>
      <section data-cibpane="pesquisa">
        <form class="cib-busca" id="cib-form" autocomplete="off">
          <label class="cib-campo cib-termo"><span>Marca, produto ou palavra-chave</span><div class="cib-entrada">${IC.busca}<input id="cib-q" type="search" maxlength="180" placeholder="Ex.: hidratante corporal, Natura, sair do aluguel" enterkeyhint="search"></div></label>
          <label class="cib-campo"><span>País</span><select id="cib-pais">${PAISES.map((p) => `<option value="${p[0]}">${p[1]}</option>`).join("")}</select></label>
          <label class="cib-campo"><span>Formato</span><select id="cib-midia"><option value="all">Todos</option><option value="video">Vídeo</option><option value="image">Imagem</option></select></label>
          <label class="cib-campo"><span>Status</span><select id="cib-ativo"><option value="active">Ativos</option><option value="all">Todos</option></select></label>
          <label class="cib-campo cib-qtd"><span>Resultados</span><select id="cib-max"><option>10</option><option>20</option><option>30</option><option>50</option></select></label>
          <button class="cib-btn cib-forte" id="cib-buscar" type="submit">${IC.busca}<span>Pesquisar</span></button>
        </form>
        <div id="cib-resultados" aria-live="polite"></div>
      </section>
      <section data-cibpane="acervo" hidden><div id="cib-acervo"></div></section>
      <section data-cibpane="historico" hidden><div id="cib-historico"></div></section>
      <div class="cib-barra" id="cib-barra" hidden></div>
    </div>`;
    $("#cib-q", el).value = st.form.query || "";
    $("#cib-pais", el).value = st.form.country; $("#cib-midia", el).value = st.form.media;
    $("#cib-ativo", el).value = st.form.active; $("#cib-max", el).value = String(st.form.max);
    el.addEventListener("click", aoClicar);
    el.addEventListener("change", aoMudar);
    el.addEventListener("input", aoDigitar);
    el.addEventListener("error", aoFalharImagem, true);
    $("#cib-form", el).addEventListener("submit", (e) => { e.preventDefault(); pesquisar(); });
    pintarProjetos(); pintarAba(); pintarResultados(); pintarConta();
    carregarAcervo(); carregarHistorico(); conferirConta();
  }
  function pintarProjetos() {
    const s = $("#cib-projeto", raiz()); if (!s) return;
    if (st.projetoId && !projetos().some((p) => p.id === st.projetoId)) { if (projetos().length) st.projetoId = ""; }
    s.innerHTML = `<option value="">Biblioteca geral</option>` + projetos().map((p) => `<option value="${esc(p.id)}">${esc(nomeProjeto(p.id))}</option>`).join("");
    s.value = st.projetoId || "";
  }
  function pintarAba() {
    const el = raiz(); if (!el) return;
    $$("[data-cibpane]", el).forEach((p) => { p.hidden = p.dataset.cibpane !== st.aba; });
    $$('[data-act="aba"]', el).forEach((b) => { const on = b.dataset.aba === st.aba; b.classList.toggle("ativa", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
    pintarContagens(); pintarBarra();
    if (st.aba === "acervo") pintarAcervo();
    if (st.aba === "historico") pintarHistorico();
  }
  function pintarContagens() {
    const el = raiz(); if (!el) return;
    const a = $("#cib-n-acervo", el), h = $("#cib-n-hist", el);
    if (a) { a.textContent = st.acervoPronto ? st.acervo.length : ""; a.hidden = !st.acervoPronto; }
    if (h) { h.textContent = st.historicoPronto ? st.historico.length : ""; h.hidden = !st.historicoPronto; }
  }

  // ---------- conta do Apify (avisa antes de ela tentar pesquisar) ----------
  async function conferirConta() {
    if (st.conta && Date.now() - st.contaEm < 10 * 60000) return;
    try { st.conta = await chamar({ acao: "status" }); st.contaEm = Date.now(); } catch { st.conta = null; }
    pintarConta();
  }
  function pintarConta() {
    const el = $("#cib-aviso-conta", raiz()); if (!el) return;
    const c = st.conta; let titulo = "", texto = "";
    if (c && c.apify_token === false) { titulo = "A pesquisa está sem o token do Apify."; texto = "Cadastre o segredo APIFY_TOKEN nas Edge Functions do Supabase. Sua biblioteca e o histórico continuam funcionando."; }
    else if (c && c.apify && c.apify.valido === false) { titulo = "O Apify recusou o token cadastrado."; texto = "Pesquisas novas não vão funcionar até trocar o segredo APIFY_TOKEN no Supabase por um token válido (console.apify.com, Settings, API & Integrations). Sua biblioteca e o histórico continuam funcionando."; }
    else if (c && c.apify && c.apify.no_limite) { titulo = "O Apify atingiu o limite de uso deste mês."; texto = "Pesquisas novas voltam quando o ciclo renovar" + (c.apify.ciclo_termina ? " (" + fmtData(c.apify.ciclo_termina) + ")" : "") + " ou se o limite for aumentado em console.apify.com, Billing."; }
    el.innerHTML = titulo ? `<div class="cib-alerta">${IC.alerta}<div><b>${esc(titulo)}</b><p>${esc(texto)}</p></div></div>` : "";
  }

  // ---------- pesquisa ----------
  function lerForm() {
    const el = raiz();
    st.form = { query: $("#cib-q", el).value.trim(), country: $("#cib-pais", el).value, media: $("#cib-midia", el).value, active: $("#cib-ativo", el).value, max: Number($("#cib-max", el).value) || 20 };
    lembrar("cib-form", st.form);
    return st.form;
  }
  function travarBusca(on) {
    const el = raiz(); if (!el) return;
    const b = $("#cib-buscar", el); if (!b) return;
    b.disabled = on; b.classList.toggle("ocupado", on);
    $("span", b).textContent = on ? "Pesquisando" : "Pesquisar";
    $$("#cib-form select, #cib-form input", el).forEach((c) => { c.disabled = on; });
  }
  async function pesquisar() {
    if (st.buscando) return;
    const f = lerForm();
    if (f.query.length < 2) { toast("Digite uma marca, produto ou palavra-chave.", true); const q = $("#cib-q", raiz()); if (q) q.focus(); return; }
    st.buscando = true; st.erro = null; st.vazio = false; st.avisoHistorico = ""; st.sel.clear();
    st.aba = "pesquisa"; lembrar("cib-aba", st.aba); pintarAba();
    travarBusca(true);
    const inicio = Date.now();
    pintarCarregando(0);
    clearInterval(st.cronometro);
    st.cronometro = setInterval(() => { const s = $("#cib-tempo", raiz()); if (s) s.textContent = Math.round((Date.now() - inicio) / 1000) + " s"; }, 1000);
    try {
      const d = await chamar({ acao: "pesquisar", query: f.query, country: f.country, mediaType: f.media, activeOnly: f.active !== "all", maxResults: f.max });
      st.resultados = Array.isArray(d.ads) ? d.ads : [];
      st.meta = { query: d.query || f.query, country: d.country || f.country, media: d.media_type_filter || f.media, activeOnly: d.active_only !== false, quando: d.searched_at || new Date().toISOString(), url: d.library_search_url || urlMeta(f), total: d.total_in_library || null, doHistorico: false };
      st.vazio = !st.resultados.length;
      const linha = { project_id: st.projetoId || null, query: st.meta.query, country: st.meta.country, active_only: st.meta.activeOnly, media_type_filter: st.meta.media, result_count: st.resultados.length, results: st.resultados, library_search_url: st.meta.url };
      const salvo = await supa().from("creative_intelligence_searches").insert(linha).select("id,query,country,result_count,created_at,library_search_url,active_only,media_type_filter,project_id").single();
      if (salvo.error) st.avisoHistorico = "A pesquisa funcionou, mas não entrou no histórico: " + erroBanco(salvo.error);
      else { st.historico.unshift(salvo.data); st.historicoPronto = true; }
      if (st.resultados.length) toast(plural(st.resultados.length, "anúncio encontrado", "anúncios encontrados") + ".");
    } catch (e) {
      st.resultados = []; st.meta = null;
      st.erro = { titulo: e.message || "Não foi possível pesquisar.", dica: e.hint || "", codigo: e.code || "", url: urlMeta(f) };
      if (/^apify_/.test(e.code || "")) { st.contaEm = 0; conferirConta(); }
    } finally {
      clearInterval(st.cronometro); st.buscando = false; travarBusca(false);
      pintarResultados(); pintarContagens(); pintarBarra();
    }
  }
  function pintarCarregando() {
    const el = $("#cib-resultados", raiz()); if (!el) return;
    el.innerHTML = `<div class="cib-progresso"><span class="cib-giro"></span><div><b>Consultando a Biblioteca de Anúncios da Meta</b><p>Costuma levar de 20 a 60 segundos. Pode continuar com a página aberta. <span id="cib-tempo">0 s</span></p></div></div>
      <div class="cib-grade" aria-hidden="true">${Array.from({ length: 8 }, () => `<div class="cib-card cib-fantasma"><div class="cib-midia"></div><div class="cib-corpo"><i></i><i></i><i></i></div></div>`).join("")}</div>`;
  }

  function seloAtivo(a) {
    if (a.is_active === true) return `<span class="cib-selo ok">Ativo</span>`;
    if (a.is_active === false) return `<span class="cib-selo">Encerrado</span>`;
    return "";
  }
  function midia(a, grande) {
    const fmt = formatoDe(a);
    const img = urlSegura(a.preview_url) || urlSegura(a.image_url);
    const msg = fmt === "video" ? "Vídeo sem prévia disponível. Assista no anúncio original." : "A Meta não disponibilizou a imagem deste anúncio.";
    return `<div class="cib-midia${grande ? " grande" : ""}">
      ${img ? `<img src="${esc(img)}" alt="Criativo do anúncio de ${esc(a.page_name || "anunciante")}" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ""}
      <div class="cib-sem-midia"${img ? " hidden" : ""}>${fmt === "video" ? IC.video : IC.imagem}<span>${msg}</span></div>
      ${fmt === "video" && img ? `<span class="cib-play">${IC.video}</span>` : ""}
    </div>`;
  }
  function aoFalharImagem(e) {
    const img = e.target; if (!img || img.tagName !== "IMG" || !img.closest(".cib-midia")) return;
    const vazio = $(".cib-sem-midia", img.parentNode);
    img.remove();
    if (vazio) { vazio.hidden = false; const s = $("span", vazio); if (s) s.textContent = "A prévia expirou ou foi bloqueada. Veja no anúncio original."; }
    const play = $(".cib-play", vazio ? vazio.parentNode : document); if (play) play.remove();
  }
  function cartao(a, o) {
    const fmt = formatoDe(a), plats = plataformasDe(a), url = urlSegura(a.snapshot_url);
    const texto = a.body || a.description || "";
    const desde = a.start_date ? "Desde " + fmtData(a.start_date) : "";
    return `<article class="cib-card${o.marcado ? " marcado" : ""}">
      <div class="cib-topo-card">
        ${midia(a)}
        <label class="cib-check" title="Selecionar"><input type="checkbox" data-act="${o.tipo === "res" ? "sel" : "sel-acervo"}" data-k="${esc(o.k)}"${o.marcado ? " checked" : ""}><span>${IC.check}</span></label>
        <div class="cib-selos"><span class="cib-selo">${esc(FORMATOS[fmt])}</span>${seloAtivo(a)}${o.selo || ""}</div>
      </div>
      <div class="cib-corpo">
        <div class="cib-quem"><b title="${esc(a.page_name)}">${esc(a.page_name || "Anunciante não identificado")}</b>${desde ? `<span>${esc(desde)}</span>` : ""}</div>
        ${a.title ? `<h5>${esc(a.title)}</h5>` : ""}
        ${texto ? `<p class="cib-texto">${esc(texto)}</p>` : `<p class="cib-texto vazio">A Meta não devolveu o texto deste anúncio.</p>`}
        <div class="cib-rodape-info">${plats.length ? `<span>${esc(plats.slice(0, 3).join(", "))}${plats.length > 3 ? " +" + (plats.length - 3) : ""}</span>` : ""}${a.cta_text ? `<span class="cib-cta">${esc(a.cta_text)}</span>` : ""}${o.info || ""}</div>
      </div>
      <div class="cib-acoes">${url ? `<a class="cib-acao" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Abrir o anúncio original na Meta">${IC.fora}Original</a>` : `<span class="cib-acao off" title="A fonte não devolveu o link">${IC.fora}Sem link</span>`}${o.acoes}</div>
    </article>`;
  }
  const jaSalvo = (a) => !!(a && a.library_id && st.acervo.some((r) => r.library_id === a.library_id));

  function pintarResultados() {
    const el = $("#cib-resultados", raiz()); if (!el) return;
    if (st.buscando) return;
    if (st.erro) {
      const e = st.erro;
      el.innerHTML = `<div class="cib-estado erro">${IC.alerta}<h4>${esc(e.titulo)}</h4>${e.dica ? `<p>${esc(e.dica)}</p>` : ""}
        <div class="cib-estado-acoes"><button type="button" class="cib-btn cib-forte" data-act="buscar-de-novo">${IC.repetir}Tentar de novo</button><a class="cib-btn" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${IC.fora}Abrir esta busca na Meta</a></div>
        <small>Nenhum anúncio foi carregado nesta tentativa.${e.codigo ? " Código: " + esc(e.codigo) : ""}</small></div>`;
      return;
    }
    if (!st.meta) {
      const recentes = st.historico.slice(0, 5);
      el.innerHTML = `<div class="cib-estado inicio"><h4>Encontre anúncios reais para estudar</h4><p>Pesquise uma marca, um produto ou uma dor do público. Os resultados vêm da Biblioteca de Anúncios da Meta.</p>
        <ol class="cib-passos"><li><b>1</b><span>Pesquise e veja os criativos em grade</span></li><li><b>2</b><span>Guarde os melhores na sua biblioteca</span></li><li><b>3</b><span>Peça a análise e transforme em roteiro</span></li></ol>
        ${recentes.length ? `<div class="cib-recentes"><span>Pesquisas recentes</span>${recentes.map((h) => `<button type="button" class="cib-chip" data-act="hist-abrir" data-id="${esc(h.id)}">${esc(h.query)}<i>${h.result_count}</i></button>`).join("")}</div>` : ""}</div>`;
      return;
    }
    const m = st.meta;
    const filtros = [nomePais(m.country), m.media === "video" ? "só vídeo" : m.media === "image" ? "só imagem" : "", m.activeOnly ? "ativos" : "ativos e encerrados"].filter(Boolean).join(" · ");
    if (!st.resultados.length) {
      el.innerHTML = `<div class="cib-estado">${IC.busca}<h4>Nenhum anúncio encontrado para “${esc(m.query)}”</h4><p>${esc(filtros)}. Tente um termo mais simples, troque o país, inclua os encerrados ou tire o filtro de formato.</p>
        <div class="cib-estado-acoes"><a class="cib-btn" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">${IC.fora}Conferir na Meta</a></div>${st.avisoHistorico ? `<small>${esc(st.avisoHistorico)}</small>` : ""}</div>`;
      return;
    }
    const todos = st.sel.size === st.resultados.length;
    el.innerHTML = `<div class="cib-cab">
        <div><h4>${plural(st.resultados.length, "anúncio", "anúncios")} para “${esc(m.query)}”</h4><p>${esc(filtros)}${m.doHistorico ? " · pesquisa de " + esc(fmtQuando(m.quando)) : ""}${m.total ? " · a Meta lista " + Number(m.total).toLocaleString("pt-BR") + " no total" : ""}</p></div>
        <div class="cib-cab-acoes"><button type="button" class="cib-btn cib-mini" data-act="sel-todos">${todos ? "Limpar seleção" : "Selecionar todos"}</button><a class="cib-btn cib-mini" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">${IC.fora}Ver na Meta</a></div>
      </div>
      ${st.avisoHistorico ? `<div class="cib-nota">${esc(st.avisoHistorico)}</div>` : ""}
      <div class="cib-grade">${st.resultados.map((a, i) => {
        const salvo = jaSalvo(a);
        return cartao(a, { tipo: "res", k: i, marcado: st.sel.has(i), selo: salvo ? `<span class="cib-selo manteiga">Na biblioteca</span>` : "",
          acoes: `<button type="button" class="cib-acao" data-act="salvar-um" data-k="${i}"${salvo ? " disabled" : ""}>${salvo ? IC.salvo + "Salvo" : IC.salvar + "Salvar"}</button><button type="button" class="cib-acao" data-act="det-res" data-k="${i}">Detalhes</button>` });
      }).join("")}</div>`;
  }

  // ---------- barra de seleção ----------
  function pintarBarra() {
    const b = $("#cib-barra", raiz()); if (!b) return;
    const n = st.aba === "pesquisa" ? st.sel.size : st.aba === "acervo" ? st.selAcervo.size : 0;
    if (!n) { b.hidden = true; b.innerHTML = ""; return; }
    b.hidden = false;
    const trava = st.ocupado || st.analisando ? " disabled" : "";
    b.innerHTML = `<span><b>${n}</b> ${n === 1 ? "selecionado" : "selecionados"}</span><div>` + (st.aba === "pesquisa"
      ? `<button type="button" class="cib-btn" data-act="salvar-sel"${trava}>${IC.salvar}Salvar na biblioteca</button><button type="button" class="cib-btn cib-forte" data-act="analisar-sel"${trava}>${IC.brilho}${st.analisando ? "Analisando" : "Analisar com IA"}</button>`
      : `<button type="button" class="cib-btn cib-forte" data-act="analisar-acervo"${trava}>${IC.brilho}${st.analisando ? "Analisando" : "Analisar com IA"}</button><button type="button" class="cib-btn cib-perigo" data-act="excluir-sel"${trava}>${IC.lixo}Excluir</button>`)
      + `<button type="button" class="cib-btn cib-limpo" data-act="limpar-sel" title="Limpar seleção">${IC.x}</button></div>`;
  }

  // ---------- minha biblioteca ----------
  async function carregarAcervo(forcar) {
    if (st.acervoPronto && !forcar) { pintarContagens(); return; }
    const { data, error } = await supa().from("creative_intelligence_ads").select("*").order("created_at", { ascending: false }).limit(600);
    st.acervoErro = error ? erroBanco(error) : "";
    st.acervo = error ? [] : (data || []);
    st.acervoPronto = !error;
    pintarContagens();
    if (st.aba === "acervo") pintarAcervo();
    if (st.aba === "pesquisa" && st.meta && !st.buscando) pintarResultados();
  }
  function filtrados() {
    const f = st.filtros, q = f.q.trim().toLowerCase();
    return st.acervo.filter((r) => {
      const a = adDe(r);
      if (f.marca && (a.page_name || "") !== f.marca) return false;
      if (f.formato && formatoDe(a) !== f.formato) return false;
      if (f.categoria && extra(r, "categoria") !== f.categoria) return false;
      if (f.analise === "sim" && !r.analysis) return false;
      if (f.analise === "nao" && r.analysis) return false;
      if (q && !(textoDe(a) + " " + (a.page_name || "") + " " + (r.title || "") + " " + extra(r, "categoria") + " " + extra(r, "notas")).toLowerCase().includes(q)) return false;
      return true;
    });
  }
  const opcoes = (lista, atual, vazio) => `<option value="">${vazio}</option>` + lista.map((v) => `<option value="${esc(v)}"${v === atual ? " selected" : ""}>${esc(v)}</option>`).join("");
  function pintarAcervo() {
    const el = $("#cib-acervo", raiz()); if (!el) return;
    if (!st.acervoPronto) {
      el.innerHTML = st.acervoErro ? `<div class="cib-estado erro">${IC.alerta}<h4>Não consegui abrir sua biblioteca</h4><p>${esc(st.acervoErro)}</p><div class="cib-estado-acoes"><button type="button" class="cib-btn cib-forte" data-act="recarregar-acervo">${IC.repetir}Tentar de novo</button></div></div>`
        : `<div class="cib-progresso"><span class="cib-giro"></span><div><b>Abrindo sua biblioteca</b></div></div>`;
      return;
    }
    if (!st.acervo.length) {
      el.innerHTML = `<div class="cib-estado inicio">${IC.salvar}<h4>Sua biblioteca ainda está vazia</h4><p>Pesquise anúncios e toque em Salvar nos que valem estudo. Eles ficam aqui com análise, categoria e anotações.</p><div class="cib-estado-acoes"><button type="button" class="cib-btn cib-forte" data-act="aba" data-aba="pesquisa">${IC.busca}Pesquisar anúncios</button></div></div>`;
      return;
    }
    const marcas = [...new Set(st.acervo.map((r) => adDe(r).page_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const cats = [...new Set(st.acervo.map((r) => extra(r, "categoria")).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const fmts = [...new Set(st.acervo.map((r) => formatoDe(adDe(r))))];
    const lista = filtrados(), f = st.filtros;
    const semAnalise = st.acervo.filter((r) => !r.analysis).length;
    const comFiltro = f.q || f.marca || f.formato || f.categoria || f.analise;
    el.innerHTML = `<div class="cib-filtros">
        <div class="cib-entrada">${IC.busca}<input type="search" id="cib-fq" placeholder="Buscar na biblioteca" value="${esc(f.q)}"></div>
        <select data-filtro="marca" aria-label="Marca">${opcoes(marcas, f.marca, "Todas as marcas")}</select>
        <select data-filtro="formato" aria-label="Formato"><option value="">Todos os formatos</option>${fmts.map((x) => `<option value="${x}"${x === f.formato ? " selected" : ""}>${esc(FORMATOS[x])}</option>`).join("")}</select>
        ${cats.length ? `<select data-filtro="categoria" aria-label="Categoria">${opcoes(cats, f.categoria, "Todas as categorias")}</select>` : ""}
        <select data-filtro="analise" aria-label="Análise"><option value="">Com e sem análise</option><option value="nao"${f.analise === "nao" ? " selected" : ""}>Sem análise</option><option value="sim"${f.analise === "sim" ? " selected" : ""}>Analisadas</option></select>
      </div>
      <div class="cib-cab">
        <div><h4>${plural(lista.length, "referência", "referências")}${comFiltro ? " de " + st.acervo.length : ""}</h4><p>${semAnalise ? plural(semAnalise, "ainda sem análise", "ainda sem análise") : "Todas analisadas"}</p></div>
        <div class="cib-cab-acoes">${comFiltro ? `<button type="button" class="cib-btn cib-mini" data-act="limpar-filtros">Limpar filtros</button>` : ""}${st.conjuntos.length ? `<button type="button" class="cib-btn cib-mini" data-act="ver-conjunto">${IC.grade}Leituras de conjunto</button>` : ""}</div>
      </div>
      <div id="cib-acervo-grade">${gradeAcervo(lista)}</div>`;
  }
  function gradeAcervo(lista) {
    if (!lista.length) return `<div class="cib-estado">${IC.busca}<h4>Nada com esses filtros</h4><p>Mude a busca ou limpe os filtros para ver todas as referências.</p></div>`;
    return `<div class="cib-grade">${lista.map((r) => {
      const a = adDe(r), cat = extra(r, "categoria");
      return cartao(a, { tipo: "acervo", k: r.id, marcado: st.selAcervo.has(r.id),
        selo: r.analysis ? `<span class="cib-selo ok">Analisada</span>` : `<span class="cib-selo manteiga">Sem análise</span>`,
        info: cat ? `<span class="cib-cat">${esc(cat)}</span>` : "",
        acoes: `<button type="button" class="cib-acao" data-act="det" data-id="${esc(r.id)}">${r.analysis ? "Ver análise" : "Detalhes"}</button><button type="button" class="cib-acao so-icone" data-act="excluir" data-id="${esc(r.id)}" title="Excluir da biblioteca" aria-label="Excluir da biblioteca">${IC.lixo}</button>` });
    }).join("")}</div>`;
  }

  async function salvar(indices) {
    if (st.ocupado) return null;
    const ads = indices.map((i) => st.resultados[i]).filter(Boolean);
    if (!ads.length) return null;
    st.ocupado = true; pintarBarra();
    try {
      if (!st.acervoPronto) await carregarAcervo(true);
      if (!st.acervoPronto) throw new Error(st.acervoErro || "Não consegui abrir sua biblioteca.");
      const linhas = [], existentes = [], vistos = new Set();
      for (const a of ads) {
        const ja = a.library_id ? st.acervo.find((r) => r.library_id === a.library_id) : null;
        if (ja) { existentes.push(ja); continue; }
        if (a.library_id) { if (vistos.has(a.library_id)) continue; vistos.add(a.library_id); }
        linhas.push({
          project_id: st.projetoId || null,
          title: ((a.page_name || "Anunciante") + (a.title ? " · " + a.title : "")).slice(0, 240),
          url: urlSegura(a.snapshot_url) || (st.meta && st.meta.url) || "https://www.facebook.com/ads/library/",
          platform: "Meta Ad Library",
          performance_note: [a.is_active === true ? "Ativo" : a.is_active === false ? "Encerrado" : "", a.start_date ? "no ar desde " + fmtData(a.start_date) : ""].filter(Boolean).join(", "),
          transcript: a.text_for_analysis || [a.title, a.body, a.description].filter(Boolean).join("\n"),
          source: "meta_library", library_id: a.library_id || null,
          metadata: { ...a, busca: st.meta ? st.meta.query : "", salvo_em: new Date().toISOString() },
        });
      }
      let novos = [];
      if (linhas.length) {
        const { data, error } = await supa().from("creative_intelligence_ads").insert(linhas).select("*");
        if (error) throw new Error(erroBanco(error));
        novos = data || [];
        st.acervo = [...novos, ...st.acervo];
      }
      const partes = [];
      if (novos.length) partes.push(plural(novos.length, "referência salva", "referências salvas"));
      if (existentes.length) partes.push(plural(existentes.length, "já estava na biblioteca", "já estavam na biblioteca"));
      toast(partes.join(" · ") || "Nada para salvar.");
      if (window.ciAtualizarAnuncios) { try { await window.ciAtualizarAnuncios(); } catch { /* a lista do projeto atualiza na próxima abertura */ } }
      return [...novos, ...existentes];
    } catch (e) {
      toast("Não consegui salvar: " + (e.message || e), true);
      return null;
    } finally {
      st.ocupado = false; pintarContagens(); pintarResultados(); pintarBarra();
    }
  }

  async function excluir(ids) {
    if (st.ocupado || !ids.length) return;
    const ok = await confirmar(ids.length === 1 ? "Excluir esta referência da sua biblioteca?\nA análise e as anotações guardadas nela também serão apagadas." : `Excluir ${ids.length} referências da sua biblioteca?\nAs análises e anotações guardadas nelas também serão apagadas.`, { ok: "Excluir", perigo: true });
    if (!ok) return;
    st.ocupado = true; pintarBarra();
    const { error } = await supa().from("creative_intelligence_ads").delete().in("id", ids);
    st.ocupado = false;
    if (error) { toast("Não consegui excluir: " + erroBanco(error), true); pintarBarra(); return; }
    st.acervo = st.acervo.filter((r) => !ids.includes(r.id));
    ids.forEach((i) => st.selAcervo.delete(i));
    fecharJanela();
    toast(plural(ids.length, "referência excluída", "referências excluídas") + ".");
    pintarContagens(); pintarAcervo(); pintarBarra();
    if (st.meta) pintarResultados();
    if (window.ciAtualizarAnuncios) { try { await window.ciAtualizarAnuncios(); } catch { /* segue */ } }
  }

  // ---------- análise com IA ----------
  async function analisar(ids) {
    if (st.analisando || st.ocupado) return;
    let linhas = ids.map((id) => st.acervo.find((r) => r.id === id)).filter(Boolean);
    if (!linhas.length) return;
    if (linhas.length > MAX_ANALISE) { toast(`A análise lê até ${MAX_ANALISE} anúncios por vez. Desmarque alguns e peça de novo.`, true); return; }
    const semTexto = linhas.filter((r) => (textoDe(adDe(r)) + extra(r, "transcricao")).trim().length < 12);
    linhas = linhas.filter((r) => !semTexto.includes(r));
    if (!linhas.length) { toast("Esses anúncios não têm texto. Abra os detalhes, cole a transcrição ou a descrição do vídeo e analise de novo.", true); return; }
    st.analisando = true; pintarBarra(); pintarJanelaOcupada(true);
    toast(linhas.length === 1 ? "Analisando o anúncio. Leva alguns segundos." : `Analisando ${linhas.length} anúncios. Leva alguns segundos.`);
    try {
      const p = projetos().find((x) => x.id === st.projetoId);
      const d = await chamar({ acao: "analisar", ads: linhas.map((r) => ({ ...adDe(r), transcript: extra(r, "transcricao") })), projeto: p ? { brand: p.brand, product: p.product, objective: p.objective, audience: p.audience } : null });
      const analises = Array.isArray(d.analises) ? d.analises : [];
      let gravadas = 0, falhou = "";
      for (let i = 0; i < analises.length; i++) {
        const an = analises[i];
        const r = linhas[Number.isInteger(an.indice) ? an.indice : i]; if (!r) continue;
        const { indice, ...limpa } = an;
        const quando = new Date().toISOString();
        const { error } = await supa().from("creative_intelligence_ads").update({ analysis: limpa, analyzed_at: quando }).eq("id", r.id);
        if (error) { falhou = erroBanco(error); continue; }
        r.analysis = limpa; r.analyzed_at = quando; gravadas++;
      }
      if (falhou) toast("A análise ficou pronta, mas não consegui guardar todas: " + falhou, true);
      else toast((gravadas === 1 ? "Análise pronta e guardada na referência." : gravadas + " análises prontas e guardadas.") + (semTexto.length ? " " + plural(semTexto.length, "ficou de fora por não ter texto.", "ficaram de fora por não ter texto.") : ""));
      if (linhas.length > 1 && (d.padroes || (d.ideias || []).length)) {
        st.conjuntos = [{ em: d.em || new Date().toISOString(), ids: linhas.map((r) => r.id), nomes: linhas.map((r) => adDe(r).page_name || r.title), padroes: d.padroes || null, ideias: d.ideias || [] }, ...st.conjuntos].slice(0, 8);
        lembrar("cib-conjuntos", st.conjuntos);
      }
      st.selAcervo.clear(); st.sel.clear();
      st.analisando = false;
      pintarContagens(); if (st.aba === "acervo") pintarAcervo(); pintarBarra();
      if (linhas.length === 1) abrirReferencia(linhas[0].id, d.ideias || []);
      else abrirConjunto(0);
      if (window.ciAtualizarAnuncios) { try { await window.ciAtualizarAnuncios(); } catch { /* segue */ } }
    } catch (e) {
      st.analisando = false; pintarBarra(); pintarJanelaOcupada(false);
      toast((e.message || "A análise não saiu.") + (e.hint ? " " + e.hint : ""), true);
    }
  }
  async function analisarDaPesquisa() {
    if (st.sel.size > MAX_ANALISE) { toast(`A análise lê até ${MAX_ANALISE} anúncios por vez. Desmarque alguns e peça de novo.`, true); return; }
    const linhas = await salvar([...st.sel]);
    if (!linhas || !linhas.length) return;
    st.aba = "acervo"; lembrar("cib-aba", st.aba); pintarAba();
    await analisar(linhas.map((r) => r.id));
  }

  const itens = (v) => (Array.isArray(v) ? v : []).filter(Boolean);
  const bloco = (rotulo, valor) => {
    if (Array.isArray(valor)) return itens(valor).length ? `<div class="cib-an"><dt>${rotulo}</dt><dd><ul>${itens(valor).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></dd></div>` : "";
    return valor ? `<div class="cib-an"><dt>${rotulo}</dt><dd>${esc(valor)}</dd></div>` : "";
  };
  function ideiaHtml(texto, i, origem) {
    return `<li><p>${esc(texto)}</p><div><button type="button" class="cib-btn cib-mini" data-jact="roteiro-ideia" data-origem="${origem}" data-i="${i}">${IC.roteiro}Criar roteiro</button><button type="button" class="cib-btn cib-mini" data-jact="guardar-ideia" data-origem="${origem}" data-i="${i}">${IC.ideia}Guardar ideia</button></div></li>`;
  }
  function analiseHtml(an) {
    if (!an) return "";
    if (an.tipo === "anuncio") {
      return `<dl class="cib-analise">${bloco("Gancho", an.gancho)}${bloco("Abordagem criativa", an.abordagem)}${bloco("Problema apresentado", an.problema)}${bloco("Solução oferecida", an.solucao)}${bloco("Benefícios destacados", an.beneficios)}${bloco("Argumentos de venda", an.argumentos)}${bloco("Estrutura narrativa", an.estrutura)}${bloco("CTA", an.cta)}${bloco("Linguagem", an.linguagem)}${bloco("Identificação com o público", an.identificacao)}${bloco("Por que pode gerar interesse (hipóteses)", an.motivos)}${bloco("Como adaptar sem copiar", an.como_adaptar)}</dl>
        ${itens(an.ideias).length ? `<h6>Ideias a partir deste anúncio</h6><ul class="cib-ideias">${an.ideias.map((x, i) => ideiaHtml(x, i, "ref")).join("")}</ul>` : ""}
        <p class="cib-limite">${esc(an.limites || "Análise feita só com o texto disponível.")}${an.em ? " Feita em " + esc(fmtQuando(an.em)) + "." : ""}</p>`;
    }
    const o = an.observado || {}, i = an.interpretacao || {};
    return `<dl class="cib-analise">${bloco("Gancho", o.gancho)}${bloco("Formato", o.formato)}${bloco("Estrutura", o.estrutura)}${bloco("Ritmo", o.ritmo)}${bloco("Argumentos", o.argumentos)}${bloco("CTA", o.cta)}${bloco("Por que pode funcionar (hipótese)", i.por_que_funciona)}${bloco("Público", i.publico)}${bloco("Emoção", i.emocao)}${bloco("Como adaptar sem copiar", i.como_adaptar)}</dl>
      ${itens(an.ideias).length ? `<h6>Ideias a partir deste anúncio</h6><ul class="cib-ideias">${an.ideias.map((x, k) => ideiaHtml(x, k, "ref")).join("")}</ul>` : ""}
      <p class="cib-limite">Análise feita pela Skill UGC com o texto disponível.</p>`;
  }

  // ---------- janela (detalhes, análise, leitura de conjunto) ----------
  let janela = null, ctx = null;
  function criarJanela() {
    if (janela && document.body.contains(janela)) return janela;
    janela = document.createElement("dialog");
    janela.className = "cib-janela";
    janela.innerHTML = `<div class="cib-j-topo"><b id="cib-j-titulo"></b><button type="button" class="cib-j-fechar" data-jact="fechar" aria-label="Fechar">${IC.x}</button></div><div class="cib-j-corpo" id="cib-j-corpo"></div>`;
    document.body.appendChild(janela);
    janela.addEventListener("click", (e) => { if (e.target === janela) fecharJanela(); else aoClicarJanela(e); });
    janela.addEventListener("error", aoFalharImagem, true);
    janela.addEventListener("close", () => { ctx = null; });
    return janela;
  }
  function mostrarJanela(titulo, html) {
    const j = criarJanela();
    $("#cib-j-titulo", j).textContent = titulo;
    const c = $("#cib-j-corpo", j); c.innerHTML = html; c.scrollTop = 0;
    if (!j.open) j.showModal();
  }
  function fecharJanela() { if (janela && janela.open) janela.close(); }
  function pintarJanelaOcupada(on) {
    if (!janela || !janela.open) return;
    $$("button[data-jact]", janela).forEach((b) => { if (b.dataset.jact !== "fechar") b.disabled = on; });
    const b = $('[data-jact="analisar"]', janela); if (b) b.lastChild.textContent = on ? "Analisando" : (ctx && ctx.linha && ctx.linha.analysis ? "Analisar de novo" : "Analisar com IA");
  }
  function fichaHtml(a) {
    const plats = plataformasDe(a), paises = (Array.isArray(a.countries) ? a.countries : []).slice(0, 10);
    const linha = (r, v) => v ? `<div><dt>${r}</dt><dd>${v}</dd></div>` : "";
    const destino = urlSegura(a.link_url);
    return `<dl class="cib-ficha">
      ${linha("Formato", esc(FORMATOS[formatoDe(a)]))}
      ${linha("Status", a.is_active === true ? "Ativo" : a.is_active === false ? "Encerrado" : "Não informado pela fonte")}
      ${linha("Início", esc(fmtData(a.start_date)) || "Não informado")}
      ${a.stop_date ? linha(a.is_active === false ? "Fim" : "Visto pela última vez", esc(fmtData(a.stop_date))) : ""}
      ${linha("Plataformas", esc(plats.join(", ")) || "Não informado")}
      ${paises.length ? linha("Países", esc(paises.map(nomePais).join(", ")) + (a.countries.length > 10 ? " e outros" : "")) : ""}
      ${a.cta_text ? linha("Botão (CTA)", esc(a.cta_text)) : ""}
      ${destino ? linha("Destino", `<a href="${esc(destino)}" target="_blank" rel="noopener noreferrer">${esc(a.display_url || destino.replace(/^https?:\/\//, "").slice(0, 60))}</a>`) : ""}
      ${a.library_id ? linha("ID na biblioteca", esc(a.library_id)) : ""}
    </dl>`;
  }
  function textoAnuncioHtml(a) {
    const cards = (Array.isArray(a.cards) ? a.cards : []).filter((c) => c.title || c.body || c.image_url);
    return `<div class="cib-j-texto">
      ${a.title ? `<h5>${esc(a.title)}</h5>` : ""}
      ${a.body ? `<p>${esc(a.body)}</p>` : `<p class="vazio">A Meta não devolveu o texto principal deste anúncio.</p>`}
      ${a.description ? `<p class="desc">${esc(a.description)}</p>` : ""}
    </div>
    ${cards.length > 1 ? `<h6>Cartões do carrossel</h6><div class="cib-cartoes">${cards.map((c) => `<div>${urlSegura(c.image_url) ? `<div class="cib-midia"><img src="${esc(c.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer"><div class="cib-sem-midia" hidden>${IC.imagem}<span>Prévia indisponível</span></div></div>` : ""}${c.title ? `<b>${esc(c.title)}</b>` : ""}${c.body ? `<span>${esc(c.body)}</span>` : ""}</div>`).join("")}</div>` : ""}`;
  }
  function linksHtml(a) {
    const url = urlSegura(a.snapshot_url), video = urlSegura(a.video_url);
    return `${url ? `<a class="cib-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${IC.fora}Ver anúncio original</a>` : ""}${video ? `<a class="cib-btn" href="${esc(video)}" target="_blank" rel="noopener noreferrer">${IC.video}Abrir o vídeo</a>` : ""}`;
  }
  function abrirResultado(i) {
    const a = st.resultados[i]; if (!a) return;
    ctx = { tipo: "res", i };
    const salvo = jaSalvo(a);
    mostrarJanela(a.page_name || "Anúncio", `<div class="cib-j-grid"><div>${midia(a, true)}<div class="cib-j-links">${linksHtml(a)}</div></div>
      <div><div class="cib-selos solto"><span class="cib-selo">${esc(FORMATOS[formatoDe(a)])}</span>${seloAtivo(a)}${salvo ? `<span class="cib-selo manteiga">Na biblioteca</span>` : ""}</div>
      ${textoAnuncioHtml(a)}${fichaHtml(a)}
      <div class="cib-j-acoes"><button type="button" class="cib-btn" data-jact="salvar"${salvo ? " disabled" : ""}>${salvo ? IC.salvo + "Já está na biblioteca" : IC.salvar + "Salvar na biblioteca"}</button><button type="button" class="cib-btn cib-forte" data-jact="salvar-analisar">${IC.brilho}Salvar e analisar com IA</button></div>
      <p class="cib-limite">Os dados são os que a Biblioteca de Anúncios da Meta disponibiliza. Ela não informa alcance, cliques nem resultado de anúncios comerciais.</p></div></div>`);
  }
  function abrirReferencia(id, ideiasGerais) {
    const r = st.acervo.find((x) => x.id === id); if (!r) return;
    const a = adDe(r);
    ctx = { tipo: "ref", id, linha: r, ideiasGerais: ideiasGerais || [] };
    const cats = [...new Set(st.acervo.map((x) => extra(x, "categoria")).filter(Boolean))];
    const proj = r.project_id ? nomeProjeto(r.project_id) : "";
    mostrarJanela(a.page_name || r.title || "Referência", `<div class="cib-j-grid"><div>${midia(a, true)}<div class="cib-j-links">${linksHtml(a)}</div>${fichaHtml(a)}
        <p class="cib-limite">Salva em ${esc(fmtQuando(r.created_at))}${proj ? " · projeto " + esc(proj) : ""}${a.busca ? " · pesquisa “" + esc(a.busca) + "”" : ""}</p></div>
      <div>
        <div class="cib-selos solto"><span class="cib-selo">${esc(FORMATOS[formatoDe(a)])}</span>${seloAtivo(a)}${r.analysis ? `<span class="cib-selo ok">Analisada</span>` : `<span class="cib-selo manteiga">Sem análise</span>`}</div>
        ${textoAnuncioHtml(a)}
        <section class="cib-j-sec"><div class="cib-j-sec-cab"><h6>Análise estratégica</h6><button type="button" class="cib-btn cib-mini cib-forte" data-jact="analisar"${st.analisando ? " disabled" : ""}>${IC.brilho}${r.analysis ? "Analisar de novo" : "Analisar com IA"}</button></div>
          ${r.analysis ? analiseHtml(r.analysis) : `<p class="cib-limite">Ainda sem análise. A IA lê o texto do anúncio e o que você colar abaixo. Ela não assiste ao vídeo nem vê a imagem.</p>`}
          ${ctx.ideiasGerais.length ? `<h6>Ideias novas</h6><ul class="cib-ideias">${ctx.ideiasGerais.map((x, i) => ideiaHtml([x.titulo, x.gancho && "Gancho: " + x.gancho, x.angulo, x.formato].filter(Boolean).join(" · "), i, "geral")).join("")}</ul>` : ""}
        </section>
        <section class="cib-j-sec"><h6>Suas anotações</h6>
          <label class="cib-campo"><span>Categoria</span><input id="cib-j-cat" list="cib-j-cats" maxlength="60" placeholder="Ex.: Skincare, Gancho de dor, Depoimento" value="${esc(extra(r, "categoria"))}"><datalist id="cib-j-cats">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></label>
          <label class="cib-campo"><span>Transcrição ou descrição do vídeo (opcional, entra na análise)</span><textarea id="cib-j-trans" rows="4" maxlength="4000" placeholder="Cole a fala do vídeo ou descreva o que acontece nele.">${esc(extra(r, "transcricao"))}</textarea></label>
          <label class="cib-campo"><span>Notas</span><textarea id="cib-j-notas" rows="2" maxlength="2000" placeholder="O que chamou sua atenção nesta referência.">${esc(extra(r, "notas"))}</textarea></label>
          <div class="cib-j-acoes"><button type="button" class="cib-btn" data-jact="anotar">Salvar anotações</button></div>
        </section>
        <div class="cib-j-acoes fim"><button type="button" class="cib-btn cib-forte" data-jact="roteiro">${IC.roteiro}Criar roteiro com a Skill UGC</button><button type="button" class="cib-btn cib-perigo" data-jact="excluir">${IC.lixo}Excluir</button></div>
      </div></div>`);
  }
  function abrirConjunto(i) {
    const c = st.conjuntos[i]; if (!c) return;
    ctx = { tipo: "conjunto", i };
    const p = c.padroes || {};
    const refs = (c.ids || []).map((id, k) => ({ id, nome: (c.nomes || [])[k] || "Referência", existe: st.acervo.some((r) => r.id === id) }));
    mostrarJanela("Leitura do conjunto", `<div class="cib-conjunto">
      ${st.conjuntos.length > 1 ? `<label class="cib-campo"><span>Leituras guardadas neste aparelho</span><select id="cib-j-conj">${st.conjuntos.map((x, k) => `<option value="${k}"${k === i ? " selected" : ""}>${esc(fmtQuando(x.em))} · ${esc((x.nomes || []).slice(0, 3).join(", "))}${(x.nomes || []).length > 3 ? " e mais " + ((x.nomes || []).length - 3) : ""}</option>`).join("")}</select></label>` : ""}
      <p class="cib-limite">${plural(refs.length, "anúncio analisado", "anúncios analisados")} em ${esc(fmtQuando(c.em))}. Leitura feita só com os textos; a IA não viu imagens nem vídeos.</p>
      ${p.resumo ? `<p class="cib-resumo">${esc(p.resumo)}</p>` : ""}
      <dl class="cib-analise duas">${bloco("Ganchos que se repetem", p.ganchos)}${bloco("Abordagens que se repetem", p.abordagens)}${bloco("Estruturas", p.estruturas)}${bloco("Padrões de CTA", p.ctas)}${bloco("Oportunidades que ninguém explorou", p.oportunidades)}</dl>
      ${itens(c.ideias).length ? `<h6>Ideias novas a partir do conjunto</h6><ul class="cib-ideias">${c.ideias.map((x, k) => ideiaHtml([x.titulo, x.gancho && "Gancho: " + x.gancho, x.angulo, x.formato].filter(Boolean).join(" · "), k, "conjunto")).join("")}</ul>` : ""}
      <h6>Análise de cada anúncio</h6><div class="cib-refs">${refs.map((r) => r.existe ? `<button type="button" class="cib-chip" data-jact="abrir-ref" data-id="${esc(r.id)}">${esc(r.nome)}</button>` : `<span class="cib-chip off">${esc(r.nome)} (excluída)</span>`).join("")}</div>
    </div>`);
    const s = $("#cib-j-conj", janela); if (s) s.onchange = () => abrirConjunto(Number(s.value) || 0);
  }
  function textoDaIdeia(origem, i) {
    if (!ctx) return "";
    if (origem === "ref") { const an = ctx.linha && ctx.linha.analysis; return String((an && an.ideias && an.ideias[i]) || ""); }
    const lista = origem === "geral" ? ctx.ideiasGerais : ((st.conjuntos[ctx.i] || {}).ideias || []);
    const x = lista && lista[i]; if (!x) return "";
    return [x.titulo, x.gancho ? "Gancho: " + x.gancho : "", x.angulo ? "Ângulo: " + x.angulo : "", x.formato ? "Formato: " + x.formato : ""].filter(Boolean).join("\n");
  }
  function irParaSkill(pedido) {
    if (!window.painelSkill || !window.painelSkill.criarRoteiro) { toast("O editor de roteiros não carregou. Recarregue a página.", true); return; }
    fecharJanela();
    window.painelSkill.criarRoteiro(pedido);
  }
  function referenciaParaSkill(r) {
    const a = adDe(r), an = r.analysis || null;
    return { fonte: "anuncio", id: r.id, link: urlSegura(a.snapshot_url) || r.url || "", titulo: (a.page_name || r.title || "Anúncio") + (a.title ? " · " + a.title : ""), perfil: a.page_name || "", legenda: String([a.title, a.body, a.description].filter(Boolean).join("\n")).slice(0, 600), transcricao: String(extra(r, "transcricao") || [a.title, a.body, a.description].filter(Boolean).join("\n")).slice(0, 2500), gancho: (an && (an.gancho || (an.observado && an.observado.gancho))) || "", analise_skill: an };
  }
  async function guardarIdeia(texto, botao) {
    if (!texto) return;
    botao.disabled = true;
    const r = ctx && ctx.linha, a = r ? adDe(r) : null;
    const linhas = texto.split("\n");
    const { error } = await supa().from("ideias_organizadas").insert({
      titulo: linhas[0].replace(/^["“]|["”]$/g, "").slice(0, 140), resumo: texto.slice(0, 500), texto,
      gancho: (linhas.find((l) => /^Gancho:/.test(l)) || "").replace(/^Gancho:\s*/, "") || null,
      finalidade: "Conteúdos", situacao: "desenvolver", link: a ? (urlSegura(a.snapshot_url) || null) : null,
      notas: "Creative Intelligence · Biblioteca de Anúncios" + (a && a.page_name ? " · referência: " + a.page_name : ""),
    });
    if (error) { botao.disabled = false; toast("Não consegui guardar a ideia: " + erroBanco(error), true); return; }
    botao.innerHTML = IC.check + "Guardada";
    toast("Ideia guardada no Banco de ideias, em Conteúdos.");
  }
  async function anotar(botao) {
    const r = ctx && ctx.linha; if (!r) return;
    botao.disabled = true;
    const metadata = { ...(r.metadata && typeof r.metadata === "object" ? r.metadata : {}), categoria: $("#cib-j-cat", janela).value.trim(), transcricao: $("#cib-j-trans", janela).value.trim(), notas: $("#cib-j-notas", janela).value.trim() };
    const { error } = await supa().from("creative_intelligence_ads").update({ metadata }).eq("id", r.id);
    botao.disabled = false;
    if (error) { toast("Não consegui salvar as anotações: " + erroBanco(error), true); return false; }
    r.metadata = metadata;
    toast("Anotações salvas.");
    if (st.aba === "acervo") pintarAcervo();
    return true;
  }
  async function aoClicarJanela(e) {
    const b = e.target.closest("[data-jact]"); if (!b || b.disabled) return;
    const act = b.dataset.jact;
    if (act === "fechar") return fecharJanela();
    if (!ctx) return;
    if (act === "salvar" || act === "salvar-analisar") {
      const linhas = await salvar([ctx.i]);
      if (!linhas || !linhas.length) return;
      if (act === "salvar") { abrirResultado(ctx ? ctx.i : -1); return; }
      st.aba = "acervo"; lembrar("cib-aba", st.aba); pintarAba();
      abrirReferencia(linhas[0].id);
      await analisar([linhas[0].id]);
      return;
    }
    if (act === "abrir-ref") return abrirReferencia(b.dataset.id);
    if (act === "analisar") {
      const id = ctx.id;
      const mudou = ctx.linha && ($("#cib-j-trans", janela).value.trim() !== extra(ctx.linha, "transcricao") || $("#cib-j-cat", janela).value.trim() !== extra(ctx.linha, "categoria") || $("#cib-j-notas", janela).value.trim() !== extra(ctx.linha, "notas"));
      if (mudou) { const ok = await anotar(b); if (ok === false) return; }
      return analisar([id]);
    }
    if (act === "anotar") return anotar(b);
    if (act === "excluir") return excluir([ctx.id]);
    if (act === "roteiro") return irParaSkill({ referencia: referenciaParaSkill(ctx.linha) });
    if (act === "roteiro-ideia") {
      const texto = textoDaIdeia(b.dataset.origem, Number(b.dataset.i)); if (!texto) return;
      return irParaSkill({ ideia: texto, referencia: ctx.linha ? referenciaParaSkill(ctx.linha) : null });
    }
    if (act === "guardar-ideia") return guardarIdeia(textoDaIdeia(b.dataset.origem, Number(b.dataset.i)), b);
  }

  // ---------- histórico ----------
  async function carregarHistorico(forcar) {
    if (st.historicoPronto && !forcar) { pintarContagens(); return; }
    const { data, error } = await supa().from("creative_intelligence_searches").select("id,query,country,result_count,created_at,library_search_url,active_only,media_type_filter,project_id").order("created_at", { ascending: false }).limit(80);
    st.historicoErro = error ? erroBanco(error) : "";
    st.historico = error ? [] : (data || []);
    st.historicoPronto = !error;
    pintarContagens();
    if (st.aba === "historico") pintarHistorico();
    if (st.aba === "pesquisa" && !st.meta && !st.buscando && !st.erro) pintarResultados();
  }
  function pintarHistorico() {
    const el = $("#cib-historico", raiz()); if (!el) return;
    if (!st.historicoPronto) {
      el.innerHTML = st.historicoErro ? `<div class="cib-estado erro">${IC.alerta}<h4>Não consegui abrir o histórico</h4><p>${esc(st.historicoErro)}</p><div class="cib-estado-acoes"><button type="button" class="cib-btn cib-forte" data-act="recarregar-hist">${IC.repetir}Tentar de novo</button></div></div>`
        : `<div class="cib-progresso"><span class="cib-giro"></span><div><b>Abrindo o histórico</b></div></div>`;
      return;
    }
    if (!st.historico.length) {
      el.innerHTML = `<div class="cib-estado inicio">${IC.relogio}<h4>Nenhuma pesquisa ainda</h4><p>Cada pesquisa fica guardada aqui com os resultados daquele dia, para você reabrir sem pesquisar de novo.</p></div>`;
      return;
    }
    el.innerHTML = `<div class="cib-cab"><div><h4>${plural(st.historico.length, "pesquisa", "pesquisas")}</h4><p>Reabrir mostra os resultados guardados no dia da pesquisa e não gasta crédito do Apify.</p></div></div>
      <div class="cib-tabela" role="table">
        <div class="cib-linha cab" role="row"><span>Termo</span><span>País</span><span>Filtros</span><span>Data</span><span>Resultados</span><span></span></div>
        ${st.historico.map((h) => `<div class="cib-linha" role="row">
          <span class="termo"><b>${esc(h.query)}</b>${h.project_id && nomeProjeto(h.project_id) ? `<i>${esc(nomeProjeto(h.project_id))}</i>` : ""}</span>
          <span data-r="País">${esc(nomePais(h.country))}</span>
          <span data-r="Filtros">${h.media_type_filter === "video" ? "Vídeo" : h.media_type_filter === "image" ? "Imagem" : "Todos os formatos"} · ${h.active_only === false ? "todos" : "ativos"}</span>
          <span data-r="Data">${esc(fmtQuando(h.created_at))}</span>
          <span data-r="Resultados">${h.result_count}</span>
          <span class="acoes"><button type="button" class="cib-btn cib-mini cib-forte" data-act="hist-abrir" data-id="${esc(h.id)}"${h.result_count ? "" : " disabled"}>Abrir</button><button type="button" class="cib-btn cib-mini" data-act="hist-refazer" data-id="${esc(h.id)}" title="Pesquisar de novo agora">${IC.repetir}</button><button type="button" class="cib-btn cib-mini" data-act="hist-excluir" data-id="${esc(h.id)}" title="Apagar do histórico" aria-label="Apagar do histórico">${IC.lixo}</button></span>
        </div>`).join("")}
      </div>`;
  }
  function preencherForm(h) {
    const el = raiz();
    st.form = { ...st.form, query: h.query || "", country: h.country || "BR", media: h.media_type_filter || "all", active: h.active_only === false ? "all" : "active" };
    $("#cib-q", el).value = st.form.query; $("#cib-pais", el).value = st.form.country;
    if (![...$("#cib-pais", el).options].some((o) => o.value === st.form.country)) { $("#cib-pais", el).insertAdjacentHTML("beforeend", `<option value="${esc(st.form.country)}">${esc(st.form.country)}</option>`); $("#cib-pais", el).value = st.form.country; }
    $("#cib-midia", el).value = st.form.media; $("#cib-ativo", el).value = st.form.active;
    lembrar("cib-form", st.form);
  }
  async function abrirHistorico(id, botao) {
    const h = st.historico.find((x) => x.id === id); if (!h || st.buscando) return;
    if (botao) botao.disabled = true;
    const { data, error } = await supa().from("creative_intelligence_searches").select("results").eq("id", id).single();
    if (botao) botao.disabled = false;
    if (error) { toast("Não consegui abrir essa pesquisa: " + erroBanco(error), true); return; }
    st.resultados = Array.isArray(data.results) ? data.results : [];
    st.sel.clear(); st.erro = null; st.avisoHistorico = "";
    preencherForm(h);
    st.meta = { query: h.query, country: h.country, media: h.media_type_filter || "all", activeOnly: h.active_only !== false, quando: h.created_at, url: h.library_search_url || urlMeta(st.form), total: null, doHistorico: true };
    st.aba = "pesquisa"; lembrar("cib-aba", st.aba); pintarAba(); pintarResultados();
    const topo = raiz(); if (topo && topo.scrollIntoView) topo.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  async function excluirHistorico(id) {
    const h = st.historico.find((x) => x.id === id); if (!h) return;
    const ok = await confirmar(`Apagar a pesquisa “${h.query}” do histórico?\nAs referências que você já salvou continuam na sua biblioteca.`, { ok: "Apagar", perigo: true });
    if (!ok) return;
    const { error } = await supa().from("creative_intelligence_searches").delete().eq("id", id);
    if (error) { toast("Não consegui apagar: " + erroBanco(error), true); return; }
    st.historico = st.historico.filter((x) => x.id !== id);
    toast("Pesquisa apagada do histórico."); pintarContagens(); pintarHistorico();
  }

  // ---------- eventos ----------
  let tempoFiltro = null;
  function aoDigitar(e) {
    if (e.target.id !== "cib-fq") return;
    st.filtros.q = e.target.value;
    clearTimeout(tempoFiltro);
    tempoFiltro = setTimeout(() => {
      const g = $("#cib-acervo-grade", raiz()), lista = filtrados();
      if (g) g.innerHTML = gradeAcervo(lista);
      const h = $("#cib-acervo .cib-cab h4", raiz()); if (h) h.textContent = plural(lista.length, "referência", "referências") + " de " + st.acervo.length;
    }, 160);
  }
  function aoMudar(e) {
    const t = e.target;
    if (t.id === "cib-projeto") { st.projetoId = t.value; return; }
    if (t.dataset.filtro) { st.filtros[t.dataset.filtro] = t.value; pintarAcervo(); return; }
    if (t.dataset.act === "sel") { const i = Number(t.dataset.k); t.checked ? st.sel.add(i) : st.sel.delete(i); t.closest(".cib-card").classList.toggle("marcado", t.checked); pintarBarra(); const b = $('[data-act="sel-todos"]', raiz()); if (b) b.textContent = st.sel.size === st.resultados.length ? "Limpar seleção" : "Selecionar todos"; return; }
    if (t.dataset.act === "sel-acervo") { const id = t.dataset.k; t.checked ? st.selAcervo.add(id) : st.selAcervo.delete(id); t.closest(".cib-card").classList.toggle("marcado", t.checked); pintarBarra(); }
  }
  async function aoClicar(e) {
    const b = e.target.closest("[data-act]"); if (!b || b.disabled || b.tagName === "INPUT") return;
    const act = b.dataset.act;
    if (act === "aba") { st.aba = b.dataset.aba; lembrar("cib-aba", st.aba); pintarAba(); return; }
    if (act === "buscar-de-novo") return pesquisar();
    if (act === "sel-todos") { if (st.sel.size === st.resultados.length) st.sel.clear(); else st.resultados.forEach((_, i) => st.sel.add(i)); pintarResultados(); pintarBarra(); return; }
    if (act === "salvar-um") { b.disabled = true; const r = await salvar([Number(b.dataset.k)]); if (!r) b.disabled = false; return; }
    if (act === "det-res") return abrirResultado(Number(b.dataset.k));
    if (act === "salvar-sel") { const r = await salvar([...st.sel]); if (r) { st.sel.clear(); pintarResultados(); pintarBarra(); } return; }
    if (act === "analisar-sel") return analisarDaPesquisa();
    if (act === "analisar-acervo") return analisar([...st.selAcervo]);
    if (act === "excluir-sel") return excluir([...st.selAcervo]);
    if (act === "limpar-sel") { st.sel.clear(); st.selAcervo.clear(); if (st.aba === "pesquisa") pintarResultados(); else pintarAcervo(); pintarBarra(); return; }
    if (act === "det") return abrirReferencia(b.dataset.id);
    if (act === "excluir") return excluir([b.dataset.id]);
    if (act === "limpar-filtros") { st.filtros = { q: "", marca: "", formato: "", categoria: "", analise: "" }; pintarAcervo(); return; }
    if (act === "ver-conjunto") return abrirConjunto(0);
    if (act === "recarregar-acervo") { pintarAcervo(); return carregarAcervo(true); }
    if (act === "recarregar-hist") { pintarHistorico(); return carregarHistorico(true); }
    if (act === "hist-abrir") return abrirHistorico(b.dataset.id, b);
    if (act === "hist-refazer") { const h = st.historico.find((x) => x.id === b.dataset.id); if (h) { preencherForm(h); pesquisar(); } return; }
    if (act === "hist-excluir") return excluirHistorico(b.dataset.id);
  }

  // ---------- ligação com o Creative Intelligence ----------
  window.initCIBiblioteca = montar;
  window.ciBibliotecaProjetos = () => { if (raiz() && raiz().firstElementChild) pintarProjetos(); };
  window.ciBibliotecaProjetoAlterado = () => {
    const atual = window.ciProjetoAtual && window.ciProjetoAtual();
    st.projetoId = atual && atual.id ? atual.id : "";
    if (raiz() && raiz().firstElementChild) pintarProjetos();
  };
  // chamado pelo atalho da Etapa 02 do projeto: abre a pesquisa já com a marca
  window.ciBibliotecaPesquisar = (termo) => {
    const el = raiz(); if (!el || !el.firstElementChild) return;
    st.aba = "pesquisa"; lembrar("cib-aba", st.aba); pintarAba();
    const q = $("#cib-q", el); if (q) { if (termo) q.value = termo; q.focus(); }
  };
  window.ciBibliotecaRecarregar = () => carregarAcervo(true);
})();
