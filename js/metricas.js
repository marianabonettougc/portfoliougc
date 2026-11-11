// =========================================================
// CONTEÚDO > REDES SOCIAIS (#metricas) · central de comando das redes (nov/2026)
// Layout inspirado no "social media command center" da @sarguchi que a Mari mandou,
// SEMPRE na paleta dela (creme, café, terracota, verde do painel, manteiga, areia).
// Abas: Visão geral | Plataformas | Tendências | Calendário (escolha em localStorage "rsAba").
// Dados (nada inventado; sem dado aparece "sem dado"):
//  - configuracoes "metricool_instagram" (leitor js/metricool-ig.js): Instagram por dia + Reels
//  - configuracoes "metricool_redes" (tarefa diária do Claude pelo Metricool):
//      {atualizadoEm, instagram:{reels:[[data,legenda,link,imagem,alcance,views,interacoes,salvos,compart,coment,curtidas,tempoMedio,retencao,pulos]], posts:[[data,legenda,link,imagem,tipo,alcance,views,interacoes,salvos,compart,coment,curtidas]]},
//       tiktok:{ev:[[seguidores,novos,views,alcance,curtidas,coment,compart,videos,AAAAMMDD]], posts:[[data,descricao,link,capa,views,curtidas,coment,compart,alcance]]},
//       youtube:{ev:[[inscritos,views,videos,ganhos,perdidos,AAAAMMDD]], videos:[[data,titulo,link,thumb,views,curtidas,coment]]},
//       melhorHorario:{instagram:{"1".."7":[24 valores]}}}  (1 = segunda ... 7 = domingo)
//  - configuracoes "redes_tendencias" + Edge Function "tendencias" (hashtags públicas pelo Apify, tópicos pelo Groq)
//  - painel_conteudo (Calendário e consistência), perfil_conteudo (meta por semana), inspiracoes (bombou nos perfis)
// Período em localStorage "mtDias" (7/30/90), plataforma em "rsRede".
// =========================================================
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n) => (n == null || isNaN(n) ? "sem dado" : Number(n).toLocaleString("pt-BR"));
  const pct = (n, casas = 1) => (n == null || isNaN(n) ? "sem dado" : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }) + "%");
  const curto = (n) => { if (n == null || isNaN(n)) return "sem dado"; const a = Math.abs(n); return a >= 1e6 ? (n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi" : a >= 1e4 ? (n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil" : Math.round(n).toLocaleString("pt-BR"); };
  const N = (v) => (v == null || v === "" || isNaN(Number(v)) ? null : Number(v));
  const iso8 = (s) => `${String(s).slice(0, 4)}-${String(s).slice(4, 6)}-${String(s).slice(6, 8)}`;
  const isoData = (s) => { const t = String(s || ""); return /^\d{8}/.test(t) ? iso8(t) : t.slice(0, 10); };
  const diaBR = (iso) => { const [a, m, d] = String(iso).slice(0, 10).split("-"); return d && m ? `${d}/${m}` : ""; };
  const hojeISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const menos = (s, k) => { const t = new Date(s + "T12:00:00"); t.setDate(t.getDate() - k); return t.toISOString().slice(0, 10); };
  const soma = (a) => a.reduce((x, y) => x + (y || 0), 0);
  const mediana = (a) => { const v = a.filter((x) => x != null).sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : null; };
  const variacao = (a, b) => (a == null || b == null || !b ? null : Math.round(((a - b) / b) * 1000) / 10);
  const primeira = (t, n = 70) => { const l = String(t || "").split("\n").map((x) => x.trim()).find((x) => x && !/^#/.test(x)) || String(t || "").trim(); return l.length > n ? l.slice(0, n - 1) + "…" : l || "sem legenda"; };
  const ler = (k, p) => { try { const v = localStorage.getItem(k); return v == null ? p : JSON.parse(v); } catch (e) { return p; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } };
  const toast = (m, erro) => { const t = $("#toast"); if (!t) return; t.textContent = m; t.classList.toggle("erro", !!erro); t.classList.add("visivel"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("visivel"), 3200); };
  const banco = () => window.banco;
  const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const REDES = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" };
  const COR = { instagram: "#6b4a35", youtube: "#c27a52", tiktok: "#4f7a54" };

  const st = {
    dias: ler("mtDias", 30), aba: ler("rsAba", "geral"), rede: ler("rsRede", "instagram"), ordem: "views",
    ig: null, redes: null, tend: null, conteudos: [], perfil: null, bombou: [], carregando: false, erro: "", buscando: false, analisando: false, verPosts: {},
  };
  if (![7, 30, 90].includes(st.dias)) st.dias = 30;
  if (!["geral", "plataformas", "tendencias", "calendario"].includes(st.aba)) st.aba = "geral";
  if (!REDES[st.rede]) st.rede = "instagram";

  // ---------- leitura ----------
  async function lerChave(chave) {
    const { data } = await banco().from("configuracoes").select("valor").eq("chave", chave).maybeSingle();
    if (!data || !data.valor) return null;
    try { return typeof data.valor === "string" ? JSON.parse(data.valor) : data.valor; } catch (e) { return null; }
  }
  async function buscar() {
    if (!banco()) return;
    st.carregando = true; st.erro = ""; pintar();
    const [ig, redes, tend, perfil, cont, insp] = await Promise.allSettled([
      window.metricoolIG ? window.metricoolIG.ler(banco()) : Promise.resolve(null),
      lerChave("metricool_redes"), lerChave("redes_tendencias"), lerChave("perfil_conteudo"),
      banco().from("painel_conteudo").select("id,data,data_gravacao,formato,tema,pilar,funil,status,tipo_conteudo,marca").gte("data", menos(hojeISO(), 120)).order("data"),
      banco().from("inspiracoes").select("id,perfil,link,capa,legenda,visualizacoes,curtidas,multiplicador,publicado_em,radar,rede").gte("multiplicador", 2).gte("publicado_em", new Date(Date.now() - 14 * 864e5).toISOString()).or("oculto.is.null,oculto.eq.false").order("multiplicador", { ascending: false }).limit(4),
    ]);
    const ok = (r) => (r.status === "fulfilled" ? r.value : null);
    st.ig = ok(ig); st.redes = ok(redes); st.tend = ok(tend); st.perfil = ok(perfil);
    st.conteudos = (ok(cont) && ok(cont).data) || [];
    st.bombou = (ok(insp) && ok(insp).data) || [];
    if (ig.status === "rejected") st.erro = String(ig.reason && ig.reason.message || ig.reason);
    st.carregando = false; pintar();
  }

  // ---------- números ----------
  function janela(qtd) {
    const P = st.ig && window.metricoolIG ? window.metricoolIG.periodo(st.ig, qtd) : null;
    const ate = P ? P.ate : menos(hojeISO(), 1);
    return { P, de: menos(ate, qtd - 1), ate, deAnt: menos(ate, 2 * qtd - 1), ateAnt: menos(ate, qtd) };
  }
  function linhasRede(chave) {
    const ev = st.redes && st.redes[chave] && Array.isArray(st.redes[chave].ev) ? st.redes[chave].ev : [];
    return ev.map((r) => ({ data: iso8(r[r.length - 1]), r })).sort((a, b) => a.data.localeCompare(b.data));
  }
  function youtube(J) {
    const L = linhasRede("youtube");
    const faixa = (a, b) => L.filter((x) => x.data >= a && x.data <= b);
    const A = faixa(J.de, J.ate), B = faixa(J.deAnt, J.ateAnt);
    const comSub = L.filter((x) => N(x.r[0]) != null);
    const viewsA = A.some((x) => N(x.r[1]) != null) ? soma(A.map((x) => N(x.r[1]))) : null;
    const viewsB = B.some((x) => N(x.r[1]) != null) ? soma(B.map((x) => N(x.r[1]))) : null;
    return {
      tem: L.length > 0, inscritos: comSub.length ? N(comSub[comSub.length - 1].r[0]) : null,
      views: viewsA, viewsVar: variacao(viewsA, viewsB), videos: A.length ? soma(A.map((x) => N(x.r[2]))) : null,
      ganhos: A.length ? soma(A.map((x) => N(x.r[3]))) : null, perdidos: A.length ? soma(A.map((x) => N(x.r[4]))) : null,
      porDia: Object.fromEntries(A.map((x) => [x.data, N(x.r[1]) || 0])),
      lista: ((st.redes && st.redes.youtube && st.redes.youtube.videos) || []).map((v) => ({ rede: "youtube", data: isoData(v[0]), legenda: v[1] || "", link: v[2] || "", img: v[3] || "", views: N(v[4]), curtidas: N(v[5]), coment: N(v[6]), formato: "Vídeo" })),
    };
  }
  function tiktok(J) {
    const L = linhasRede("tiktok");
    const faixa = (a, b) => L.filter((x) => x.data >= a && x.data <= b);
    const A = faixa(J.de, J.ate), B = faixa(J.deAnt, J.ateAnt);
    const comSeg = L.filter((x) => N(x.r[0]));
    const s = (arr, i) => (arr.some((x) => N(x.r[i])) ? soma(arr.map((x) => N(x.r[i]))) : null);
    const lista = ((st.redes && st.redes.tiktok && st.redes.tiktok.posts) || []).map((v) => ({ rede: "tiktok", data: isoData(v[0]), legenda: v[1] || "", link: v[2] || "", img: v[3] || "", views: N(v[4]), curtidas: N(v[5]), coment: N(v[6]), compart: N(v[7]), alcance: N(v[8]), formato: "Vídeo" }));
    const temNumero = comSeg.length > 0 || A.some((x) => N(x.r[2])) || lista.length > 0;
    const inter = s(A, 4) != null || s(A, 5) != null || s(A, 6) != null ? (s(A, 4) || 0) + (s(A, 5) || 0) + (s(A, 6) || 0) : null;
    return {
      tem: temNumero, seguidores: comSeg.length ? N(comSeg[comSeg.length - 1].r[0]) : null, novos: s(A, 1),
      views: s(A, 2), viewsVar: variacao(s(A, 2), s(B, 2)), alcance: s(A, 3), interacoes: inter, videos: s(A, 7),
      porDia: Object.fromEntries(A.map((x) => [x.data, N(x.r[2]) || 0])), lista,
    };
  }
  function reelsIG() {
    const ricos = st.redes && st.redes.instagram && Array.isArray(st.redes.instagram.reels) ? st.redes.instagram.reels : null;
    if (ricos && ricos.length) return ricos.map((r) => ({ rede: "instagram", formato: "Reels", data: isoData(r[0]), legenda: r[1] || "", link: r[2] || "", img: r[3] || "", alcance: N(r[4]), views: N(r[5]), interacoes: N(r[6]), salvos: N(r[7]), compart: N(r[8]), coment: N(r[9]), curtidas: N(r[10]), tempo: N(r[11]), retencao: N(r[12]), pulos: N(r[13]) }));
    return ((st.ig && st.ig.reels) || []).map((r) => ({ rede: "instagram", formato: "Reels", data: r.data, legenda: r.legenda, link: r.link, img: "", alcance: r.alcance, views: r.views, interacoes: r.interacoes, salvos: r.salvos, compart: r.compart }));
  }
  function postsIG() {
    const p = st.redes && st.redes.instagram && Array.isArray(st.redes.instagram.posts) ? st.redes.instagram.posts : [];
    return p.map((r) => ({ rede: "instagram", data: isoData(r[0]), legenda: r[1] || "", link: r[2] || "", img: r[3] || "", formato: /carousel|album/i.test(r[4] || "") ? "Carrossel" : "Foto", alcance: N(r[5]), views: N(r[6]), interacoes: N(r[7]), salvos: N(r[8]), compart: N(r[9]), coment: N(r[10]), curtidas: N(r[11]) }));
  }
  const engPost = (p) => (p.alcance && p.interacoes != null ? (p.interacoes / p.alcance) * 100 : null);

  // ---------- pedaços de layout ----------
  const BLOBS = [
    "M60 4c22 0 36 18 36 38S80 92 54 92 4 80 8 54 38 4 60 4z",
    "M50 2l11 22 24-6-6 24 22 11-22 11 6 24-24-6-11 22-11-22-24 6 6-24L-1 53l22-11-6-24 24 6z",
    "M70 6c18 8 28 30 20 50S56 96 34 88 0 58 8 34 52-2 70 6z",
    "M10 90C10 40 40 8 92 8v82z",
  ];
  function kpi(i, rotulo, valor, chip, pe, icone) {
    return `<div class="rs-kpi rs-k${i}"><svg class="rs-blob" viewBox="0 0 100 100" aria-hidden="true"><path d="${BLOBS[i]}"/></svg>
      <div class="rs-kpi-cab"><span>${esc(rotulo)}</span>${icone || ""}</div>
      <strong${String(valor).replace(/<[^>]+>/g, "").length > 11 ? ' class="txt"' : ""}>${valor}</strong>${chip || ""}<small>${pe || ""}</small></div>`;
  }
  const chipVar = (v, unidade = "%") => (v == null ? "" : `<span class="rs-chip ${v >= 0 ? "sobe" : "desce"}">${v >= 0 ? "↑" : "↓"} ${Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${unidade}</span>`);
  const ICO = {
    olho: `<svg class="traco" viewBox="0 0 24 24"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/></svg>`,
    coracao: `<svg class="traco" viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>`,
    pessoas: `<svg class="traco" viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><path d="M16 5.8a3 3 0 0 1 0 5.6M17.5 14.6c1.6.6 2.7 2 3 4.4"/></svg>`,
    video: `<svg class="traco" viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10.5l5-3v9l-5-3z"/></svg>`,
    fogo: `<svg class="traco" viewBox="0 0 24 24"><path d="M12 21c-4 0-6.5-2.6-6.5-6 0-4 3.5-5.5 4-10 2.8 1.8 4.5 4.3 4.5 6.5 1-.7 1.6-1.8 1.8-3 1.6 1.6 2.7 3.8 2.7 6.5 0 3.4-2.5 6-6.5 6z"/></svg>`,
    play: `<svg class="traco" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M10.5 9l4.5 3-4.5 3z"/></svg>`,
    hash: `<svg class="traco" viewBox="0 0 24 24"><path d="M9 4L7 20M17 4l-2 16M4.5 9h15M3.5 15h15"/></svg>`,
    coroa: `<svg class="traco" viewBox="0 0 24 24"><path d="M4 17l-1-9 5 4 4-7 4 7 5-4-1 9z"/><path d="M5 20h14"/></svg>`,
    cal: `<svg class="traco" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>`,
    camada: `<svg class="traco" viewBox="0 0 24 24"><path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5"/></svg>`,
    camera: `<svg class="traco" viewBox="0 0 24 24"><path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`,
    ok: `<svg class="traco" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
    x: `<svg class="traco" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
    seta: `<svg class="traco" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
    atualizar: `<svg class="traco" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></svg>`,
  };
  function capa(p) {
    return `<span class="rs-capa">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<i>${esc((REDES[p.rede] || "")[0] || "")}</i></span>`;
  }

  // gráfico de linhas (várias séries) com dica
  function grafico(series, rotulos) {
    const tem = series.filter((s) => s.valores.some((v) => v));
    if (!tem.length || rotulos.length < 2) return `<p class="rs-vazio">Sem números neste período.</p>`;
    const larg = ($("#aba-metricas") || {}).clientWidth || 760;
    const W = Math.max(300, Math.round(larg > 900 ? larg * 0.56 : larg - 60)), H = 200, pe = 42, pd = 10, pt = 12, pb = 24;
    const max = Math.max(...tem.flatMap((s) => s.valores), 1);
    const passo = Math.pow(10, Math.floor(Math.log10(max)));
    const topo = Math.ceil(max / passo) * passo;
    const x = (i) => pe + i * (W - pe - pd) / (rotulos.length - 1);
    const y = (v) => pt + (H - pt - pb) * (1 - v / topo);
    const grades = [0, 0.5, 1].map((f) => `<line x1="${pe}" x2="${W - pd}" y1="${y(topo * f)}" y2="${y(topo * f)}" class="rs-grade"/><text x="${pe - 6}" y="${y(topo * f) + 4}" class="rs-eixo" text-anchor="end">${curto(topo * f)}</text>`).join("");
    const nRot = Math.min(W < 500 ? 4 : 6, rotulos.length);
    const rots = Array.from({ length: nRot }, (_, k) => Math.round(k * (rotulos.length - 1) / (nRot - 1))).map((i) => `<text x="${x(i)}" y="${H - 5}" class="rs-eixo" text-anchor="middle">${esc(rotulos[i])}</text>`).join("");
    const linhas = tem.map((s, k) => {
      const d = s.valores.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v || 0).toFixed(1)}`).join("");
      const area = k === 0 ? `<path d="${d}L${x(rotulos.length - 1)},${y(0)}L${x(0)},${y(0)}Z" fill="${s.cor}" opacity=".07"/>` : "";
      return `${area}<path d="${d}" fill="none" stroke="${s.cor}" stroke-width="2" ${k ? 'stroke-dasharray="5 4"' : ""} stroke-linejoin="round"/>`;
    }).join("");
    const dados = { W, H, pe, pd, pt, pb, topo, rotulos, series: tem.map((s) => ({ nome: s.nome, cor: s.cor, valores: s.valores })) };
    return `<div class="rs-graf" data-g='${esc(JSON.stringify(dados))}'>
      <svg viewBox="0 0 ${W} ${H}" style="aspect-ratio:${W}/${H}" role="img" aria-label="Visualizações">${grades}${linhas}${rots}
        <line class="rs-cursor" x1="0" x2="0" y1="${pt}" y2="${H - pb}" visibility="hidden"/></svg><div class="rs-dica" hidden></div></div>
      <p class="rs-legenda">${tem.map((s, k) => `<span><i style="background:${s.cor}${k ? ";opacity:.75" : ""}"></i>${esc(s.nome)}</span>`).join("")}</p>`;
  }
  function ligarGraficos(raiz) {
    raiz.querySelectorAll(".rs-graf").forEach((g) => {
      const D = JSON.parse(g.dataset.g), svg = g.querySelector("svg"), dica = g.querySelector(".rs-dica"), cur = svg.querySelector(".rs-cursor");
      const n = D.rotulos.length;
      const mover = (ev) => {
        const r = svg.getBoundingClientRect();
        const px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) / r.width * D.W;
        const i = Math.max(0, Math.min(n - 1, Math.round((px - D.pe) / ((D.W - D.pe - D.pd) / (n - 1)))));
        const cx = D.pe + i * (D.W - D.pe - D.pd) / (n - 1);
        cur.setAttribute("x1", cx); cur.setAttribute("x2", cx); cur.setAttribute("visibility", "visible");
        dica.innerHTML = `<b>${esc(D.rotulos[i])}</b>${D.series.map((s) => `<span><i style="background:${s.cor}"></i>${num(s.valores[i] || 0)} ${esc(s.nome)}</span>`).join("")}`;
        dica.hidden = false;
        dica.style.left = Math.min(Math.max(cx / D.W * r.width, 80), r.width - 80) + "px";
      };
      const sair = () => { cur.setAttribute("visibility", "hidden"); dica.hidden = true; };
      svg.addEventListener("mousemove", mover); svg.addEventListener("touchmove", mover, { passive: true });
      svg.addEventListener("mouseleave", sair); svg.addEventListener("touchend", sair);
    });
  }

  // ---------- VISÃO GERAL ----------
  function visaoGeral(J) {
    const P = J.P, yt = youtube(J), tk = tiktok(J);
    const viewsIG = P ? P.views : null;
    const viewsTot = [viewsIG, yt.views, tk.views].some((v) => v != null) ? (viewsIG || 0) + (yt.views || 0) + (tk.views || 0) : null;
    const viewsAntIG = P && P.views != null && P.viewsVar != null ? P.views / (1 + P.viewsVar / 100) : null;
    const viewsAntYT = yt.views != null && yt.viewsVar != null ? yt.views / (1 + yt.viewsVar / 100) : null;
    const varTot = viewsAntIG != null || viewsAntYT != null ? variacao(viewsTot, (viewsAntIG || 0) + (viewsAntYT || 0)) : null;
    const liquidoIG = P && P.novos != null ? (P.novos || 0) - (P.deixaram || 0) : null;
    const liquidoYT = yt.ganhos != null ? (yt.ganhos || 0) - (yt.perdidos || 0) : null;
    const liquido = liquidoIG != null || liquidoYT != null || tk.novos != null ? (liquidoIG || 0) + (liquidoYT || 0) + (tk.novos || 0) : null;
    const publico = (P && P.seguidores || 0) + (yt.inscritos || 0) + (tk.seguidores || 0);
    const postsIGn = P ? P.posts : null;
    const postsTot = [postsIGn, yt.videos, tk.videos].some((v) => v != null) ? (postsIGn || 0) + (yt.videos || 0) + (tk.videos || 0) : null;
    const partes = [postsIGn ? `${postsIGn} Instagram` : "", yt.videos ? `${yt.videos} YouTube` : "", tk.videos ? `${tk.videos} TikTok` : ""].filter(Boolean).join(" · ");

    // série de visualizações: por dia (7 e 30) ou por semana (90)
    const porDiaIG = P ? Object.fromEntries(P.viewsDia.map((x) => [x.data, x.valor])) : {};
    const datas = []; for (let k = st.dias - 1; k >= 0; k--) datas.push(menos(J.ate, k));
    let rotulos, sIG, sYT, sTK;
    if (st.dias === 90) {
      rotulos = []; sIG = []; sYT = []; sTK = [];
      for (let i = 0; i < datas.length; i += 7) {
        const sem = datas.slice(i, i + 7);
        rotulos.push(`sem. ${diaBR(sem[0])}`);
        sIG.push(soma(sem.map((d) => porDiaIG[d] || 0))); sYT.push(soma(sem.map((d) => yt.porDia[d] || 0))); sTK.push(soma(sem.map((d) => tk.porDia[d] || 0)));
      }
    } else {
      rotulos = datas.map(diaBR); sIG = datas.map((d) => porDiaIG[d] || 0); sYT = datas.map((d) => yt.porDia[d] || 0); sTK = datas.map((d) => tk.porDia[d] || 0);
    }

    // melhor dia (Metricool: melhor horário do Instagram, valor maior = melhor)
    const mh = st.redes && st.redes.melhorHorario && st.redes.melhorHorario.instagram;
    let melhorDia = "";
    if (mh) {
      const medias = DIAS.map((_, i) => { const h = mh[String(i + 1)] || []; return h.length ? soma(h) / h.length : 0; });
      const maxM = Math.max(...medias, 1), imax = medias.indexOf(Math.max(...medias));
      const horas = mh[String(imax + 1)] || [];
      const hmax = horas.indexOf(Math.max(...horas));
      melhorDia = `<div class="rs-barras">${medias.map((m, i) => `<div class="rs-barra${i === imax ? " top" : ""}" title="${DIAS[i]}"><b>${i === imax ? "melhor" : ""}</b><span style="height:${Math.max(8, Math.round(m / maxM * 100))}%"></span><small>${DIAS[i]}</small></div>`).join("")}</div>
        <p class="rs-nota">${DIAS[imax]} rende mais${hmax >= 0 ? `, por volta das <b>${hmax}h</b>` : ""}. Conta do Metricool pela atividade do seu público no Instagram.</p>`;
    } else melhorDia = `<p class="rs-vazio">O melhor horário chega com a próxima leitura do Metricool.</p>`;

    // consistência: posts das últimas 4 semanas x meta do ritmo
    const meta = Number(st.perfil && st.perfil.ritmo && st.perfil.ritmo.porSemana) || 3;
    const de28 = menos(J.ate, 27);
    const postsIG28 = st.ig ? soma(st.ig.dias.filter((d) => d.data >= de28 && d.data <= J.ate).map((d) => d.posts || 0)) : 0;
    const yt28 = soma(linhasRede("youtube").filter((x) => x.data >= de28).map((x) => N(x.r[2]) || 0));
    const feitos = postsIG28 + yt28, esperado = meta * 4;
    const pc = Math.min(100, Math.round(feitos / esperado * 100));
    const arco = (p) => { const a = Math.PI * (1 - p / 100), cx = 80, cy = 80, r = 62; return `M18,80 A62,62 0 0 1 ${(cx + r * Math.cos(a)).toFixed(1)},${(cy - r * Math.sin(a)).toFixed(1)}`; };
    const tracos = Array.from({ length: 23 }, (_, i) => { const a = Math.PI * (1 - i / 22); return `<line x1="${(80 + 54 * Math.cos(a)).toFixed(1)}" y1="${(80 - 54 * Math.sin(a)).toFixed(1)}" x2="${(80 + 46 * Math.cos(a)).toFixed(1)}" y2="${(80 - 46 * Math.sin(a)).toFixed(1)}" class="${i / 22 * 100 <= pc ? "on" : ""}"/>`; }).join("");

    const plat = [
      ["instagram", P ? P.seguidores : null, "seguidores no Instagram"],
      ["tiktok", tk.seguidores, "seguidores no TikTok"],
      ["youtube", yt.inscritos, "inscritos no YouTube"],
    ];
    const maior = plat.filter((p) => p[1]).sort((a, b) => b[1] - a[1])[0];

    return `
    <div class="rs-kpis">
      ${kpi(0, `Visualizações, ${st.dias} dias`, curto(viewsTot), chipVar(varTot), `vs. os ${st.dias} dias antes${viewsIG != null && yt.views != null ? ` · IG ${curto(viewsIG)} · YT ${curto(yt.views)}` : ""}`, ICO.olho)}
      ${kpi(1, "Engajamento médio", P && P.engajamento != null ? pct(P.engajamento) : "sem dado", chipVar(P && P.engajamentoVar, " pts"), "contas engajadas ÷ alcance no Instagram", ICO.coracao)}
      ${kpi(2, `Seguidores, ${st.dias} dias`, liquido == null ? "sem dado" : (liquido >= 0 ? "+" : "") + num(liquido), "", `${[liquidoIG != null ? `IG ${liquidoIG >= 0 ? "+" : ""}${liquidoIG}` : "", liquidoYT != null ? `YT ${liquidoYT >= 0 ? "+" : ""}${liquidoYT}` : ""].filter(Boolean).join(" · ")}${publico ? ` · ${num(publico)} no total` : ""}`, ICO.pessoas)}
      ${kpi(3, `Posts, ${st.dias} dias`, num(postsTot), "", partes || "nenhum post no período", ICO.video)}
    </div>
    <div class="rs-g2">
      <div class="rs-cartao"><div class="rs-cab"><h3>Visualizações por ${st.dias === 90 ? "semana" : "dia"}</h3><small>Instagram e YouTube${tk.tem ? " e TikTok" : ""}</small></div>
        <div class="rs-num-grande"><strong>${curto(viewsTot)}</strong>${chipVar(varTot)}<small>nos últimos ${st.dias} dias</small></div>
        ${grafico([{ nome: "Instagram", cor: COR.instagram, valores: sIG }, { nome: "YouTube", cor: COR.youtube, valores: sYT }, { nome: "TikTok", cor: COR.tiktok, valores: sTK }], rotulos)}
      </div>
      <div class="rs-cartao"><div class="rs-cab"><h3>Melhor dia para postar</h3><small>Instagram</small></div>${melhorDia}</div>
    </div>
    <div class="rs-g2">
      <div class="rs-cartao"><div class="rs-cab"><h3>Público por plataforma</h3>${maior ? `<span class="rs-pilula">Maior: ${REDES[maior[0]]}</span>` : ""}</div>
        <div class="rs-publico">${plat.map(([r, v, t]) => `<div class="rs-pub" style="--c:${COR[r]}"><strong>${v ? num(v) : "sem dado"}</strong><small>${t}</small></div>`).join("")}</div>
        ${!tk.tem ? `<p class="rs-nota">O TikTok está conectado no Metricool, mas ainda não trouxe números. Vale abrir o Metricool e conferir a conexão do TikTok.</p>` : ""}
      </div>
      <div class="rs-cartao"><div class="rs-cab"><h3>Consistência de postagem</h3><small>últimas 4 semanas</small></div>
        <div class="rs-gauge"><svg viewBox="0 0 160 92" aria-hidden="true">${tracos}<path d="M18,80 A62,62 0 0 1 142,80" class="rs-g-fundo"/><path d="${arco(pc)}" class="rs-g-arco"/></svg>
          <div><strong>${pc}%</strong><small>${feitos} de ${esperado} posts (meta de ${meta} por semana)</small></div></div>
      </div>
    </div>`;
  }

  // ---------- PLATAFORMAS ----------
  function leitura(rede, lista, J) {
    const bom = [], ruim = [];
    if (rede === "instagram") {
      const reels = lista.filter((p) => p.formato === "Reels" && p.views != null);
      const med = mediana(reels.map((p) => p.views));
      const top = [...reels].sort((a, b) => b.views - a.views)[0];
      if (top && med && top.views >= med * 1.5 && reels.length > 1) bom.push(["Vídeo que puxou o período", `"${primeira(top.legenda, 60)}" teve ${num(top.views)} visualizações, ${(top.views / med).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x a mediana dos seus Reels.`]);
      const comPulo = reels.filter((p) => p.pulos != null);
      const segurou = [...comPulo].sort((a, b) => a.pulos - b.pulos)[0];
      const perdeu = [...comPulo].sort((a, b) => b.pulos - a.pulos)[0];
      if (segurou && segurou.pulos <= 45) bom.push(["Gancho segurando", `Em "${primeira(segurou.legenda, 50)}" só ${pct(segurou.pulos, 0)} passaram nos 3 primeiros segundos.`]);
      if (perdeu && perdeu.pulos >= 55 && perdeu !== segurou) ruim.push(["Gancho perdendo gente", `Em "${primeira(perdeu.legenda, 50)}" ${pct(perdeu.pulos, 0)} passaram nos 3 primeiros segundos. Vale testar outra abertura.`]);
      const guardar = [...lista].filter((p) => (p.salvos || 0) + (p.compart || 0) > 0).sort((a, b) => (b.salvos || 0) + (b.compart || 0) - (a.salvos || 0) - (a.compart || 0))[0];
      if (guardar) bom.push(["O que as pessoas guardam", `"${primeira(guardar.legenda, 50)}" somou ${num(guardar.salvos || 0)} salvos e ${num(guardar.compart || 0)} compartilhamentos.`]);
      const publis = reels.filter((p) => /#publi\b|publi\b/i.test(p.legenda)), org = reels.filter((p) => !/#publi\b|publi\b/i.test(p.legenda));
      if (publis.length && org.length) {
        const mp = mediana(publis.map((p) => p.views)), mo = mediana(org.map((p) => p.views));
        if (mp && mo) (mp >= mo ? bom : ruim).push(["Publi x orgânico", `Mediana das publis: ${num(mp)} visualizações; dos orgânicos: ${num(mo)}.`]);
      }
      const meta = Number(st.perfil && st.perfil.ritmo && st.perfil.ritmo.porSemana) || 3;
      const P = J.P;
      if (P && P.posts != null) {
        const porSem = P.posts / (st.dias / 7);
        if (porSem >= meta) bom.push(["Frequência", `${porSem.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} posts por semana, dentro da sua meta de ${meta}.`]);
        else ruim.push(["Frequência abaixo da meta", `${porSem.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} posts por semana no período, a meta é ${meta}.`]);
      }
      if (P && P.alcanceVar != null && P.alcanceVar < -20) ruim.push(["Alcance caiu", `${pct(Math.abs(P.alcanceVar), 0)} menos contas alcançadas que no período anterior.`]);
      if (reels.length && reels.length < 4) ruim.push(["Poucos vídeos para comparar", `Só ${reels.length} Reels no período: leia estas dicas como pista, não como regra.`]);
    } else if (rede === "youtube") {
      const yt = youtube(J);
      if (yt.views != null) {
        const porDia = yt.views / st.dias;
        bom.push(["Views todos os dias", `Média de ${num(Math.round(porDia))} visualizações por dia no canal, mesmo sem vídeo novo.`]);
        if (yt.viewsVar != null && yt.viewsVar < -15) ruim.push(["Views caindo", `${pct(Math.abs(yt.viewsVar), 0)} menos visualizações que no período anterior.`]);
        if (yt.viewsVar != null && yt.viewsVar >= 10) bom.push(["Views subindo", `${pct(yt.viewsVar, 0)} mais visualizações que no período anterior.`]);
      }
      if (!yt.videos) ruim.push(["Sem vídeo novo", `Nenhum vídeo ou Short publicado nos últimos ${st.dias} dias. Um repost dos Reels como Shorts aproveita o canal que já tem público.`]);
    } else if (!lista.length) ruim.push(["Sem números ainda", "O Metricool ainda não trouxe vídeos do TikTok. Confira a conexão do TikTok no Metricool."]);
    return { bom, ruim };
  }
  function plataformas(J) {
    const rede = st.rede, P = J.P;
    let lista = [], cards = "";
    if (rede === "instagram") {
      lista = [...reelsIG(), ...postsIG()].filter((p) => p.data >= J.de);
      const reels = lista.filter((p) => p.views != null);
      const mediaViews = reels.length ? soma(reels.map((p) => p.views)) / reels.length : null;
      const engs = lista.map(engPost).filter((x) => x != null);
      cards = kpi(0, "Seguidores", num(P && P.seguidores), P && P.novos != null ? `<span class="rs-chip sobe">+${num(P.novos)} · −${num(P.deixaram || 0)}</span>` : "", `no Instagram · ${st.dias} dias`, ICO.pessoas)
        + kpi(1, "Média de visualizações por post", curto(mediaViews), "", `${reels.length} post${reels.length === 1 ? "" : "s"} em ${st.dias} dias`, ICO.play)
        + kpi(3, "Engajamento médio por post", engs.length ? pct(soma(engs) / engs.length) : "sem dado", "", "interações ÷ alcance de cada post", ICO.coracao);
    } else if (rede === "youtube") {
      const yt = youtube(J); lista = yt.lista.filter((p) => p.data >= J.de);
      cards = kpi(0, "Inscritos", num(yt.inscritos), yt.ganhos != null ? `<span class="rs-chip sobe">+${num(yt.ganhos)} · −${num(yt.perdidos || 0)}</span>` : "", `no YouTube · ${st.dias} dias`, ICO.pessoas)
        + kpi(1, "Visualizações", curto(yt.views), chipVar(yt.viewsVar), `em ${st.dias} dias (vídeos antigos também)`, ICO.play)
        + kpi(3, "Vídeos publicados", num(yt.videos), "", `vídeos e Shorts em ${st.dias} dias`, ICO.video);
    } else {
      const tk = tiktok(J); lista = tk.lista.filter((p) => p.data >= J.de);
      cards = kpi(0, "Seguidores", num(tk.seguidores), tk.novos != null ? `<span class="rs-chip sobe">${tk.novos >= 0 ? "+" : ""}${num(tk.novos)}</span>` : "", "no TikTok", ICO.pessoas)
        + kpi(1, "Visualizações", curto(tk.views), chipVar(tk.viewsVar), `em ${st.dias} dias`, ICO.play)
        + kpi(3, "Engajamento", tk.alcance && tk.interacoes != null ? pct(tk.interacoes / tk.alcance * 100) : "sem dado", "", "interações ÷ alcance", ICO.coracao);
    }
    const k = st.ordem;
    const ord = [...lista].sort((a, b) => (k === "data" ? b.data.localeCompare(a.data) : k === "eng" ? (engPost(b) ?? -1) - (engPost(a) ?? -1) : (b.views ?? -1) - (a.views ?? -1)));
    const L = leitura(rede, lista, J);
    const item = (cls, ic, [t, d]) => `<li class="${cls}"><span>${ic}</span><div><b>${esc(t)}</b><p>${esc(d)}</p></div></li>`;
    return `
    <div class="rs-pills" role="tablist">${Object.entries(REDES).map(([r, t]) => `<button type="button" data-rede="${r}" class="${st.rede === r ? "ativo" : ""}" aria-pressed="${st.rede === r}"><i style="background:${COR[r]}"></i>${t}</button>`).join("")}</div>
    <div class="rs-kpis rs-kpis3">${cards}</div>
    <div class="rs-g2 rs-g2-larga">
      <div class="rs-cartao"><div class="rs-cab"><h3>Posts que mais rodaram</h3>
        <div class="rs-ordem"><label for="rs-ordem">Ordenar</label><select id="rs-ordem"><option value="views"${k === "views" ? " selected" : ""}>Mais vistos</option><option value="eng"${k === "eng" ? " selected" : ""}>Mais engajamento</option><option value="data"${k === "data" ? " selected" : ""}>Mais novos</option></select></div></div>
        ${ord.length ? `<div class="rs-tabela-caixa"><table class="rs-tabela"><thead><tr><th>Conteúdo</th><th>Formato</th><th>Visualizações</th><th>Eng.</th></tr></thead><tbody>
          ${ord.slice(0, 10).map((p, i) => `<tr><td><a class="rs-post" href="${esc(p.link)}" target="_blank" rel="noopener">${capa(p)}<span><b>${esc(primeira(p.legenda, 64))}</b><small>#${i + 1} · ${diaBR(p.data)}</small></span></a></td><td><span class="rs-tag">${esc(p.formato)}</span></td><td>${num(p.views)}</td><td>${engPost(p) == null ? "–" : pct(engPost(p))}</td></tr>`).join("")}
        </tbody></table></div>` : `<p class="rs-vazio">Nenhum post ${REDES[rede]} nos últimos ${st.dias} dias${rede === "instagram" ? " (o Metricool lê seus posts desde que foi conectado, em 30/10)" : ""}.</p>`}
      </div>
      <div class="rs-lado">
        <div class="rs-cartao"><div class="rs-cab"><h3>O que está funcionando</h3><span class="rs-cont">${L.bom.length}</span></div>
          ${L.bom.length ? `<ul class="rs-leitura">${L.bom.map((x) => item("bom", ICO.ok, x)).join("")}</ul>` : `<p class="rs-vazio">Ainda sem número suficiente para dizer.</p>`}</div>
        <div class="rs-cartao"><div class="rs-cab"><h3>O que não está funcionando</h3><span class="rs-cont">${L.ruim.length}</span></div>
          ${L.ruim.length ? `<ul class="rs-leitura">${L.ruim.map((x) => item("ruim", ICO.x, x)).join("")}</ul>` : `<p class="rs-vazio">Nada chamando atenção agora.</p>`}</div>
      </div>
    </div>`;
  }

  // ---------- TENDÊNCIAS ----------
  function tendencias() {
    const T = st.tend || {};
    const tags = Array.isArray(T.hashtags) ? T.hashtags : ["ugcbrasil", "achadinhos", "skincare", "cabelo", "maternidade"].map((tag) => ({ tag, ativo: true }));
    const posts = Array.isArray(T.posts) ? T.posts : [], topicos = Array.isArray(T.topicos) ? T.topicos : [];
    const porTag = (t) => posts.filter((p) => p.tag === t).length;
    const topV = [...posts].filter((p) => p.views).sort((a, b) => b.views - a.views)[0];
    const topC = [...posts].sort((a, b) => (b.curtidas || 0) - (a.curtidas || 0))[0];
    const quando = (s) => (s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
    const ocupado = st.buscando || st.analisando || !!(T.run && T.run.id);
    const cartaoTopico = (t) => {
      const provas = (t.provas || []).map((c) => posts.find((p) => p.codigo === c)).filter(Boolean);
      const qtd = posts.filter((p) => p.tag === t.hashtag).length;
      return `<article class="rs-topico">
        <div class="rs-topico-cab"><span class="rs-calor ${t.calor === "Subindo" ? "sub" : ""}">${ICO.fogo}${esc(t.calor)}</span><span class="rs-tag">Instagram</span></div>
        <h4>${esc(t.titulo)}</h4><p>${esc(t.resumo)}</p>
        <p class="rs-topico-hash">${ICO.hash}#${esc(t.hashtag)}${qtd ? ` · ${qtd} posts lidos` : ""}</p>
        ${t.encaixe ? `<div class="rs-encaixe"><b>Seu encaixe:</b> ${esc(t.encaixe)}</div>` : ""}
        ${t.gancho ? `<blockquote>"${esc(t.gancho)}"</blockquote>` : ""}
        ${st.verPosts[t.id] && provas.length ? `<div class="rs-provas">${provas.map((p) => `<a href="${esc(p.link)}" target="_blank" rel="noopener" title="@${esc(p.perfil)}">${p.capa ? `<img src="${esc(p.capa)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<small>${p.views ? curto(p.views) + " views" : num(p.curtidas) + " curtidas"}</small></a>`).join("")}</div>` : ""}
        <div class="rs-topico-pe"><span class="rs-acao">${esc(t.acao)}</span>
          ${provas.length ? `<button type="button" class="btn" data-ver="${esc(t.id)}">${st.verPosts[t.id] ? "Esconder posts" : "Ver posts"}</button>` : ""}
          <button type="button" class="btn btn-principal" data-ideia="${esc(t.id)}"${t.ideiaId ? " disabled" : ""}>${t.ideiaId ? "No banco de ideias" : "Mandar para ideias"}</button></div>
      </article>`;
    };
    return `
    <div class="rs-kpis">
      ${kpi(0, "Tópicos em alta", num(topicos.length), "", topicos.length ? `${topicos.filter((t) => t.calor === "Em alta").length} em alta agora` : "atualize para montar", ICO.fogo)}
      ${kpi(1, "Post mais visto", topV ? curto(topV.views) : "sem dado", "", topV ? `#${esc(topV.tag)} · @${esc(topV.perfil)}` : "nas hashtags que você acompanha", ICO.play)}
      ${kpi(2, "Mais curtido", topC ? curto(topC.curtidas) : "sem dado", "", topC ? `#${esc(topC.tag)} · @${esc(topC.perfil)}` : "nas hashtags que você acompanha", ICO.coracao)}
      ${kpi(3, "Bombou nos perfis", num(st.bombou.length), "", "que você acompanha, 2x ou mais o normal", ICO.coroa)}
    </div>
    <div class="rs-cartao"><div class="rs-cab"><h3>Hashtags acompanhadas</h3><small>${tags.filter((t) => t.ativo).length} ligadas${T.buscadoEm ? ` · lidas em ${quando(T.buscadoEm)}` : ""}</small></div>
      <div class="rs-hashtags">${tags.map((t, i) => `<span class="rs-hash${t.ativo ? "" : " off"}"><button type="button" data-hliga="${i}" title="${t.ativo ? "Pausar" : "Ligar"}">#${esc(t.tag)}<small>${porTag(t.tag) || ""}</small></button><button type="button" class="x" data-htira="${i}" aria-label="Tirar #${esc(t.tag)}">×</button></span>`).join("")}</div>
      <form class="rs-hash-form" id="rs-hash-form"><input class="entrada" id="rs-hash-nova" placeholder="# Adicionar hashtag, ex.: ugcbeleza" autocomplete="off"><button class="btn" type="submit">Adicionar</button>
        <button class="btn btn-principal" type="button" id="rs-atualizar"${ocupado ? " disabled" : ""}>${ICO.atualizar}${st.buscando || (T.run && T.run.id) ? "Lendo as hashtags..." : st.analisando ? "Montando os tópicos..." : "Atualizar tendências"}</button></form>
      <p class="rs-nota">Lê só posts públicos das hashtags (pelo Apify, sem entrar na sua conta) e a IA junta em tópicos para o seu nicho. Gasta poucos créditos do Apify: use 1 vez por semana.${T.erro ? ` <b class="rs-erro">${esc(T.erro)}</b>` : ""}</p>
    </div>
    <div class="rs-cab rs-cab-solta"><h3>Tópicos em alta</h3><small>${T.analisadoEm ? `montados em ${quando(T.analisadoEm)}` : ""}${posts.length && !st.analisando ? ` · <button type="button" class="rs-link" id="rs-reanalisar">montar de novo</button>` : ""}</small></div>
    ${topicos.length ? `<div class="rs-topicos">${topicos.map(cartaoTopico).join("")}</div>` : `<div class="rs-cartao"><p class="rs-vazio">${posts.length ? "Toque em montar de novo para a IA juntar os posts em tópicos." : "Toque em Atualizar tendências para ler as hashtags."}</p></div>`}
    ${st.bombou.length ? `<div class="rs-cab rs-cab-solta"><h3>Bombou nos perfis que você acompanha</h3><small>últimos 14 dias</small></div>
      <div class="rs-bombou">${st.bombou.map((b) => `<a class="rs-bomb" href="${esc(b.link)}" target="_blank" rel="noopener">${b.capa ? `<img src="${esc(b.capa)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : `<span class="rs-capa"><i>${esc((b.perfil || "?")[0])}</i></span>`}
        <span><b>${Number(b.multiplicador).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x o normal</b><small>@${esc(b.perfil)} · ${b.visualizacoes ? curto(b.visualizacoes) + " views" : num(b.curtidas) + " curtidas"}</small>
        ${b.radar && b.radar.gancho ? `<em>"${esc(String(b.radar.gancho).slice(0, 120))}"</em>` : ""}</span></a>`).join("")}</div>` : ""}`;
  }

  // ---------- CALENDÁRIO ----------
  function calendario() {
    const hoje = hojeISO();
    const d = new Date(hoje + "T12:00:00"); const seg = menos(hoje, (d.getDay() + 6) % 7); const dom = menos(seg, -6);
    const C = st.conteudos;
    const pipeline = C.filter((c) => ["Ideia", "Roteirizado", "Para gravar", "Em edição"].includes(c.status));
    const semana = C.filter((c) => c.data >= seg && c.data <= dom && c.status !== "Publicado");
    const prontos = C.filter((c) => c.status === "Pronto");
    const proxGravar = C.filter((c) => c.status === "Para gravar" || (c.data_gravacao && c.data_gravacao >= hoje && c.status !== "Publicado")).sort((a, b) => (a.data_gravacao || a.data || "").localeCompare(b.data_gravacao || b.data || ""))[0];
    const mes = hoje.slice(0, 7);
    const publicados = C.filter((c) => c.status === "Publicado" && String(c.data || "").slice(0, 7) === mes).length;
    const atrasados = C.filter((c) => c.data && c.data < hoje && !["Publicado", "Pronto"].includes(c.status));
    const COLS = [["Ideia", "Sem roteiro"], ["Roteirizado", "Roteirizado"], ["Para gravar", "Para gravar"], ["Em edição", "Em edição"], ["Pronto", "Pronto"]];
    const prox = C.filter((c) => c.data >= hoje && c.data <= menos(hoje, -13) && c.status !== "Publicado");
    const cartao = (c) => `<button type="button" class="rs-pp" data-conteudo="${c.id}"><b>${esc(c.tema || "sem tema")}</b><small>${esc([c.formato, c.funil].filter(Boolean).join(" · "))}</small><span>${c.data ? (c.data < hoje ? `<em class="atraso">${diaBR(c.data)}</em>` : diaBR(c.data)) : "sem data"}</span></button>`;
    return `
    <div class="rs-faixa-info">${ICO.cal}<span>Lido de <b>Conteúdos</b> do painel. Para mudar, use o Quadro de produção ou o Calendário editorial.</span></div>
    <div class="rs-kpis">
      ${kpi(0, "Em produção", num(pipeline.length), "", `${pipeline.filter((c) => c.status === "Roteirizado").length} roteirizados`, ICO.camada)}
      ${kpi(1, "Para esta semana", num(semana.length), "", `${diaBR(seg)} a ${diaBR(dom)}`, ICO.cal)}
      ${kpi(2, "Próxima gravação", proxGravar ? esc(primeira(proxGravar.tema, 22)) : "nada marcado", "", proxGravar ? `${proxGravar.data_gravacao ? "gravar " + diaBR(proxGravar.data_gravacao) : "post de " + diaBR(proxGravar.data)}` : "marque em Conteúdos", ICO.camera)}
      ${kpi(3, "Publicados no mês", num(publicados), "", `${prontos.length} pronto${prontos.length === 1 ? "" : "s"} para postar`, ICO.ok)}
    </div>
    ${atrasados.length ? `<p class="faixa faixa-erro">${atrasados.length} conteúdo${atrasados.length === 1 ? "" : "s"} com data de publicação que já passou e ainda não ${atrasados.length === 1 ? "foi publicado" : "foram publicados"}. Nada foi mudado: confira no Quadro de produção.</p>` : ""}
    <div class="rs-cartao"><div class="rs-cab"><h3>Próximas 2 semanas</h3>
      <div class="rs-botoes"><button type="button" class="btn" data-pc="quadro">Quadro de produção ${ICO.seta}</button><button type="button" class="btn" data-pc="cal">Calendário editorial ${ICO.seta}</button></div></div>
      <div class="rs-pipeline">${COLS.map(([s, t]) => { const l = prox.filter((c) => c.status === s); return `<div class="rs-col"><p><i class="s-${s.replace(/\s/g, "")}"></i>${t}<small>${l.length}</small></p>${l.length ? l.map(cartao).join("") : `<span class="rs-col-vazia">Nada aqui</span>`}</div>`; }).join("")}</div>
    </div>`;
  }

  // ---------- página ----------
  function saudacao() { const h = new Date().getHours(); return h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; }
  function pintar() {
    const sec = $("#aba-metricas"); if (!sec) return;
    const J = janela(st.dias);
    const P = J.P;
    const yt = youtube(J);
    const lido = (st.redes && st.redes.atualizadoEm) || (P && P.atualizadoEm);
    const resumo = P || yt.tem
      ? `@maribonettougc teve ${curto((P && P.views || 0) + (yt.views || 0))} visualizações nos últimos ${st.dias} dias, somando Instagram e YouTube.`
      : "Os números chegam do Metricool uma vez por dia.";
    const ABAS = [["geral", "Visão geral", ICO.olho], ["plataformas", "Plataformas", ICO.camada], ["tendencias", "Tendências", ICO.fogo], ["calendario", "Calendário", ICO.cal]];
    let corpo = "";
    if (st.erro) corpo += `<p class="faixa faixa-erro">Não consegui ler os números: ${esc(st.erro)}</p>`;
    if (st.carregando && !st.ig && !st.redes) corpo += `<div class="rs-carregando">Carregando...</div>`;
    else if (st.aba === "geral") corpo += visaoGeral(J);
    else if (st.aba === "plataformas") corpo += plataformas(J);
    else if (st.aba === "tendencias") corpo += tendencias();
    else corpo += calendario();
    sec.innerHTML = `<div class="rs">
      <div class="rs-topo">
        <div class="rs-conta"><span class="rs-avatar">M</span><div><b>Mari Bonetto UGC</b><small>@maribonettougc</small></div>
          <span class="rs-redes">${Object.keys(REDES).map((r) => `<i style="background:${COR[r]}" title="${REDES[r]}"></i>`).join("")}</span></div>
        <div class="rs-topo-dir">${lido ? `<span class="rs-sync"><i></i>Metricool lido em ${new Date(lido).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>` : ""}
          <a class="btn" href="https://app.metricool.com/" target="_blank" rel="noopener">Abrir o Metricool</a></div>
      </div>
      <div class="rs-cabeca"><div><h2 class="rs-titulo">${saudacao()}, <em>Mari</em></h2><p class="rs-sub">${esc(resumo)} Aqui está o que funciona e o que fazer agora.</p></div>
        ${st.aba !== "calendario" && st.aba !== "tendencias" ? `<div class="rs-periodo" role="group" aria-label="Período">${[7, 30, 90].map((n) => `<button type="button" data-dias="${n}" class="${st.dias === n ? "ativo" : ""}" aria-pressed="${st.dias === n}">${n} dias</button>`).join("")}</div>` : ""}</div>
      <nav class="rs-abas" aria-label="Partes de Redes sociais">${ABAS.map(([k, t, ic]) => `<button type="button" data-rsaba="${k}" class="${st.aba === k ? "ativo" : ""}" aria-current="${st.aba === k ? "page" : "false"}">${ic}${t}</button>`).join("")}</nav>
      ${corpo}
      <p class="rs-rodape">Números do Metricool, parceiro oficial da Meta, lidos 1 vez por dia. Nenhuma ferramenta entra na sua conta do Instagram.</p>
    </div>`;
    ligar(sec);
  }

  async function tendAcao(corpo) {
    const { data, error } = await banco().functions.invoke("tendencias", { body: corpo });
    if (error) { let m = error.message; try { const j = await error.context.json(); m = j.error || m; } catch (e) { /* sem corpo */ } throw new Error(m); }
    if (data && data.error) throw new Error(data.error);
    return data;
  }
  async function salvarHashtags(lista) {
    st.tend = st.tend || {}; st.tend.hashtags = lista; pintar();
    try { const r = await tendAcao({ acao: "hashtags", hashtags: lista }); st.tend.hashtags = r.hashtags; pintar(); }
    catch (e) { toast(String(e.message || e), true); }
  }
  async function atualizarTendencias() {
    st.buscando = true; pintar();
    try {
      await tendAcao({ acao: "buscar" });
      toast("Lendo as hashtags. Leva uns 2 minutos, pode continuar usando o painel.");
      for (let i = 0; i < 24; i++) {
        await new Promise((r) => setTimeout(r, 15000));
        const r = await tendAcao({ acao: "recolher" });
        if (r.pronto) { if (r.erro) throw new Error(r.erro); break; }
      }
      st.tend = await lerChave("redes_tendencias");
      st.buscando = false; await analisarTendencias();
    } catch (e) { toast(String(e.message || e), true); st.buscando = false; st.tend = await lerChave("redes_tendencias").catch(() => st.tend); pintar(); }
  }
  async function analisarTendencias() {
    st.analisando = true; pintar();
    try { await tendAcao({ acao: "analisar" }); st.tend = await lerChave("redes_tendencias"); toast("Tópicos em alta prontos."); }
    catch (e) { toast(String(e.message || e), true); }
    st.analisando = false; pintar();
  }
  async function mandarIdeia(id) {
    const T = st.tend; const t = T && (T.topicos || []).find((x) => x.id === id); if (!t) return;
    const prova = (t.provas || []).map((c) => (T.posts || []).find((p) => p.codigo === c)).filter(Boolean)[0];
    const { data, error } = await banco().from("ideias_organizadas").insert({
      titulo: t.titulo, resumo: t.resumo, gancho: t.gancho || null, texto: [t.resumo, t.encaixe ? "Seu encaixe: " + t.encaixe : ""].filter(Boolean).join("\n\n"),
      finalidade: "Conteúdos", situacao: "desenvolver", link: prova ? prova.link : null, notas: `Tendência #${t.hashtag} (Redes sociais > Tendências)`,
    }).select("id").single();
    if (error) { toast("Não consegui mandar: " + error.message, true); return; }
    t.ideiaId = data.id;
    try { await banco().from("configuracoes").update({ valor: JSON.stringify(T), updated_at: new Date().toISOString() }).eq("chave", "redes_tendencias"); } catch (e) { /* fica só nesta tela */ }
    toast("Foi para o Banco de ideias em Conteúdos."); pintar();
  }
  function irConteudos(parte) {
    try { localStorage.setItem("pc-parte2", parte); } catch (e) { /* sem armazenamento */ }
    location.hash = "planejar";
    setTimeout(() => { try { window.painelConteudos && window.painelConteudos.parte(parte); } catch (e) { /* ainda carregando */ } }, 400);
  }

  function ligar(sec) {
    sec.querySelectorAll("[data-dias]").forEach((b) => b.addEventListener("click", () => { st.dias = Number(b.dataset.dias); gravar("mtDias", st.dias); pintar(); }));
    sec.querySelectorAll("[data-rsaba]").forEach((b) => b.addEventListener("click", () => { st.aba = b.dataset.rsaba; gravar("rsAba", st.aba); pintar(); }));
    sec.querySelectorAll("[data-rede]").forEach((b) => b.addEventListener("click", () => { st.rede = b.dataset.rede; gravar("rsRede", st.rede); pintar(); }));
    const o = $("#rs-ordem", sec); if (o) o.addEventListener("change", () => { st.ordem = o.value; pintar(); });
    sec.querySelectorAll("[data-pc]").forEach((b) => b.addEventListener("click", () => irConteudos(b.dataset.pc)));
    sec.querySelectorAll("[data-conteudo]").forEach((b) => b.addEventListener("click", () => irConteudos("quadro")));
    const tags = () => ((st.tend && st.tend.hashtags) || ["ugcbrasil", "achadinhos", "skincare", "cabelo", "maternidade"].map((tag) => ({ tag, ativo: true }))).map((h) => ({ ...h }));
    sec.querySelectorAll("[data-hliga]").forEach((b) => b.addEventListener("click", () => { const l = tags(); const h = l[Number(b.dataset.hliga)]; h.ativo = !h.ativo; salvarHashtags(l); }));
    sec.querySelectorAll("[data-htira]").forEach((b) => b.addEventListener("click", () => { const l = tags(); l.splice(Number(b.dataset.htira), 1); salvarHashtags(l); }));
    const f = $("#rs-hash-form", sec);
    if (f) f.addEventListener("submit", (e) => {
      e.preventDefault(); const v = $("#rs-hash-nova", sec).value.trim().replace(/^#/, "").toLowerCase().replace(/\s+/g, "");
      if (!v) return; const l = tags(); if (l.some((h) => h.tag === v)) { toast("Essa hashtag já está na lista."); return; }
      if (l.length >= 12) { toast("No máximo 12 hashtags.", true); return; }
      l.push({ tag: v, ativo: true }); salvarHashtags(l);
    });
    const at = $("#rs-atualizar", sec); if (at) at.addEventListener("click", atualizarTendencias);
    const re = $("#rs-reanalisar", sec); if (re) re.addEventListener("click", analisarTendencias);
    sec.querySelectorAll("[data-ver]").forEach((b) => b.addEventListener("click", () => { st.verPosts[b.dataset.ver] = !st.verPosts[b.dataset.ver]; pintar(); }));
    sec.querySelectorAll("[data-ideia]").forEach((b) => b.addEventListener("click", () => { b.disabled = true; mandarIdeia(b.dataset.ideia); }));
    ligarGraficos(sec);
  }

  let tRes = 0;
  window.addEventListener("resize", () => { clearTimeout(tRes); tRes = setTimeout(() => { const sec = $("#aba-metricas"); if (sec && !sec.hidden) pintar(); }, 250); });
  document.addEventListener("painel:aba", (e) => { if (e.detail !== "metricas") return; pintar(); buscar(); });
  if (location.hash.replace("#", "") === "metricas") setTimeout(() => document.dispatchEvent(new CustomEvent("painel:aba", { detail: "metricas" })), 900);
  window.painelMetricas = { st, buscar, pintar };
})();
