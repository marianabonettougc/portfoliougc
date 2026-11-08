// =========================================================
// CONTEÚDO > MÉTRICAS DO INSTAGRAM (#metricas, nov/2026, pedido da Mari)
// Lê os números reais do @maribonettougc pela Edge Function "instagram" (acao "metricas", API oficial da Meta,
// o mesmo token do Dashboard). Nada é inventado: quando a Meta não devolve um número, aparece "sem dado".
// Partes: números do período (com comparação ao período anterior), alcance por dia, quem ela alcança
// (seguidores x não seguidores, visualizações por formato), leitura automática do período, posts com os
// números de cada um (ordenáveis), público e um bloco "Para o mídia kit" com os números prontos para copiar.
// Estilos .mt-* em css/metricas.css. Período escolhido em localStorage "mtDias"; última leitura em "mtCache".
// =========================================================
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n) => (n == null || isNaN(n) ? "sem dado" : Number(n).toLocaleString("pt-BR"));
  const pct = (n, casas = 1) => (n == null || isNaN(n) ? "sem dado" : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }) + "%");
  const curto = (n) => { if (n == null) return "–"; const a = Math.abs(n); return a >= 1e6 ? (n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi" : a >= 1e4 ? (n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil" : Number(n).toLocaleString("pt-BR"); };
  const DIAS_SEM = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const dataBR = (iso) => { const d = new Date(iso); return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); };
  const diaBR = (iso) => { const [a, m, d] = String(iso).slice(0, 10).split("-"); return `${d}/${m}`; };
  const toast = (m, erro) => { const t = $("#toast"); if (!t) return; t.textContent = m; t.classList.toggle("erro", !!erro); t.classList.add("visivel"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("visivel"), 3200); };
  const ler = (k, p) => { try { const v = localStorage.getItem(k); return v == null ? p : JSON.parse(v); } catch (e) { return p; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } };

  const st = { dias: ler("mtDias", 90), dados: null, carregando: false, erro: "", ordem: "data", filtroFmt: "todos" };
  if (![30, 90].includes(st.dias)) st.dias = 90;
  const cacheIni = ler("mtCache", null);
  if (cacheIni && cacheIni.dias === st.dias) st.dados = cacheIni;

  async function buscar(forcar) {
    if (!window.banco) return;
    st.carregando = true; st.erro = ""; pintar();
    try {
      const { data, error } = await window.banco.functions.invoke("instagram", { body: { acao: "metricas", dias: st.dias, forcar: !!forcar } });
      if (error) throw error;
      if (data && data.error && !data.expirado) throw new Error(data.error);
      if (data && data.conectado && !data.totais && !data.expirado) throw new Error("a função do Instagram ainda está na versão antiga (sem as métricas completas).");
      st.dados = data;
      if (data && data.totais) gravar("mtCache", data);
    } catch (e) { st.erro = String(e.message || e); }
    st.carregando = false; pintar();
  }

  // ---------- contas a partir dos posts ----------
  const media = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const mediana = (arr) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  function porFormato(posts) {
    const g = {};
    posts.forEach((p) => { (g[p.formato] = g[p.formato] || []).push(p); });
    return Object.entries(g).map(([f, l]) => ({
      formato: f, qtd: l.length,
      alcance: media(l.filter((p) => p.alcance != null).map((p) => p.alcance)),
      engaj: media(l.filter((p) => p.engaj != null).map((p) => p.engaj)),
      salvos: media(l.filter((p) => p.salvos != null).map((p) => p.salvos)),
      compart: media(l.filter((p) => p.compart != null).map((p) => p.compart)),
    })).sort((a, b) => (b.alcance || 0) - (a.alcance || 0));
  }
  function leitura(d) {
    const posts = d.posts || [], T = d.totais || {}, itens = [];
    const comAlc = posts.filter((p) => p.alcance != null);
    const semanas = d.dias / 7;
    // frequência (meta dela: 3 posts por semana)
    const porSemana = posts.length / semanas;
    itens.push({ tom: porSemana >= 3 ? "bom" : "atencao", titulo: "Frequência", texto: `${posts.length} posts no feed em ${d.dias} dias, cerca de ${porSemana.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por semana. Sua meta é 3 por semana (1 topo + 2 meio de funil).` });
    // formato que mais alcança
    const fm = porFormato(posts).filter((f) => f.alcance != null);
    if (fm.length > 1) itens.push({ tom: "info", titulo: "Formato que mais alcança", texto: `${fm[0].formato}: ${num(Math.round(fm[0].alcance))} contas por post, em média (${fm[0].qtd} ${fm[0].qtd === 1 ? "post" : "posts"}). ${fm.slice(1).map((f) => `${f.formato}: ${num(Math.round(f.alcance))}`).join(" · ")}.` });
    else if (fm.length === 1) itens.push({ tom: "info", titulo: "Formatos", texto: `Todos os posts do período foram ${fm[0].formato}. Testar outro formato (Carrossel ou Foto no feed) ajuda a comparar.` });
    // melhor post e o que ele tem
    if (comAlc.length) {
      const top = [...comAlc].sort((a, b) => b.alcance - a.alcance)[0];
      const med = mediana(comAlc.map((p) => p.alcance));
      const vezes = med ? top.alcance / med : null;
      itens.push({ tom: "bom", titulo: "Post que mais alcançou", texto: `${top.formato} de ${dataBR(top.data)}: ${num(top.alcance)} contas${vezes && comAlc.length > 2 ? `, ${vezes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x a mediana dos seus posts` : ""}. "${esc(String(top.legenda || "").split("\n")[0].slice(0, 90))}"`, link: top.link });
    }
    // não seguidores (descoberta)
    const s = d.alcanceSeguidores, n = d.alcanceNaoSeguidores;
    if (s != null && n != null && s + n > 0) {
      const p = n / (s + n) * 100;
      itens.push({ tom: p >= 50 ? "bom" : "atencao", titulo: "Alcance fora da sua base", texto: `${pct(p, 0)} do alcance veio de quem ainda não te segue. ${p >= 50 ? "Seu conteúdo está sendo descoberto: bom para marcas te encontrarem." : "Para ser descoberta por marcas, vale puxar mais conteúdo de topo de funil (ganchos fortes, trends com produto)."}` });
    }
    // toques no link (conversão do perfil)
    const toques = T.profile_links_taps?.atual, alc = T.reach?.atual;
    if (toques != null) itens.push({ tom: toques > 0 ? "info" : "atencao", titulo: "Toques no link da bio", texto: `${num(toques)} toques no período${alc ? ` (${pct(toques / alc * 100, 2)} de quem foi alcançado)` : ""}. É o caminho até o seu portfólio, então todo post de fundo de funil deve terminar chamando para o link.` });
    // salvos + compartilhamentos (conteúdo útil)
    const sv = T.saves?.atual, sh = T.shares?.atual, it = T.total_interactions?.atual;
    if (sv != null && sh != null && it) itens.push({ tom: "info", titulo: "Salvos e compartilhamentos", texto: `${num(sv)} salvos e ${num(sh)} compartilhamentos, ${pct((sv + sh) / it * 100, 0)} das interações. São os sinais que o Instagram mais valoriza e mostram conteúdo útil (dica, indicação, antes e depois).` });
    // melhor dia
    const dias = {};
    comAlc.forEach((p) => { const k = new Date(p.data).getDay(); (dias[k] = dias[k] || []).push(p.alcance); });
    const rank = Object.entries(dias).filter(([, l]) => l.length >= 2).map(([k, l]) => [Number(k), media(l), l.length]).sort((a, b) => b[1] - a[1]);
    if (rank.length >= 2) itens.push({ tom: "info", titulo: "Dia que mais rende", texto: `Seus posts de ${DIAS_SEM[rank[0][0]]} alcançaram em média ${num(Math.round(rank[0][1]))} contas (${rank[0][2]} posts). Pior dia: ${DIAS_SEM[rank[rank.length - 1][0]]}, ${num(Math.round(rank[rank.length - 1][1]))}.` });
    // seguidores
    if (d.novosSeguidores != null) itens.push({ tom: (d.novosSeguidores - (d.deixaram || 0)) > 0 ? "bom" : "atencao", titulo: "Seguidores", texto: `+${num(d.novosSeguidores)} novos e ${num(d.deixaram || 0)} deixaram de seguir no período. Lembrando: no @maribonettougc o objetivo é fechar com marcas, não número de seguidores.` });
    return itens;
  }

  // ---------- gráfico de alcance por dia (linha com área e dica ao passar) ----------
  function graficoLinha(serie, posts) {
    if (!serie || serie.length < 2) return `<p class="mt-vazio">A Meta não devolveu o alcance por dia neste período.</p>`;
    const larg = ($("#aba-metricas") || {}).clientWidth || 760;
    const W = Math.max(300, Math.round(larg > 860 ? larg * 0.62 - 40 : larg - 36)), H = 220, pe = 40, pd = 12, pt = 14, pb = 26;
    const max = Math.max(...serie.map((x) => x.valor), 1);
    const passo = Math.pow(10, Math.floor(Math.log10(max)));
    const topo = Math.ceil(max / passo) * passo;
    const x = (i) => pe + i * (W - pe - pd) / (serie.length - 1);
    const y = (v) => pt + (H - pt - pb) * (1 - v / topo);
    const linha = serie.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join("");
    const area = `${linha}L${x(serie.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
    const grades = [0, 0.5, 1].map((f) => `<line x1="${pe}" x2="${W - pd}" y1="${y(topo * f)}" y2="${y(topo * f)}" class="mt-grade"/><text x="${pe - 6}" y="${y(topo * f) + 4}" class="mt-eixo" text-anchor="end">${curto(topo * f)}</text>`).join("");
    const nRot = Math.min(W < 500 ? 4 : 6, serie.length);
    const rots = Array.from({ length: nRot }, (_, k) => Math.round(k * (serie.length - 1) / (nRot - 1))).map((i) => `<text x="${x(i)}" y="${H - 6}" class="mt-eixo" text-anchor="middle">${diaBR(serie[i].data)}</text>`).join("");
    const diasPost = new Set((posts || []).map((p) => String(p.data).slice(0, 10)));
    const marcas = serie.map((p, i) => (diasPost.has(p.data) ? `<circle cx="${x(i)}" cy="${y(p.valor)}" r="4" class="mt-ponto-post"/>` : "")).join("");
    return `<div class="mt-graf" data-w="${W}" data-serie='${esc(JSON.stringify(serie.map((p) => [p.data, p.valor, diasPost.has(p.data) ? 1 : 0])))}'>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="aspect-ratio:${W}/${H}" role="img" aria-label="Alcance por dia">
        ${grades}<path d="${area}" class="mt-area"/><path d="${linha}" class="mt-linha"/>${marcas}${rots}
        <line class="mt-cursor" x1="0" x2="0" y1="${pt}" y2="${H - pb}" hidden/><circle class="mt-cursor-p" r="4.5" hidden/>
      </svg><div class="mt-dica" hidden></div></div>
      <p class="mt-legenda-graf"><span class="mt-bolinha"></span> dia com post publicado</p>`;
  }
  function ligarGrafico(raiz) {
    const g = raiz.querySelector(".mt-graf"); if (!g) return;
    const serie = JSON.parse(g.dataset.serie), svg = g.querySelector("svg"), dica = g.querySelector(".mt-dica");
    const cur = svg.querySelector(".mt-cursor"), cp = svg.querySelector(".mt-cursor-p");
    const W = Number(g.dataset.w) || 720, H = 220, pe = 40, pd = 12, pt = 14, pb = 26;
    const max = Math.max(...serie.map((s) => s[1]), 1), passo = Math.pow(10, Math.floor(Math.log10(max))), topo = Math.ceil(max / passo) * passo;
    const mover = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) / r.width * W;
      const i = Math.max(0, Math.min(serie.length - 1, Math.round((px - pe) / ((W - pe - pd) / (serie.length - 1)))));
      const cx = pe + i * (W - pe - pd) / (serie.length - 1), cy = pt + (H - pt - pb) * (1 - serie[i][1] / topo);
      cur.setAttribute("x1", cx); cur.setAttribute("x2", cx); cur.hidden = false; cur.removeAttribute("hidden");
      cp.setAttribute("cx", cx); cp.setAttribute("cy", cy); cp.removeAttribute("hidden");
      dica.innerHTML = `<b>${diaBR(serie[i][0])}</b> ${num(serie[i][1])} contas alcançadas${serie[i][2] ? "<br><small>dia com post</small>" : ""}`;
      dica.hidden = false;
      const esq = cx / W * r.width;
      dica.style.left = Math.min(Math.max(esq, 70), r.width - 70) + "px";
    };
    const sair = () => { cur.setAttribute("hidden", ""); cp.setAttribute("hidden", ""); dica.hidden = true; };
    svg.addEventListener("mousemove", mover); svg.addEventListener("touchmove", mover, { passive: true });
    svg.addEventListener("mouseleave", sair); svg.addEventListener("touchend", sair);
  }

  // barras horizontais simples (público, formatos)
  function barras(lista, total, rotulo = (x) => x.nome) {
    const max = Math.max(...lista.map((x) => x.valor), 1);
    return `<div class="mt-barras">${lista.map((x) => `<div class="mt-barra-l" title="${esc(rotulo(x))}: ${num(x.valor)}">
      <span class="mt-barra-n">${esc(rotulo(x))}</span><span class="mt-barra-t"><i style="width:${(x.valor / max * 100).toFixed(1)}%"></i></span>
      <span class="mt-barra-v">${total ? pct(x.valor / total * 100, 0) : num(x.valor)}</span></div>`).join("")}</div>`;
  }

  function cartaoNumero(rotulo, valor, t, ajuda) {
    const v = t && t.var != null ? t.var : null;
    const seta = v == null ? "" : `<span class="mt-var ${v >= 0 ? "sobe" : "desce"}">${v >= 0 ? "↑" : "↓"} ${pct(Math.abs(v), 0)}</span>`;
    return `<div class="mt-num"><small>${esc(rotulo)}</small><strong>${valor}</strong><span class="mt-num-pe">${seta}${ajuda ? `<em>${ajuda}</em>` : ""}</span></div>`;
  }

  function tabelaPosts(posts) {
    const fmts = ["todos", ...new Set(posts.map((p) => p.formato))];
    let l = st.filtroFmt === "todos" ? [...posts] : posts.filter((p) => p.formato === st.filtroFmt);
    const k = st.ordem;
    l.sort((a, b) => (k === "data" ? String(b.data).localeCompare(String(a.data)) : (b[k] ?? -1) - (a[k] ?? -1)));
    const th = (chave, txt) => `<th><button type="button" data-ordem="${chave}" class="${st.ordem === chave ? "ativo" : ""}">${txt}${st.ordem === chave ? " ↓" : ""}</button></th>`;
    return `<div class="mt-filtros">${fmts.map((f) => `<button type="button" class="mt-chip${st.filtroFmt === f ? " ativo" : ""}" data-fmt="${esc(f)}">${f === "todos" ? "Todos" : esc(f)}</button>`).join("")}</div>
      ${l.length ? `<div class="mt-tabela-caixa"><table class="mt-tabela"><thead><tr><th>Post</th>${th("data", "Data")}${th("alcance", "Alcance")}${th("views", "Visualizações")}${th("engaj", "Engaj.")}${th("curtidas", "Curtidas")}${th("comentarios", "Coment.")}${th("salvos", "Salvos")}${th("compart", "Compart.")}${th("seguiram", "Seguiram")}</tr></thead>
      <tbody>${l.map((p) => `<tr>
        <td><a class="mt-post" href="${esc(p.link)}" target="_blank" rel="noopener">${p.capa ? `<img src="${esc(p.capa)}" alt="" loading="lazy" onerror="this.remove()">` : `<span class="mt-sem-capa"></span>`}<span><b>${esc(p.formato)}</b><small>${esc(String(p.legenda || "sem legenda").split("\n")[0].slice(0, 70))}</small></span></a></td>
        <td>${dataBR(p.data)}</td><td>${num(p.alcance)}</td><td>${num(p.views)}</td><td>${p.engaj == null ? "sem dado" : pct(p.engaj)}</td><td>${num(p.curtidas)}</td><td>${num(p.comentarios)}</td><td>${num(p.salvos)}</td><td>${num(p.compart)}</td><td>${p.seguiram == null ? "–" : num(p.seguiram)}</td></tr>`).join("")}</tbody></table></div>`
        : `<p class="mt-vazio">Nenhum post ${st.filtroFmt === "todos" ? "" : "desse formato "}no período.</p>`}`;
  }

  function midiaKit(d) {
    const posts = d.posts || [];
    const reels = posts.filter((p) => p.formato === "Reels" && p.alcance != null);
    const eng = posts.filter((p) => p.engaj != null).map((p) => p.engaj);
    const idade = (d.publico?.age || [])[0], gen = d.publico?.gender || [];
    const totGen = gen.reduce((a, b) => a + b.valor, 0), fem = gen.find((g) => /^F/i.test(g.nome));
    const linhas = [
      `Seguidores: ${num(d.seguidores)}`,
      reels.length ? `Alcance médio por Reels (${d.dias} dias): ${num(Math.round(media(reels.map((p) => p.alcance))))} contas` : "",
      eng.length ? `Taxa de engajamento média por post: ${pct(media(eng))}` : "",
      d.totais?.views?.atual != null ? `Visualizações em ${d.dias} dias: ${num(d.totais.views.atual)}` : "",
      fem && totGen ? `Público: ${pct(fem.valor / totGen * 100, 0)} mulheres${idade ? `, maioria entre ${idade.nome} anos` : ""}` : "",
    ].filter(Boolean);
    return linhas;
  }

  function pintar() {
    const sec = $("#aba-metricas"); if (!sec) return;
    const d = st.dados;
    const cab = `<div class="mt-topo">
      <div><h2 class="mt-titulo">Métricas do <em>Instagram</em></h2>
        <p class="mt-sub">${d && d.username ? `@${esc(d.username)} · ` : ""}${d && d.de ? `${diaBR(d.de)} a ${diaBR(d.ate)}` : "números oficiais da Meta"}${d && d.atualizadoEm ? ` · atualizado ${new Date(d.atualizadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}</p></div>
      <div class="mt-acoes"><div class="mt-periodo" role="group" aria-label="Período">${[30, 90].map((n) => `<button type="button" data-dias="${n}" class="${st.dias === n ? "ativo" : ""}" aria-pressed="${st.dias === n}">${n} dias</button>`).join("")}</div>
        <button class="btn" type="button" id="mt-atualizar"${st.carregando ? " disabled" : ""}>${st.carregando ? "Buscando..." : "Atualizar"}</button></div></div>`;
    let corpo = "";
    if (st.erro) corpo += `<p class="faixa faixa-erro">Não consegui ler o Instagram: ${esc(st.erro)}</p>`;
    if (d && d.erroMeta && /permission|permiss/i.test(d.erroMeta)) corpo += `<div class="mt-cartao mt-aviso"><h3>Falta uma permissão no token do Instagram</h3>
      <p>A Meta respondeu: <code>${esc(d.erroMeta)}</code>. O token que está salvo lê o perfil, mas não tem a permissão <b>instagram_manage_insights</b>, que libera alcance, visualizações, salvos e público. Por isso o cartão do Instagram no Dashboard também fica vazio.</p>
      <ol><li>Abra o Explorador da Graph API da Meta, no mesmo app que você usou antes.</li><li>Em Permissões, marque <b>instagram_basic</b>, <b>instagram_manage_insights</b>, <b>pages_show_list</b> e <b>pages_read_engagement</b>.</li><li>Clique em Gerar token, escolha a página ligada ao @maribonettougc e autorize.</li><li>Cole o token novo no cartão do Instagram do <a href="#dashboard">Dashboard</a> e volte aqui em Atualizar.</li></ol></div>`;
    else if (d && d.erroMeta) corpo += `<p class="faixa faixa-erro">A Meta não devolveu parte dos números: ${esc(d.erroMeta)}</p>`;
    if (d && d.expirado) corpo += `<p class="faixa faixa-erro">${esc(d.error || "O token do Instagram venceu.")} <a href="#dashboard">Abrir o Dashboard</a></p>`;
    if (d && d.conectado === false) corpo += `<div class="mt-cartao"><h3>Instagram não conectado</h3><p>Conecte o Instagram no cartão do <a href="#dashboard">Dashboard</a> (mesmo token). Depois volte aqui.</p></div>`;
    if (!d && st.carregando) corpo += `<div class="mt-carregando">Buscando seus números na Meta. Com 90 dias isso leva uns 20 segundos...</div>`;
    if (d && d.totais) {
      const T = d.totais;
      const eng = (d.posts || []).filter((p) => p.engaj != null).map((p) => p.engaj);
      const s = d.alcanceSeguidores, n = d.alcanceNaoSeguidores;
      const vf = Object.entries(d.viewsPorFormato || {}).map(([k, v]) => ({ nome: ({ REEL: "Reels", POST: "Foto", CAROUSEL_CONTAINER: "Carrossel", STORY: "Stories", AD: "Anúncio" })[k] || k, valor: v })).filter((x) => x.valor > 0).sort((a, b) => b.valor - a.valor);
      const totVf = vf.reduce((a, b) => a + b.valor, 0);
      const pub = d.publico || {};
      const totIdade = (pub.age || []).reduce((a, b) => a + b.valor, 0), totGen = (pub.gender || []).reduce((a, b) => a + b.valor, 0), totCid = (pub.city || []).reduce((a, b) => a + b.valor, 0);
      const fmts = porFormato(d.posts || []);
      const kit = midiaKit(d);
      corpo += `
      <div class="mt-nums">
        ${cartaoNumero("Seguidores", num(d.seguidores), null, d.novosSeguidores != null ? `+${num(d.novosSeguidores)} · −${num(d.deixaram || 0)}` : "")}
        ${cartaoNumero("Contas alcançadas", curto(T.reach?.atual), T.reach, "vs. período anterior")}
        ${cartaoNumero("Visualizações", curto(T.views?.atual), T.views, "")}
        ${cartaoNumero("Interações", num(T.total_interactions?.atual), T.total_interactions, "")}
        ${cartaoNumero("Engajamento médio", eng.length ? pct(media(eng)) : "sem dado", null, "interações ÷ alcance, por post")}
        ${cartaoNumero("Toques no link", num(T.profile_links_taps?.atual), T.profile_links_taps, "")}
      </div>
      <div class="mt-grade2">
        <div class="mt-cartao mt-largo"><div class="mt-cab"><h3>Alcance por dia</h3><small>contas únicas alcançadas em cada dia</small></div>${graficoLinha(d.alcanceDia, d.posts)}</div>
        <div class="mt-cartao"><div class="mt-cab"><h3>Quem você alcança</h3><small>alcance do período</small></div>
          ${s != null && n != null && s + n > 0 ? `<div class="mt-pilha" role="img" aria-label="Seguidores ${pct(s / (s + n) * 100, 0)}, não seguidores ${pct(n / (s + n) * 100, 0)}"><i class="seg" style="width:${(s / (s + n) * 100).toFixed(1)}%"></i><i class="nao" style="width:${(n / (s + n) * 100).toFixed(1)}%"></i></div>
            <div class="mt-pilha-leg"><span><i class="seg"></i>Seguidores <b>${pct(s / (s + n) * 100, 0)}</b></span><span><i class="nao"></i>Não seguidores <b>${pct(n / (s + n) * 100, 0)}</b></span></div>` : `<p class="mt-vazio">A Meta não separou seguidores e não seguidores neste período.</p>`}
          <h4>Visualizações por formato</h4>${vf.length ? barras(vf, totVf) : `<p class="mt-vazio">Sem dado.</p>`}
        </div>
      </div>
      <div class="mt-cartao"><div class="mt-cab"><h3>Leitura do período</h3><small>calculada com os seus números, sem chute</small></div>
        <ul class="mt-leitura">${leitura(d).map((i) => `<li class="${i.tom}"><b>${esc(i.titulo)}</b><span>${i.texto}${i.link ? ` <a href="${esc(i.link)}" target="_blank" rel="noopener">ver post</a>` : ""}</span></li>`).join("")}</ul></div>
      ${fmts.length ? `<div class="mt-cartao"><div class="mt-cab"><h3>Média por formato</h3><small>por post, no período</small></div>
        <div class="mt-tabela-caixa"><table class="mt-tabela mt-fmt"><thead><tr><th>Formato</th><th>Posts</th><th>Alcance médio</th><th>Engaj. médio</th><th>Salvos</th><th>Compart.</th></tr></thead>
        <tbody>${fmts.map((f) => `<tr><td><b>${esc(f.formato)}</b></td><td>${f.qtd}</td><td>${f.alcance == null ? "sem dado" : num(Math.round(f.alcance))}</td><td>${f.engaj == null ? "sem dado" : pct(f.engaj)}</td><td>${f.salvos == null ? "–" : num(Math.round(f.salvos * 10) / 10)}</td><td>${f.compart == null ? "–" : num(Math.round(f.compart * 10) / 10)}</td></tr>`).join("")}</tbody></table></div></div>` : ""}
      <div class="mt-cartao"><div class="mt-cab"><h3>Seus posts</h3><small>${(d.posts || []).length} no período · toque no título da coluna para ordenar</small></div>${tabelaPosts(d.posts || [])}</div>
      <div class="mt-grade2">
        <div class="mt-cartao"><div class="mt-cab"><h3>Seu público</h3><small>seguidores hoje</small></div>
          ${pub.age && pub.age.length ? `<h4>Idade</h4>${barras([...pub.age].sort((a, b) => a.nome.localeCompare(b.nome)), totIdade)}` : `<p class="mt-vazio">A Meta só mostra o público de contas com 100 seguidores ou mais.</p>`}
          ${pub.gender && pub.gender.length ? `<h4>Gênero</h4>${barras(pub.gender, totGen, (x) => ({ F: "Mulheres", M: "Homens", U: "Não informado" })[x.nome] || x.nome)}` : ""}
          ${pub.city && pub.city.length ? `<h4>Cidades</h4>${barras(pub.city.slice(0, 6), totCid, (x) => x.nome.replace(/, .*$/, ""))}` : ""}
        </div>
        <div class="mt-cartao mt-kit"><div class="mt-cab"><h3>Para o mídia kit</h3><small>números reais, prontos para mandar para a marca</small></div>
          ${kit.length ? `<ul>${kit.map((l) => `<li>${esc(l)}</li>`).join("")}</ul><button class="btn btn-principal" type="button" id="mt-copiar">Copiar números</button>` : `<p class="mt-vazio">Ainda sem números suficientes.</p>`}
        </div>
      </div>`;
    }
    sec.innerHTML = `<div class="mt">${cab}${corpo}</div>`;
    sec.querySelectorAll("[data-dias]").forEach((b) => b.addEventListener("click", () => {
      const n = Number(b.dataset.dias); if (n === st.dias) return;
      st.dias = n; gravar("mtDias", n);
      const c = ler("mtCache", null); st.dados = c && c.dias === n ? c : null;
      buscar(false);
    }));
    const at = $("#mt-atualizar", sec); if (at) at.addEventListener("click", () => buscar(true));
    sec.querySelectorAll("[data-ordem]").forEach((b) => b.addEventListener("click", () => { st.ordem = b.dataset.ordem; pintar(); }));
    sec.querySelectorAll("[data-fmt]").forEach((b) => b.addEventListener("click", () => { st.filtroFmt = b.dataset.fmt; pintar(); }));
    const cp = $("#mt-copiar", sec);
    if (cp) cp.addEventListener("click", async () => {
      const txt = midiaKit(d).join("\n") + `\nFonte: Instagram @${d.username}, ${diaBR(d.de)} a ${diaBR(d.ate)}`;
      try { await navigator.clipboard.writeText(txt); toast("Números copiados."); } catch (e) { toast("Não consegui copiar.", true); }
    });
    ligarGrafico(sec);
  }

  let tRes = 0;
  window.addEventListener("resize", () => { clearTimeout(tRes); tRes = setTimeout(() => { const sec = $("#aba-metricas"); if (sec && !sec.hidden && st.dados) pintar(); }, 250); });
  let jaBuscou = false;
  document.addEventListener("painel:aba", (e) => {
    if (e.detail !== "metricas") return;
    pintar();
    const velho = !st.dados || !st.dados.atualizadoEm || Date.now() - new Date(st.dados.atualizadoEm).getTime() > 30 * 60000;
    if (!jaBuscou || velho) { jaBuscou = true; buscar(false); }
  });
  if (location.hash.replace("#", "") === "metricas") setTimeout(() => { if (!jaBuscou) document.dispatchEvent(new CustomEvent("painel:aba", { detail: "metricas" })); }, 900);
  window.painelMetricas = { st, buscar, pintar };
})();
