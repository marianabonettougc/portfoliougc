// =========================================================
// MARCAS E JOBS > ROTEIROS E MOODBOARD (#moodboard, nov/2026, pedido da Mari)
// A partir do briefing da marca (puxado de um job, de um arquivo ou digitado), das fotos dela, das imagens do
// produto, do site da marca e de uma referência, entrega as DUAS coisas do prompt que ela mandou:
//   1) ROTEIRO cena a cena em espelho (ÁUDIO/fala | IMAGEM/direção), nos 7 blocos, editável;
//   2) MOOD BOARD visual (marca + produto, paleta, fotos dela, imagem do produto, referência de gancho,
//      roteiro cena a cena, diferenciais e direção de arte), desenhado aqui num canvas e baixado em PNG e PDF;
//   + lista de pendências para confirmar com a marca.
// A paleta sai das imagens do produto/da marca (cores contadas no navegador) e da cor do site; nunca genérica.
// Antes de criar, o painel pergunta o que falta de essencial (peças, CTA, @, duração, formato, claims).
// Texto: Edge Function roteiro-moodboard (Groq). Briefing em arquivo: função ler-briefing.
// Guardado na tabela moodboards (RLS só a dona); imagens no bucket privado anexos, pasta moodboard/<id>/.
// Estilos .mb-* no fim de css/painel.css. Sem alert/confirm/prompt do navegador (painelDialogo).
// =========================================================
(function () {
  "use strict";
  const ABA = "moodboard";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const banco = () => window.banco;
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }));
  const ic = (d) => `<svg class="traco" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const IC = {
    mais: ic('<path d="M12 5v14M5 12h14"/>'), lixo: ic('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    baixar: ic('<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>'), copiar: ic('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
    brilho: ic('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z"/>'),
    clipe: ic('<path d="M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L10 17.5a2 2 0 0 1-3-3L14.5 7"/>'),
    enviar: ic('<path d="M4 12l16-8-6 16-3-7z"/>'),
  };
  const toast = (m, erro) => { const t = $("#toast"); if (!t) return; t.textContent = m; t.classList.toggle("erro", !!erro); t.classList.add("visivel"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("visivel"), 3600); };
  const confirmar = (m, op) => window.painelDialogo ? window.painelDialogo.confirmar(m, op || {}) : Promise.resolve(true);
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));

  const BLOCOS = ["Gancho", "Apresentação da solução", "Apresentação do produto", "Ativos e benefícios", "Praticidade / diferencial", "Demonstração do resultado", "Encerramento / CTA"];
  const FORMATOS = ["Vertical 9:16", "Horizontal 16:9", "Quadrado 1:1", "Feed 4:5"];
  const PLATAFORMAS = ["Reels", "TikTok", "Stories", "Anúncios", "YouTube Shorts"];
  const TIPOS_IMG = { minha: { nome: "Minhas fotos", max: 6, dica: "Suas fotos no clima do vídeo (rosto, cenário, look)." }, produto: { nome: "Imagens do produto e da marca", max: 4, dica: "A paleta do mood board sai destas imagens." }, referencia: { nome: "Prints da referência de gancho", max: 3, dica: "Quadros do vídeo de referência." } };
  const CAMPOS = ["marca", "produto", "objetivo", "publico", "formato", "duracao", "diferenciais", "objecoes", "regras", "falas", "pecas", "claims", "cta", "arroba", "site", "referencias", "briefingTexto"];
  const novo = () => ({ id: uid(), novo: true, titulo: "", marca: "", job_id: "", briefing: { formato: FORMATOS[0], plataformas: ["Reels"] }, imagens: [], paleta: [], resultado: null });

  const st = { lista: [], atual: novo(), jobs: [], refs: [], ritmo: 2.75, carregado: false, ocupado: "", avisos: [], imgs: {}, paletaManual: false };

  // ---------- chamadas ----------
  async function chamar(nome, corpo) {
    for (let t = 0; t < 2; t++) {
      const { data, error } = await banco().functions.invoke(nome, { body: corpo });
      let msg = data && data.error;
      if (error) { try { msg = (await error.context.json()).error; } catch (e) { /* segue */ } msg = msg || "A função não respondeu agora."; }
      if (msg && /limite/i.test(msg) && t < 1) { estado("A IA pediu um tempinho (limite grátis). Tento de novo em 30 segundos…"); await espera(30000); continue; }
      if (msg) throw new Error(msg);
      return data;
    }
  }
  async function carregar() {
    const [a, ap, e, r] = await Promise.all([
      banco().from("moodboards").select("id,titulo,marca,job_id,atualizado_em").order("atualizado_em", { ascending: false }).limit(60),
      banco().from("app_state").select("data").limit(1).maybeSingle(),
      banco().from("estilo_ugc").select("ritmo_fala").eq("id", 1).maybeSingle(),
      banco().from("roteiros").select("id,titulo,perfil,gancho,transcricao,analise").eq("de_quem", "outra").not("transcricao", "is", null).order("criado_em", { ascending: false }).limit(60),
    ]);
    if (a.error) throw a.error;
    st.lista = a.data || [];
    const jobs = (ap.data && ap.data.data && ap.data.data.jobs) || [];
    st.jobs = jobs.filter((j) => j && j.marca && !/Finalizado · Pago|Cancelado/.test(j.status || ""));
    const rf = Number(e.data && e.data.ritmo_fala); if (rf > 1 && rf < 6) st.ritmo = rf;
    st.refs = (r.data || []).filter((x) => (x.transcricao || "").trim().length > 40);
    st.carregado = true;
  }

  // ---------- imagens ----------
  function lerImagem(origem) {
    return new Promise((ok, erro) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => erro(new Error("Não consegui abrir essa imagem.")); im.src = origem; });
  }
  async function reduzir(origem, lado, q) {
    const im = typeof origem === "string" ? await lerImagem(origem) : origem;
    const k = Math.min(1, lado / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
    return { canvas: c, blob: await new Promise((r) => c.toBlob(r, "image/jpeg", q || 0.86)) };
  }
  async function porImagem(tipo, origem, nome) {
    const p = st.atual, cfg = TIPOS_IMG[tipo];
    if (p.imagens.filter((i) => i.tipo === tipo).length >= cfg.max) { toast(`Cabem até ${cfg.max} em "${cfg.nome}".`, true); return false; }
    const { blob } = await reduzir(origem, 1400);
    const id = uid().slice(0, 8), url = URL.createObjectURL(blob);
    st.imgs[id] = { blob, url, el: await lerImagem(url), enviar: true };
    p.imagens.push({ id, tipo, nome: String(nome || "").slice(0, 80) });
    return true;
  }
  async function baixarImagens(p) {
    await Promise.all(p.imagens.map(async (i) => {
      if (st.imgs[i.id] || !i.path) return;
      try { const { data } = await banco().storage.from("anexos").download(i.path); if (!data) return; const url = URL.createObjectURL(data); st.imgs[i.id] = { blob: data, url, el: await lerImagem(url) }; } catch (e) { /* fica sem a imagem */ }
    }));
  }
  const imgsDe = (tipo) => st.atual.imagens.filter((i) => i.tipo === tipo && st.imgs[i.id]);

  // ---------- paleta: as cores que mais aparecem nas imagens do produto/da marca ----------
  const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = (h) => { const [r, g, b] = rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  const sat = (h) => { const [r, g, b] = rgb(h); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); };
  const dist = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  function coresDaImagem(el) {
    const c = document.createElement("canvas"); c.width = 72; c.height = 72;
    const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(el, 0, 0, 72, 72);
    const d = x.getImageData(0, 0, 72, 72).data, baldes = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0, l = (mx + mn) / 510;
      if (l > 0.95 || l < 0.05) continue; // fundo branco de foto de produto e preto puro não contam
      const k = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4);
      const o = baldes.get(k) || { n: 0, r: 0, g: 0, b: 0, p: 0 };
      o.n++; o.r += r; o.g += g; o.b += b; o.p += 0.35 + s * 1.6; baldes.set(k, o);
    }
    return [...baldes.values()].map((o) => ({ hex: hex(o.r / o.n, o.g / o.n, o.b / o.n), p: o.p }));
  }
  function calcularPaleta() {
    const fontes = imgsDe("produto"); if (!fontes.length) return [];
    let todas = []; fontes.forEach((i) => { todas = todas.concat(coresDaImagem(st.imgs[i.id].el)); });
    todas.sort((a, b) => b.p - a.p);
    const grupos = [];
    for (const c of todas) { const g = grupos.find((x) => dist(x.hex, c.hex) < 46); if (g) g.p += c.p; else if (grupos.length < 40) grupos.push({ ...c }); }
    grupos.sort((a, b) => b.p - a.p);
    const escolhidas = [];
    for (const g of grupos) { if (escolhidas.every((e) => dist(e, g.hex) > 70)) escolhidas.push(g.hex); if (escolhidas.length === 5) break; }
    return escolhidas;
  }
  function atualizarPaleta(forcar) {
    const p = st.atual;
    if (st.paletaManual && !forcar) return;
    const cores = calcularPaleta();
    const doSite = (p.briefing.siteCores || []).filter((c) => cores.every((e) => dist(e, c) > 50));
    const todas = [...doSite, ...cores].slice(0, 5);
    if (!todas.length && !forcar) return;
    const antigas = p.paleta || [];
    p.paleta = todas.map((h) => { const a = antigas.find((x) => x.hex === h); return { hex: h, nome: a ? a.nome : "", uso: a ? a.uso : "" }; });
    if (forcar) st.paletaManual = false;
  }

  // ---------- briefing em arquivo (função ler-briefing) ----------
  const scripts = {};
  const carregarScript = (url) => scripts[url] || (scripts[url] = new Promise((ok, erro) => { const s = document.createElement("script"); s.src = url; s.onload = ok; s.onerror = () => { delete scripts[url]; erro(new Error("Não consegui carregar uma parte do painel. Confira a internet.")); }; document.head.appendChild(s); }));
  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  async function lerPdf(arquivo) {
    await carregarScript(PDFJS + "pdf.min.js");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
    const doc = await window.pdfjsLib.getDocument({ data: await arquivo.arrayBuffer() }).promise;
    let texto = "";
    for (let n = 1; n <= Math.min(doc.numPages, 25); n++) {
      const pg = await doc.getPage(n), tc = await pg.getTextContent();
      let y = null, linha = "";
      for (const it of tc.items) { if (y !== null && Math.abs(it.transform[5] - y) > 2) { texto += linha.trim() + "\n"; linha = ""; } linha += it.str + " "; y = it.transform[5]; }
      texto += linha.trim() + "\n\n";
    }
    const imagens = [];
    if (texto.replace(/\s/g, "").length < 200) { // PDF escaneado: manda as primeiras páginas como imagem
      for (let n = 1; n <= Math.min(doc.numPages, 4); n++) {
        const pg = await doc.getPage(n), vp0 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: Math.min(2, 1400 / vp0.width) });
        const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
        await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
        imagens.push(c.toDataURL("image/jpeg", 0.8));
      }
      texto = "";
    }
    return { texto, imagens };
  }
  async function anexarBriefing(arquivo) {
    const nome = arquivo.name || "", tipo = arquivo.type || "";
    let corpo;
    if (/pdf$/i.test(tipo) || /\.pdf$/i.test(nome)) corpo = await lerPdf(arquivo);
    else if (/^image\//.test(tipo)) { const { canvas } = await reduzir(URL.createObjectURL(arquivo), 1600); corpo = { imagens: [canvas.toDataURL("image/jpeg", 0.82)] }; }
    else if (/^text\//.test(tipo) || /\.(txt|md|csv)$/i.test(nome)) corpo = { texto: await arquivo.text() };
    else throw new Error("Envie o briefing em PDF, imagem ou texto. Se for Word, salve em PDF.");
    const d = await chamar("ler-briefing", { ...corpo, nome });
    const c = d.campos || {}, b = st.atual.briefing, seVazio = (k, v) => { if (v && !String(b[k] || "").trim()) b[k] = v; };
    seVazio("marca", c.marca); seVazio("produto", c.produto); seVazio("objetivo", c.objetivo); seVazio("publico", c.publico);
    if (c.duracao && !b.duracao) b.duracao = c.duracao;
    seVazio("diferenciais", (c.mensagens_chave || []).join("\n"));
    seVazio("regras", [(c.obrigatorias || []).length ? "Frases obrigatórias:\n" + c.obrigatorias.join("\n") : "", (c.proibicoes || []).length ? "Não pode:\n" + c.proibicoes.join("\n") : "", c.tom ? "Tom: " + c.tom : ""].filter(Boolean).join("\n\n"));
    const menc = c.mencoes || [], arr = menc.find((m) => /^@/.test(m.trim()));
    seVazio("arroba", arr || ""); seVazio("cta", menc.filter((m) => m !== arr).join(" · "));
    b.briefingTexto = [c.resumo ? "RESUMO: " + c.resumo : "", (c.cenas || []).length ? "CENAS PEDIDAS: " + c.cenas.join("; ") : "", c.entregaveis ? "ENTREGÁVEIS: " + c.entregaveis : "", d.texto || ""].filter(Boolean).join("\n\n").slice(0, 12000);
    b.briefingArquivo = nome;
  }

  // ---------- site da marca ----------
  async function lerSite() {
    const b = st.atual.briefing;
    if (!String(b.site || "").trim()) { toast("Cole o endereço do site da marca.", true); return; }
    const d = await chamar("roteiro-moodboard", { acao: "site", url: b.site });
    if (d.erro) throw new Error(d.erro);
    b.siteResumo = [d.titulo, d.descricao, d.texto].filter(Boolean).join(" · ").slice(0, 1500);
    b.siteCores = d.cores || [];
    if (d.imagem && !st.atual.imagens.some((i) => i.nome === "site")) { try { await porImagem("produto", d.imagem, "site"); } catch (e) { /* sem imagem */ } }
    atualizarPaleta();
  }

  // ---------- criar ----------
  function referenciaEscolhida() {
    const r = st.refs.find((x) => String(x.id) === String(st.atual.briefing.refId));
    if (!r) return null;
    const a = r.analise && typeof r.analise === "object" ? r.analise : {};
    const analise = [a.panorama, Array.isArray(a.visual) ? a.visual.join("; ") : "", r.gancho ? "Gancho: " + r.gancho : ""].filter(Boolean).join(" | ");
    return { titulo: r.titulo || r.perfil || "", transcricao: r.transcricao || "", analise };
  }
  const ESSENCIAIS = [["pecas", "Quais peças ou produtos você recebeu?"], ["cta", "Qual é o CTA, o link ou o cupom?"], ["arroba", "Qual é o @ oficial da marca?"], ["duracao", "Quantos segundos o vídeo deve ter?"], ["claims", "Quais claims (promessas) a marca liberou?"]];
  function perguntar() {
    const b = st.atual.briefing, faltam = ESSENCIAIS.filter(([k]) => !String(b[k] || "").trim());
    if (!faltam.length) return Promise.resolve(true);
    return new Promise((res) => {
      const d = document.createElement("dialog"); d.className = "janela"; let valor = false;
      d.innerHTML = `<form method="dialog"><div class="janela-cabeca"><h2>Antes de finalizar, faltou isto</h2></div>
        <div class="janela-corpo"><p class="mb-dica">Responda o que souber. O que ficar em branco entra no roteiro entre colchetes e na lista de pendências para confirmar com a marca.</p>
        ${faltam.map(([k, p]) => `<div class="campo"><label>${esc(p)}</label><input name="${k}" ${k === "duracao" ? 'type="number" min="5" max="600" inputmode="numeric"' : ""}></div>`).join("")}</div>
        <div class="janela-rodape"><button class="btn" type="button" data-fechar>Voltar</button><button class="btn btn-principal" type="submit">Criar roteiro e mood board</button></div></form>`;
      document.body.appendChild(d);
      d.querySelector("[data-fechar]").onclick = () => d.close();
      d.querySelector("form").addEventListener("submit", (ev) => { ev.preventDefault(); faltam.forEach(([k]) => { const v = d.querySelector(`[name="${k}"]`).value.trim(); if (v) b[k] = k === "duracao" ? Number(v) : v; }); valor = true; d.close(); });
      d.addEventListener("close", () => { d.remove(); res(valor); });
      d.showModal();
    });
  }
  async function imagensParaIA() {
    const lista = [];
    for (const tipo of ["referencia", "produto", "minha"]) {
      const i = imgsDe(tipo)[0]; if (!i) continue;
      const { canvas } = await reduzir(st.imgs[i.id].el, 512);
      lista.push({ tipo, url: canvas.toDataURL("image/jpeg", 0.7) });
    }
    return lista;
  }
  async function criar() {
    const p = st.atual, b = p.briefing;
    lerForm();
    if (!String(b.marca || "").trim() && !String(b.produto || "").trim() && !String(b.briefingTexto || "").trim()) { toast("Preencha pelo menos a marca e o produto, ou anexe o briefing.", true); return; }
    if (!(await perguntar())) return;
    try {
      estado("Lendo o briefing, as imagens e a referência…");
      atualizarPaleta();
      const d = await chamar("roteiro-moodboard", { briefing: { ...b, briefingTexto: String(b.briefingTexto || "").slice(0, 2600) }, paleta: (p.paleta || []).map((c) => c.hex), imagens: await imagensParaIA(), referencia: referenciaEscolhida() });
      p.resultado = d.resultado; st.avisos = d.avisos || [];
      if (!(p.paleta || []).length) p.paleta = d.resultado.identidade.paleta || [];
      else p.paleta = p.paleta.map((c, i) => ({ ...c, nome: c.nome || ((d.resultado.identidade.paleta || [])[i] || {}).nome || "", uso: c.uso || ((d.resultado.identidade.paleta || [])[i] || {}).uso || "" }));
      p.titulo = d.resultado.titulo || [b.produto, b.marca].filter(Boolean).join(" · "); p.marca = b.marca || "";
      estado(""); pintar(); await salvar(true);
      const r = $("#mb-resultado"); if (r) r.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) { estado(""); toast(e.message, true); }
  }

  // ---------- salvar ----------
  let tSalvar = null;
  function salvarDepois() { if (!st.atual.resultado) return; clearTimeout(tSalvar); tSalvar = setTimeout(() => salvar(true).catch(() => {}), 1500); }
  async function salvar(quieto) {
    const p = st.atual; clearTimeout(tSalvar);
    for (const i of p.imagens) {
      const m = st.imgs[i.id]; if (!m || !m.enviar) continue;
      const caminho = `moodboard/${p.id}/${i.id}.jpg`;
      const { error } = await banco().storage.from("anexos").upload(caminho, m.blob, { contentType: "image/jpeg", upsert: true });
      if (error) { if (!quieto) toast("Uma imagem não foi guardada: " + error.message, true); continue; }
      i.path = caminho; m.enviar = false;
    }
    const linha = { id: p.id, titulo: p.titulo || [p.briefing.produto, p.briefing.marca].filter(Boolean).join(" · ") || "Sem título", marca: p.briefing.marca || "", job_id: p.job_id || null, briefing: p.briefing, imagens: p.imagens, paleta: p.paleta, resultado: p.resultado, atualizado_em: new Date().toISOString() };
    const { error } = await banco().from("moodboards").upsert(linha);
    if (error) { if (!quieto) toast("Não salvou: " + error.message, true); return; }
    p.novo = false;
    const na = st.lista.find((x) => x.id === p.id);
    if (na) { na.titulo = linha.titulo; na.marca = linha.marca; na.job_id = p.job_id || null; na.atualizado_em = linha.atualizado_em; } else { st.lista.unshift({ id: p.id, titulo: linha.titulo, marca: linha.marca, job_id: p.job_id || null, atualizado_em: linha.atualizado_em }); pintarLista(); }
    if (!quieto) toast("Salvo.");
  }
  async function abrirProjeto(id) {
    estado("Abrindo…");
    const { data, error } = await banco().from("moodboards").select("*").eq("id", id).maybeSingle();
    if (error || !data) { estado(""); toast("Não consegui abrir esse mood board.", true); return; }
    st.atual = { id: data.id, titulo: data.titulo, marca: data.marca, job_id: data.job_id || "", briefing: data.briefing || {}, imagens: data.imagens || [], paleta: data.paleta || [], resultado: data.resultado || null };
    st.avisos = []; st.paletaManual = (st.atual.paleta || []).length > 0;
    await baixarImagens(st.atual);
    estado(""); pintar();
  }
  async function excluirProjeto(id) {
    const x = st.lista.find((l) => l.id === id);
    if (!(await confirmar(`Excluir "${(x && x.titulo) || "este mood board"}"? O roteiro e as imagens dele saem do painel.`, { ok: "Excluir", perigo: true }))) return;
    const { data } = await banco().from("moodboards").select("imagens").eq("id", id).maybeSingle();
    const caminhos = ((data && data.imagens) || []).map((i) => i.path).filter(Boolean);
    if (caminhos.length) await banco().storage.from("anexos").remove(caminhos);
    const { error } = await banco().from("moodboards").delete().eq("id", id);
    if (error) { toast("Não excluiu: " + error.message, true); return; }
    st.lista = st.lista.filter((l) => l.id !== id);
    if (st.atual.id === id) { st.atual = novo(); st.paletaManual = false; }
    pintar(); toast("Excluído.");
  }

  // ---------- roteiro em texto ----------
  const soFala = (t) => String(t || "").replace(/\[[^\]]*\]/g, " ").replace(/\([^)]*\)/g, " ");
  const palavras = (t) => (soFala(t).match(/[\p{L}\p{N}]+/gu) || []).length;
  function duracao() {
    const r = st.atual.resultado; if (!r) return null;
    const n = r.falas.reduce((s, f) => s + palavras(f.fala), 0);
    return { palavras: n, seg: Math.round(n / st.ritmo) };
  }
  function roteiroTexto(comPendencias) {
    const p = st.atual, r = p.resultado, b = p.briefing; if (!r) return "";
    const partes = [r.titulo || "ROTEIRO DE FALAS | " + [b.produto, b.marca].filter(Boolean).join(" + "), ""];
    r.falas.forEach((f, i) => { partes.push(`${i + 1}. ${f.bloco}`, `ÁUDIO: ${f.fala}`, `IMAGEM: ${f.imagem}`, ""); });
    if ((r.ganchos_extra || []).length) partes.push("OUTRAS OPÇÕES DE GANCHO", ...r.ganchos_extra.map((g) => "• " + g), "");
    if (comPendencias && (r.pendencias || []).length) partes.push("PENDÊNCIAS (confirmar com a marca)", ...r.pendencias.map((g) => "• " + g), "");
    return partes.join("\n").trim();
  }
  async function mandarParaRoteiros() {
    const p = st.atual, r = p.resultado, b = p.briefing;
    if (!r || !window.painelRoteiros) return;
    const rot = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), titulo: [b.marca, b.produto].filter(Boolean).join(" · ") || r.titulo, plataforma: (b.plataformas || [])[0] === "TikTok" ? "TikTok" : "Instagram", status: "Em aberto",
      finalidade: "Publi", etapa: "Roteirização", dataPublicacao: "", conteudo: roteiroTexto(true), cliente: b.marca || "", quadroId: "principal", origem: "Roteiros e Moodboard" };
    if (p.job_id) rot.jobId = p.job_id;
    const ok = await window.painelRoteiros.salvarNoQuadro(rot);
    if (ok) { r.roteiroId = rot.id; salvarDepois(); toast("Roteiro enviado para Conteúdos (Quadro de produção)" + (p.job_id ? " e ligado ao job." : ".")); pintarAcoes(); }
  }

  // ---------- desenho do mood board (canvas) ----------
  const SERIF = '"DM Serif Display", Georgia, serif', SANS = '"Poppins", system-ui, sans-serif';
  function quebrar(x, texto, larg) {
    const linhas = [];
    String(texto || "").split(/\n/).forEach((par) => {
      let atual = "";
      par.split(/\s+/).filter(Boolean).forEach((pal) => { const t = atual ? atual + " " + pal : pal; if (x.measureText(t).width > larg && atual) { linhas.push(atual); atual = pal; } else atual = t; });
      if (atual) linhas.push(atual);
    });
    return linhas;
  }
  // escreve (ou só mede, com des = false) um bloco de texto; devolve a altura usada
  function bloco(x, des, texto, px, py, larg, fonte, alt, cor, maxLinhas) {
    if (!String(texto || "").trim()) return 0;
    x.font = fonte; let linhas = quebrar(x, texto, larg);
    if (maxLinhas && linhas.length > maxLinhas) { linhas = linhas.slice(0, maxLinhas); linhas[maxLinhas - 1] = linhas[maxLinhas - 1].replace(/[\s.,;:]+$/, "") + "…"; }
    if (des) { x.fillStyle = cor; x.textBaseline = "top"; linhas.forEach((l, i) => x.fillText(l, px, py + i * alt)); }
    return linhas.length * alt;
  }
  function rotulo(x, des, texto, px, py, cor) {
    if (des) { x.font = `600 15px ${SANS}`; x.fillStyle = cor; x.textBaseline = "top"; try { x.letterSpacing = "2.5px"; } catch (e) { /* navegador antigo */ } x.fillText(String(texto).toUpperCase(), px, py); try { x.letterSpacing = "0px"; } catch (e) { /* idem */ } }
    return 30;
  }
  function caixa(x, px, py, w, h, r) { x.beginPath(); if (x.roundRect) x.roundRect(px, py, w, h, r); else x.rect(px, py, w, h); }
  function capa(x, el, px, py, w, h, r) {
    const k = Math.max(w / el.naturalWidth, h / el.naturalHeight), sw = w / k, sh = h / k;
    x.save(); caixa(x, px, py, w, h, r); x.clip();
    x.drawImage(el, (el.naturalWidth - sw) / 2, (el.naturalHeight - sh) * 0.35, sw, sh, px, py, w, h);
    x.restore();
  }
  function grade(n, px, py, w, h, g) {
    const c = (a, b, cw, ch) => ({ x: px + a, y: py + b, w: cw, h: ch });
    if (n <= 1) return [c(0, 0, w, h)];
    if (n === 2) { const cw = (w - g) / 2; return [c(0, 0, cw, h), c(cw + g, 0, cw, h)]; }
    if (n === 3 || n === 4) { const lw = Math.round(w * 0.54), rw = w - lw - g, m = n - 1, ch = (h - g * (m - 1)) / m; return [c(0, 0, lw, h), ...Array.from({ length: m }, (_, i) => c(lw + g, i * (ch + g), rw, ch))]; }
    if (n === 5) { const th = Math.round(h * 0.56), bh = h - th - g, tw = (w - g) / 2, bw = (w - 2 * g) / 3; return [c(0, 0, tw, th), c(tw + g, 0, tw, th), ...[0, 1, 2].map((i) => c(i * (bw + g), th + g, bw, bh))]; }
    const cw = (w - 2 * g) / 3, ch = (h - g) / 2; return Array.from({ length: 6 }, (_, i) => c((i % 3) * (cw + g), Math.floor(i / 3) * (ch + g), cw, ch));
  }
  function temaDoBoard() {
    const cores = (st.atual.paleta || []).map((c) => c.hex).filter((h) => /^#[0-9a-f]{6}$/i.test(h));
    const porLum = [...cores].sort((a, b) => lum(a) - lum(b));
    let escuro = porLum[0] || "#3d2b20"; if (lum(escuro) > 0.42) escuro = mix(escuro, "#1d1512", 0.62);
    const vivas = cores.filter((c) => lum(c) > 0.18 && lum(c) < 0.8).sort((a, b) => sat(b) - sat(a));
    let destaque = vivas[0] || cores[0] || "#a87058"; if (lum(destaque) > 0.62) destaque = mix(destaque, escuro, 0.45);
    const clara = porLum[porLum.length - 1] || "#f6efe6";
    return { cores, escuro, destaque, fundo: mix(clara, "#ffffff", lum(clara) > 0.8 ? 0.55 : 0.9), papel: "#ffffff", texto: mix(escuro, "#1d1512", 0.55), suave: mix(escuro, "#8a8078", 0.6), linha: mix(escuro, "#ffffff", 0.82) };
  }
  function desenharBoard(cv, des) {
    const p = st.atual, r = p.resultado, b = p.briefing, mb = r.moodboard || {}, idn = r.identidade || {}, T = temaDoBoard();
    const W = 1600, M = 64, x = cv.getContext("2d");
    if (des) { x.fillStyle = T.fundo; x.fillRect(0, 0, cv.width, cv.height); }
    let y = M;
    // cabeçalho: marca + produto
    rotulo(x, des, "Mood board · roteiro UGC", M, y, T.destaque);
    if (des) {
      x.textAlign = "right"; x.textBaseline = "top"; x.fillStyle = T.texto; x.font = `600 20px ${SANS}`; x.fillText("Mari Bonetto", W - M, y);
      x.font = `400 16px ${SANS}`; x.fillStyle = T.suave; x.fillText("@maribonettougc · UGC Creator", W - M, y + 28);
      const info = [b.formato, b.duracao ? b.duracao + " s" : "", (b.plataformas || []).join(", ")].filter(Boolean).join(" · "); x.fillText(info, W - M, y + 52); x.textAlign = "left";
    }
    y += 38;
    y += bloco(x, des, b.marca || "Marca", M, y, 1000, `400 84px ${SERIF}`, 92, T.texto, 2);
    y += bloco(x, des, b.produto || "", M, y + 4, 1000, `italic 400 40px ${SERIF}`, 48, T.destaque, 2) + 4;
    if (mb.conceito) y += bloco(x, des, mb.conceito, M, y + 12, 1000, `400 21px ${SANS}`, 31, T.suave, 3) + 12;
    y += 30; if (des) { x.fillStyle = T.linha; x.fillRect(M, y, W - 2 * M, 2); } y += 36;

    // linha 1: paleta e clima | fotos | referência de gancho
    const c1 = 340, c3 = 400, g = 36, c2 = W - 2 * M - c1 - c3 - 2 * g, x1 = M, x2 = M + c1 + g, x3 = x2 + c2 + g, y0 = y;
    let ya = y0; ya += rotulo(x, des, "Paleta da marca", x1, ya, T.suave);
    (p.paleta || []).forEach((c) => {
      if (des) { x.fillStyle = c.hex; caixa(x, x1, ya, c1, 68, 14); x.fill(); if (lum(c.hex) > 0.86) { x.strokeStyle = T.linha; x.lineWidth = 2; x.stroke(); }
        const tc = lum(c.hex) > 0.6 ? "#2a211c" : "#ffffff"; x.fillStyle = tc; x.textBaseline = "middle"; x.font = `600 17px ${SANS}`; x.fillText(c.hex.toUpperCase(), x1 + 18, ya + (c.nome ? 24 : 34));
        if (c.nome) { x.font = `400 15px ${SANS}`; x.fillText(c.nome.slice(0, 34), x1 + 18, ya + 46); } }
      ya += 78;
    });
    if (idn.clima) { ya += 14; ya += rotulo(x, des, "Clima", x1, ya, T.suave); ya += bloco(x, des, idn.clima, x1, ya, c1, `400 18px ${SANS}`, 27, T.texto, 6); }
    if (idn.tom) { ya += 18; ya += rotulo(x, des, "Tom", x1, ya, T.suave); ya += bloco(x, des, idn.tom, x1, ya, c1, `400 18px ${SANS}`, 27, T.texto, 5); }
    if ((mb.palavras || []).length) {
      ya += 20; let px = x1; x.font = `500 16px ${SANS}`;
      mb.palavras.forEach((w) => { const lw = x.measureText(w).width + 30; if (px + lw > x1 + c1) { px = x1; ya += 44; } if (des) { x.fillStyle = T.papel; caixa(x, px, ya, lw, 36, 18); x.fill(); x.strokeStyle = T.linha; x.lineWidth = 1.5; x.stroke(); x.fillStyle = T.texto; x.textBaseline = "middle"; x.fillText(w, px + 15, ya + 19); } px += lw + 8; });
      ya += 40;
    }
    let yc = y0; yc += rotulo(x, des, "Referência de gancho", x3, yc, T.suave);
    const refImg = imgsDe("referencia")[0];
    if (refImg) { if (des) capa(x, st.imgs[refImg.id].el, x3, yc, c3, 300, 18); yc += 318; }
    if (mb.gancho_referencia) yc += bloco(x, des, "“" + mb.gancho_referencia + "”", x3, yc, c3, `italic 400 28px ${SERIF}`, 36, T.texto, 6) + 14;
    if ((r.referencia || {}).estilo) { yc += rotulo(x, des, "Estilo da referência", x3, yc + 4, T.suave) + 4; yc += bloco(x, des, r.referencia.estilo, x3, yc, c3, `400 17px ${SANS}`, 26, T.texto, 9); }
    if (mb.texto_na_tela) { yc += 16; yc += rotulo(x, des, "Textos na tela", x3, yc, T.suave); yc += bloco(x, des, mb.texto_na_tela, x3, yc, c3, `400 17px ${SANS}`, 26, T.texto, 4); }
    const altFotos = Math.max(640, ya - y0 - 30, yc - y0 - 30);
    rotulo(x, des, "Minhas fotos + produto", x2, y0, T.suave);
    if (des) {
      const fotos = [...imgsDe("produto").slice(0, 2), ...imgsDe("minha")].slice(0, 6);
      if (fotos.length) grade(fotos.length, x2, y0 + 30, c2, altFotos, 14).forEach((q, i) => capa(x, st.imgs[fotos[i].id].el, q.x, q.y, q.w, q.h, 18));
      else { x.strokeStyle = T.linha; x.lineWidth = 2; x.setLineDash([10, 8]); caixa(x, x2, y0 + 30, c2, altFotos, 18); x.stroke(); x.setLineDash([]); x.fillStyle = T.suave; x.font = `400 19px ${SANS}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("Envie suas fotos e a imagem do produto", x2 + c2 / 2, y0 + 30 + altFotos / 2); x.textAlign = "left"; }
    }
    y = y0 + 30 + altFotos + 56;

    // roteiro cena a cena (7 cenas + cartão de diferenciais)
    y += bloco(x, des, "Roteiro cena a cena", M, y, 900, `400 44px ${SERIF}`, 52, T.texto, 1) + 20;
    const gc = 22, cw = (W - 2 * M - 3 * gc) / 4, pad = 22, tw = cw - 2 * pad;
    const medirCena = (f, px, py, d) => { let h = pad + 46; h += rotulo(x, d, "Áudio", px + pad, py + h, T.destaque) - 4; h += bloco(x, d, f.fala, px + pad, py + h, tw, `400 17px ${SANS}`, 26, T.texto); h += 16; h += rotulo(x, d, "Imagem", px + pad, py + h, T.suave) - 4; h += bloco(x, d, f.imagem, px + pad, py + h, tw, `400 15.5px ${SANS}`, 24, T.suave); return h + pad; };
    const medirDif = (px, py, d) => { let h = pad; h += rotulo(x, d, "Diferenciais", px + pad, py + h, "#ffffff") + 6; (mb.diferenciais || []).forEach((t) => { h += bloco(x, d, "• " + t, px + pad, py + h, tw, `500 17px ${SANS}`, 26, "#ffffff") + 8; }); if (b.cta) { h += 10; h += rotulo(x, d, "CTA", px + pad, py + h, "#ffffff"); h += bloco(x, d, [b.cta, b.arroba].filter(Boolean).join(" · "), px + pad, py + h, tw, `400 16px ${SANS}`, 24, "#ffffff", 4); } return h + pad; };
    for (let linha = 0; linha < 2; linha++) {
      const cenas = r.falas.slice(linha * 4, linha * 4 + 4);
      let h = Math.max(...cenas.map((f) => medirCena(f, 0, 0, false))); if (linha === 1) h = Math.max(h, medirDif(0, 0, false));
      if (des) {
        cenas.forEach((f, i) => {
          const px = M + i * (cw + gc), n = linha * 4 + i + 1;
          x.fillStyle = T.papel; caixa(x, px, y, cw, h, 20); x.fill(); x.strokeStyle = T.linha; x.lineWidth = 1.5; x.stroke();
          x.fillStyle = T.destaque; x.beginPath(); x.arc(px + pad + 17, y + pad + 17, 17, 0, Math.PI * 2); x.fill();
          x.fillStyle = "#fff"; x.font = `600 17px ${SANS}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(String(n), px + pad + 17, y + pad + 18); x.textAlign = "left";
          x.fillStyle = T.texto; x.font = `600 16px ${SANS}`; x.fillText(quebrar(x, f.bloco, tw - 46)[0] || "", px + pad + 46, y + pad + 18);
          medirCena(f, px, y, true);
        });
        if (linha === 1) { const px = M + 3 * (cw + gc); x.fillStyle = T.escuro; caixa(x, px, y, cw, h, 20); x.fill(); medirDif(px, y, true); }
      }
      y += h + gc;
    }
    // direção de arte
    const dir = [["Cenário", mb.cenario], ["Luz", mb.luz], ["Figurino", mb.figurino], ["Enquadramentos", mb.enquadramentos]].filter((d) => d[1]);
    if (dir.length) {
      y += 30; y += bloco(x, des, "Direção de arte", M, y, 900, `400 44px ${SERIF}`, 52, T.texto, 1) + 18;
      const dw = (W - 2 * M - (dir.length - 1) * gc) / dir.length; let hm = 0;
      dir.forEach((d, i) => { const px = M + i * (dw + gc); let h = rotulo(x, des, d[0], px, y, T.destaque); h += bloco(x, des, d[1], px, y + h, dw, `400 18px ${SANS}`, 27, T.texto, 8); hm = Math.max(hm, h); });
      y += hm;
    }
    y += 44; if (des) { x.fillStyle = T.linha; x.fillRect(M, y, W - 2 * M, 2); x.fillStyle = T.suave; x.font = `400 15px ${SANS}`; x.textBaseline = "top"; x.fillText("Mari Bonetto · UGC Creator · marianabonetto.com.br", M, y + 18); x.textAlign = "right"; x.fillText(new Date().toLocaleDateString("pt-BR"), W - M, y + 18); x.textAlign = "left"; }
    return y + 18 + 24 + M - 20;
  }
  async function montarBoard() {
    if (!st.atual.resultado) return null;
    try { await Promise.all([`400 40px ${SERIF}`, `italic 400 40px ${SERIF}`, `400 17px ${SANS}`, `500 17px ${SANS}`, `600 17px ${SANS}`].map((f) => document.fonts.load(f))); } catch (e) { /* usa a fonte que tiver */ }
    const cv = document.createElement("canvas"); cv.width = 1600; cv.height = 100;
    cv.height = Math.ceil(desenharBoard(cv, false));
    desenharBoard(cv, true);
    return cv;
  }
  let tBoard = null;
  function boardDepois() { clearTimeout(tBoard); tBoard = setTimeout(pintarBoard, 450); }
  async function pintarBoard() {
    const alvo = $("#mb-board"); if (!alvo || !st.atual.resultado) return;
    const cv = await montarBoard(); if (!cv) return;
    cv.className = "mb-canvas"; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", "Mood board");
    alvo.innerHTML = ""; alvo.appendChild(cv);
  }
  const nomeArquivo = () => "moodboard-" + (String(st.atual.briefing.marca || "marca") + "-" + String(st.atual.briefing.produto || "")).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  function baixarBlob(blob, nome) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  async function baixarPng() { const cv = await montarBoard(); if (!cv) return; cv.toBlob((bl) => baixarBlob(bl, nomeArquivo() + ".png"), "image/png"); }
  async function baixarPdf() {
    try {
      estado("Montando o PDF…");
      const cv = await montarBoard(); await carregarScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
      const doc = new window.jspdf.jsPDF({ unit: "px", format: [cv.width, cv.height], orientation: cv.height >= cv.width ? "portrait" : "landscape", hotfixes: ["px_scaling"], compress: true });
      doc.addImage(cv.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, cv.width, cv.height);
      doc.save(nomeArquivo() + ".pdf"); estado("");
    } catch (e) { estado(""); toast(e.message, true); }
  }

  // ---------- tela ----------
  function estado(msg) { st.ocupado = msg || ""; const e = $("#mb-estado"); if (e) { e.textContent = st.ocupado; e.hidden = !st.ocupado; } $$("[data-mb-trava]").forEach((b) => { b.disabled = !!st.ocupado; }); }
  function lerForm() {
    const f = $("#mb-form"), b = st.atual.briefing; if (!f) return;
    CAMPOS.forEach((k) => { const el = f.elements[k]; if (el) b[k] = k === "duracao" ? (Number(el.value) || "") : el.value.trim(); });
    b.plataformas = $$('[name="plataformas"]:checked', f).map((c) => c.value);
    b.refId = f.elements.refId ? f.elements.refId.value : "";
    st.atual.job_id = f.elements.job ? f.elements.job.value : "";
  }
  const campo = (k, rot, op = {}) => {
    const v = st.atual.briefing[k] == null ? "" : st.atual.briefing[k];
    const el = op.linhas ? `<textarea name="${k}" rows="${op.linhas}" placeholder="${esc(op.ex || "")}">${esc(v)}</textarea>` : `<input name="${k}" value="${esc(v)}" placeholder="${esc(op.ex || "")}" ${op.attr || ""}>`;
    return `<div class="campo${op.cls ? " " + op.cls : ""}"><label>${esc(rot)}</label>${el}</div>`;
  };
  function pintarLista() {
    const el = $("#mb-lista"); if (!el) return;
    el.innerHTML = st.lista.length ? st.lista.map((l) => `<span class="mb-salvo${l.id === st.atual.id ? " ativo" : ""}"><button type="button" data-abrir="${l.id}">${esc(l.titulo || l.marca || "Sem título")}</button><button type="button" class="mb-x" data-excluir="${l.id}" aria-label="Excluir ${esc(l.titulo || "")}">${IC.lixo}</button></span>`).join("") : `<span class="mb-dica">Os roteiros e mood boards que você criar ficam guardados aqui.</span>`;
    $$("[data-abrir]", el).forEach((b) => b.addEventListener("click", () => abrirProjeto(b.dataset.abrir)));
    $$("[data-excluir]", el).forEach((b) => b.addEventListener("click", () => excluirProjeto(b.dataset.excluir)));
  }
  function pintarImagens() {
    Object.keys(TIPOS_IMG).forEach((tipo) => {
      const el = $(`[data-mb-imgs="${tipo}"]`); if (!el) return;
      const lista = st.atual.imagens.filter((i) => i.tipo === tipo);
      el.innerHTML = lista.map((i) => `<span class="mb-mini">${st.imgs[i.id] ? `<img src="${st.imgs[i.id].url}" alt="${esc(i.nome || TIPOS_IMG[tipo].nome)}">` : ""}<button type="button" data-tirar="${i.id}" aria-label="Tirar imagem">×</button></span>`).join("") +
        (lista.length < TIPOS_IMG[tipo].max ? `<label class="mb-mais">${IC.mais}<span>Enviar</span><input type="file" accept="image/*" multiple hidden data-enviar="${tipo}"></label>` : "");
      $$("[data-tirar]", el).forEach((b) => b.addEventListener("click", () => {
        const i = st.atual.imagens.find((z) => z.id === b.dataset.tirar); if (!i) return;
        if (i.path) banco().storage.from("anexos").remove([i.path]);
        st.atual.imagens = st.atual.imagens.filter((z) => z !== i); delete st.imgs[i.id];
        if (tipo === "produto") { atualizarPaleta(); pintarPaleta(); }
        pintarImagens(); boardDepois(); salvarDepois();
      }));
      $$("[data-enviar]", el).forEach((inp) => inp.addEventListener("change", async () => {
        for (const arq of [...inp.files]) { try { const u = URL.createObjectURL(arq); if (!(await porImagem(tipo, u, arq.name))) break; } catch (e) { toast(e.message, true); } }
        if (tipo === "produto") { atualizarPaleta(); pintarPaleta(); }
        pintarImagens(); boardDepois(); salvarDepois();
      }));
    });
  }
  function pintarPaleta() {
    const el = $("#mb-paleta"); if (!el) return;
    const p = st.atual;
    el.innerHTML = ((p.paleta || []).length ? p.paleta.map((c, i) => `<span class="mb-cor"><input type="color" value="${esc(c.hex)}" data-cor="${i}" aria-label="Cor ${i + 1}"><input type="text" value="${esc(c.nome || "")}" data-cor-nome="${i}" placeholder="${esc(c.hex)}" aria-label="Nome da cor ${i + 1}"><button type="button" data-cor-tirar="${i}" aria-label="Tirar cor">×</button></span>`).join("") : `<span class="mb-dica">Envie a imagem do produto ou leia o site da marca: as cores saem de lá. Sem imagem, a IA sugere a paleta pela marca e você ajusta.</span>`) +
      ((p.paleta || []).length < 6 ? `<button type="button" class="btn mb-btn-p" data-cor-mais>${IC.mais}Cor</button>` : "") + (imgsDe("produto").length ? `<button type="button" class="btn mb-btn-p" data-cor-auto>Tirar as cores das imagens de novo</button>` : "");
    const mudou = () => { st.paletaManual = true; boardDepois(); salvarDepois(); };
    $$("[data-cor]", el).forEach((inp) => { const f = () => { p.paleta[+inp.dataset.cor].hex = inp.value.toLowerCase(); mudou(); }; inp.addEventListener("input", f); inp.addEventListener("change", f); });
    $$("[data-cor-nome]", el).forEach((inp) => inp.addEventListener("input", () => { p.paleta[+inp.dataset.corNome].nome = inp.value; mudou(); }));
    $$("[data-cor-tirar]", el).forEach((b) => b.addEventListener("click", () => { p.paleta.splice(+b.dataset.corTirar, 1); mudou(); pintarPaleta(); }));
    const mais = $("[data-cor-mais]", el); if (mais) mais.addEventListener("click", () => { p.paleta = [...(p.paleta || []), { hex: "#a87058", nome: "", uso: "" }]; mudou(); pintarPaleta(); });
    const auto = $("[data-cor-auto]", el); if (auto) auto.addEventListener("click", () => { atualizarPaleta(true); pintarPaleta(); boardDepois(); salvarDepois(); });
  }
  function pintarAcoes() {
    const el = $("#mb-acoes"); if (!el || !st.atual.resultado) return;
    const d = duracao(), alvo = Number(st.atual.briefing.duracao) || 0, fora = alvo && d && Math.abs(d.seg - alvo) > Math.max(4, alvo * 0.15);
    el.innerHTML = `<span class="mb-dur${fora ? " fora" : ""}">${d ? `Falas: ${d.palavras} palavras, cerca de ${d.seg} s no seu ritmo${alvo ? ` (pedido: ${alvo} s)` : ""}` : ""}</span>
      <span class="mb-acoes-b"><button type="button" class="btn" data-ac="copiar">${IC.copiar}Copiar roteiro</button><button type="button" class="btn" data-ac="roteiros">${IC.enviar}${st.atual.resultado.roteiroId ? "Enviar de novo para Conteúdos" : "Mandar para Conteúdos"}</button><button type="button" class="btn" data-ac="salvar">Salvar</button></span>`;
    $('[data-ac="copiar"]', el).addEventListener("click", async () => { try { await navigator.clipboard.writeText(roteiroTexto(true)); toast("Roteiro copiado."); } catch (e) { toast("Não consegui copiar. Selecione o texto e copie.", true); } });
    $('[data-ac="roteiros"]', el).addEventListener("click", mandarParaRoteiros);
    $('[data-ac="salvar"]', el).addEventListener("click", () => salvar(false));
  }
  function pintarResultado() {
    const el = $("#mb-resultado"), p = st.atual, r = p.resultado; if (!el) return;
    if (!r) { el.innerHTML = ""; return; }
    const mb = r.moodboard || {}, idn = r.identidade || {}, ref = r.referencia || {};
    const linhaMb = (k, rot, obj, linhas) => `<div class="campo"><label>${rot}</label><textarea rows="${linhas || 2}" data-mb="${obj}.${k}">${esc(((obj === "moodboard" ? mb : obj === "identidade" ? idn : ref)[k]) || "")}</textarea></div>`;
    el.innerHTML = `
      ${st.avisos.length ? `<div class="faixa faixa-aviso">${st.avisos.map(esc).join("<br>")}</div>` : ""}
      ${idn.paleta_sugerida && !st.paletaManual ? `<div class="faixa faixa-aviso">A paleta foi sugerida pela IA porque não veio imagem do produto. Envie a imagem ou ajuste as cores na parte "Paleta".</div>` : ""}
      <section class="mb-cartao">
        <header class="mb-cab2"><div><small class="mb-sobre">1 · Roteiro em espelho</small><h3 class="mb-h"><input class="mb-titulo-in" data-mb-titulo value="${esc(r.titulo || "")}" aria-label="Título do roteiro"></h3></div></header>
        <div class="mb-espelho">
          <div class="mb-esp-cab"><span>Cena</span><span>Áudio (fala)</span><span>Imagem (direção)</span></div>
          ${r.falas.map((f, i) => `<div class="mb-esp-linha"><div class="mb-esp-n"><b>${i + 1}</b><span>${esc(f.bloco)}</span></div>
            <label><span class="sr-only">Fala da cena ${i + 1}: ${esc(f.bloco)}</span><textarea data-corretor="fala" data-fala="${i}" rows="4">${esc(f.fala)}</textarea></label>
            <label><span class="sr-only">Direção de imagem da cena ${i + 1}</span><textarea data-imagem="${i}" rows="4">${esc(f.imagem)}</textarea></label></div>`).join("")}
        </div>
        ${(r.ganchos_extra || []).length ? `<div class="mb-extra"><small class="mb-sobre">Outras opções de gancho</small><ul>${r.ganchos_extra.map((g, i) => `<li><span>${esc(g)}</span><button type="button" class="btn mb-btn-p" data-usar-gancho="${i}">Usar este</button></li>`).join("")}</ul></div>` : ""}
        <div class="mb-acoes" id="mb-acoes"></div>
      </section>
      <section class="mb-cartao">
        <header class="mb-cab2"><div><small class="mb-sobre">2 · Mood board</small><h3 class="mb-h">Visual do <em>vídeo</em></h3></div>
          <span class="mb-acoes-b"><button type="button" class="btn btn-principal" data-ac="png">${IC.baixar}Baixar PNG</button><button type="button" class="btn" data-ac="pdf">${IC.baixar}Baixar PDF</button></span></header>
        <div class="mb-board" id="mb-board"><p class="mb-dica">Montando o mood board…</p></div>
        <details class="mb-editar"><summary>Editar os textos do mood board</summary>
          <div class="mb-grade2">
            ${linhaMb("conceito", "Conceito (frase do visual)", "moodboard")}
            <div class="campo"><label>Palavras do clima (separe por vírgula)</label><input data-mb-lista="palavras" value="${esc((mb.palavras || []).join(", "))}"></div>
            ${linhaMb("clima", "Clima da marca", "identidade")}${linhaMb("tom", "Tom da marca", "identidade")}
            <div class="campo"><label>Diferenciais (um por linha)</label><textarea rows="4" data-mb-lista="diferenciais">${esc((mb.diferenciais || []).join("\n"))}</textarea></div>
            ${linhaMb("gancho_referencia", "Referência de gancho", "moodboard")}
            ${linhaMb("estilo", "Estilo da referência (edição, ritmo, textos, gancho)", "referencia", 3)}${linhaMb("texto_na_tela", "Textos na tela", "moodboard")}
            ${linhaMb("cenario", "Cenário", "moodboard")}${linhaMb("luz", "Luz", "moodboard")}${linhaMb("figurino", "Figurino", "moodboard")}${linhaMb("enquadramentos", "Enquadramentos", "moodboard")}
          </div></details>
      </section>
      <section class="mb-cartao">
        <header class="mb-cab2"><div><small class="mb-sobre">3 · Pendências</small><h3 class="mb-h">Confirmar com a <em>marca</em></h3></div></header>
        <div class="campo"><label class="sr-only" for="mb-pend">Pendências, uma por linha</label><textarea id="mb-pend" rows="${Math.max(3, (r.pendencias || []).length + 1)}" placeholder="Nada pendente. Se lembrar de algo, escreva aqui, um item por linha.">${esc((r.pendencias || []).join("\n"))}</textarea></div>
      </section>`;
    const mudou = () => { boardDepois(); salvarDepois(); };
    $$("[data-fala]", el).forEach((t) => t.addEventListener("input", () => { r.falas[+t.dataset.fala].fala = t.value; mudou(); pintarAcoes(); }));
    $$("[data-imagem]", el).forEach((t) => t.addEventListener("input", () => { r.falas[+t.dataset.imagem].imagem = t.value; mudou(); }));
    $$("[data-usar-gancho]", el).forEach((b) => b.addEventListener("click", () => { const i = +b.dataset.usarGancho, antigo = r.falas[0].fala; r.falas[0].fala = r.ganchos_extra[i]; r.ganchos_extra[i] = antigo; pintarResultado(); salvarDepois(); }));
    $("[data-mb-titulo]", el).addEventListener("input", (e) => { r.titulo = e.target.value; p.titulo = e.target.value; salvarDepois(); });
    $$("[data-mb]", el).forEach((t) => t.addEventListener("input", () => { const [o, k] = t.dataset.mb.split("."); r[o] = r[o] || {}; r[o][k] = t.value; mudou(); }));
    $$("[data-mb-lista]", el).forEach((t) => t.addEventListener("input", () => { r.moodboard = r.moodboard || {}; r.moodboard[t.dataset.mbLista] = t.value.split(t.dataset.mbLista === "palavras" ? /,/ : /\n/).map((s) => s.trim()).filter(Boolean); mudou(); }));
    $("#mb-pend", el).addEventListener("input", (e) => { r.pendencias = e.target.value.split(/\n/).map((s) => s.replace(/^[•\-\s]+/, "").trim()).filter(Boolean); salvarDepois(); });
    $('[data-ac="png"]', el).addEventListener("click", baixarPng);
    $('[data-ac="pdf"]', el).addEventListener("click", baixarPdf);
    pintarAcoes(); pintarBoard();
  }
  function pintar() {
    const sec = $("#aba-" + ABA); if (!sec) return;
    const p = st.atual, b = p.briefing;
    const jobsOp = st.jobs.map((j) => `<option value="${esc(j.id)}"${String(j.id) === String(p.job_id) ? " selected" : ""}>${esc(j.marca)}${j.status ? " · " + esc(j.status) : ""}</option>`).join("");
    const refsOp = st.refs.map((r) => `<option value="${esc(r.id)}"${String(r.id) === String(b.refId) ? " selected" : ""}>${esc((r.titulo || r.perfil || "Vídeo").slice(0, 70))}</option>`).join("");
    sec.innerHTML = `<div class="cr-pagina cr-pagina-larga mb">
      <header class="pc2-cab"><div><small class="pc2-sobre">Marcas e jobs</small><h2 class="pc2-titulo"><em>Mood board</em> da campanha</h2></div>
        <div class="pc2-cab-acoes"><button class="btn" type="button" id="mb-novo">${IC.mais}Novo</button></div></header>
      <div class="mb-lista" id="mb-lista"></div>
      <form class="mb-cartao" id="mb-form" novalidate>
        <header class="mb-cab2"><div><small class="mb-sobre">Briefing</small><h3 class="mb-h">O que a <em>marca</em> pediu</h3></div>
          <span class="mb-acoes-b"><label class="btn" data-mb-trava>${IC.clipe}Anexar briefing (PDF, imagem ou texto)<input type="file" id="mb-arquivo" accept=".pdf,image/*,.txt,.md,.csv" hidden></label></span></header>
        ${b.briefingArquivo ? `<p class="mb-dica">Briefing lido: <b>${esc(b.briefingArquivo)}</b>. Confira os campos abaixo, a IA também lê o texto completo.</p>` : ""}
        <div class="mb-grade2">
          <div class="campo"><label>Puxar de um job de UGC's & Publis</label><select name="job"><option value="">Nenhum (preencher à mão)</option>${jobsOp}</select></div>
          ${campo("marca", "Marca", { ex: "ex.: Nivea" })}
          ${campo("produto", "Produto e o que ele é", { ex: "ex.: Gel Creme Facial, hidratante leve para pele oleosa" })}
          ${campo("objetivo", "Objetivo da campanha", { ex: "o que a marca quer com o vídeo" })}
          ${campo("publico", "Público-alvo", { ex: "quem vai assistir" })}
          <div class="campo"><label>Formato</label><select name="formato">${FORMATOS.map((f) => `<option${f === b.formato ? " selected" : ""}>${f}</option>`).join("")}</select></div>
          ${campo("duracao", "Duração (segundos)", { ex: "ex.: 40", attr: 'type="number" min="5" max="600" inputmode="numeric"' })}
          <div class="campo"><label>Plataformas</label><div class="mb-checks">${PLATAFORMAS.map((pl) => `<label><input type="checkbox" name="plataformas" value="${pl}"${(b.plataformas || []).includes(pl) ? " checked" : ""}> ${pl}</label>`).join("")}</div></div>
        </div>
        <div class="mb-grade2">
          ${campo("diferenciais", "Diferenciais do produto", { linhas: 3, ex: "ativos, benefícios, o que só ele tem" })}
          ${campo("objecoes", "Objeções do público", { linhas: 3, ex: "o que faz a pessoa não comprar" })}
          ${campo("regras", "Do's & Don'ts, termos proibidos e frases obrigatórias", { linhas: 3, ex: "regras da marca" })}
          ${campo("falas", "Falas prontas da marca (se ela mandou)", { linhas: 3, ex: "em branco = a IA cria as falas a partir do briefing" })}
          ${campo("pecas", "Peças que você recebeu", { ex: "ex.: 1 hidratante 50 g e 1 protetor" })}
          ${campo("claims", "Claims liberados pela marca", { ex: "o que pode prometer" })}
          ${campo("cta", "CTA, link e cupom", { ex: "ex.: link na bio, cupom MARI10" })}
          ${campo("arroba", "@ oficial da marca", { ex: "@marca" })}
        </div>
        <div class="mb-grade2">
          <div class="campo"><label>Site da marca</label><div class="mb-junto"><input name="site" value="${esc(b.site || "")}" placeholder="ex.: marca.com.br/produto"><button type="button" class="btn" id="mb-site" data-mb-trava>Ler site</button></div>${b.siteResumo ? `<small class="mb-dica">Site lido: ${esc(b.siteResumo.slice(0, 140))}…</small>` : ""}</div>
          <div class="campo"><label>Vídeo de referência (da sua Biblioteca)</label><select name="refId"><option value="">Nenhum</option>${refsOp}</select><small class="mb-dica">Para a IA usar um vídeo como base, transcreva o link em Referências e escolha aqui.</small></div>
          ${campo("referencias", "Outras referências (links ou descrição)", { linhas: 2, ex: "cole os links ou descreva o estilo", cls: "mb-larga" })}
        </div>
        <textarea name="briefingTexto" hidden>${esc(b.briefingTexto || "")}</textarea>
        <div class="mb-grade3">
          ${Object.keys(TIPOS_IMG).map((t) => `<div class="mb-envio"><b>${TIPOS_IMG[t].nome}</b><small class="mb-dica">${TIPOS_IMG[t].dica}</small><div class="mb-minis" data-mb-imgs="${t}"></div></div>`).join("")}
        </div>
        <div class="mb-envio"><b>Paleta</b><div class="mb-paleta" id="mb-paleta"></div></div>
        <div class="mb-rodape"><p class="mb-estado" id="mb-estado" role="status" hidden></p>
          <button type="submit" class="btn btn-principal mb-criar" data-mb-trava>${IC.brilho}${p.resultado ? "Criar de novo" : "Criar roteiro e mood board"}</button></div>
      </form>
      <div id="mb-resultado"></div>
    </div>`;
    const f = $("#mb-form");
    f.addEventListener("submit", async (e) => { e.preventDefault(); if (p.resultado && !(await confirmar("Criar de novo troca o roteiro e os textos do mood board atuais. Continuar?", { ok: "Criar de novo" }))) return; criar(); });
    f.addEventListener("input", () => { lerForm(); if (p.resultado) { boardDepois(); salvarDepois(); } });
    f.elements.job.addEventListener("change", () => {
      const j = st.jobs.find((z) => String(z.id) === f.elements.job.value); lerForm(); if (!j) return;
      const marca = String(j.marca || "").split(/\s[·\-]\s/)[0].trim();
      if (!b.marca) b.marca = marca; if (!b.produto && j.produto) b.produto = j.produto;
      const txt = [j.briefing, j.escopo].filter(Boolean).join("\n\n"); if (txt && !b.briefingTexto) { b.briefingTexto = txt.slice(0, 12000); b.briefingArquivo = "briefing do job " + j.marca; }
      pintar();
    });
    $("#mb-novo").addEventListener("click", () => { st.atual = novo(); st.avisos = []; st.paletaManual = false; pintar(); window.scrollTo({ top: 0 }); });
    $("#mb-arquivo").addEventListener("change", async (e) => {
      const arq = e.target.files[0]; if (!arq) return; lerForm();
      try { estado("Lendo o briefing…"); await anexarBriefing(arq); estado(""); pintar(); toast("Briefing lido. Confira os campos."); } catch (er) { estado(""); toast(er.message, true); }
    });
    $("#mb-site").addEventListener("click", async () => { lerForm(); try { estado("Lendo o site da marca…"); await lerSite(); estado(""); pintar(); toast("Site lido."); } catch (er) { estado(""); toast(er.message, true); } });
    pintarLista(); pintarImagens(); pintarPaleta(); pintarResultado(); estado(st.ocupado);
  }

  async function abrirAba() {
    const sec = $("#aba-" + ABA); if (!sec) return;
    if (!st.carregado) {
      sec.innerHTML = `<p class="mb-dica">Abrindo…</p>`;
      try { await carregar(); } catch (e) { sec.innerHTML = `<p class="faixa faixa-erro">Não consegui abrir o Moodboard: ${esc(e.message)}</p>`; return; }
      pintar();
    } else if (!sec.firstElementChild) pintar();
    // veio do botão "Criar mood board deste job": abre o salvo desse job ou um novo já puxando o job
    const jobId = window.moodboardDoJob; window.moodboardDoJob = "";
    if (jobId) {
      const salvo = (st.lista || []).find((m) => String(m.job_id) === jobId);
      if (salvo) { await abrirProjeto(salvo.id); window.scrollTo({ top: 0 }); return; }
      st.atual = novo(); st.avisos = []; st.paletaManual = false; st.atual.job_id = jobId; pintar();
      const sel = $("#mb-form") && $("#mb-form").elements.job;
      if (sel) { sel.value = jobId; sel.dispatchEvent(new Event("change")); }
      window.scrollTo({ top: 0 });
    }
  }
  document.addEventListener("painel:aba", (e) => { if (e.detail === ABA) abrirAba(); });
  if (location.hash.replace("#", "") === ABA) setTimeout(() => document.dispatchEvent(new CustomEvent("painel:aba", { detail: ABA })), 800);
  window.painelMoodboard = { st, pintar, montarBoard };
})();
