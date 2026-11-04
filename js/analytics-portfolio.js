/* Analytics do portfólio Mari Bonetto
 * Identificador aleatório por navegador; sem nome, e-mail ou IP.
 */
(function () {
  "use strict";
  const KEY = "mb_portfolio_visitor_v1";
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
  function client() { return window.banco || null; }
  async function enviar(evento, dados) {
    const db = client();
    if (!db || !id) return;
    try {
      const linha = Object.assign({ evento, visitante_id: id, pagina: location.pathname || "/" }, dados || {});
      await db.from("portfolio_eventos").insert(linha);
    } catch (e) { console.info("Evento do portfólio não registrado.", e); }
  }
  window.MBAnalytics = {
    visitorId: id,
    videoPlay: (video) => enviar("video_play", {
      video_titulo: String(video && video.titulo || "Vídeo").slice(0,180),
      video_link: String(video && video.link || "").slice(0,500),
      alvo: "Player de vídeo"
    })
  };
  document.addEventListener("click", function (e) {
    const link = e.target && e.target.closest ? e.target.closest("a[href],button[data-analytics]") : null;
    if (!link) return;
    if (link.closest("#janela") || link.closest("#admin") || link.closest("[data-analytics-ignore]")) return;
    const href = link.getAttribute("href") || "";
    const alvo = (link.getAttribute("data-analytics") || link.getAttribute("aria-label") ||
      link.innerText || link.textContent || href || "Clique").trim().replace(/\\s+/g, " ").slice(0,120);
    if (!alvo) return;
    enviar("click", { alvo, destino: href.slice(0,500) });
  }, true);
})();
