/* =========================================================
   ESTÚDIO CRIATIVO — Edição > Criação de fotos (#estudio)
   Claude como diretora de arte (Edge Function creative-studio) + editor estilo Canva (Fabric.js 5.3.1).
   Dados no Supabase: creative_projects, creative_assets, creative_references, creative_palettes,
   creative_versions; arquivos no bucket privado "estudio-criativo" (pasta = id da dona).
   Nada fica só no navegador: localStorage guarda apenas a última aba/zoom.
   ========================================================= */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const banco = () => window.banco;
  const BUCKET = "estudio-criativo";
  const LIB = {
    fabric: "https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js",
    zip: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
    pdf: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  };
  const FONTES = ["Bootzy", "DM Serif Display", "Poppins", "Instrument Serif", "Montserrat", "Fraunces", "Inter", "Playfair Display", "Arimo", "Caveat"];
  const CSS_FONTE = (f) => f === "Bootzy" ? "MinhaFonte, Arimo" : f;
  const NOME_FONTE = (css) => /MinhaFonte/.test(css || "") ? "Bootzy" : (FONTES.find((f) => f === css) || String(css || "").split(",")[0].replace(/["']/g, "").trim());
  const OFICIAL = { nome: "Oficial Mari", cores: ["#F6EFE6", "#FFFDF9", "#6B4A35", "#A87058", "#3D2B20", "#FCEEA8"] };
  const SUGERIDAS = [
    { nome: "Café & papel", cores: ["#FFF9F1", "#E8D8C7", "#4B3022", "#9B7052", "#2B1B12", "#C7A77F"] },
    { nome: "Preto & manteiga", cores: ["#171614", "#F7E9A8", "#FFFFFF", "#D2B94E", "#3A3631", "#FCEEA8"] },
    { nome: "Areia & oliva", cores: ["#EDE8DC", "#FFFDF7", "#4A4939", "#7A8061", "#2E2D24", "#C6B99D"] },
    { nome: "Rosé queimado", cores: ["#F3E5E1", "#FFFAF8", "#563B3B", "#B77D79", "#2F2020", "#D8B9AE"] },
    { nome: "Minimal clean", cores: ["#F4F4F1", "#FFFFFF", "#252525", "#8D8D86", "#111111", "#D8D8D2"] },
  ];
  const TIPOS_REF = { instagram: "Instagram", pinterest: "Pinterest", perfil: "Perfil", capa: "Capa de carrossel", interna: "Página interna", tipografia: "Tipografia", paleta: "Paleta", composicao: "Composição", imagem: "Imagem" };
  const REFS_INICIAIS = [
    ["Referência Instagram 1", "instagram", "https://www.instagram.com/p/DdrDLBZi641/"],
    ["Referência Instagram 2", "instagram", "https://www.instagram.com/p/DdjcpSgEbWn/?img_index=1"],
    ["Referência Instagram 3", "instagram", "https://www.instagram.com/p/Dd9gUhbFKSc/?img_index=1"],
    ["Referência Instagram 4", "instagram", "https://www.instagram.com/p/Dd4rQixnJfc/?img_index=1"],
    ["Referência Instagram 5", "instagram", "https://www.instagram.com/p/DaOTb2oGtgi/?img_index=1"],
    ["@feedautentico (direção visual principal)", "perfil", "https://www.instagram.com/feedautentico/", "Referência importante de direção visual: composição, estética editorial, hierarquia tipográfica, organização das informações e criatividade nos carrosséis."],
    ["Pinterest 1", "pinterest", "https://br.pinterest.com/pin/908319818621779008/"],
    ["Pinterest 2", "pinterest", "https://br.pinterest.com/pin/908319818621778589/"],
    ["Pinterest 3", "pinterest", "https://br.pinterest.com/pin/908319818621778556/"],
    ["Pinterest 4", "pinterest", "https://br.pinterest.com/pin/908319818621279374/"],
    ["Pinterest 5", "pinterest", "https://br.pinterest.com/pin/908319818621279336/"],
    ["Pinterest 6", "pinterest", "https://br.pinterest.com/pin/908319818620697822/"],
  ];
  const STATUS = { rascunho: "Rascunho", em_edicao: "Em edição", pronto: "Pronto", publicado: "Publicado", arquivado: "Arquivado" };
  const PROPS = ["ecId", "ecNome", "ecTipo", "ecPapel", "ecAsset", "ecPath", "ecFoco", "ecFrame", "ecDeco", "ecRaio", "ecBloq", "selectable", "evented", "lockMovementX", "lockMovementY", "lockScalingX", "lockScalingY", "lockRotation", "hasControls", "crossOrigin"];
  const ICO = {
    texto: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>', forma: '<rect x="4" y="4" width="16" height="16" rx="3"/>', camadas: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
    ia: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>', foto: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
    paleta: '<path d="M12 3a9 9 0 100 18c1 0 1.5-.8 1.2-1.6-.4-1 .3-2.4 1.8-2.4H17a4 4 0 004-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    olho: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', olhoX: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0122 12s-1 2-3 4M6.3 6.3C3.6 8 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.1"/>',
    cad: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>', cadA: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 017.5-2"/>',
    cima: '<path d="M12 19V5M6 11l6-6 6 6"/>', baixo: '<path d="M12 5v14M6 13l6 6 6-6"/>', lixo: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', dup: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
    desf: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>', ref: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 000 10h3"/>', mais: '<path d="M12 5v14M5 12h14"/>', menos: '<path d="M5 12h14"/>',
    baixar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', salvar: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7M8 20v-6h8v6"/>', esq: '<path d="M15 6l-6 6 6 6"/>', dir: '<path d="M9 6l6 6-6 6"/>',
    car: '<rect x="6" y="3" width="14" height="14" rx="2"/><path d="M3 7v12a2 2 0 002 2h12"/>', grupo: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><path d="M11 7h4v4M13 17H9v-4"/>',
  };
  const ic = (n) => `<svg class="tr" viewBox="0 0 24 24" aria-hidden="true">${ICO[n] || ""}</svg>`;
  const DECO_SVG = {
    estrela: { d: "M50 4l13.5 30 32.5 3.5-24.5 22 7 32L50 75 21.5 91.5l7-32L4 37.5 36.5 34z", fill: true },
    brilho: { d: "M50 0C53 35 65 47 100 50 65 53 53 65 50 100 47 65 35 53 0 50 35 47 47 35 50 0z", fill: true },
    coracao: { d: "M50 90C20 68 4 50 4 30 4 14 16 4 29 4c9 0 17 5 21 13 4-8 12-13 21-13 13 0 25 10 25 26 0 20-16 38-46 60z", fill: true },
    aspas: { d: "M10 60c0-25 12-42 34-48l4 9c-12 5-18 14-19 25h16v34H10zm50 0c0-25 12-42 34-48l4 9c-12 5-18 14-19 25h16v34H60z", fill: true },
    seta: { d: "M5 50h80M62 24l26 26-26 26", fill: false },
    sublinhado: { d: "M3 60C25 46 45 66 66 52 78 44 88 48 97 54", fill: false },
    "circulo-mao": { d: "M58 8C30 4 6 22 6 50s22 44 46 44 44-18 44-42C96 26 74 8 44 12", fill: false },
  };

  // ---------------- estado ----------------
  const st = {
    pronto: false, uid: null, vista: "criar", motor: null, proj: null, assets: [], refs: [], pals: [], feed: [],
    pag: 0, zoom: 0.5, cv: null, carregando: false, hist: [], fut: [], clip: null, ferr: "elementos", thumbs: {}, urls: {},
    selRefs: null, feedQuadrado: false, salvando: false, sujo: false, ultimaMiniatura: 0, trabalhando: "", ultimoErro: "",
  };
  const W = () => (st.proj && st.proj.canvas_width) || 1080;
  const H = () => (st.proj && st.proj.canvas_height) || 1350;
  const D = () => st.proj.design_json;
  const pags = () => D().paginas;
  const uid = (p = "e") => p + Math.random().toString(36).slice(2, 9);
  const ls = { get(k, d) { try { const v = localStorage.getItem("ec-" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem("ec-" + k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } } };
  function toast(msg, erro) {
    const t = $("#toast"); if (!t) return;
    t.textContent = msg; t.classList.toggle("erro", !!erro); t.classList.add("visivel");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("visivel"), erro ? 5600 : 2600);
  }
  const confirmar = (m, op) => window.painelDialogo ? window.painelDialogo.confirmar(m, op || {}) : Promise.resolve(true);
  const perguntar = (m, v, op) => window.painelDialogo ? window.painelDialogo.texto(m, v, op || {}) : Promise.resolve(v);
  const scripts = {};
  function carregarScript(url) {
    if (!scripts[url]) scripts[url] = new Promise((ok, erro) => { const s = document.createElement("script"); s.src = url; s.async = true; s.onload = ok; s.onerror = () => { delete scripts[url]; erro(new Error("Não consegui carregar " + url.split("/").pop())); }; document.head.appendChild(s); });
    return scripts[url];
  }
  function carregarCss() {
    if (!$("#ec-css")) { const l = document.createElement("link"); l.id = "ec-css"; l.rel = "stylesheet"; l.href = "../css/estudio-criativo.css?v=" + (window.VERSAO_PAINEL || ""); document.head.appendChild(l); }
    if (!$("#ec-fontes")) { const l = document.createElement("link"); l.id = "ec-fontes"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Arimo:ital,wght@0,400;0,700;1,400&family=Caveat:wght@500;700&family=DM+Serif+Display:ital@0;1&family=Fraunces:ital,opsz,wght@0,9..144,300..800;1,9..144,300..800&family=Inter:wght@300..800&family=Instrument+Serif:ital@0;1&family=Montserrat:ital,wght@0,300..900;1,300..900&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap"; document.head.appendChild(l); }
  }
  let fontesOk = null;
  async function minhaFonte() {
    if ([...document.fonts].some((f) => f.family.replace(/["']/g, "") === "MinhaFonte")) return true;
    try {
      const { data } = await banco().from("configuracoes").select("valor").eq("chave", "fonte_legenda").maybeSingle();
      if (!data || !data.valor) return false;
      const v = typeof data.valor === "string" ? JSON.parse(data.valor) : data.valor;
      const bin = atob(v.b64), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const ff = new FontFace("MinhaFonte", buf.buffer); await ff.load(); document.fonts.add(ff); st.nomeMinhaFonte = v.nome || "Bootzy"; return true;
    } catch (e) { return false; }
  }
  function fontesProntas() {
    if (!fontesOk) fontesOk = (async () => {
      st.temBootzy = await minhaFonte();
      const lista = ["DM Serif Display", "Poppins", "Instrument Serif", "Montserrat", "Fraunces", "Inter", "Playfair Display", "Arimo", "Caveat"];
      await Promise.all(lista.flatMap((f) => [`400 40px "${f}"`, `700 40px "${f}"`, `italic 400 40px "${f}"`].map((d) => document.fonts.load(d).catch(() => null))));
      await document.fonts.ready;
    })();
    return fontesOk;
  }

  // ---------------- dados ----------------
  async function ia(corpo) {
    const { data } = await banco().auth.getSession();
    const tok = data && data.session && data.session.access_token;
    if (!tok) throw new Error("Sua sessão expirou. Entre de novo no painel.");
    const r = await fetch(window.BANCO_URL + "/functions/v1/creative-studio", { method: "POST", headers: { Authorization: "Bearer " + tok, apikey: window.BANCO_CHAVE, "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || (r.status === 404 ? "A função creative-studio ainda não foi publicada no Supabase." : "A IA não respondeu (" + r.status + ")."));
    return j;
  }
  async function urlsAssinadas(paths) {
    const agora = Date.now(), falta = [...new Set(paths.filter((p) => p && !(st.urls[p] && st.urls[p].ate > agora + 60000)))];
    for (let i = 0; i < falta.length; i += 80) {
      const { data, error } = await banco().storage.from(BUCKET).createSignedUrls(falta.slice(i, i + 80), 60 * 60 * 6);
      if (error) throw new Error(error.message);
      (data || []).forEach((d) => { if (d.signedUrl) st.urls[d.path] = { url: d.signedUrl, ate: agora + 6 * 3600 * 1000 }; });
    }
    return Object.fromEntries(paths.map((p) => [p, st.urls[p] ? st.urls[p].url : ""]));
  }
  const urlDe = async (p) => (await urlsAssinadas([p]))[p];
  function lerImagem(arq) {
    return new Promise((ok, erro) => { const u = URL.createObjectURL(arq), im = new Image(); im.onload = () => ok({ im, u }); im.onerror = () => { URL.revokeObjectURL(u); erro(new Error("Não consegui abrir " + arq.name)); }; im.src = u; });
  }
  async function reduzir(arq, max = 2400, q = 0.9) {
    if (!/^image\/(jpeg|png|webp)$/.test(arq.type)) return { blob: arq, tipo: arq.type, w: 0, h: 0 };
    const { im, u } = await lerImagem(arq);
    const w0 = im.naturalWidth, h0 = im.naturalHeight, k = Math.min(1, max / Math.max(w0, h0));
    if (k === 1 && arq.size < 6e6) { URL.revokeObjectURL(u); return { blob: arq, tipo: arq.type, w: w0, h: h0 }; }
    const c = document.createElement("canvas"); c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
    const tipo = arq.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise((ok) => c.toBlob(ok, tipo, q));
    return { blob, tipo, w: c.width, h: c.height };
  }
  async function subir(arq, pasta) {
    const okTipo = /^image\/(jpeg|png|webp|gif)$/.test(arq.type) || arq.type === "application/pdf" || /^text\/(plain|markdown)$/.test(arq.type) || /\.(txt|md)$/i.test(arq.name);
    if (!okTipo) throw new Error(arq.name + ": formato não aceito (use JPG, PNG, WEBP, PDF ou TXT).");
    if (arq.size > 40 * 1024 * 1024) throw new Error(arq.name + " passou de 40 MB.");
    const r = await reduzir(arq);
    if (r.blob.size > 15 * 1024 * 1024) throw new Error(arq.name + " ficou acima de 15 MB mesmo reduzido.");
    const ext = r.tipo === "application/pdf" ? "pdf" : r.tipo === "image/png" ? "png" : r.tipo === "image/webp" ? "webp" : r.tipo === "image/gif" ? "gif" : /^image/.test(r.tipo) ? "jpg" : "txt";
    const caminho = `${st.uid}/${pasta}/${crypto.randomUUID()}.${ext}`;
    const { error } = await banco().storage.from(BUCKET).upload(caminho, r.blob, { contentType: r.tipo || "text/plain", upsert: false });
    if (error) throw new Error("Não consegui enviar " + arq.name + ": " + error.message);
    return { caminho, tipo: r.tipo || "text/plain", w: r.w, h: r.h };
  }
  async function dataUrlDe(caminho, max = 1024, q = 0.82) {
    const url = await urlDe(caminho);
    const blob = await (await fetch(url)).blob();
    if (blob.type === "application/pdf") return await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", q);
  }
  async function carregarListas() {
    const [r1, r2, r3] = await Promise.all([
      banco().from("creative_references").select("*").order("created_at", { ascending: false }),
      banco().from("creative_palettes").select("*").order("created_at"),
      banco().from("creative_assets").select("*").eq("file_type", "feed").is("project_id", null).order("created_at"),
    ]);
    if (r1.error) throw new Error(r1.error.message.includes("does not exist") || r1.error.code === "42P01" ? "As tabelas do Estúdio ainda não foram criadas no Supabase." : r1.error.message);
    st.refs = r1.data || []; st.pals = r2.data || [];
    st.feed = (r3.data || []).sort((a, b) => ((a.public_metadata || {}).ordem ?? 999) - ((b.public_metadata || {}).ordem ?? 999));
    if (!st.pals.length) {
      const linhas = [{ name: OFICIAL.nome, colors: OFICIAL.cores, is_default: true }, ...SUGERIDAS.map((p) => ({ name: p.nome, colors: p.cores, is_default: false }))];
      const { data } = await banco().from("creative_palettes").insert(linhas).select(); st.pals = data || [];
    }
    if (!st.refs.length) {
      const { data: cfg } = await banco().from("configuracoes").select("valor").eq("chave", "estudio_refs_iniciais").maybeSingle();
      if (!cfg) {
        const { data } = await banco().from("creative_references").insert(REFS_INICIAIS.map(([t, tipo, u, n]) => ({ title: t, reference_type: tipo, source_url: u, notes: n || null }))).select();
        st.refs = (data || []).reverse();
        await banco().from("configuracoes").upsert({ chave: "estudio_refs_iniciais", valor: JSON.stringify({ em: new Date().toISOString() }) }, { onConflict: "chave" });
      }
    }
  }
  const paletaOficial = () => { const p = st.pals.find((x) => x.is_default); return p ? { nome: p.name, cores: p.colors } : OFICIAL; };

  // ---------------- projeto ----------------
  function designVazio() {
    return { versao: 1, paleta: paletaOficial(), fontes: { titulo: "DM Serif Display", subtitulo: "Poppins", texto: "Poppins" }, legenda: "", direcao: null, briefing: "", objetivo: "", tipoPedido: "auto", refsUsadas: [], feedPos: 0, paginas: [] };
  }
  function novoProjetoLocal() {
    st.proj = { id: null, name: "Novo projeto", project_type: "carrossel", canvas_width: 1080, canvas_height: 1350, status: "rascunho", design_json: designVazio() };
    st.assets = []; st.pag = 0; st.hist = []; st.fut = []; st.thumbs = {};
  }
  async function garantirProjeto() {
    if (st.proj.id) return st.proj.id;
    const { data, error } = await banco().from("creative_projects").insert({ name: st.proj.name, project_type: st.proj.project_type, canvas_width: W(), canvas_height: H(), design_json: D(), status: st.proj.status }).select().single();
    if (error) throw new Error(error.message);
    st.proj.id = data.id; st.proj.created_at = data.created_at; st.proj.updated_at = data.updated_at;
    ls.set("ultimo", data.id);
    return data.id;
  }
  async function abrirProjeto(id) {
    if (st.proj && st.proj.id && st.cv) { soltarCanvas(); st.sujo = true; await salvar(); }
    const { data, error } = await banco().from("creative_projects").select("*").eq("id", id).single();
    if (error) { toast("Não consegui abrir: " + error.message, true); return; }
    st.proj = data; if (!data.design_json || !data.design_json.paginas) st.proj.design_json = Object.assign(designVazio(), data.design_json || {});
    const { data: as } = await banco().from("creative_assets").select("*").eq("project_id", id).order("created_at");
    st.assets = as || []; st.pag = 0; st.hist = []; st.fut = []; st.thumbs = {}; st.selRefs = null; st.sujo = false;
    ls.set("ultimo", id);
    await irPara(pags().length ? "editor" : "criar");
  }
  function marcarSujo() {
    st.sujo = true; pintarSalvo("Salvando…");
    clearTimeout(marcarSujo.t); marcarSujo.t = setTimeout(salvar, 1500);
  }
  async function salvar(forcarMiniatura) {
    if (!st.proj || !st.sujo && !forcarMiniatura) return;
    if (st.salvando) { marcarSujo(); return; }
    st.salvando = true;
    try {
      guardarPaginaAtual();
      await garantirProjeto();
      const campos = { name: st.proj.name, project_type: st.proj.project_type, canvas_width: W(), canvas_height: H(), design_json: D(), status: st.proj.status };
      if (pags().length && (forcarMiniatura || !st.proj.thumbnail_url || st.pag === 0 && Date.now() - st.ultimaMiniatura > 15000)) {
        try {
          const url = await renderizar(0, 400 / W(), "jpg", 0.85);
          const blob = await (await fetch(url)).blob(), cam = `${st.uid}/miniaturas/${st.proj.id}.jpg`;
          const { error } = await banco().storage.from(BUCKET).upload(cam, blob, { contentType: "image/jpeg", upsert: true });
          if (!error) { campos.thumbnail_url = cam; st.proj.thumbnail_url = cam; delete st.urls[cam]; st.ultimaMiniatura = Date.now(); }
        } catch (e) { /* miniatura fica para depois */ }
      }
      const { data, error } = await banco().from("creative_projects").update(campos).eq("id", st.proj.id).select("updated_at").single();
      if (error) throw new Error(error.message);
      st.proj.updated_at = data.updated_at; st.sujo = false;
      pintarSalvo("Salvo às " + new Date(data.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) { pintarSalvo("Não salvou: " + e.message, true); setTimeout(marcarSujo, 8000); }
    finally { st.salvando = false; }
  }
  function pintarSalvo(t, erro) { const e = $("#ec-salvo"); if (e) { e.textContent = t; e.style.color = erro ? "var(--vermelho)" : ""; } }
  async function salvarVersao(rotulo) {
    if (!st.proj || !st.proj.id) return null;
    guardarPaginaAtual();
    const { data: ult } = await banco().from("creative_versions").select("version_number").eq("project_id", st.proj.id).order("version_number", { ascending: false }).limit(1);
    const n = ((ult && ult[0] && ult[0].version_number) || 0) + 1;
    const dj = JSON.parse(JSON.stringify(D())); dj.rotuloVersao = rotulo || "";
    const { error } = await banco().from("creative_versions").insert({ project_id: st.proj.id, version_number: n, design_json: dj });
    if (error) { toast("Versão não salva: " + error.message, true); return null; }
    return n;
  }

  // ---------------- motor gráfico (Fabric) ----------------
  function controlesImagem(o) { o.setControlsVisibility({ mtr: true }); }
  function aplicarCapa(o, fw, fh, foco) {
    const el = o.getElement(); if (!el) return;
    const iw = el.naturalWidth || el.width, ih = el.naturalHeight || el.height; if (!iw || !ih) return;
    foco = Object.assign({ x: 0.5, y: 0.4, z: 1 }, o.ecFoco || {}, foco || {});
    const s = Math.max(fw / iw, fh / ih) * foco.z, cw = Math.min(iw, fw / s), ch = Math.min(ih, fh / s);
    o.set({ cropX: (iw - cw) * foco.x, cropY: (ih - ch) * foco.y, width: cw, height: ch, scaleX: s, scaleY: s, ecFoco: foco, ecFrame: { w: fw, h: fh } });
    const raio = o.ecRaio || 0;
    o.clipPath = raio > 0 ? new fabric.Rect({ width: cw, height: ch, rx: raio / s, ry: raio / s, originX: "center", originY: "center" }) : null;
    if (o.strokeWidth) o.set({ strokeWidth: (o.ecBordaPx || o.strokeWidth * s) / s });
    o.setCoords();
  }
  function prepararObjeto(o) {
    if (o.ecTipo === "imagem") controlesImagem(o);
    if (o.ecBloq) o.set({ lockMovementX: true, lockMovementY: true, lockScalingX: true, lockScalingY: true, lockRotation: true, hasControls: false });
    if (o.type === "textbox") o.set({ splitByGrapheme: false });
    o.set({ borderColor: "#A87058", cornerColor: "#FFFDF9", cornerStrokeColor: "#6B4A35", transparentCorners: false, cornerSize: 11, borderScaleFactor: 1.5 });
  }
  function imagemDeUrl(url) { return new Promise((ok, erro) => fabric.Image.fromURL(url, (img, falhou) => falhou || !img ? erro(new Error("Imagem não carregou")) : ok(img), { crossOrigin: "anonymous" })); }
  async function comSrcFrescos(json) {
    const j = JSON.parse(JSON.stringify(json || { objects: [] }));
    const caminhos = []; const varrer = (lista) => (lista || []).forEach((o) => { if (o.ecPath) caminhos.push(o.ecPath); if (o.objects) varrer(o.objects); });
    varrer(j.objects);
    if (caminhos.length) { const m = await urlsAssinadas(caminhos); const pôr = (lista) => (lista || []).forEach((o) => { if (o.ecPath && m[o.ecPath]) { o.src = m[o.ecPath]; o.crossOrigin = "anonymous"; } if (o.objects) pôr(o.objects); }); pôr(j.objects); }
    return j;
  }
  function decoObjeto(tipo, w, corV) {
    const d = DECO_SVG[tipo] || DECO_SVG.brilho, p = new fabric.Path(d.d, d.fill ? { fill: corV, stroke: null } : { fill: "", stroke: corV, strokeWidth: 6, strokeLineCap: "round", strokeLineJoin: "round" });
    const k = w / Math.max(p.width, 1); p.set({ scaleX: k, scaleY: k, ecTipo: "deco", ecDeco: tipo }); return p;
  }
  // elemento do JSON da IA -> objeto Fabric
  async function objetoDeSpec(e, fotos) {
    const comum = { left: e.x, top: e.y, angle: e.rot || 0, opacity: e.opac == null ? 1 : e.opac, ecId: e.id || uid(), ecNome: e.nome || "" };
    if (e.tipo === "texto") {
      const t = new fabric.Textbox(e.maiusc ? String(e.texto).toLocaleUpperCase("pt-BR") : e.texto, Object.assign(comum, {
        width: e.w, fontSize: e.tam, fontFamily: CSS_FONTE(e.fonte), fontWeight: e.peso || 400, fontStyle: e.italico ? "italic" : "normal", fill: e.cor,
        textAlign: e.alinh || "left", lineHeight: e.entrelinha || 1.2, charSpacing: e.espaco || 0, textBackgroundColor: e.fundo || "", ecTipo: "texto", ecPapel: e.papel || "texto",
      }));
      return t;
    }
    if (e.tipo === "imagem") {
      const a = fotos[e.asset]; if (!a) return null;
      const img = await imagemDeUrl(await urlDe(a.storage_path));
      img.set(Object.assign(comum, { ecTipo: "imagem", ecAsset: a.id, ecPath: a.storage_path, ecRaio: e.raio || 0, crossOrigin: "anonymous" }));
      if (e.borda) img.set({ stroke: e.bordaCor || "#FFFFFF", strokeWidth: 1, ecBordaPx: e.borda, paintFirst: "fill" });
      aplicarCapa(img, e.w, e.h, { x: e.focoX ?? 0.5, y: e.focoY ?? 0.4, z: e.zoom || 1 });
      return img;
    }
    if (e.tipo === "forma") {
      const base = Object.assign(comum, { fill: e.cor === "transparent" ? "" : e.cor, stroke: e.borda ? e.bordaCor : null, strokeWidth: e.borda || 0, strokeUniform: true, ecTipo: "forma" });
      return e.forma === "circulo" ? new fabric.Ellipse(Object.assign(base, { rx: e.w / 2, ry: e.h / 2 })) : new fabric.Rect(Object.assign(base, { width: e.w, height: e.h, rx: e.raio || 0, ry: e.raio || 0 }));
    }
    if (e.tipo === "linha") return new fabric.Rect(Object.assign(comum, { width: e.w, height: e.espessura || 3, fill: e.cor, ecTipo: "linha" }));
    if (e.tipo === "deco") { const p = decoObjeto(e.deco, e.w, e.cor); p.set(comum); return p; }
    return null;
  }
  // página da IA -> JSON do Fabric (montado num canvas fora da tela)
  async function paginaDeSpec(p, fotos) {
    const el = document.createElement("canvas"), sc = new fabric.StaticCanvas(el, { width: W(), height: H(), enableRetinaScaling: false });
    sc.backgroundColor = p.fundo || "#F6EFE6";
    for (const e of p.elementos || []) { try { const o = await objetoDeSpec(e, fotos); if (o) sc.add(o); } catch (err) { console.warn("elemento ignorado", e, err); } }
    const json = sc.toJSON(PROPS); sc.dispose();
    return { id: p.id && !pags().some((x) => x.id === p.id) ? p.id : uid("p"), nota: p.nota || "", papel: p.papel || "", fabric: json };
  }
  // objeto Fabric -> elemento do JSON (para a IA editar uma página)
  function specDeObjeto(o, fotosIdx) {
    const b = { id: o.ecId || (o.ecId = uid()), nome: o.ecNome || "", x: Math.round(o.left), y: Math.round(o.top), rot: Math.round(o.angle || 0), opac: +(o.opacity ?? 1).toFixed(2) };
    if (o.type === "textbox") return Object.assign(b, { tipo: "texto", papel: o.ecPapel || "texto", texto: o.text, w: Math.round(o.width * o.scaleX), tam: Math.round(o.fontSize * o.scaleY), fonte: NOME_FONTE(o.fontFamily), peso: +o.fontWeight || 400, italico: o.fontStyle === "italic", cor: o.fill, alinh: o.textAlign, entrelinha: o.lineHeight, espaco: o.charSpacing || 0, fundo: o.textBackgroundColor || "" });
    if (o.ecTipo === "imagem") { const f = o.ecFrame || { w: o.width * o.scaleX, h: o.height * o.scaleY }, fo = o.ecFoco || {}; return Object.assign(b, { tipo: "imagem", asset: Math.max(0, fotosIdx.indexOf(o.ecAsset)), w: Math.round(f.w), h: Math.round(f.h), focoX: fo.x ?? 0.5, focoY: fo.y ?? 0.4, zoom: fo.z || 1, raio: o.ecRaio || 0 }); }
    if (o.ecTipo === "linha") return Object.assign(b, { tipo: "linha", w: Math.round(o.width * o.scaleX), espessura: Math.round(o.height * o.scaleY), cor: o.fill });
    if (o.ecTipo === "deco") return Object.assign(b, { tipo: "deco", deco: o.ecDeco, w: Math.round(o.width * o.scaleX), cor: o.fill || o.stroke });
    if (o.type === "ellipse") return Object.assign(b, { tipo: "forma", forma: "circulo", w: Math.round(o.rx * 2 * o.scaleX), h: Math.round(o.ry * 2 * o.scaleY), cor: o.fill || "transparent", borda: o.strokeWidth || 0, bordaCor: o.stroke || "" });
    if (o.type === "rect") return Object.assign(b, { tipo: "forma", forma: "retangulo", w: Math.round(o.width * o.scaleX), h: Math.round(o.height * o.scaleY), cor: o.fill || "transparent", borda: o.strokeWidth || 0, bordaCor: o.stroke || "", raio: o.rx || 0 });
    return null;
  }
  async function specDaPagina(json0, fotosIdx) {
    const json = await comSrcFrescos(json0);
    const el = document.createElement("canvas"), sc = new fabric.StaticCanvas(el, { width: W(), height: H() });
    return new Promise((ok) => sc.loadFromJSON(json, () => {
      const els = []; const add = (o) => { if (o.type === "group") o.getObjects().forEach((c) => add(c)); else { const s = specDeObjeto(o, fotosIdx); if (s) els.push(s); } };
      sc.getObjects().forEach(add);
      const r = { fundo: sc.backgroundColor, elementos: els }; sc.dispose(); ok(r);
    }));
  }
  async function renderizar(i, mult = 1, fmt = "png", q = 0.95) {
    await fontesProntas();
    if (i === st.pag && st.cv) guardarPaginaAtual();
    const pg = pags()[i], el = document.createElement("canvas"), sc = new fabric.StaticCanvas(el, { width: W(), height: H(), enableRetinaScaling: false });
    const json = await comSrcFrescos(pg.fabric);
    await new Promise((ok) => sc.loadFromJSON(json, ok));
    sc.getObjects().forEach((o) => { if (o.type === "textbox") o.initDimensions(); });
    sc.renderAll();
    const url = sc.toDataURL({ format: fmt === "jpg" ? "jpeg" : "png", quality: q, multiplier: mult });
    sc.dispose(); return url;
  }

  // ---------------- histórico ----------------
  function guardarPaginaAtual() {
    if (!st.cv || !st.proj || !pags()[st.pag] || st.carregando) return;
    pags()[st.pag].fabric = st.cv.toJSON(PROPS);
  }
  function foto() { guardarPaginaAtual(); return JSON.stringify({ paginas: pags(), pag: st.pag, w: W(), h: H(), paleta: D().paleta, fontes: D().fontes }); }
  function marcar() {
    if (st.carregando || !st.proj) return;
    const f = foto(); if (st.hist[st.hist.length - 1] === f) return;
    st.hist.push(f); if (st.hist.length > 60) st.hist.shift(); st.fut = [];
    pintarDesfazer(); marcarSujo(); miniaturaDepois();
  }
  async function voltarPara(f, pagina) {
    const v = JSON.parse(f); D().paginas = v.paginas; D().paleta = v.paleta; D().fontes = v.fontes;
    st.proj.canvas_width = v.w; st.proj.canvas_height = v.h; st.pag = Math.max(0, Math.min(pagina == null ? v.pag : pagina, pags().length - 1));
    st.thumbs = {}; await carregarPagina(st.pag); pintarPaginas(); marcarSujo(); pintarDesfazer();
  }
  // desfazer/refazer mostram a página onde a mudança aconteceu
  async function desfazer() { if (st.hist.length < 2) return; const f = st.hist.pop(); st.fut.push(f); await voltarPara(st.hist[st.hist.length - 1], JSON.parse(f).pag); }
  async function refazer() { if (!st.fut.length) return; const f = st.fut.pop(); st.hist.push(f); await voltarPara(f); }
  function pintarDesfazer() { const a = $("#ec-desf"), b = $("#ec-refaz"); if (a) a.disabled = st.hist.length < 2; if (b) b.disabled = !st.fut.length; }

  // ---------------- canvas principal ----------------
  async function montarCanvas() {
    await carregarScript(LIB.fabric);
    fabric.Object.prototype.objectCaching = true;
    const el = $("#ec-canvas"); if (!el) return;
    if (st.cv) { try { st.cv.dispose(); } catch (e) { /* já foi */ } }
    st.cv = new fabric.Canvas(el, { preserveObjectStacking: true, backgroundColor: "#F6EFE6", stopContextMenu: true, fireRightClick: false, selectionColor: "rgba(168,112,88,.12)", selectionBorderColor: "#A87058" });
    const cv = st.cv;
    cv.on("object:modified", (ev) => {
      const o = ev.target; if (!o) return;
      if (o.type === "textbox" && (Math.abs(o.scaleX - 1) > 0.001)) { o.set({ fontSize: Math.round(o.fontSize * o.scaleX), width: o.width * o.scaleX, scaleX: 1, scaleY: 1 }); o.setCoords(); }
      if (o.ecTipo === "imagem") aplicarCapa(o, o.width * o.scaleX, o.height * o.scaleY);
      cv.requestRenderAll(); marcar(); pintarProps(); pintarCamadas();
    });
    cv.on("object:added", () => { if (!st.carregando) { pintarCamadas(); } });
    cv.on("object:removed", () => { if (!st.carregando) pintarCamadas(); });
    cv.on("text:changed", () => { clearTimeout(montarCanvas.t); montarCanvas.t = setTimeout(marcar, 500); });
    cv.on("text:editing:exited", () => marcar());
    ["selection:created", "selection:updated", "selection:cleared"].forEach((n) => cv.on(n, () => { pintarProps(); pintarCamadas(); }));
    ajustarZoom(ls.get("zoom", 0));
  }
  function ajustarZoom(z) {
    if (!st.cv) return;
    if (!z) { const p = $(".ec-palco"); const aw = (p ? p.clientWidth : 600) - 60, ah = (p ? p.clientHeight : 700) - 120; z = Math.max(0.15, Math.min(1.5, Math.min(aw / W(), ah / H()))); }
    st.zoom = z; st.cv.setZoom(z); st.cv.setWidth(Math.round(W() * z)); st.cv.setHeight(Math.round(H() * z)); st.cv.requestRenderAll();
    const r = $("#ec-zoom"); if (r) r.value = Math.round(z * 100); const t = $("#ec-zoom-t"); if (t) t.textContent = Math.round(z * 100) + "%";
  }
  async function carregarPagina(i) {
    if (!st.cv) return;
    st.carregando = true;
    const pg = pags()[i];
    if (!pg) { st.cv.clear(); st.carregando = false; return; }
    await fontesProntas();
    const json = await comSrcFrescos(pg.fabric);
    await new Promise((ok) => st.cv.loadFromJSON(json, ok));
    st.cv.getObjects().forEach((o) => { prepararObjeto(o); if (o.type === "textbox") o.initDimensions(); });
    st.cv.discardActiveObject(); st.cv.requestRenderAll();
    st.carregando = false; st.pag = i;
    if (!st.hist.length) { st.hist.push(foto()); pintarDesfazer(); }
    pintarCamadas(); pintarProps();
  }
  async function irPagina(i) {
    if (i === st.pag || i < 0 || i >= pags().length) return;
    guardarPaginaAtual(); miniaturaAgora(st.pag);
    await carregarPagina(i); pintarPaginas();
  }
  const sel = () => st.cv && st.cv.getActiveObject();
  function adicionar(o, centralizar = true) {
    o.set({ ecId: o.ecId || uid() }); prepararObjeto(o);
    if (centralizar) { st.cv.add(o); st.cv.viewportCenterObject(o); } else st.cv.add(o);
    o.setCoords(); st.cv.setActiveObject(o); st.cv.requestRenderAll(); marcar();
  }
  function novoTexto(papel) {
    const f = D().fontes, pal = D().paleta.cores, escuro = pal[4] || pal[2] || "#3D2B20";
    const cfg = { titulo: ["Seu título aqui", f.titulo, 96, 400], subtitulo: ["Um subtítulo que completa a ideia", f.subtitulo, 44, 500], texto: ["Escreva aqui o texto desta página, com frases curtas e fáceis de ler.", f.texto, 36, 400] }[papel];
    adicionar(new fabric.Textbox(cfg[0], { width: W() * 0.76, fontSize: cfg[2], fontFamily: CSS_FONTE(cfg[1]), fontWeight: cfg[3], fill: escuro, lineHeight: papel === "titulo" ? 1.05 : 1.3, ecTipo: "texto", ecPapel: papel }));
  }
  function novaForma(t) {
    const pal = D().paleta.cores, c = pal[3] || "#A87058", base = { ecTipo: "forma", strokeUniform: true };
    if (t === "ret") return adicionar(new fabric.Rect(Object.assign(base, { width: 420, height: 300, fill: pal[1] || "#EFE5D8" })));
    if (t === "redondo") return adicionar(new fabric.Rect(Object.assign(base, { width: 420, height: 300, rx: 40, ry: 40, fill: pal[1] || "#EFE5D8" })));
    if (t === "circ") return adicionar(new fabric.Ellipse(Object.assign(base, { rx: 160, ry: 160, fill: c })));
    if (t === "pilula") return adicionar(new fabric.Rect(Object.assign(base, { width: 360, height: 80, rx: 40, ry: 40, fill: c })));
    if (t === "moldura") return adicionar(new fabric.Rect(Object.assign(base, { width: W() - 120, height: H() - 120, fill: "", stroke: pal[2] || "#6B4A35", strokeWidth: 4, ecNome: "Moldura" })));
    if (t === "moldura-r") return adicionar(new fabric.Rect(Object.assign(base, { width: 600, height: 760, rx: 300, ry: 300, fill: "", stroke: pal[2] || "#6B4A35", strokeWidth: 4, ecNome: "Moldura arco" })));
    if (t === "linha") return adicionar(new fabric.Rect({ width: 400, height: 4, fill: pal[2] || "#6B4A35", ecTipo: "linha" }));
    if (t === "linha-v") return adicionar(new fabric.Rect({ width: 400, height: 4, angle: 90, fill: pal[2] || "#6B4A35", ecTipo: "linha" }));
    return adicionar(decoObjeto(t, 140, c));
  }
  async function novaImagem(asset, substituir) {
    const img = await imagemDeUrl(await urlDe(asset.storage_path));
    img.set({ ecTipo: "imagem", ecAsset: asset.id, ecPath: asset.storage_path, crossOrigin: "anonymous", ecNome: asset.file_name });
    const alvo = substituir && sel();
    if (alvo && alvo.ecTipo === "imagem") {
      img.set({ left: alvo.left, top: alvo.top, angle: alvo.angle, opacity: alvo.opacity, ecRaio: alvo.ecRaio || 0, ecId: alvo.ecId, stroke: alvo.stroke, ecBordaPx: alvo.ecBordaPx, strokeWidth: alvo.strokeWidth ? 1 : 0 });
      const f = alvo.ecFrame || { w: alvo.width * alvo.scaleX, h: alvo.height * alvo.scaleY };
      aplicarCapa(img, f.w, f.h, { x: 0.5, y: 0.4, z: 1 });
      const idx = st.cv.getObjects().indexOf(alvo); st.cv.remove(alvo); st.cv.insertAt(img, idx); prepararObjeto(img); st.cv.setActiveObject(img); st.cv.requestRenderAll(); marcar(); return;
    }
    const el = img.getElement(), r = el.naturalWidth / el.naturalHeight, fw = W() * 0.7, fh = fw / r;
    aplicarCapa(img, fw, Math.min(fh, H() * 0.8), { x: 0.5, y: 0.4, z: 1 });
    adicionar(img);
  }
  function duplicar() {
    const o = sel(); if (!o) return;
    o.clone((c) => {
      st.cv.discardActiveObject();
      c.set({ left: o.left + 30, top: o.top + 30, evented: true });
      if (c.type === "activeSelection") { c.canvas = st.cv; c.forEachObject((x) => { x.set({ ecId: uid() }); prepararObjeto(x); st.cv.add(x); }); c.setCoords(); }
      else { c.set({ ecId: uid() }); prepararObjeto(c); st.cv.add(c); }
      st.cv.setActiveObject(c); st.cv.requestRenderAll(); marcar();
    }, PROPS);
  }
  function copiar() { const o = sel(); if (o) o.clone((c) => { st.clip = c; toast("Copiado"); }, PROPS); }
  function colar() {
    if (!st.clip) return;
    st.clip.clone((c) => {
      st.cv.discardActiveObject(); c.set({ left: c.left + 30, top: c.top + 30, evented: true });
      if (c.type === "activeSelection") { c.canvas = st.cv; c.forEachObject((x) => { x.set({ ecId: uid() }); prepararObjeto(x); st.cv.add(x); }); c.setCoords(); }
      else { c.set({ ecId: uid() }); prepararObjeto(c); st.cv.add(c); }
      st.clip.top += 30; st.clip.left += 30; st.cv.setActiveObject(c); st.cv.requestRenderAll(); marcar();
    }, PROPS);
  }
  function apagar() {
    const o = sel(); if (!o || (o.isEditing)) return;
    if (o.type === "activeSelection") o.forEachObject((x) => st.cv.remove(x)); else st.cv.remove(o);
    st.cv.discardActiveObject(); st.cv.requestRenderAll(); marcar();
  }
  function ordem(acao, o) {
    o = o || sel(); if (!o) return;
    ({ frente: () => st.cv.bringForward(o), tras: () => st.cv.sendBackwards(o), topo: () => st.cv.bringToFront(o), fundo: () => st.cv.sendToBack(o) })[acao]();
    st.cv.requestRenderAll(); marcar(); pintarCamadas();
  }
  function bloquear(o) {
    o = o || sel(); if (!o) return;
    const b = !o.ecBloq;
    o.set({ ecBloq: b, lockMovementX: b, lockMovementY: b, lockScalingX: b, lockScalingY: b, lockRotation: b, hasControls: !b });
    st.cv.requestRenderAll(); marcar(); pintarCamadas(); pintarProps();
  }
  function ocultar(o) { o.set({ visible: !o.visible, evented: !o.visible ? true : false }); if (!o.visible) st.cv.discardActiveObject(); st.cv.requestRenderAll(); marcar(); pintarCamadas(); }
  function agrupar() {
    const o = sel(); if (!o) return;
    if (o.type === "activeSelection") { const g = o.toGroup(); g.set({ ecId: uid(), ecNome: "Grupo", ecTipo: "grupo" }); prepararObjeto(g); }
    else if (o.type === "group") o.toActiveSelection();
    st.cv.requestRenderAll(); marcar(); pintarCamadas(); pintarProps();
  }
  function alinharNaPagina(como) {
    const o = sel(); if (!o) return; const r = o.getBoundingRect(true, true);
    const dx = { esq: 72 - r.left, centroH: (W() - r.width) / 2 - r.left, dir: W() - 72 - r.width - r.left }[como], dy = { topo: 72 - r.top, centroV: (H() - r.height) / 2 - r.top, base: H() - 72 - r.height - r.top }[como];
    o.set({ left: o.left + (dx || 0), top: o.top + (dy || 0) }); o.setCoords(); st.cv.requestRenderAll(); marcar(); pintarProps();
  }
  function nomeDe(o) {
    if (o.ecNome) return o.ecNome;
    if (o.type === "textbox") return (o.text || "Texto").replace(/\s+/g, " ").slice(0, 28);
    return { imagem: "Foto", forma: o.type === "ellipse" ? "Círculo" : "Forma", linha: "Linha", deco: "Enfeite " + (o.ecDeco || ""), grupo: "Grupo" }[o.ecTipo] || (o.type === "group" ? "Grupo" : "Elemento");
  }
  let miniT = null;
  function miniaturaDepois() { clearTimeout(miniT); miniT = setTimeout(() => miniaturaAgora(st.pag), 700); }
  function miniaturaAgora(i) {
    if (!st.cv || st.carregando || !pags()[i] || i !== st.pag) return;
    try { st.thumbs[pags()[i].id] = st.cv.toDataURL({ format: "jpeg", quality: 0.7, multiplier: 110 / (H() * st.zoom) }); } catch (e) { /* imagem sem CORS */ }
    const im = $(`.ec-pg[data-i="${i}"] img`); if (im && st.thumbs[pags()[i].id]) im.src = st.thumbs[pags()[i].id];
  }
  async function miniaturasQueFaltam() {
    for (let i = 0; i < pags().length; i++) {
      const p = pags()[i]; if (st.thumbs[p.id] || i === st.pag) continue;
      try { st.thumbs[p.id] = await renderizar(i, 110 / H(), "jpg", 0.7); const im = $(`.ec-pg[data-i="${i}"] img`); if (im) im.src = st.thumbs[p.id]; } catch (e) { /* segue */ }
    }
    miniaturaAgora(st.pag);
  }

  // ---------------- páginas ----------------
  function paginaEmBranco() {
    const fundo = (D().paleta.cores || [])[0] || "#F6EFE6";
    return { id: uid("p"), nota: "", fabric: { version: "5.3.0", objects: [], background: fundo } };
  }
  async function novaPagina(depois) {
    guardarPaginaAtual(); const i = depois == null ? pags().length : depois + 1;
    pags().splice(i, 0, paginaEmBranco()); await carregarPagina(i); pintarPaginas(); marcar();
  }
  async function duplicarPagina(i) {
    guardarPaginaAtual(); const c = JSON.parse(JSON.stringify(pags()[i])); c.id = uid("p");
    (c.fabric.objects || []).forEach((o) => { o.ecId = uid(); });
    pags().splice(i + 1, 0, c); await carregarPagina(i + 1); pintarPaginas(); marcar();
  }
  async function apagarPagina(i) {
    if (pags().length < 2) { toast("O projeto precisa de pelo menos uma página.", true); return; }
    if (!(await confirmar(`Apagar a página ${i + 1}? Dá para desfazer com Ctrl+Z.`, { ok: "Apagar", perigo: true }))) return;
    guardarPaginaAtual(); pags().splice(i, 1); await carregarPagina(Math.min(i, pags().length - 1)); pintarPaginas(); marcar();
  }
  async function moverPagina(de, para) {
    if (para < 0 || para >= pags().length || de === para) return;
    guardarPaginaAtual(); const [p] = pags().splice(de, 1); pags().splice(para, 0, p);
    st.pag = de === st.pag ? para : st.pag; await carregarPagina(st.pag); pintarPaginas(); marcar();
  }
  async function mudarFormato(h) {
    if (h === H()) return;
    guardarPaginaAtual(); const k = h / H();
    pags().forEach((p) => (p.fabric.objects || []).forEach((o) => { o.top = (o.top || 0) * k; }));
    st.proj.canvas_height = h; st.thumbs = {}; ajustarZoom(0); await carregarPagina(st.pag); pintarPaginas(); marcar(); pintarGaveta();
    toast(h === 1080 ? "Formato quadrado 1080 × 1080. Confira as posições." : "Formato retrato 1080 × 1350.");
  }

  // ---------------- paleta e fontes ----------------
  function recolorir(de, para) {
    guardarPaginaAtual();
    const m = {}; (de || []).forEach((c, i) => { if (c && para[i % para.length]) m[c.toUpperCase()] = para[i % para.length]; });
    const troca = (v) => typeof v === "string" && m[v.toUpperCase()] ? m[v.toUpperCase()] : v;
    const varrer = (lista) => (lista || []).forEach((o) => { ["fill", "stroke", "textBackgroundColor", "backgroundColor"].forEach((k) => { if (o[k]) o[k] = troca(o[k]); }); if (o.objects) varrer(o.objects); });
    pags().forEach((p) => { p.fabric.background = troca(p.fabric.background); varrer(p.fabric.objects); });
  }
  async function aplicarPaleta(p) {
    const antes = D().paleta.cores; recolorir(antes, p.cores); D().paleta = { nome: p.nome, cores: p.cores };
    st.thumbs = {}; await carregarPagina(st.pag); pintarPaginas(); marcar(); pintarGaveta();
  }
  async function aplicarFonteNoPapel(papel, fonte) {
    guardarPaginaAtual(); D().fontes[papel] = fonte;
    const varrer = (lista) => (lista || []).forEach((o) => { if (o.type === "textbox" && (o.ecPapel || "texto") === papel) o.fontFamily = CSS_FONTE(fonte); if (o.objects) varrer(o.objects); });
    pags().forEach((p) => varrer(p.fabric.objects)); st.thumbs = {}; await carregarPagina(st.pag); pintarPaginas(); marcar();
  }

  // ---------------- IA ----------------
  function trabalhando(t, sub) {
    st.trabalhando = t || "";
    $$(".ec-trabalhando").forEach((e) => e.remove());
    if (!t) return;
    const alvo = $(".ec-palco") || $("#ec-criar-dir"); if (!alvo) return;
    alvo.style.position = "relative";
    alvo.insertAdjacentHTML("beforeend", `<div class="ec-trabalhando"><div class="ec-giro"></div>${esc(t)}<small>${esc(sub || "A diretora de arte está olhando o material. Leva uns 30 a 90 segundos.")}</small></div>`);
  }
  async function fotosParaIA(max = 1024, limite = 12) {
    const fotos = st.assets.filter((a) => a.file_type === "foto").slice(0, limite);
    const out = [];
    for (const a of fotos) { try { out.push({ asset: a, nome: a.file_name, notas: (a.public_metadata || {}).notas || "", dataUrl: await dataUrlDe(a.storage_path, max, 0.8) }); } catch (e) { /* pula foto que não abriu */ } }
    return out;
  }
  async function refsParaIA(ids) {
    const lista = st.refs.filter((r) => ids.includes(r.id)).slice(0, 8), out = [];
    for (const r of lista) { let dataUrl = ""; if (r.storage_path) { try { dataUrl = await dataUrlDe(r.storage_path, 800, 0.78); } catch (e) { /* sem imagem */ } } out.push({ titulo: r.title, tipo: TIPOS_REF[r.reference_type] || r.reference_type, url: r.source_url || "", notas: r.notes || "", dataUrl }); }
    return out;
  }
  async function docsParaIA() {
    const out = []; let texto = "";
    for (const a of st.assets) {
      if (a.file_type === "pdf" && out.length < 3) { try { const d = await dataUrlDe(a.storage_path); if (d.length < 6e6) out.push({ nome: a.file_name, dataUrl: d }); else toast(a.file_name + " é grande demais para a IA (máx. ~4 MB).", true); } catch (e) { /* pula */ } }
      if (a.file_type === "texto") { try { texto += "\n--- " + a.file_name + " ---\n" + (await (await fetch(await urlDe(a.storage_path))).text()).slice(0, 5000); } catch (e) { /* pula */ } }
    }
    return { docs: out, texto };
  }
  function identidade() {
    const p = paletaOficial();
    return `Identidade oficial da Mari Bonetto (@maribonettougc, criadora UGC; nichos beleza, maternidade de crianças maiores, casa, achadinhos, autoestima): estética minimalista, editorial, elegante e feminina. Paleta oficial (${p.nome}): ${p.cores.join(", ")}. Tipografia: Bootzy (fonte própria dela${st.temBootzy ? "" : "; ainda não enviada, use com moderação"}) ou DM Serif Display nos títulos, Poppins no texto. Assinatura: @maribonettougc.`;
  }
  async function gerar() {
    const briefing = $("#ec-brief").value.trim(), objetivo = $("#ec-obj").value.trim();
    const temFoto = st.assets.some((a) => a.file_type === "foto");
    if (!briefing && !temFoto && !st.assets.length) { toast("Escreva o que vamos criar ou envie algum material.", true); return; }
    D().briefing = briefing; D().objetivo = objetivo; D().tipoPedido = $("#ec-tipo").value;
    const h = +$("#ec-formato").value; st.proj.canvas_height = h;
    const pal = st.pals.find((p) => p.id === $("#ec-pal").value);
    D().paleta = pal ? { nome: pal.name, cores: pal.colors } : paletaOficial();
    const refIds = $$("#ec-refsel input:checked").map((i) => i.value); D().refsUsadas = refIds;
    const btn = $("#ec-gerar"); btn.disabled = true;
    const passos = $("#ec-passos"); const passo = (n) => { if (passos) $$("div", passos).forEach((d, i) => { d.className = i < n ? "feito" : i === n ? "agora" : ""; }); };
    try {
      await garantirProjeto();
      if (pags().length) await salvarVersao("Antes de gerar de novo");
      trabalhando("Preparando o material", "Reduzindo fotos e referências para enviar."); passo(0);
      const fotos = await fotosParaIA(1024, 12), refs = await refsParaIA(refIds), { docs, texto } = await docsParaIA();
      trabalhando("A diretora de arte está criando", "Analisando fotos, referências e briefing e montando cada página."); passo(1);
      const n = +$("#ec-npag").value || 0;
      const r = await ia({ acao: "gerar", briefing, objetivo, tipo: D().tipoPedido, paginas: n || undefined, formato: { w: W(), h: H() }, fotos: fotos.map((f) => ({ nome: f.nome, notas: f.notas, dataUrl: f.dataUrl })), refs, docs, textoExtra: ((D().textoExtra || "") + "\n" + texto).trim(), paleta: D().paleta, identidade: identidade() });
      trabalhando("Montando os elementos editáveis", "Transformando o design em textos, fotos e formas que você pode mexer."); passo(2);
      await carregarScript(LIB.fabric); await fontesProntas();
      const fotosAssets = fotos.map((f) => f.asset), novas = [];
      for (const p of r.design.paginas) novas.push(await paginaDeSpec(p, fotosAssets));
      D().paginas = novas; D().fontes = r.design.fontes; D().legenda = r.design.legenda; D().direcao = r.design.direcao;
      if (r.design.paleta && r.design.paleta.length >= 3 && !pal) D().paleta = { nome: "Sugerida pela IA", cores: r.design.paleta };
      if (st.proj.name === "Novo projeto" && r.design.nome) st.proj.name = r.design.nome;
      st.proj.project_type = r.design.tipo; st.proj.status = "em_edicao"; D().motor = r.motor + " · " + (r.modelo || "");
      st.hist = []; st.fut = []; st.thumbs = {}; st.pag = 0; st.sujo = true;
      passo(3); trabalhando("");
      if (r.avisos && r.avisos.length) toast(r.avisos.join(" "), true);
      await irPara("editor"); st.sujo = true; await salvar(true);
    } catch (e) { trabalhando(""); passo(-1); toast(e.message, true); }
    finally { btn.disabled = false; }
  }
  async function iaPagina(pedido) {
    if (!pags().length) return;
    try {
      guardarPaginaAtual(); await salvarVersao("Antes de: " + pedido.slice(0, 40));
      trabalhando("Ajustando esta página", pedido);
      const fotos = await fotosParaIA(640, 8), idx = fotos.map((f) => f.asset.id);
      const spec = await specDaPagina(pags()[st.pag].fabric, idx);
      const r = await ia({ acao: "pagina", pedido, pagina: Object.assign({ id: pags()[st.pag].id, nota: pags()[st.pag].nota }, spec), formato: { w: W(), h: H() }, contexto: { pagina: st.pag + 1, total: pags().length, fontes: D().fontes, paleta: D().paleta, direcao: D().direcao, briefing: D().briefing }, fotos: fotos.map((f) => ({ nome: f.nome, notas: f.notas, dataUrl: f.dataUrl })), identidade: identidade() });
      const nova = await paginaDeSpec(r.pagina, fotos.map((f) => f.asset)); nova.id = pags()[st.pag].id;
      pags()[st.pag] = nova; delete st.thumbs[nova.id];
      await carregarPagina(st.pag); pintarPaginas(); marcar(); trabalhando("");
      toast(r.resposta || "Página ajustada. Ctrl+Z desfaz.");
    } catch (e) { trabalhando(""); toast(e.message, true); }
  }
  async function iaProjeto(pedido, extra) {
    try {
      guardarPaginaAtual(); await salvarVersao("Antes de: " + pedido.slice(0, 40));
      trabalhando("Ajustando o projeto inteiro", pedido);
      const fotos = await fotosParaIA(640, 8), idx = fotos.map((f) => f.asset.id), design = { nome: st.proj.name, tipo: st.proj.project_type, paleta: D().paleta.cores, fontes: D().fontes, legenda: D().legenda, direcao: D().direcao, paginas: [] };
      for (const p of pags()) design.paginas.push(Object.assign({ id: p.id, nota: p.nota }, await specDaPagina(p.fabric, idx)));
      const formato = Object.assign({ w: W(), h: H() }, (extra && extra.formato) || {});
      const r = await ia({ acao: "projeto", pedido, design, formato, fotos: fotos.map((f) => ({ nome: f.nome, notas: f.notas, dataUrl: f.dataUrl })), identidade: identidade() });
      if (extra && extra.formato) { st.proj.canvas_height = formato.h; ajustarZoom(0); }
      const novas = []; for (const p of r.design.paginas) novas.push(await paginaDeSpec(p, fotos.map((f) => f.asset)));
      D().paginas = novas; D().fontes = r.design.fontes; if (r.design.legenda) D().legenda = r.design.legenda; if (r.design.direcao && r.design.direcao.conceito) D().direcao = r.design.direcao;
      if (r.design.paleta && r.design.paleta.length >= 3) D().paleta = { nome: "Sugerida pela IA", cores: r.design.paleta };
      st.thumbs = {}; st.pag = Math.min(st.pag, novas.length - 1);
      await carregarPagina(st.pag); pintarPaginas(); pintarGaveta(); marcar(); trabalhando("");
      toast(r.resposta || "Projeto ajustado. Ctrl+Z desfaz.");
    } catch (e) { trabalhando(""); toast(e.message, true); }
  }

  // ---------------- exportar ----------------
  function baixar(url, nome) { const a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); }
  const nomeArq = () => (st.proj.name || "projeto").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "projeto";
  async function exportar(como) {
    if (!pags().length) return;
    guardarPaginaAtual(); const n = pags().length, nome = nomeArq(), pad = (i) => String(i + 1).padStart(2, "0");
    try {
      toast("Gerando em alta qualidade…");
      if (como === "png" || como === "jpg") { baixar(await renderizar(st.pag, 1, como, 0.95), `${nome}-${pad(st.pag)}.${como}`); }
      else if (como === "todas") { for (let i = 0; i < n; i++) { baixar(await renderizar(i, 1, "png"), `${nome}-${pad(i)}.png`); await new Promise((r) => setTimeout(r, 450)); } }
      else if (como === "zip") {
        await carregarScript(LIB.zip); const z = new JSZip();
        for (let i = 0; i < n; i++) z.file(`${nome}-${pad(i)}.png`, (await renderizar(i, 1, "png")).split(",")[1], { base64: true });
        const blob = await z.generateAsync({ type: "blob" }); const u = URL.createObjectURL(blob); baixar(u, `${nome}.zip`); setTimeout(() => URL.revokeObjectURL(u), 4000);
      } else if (como === "pdf") {
        await carregarScript(LIB.pdf); const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: "px", format: [W(), H()], orientation: H() >= W() ? "portrait" : "landscape", hotfixes: ["px_scaling"], compress: true });
        for (let i = 0; i < n; i++) { if (i) doc.addPage([W(), H()], H() >= W() ? "portrait" : "landscape"); doc.addImage(await renderizar(i, 1, "jpg", 0.95), "JPEG", 0, 0, W(), H()); }
        doc.save(`${nome}.pdf`);
      }
      toast("Pronto! Arquivo baixado.");
    } catch (e) { toast("Não exportou: " + e.message, true); }
  }

  // ---------------- feed ----------------
  async function capaParaFeed() {
    if (!st.proj || !pags().length) return "";
    try { return await renderizar(0, 360 / W(), "jpg", 0.82); } catch (e) { return ""; }
  }
  async function enviarFeed(arqs) {
    try {
      let ordem = st.feed.length;
      for (const f of [...arqs].slice(0, 30)) {
        if (!/^image\//.test(f.type)) continue;
        const up = await subir(f, "feed");
        const { data, error } = await banco().from("creative_assets").insert({ project_id: null, file_name: f.name, file_type: "feed", storage_path: up.caminho, public_metadata: { ordem: ordem++ } }).select().single();
        if (error) throw new Error(error.message); st.feed.push(data);
      }
      await pintarFeedTudo();
    } catch (e) { toast(e.message, true); }
  }
  async function salvarOrdemFeed(lista) {
    st.feed = lista;
    await Promise.all(lista.map((a, i) => ((a.public_metadata || {}).ordem === i ? null : banco().from("creative_assets").update({ public_metadata: Object.assign({}, a.public_metadata, { ordem: i }) }).eq("id", a.id).then(() => { a.public_metadata = Object.assign({}, a.public_metadata, { ordem: i }); }))));
  }
  async function apagarFeed(id) {
    const a = st.feed.find((x) => x.id === id); if (!a) return;
    if (!(await confirmar("Tirar esta foto da prévia do feed?", { ok: "Tirar", perigo: true }))) return;
    await banco().storage.from(BUCKET).remove([a.storage_path]); await banco().from("creative_assets").delete().eq("id", id);
    await salvarOrdemFeed(st.feed.filter((x) => x.id !== id)); pintarFeedTudo();
  }
  async function gradeFeedHtml(mini) {
    const urls = await urlsAssinadas(st.feed.map((a) => a.storage_path)), capa = await capaParaFeed();
    const pos = Math.min(st.proj ? (D().feedPos || 0) : -1, st.feed.length), itens = [];
    let k = 0;
    const total = st.feed.length + (capa ? 1 : 0);
    for (let i = 0; i < total; i++) {
      if (capa && i === pos) itens.push(`<div class="ec-fi novo" draggable="true" data-novo="1">${capa ? `<img src="${capa}" alt="Novo post">` : ""}${pags().length > 1 ? `<svg class="car" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ICO.car}</svg>` : ""}</div>`);
      else { const a = st.feed[k++]; itens.push(`<div class="ec-fi" draggable="true" data-id="${a.id}"><img src="${esc(urls[a.storage_path])}" alt="">${mini ? "" : `<button class="x" data-tirar="${a.id}" title="Tirar">×</button>`}</div>`); }
    }
    while (itens.length < 9) itens.push(`<div class="ec-fi" style="cursor:default"></div>`);
    return itens.join("");
  }
  function ligarFeed(box) {
    let arrastado = null;
    $$(".ec-fi[draggable]", box).forEach((el) => {
      el.addEventListener("dragstart", () => { arrastado = el; el.classList.add("arrastando"); });
      el.addEventListener("dragend", () => { el.classList.remove("arrastando"); $$(".alvo", box).forEach((x) => x.classList.remove("alvo")); });
      el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("alvo"); });
      el.addEventListener("dragleave", () => el.classList.remove("alvo"));
      el.addEventListener("drop", async (e) => { e.preventDefault(); if (!arrastado || arrastado === el) return; await soltarFeed(arrastado, el, box); });
    });
    $$("[data-tirar]", box).forEach((b) => b.onclick = (e) => { e.stopPropagation(); apagarFeed(b.dataset.tirar); });
  }
  async function soltarFeed(de, para, box) {
    const ordemAtual = $$(".ec-fi[draggable]", box).map((el) => el.dataset.novo ? "NOVO" : el.dataset.id);
    const a = ordemAtual.indexOf(de.dataset.novo ? "NOVO" : de.dataset.id), b = ordemAtual.indexOf(para.dataset.novo ? "NOVO" : para.dataset.id);
    const [x] = ordemAtual.splice(a, 1); ordemAtual.splice(b, 0, x);
    if (st.proj && ordemAtual.includes("NOVO")) { D().feedPos = ordemAtual.indexOf("NOVO"); marcarSujo(); }
    await salvarOrdemFeed(ordemAtual.filter((v) => v !== "NOVO").map((id) => st.feed.find((f) => f.id === id)));
    pintarFeedTudo();
  }
  async function moverNovo(d) { if (!st.proj) return; D().feedPos = Math.max(0, Math.min(st.feed.length, (D().feedPos || 0) + d)); marcarSujo(); pintarFeedTudo(); }
  async function pintarFeedTudo() {
    for (const box of $$("[data-feed]")) { box.classList.toggle("quadrado", st.feedQuadrado); box.innerHTML = await gradeFeedHtml(box.dataset.feed === "mini"); ligarFeed(box); }
  }

  // ---------------- telas ----------------
  function soltarCanvas() {
    if (!st.cv) return;
    guardarPaginaAtual();
    try { st.cv.dispose(); } catch (e) { /* já foi */ }
    st.cv = null;
  }
  function irPara(v) {
    if (st.vista === "editor" && v !== "editor") { soltarCanvas(); salvar(); }
    st.vista = v; ls.set("vista", v); return pintar();
  }
  function pintarMotor() {
    const box = $(".ec-topo .ec-linha"); if (!box || !st.motor) return;
    const m = st.motor;
    box.innerHTML = `<span class="ec-motor ${m.motor}"><i></i>${m.motor === "claude" ? "Claude: " + esc(m.modelo || "") : m.motor === "groq" ? "IA grátis (Groq). Com a chave da Anthropic, vira o Claude" : "Sem IA configurada"}</span>`;
  }
  function pintar() {
    const raiz = $("#aba-estudio"); if (!raiz) return;
    const nav = [["criar", "Criar"], ["editor", "Editor"], ["referencias", "Referências"], ["feed", "Prévia do feed"], ["projetos", "Meus projetos"]];
    raiz.innerHTML = `<div class="ec">
      <div class="ec-topo"><div><div class="ec-sobre">Edição · Criação de fotos</div><h2 class="ec-titulo">Estúdio <em>criativo</em></h2></div>
        <div class="ec-linha"></div></div>
      <nav class="ec-nav" style="margin-bottom:14px">${nav.map(([k, t]) => `<button type="button" data-ir="${k}" class="${st.vista === k ? "on" : ""}">${t}</button>`).join("")}</nav>
      <div id="ec-corpo"></div></div>`;
    $$("[data-ir]", raiz).forEach((b) => b.onclick = () => { if (b.dataset.ir === "editor" && (!st.proj || !pags().length)) { toast("Crie ou abra um projeto primeiro."); return; } irPara(b.dataset.ir); });
    pintarMotor();
    return ({ criar: telaCriar, editor: telaEditor, referencias: telaReferencias, feed: telaFeed, projetos: telaProjetos })[st.vista]();
  }

  function telaCriar() {
    const c = $("#ec-corpo"), d = D();
    const comImg = st.refs.filter((r) => r.storage_path);
    if (st.selRefs === null) st.selRefs = (d.refsUsadas && d.refsUsadas.length ? d.refsUsadas : comImg.slice(0, 6).map((r) => r.id));
    c.innerHTML = `<div class="ec-criar">
      <section class="ec-cartao">
        <h3>Material</h3><p class="ec-dica">Fotos, imagens, PDF do briefing, textos e prints. Tudo fica guardado no projeto.</p>
        <label class="ec-solta" id="ec-solta">${ic("foto")} Arraste aqui ou toque para escolher<input type="file" id="ec-arq" multiple accept="image/*,application/pdf,.txt,.md" hidden></label>
        <div class="ec-mats" id="ec-mats"></div>
        <h4>Texto, legenda ou informações do produto</h4>
        <textarea id="ec-textoextra" rows="4" placeholder="Cole aqui textos, a legenda, informações do produto ou da campanha.">${esc(d.textoExtra || "")}</textarea>
        <h4>Links de referência</h4>
        <div class="ec-linha"><input type="url" id="ec-link" placeholder="https://www.instagram.com/p/... ou pinterest"><button class="ec-btn peq" id="ec-link-add">Adicionar</button></div>
        <p class="ec-dica" style="margin-top:6px">O link entra na biblioteca. Se o site bloquear a imagem, mande um print em Referências.</p>
      </section>
      <section class="ec-cartao ec-briefing" id="ec-criar-dir">
        <h3>O que vamos criar hoje?</h3>
        <p class="ec-dica">Ex.: "Transforme essas fotos em um carrossel de lifestyle", "Crie uma capa impactante sobre maternidade", "Faça um post com estética editorial".</p>
        <textarea id="ec-brief" placeholder="Descreva a ideia, o tema e o que não pode faltar.">${esc(d.briefing || "")}</textarea>
        <div class="ec-g2">
          <label class="ec-campo"><span>Objetivo da publicação</span><input type="text" id="ec-obj" value="${esc(d.objetivo || "")}" placeholder="Ex.: atrair marcas de beleza"></label>
          <label class="ec-campo"><span>Tipo</span><select id="ec-tipo"><option value="auto">A IA decide</option><option value="carrossel">Carrossel</option><option value="post">Post único</option><option value="sequencia">Sequência de posts</option></select></label>
          <label class="ec-campo"><span>Formato</span><select id="ec-formato"><option value="1350">Retrato 1080 × 1350</option><option value="1080">Quadrado 1080 × 1080</option></select></label>
          <label class="ec-campo"><span>Páginas</span><select id="ec-npag"><option value="0">A IA decide</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<option>${n}</option>`).join("")}</select></label>
        </div>
        <label class="ec-campo"><span>Paleta para este design</span><select id="ec-pal"><option value="">Oficial (identidade do painel)</option>${st.pals.filter((p) => !p.is_default).map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></label>
        <h4>Referências que a IA vai olhar</h4>
        ${comImg.length ? `<div class="ec-refsel" id="ec-refsel">${comImg.map((r) => `<label class="${st.selRefs.includes(r.id) ? "on" : ""}" title="${esc(r.title)}"><input type="checkbox" value="${r.id}" ${st.selRefs.includes(r.id) ? "checked" : ""}><img data-path="${esc(r.storage_path)}" alt=""><span>${esc(r.title)}</span></label>`).join("")}</div>` : `<div class="ec-aviso">Nenhuma referência com imagem ainda. Os links que você mandou estão em Referências, mas o Instagram não deixa ler as imagens: envie os prints lá para a IA enxergar.</div>`}
        <div class="ec-linha" style="margin-top:14px"><button class="ec-btn pri" id="ec-gerar">${ic("ia")} Criar com a diretora de arte</button><button class="ec-btn" id="ec-branco">Começar em branco</button></div>
        <div class="ec-progresso" id="ec-passos"><div>Preparar o material</div><div>Analisar e criar a direção visual</div><div>Montar os elementos editáveis</div><div>Abrir no editor</div></div>
      </section></div>`;
    $("#ec-tipo").value = d.tipoPedido || "auto"; $("#ec-formato").value = String(H());
    pintarMateriais(); pintarImgs(c);
    $("#ec-textoextra").oninput = (e) => { d.textoExtra = e.target.value; if (st.proj.id) marcarSujo(); };
    $("#ec-brief").oninput = (e) => { d.briefing = e.target.value; if (st.proj.id) marcarSujo(); };
    const solta = $("#ec-solta"), arq = $("#ec-arq");
    arq.onchange = () => { enviarMateriais(arq.files); arq.value = ""; };
    ["dragover", "dragenter"].forEach((n) => solta.addEventListener(n, (e) => { e.preventDefault(); solta.classList.add("sobre"); }));
    ["dragleave", "drop"].forEach((n) => solta.addEventListener(n, () => solta.classList.remove("sobre")));
    solta.addEventListener("drop", (e) => { e.preventDefault(); enviarMateriais(e.dataTransfer.files); });
    $$("#ec-refsel input").forEach((i) => i.onchange = () => { i.parentElement.classList.toggle("on", i.checked); st.selRefs = $$("#ec-refsel input:checked").map((x) => x.value); });
    $("#ec-link-add").onclick = async () => { const u = $("#ec-link").value.trim(); if (!u) return; const r = await adicionarLink(u); if (r) { $("#ec-link").value = ""; if (r.storage_path) { st.selRefs.push(r.id); telaCriar(); } } };
    $("#ec-gerar").onclick = gerar;
    $("#ec-branco").onclick = async () => { D().paginas = [paginaEmBranco()]; st.proj.canvas_height = +$("#ec-formato").value; st.proj.status = "em_edicao"; st.hist = []; await garantirProjeto(); st.sujo = true; irPara("editor"); };
  }
  async function pintarImgs(raiz) {
    const imgs = $$("img[data-path]", raiz); if (!imgs.length) return;
    try { const m = await urlsAssinadas(imgs.map((i) => i.dataset.path)); imgs.forEach((i) => { i.src = m[i.dataset.path] || ""; }); } catch (e) { /* sem miniaturas */ }
  }
  function pintarMateriais() {
    const box = $("#ec-mats"); if (!box) return;
    if (!st.assets.length) { box.innerHTML = ""; return; }
    box.innerHTML = st.assets.map((a) => `<div class="ec-mat" title="${esc(a.file_name)}">${a.file_type === "foto" ? `<img data-path="${esc(a.storage_path)}" alt="">` : `<div class="tipo">${a.file_type === "pdf" ? "PDF" : "Texto"}<br>${esc(a.file_name)}</div>`}<button data-tira="${a.id}" title="Tirar do projeto">×</button></div>`).join("");
    pintarImgs(box);
    $$("[data-tira]", box).forEach((b) => b.onclick = () => tirarMaterial(b.dataset.tira));
  }
  async function enviarMateriais(arqs) {
    const lista = [...arqs]; if (!lista.length) return;
    try {
      await garantirProjeto(); toast(`Enviando ${lista.length} arquivo(s)…`);
      for (const f of lista) {
        const up = await subir(f, "projetos/" + st.proj.id);
        const tipo = /^image\//.test(up.tipo) ? "foto" : up.tipo === "application/pdf" ? "pdf" : "texto";
        const { data, error } = await banco().from("creative_assets").insert({ project_id: st.proj.id, file_name: f.name, file_type: tipo, storage_path: up.caminho, public_metadata: { w: up.w, h: up.h, tamanho: f.size } }).select().single();
        if (error) throw new Error(error.message);
        st.assets.push(data);
      }
      toast("Material guardado."); pintarMateriais(); if (st.vista === "editor") pintarGaveta();
    } catch (e) { toast(e.message, true); pintarMateriais(); }
  }
  async function tirarMaterial(id) {
    const a = st.assets.find((x) => x.id === id); if (!a) return;
    if (!(await confirmar(`Tirar "${a.file_name}" do projeto? Se ela estiver numa página, a foto continua lá até você trocar.`, { ok: "Tirar", perigo: true }))) return;
    await banco().from("creative_assets").delete().eq("id", id);
    st.assets = st.assets.filter((x) => x.id !== id); pintarMateriais();
  }

  // ---------- editor ----------
  async function telaEditor() {
    const c = $("#ec-corpo");
    const ferr = [["elementos", "Elementos", "forma"], ["texto", "Texto", "texto"], ["fotos", "Fotos", "foto"], ["camadas", "Camadas", "camadas"], ["estilo", "Paleta e fontes", "paleta"], ["ia", "Diretora", "ia"]];
    c.innerHTML = `<div class="ec-ed">
      <div class="ec-barra">
        <input class="nome" id="ec-nome" value="${esc(st.proj.name)}" aria-label="Nome do projeto">
        <span class="sep"></span>
        <button class="ec-btn quad" id="ec-desf" title="Desfazer (Ctrl+Z)">${ic("desf")}</button><button class="ec-btn quad" id="ec-refaz" title="Refazer (Ctrl+Shift+Z)">${ic("ref")}</button>
        <span class="sep"></span>
        <select id="ec-fmt" style="width:auto;padding:5px 8px;font-size:12.5px"><option value="1350">Retrato 4:5</option><option value="1080">Quadrado 1:1</option></select>
        <select id="ec-status" style="width:auto;padding:5px 8px;font-size:12.5px">${Object.entries(STATUS).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select>
        <span class="ec-salvo" id="ec-salvo">${st.proj.updated_at ? "Salvo" : ""}</span>
        <button class="ec-btn peq" id="ec-versoes">${ic("salvar")} Versões</button>
        <button class="ec-btn peq pri" id="ec-exportar">${ic("baixar")} Exportar</button>
      </div>
      <nav class="ec-trilho">${ferr.map(([k, t, i]) => `<button type="button" data-ferr="${k}" class="${st.ferr === k ? "on" : ""}">${ic(i)}${t}</button>`).join("")}</nav>
      <aside class="ec-gaveta" id="ec-gaveta"></aside>
      <div class="ec-palco"><div class="ec-palco-in"><canvas id="ec-canvas"></canvas></div>
        <div class="ec-zoom"><button class="ec-btn quad peq" id="ec-zm">${ic("menos")}</button><input type="range" id="ec-zoom" min="15" max="200" value="50"><button class="ec-btn quad peq" id="ec-zp">${ic("mais")}</button><span id="ec-zoom-t">50%</span><button class="ec-btn peq" id="ec-zfit">Caber</button></div></div>
      <aside class="ec-lado" id="ec-lado"></aside>
      <div class="ec-paginas" id="ec-paginas"></div>
    </div>`;
    $("#ec-fmt").value = String(H()); $("#ec-status").value = st.proj.status || "rascunho";
    $("#ec-nome").onchange = (e) => { st.proj.name = e.target.value.trim() || "Projeto sem nome"; marcarSujo(); };
    $("#ec-fmt").onchange = (e) => mudarFormato(+e.target.value);
    $("#ec-status").onchange = (e) => { st.proj.status = e.target.value; marcarSujo(); };
    $("#ec-desf").onclick = desfazer; $("#ec-refaz").onclick = refazer;
    $("#ec-versoes").onclick = janelaVersoes;
    $("#ec-exportar").onclick = (e) => menu(e.currentTarget, [["Esta página em PNG", () => exportar("png")], ["Esta página em JPG", () => exportar("jpg")], ["Todas as páginas (PNG separados)", () => exportar("todas")], ["Carrossel em ZIP", () => exportar("zip")], ["PDF", () => exportar("pdf")]]);
    $$("[data-ferr]").forEach((b) => b.onclick = () => { st.ferr = b.dataset.ferr; $$("[data-ferr]").forEach((x) => x.classList.toggle("on", x === b)); pintarGaveta(); });
    $("#ec-zoom").oninput = (e) => { ajustarZoom(e.target.value / 100); ls.set("zoom", st.zoom); };
    $("#ec-zm").onclick = () => { ajustarZoom(Math.max(0.15, st.zoom - 0.1)); ls.set("zoom", st.zoom); };
    $("#ec-zp").onclick = () => { ajustarZoom(Math.min(2, st.zoom + 0.1)); ls.set("zoom", st.zoom); };
    $("#ec-zfit").onclick = () => { ls.set("zoom", 0); ajustarZoom(0); };
    try { await montarCanvas(); } catch (e) { $(".ec-palco-in").innerHTML = `<div class="ec-aviso ec-erro">${esc(e.message)}. Confira a internet e recarregue.</div>`; return; }
    if (!pags().length) D().paginas = [paginaEmBranco()];
    st.carregando = false;
    await carregarPagina(Math.min(st.pag, pags().length - 1));
    pintarPaginas(); pintarGaveta(); pintarProps(); pintarDesfazer(); miniaturasQueFaltam();
    if (st.sujo) marcarSujo();
  }
  function menu(ancora, itens) {
    $$(".ec-menu").forEach((m) => m.remove());
    const r = ancora.getBoundingClientRect(), m = document.createElement("div"); m.className = "ec-menu";
    m.style.top = (r.bottom + window.scrollY + 6) + "px"; m.style.left = Math.max(8, Math.min(window.innerWidth - 230, r.right + window.scrollX - 220)) + "px";
    m.innerHTML = itens.map(([t], i) => `<button type="button" data-i="${i}">${esc(t)}</button>`).join("");
    document.body.appendChild(m);
    $$("button", m).forEach((b) => b.onclick = () => { m.remove(); itens[+b.dataset.i][1](); });
    setTimeout(() => document.addEventListener("click", function fora(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("click", fora); } }), 0);
  }
  function pintarPaginas() {
    const box = $("#ec-paginas"); if (!box) return;
    box.innerHTML = pags().map((p, i) => `<div class="ec-pg ${i === st.pag ? "on" : ""}" data-i="${i}" draggable="true" title="Página ${i + 1}${p.nota ? ": " + esc(p.nota) : ""}"><b>${i + 1}</b><img src="${st.thumbs[p.id] || "data:image/gif;base64,R0lGODlhAQABAAAAACw="}" style="aspect-ratio:${W()}/${H()};background:${esc(p.fabric.background || "#F6EFE6")}" alt=""></div>`).join("") +
      `<div class="ec-pg-acoes"><button class="ec-btn peq" id="ec-pg-add">${ic("mais")} Página</button><button class="ec-btn peq" id="ec-pg-dup">${ic("dup")} Duplicar</button></div>
       <div class="ec-pg-acoes"><button class="ec-btn peq" id="ec-pg-esq">${ic("esq")} Mover</button><button class="ec-btn peq perigo" id="ec-pg-del">${ic("lixo")} Apagar</button></div>`;
    let arr = null;
    $$(".ec-pg", box).forEach((el) => {
      const i = +el.dataset.i;
      el.onclick = () => irPagina(i);
      el.addEventListener("dragstart", () => { arr = i; el.classList.add("arrastando"); });
      el.addEventListener("dragend", () => el.classList.remove("arrastando"));
      el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("alvo"); });
      el.addEventListener("dragleave", () => el.classList.remove("alvo"));
      el.addEventListener("drop", (e) => { e.preventDefault(); el.classList.remove("alvo"); if (arr != null) moverPagina(arr, i); arr = null; });
    });
    $("#ec-pg-add").onclick = () => novaPagina(st.pag);
    $("#ec-pg-dup").onclick = () => duplicarPagina(st.pag);
    $("#ec-pg-del").onclick = () => apagarPagina(st.pag);
    $("#ec-pg-esq").onclick = (e) => menu(e.currentTarget, [["Mover para a esquerda", () => moverPagina(st.pag, st.pag - 1)], ["Mover para a direita", () => moverPagina(st.pag, st.pag + 1)], ["Mover para o começo", () => moverPagina(st.pag, 0)], ["Mover para o fim", () => moverPagina(st.pag, pags().length - 1)]]);
  }
  function pintarGaveta() {
    const g = $("#ec-gaveta"); if (!g) return;
    const f = st.ferr, pal = D().paleta.cores;
    if (f === "elementos") {
      const formas = [["ret", "Retângulo", '<rect x="3" y="6" width="18" height="12"/>'], ["redondo", "Arredondado", '<rect x="3" y="6" width="18" height="12" rx="4"/>'], ["circ", "Círculo", '<circle cx="12" cy="12" r="8"/>'], ["pilula", "Pílula", '<rect x="3" y="9" width="18" height="6" rx="3"/>'], ["moldura", "Moldura", '<rect x="4" y="4" width="16" height="16"/><rect x="7" y="7" width="10" height="10"/>'], ["moldura-r", "Arco", '<path d="M6 21V11a6 6 0 0112 0v10z"/>'], ["linha", "Linha", '<path d="M3 12h18"/>'], ["linha-v", "Linha em pé", '<path d="M12 3v18"/>']];
      const decos = [["estrela", "Estrela"], ["brilho", "Brilho"], ["coracao", "Coração"], ["aspas", "Aspas"], ["seta", "Seta"], ["sublinhado", "Traço à mão"], ["circulo-mao", "Círculo à mão"]];
      g.innerHTML = `<h3>Elementos</h3><h4 class="ec-dica" style="margin:4px 0">Formas e linhas</h4><div class="ec-grade-el">${formas.map(([k, t, s]) => `<button data-forma="${k}" title="${t}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${s}</svg></button>`).join("")}</div>
        <h4 class="ec-dica" style="margin:12px 0 4px">Decorativos</h4><div class="ec-grade-el">${decos.map(([k, t]) => `<button data-forma="${k}" title="${t}"><svg viewBox="0 0 100 100" ${DECO_SVG[k].fill ? `fill="${pal[3] || "#A87058"}"` : `fill="none" stroke="${pal[3] || "#A87058"}" stroke-width="7" stroke-linecap="round"`}><path d="${DECO_SVG[k].d}"/></svg></button>`).join("")}</div>`;
      $$("[data-forma]", g).forEach((b) => b.onclick = () => novaForma(b.dataset.forma));
    } else if (f === "texto") {
      g.innerHTML = `<h3>Texto</h3><div class="ec-txt-add"><button data-txt="titulo" style="font:400 26px ${CSS_FONTE(D().fontes.titulo)};line-height:1.1">Adicionar título</button><button data-txt="subtitulo" style="font:500 17px ${CSS_FONTE(D().fontes.subtitulo)}">Adicionar subtítulo</button><button data-txt="texto" style="font:400 13.5px ${CSS_FONTE(D().fontes.texto)}">Adicionar texto corrido</button></div>
        <p class="ec-dica" style="margin-top:12px">Clique duas vezes no texto da página para escrever. Os ajustes de fonte, cor e espaço aparecem à direita.</p>`;
      $$("[data-txt]", g).forEach((b) => b.onclick = () => novoTexto(b.dataset.txt));
    } else if (f === "fotos") {
      const fotos = st.assets.filter((a) => a.file_type === "foto"), o = sel(), troca = o && o.ecTipo === "imagem";
      g.innerHTML = `<h3>Fotos do projeto</h3><p class="ec-dica">${troca ? "Toque numa foto para <b>substituir</b> a selecionada." : "Toque para pôr na página."}</p>
        <label class="ec-solta" style="margin-bottom:8px">${ic("mais")} Enviar mais fotos<input type="file" id="ec-arq2" multiple accept="image/*" hidden></label>
        <div class="ec-fotos">${fotos.map((a) => `<button data-asset="${a.id}" title="${esc(a.file_name)}"><img data-path="${esc(a.storage_path)}" alt=""></button>`).join("") || '<div class="ec-vazio" style="grid-column:1/-1">Nenhuma foto ainda.</div>'}</div>`;
      pintarImgs(g);
      $("#ec-arq2").onchange = (e) => enviarMateriais(e.target.files);
      $$("[data-asset]", g).forEach((b) => b.onclick = () => { const a = st.assets.find((x) => x.id === b.dataset.asset); const s = sel(); novaImagem(a, s && s.ecTipo === "imagem").catch((e) => toast(e.message, true)); });
    } else if (f === "camadas") { g.innerHTML = `<h3>Camadas</h3><p class="ec-dica">A de cima fica na frente. Clique duas vezes no nome para renomear.</p><div class="ec-camadas" id="ec-camadas"></div>`; pintarCamadas(); }
    else if (f === "estilo") {
      const atual = D().paleta;
      g.innerHTML = `<h3>Paleta</h3><p class="ec-dica">Trocar a paleta muda as cores de todas as páginas. A identidade do painel continua igual.</p>
        <div id="ec-pals">${st.pals.map((p) => `<div class="ec-paleta ${JSON.stringify(p.colors) === JSON.stringify(atual.cores) ? "on" : ""}" data-pal="${p.id}">${p.colors.map((c) => `<i style="background:${esc(c)}"></i>`).join("")}<span>${esc(p.name)}${p.is_default ? " · oficial" : ""}</span>${p.is_default ? "" : `<button class="ec-btn quad peq" data-palx="${p.id}" title="Apagar paleta">×</button>`}</div>`).join("")}</div>
        <div class="ec-linha"><button class="ec-btn peq" id="ec-pal-oficial">Voltar à oficial</button><button class="ec-btn peq" id="ec-pal-nova">${ic("mais")} Nova paleta</button></div>
        <h4 class="ec-dica" style="margin:14px 0 4px">Cores deste projeto</h4><div class="ec-cores">${atual.cores.map((c) => `<button style="background:${esc(c)}" title="${esc(c)}" data-cor="${esc(c)}"></button>`).join("")}</div>
        <h3 style="margin-top:16px">Fontes</h3>
        ${["titulo", "subtitulo", "texto"].map((p) => `<label class="ec-campo"><span>${{ titulo: "Títulos", subtitulo: "Subtítulos", texto: "Texto" }[p]}</span><select data-papel="${p}">${FONTES.map((f2) => `<option ${D().fontes[p] === f2 ? "selected" : ""}>${f2}</option>`).join("")}</select></label>`).join("")}
        ${st.temBootzy ? "" : `<div class="ec-aviso">A Bootzy ainda não foi enviada. Envie pelo editor de vídeo (Minha fonte); até lá ela aparece como Arimo.</div>`}`;
      $$("[data-pal]", g).forEach((el) => el.onclick = (e) => { if (e.target.closest("[data-palx]")) return; const p = st.pals.find((x) => x.id === el.dataset.pal); aplicarPaleta({ nome: p.name, cores: p.colors }); });
      $$("[data-palx]", g).forEach((b) => b.onclick = async () => { if (!(await confirmar("Apagar esta paleta?", { ok: "Apagar", perigo: true }))) return; await banco().from("creative_palettes").delete().eq("id", b.dataset.palx); st.pals = st.pals.filter((p) => p.id !== b.dataset.palx); pintarGaveta(); });
      $("#ec-pal-oficial").onclick = () => aplicarPaleta(paletaOficial());
      $("#ec-pal-nova").onclick = janelaPaleta;
      $$("[data-cor]", g).forEach((b) => b.onclick = () => { const o = sel(); if (!o) { st.cv.backgroundColor = b.dataset.cor; st.cv.requestRenderAll(); marcar(); return; } if (o.type === "textbox" || o.ecTipo !== "imagem") { o.set(o.ecTipo === "deco" && !o.fill ? { stroke: b.dataset.cor } : { fill: b.dataset.cor }); st.cv.requestRenderAll(); marcar(); pintarProps(); } });
      $$("[data-papel]", g).forEach((s) => s.onchange = () => aplicarFonteNoPapel(s.dataset.papel, s.value));
    } else if (f === "ia") {
      const d = D().direcao;
      const acPag = ["Melhorar esta página", "Reorganizar os elementos", "Criar uma nova composição", "Melhorar a hierarquia tipográfica", "Deixar o design mais editorial", "Deixar o design mais minimalista", "Melhorar a leitura", "Sugerir uma chamada mais forte"];
      const acProj = ["Melhorar a capa", "Reorganizar o carrossel", "Criar uma página adicional", "Trocar a paleta de cores", "Criar uma nova direção visual", "Adaptar para o outro formato", "Criar outra versão"];
      g.innerHTML = `<h3>Diretora de arte</h3>
        ${d && d.conceito ? `<div class="ec-direcao"><b>Direção:</b> ${esc(d.conceito)}${d.porque ? `<br><span style="color:var(--suave)">${esc(d.porque)}</span>` : ""}</div>` : ""}
        <h4 class="ec-dica" style="margin:6px 0">Nesta página (${st.pag + 1})</h4><div class="ec-ia-acoes">${acPag.map((t) => `<button data-iap="${esc(t)}">${esc(t)}</button>`).join("")}</div>
        <h4 class="ec-dica" style="margin:12px 0 6px">No projeto inteiro</h4><div class="ec-ia-acoes">${acProj.map((t) => `<button data-iaj="${esc(t)}">${esc(t)}</button>`).join("")}</div>
        <label class="ec-campo" style="margin-top:14px"><span>Pedir com suas palavras</span><textarea id="ec-pedido" rows="3" placeholder="Ex.: deixa o título maior e põe a foto do produto mais pra cima"></textarea></label>
        <div class="ec-linha"><select id="ec-escopo" style="width:auto"><option value="p">Só esta página</option><option value="j">Projeto inteiro</option></select><button class="ec-btn pri peq" id="ec-pedir">${ic("ia")} Pedir</button></div>
        <p class="ec-dica" style="margin-top:8px">Antes de cada mudança da IA salvo uma versão. Ctrl+Z também desfaz.</p>
        <h4 class="ec-dica" style="margin:14px 0 6px">Legenda do post</h4><textarea id="ec-legenda" rows="6">${esc(D().legenda || "")}</textarea>
        <div class="ec-linha" style="margin-top:6px"><button class="ec-btn peq" id="ec-copiar-leg">Copiar legenda</button></div>
        ${D().motor ? `<p class="ec-dica" style="margin-top:10px">Criado por: ${esc(D().motor)}</p>` : ""}`;
      $$("[data-iap]", g).forEach((b) => b.onclick = () => iaPagina(b.dataset.iap));
      $$("[data-iaj]", g).forEach((b) => b.onclick = () => {
        const t = b.dataset.iaj;
        if (t === "Melhorar a capa") { if (st.pag !== 0) irPagina(0).then(() => iaPagina("Melhorar a capa: mais impacto, curiosidade e hierarquia clara")); else iaPagina("Melhorar a capa: mais impacto, curiosidade e hierarquia clara"); return; }
        if (t === "Adaptar para o outro formato") { const h = H() === 1350 ? 1080 : 1350; iaProjeto(`Adaptar todas as páginas para ${W()} x ${h} px, recompondo os elementos para o novo formato`, { formato: { w: W(), h } }); return; }
        if (t === "Criar outra versão") { criarOutraVersao(); return; }
        if (t === "Criar uma página adicional") { iaProjeto("Criar uma página adicional que faça sentido na sequência (antes da página final, se houver), mantendo todas as outras iguais"); return; }
        iaProjeto(t);
      });
      $("#ec-pedir").onclick = () => { const p = $("#ec-pedido").value.trim(); if (!p) return; if ($("#ec-escopo").value === "p") iaPagina(p); else iaProjeto(p); };
      $("#ec-legenda").oninput = (e) => { D().legenda = e.target.value; marcarSujo(); };
      $("#ec-copiar-leg").onclick = () => { navigator.clipboard.writeText(D().legenda || "").then(() => toast("Legenda copiada")); };
    }
  }
  function pintarCamadas() {
    const box = $("#ec-camadas"); if (!box || !st.cv) return;
    const ativo = sel(), lista = st.cv.getObjects().slice().reverse();
    const ativos = ativo ? (ativo.type === "activeSelection" ? ativo.getObjects() : [ativo]) : [];
    box.innerHTML = lista.map((o, k) => `<div class="ec-cam ${ativos.includes(o) ? "on" : ""}" data-k="${k}"><span class="nm ${o.visible === false ? "oculto" : ""}">${esc(nomeDe(o))}</span>
      <button data-c="sobe" title="Para frente">${ic("cima")}</button><button data-c="desce" title="Para trás">${ic("baixo")}</button>
      <button data-c="ver" title="${o.visible === false ? "Mostrar" : "Ocultar"}">${ic(o.visible === false ? "olhoX" : "olho")}</button><button data-c="trava" title="${o.ecBloq ? "Destravar" : "Travar"}">${ic(o.ecBloq ? "cad" : "cadA")}</button></div>`).join("") || '<div class="ec-vazio">Página vazia.</div>';
    $$(".ec-cam", box).forEach((el) => {
      const o = lista[+el.dataset.k];
      el.onclick = (e) => {
        const c = e.target.closest("[data-c]");
        if (c) { e.stopPropagation(); ({ sobe: () => ordem("frente", o), desce: () => ordem("tras", o), ver: () => ocultar(o), trava: () => bloquear(o) })[c.dataset.c](); return; }
        if (o.visible === false) return; st.cv.setActiveObject(o); st.cv.requestRenderAll(); pintarProps(); pintarCamadas();
      };
      el.ondblclick = async () => { const n = await perguntar("Nome da camada", nomeDe(o)); if (n != null) { o.ecNome = n.trim(); marcar(); pintarCamadas(); } };
    });
  }
  function campoNum(rotulo, id, v, min, max, passo = 1) { return `<label class="ec-campo"><span>${rotulo}</span><input type="number" id="${id}" value="${Math.round(v * 100) / 100}" min="${min}" max="${max}" step="${passo}"></label>`; }
  function campoFaixa(rotulo, id, v, min, max, passo = 1) { return `<label class="ec-campo"><span>${rotulo} <b id="${id}-v">${v}</b></span><input type="range" id="${id}" value="${v}" min="${min}" max="${max}" step="${passo}"></label>`; }
  function pintarProps() {
    const box = $("#ec-lado"); if (!box || !st.cv) return;
    const o = sel(), pg = pags()[st.pag];
    let h = "";
    if (!o) {
      h = `<h3>Página ${st.pag + 1}</h3>
        <div class="ec-linha"><label class="ec-campo" style="flex:1"><span>Cor de fundo</span><input type="color" id="pp-fundo" value="${esc(st.cv.backgroundColor || "#F6EFE6")}"></label></div>
        <label class="ec-campo"><span>Intenção da página (para a IA)</span><input type="text" id="pp-nota" value="${esc(pg ? pg.nota || "" : "")}"></label>
        <div class="ec-linha"><button class="ec-btn peq" id="pp-melhorar">${ic("ia")} Melhorar esta página</button></div>
        <h3 style="margin-top:16px">Prévia no feed</h3><p class="ec-dica">Arraste para testar a posição. As fotos do seu feed você envia em "Prévia do feed".</p>
        <div class="ec-feed mini" data-feed="mini"></div>
        <div class="ec-linha" style="margin-top:6px"><button class="ec-btn peq" id="pp-feed-esq">${ic("esq")}</button><button class="ec-btn peq" id="pp-feed-dir">${ic("dir")}</button><button class="ec-btn peq" id="pp-feed-at">Atualizar</button></div>
        <p class="ec-dica" style="margin-top:12px">Atalhos: Ctrl+Z desfaz, Ctrl+C/V copia e cola, Ctrl+D duplica, Delete apaga, setas movem.</p>`;
      box.innerHTML = h;
      $("#pp-fundo").oninput = (e) => { st.cv.backgroundColor = e.target.value; st.cv.requestRenderAll(); };
      $("#pp-fundo").onchange = () => marcar();
      $("#pp-nota").onchange = (e) => { pg.nota = e.target.value; marcarSujo(); };
      $("#pp-melhorar").onclick = () => iaPagina("Melhorar esta página");
      $("#pp-feed-esq").onclick = () => moverNovo(-1); $("#pp-feed-dir").onclick = () => moverNovo(1); $("#pp-feed-at").onclick = () => { guardarPaginaAtual(); pintarFeedTudo(); };
      pintarFeedTudo(); return;
    }
    const multi = o.type === "activeSelection", tipo = multi ? "multi" : o.type === "group" ? "grupo" : o.ecTipo || (o.type === "textbox" ? "texto" : "forma");
    const r = o.getBoundingRect(true, true);
    h += `<h3>${{ texto: "Texto", imagem: "Foto", forma: "Forma", linha: "Linha", deco: "Enfeite", grupo: "Grupo", multi: "Vários elementos" }[tipo] || "Elemento"}</h3>
      <div class="ec-linha" style="margin-bottom:6px"><button class="ec-btn quad peq" id="pp-dup" title="Duplicar (Ctrl+D)">${ic("dup")}</button><button class="ec-btn quad peq" id="pp-frente" title="Para frente">${ic("cima")}</button><button class="ec-btn quad peq" id="pp-tras" title="Para trás">${ic("baixo")}</button>
      ${multi || o.type === "group" ? `<button class="ec-btn peq" id="pp-grupo">${ic("grupo")} ${multi ? "Agrupar" : "Desagrupar"}</button>` : `<button class="ec-btn quad peq" id="pp-trava" title="${o.ecBloq ? "Destravar" : "Travar"}">${ic(o.ecBloq ? "cad" : "cadA")}</button>`}<button class="ec-btn quad peq perigo" id="pp-del" title="Apagar">${ic("lixo")}</button></div>`;
    if (tipo === "texto") {
      h += `<label class="ec-campo"><span>Fonte</span><select id="pp-fonte">${FONTES.map((f) => `<option ${NOME_FONTE(o.fontFamily) === f ? "selected" : ""}>${f}</option>`).join("")}</select></label>
        <div class="ec-g2">${campoNum("Tamanho", "pp-tam", o.fontSize, 8, 400)}<label class="ec-campo"><span>Peso</span><select id="pp-peso">${[300, 400, 500, 600, 700, 800, 900].map((p) => `<option ${+o.fontWeight === p ? "selected" : ""}>${p}</option>`).join("")}</select></label></div>
        <div class="ec-linha"><input type="color" id="pp-cor" value="${esc(o.fill || "#3D2B20")}" title="Cor">
          <div class="ec-alin">${["left", "center", "right", "justify"].map((a) => `<button class="ec-btn quad peq ${o.textAlign === a ? "on" : ""}" data-alin="${a}" title="${{ left: "Esquerda", center: "Centro", right: "Direita", justify: "Justificado" }[a]}"><svg class="tr" viewBox="0 0 24 24">${{ left: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>', center: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>', right: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>', justify: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>' }[a]}</svg></button>`).join("")}</div></div>
        <div class="ec-linha" style="margin-top:6px"><button class="ec-btn peq ${o.fontStyle === "italic" ? "on" : ""}" id="pp-ital"><i>Itálico</i></button><button class="ec-btn peq" id="pp-mai">AA / aa</button></div>
        ${campoFaixa("Altura da linha", "pp-lh", o.lineHeight, 0.7, 2.5, 0.05)}${campoFaixa("Espaço entre letras", "pp-cs", o.charSpacing || 0, -100, 800, 10)}
        <div class="ec-linha"><label class="ec-campo" style="flex:1"><span>Faixa atrás do texto</span><input type="color" id="pp-faixa" value="${esc(o.textBackgroundColor || "#FCEEA8")}"></label><button class="ec-btn peq" id="pp-faixa-x">${o.textBackgroundColor ? "Tirar faixa" : "Sem faixa"}</button></div>
        <label class="ec-campo"><span>Papel no design</span><select id="pp-papel">${["titulo", "subtitulo", "texto"].map((p) => `<option value="${p}" ${(o.ecPapel || "texto") === p ? "selected" : ""}>${{ titulo: "Título", subtitulo: "Subtítulo", texto: "Texto" }[p]}</option>`).join("")}</select></label>`;
    }
    if (tipo === "imagem") {
      const fo = o.ecFoco || { x: 0.5, y: 0.4, z: 1 };
      h += `<p class="ec-dica">A foto preenche a moldura sem distorcer. Arraste as alças para mudar a moldura.</p>
        <div class="ec-linha"><button class="ec-btn peq" id="pp-trocar">Substituir foto</button><button class="ec-btn peq" id="pp-cheia">Página inteira</button></div>
        <h4 class="ec-dica" style="margin:10px 0 0">Enquadramento (recorte)</h4>
        ${campoFaixa("Zoom", "pp-z", fo.z, 1, 4, 0.05)}${campoFaixa("Para os lados", "pp-fx", fo.x, 0, 1, 0.01)}${campoFaixa("Para cima e para baixo", "pp-fy", fo.y, 0, 1, 0.01)}
        ${campoFaixa("Cantos arredondados", "pp-raio", o.ecRaio || 0, 0, 600, 2)}
        <div class="ec-linha"><label class="ec-campo" style="flex:1"><span>Borda</span><input type="range" id="pp-borda" min="0" max="40" value="${o.ecBordaPx || 0}"></label><input type="color" id="pp-bcor" value="${esc(o.stroke || "#FFFFFF")}"></div>`;
    }
    if (tipo === "forma" || tipo === "linha" || tipo === "deco") {
      const corP = (o.ecTipo === "deco" && !o.fill) ? o.stroke : o.fill;
      h += `<div class="ec-linha"><label class="ec-campo"><span>Cor</span><input type="color" id="pp-fill" value="${esc(corP || "#EFE5D8")}"></label>${tipo === "forma" ? `<button class="ec-btn peq" id="pp-semfill">${o.fill ? "Sem preenchimento" : "Preencher"}</button>` : ""}</div>
        ${tipo === "forma" ? `<div class="ec-linha"><label class="ec-campo" style="flex:1"><span>Borda <b id="pp-sw-v">${o.strokeWidth || 0}</b></span><input type="range" id="pp-sw" min="0" max="40" value="${o.strokeWidth || 0}"></label><input type="color" id="pp-scor" value="${esc(o.stroke || "#6B4A35")}"></div>` : ""}
        ${o.type === "rect" && tipo === "forma" ? campoFaixa("Cantos", "pp-rx", o.rx || 0, 0, 500, 2) : ""}`;
    }
    h += `${campoFaixa("Transparência", "pp-op", Math.round((o.opacity ?? 1) * 100), 5, 100, 1)}
      <div class="ec-g2">${campoNum("X", "pp-x", r.left, -5000, 5000)}${campoNum("Y", "pp-y", r.top, -5000, 5000)}${campoNum("Largura", "pp-w", r.width, 2, 6000)}${campoNum("Giro (°)", "pp-rot", o.angle || 0, -360, 360)}</div>
      <h4 class="ec-dica" style="margin:8px 0 4px">Alinhar na página</h4>
      <div class="ec-g3">${[["esq", "Esquerda"], ["centroH", "Centro ↔"], ["dir", "Direita"], ["topo", "Topo"], ["centroV", "Centro ↕"], ["base", "Base"]].map(([k, t]) => `<button class="ec-btn peq" data-alp="${k}">${t}</button>`).join("")}</div>`;
    box.innerHTML = h;
    const aplica = (props, depois) => { if (multi) o.forEachObject((x) => x.set(props)); else o.set(props); if (o.type === "textbox") o.initDimensions(); o.setCoords(); st.cv.requestRenderAll(); if (depois !== false) marcarDepois(); };
    const liga = (id, fn, ev = "input") => { const el = $("#" + id); if (el) el.addEventListener(ev, (e) => { const v = $("#" + id + "-v"); if (v) v.textContent = e.target.value; fn(e.target.value, e); }); };
    $("#pp-dup").onclick = duplicar; $("#pp-frente").onclick = () => ordem("frente"); $("#pp-tras").onclick = () => ordem("tras"); $("#pp-del").onclick = apagar;
    if ($("#pp-grupo")) $("#pp-grupo").onclick = agrupar; if ($("#pp-trava")) $("#pp-trava").onclick = () => bloquear();
    liga("pp-op", (v) => aplica({ opacity: v / 100 }));
    liga("pp-rot", (v) => { o.rotate(+v); o.setCoords(); st.cv.requestRenderAll(); marcarDepois(); }, "change");
    liga("pp-x", (v) => { const rr = o.getBoundingRect(true, true); aplica({ left: o.left + (+v - rr.left) }); }, "change");
    liga("pp-y", (v) => { const rr = o.getBoundingRect(true, true); aplica({ top: o.top + (+v - rr.top) }); }, "change");
    liga("pp-w", (v) => {
      const rr = o.getBoundingRect(true, true), k = +v / rr.width; if (!(k > 0)) return;
      if (o.type === "textbox") aplica({ width: o.width * k });
      else if (o.ecTipo === "imagem") { const f = o.ecFrame || { w: o.width * o.scaleX, h: o.height * o.scaleY }; aplicarCapa(o, f.w * k, f.h * k); st.cv.requestRenderAll(); marcarDepois(); }
      else aplica({ scaleX: o.scaleX * k, scaleY: o.scaleY * k });
    }, "change");
    $$("[data-alp]", box).forEach((b) => b.onclick = () => alinharNaPagina(b.dataset.alp));
    if (tipo === "texto") {
      liga("pp-fonte", (v) => { aplica({ fontFamily: CSS_FONTE(v) }); }, "change");
      liga("pp-tam", (v) => aplica({ fontSize: +v }), "change");
      liga("pp-peso", (v) => aplica({ fontWeight: +v }), "change");
      liga("pp-cor", (v) => aplica({ fill: v }));
      $$("[data-alin]", box).forEach((b) => b.onclick = () => { aplica({ textAlign: b.dataset.alin }); pintarProps(); });
      $("#pp-ital").onclick = () => { aplica({ fontStyle: o.fontStyle === "italic" ? "normal" : "italic" }); pintarProps(); };
      $("#pp-mai").onclick = () => { const t = o.text || ""; aplica({ text: t === t.toLocaleUpperCase("pt-BR") ? t.charAt(0) + t.slice(1).toLocaleLowerCase("pt-BR") : t.toLocaleUpperCase("pt-BR") }); };
      liga("pp-lh", (v) => aplica({ lineHeight: +v }));
      liga("pp-cs", (v) => aplica({ charSpacing: +v }));
      liga("pp-faixa", (v) => aplica({ textBackgroundColor: v }));
      $("#pp-faixa-x").onclick = () => { aplica({ textBackgroundColor: "" }); pintarProps(); };
      liga("pp-papel", (v) => { o.ecPapel = v; marcar(); }, "change");
    }
    if (tipo === "imagem") {
      const crop = () => { const f = o.ecFrame || { w: o.width * o.scaleX, h: o.height * o.scaleY }; aplicarCapa(o, f.w, f.h, { z: +$("#pp-z").value, x: +$("#pp-fx").value, y: +$("#pp-fy").value }); st.cv.requestRenderAll(); marcarDepois(); };
      ["pp-z", "pp-fx", "pp-fy"].forEach((id) => liga(id, crop));
      liga("pp-raio", (v) => { o.ecRaio = +v; crop(); });
      liga("pp-borda", (v) => { o.ecBordaPx = +v; o.set({ stroke: $("#pp-bcor").value, strokeWidth: +v ? +v / o.scaleX : 0, paintFirst: "fill" }); st.cv.requestRenderAll(); marcarDepois(); });
      liga("pp-bcor", (v) => aplica({ stroke: v }));
      $("#pp-trocar").onclick = () => { st.ferr = "fotos"; $$("[data-ferr]").forEach((x) => x.classList.toggle("on", x.dataset.ferr === "fotos")); pintarGaveta(); };
      $("#pp-cheia").onclick = () => { o.set({ left: 0, top: 0, angle: 0 }); aplicarCapa(o, W(), H()); st.cv.requestRenderAll(); marcar(); pintarProps(); };
    }
    if (tipo === "forma" || tipo === "linha" || tipo === "deco") {
      liga("pp-fill", (v) => aplica(o.ecTipo === "deco" && !o.fill ? { stroke: v } : { fill: v }));
      if ($("#pp-semfill")) $("#pp-semfill").onclick = () => { aplica(o.fill ? { fill: "", stroke: o.stroke || "#6B4A35", strokeWidth: o.strokeWidth || 4 } : { fill: $("#pp-fill").value }); pintarProps(); };
      liga("pp-sw", (v) => aplica({ strokeWidth: +v, stroke: $("#pp-scor").value }));
      liga("pp-scor", (v) => aplica({ stroke: v }));
      liga("pp-rx", (v) => aplica({ rx: +v, ry: +v }));
    }
  }
  function marcarDepois() { clearTimeout(marcarDepois.t); marcarDepois.t = setTimeout(marcar, 350); }

  // ---------- janelas ----------
  function janela(titulo, html, aoAbrir) {
    const d = document.createElement("dialog"); d.className = "dq ec"; d.style.width = "min(520px,calc(100vw - 24px))";
    d.innerHTML = `<div class="dq-corpo" style="white-space:normal"><h3 style="font:400 20px 'DM Serif Display',Georgia,serif;color:var(--principal);margin:0 0 10px">${esc(titulo)}</h3>${html}</div><div class="dq-rodape"><button type="button" class="dq-nao">Fechar</button></div>`;
    document.body.appendChild(d); d.querySelector(".dq-nao").onclick = () => d.close();
    d.addEventListener("close", () => d.remove()); d.showModal(); if (aoAbrir) aoAbrir(d); return d;
  }
  async function janelaVersoes() {
    if (!st.proj.id) return;
    const { data } = await banco().from("creative_versions").select("id,version_number,created_at,design_json->rotuloVersao").eq("project_id", st.proj.id).order("version_number", { ascending: false }).limit(50);
    janela("Versões do projeto", `<div class="ec-linha" style="margin-bottom:10px"><button class="ec-btn pri peq" id="ev-nova">${ic("salvar")} Salvar versão agora</button></div>
      <div class="ec-versoes">${(data || []).map((v) => `<div class="ec-versao"><span><b>v${v.version_number}</b> · ${new Date(v.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}${v.rotuloVersao ? `<br><small style="color:var(--suave)">${esc(v.rotuloVersao)}</small>` : ""}</span><button class="ec-btn peq" data-volta="${v.id}">Recuperar</button></div>`).join("") || '<div class="ec-vazio">Nenhuma versão ainda.</div>'}</div>`, (d) => {
      $("#ev-nova", d).onclick = async () => { const r = await perguntar("Nome desta versão (opcional)", ""); if (r === null) return; const n = await salvarVersao(r || "Salva à mão"); if (n) { toast("Versão v" + n + " salva."); d.close(); janelaVersoes(); } };
      $$("[data-volta]", d).forEach((b) => b.onclick = async () => {
        if (!(await confirmar("Recuperar esta versão? A atual vira uma versão nova antes, então nada se perde.", { ok: "Recuperar" }))) return;
        await salvarVersao("Antes de recuperar outra versão");
        const { data: v } = await banco().from("creative_versions").select("design_json").eq("id", b.dataset.volta).single();
        st.proj.design_json = Object.assign(designVazio(), v.design_json); delete st.proj.design_json.rotuloVersao;
        st.thumbs = {}; st.hist = []; st.fut = []; st.pag = 0; st.sujo = true; d.close();
        await carregarPagina(0); pintarPaginas(); pintarGaveta(); marcarSujo(); toast("Versão recuperada.");
      });
    });
  }
  function janelaPaleta() {
    const cores = D().paleta.cores.slice(0, 6);
    janela("Nova paleta", `<label class="ec-campo"><span>Nome</span><input type="text" id="np-nome" placeholder="Ex.: Campanha verão"></label>
      <div class="ec-linha">${[0, 1, 2, 3, 4, 5].map((i) => `<input type="color" data-np="${i}" value="${esc(cores[i] || "#FFFFFF")}">`).join("")}</div>
      <p class="ec-dica" style="margin-top:8px">Ordem: fundo claro, fundo 2, principal, destaque, texto, detalhe.</p>
      <div class="ec-linha"><button class="ec-btn pri peq" id="np-salvar">Salvar e aplicar</button></div>`, (d) => {
      $("#np-salvar", d).onclick = async () => {
        const nome = $("#np-nome", d).value.trim() || "Minha paleta", cs = $$("[data-np]", d).map((i) => i.value.toUpperCase());
        const { data, error } = await banco().from("creative_palettes").insert({ name: nome, colors: cs, is_default: false }).select().single();
        if (error) { toast(error.message, true); return; }
        st.pals.push(data); d.close(); aplicarPaleta({ nome, cores: cs });
      };
    });
  }
  async function criarOutraVersao() {
    guardarPaginaAtual(); await salvar(true);
    const copia = await duplicarProjeto(st.proj.id, " · outra versão"); if (!copia) return;
    await abrirProjeto(copia); iaProjeto("Criar uma nova direção visual diferente da atual para o mesmo conteúdo (outra composição, outra hierarquia), mantendo os textos e fotos");
  }

  // ---------- referências ----------
  async function adicionarLink(url) {
    if (!/^https?:\/\//i.test(url)) { toast("Cole um link que comece com https://", true); return null; }
    const tipo = /instagram\.com\/(p|reel)\//i.test(url) ? "instagram" : /instagram\.com/i.test(url) ? "perfil" : /pinterest|pin\.it/i.test(url) ? "pinterest" : "imagem";
    let storage_path = null, titulo = "";
    try { toast("Lendo o link…"); const r = await ia({ acao: "importar", url }); storage_path = r.storage_path; titulo = r.titulo || ""; }
    catch (e) { toast(e.message, true); }
    const { data, error } = await banco().from("creative_references").insert({ title: titulo || (TIPOS_REF[tipo] + " " + new Date().toLocaleDateString("pt-BR")), reference_type: tipo, source_url: url, storage_path }).select().single();
    if (error) { toast(error.message, true); return null; }
    st.refs.unshift(data); if (storage_path) toast("Referência guardada com imagem."); return data;
  }
  function telaReferencias() {
    const c = $("#ec-corpo"); const filtro = ls.get("refFiltro", "");
    const lista = st.refs.filter((r) => !filtro || r.reference_type === filtro);
    c.innerHTML = `<div class="ec-cartao" style="margin-bottom:14px"><h3>Biblioteca de referências</h3>
      <p class="ec-dica">A IA só enxerga referências com imagem. O Instagram bloqueia leitura automática, então mande prints das capas, das páginas internas e do feed do @feedautentico. As referências servem de inspiração, nunca para copiar.</p>
      <div class="ec-g2"><label class="ec-solta" id="er-solta">${ic("foto")} Enviar prints ou imagens<input type="file" id="er-arq" multiple accept="image/*" hidden></label>
      <div><div class="ec-linha"><input type="url" id="er-link" placeholder="Link do Instagram, Pinterest ou imagem"><button class="ec-btn peq" id="er-add">Adicionar link</button></div>
      <label class="ec-campo"><span>Tipo dos prints enviados</span><select id="er-tipo">${Object.entries(TIPOS_REF).map(([k, t]) => `<option value="${k}" ${k === "capa" ? "selected" : ""}>${t}</option>`).join("")}</select></label></div></div>
      <div class="ec-chips" style="margin-top:6px"><button class="ec-chip ${!filtro ? "on" : ""}" data-f="">Todas (${st.refs.length})</button>${Object.entries(TIPOS_REF).map(([k, t]) => { const n = st.refs.filter((r) => r.reference_type === k).length; return n ? `<button class="ec-chip ${filtro === k ? "on" : ""}" data-f="${k}">${t} (${n})</button>` : ""; }).join("")}</div></div>
      <div class="ec-ref-grade">${lista.map((r) => `<article class="ec-ref" data-id="${r.id}"><div class="img">${r.storage_path ? `<img data-path="${esc(r.storage_path)}" alt="">` : `<div style="padding:12px;text-align:center">Sem imagem<br><label class="ec-btn peq" style="margin-top:8px">Enviar print<input type="file" accept="image/*" data-print="${r.id}" hidden></label></div>`}<span class="tag">${esc(TIPOS_REF[r.reference_type] || r.reference_type)}</span></div>
        <div class="corpo"><input type="text" data-campo="title" value="${esc(r.title)}"><select data-campo="reference_type">${Object.entries(TIPOS_REF).map(([k, t]) => `<option value="${k}" ${r.reference_type === k ? "selected" : ""}>${t}</option>`).join("")}</select>
        <textarea rows="2" data-campo="notes" placeholder="O que olhar nesta referência?">${esc(r.notes || "")}</textarea>
        <div class="ec-linha">${r.source_url ? `<a class="ec-btn peq" href="${esc(r.source_url)}" target="_blank" rel="noopener">Abrir</a>` : ""}${r.storage_path ? `<label class="ec-btn peq">Trocar print<input type="file" accept="image/*" data-print="${r.id}" hidden></label>` : ""}<button class="ec-btn peq perigo" data-del="${r.id}">${ic("lixo")}</button></div></div></article>`).join("") || '<div class="ec-vazio">Nenhuma referência.</div>'}</div>`;
    pintarImgs(c);
    $$("[data-f]", c).forEach((b) => b.onclick = () => { ls.set("refFiltro", b.dataset.f); telaReferencias(); });
    const solta = $("#er-solta");
    ["dragover", "dragenter"].forEach((n) => solta.addEventListener(n, (e) => { e.preventDefault(); solta.classList.add("sobre"); }));
    ["dragleave", "drop"].forEach((n) => solta.addEventListener(n, () => solta.classList.remove("sobre")));
    const enviar = async (arqs) => {
      try { for (const f of [...arqs]) { const up = await subir(f, "refs"); const { data, error } = await banco().from("creative_references").insert({ title: f.name.replace(/\.[^.]+$/, ""), reference_type: $("#er-tipo").value, storage_path: up.caminho }).select().single(); if (error) throw new Error(error.message); st.refs.unshift(data); } toast("Referências guardadas."); telaReferencias(); }
      catch (e) { toast(e.message, true); }
    };
    solta.addEventListener("drop", (e) => { e.preventDefault(); enviar(e.dataTransfer.files); });
    $("#er-arq").onchange = (e) => enviar(e.target.files);
    $("#er-add").onclick = async () => { const u = $("#er-link").value.trim(); if (u && await adicionarLink(u)) telaReferencias(); };
    $$("[data-campo]", c).forEach((el) => el.onchange = async () => {
      const id = el.closest(".ec-ref").dataset.id, campo = el.dataset.campo, v = el.value;
      const { error } = await banco().from("creative_references").update({ [campo]: v }).eq("id", id);
      if (error) toast(error.message, true); else { const r = st.refs.find((x) => x.id === id); r[campo] = v; toast("Salvo"); }
    });
    $$("[data-print]", c).forEach((inp) => inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return; const r = st.refs.find((x) => x.id === inp.dataset.print);
      try { const up = await subir(f, "refs"); if (r.storage_path) await banco().storage.from(BUCKET).remove([r.storage_path]); await banco().from("creative_references").update({ storage_path: up.caminho }).eq("id", r.id); r.storage_path = up.caminho; telaReferencias(); }
      catch (e) { toast(e.message, true); }
    });
    $$("[data-del]", c).forEach((b) => b.onclick = async () => {
      const r = st.refs.find((x) => x.id === b.dataset.del);
      if (!(await confirmar(`Apagar a referência "${r.title}"?`, { ok: "Apagar", perigo: true }))) return;
      if (r.storage_path) await banco().storage.from(BUCKET).remove([r.storage_path]);
      await banco().from("creative_references").delete().eq("id", r.id); st.refs = st.refs.filter((x) => x.id !== r.id); telaReferencias();
    });
  }

  // ---------- feed ----------
  function telaFeed() {
    const c = $("#ec-corpo");
    c.innerHTML = `<div class="ec-feed-wrap"><section class="ec-cartao"><div class="ec-perfil"><i></i><div><b>@maribonettougc</b><div class="ec-dica" style="margin:0">Prévia montada só com as imagens que você envia. Nada se conecta ao Instagram.</div></div></div>
      <div class="ec-feed" data-feed="grande"></div></section>
      <section class="ec-cartao"><h3>Como testar</h3>
      <p class="ec-dica">${st.proj && pags().length ? `O post marcado como <b>NOVO</b> é a capa de "${esc(st.proj.name)}". Arraste qualquer quadrado para mudar a posição.` : "Abra um projeto para ver o post novo na grade."}</p>
      <label class="ec-solta" id="ef-solta">${ic("foto")} Enviar prints dos posts que já estão no feed<input type="file" id="ef-arq" multiple accept="image/*" hidden></label>
      <p class="ec-dica" style="margin-top:8px">Envie na ordem do perfil (o mais recente primeiro). Você pode reordenar arrastando.</p>
      <div class="ec-linha"><button class="ec-btn peq" id="ef-esq">${ic("esq")} Novo antes</button><button class="ec-btn peq" id="ef-dir">Novo depois ${ic("dir")}</button><button class="ec-btn peq" id="ef-at">Atualizar prévia</button></div>
      <label class="ec-linha" style="margin-top:10px;font-size:13px"><input type="checkbox" id="ef-quad" ${st.feedQuadrado ? "checked" : ""}> Grade quadrada (antiga). Desmarcado = 3:4, como o Instagram mostra hoje.</label></section></div>`;
    $("#ef-arq").onchange = (e) => enviarFeed(e.target.files);
    const solta = $("#ef-solta");
    ["dragover", "dragenter"].forEach((n) => solta.addEventListener(n, (e) => { e.preventDefault(); solta.classList.add("sobre"); }));
    ["dragleave", "drop"].forEach((n) => solta.addEventListener(n, () => solta.classList.remove("sobre")));
    solta.addEventListener("drop", (e) => { e.preventDefault(); enviarFeed(e.dataTransfer.files); });
    $("#ef-esq").onclick = () => moverNovo(-1); $("#ef-dir").onclick = () => moverNovo(1); $("#ef-at").onclick = pintarFeedTudo;
    $("#ef-quad").onchange = (e) => { st.feedQuadrado = e.target.checked; ls.set("feedQ", st.feedQuadrado); pintarFeedTudo(); };
    pintarFeedTudo();
  }

  // ---------- projetos ----------
  async function telaProjetos() {
    const c = $("#ec-corpo");
    c.innerHTML = `<div class="ec-linha" style="margin-bottom:12px"><button class="ec-btn pri" id="ep-novo">${ic("mais")} Novo projeto</button><input type="text" id="ep-busca" placeholder="Buscar pelo nome" style="max-width:260px"></div><div class="ec-proj-grade" id="ep-grade"><div class="ec-vazio">Carregando…</div></div>`;
    $("#ep-novo").onclick = async () => { if (st.proj && st.proj.id && st.sujo) await salvar(); novoProjetoLocal(); st.selRefs = null; irPara("criar"); };
    const { data, error } = await banco().from("creative_projects").select("id,name,project_type,canvas_width,canvas_height,thumbnail_url,status,created_at,updated_at,design_json->paginas,design_json->refsUsadas").order("updated_at", { ascending: false });
    if (error) { $("#ep-grade").innerHTML = `<div class="ec-aviso ec-erro">${esc(error.message)}</div>`; return; }
    const { data: as } = await banco().from("creative_assets").select("project_id").not("project_id", "is", null);
    const nArq = {}; (as || []).forEach((a) => { nArq[a.project_id] = (nArq[a.project_id] || 0) + 1; });
    const fmt = (d) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
    const desenhar = () => {
      const b = ($("#ep-busca").value || "").toLowerCase();
      const lista = (data || []).filter((p) => !b || p.name.toLowerCase().includes(b));
      $("#ep-grade").innerHTML = lista.map((p) => `<article class="ec-proj" data-id="${p.id}"><div class="img" data-abrir="${p.id}" style="aspect-ratio:${p.canvas_width}/${p.canvas_height}">${p.thumbnail_url ? `<img data-path="${esc(p.thumbnail_url)}" alt="">` : "Sem capa ainda"}</div>
        <div class="corpo"><b>${esc(p.name)}</b><span class="ec-status ${p.status}">${STATUS[p.status] || p.status}</span>
        <small>${{ carrossel: "Carrossel", post: "Post", sequencia: "Sequência" }[p.project_type] || p.project_type} · ${(p.paginas || []).length} página(s) · ${p.canvas_width}×${p.canvas_height}<br>Criado ${fmt(p.created_at)}<br>Editado ${fmt(p.updated_at)}<br>${nArq[p.id] || 0} arquivo(s) · ${(p.refsUsadas || []).length} referência(s)</small>
        <div class="acoes"><button class="ec-btn peq pri" data-abrir="${p.id}">Abrir</button><button class="ec-btn peq" data-mais="${p.id}">•••</button></div></div></article>`).join("") || '<div class="ec-vazio">Nenhum projeto ainda. Comece em "Criar".</div>';
      pintarImgs($("#ep-grade"));
      $$("[data-abrir]", c).forEach((el) => el.onclick = () => abrirProjeto(el.dataset.abrir));
      $$("[data-mais]", c).forEach((b) => b.onclick = (e) => {
        const p = data.find((x) => x.id === b.dataset.mais);
        menu(e.currentTarget, [
          ["Renomear", async () => { const n = await perguntar("Nome do projeto", p.name); if (n && n.trim()) { await banco().from("creative_projects").update({ name: n.trim() }).eq("id", p.id); p.name = n.trim(); if (st.proj && st.proj.id === p.id) st.proj.name = p.name; desenhar(); } }],
          ["Duplicar", async () => { const id = await duplicarProjeto(p.id, " · cópia"); if (id) telaProjetos(); }],
          ["Ver versões", async () => { await abrirProjeto(p.id); if (st.vista === "editor") janelaVersoes(); }],
          ...Object.entries(STATUS).filter(([k]) => k !== p.status).map(([k, t]) => [`Marcar como ${t.toLowerCase()}`, async () => { await banco().from("creative_projects").update({ status: k }).eq("id", p.id); p.status = k; desenhar(); }]),
          ["Excluir", () => excluirProjeto(p.id, p.name)],
        ]);
      });
    };
    $("#ep-busca").oninput = desenhar; desenhar();
  }
  async function duplicarProjeto(id, sufixo) {
    const { data: p, error } = await banco().from("creative_projects").select("*").eq("id", id).single();
    if (error) { toast(error.message, true); return null; }
    const { data: novo, error: e2 } = await banco().from("creative_projects").insert({ name: p.name + sufixo, project_type: p.project_type, canvas_width: p.canvas_width, canvas_height: p.canvas_height, design_json: p.design_json, status: "rascunho" }).select().single();
    if (e2) { toast(e2.message, true); return null; }
    const { data: as } = await banco().from("creative_assets").select("file_name,file_type,storage_path,public_metadata").eq("project_id", id);
    if (as && as.length) await banco().from("creative_assets").insert(as.map((a) => Object.assign({}, a, { project_id: novo.id })));
    toast("Projeto duplicado."); return novo.id;
  }
  async function excluirProjeto(id, nome) {
    if (!(await confirmar(`Excluir "${nome}"? As páginas, versões e fotos que só ele usa serão apagadas. Não dá para desfazer.`, { ok: "Excluir", perigo: true }))) return;
    const { data: as } = await banco().from("creative_assets").select("storage_path").eq("project_id", id);
    const caminhos = (as || []).map((a) => a.storage_path);
    let apagar = [];
    if (caminhos.length) { const { data: outros } = await banco().from("creative_assets").select("storage_path").in("storage_path", caminhos).neq("project_id", id); const usados = new Set((outros || []).map((o) => o.storage_path)); apagar = caminhos.filter((c) => !usados.has(c)); }
    apagar.push(`${st.uid}/miniaturas/${id}.jpg`);
    const { error } = await banco().from("creative_projects").delete().eq("id", id);
    if (error) { toast(error.message, true); return; }
    await banco().storage.from(BUCKET).remove(apagar);
    if (st.proj && st.proj.id === id) novoProjetoLocal();
    toast("Projeto excluído."); telaProjetos();
  }

  // ---------- atalhos ----------
  document.addEventListener("keydown", (e) => {
    if (!st.cv || st.vista !== "editor" || !$("#aba-estudio") || $("#aba-estudio").hidden) return;
    const alvo = e.target, digitando = /INPUT|TEXTAREA|SELECT/.test(alvo.tagName) || alvo.isContentEditable, o = sel();
    if (digitando || (o && o.isEditing) || document.querySelector("dialog[open]")) return;
    const m = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (m && k === "z") { e.preventDefault(); e.shiftKey ? refazer() : desfazer(); }
    else if (m && k === "y") { e.preventDefault(); refazer(); }
    else if (m && k === "c") { if (o) { e.preventDefault(); copiar(); } }
    else if (m && k === "v") { if (st.clip) { e.preventDefault(); colar(); } }
    else if (m && k === "d") { e.preventDefault(); duplicar(); }
    else if (m && k === "g") { e.preventDefault(); agrupar(); }
    else if ((k === "delete" || k === "backspace") && o) { e.preventDefault(); apagar(); }
    else if (o && ["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(k)) {
      e.preventDefault(); const p = e.shiftKey ? 10 : 1;
      o.set({ left: o.left + (k === "arrowleft" ? -p : k === "arrowright" ? p : 0), top: o.top + (k === "arrowup" ? -p : k === "arrowdown" ? p : 0) }); o.setCoords(); st.cv.requestRenderAll(); marcarDepois();
    }
  });
  window.addEventListener("beforeunload", () => { if (st.sujo) salvar(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && st.sujo) salvar(); });

  // ---------- início ----------
  async function iniciar() {
    const raiz = $("#aba-estudio"); if (!raiz) return;
    carregarCss();
    if (!st.pronto) {
      raiz.innerHTML = `<div class="ec"><div class="ec-vazio">Abrindo o Estúdio…</div></div>`;
      try {
        if (window.sessaoPronta) await window.sessaoPronta;
        const { data } = await banco().auth.getUser(); st.uid = data && data.user && data.user.id;
        if (!st.uid) throw new Error("Entre no painel de novo.");
        await carregarListas();
        st.feedQuadrado = ls.get("feedQ", false);
        const ultimo = ls.get("ultimo", null);
        novoProjetoLocal();
        if (ultimo) { const { data: p } = await banco().from("creative_projects").select("id").eq("id", ultimo).maybeSingle(); if (p) { st.pronto = true; fontesProntas(); ia({ acao: "status" }).then((m) => { st.motor = m; pintarMotor(); }).catch(() => {}); await abrirProjeto(ultimo); return; } }
        st.pronto = true; st.vista = ls.get("vista", "criar") === "editor" ? "criar" : ls.get("vista", "criar");
        fontesProntas();
        ia({ acao: "status" }).then((m) => { st.motor = m; pintarMotor(); }).catch(() => {});
      } catch (e) { raiz.innerHTML = `<div class="ec"><div class="ec-aviso ec-erro">${esc(e.message)}</div></div>`; return; }
    }
    pintar();
  }
  document.addEventListener("painel:aba", (e) => { if (e.detail === "estudio") setTimeout(iniciar, 0); else if (st.vista === "editor" && st.sujo) salvar(); });
  window.estudioCriativo = { abrir: () => iniciar(), estado: () => st, validar: () => ({ paginas: st.proj ? pags().length : 0 }) };
})();
