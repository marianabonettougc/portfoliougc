/* Analytics do portfólio Mari Bonetto
 * Identificador aleatório por navegador; sem nome, e-mail ou IP.
 * Registra: vídeos iniciados, segundos assistidos, tempo no site, cliques e partes do site vistas.
 * Navegador da Mari (marcado pelo painel ou pelo link ?sou-a-mari) não registra nada.
 */
(function () {
  "use strict";
  const KEY = "mb_portfolio_visitor_v1";
  try {
    // abrir o site uma vez com ?sou-a-mari marca este navegador como da Mari (ex.: o navegador do Instagram no celular dela)
    if (/[?&]sou-a-mari\b/.test(location.search)) localStorage.setItem("mb_nao_contar_visita", "1");
  } catch (e) {}
  function visitorId() {
    try {
      let id = localStorage.getItem(KEY);
      if (!id) {
        id = (crypto && crypto.randomUUID) ? crypto.randomUUID() :
          "mb-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
        localStorage.setItem(KEY, id);
      }
      return id;
    } catch (e) { return null; }
  }
  const id = visitorId();
  const daMari = () => { try { return !!localStorage.getItem("mb_nao_contar_visita"); } catch (e) { return false; } };
  const novoId = () => (crypto && crypto.randomUUID) ? crypto.randomUUID() : "r-" + Date.now().toString(36) + Math.random().toString(36).slice(2);
  function client() { return window.banco || null; }
  function linhaDe(evento, dados) {
    return Object.assign({ evento, visitante_id: id, pagina: location.pathname || "/" }, dados || {});
  }
  async function enviar(evento, dados) {
    const db = client();
    if (!db || !id || daMari()) return;
    try { await db.from("portfolio_eventos").insert(linhaDe(evento, dados)); }
    catch (e) { console.info("Evento do portfólio não registrado.", e); }
  }
  // quando a pessoa fecha a aba, o envio normal pode ser cortado: este usa keepalive
  function enviarSaindo(evento, dados) {
    if (!id || daMari() || !window.BANCO_URL || !window.BANCO_CHAVE) return;
    try {
      fetch(window.BANCO_URL + "/rest/v1/portfolio_eventos", {
        method: "POST", keepalive: true,
        headers: { "apikey": window.BANCO_CHAVE, "Content-Type": "application/json", "Prefer": "return=minimal" },
        body: JSON.stringify(linhaDe(evento, dados))
      }).catch(() => {});
    } catch (e) {}
  }

  // ---- tempo assistido: o player chama inicio/tique/fim ----
  let atual = null; // { rid, video, seg, enviado }
  function dadosVideo(video) {
    return {
      video_titulo: String(video && video.titulo || "Vídeo").slice(0, 180),
      video_marca: String(video && video.marca || "").slice(0, 120),
      video_link: String(video && video.link || "").slice(0, 500)
    };
  }
  function mandarTempo(saindo) {
    if (!atual) return;
    const seg = Math.round(atual.seg);
    if (seg < 1 || seg === atual.enviado) return;
    atual.enviado = seg;
    const linha = Object.assign(dadosVideo(atual.video), { segundos: Math.min(seg, 7200), reproducao_id: atual.rid, alvo: "Tempo assistido" });
    if (saindo) enviarSaindo("video_tempo", linha); else enviar("video_tempo", linha);
  }

  window.MBAnalytics = {
    visitorId: id,
    daMari,
    videoPlay: (video) => {
      atual = { rid: novoId(), video, seg: 0, enviado: 0 };
      enviar("video_play", Object.assign(dadosVideo(video), { alvo: "Player de vídeo", reproducao_id: atual.rid }));
    },
    // chamado a cada fração de segundo enquanto o vídeo está tocando
    videoTocou: (segundos) => { if (atual && segundos > 0 && segundos < 2) atual.seg += segundos; },
    videoFim: () => { mandarTempo(false); atual = null; }
  };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") mandarTempo(true); });
  window.addEventListener("pagehide", () => mandarTempo(true));

  // ---- tempo no site: segundos com a página aberta na tela e a pessoa mexendo (ou um vídeo tocando) ----
  // uma linha "tempo_site" por visita (reproducao_id = id da visita); o painel usa o maior valor de cada visita
  const visita = { rid: novoId(), seg: 0, enviado: 0, mexeu: Date.now() };
  ["scroll", "pointerdown", "pointermove", "keydown", "touchstart", "wheel"].forEach((ev) =>
    window.addEventListener(ev, () => { visita.mexeu = Date.now(); }, { passive: true, capture: true }));
  function mandarTempoSite(saindo) {
    const seg = Math.min(Math.round(visita.seg), 7200);
    if (seg < 3 || seg === visita.enviado) return;
    visita.enviado = seg;
    const linha = { segundos: seg, reproducao_id: visita.rid, alvo: "Tempo no site" };
    if (saindo) enviarSaindo("tempo_site", linha); else enviar("tempo_site", linha);
  }
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - visita.mexeu > 120000 && !atual) return; // parada há 2 min e sem vídeo: não conta
    visita.seg += 1;
    const s = Math.round(visita.seg);
    if (s === 15 || s === 60 || (s > 60 && s % 60 === 0)) mandarTempoSite(false);
  }, 1000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") mandarTempoSite(true); else visita.mexeu = Date.now(); });
  window.addEventListener("pagehide", () => mandarTempoSite(true));

  // ---- cliques em links e botões ----
  document.addEventListener("click", function (e) {
    const link = e.target && e.target.closest ? e.target.closest("a[href],button") : null;
    if (!link) return;
    if (link.closest("#janela") || link.closest("#admin") || link.closest("[data-analytics-ignore]")) return;
    const href = link.getAttribute("href") || "";
    const alvo = (link.getAttribute("data-analytics") || link.getAttribute("aria-label") ||
      link.innerText || link.textContent || href || "Clique").trim().replace(/\s+/g, " ").slice(0,120);
    if (!alvo) return;
    enviar("click", { alvo, destino: href.slice(0,500) });
  }, true);

  // ---- partes do site vistas (uma vez por parte em cada visita) ----
  const NOMES = {
    inicio: "Capa", numeros: "Meus números", sobre: "Sobre mim", destaques: "Destaques", servicos: "Serviços",
    trabalhos: "Meus trabalhos (vídeos)", fotos: "Mural de fotos", marcas: "Marcas que já trabalhei",
    feedbacks: "Depoimentos", processo: "Hora de criar", valores: "Valores", contato: "Contato"
  };
  function vigiarSecoes() {
    if (!("IntersectionObserver" in window)) return;
    const vistas = new Set();
    const obs = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => {
        if (!en.isIntersecting) return;
        // parte alta (maior que a tela) conta quando ocupa metade da tela
        if (en.intersectionRatio < 0.35 && en.intersectionRect.height < window.innerHeight * 0.5) return;
        const sid = en.target.id;
        if (vistas.has(sid)) return;
        vistas.add(sid);
        obs.unobserve(en.target);
        enviar("secao", { alvo: NOMES[sid] || sid });
      });
    }, { threshold: [0, 0.1, 0.2, 0.35, 0.5] });
    Object.keys(NOMES).forEach((sid) => { const el = document.getElementById(sid); if (el && !el.hidden) obs.observe(el); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(vigiarSecoes, 1200));
  else setTimeout(vigiarSecoes, 1200);
})();
