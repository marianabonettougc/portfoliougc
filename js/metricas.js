// =========================================================
// CONTEÚDO > MÉTRICAS DO INSTAGRAM (#metricas)
// Desde 10/11/2026 os números vêm do METRICOOL (parceiro oficial da Meta), e não mais da API da Meta
// com token: a Meta restringiu os anúncios da conta em 09/11/2026 e a Mari pediu para tirar tudo
// que pudesse ser visto como suspeito. Os dados ficam em configuracoes chave "metricool_instagram",
// gravados 1x por dia por uma tarefa agendada do Claude (leitor em js/metricool-ig.js).
// Nada é inventado: sem dado aparece "sem dado". Período em localStorage "mtDias".
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

  const st = { dias: ler("mtDias", 30), dados: null, carregando: false, erro: "", ordem: "data" };
  if (![7, 30, 90].includes(st.dias)) st.dias = 30;

  async function buscar() {
    if (!window.banco || !window.metricoolIG) return;
    st.carregando = true; st.erro = ""; pintar();
    try { st.dados = await window.metricoolIG.ler(window.banco); }
    catch (e) { st.erro = String(e.message || e); }
    st.carregando = false; pintar();
  }

  // ---------- gráfico de alcance por dia (linha com área e dica ao passar) ----------
  function graficoLinha(serie, posts) {
    if (!serie || serie.length < 2) return `<p class="mt-vazio">Sem números por dia neste período.</p>`;
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
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="aspect-ratio:${W}/${H}" role="img" aria-label="Visualizações por dia">
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
      dica.innerHTML = `<b>${diaBR(serie[i][0])}</b> ${num(serie[i][1])} visualizações${serie[i][2] ? "<br><small>dia com post</small>" : ""}`;
      dica.hidden = false;
      const esq = cx / W * r.width;
      dica.style.left = Math.min(Math.max(esq, 70), r.width - 70) + "px";
    };
    const sair = () => { cur.setAttribute("hidden", ""); cp.setAttribute("hidden", ""); dica.hidden = true; };
    svg.addEventListener("mousemove", mover); svg.addEventListener("touchmove", mover, { passive: true });
    svg.addEventListener("mouseleave", sair); svg.addEventListener("touchend", sair);
  }

  function cartaoNumero(rotulo, valor, t, ajuda) {
    const v = t && t.var != null ? t.var : null;
    const seta = v == null ? "" : `<span class="mt-var ${v >= 0 ? "sobe" : "desce"}">${v >= 0 ? "↑" : "↓"} ${pct(Math.abs(v), 0)}</span>`;
    return `<div class="mt-num"><small>${esc(rotulo)}</small><strong>${valor}</strong><span class="mt-num-pe">${seta}${ajuda ? `<em>${ajuda}</em>` : ""}</span></div>`;
  }

  const OFICIAIS = `<div class="mt-cartao"><div class="mt-cab"><h3>Ver mais detalhes em lugares oficiais</h3><small>sem token, sem programa, sem risco para a conta</small></div>
    <ul class="mt-leitura">
      <li class="info"><b>Metricool</b><span>Parceiro oficial da Meta. É de onde vêm os números desta página. <a href="https://app.metricool.com/" target="_blank" rel="noopener">Abrir o Metricool</a></span></li>
      <li class="info"><b>Painel profissional do Instagram</b><span>No app do Instagram: seu perfil, botão <b>Painel profissional</b>, depois <b>Insights</b>.</span></li>
      <li class="info"><b>Meta Business Suite</b><span>O painel da própria Meta. <a href="https://business.facebook.com/latest/insights/" target="_blank" rel="noopener">Abrir os Insights</a></span></li>
    </ul></div>`;

  function pintar() {
    const sec = $("#aba-metricas"); if (!sec) return;
    const P = st.dados ? window.metricoolIG.periodo(st.dados, st.dias) : null;
    const cab = `<div class="mt-topo">
      <div><h2 class="mt-titulo">Métricas do <em>Instagram</em></h2>
        <p class="mt-sub">${P && P.username ? `@${esc(P.username)} · ` : ""}${P ? `${diaBR(P.de)} a ${diaBR(P.ate)} · ` : ""}pelo Metricool, parceiro oficial da Meta${P && P.atualizadoEm ? ` · lido em ${new Date(P.atualizadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}</p></div>
      <div class="mt-acoes"><div class="mt-periodo" role="group" aria-label="Período">${[7, 30, 90].map((n) => `<button type="button" data-dias="${n}" class="${st.dias === n ? "ativo" : ""}" aria-pressed="${st.dias === n}">${n} dias</button>`).join("")}</div></div></div>`;
    let corpo = "";
    if (st.erro) corpo += `<p class="faixa faixa-erro">Não consegui ler os números: ${esc(st.erro)}</p>`;
    if (!P && st.carregando) corpo += `<div class="mt-carregando">Carregando...</div>`;
    if (!P && !st.carregando && !st.erro) corpo += `<div class="mt-cartao"><h3>Ainda sem números</h3><p>Os números chegam do Metricool uma vez por dia. Se não aparecerem até amanhã, peça ao Claude para conferir a tarefa "Instagram pelo Metricool".</p></div>`;
    if (P) {
      const comAlc = P.reels.filter((r) => r.alcance != null);
      const melhor = comAlc.length ? [...comAlc].sort((a, b) => b.alcance - a.alcance)[0] : null;
      const k = st.ordem;
      const reels = [...P.reels].sort((a, b) => (k === "data" ? b.data.localeCompare(a.data) : (b[k] ?? -1) - (a[k] ?? -1)));
      const th = (c, t) => `<th><button type="button" data-ordem="${c}" class="${st.ordem === c ? "ativo" : ""}">${t}${st.ordem === c ? " ↓" : ""}</button></th>`;
      corpo += `
      <div class="mt-nums">
        ${cartaoNumero("Seguidores", num(P.seguidores), null, P.novos != null ? `+${num(P.novos)} · −${num(P.deixaram || 0)} no período` : "")}
        ${cartaoNumero("Contas alcançadas", curto(P.alcance), { var: P.alcanceVar }, P.alcanceDesde && P.alcanceDesde > P.de ? `só desde ${diaBR(P.alcanceDesde)}` : "soma por dia")}
        ${cartaoNumero("Visualizações", curto(P.views), { var: P.viewsVar }, "")}
        ${cartaoNumero("Interações", num(P.interacoes), { var: P.interacoesVar }, "feed + Reels")}
        ${cartaoNumero("Contas engajadas", num(P.engajadas), null, P.engajamento != null ? `${pct(P.engajamento)} do alcance` : "")}
        ${cartaoNumero("Posts no período", num(P.posts), null, "feed + Reels")}
      </div>
      <div class="mt-cartao"><div class="mt-cab"><h3>Visualizações por dia</h3><small>tudo o que foi visto no perfil em cada dia</small></div>${graficoLinha(P.viewsDia, P.reels)}</div>
      ${melhor ? `<div class="mt-cartao"><div class="mt-cab"><h3>Reels que mais alcançou</h3><small>no período</small></div><p>${num(melhor.alcance)} contas e ${num(melhor.views)} visualizações em ${diaBR(melhor.data)}. "${esc(melhor.legenda.split("\n")[0].slice(0, 100))}" <a href="${esc(melhor.link)}" target="_blank" rel="noopener">ver</a></p></div>` : ""}
      <div class="mt-cartao"><div class="mt-cab"><h3>Seus Reels</h3><small>${P.reels.length} no período · toque no título da coluna para ordenar</small></div>
        ${reels.length ? `<div class="mt-tabela-caixa"><table class="mt-tabela"><thead><tr><th>Reels</th>${th("data", "Data")}${th("alcance", "Alcance")}${th("views", "Visualizações")}${th("interacoes", "Interações")}${th("salvos", "Salvos")}${th("compart", "Compart.")}</tr></thead>
        <tbody>${reels.map((r) => `<tr><td><a class="mt-post" href="${esc(r.link)}" target="_blank" rel="noopener"><span><small>${esc(r.legenda.split("\n")[0].slice(0, 70) || "sem legenda")}</small></span></a></td><td>${diaBR(r.data)}</td><td>${num(r.alcance)}</td><td>${num(r.views)}</td><td>${num(r.interacoes)}</td><td>${num(r.salvos)}</td><td>${num(r.compart)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="mt-vazio">Nenhum Reels no período.</p>`}</div>`;
    }
    corpo += OFICIAIS;
    sec.innerHTML = `<div class="mt">${cab}${corpo}</div>`;
    sec.querySelectorAll("[data-dias]").forEach((b) => b.addEventListener("click", () => { st.dias = Number(b.dataset.dias); gravar("mtDias", st.dias); pintar(); }));
    sec.querySelectorAll("[data-ordem]").forEach((b) => b.addEventListener("click", () => { st.ordem = b.dataset.ordem; pintar(); }));
    ligarGrafico(sec);
  }

  let tRes = 0;
  window.addEventListener("resize", () => { clearTimeout(tRes); tRes = setTimeout(() => { const sec = $("#aba-metricas"); if (sec && !sec.hidden && st.dados) pintar(); }, 250); });
  document.addEventListener("painel:aba", (e) => { if (e.detail !== "metricas") return; pintar(); buscar(); });
  if (location.hash.replace("#", "") === "metricas") setTimeout(() => document.dispatchEvent(new CustomEvent("painel:aba", { detail: "metricas" })), 900);
  window.painelMetricas = { st, buscar, pintar };
})();
