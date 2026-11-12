// =========================================================
// REFERÊNCIAS > BIBLIOTECA ÚNICA (hash #central)
// Junta numa lista só as referências que moram em lugares diferentes, sem
// mudar de lugar nenhum dado:
// - roteiros (de_quem "outra"): vídeos transcritos na página Transcrever vídeo
// - laboratorio: Salvos do Instagram (o programa de salvos continua igual)
// - inspiracoes: o feed de inspirações do Dashboard (Apify)
// - biblioteca: posts dos Perfis que acompanho que já têm transcrição
// Cada referência abre uma janela com:
// - Transcrever (função transcrever; a transcrição fica guardada nela mesma)
// - Analisar com a Skill (função skill-ugc acao "analisar"); com "Analisar cenas e voz" ligado
//   (js/analise-video.js, mesma escolha da página Análise de transcrição) também assiste o vídeo
//   e ouve a voz, guardado em cenasVoz dentro da análise. Separa o que está
//   no vídeo (observado) da leitura da IA (interpretação). Fica guardada em
//   roteiros.analise_skill, laboratorio.analise, inspiracoes.analise ou
//   biblioteca.analise.skill (a análise antiga dos perfis continua lá)
// - Criar roteiro com a Skill: abre Meus roteiros (aplicativo) com a referência;
//   o roteiro guarda a origem {tipo:"referencia", fonte, id}
// - Roteiros criados a partir dela (lidos de app_state.data.roteiros)
// O js/admin.js (desenharGrade) pede a lista por window.painelReferencias.
// Também cria window.painelSkill, usado por Referências e Conteúdos para
// mandar pedidos ao aplicativo (localStorage "skillPendente" + postMessage).
// =========================================================
(function () {
  "use strict";
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const banco = () => window.banco;
  const FONTES = { roteiros: "Transcritos", laboratorio: "Salvos do Instagram", inspiracoes: "Inspirações", biblioteca: "Perfis que acompanho" };
  const st = { extras: [], carregado: false, carregando: null };

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

  // ---------- pedidos para o aplicativo (Meus roteiros) ----------
  function enviarAoApp(pedido) {
    try { localStorage.setItem("skillPendente", JSON.stringify({ ...pedido, quando: Date.now() })); }
    catch (e) { toast("O navegador não deixou abrir Meus roteiros. Tente de novo.", true); return false; }
    const botao = document.querySelector('.menu-item[data-aba="quadro"]');
    if (botao) botao.click(); else location.hash = "#quadro";
    [400, 1200, 2500, 4500].forEach((ms) => setTimeout(() => { const f = document.querySelector("#aba-gestao iframe"); if (f && f.contentWindow) f.contentWindow.postMessage({ skillPendente: true }, location.origin); }, ms));
    return true;
  }
  window.painelSkill = {
    criarRoteiro: (p) => enviarAoApp({ tipo: "criar", referencia: p.referencia || null, conteudoId: p.conteudoId || null, ideia: p.ideia || "", inicial: p.inicial || null }),
    abrirRoteiro: (id) => enviarAoApp({ tipo: "abrir", id: String(id) }),
  };

  // ---------- leitura das bibliotecas ----------
  const origemDoLink = (l) => /tiktok\./i.test(l) ? "tiktok" : /instagram\./i.test(l) ? "instagram" : /youtu/i.test(l) ? "youtube" : "outro";
  const tituloDe = (x) => x.titulo || (x.ideia && x.ideia.titulo) || String(x.legenda || "").split("\n")[0].slice(0, 90) || ("Vídeo de @" + String(x.perfil || "").replace(/^@/, ""));
  async function carregar(forcar) {
    if (st.carregando && !forcar) return st.carregando;
    st.carregando = (async () => {
      const b = banco(); if (!b) return [];
      const ler = (p) => p.then(({ data }) => data || []).catch(() => []);
      const [lab, insp, bib] = await Promise.all([
        ler(b.from("laboratorio").select("id,link,perfil,tipo,legenda,transcricao,analise,ideia,capa,colecao,salvo_em,criado_em").order("salvo_em", { ascending: false, nullsFirst: false }).limit(3000)),
        ler(b.from("inspiracoes").select("id,rede,link,perfil,legenda,transcricao,analise,capa,publicado_em,criado_em").eq("oculto", false).order("publicado_em", { ascending: false, nullsFirst: false }).limit(1000)),
        ler(b.from("biblioteca").select("id,rede,link,perfil,legenda,transcricao,analise,capa,publicado_em,criado_em").not("transcricao", "is", null).order("publicado_em", { ascending: false, nullsFirst: false }).limit(1000)),
      ]);
      st.extras = [
        ...lab.map((x) => ({ ...x, fonte: "laboratorio", criado_em: x.salvo_em || x.criado_em })),
        ...insp.map((x) => ({ ...x, fonte: "inspiracoes", criado_em: x.publicado_em || x.criado_em })),
        ...bib.map((x) => ({ ...x, fonte: "biblioteca", criado_em: x.publicado_em || x.criado_em })),
      ].map((x) => ({ ...x, titulo: tituloDe(x), origem: origemDoLink(x.link || "") }));
      st.carregado = true;
      return st.extras;
    })();
    const r = await st.carregando; st.carregando = null; return r;
  }
  // análise da Skill de cada biblioteca
  const analiseSkill = (x) => x.fonte === "roteiros" ? x.analise_skill : x.fonte === "biblioteca" ? (x.analise || {}).skill : (x.analise && x.analise.observado ? x.analise : null);

  // ---------- roteiros que saíram desta referência ----------
  async function roteirosDaReferencia(x) {
    try {
      const { data: { session } } = await banco().auth.getSession();
      const { data } = await banco().from("app_state").select("data").eq("user_id", session.user.id).maybeSingle();
      const lista = (data && data.data && data.data.roteiros) || [];
      return lista.filter((r) => (r.origem && r.origem.tipo === "referencia" && r.origem.fonte === x.fonte && String(r.origem.id) === String(x.id)) || (x.link && r.referencia && r.referencia === x.link));
    } catch (e) { return []; }
  }

  // ---------- ações ----------
  async function invocar(nome, corpo) {
    const { data, error } = await banco().functions.invoke(nome, { body: corpo });
    let msg = data && (data.error || data.erro);
    if (error) { try { const j = await error.context.json(); msg = j.error || j.erro; } catch (e) { /* sem corpo */ } msg = msg || "Não consegui agora. Tente de novo em instantes."; }
    if (msg) throw new Error(msg);
    return data;
  }
  async function gravar(x, campos) {
    const { error } = await banco().from(x.fonte).update(campos).eq("id", x.id);
    if (error) throw new Error("Não consegui guardar: " + error.message);
    Object.assign(x, campos);
  }
  async function transcrever(x) {
    if (!x.link) throw new Error("Essa referência não tem link para transcrever.");
    const d = await invocar("transcrever", { link: x.link });
    if (!d.transcricao) throw new Error("Não encontrei fala nesse vídeo.");
    const campos = { transcricao: d.transcricao };
    if (x.fonte === "roteiros" && d.duracao) campos.duracao = d.duracao;
    if (x.fonte === "inspiracoes") campos.transcrito = true;
    await gravar(x, campos);
    if (d.duracao) x._duracao = d.duracao;
  }
  async function analisar(x, aoProgresso) {
    const av = window.painelAnaliseVideo;
    const comCenas = !!(av && av.ligado());
    aoProgresso && aoProgresso("Analisando com a Skill...");
    const d = await invocar("skill-ugc", { acao: "analisar", transcricao: x.transcricao || "", legenda: x.legenda || "", perfil: x.perfil || "", duracao_seg: x.duracao || x._duracao || 0 });
    const a = d.analise;
    // "Analisar cenas e voz" ligado: assiste o vídeo e ouve a voz também (guardado junto, em cenasVoz)
    if (a && comCenas) {
      const antes = analiseSkill(x);
      const cv = await av.cenasEVoz({ ...x, video_path: x.video_path || (antes && antes.cenasVoz && antes.cenasVoz.video_path) || "" }, aoProgresso);
      a.cenasVoz = cv;
    }
    if (x.fonte === "roteiros") await gravar(x, { analise_skill: a });
    else if (x.fonte === "biblioteca") await gravar(x, { analise: { ...(x.analise || {}), skill: a } });
    else await gravar(x, { analise: a });
  }
  function criarRoteiro(x) {
    const a = analiseSkill(x);
    const ref = { fonte: x.fonte, id: x.id, link: x.link || "", titulo: x.titulo, perfil: x.perfil || "", legenda: String(x.legenda || "").slice(0, 600), transcricao: String(x.transcricao || "").slice(0, 2500), gancho: x.gancho || (a && a.observado && a.observado.gancho) || "", analise_skill: a || null };
    fechar();
    window.painelSkill.criarRoteiro({ referencia: ref });
  }

  // ---------- janela da referência ----------
  function fechar() { const j = $("#rf-janela"); if (j) j.remove(); document.removeEventListener("keydown", teclaEsc); }
  function teclaEsc(e) { if (e.key === "Escape") fechar(); }
  const lista = (v) => (v || []).map((i) => `<li>${esc(i)}</li>`).join("");
  function htmlAnalise(a) {
    if (!a) return "";
    const o = a.observado || {}, i = a.interpretacao || {};
    const linha = (t, v) => v ? `<dt>${t}</dt><dd>${esc(v)}</dd>` : "";
    return `<div class="rf-analise">
      <section><h4>O que está no vídeo</h4><dl>${linha("Gancho", o.gancho)}${linha("Tipo de gancho", o.gancho_tipo)}${linha("Estrutura", o.estrutura)}${linha("Formato", o.formato)}${linha("Ritmo", o.ritmo)}${linha("Demonstração", o.demonstracao)}${(o.argumentos || []).length ? `<dt>Argumentos</dt><dd><ul>${lista(o.argumentos)}</ul></dd>` : ""}${linha("CTA", o.cta)}</dl></section>
      <section class="rf-ia"><h4>Leitura da IA <small>(hipótese)</small></h4><dl>${linha("Por que funciona", i.por_que_funciona)}${linha("Para quem", i.publico)}${linha("O que a pessoa sente", i.emocao)}${(i.pontos_fracos || []).length ? `<dt>O que a Skill reprovaria</dt><dd><ul>${lista(i.pontos_fracos)}</ul></dd>` : ""}${linha("Como você usa sem copiar", i.como_adaptar)}</dl></section>
      ${(a.ideias || []).length ? `<section class="rf-ideias"><h4>Ideias para você</h4><ul>${lista(a.ideias)}</ul></section>` : ""}
      ${a.cenasVoz && window.painelAnaliseVideo ? window.painelAnaliseVideo.htmlCenasVoz(a.cenasVoz) : ""}
      ${a.skill ? `<p class="rf-versao">Analisado pela Skill ${esc(a.skill)}${a.em ? " em " + new Date(a.em).toLocaleDateString("pt-BR") : ""}</p>` : ""}
    </div>`;
  }
  async function abrir(x) {
    fechar();
    const j = document.createElement("div");
    j.id = "rf-janela"; j.className = "rf-fundo";
    document.body.appendChild(j);
    document.addEventListener("keydown", teclaEsc);
    j.addEventListener("mousedown", (e) => { if (e.target === j) fechar(); });
    const pintar = (ocupado, gerados) => {
      const a = analiseSkill(x);
      j.innerHTML = `<div class="rf-caixa" role="dialog" aria-modal="true" aria-label="${esc(x.titulo)}">
        <button type="button" class="rf-fechar" aria-label="Fechar">×</button>
        <header class="rf-topo">
          ${x.capa ? `<img src="${esc(x.capa)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
          <div><span class="rf-fonte">${esc(FONTES[x.fonte] || "")}</span><h3>${esc(x.titulo)}</h3>
            <p>${x.perfil ? "@" + esc(String(x.perfil).replace(/^@/, "")) : ""}${x.link ? ` · <a href="${esc(x.link)}" target="_blank" rel="noopener">abrir o vídeo</a>` : ""}${x.colecao ? " · pasta " + esc(x.colecao) : ""}</p></div>
        </header>
        ${!x.video_path && a && a.cenasVoz && a.cenasVoz.video_path ? `<div class="rf-video"><video data-video-path="${esc(a.cenasVoz.video_path)}" controls playsinline preload="metadata"></video></div>` : ""}
        ${x.video_path ? `<div class="rf-video"><video data-video-path="${esc(x.video_path)}" controls playsinline preload="metadata"></video><button type="button" class="btn-texto" data-baixar-video>Baixar o vídeo guardado</button></div>` : ""}
        <div class="rf-acoes">
          <button type="button" class="btn btn-principal" data-criar>Criar roteiro com a Skill</button>
          <button type="button" class="btn" data-transcrever ${ocupado ? "disabled" : ""}>${ocupado === "transcrever" ? "Transcrevendo (até 1 minuto)..." : x.transcricao ? "Transcrever de novo" : "Transcrever"}</button>
          <button type="button" class="btn" data-analisar ${ocupado || !(x.transcricao || x.legenda) ? "disabled" : ""}>${ocupado === "analisar" ? "Analisando..." : a ? "Analisar de novo" : "Analisar com a Skill"}</button>
          ${window.painelAnaliseVideo ? window.painelAnaliseVideo.chaveHtml() : ""}
          ${x.fonte === "roteiros" ? `<button type="button" class="btn-texto" data-antiga>Ver página completa da análise</button>` : ""}
        </div>
        ${x.legenda ? `<details class="rf-bloco"><summary>Legenda</summary><p>${esc(x.legenda)}</p></details>` : ""}
        <details class="rf-bloco"${x.transcricao && !a ? " open" : ""}><summary>Transcrição${x.transcricao ? "" : " (ainda não tem)"}</summary>${x.transcricao ? `<p class="rf-transcricao">${esc(x.transcricao)}</p>` : `<p class="rf-vazio">Toque em Transcrever: a transcrição fica guardada nesta referência.</p>`}</details>
        ${a ? htmlAnalise(a) : `<p class="rf-vazio">${x.transcricao ? "Ainda sem análise da Skill." : "Transcreva primeiro para a Skill analisar o vídeo."}</p>`}
        <section class="rf-gerados"><h4>Roteiros criados a partir daqui</h4>${gerados == null ? `<p class="rf-vazio">Procurando...</p>` : gerados.length ? `<ul>${gerados.map((r) => `<li><button type="button" class="btn-texto" data-roteiro="${esc(r.id)}">${esc(r.titulo || "Roteiro")}</button> <span>${esc(r.etapa || "")}</span></li>`).join("")}</ul>` : `<p class="rf-vazio">Nenhum ainda.</p>`}</section>
      </div>`;
      $(".rf-fechar", j).addEventListener("click", fechar);
      if (!x.video_path && window.painelVideos && $(".rf-video video", j)) window.painelVideos.tocarEm(j);
      if (x.video_path && window.painelVideos) { window.painelVideos.tocarEm(j); const bx = $("[data-baixar-video]", j); if (bx) bx.addEventListener("click", () => window.painelVideos.baixar(x.video_path)); }
      $("[data-criar]", j).addEventListener("click", () => criarRoteiro(x));
      $("[data-transcrever]", j).addEventListener("click", () => rodar("transcrever", transcrever, "Transcrição guardada nesta referência"));
      $("[data-analisar]", j).addEventListener("click", () => rodar("analisar", (r) => analisar(r, (t) => { const bt = $("[data-analisar]", j); if (bt) bt.textContent = t; }), "Análise guardada"));
      if (window.painelAnaliseVideo) window.painelAnaliseVideo.ligarChave(j);
      // tocar numa cena leva o vídeo guardado até ela
      $$(".cr-cenas li[data-ir]", j).forEach((li) => li.addEventListener("click", () => {
        const v = $(".rf-video video", j); if (!v) return;
        v.currentTime = Number(li.dataset.ir) || 0; v.play().catch(() => {}); v.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }));
      const antiga = $("[data-antiga]", j);
      if (antiga) antiga.addEventListener("click", () => { fechar(); if (window.painelRoteiros && window.painelRoteiros.abrir) window.painelRoteiros.abrir(x.id, "analise"); });
      $$("[data-roteiro]", j).forEach((b) => b.addEventListener("click", () => { fechar(); window.painelSkill.abrirRoteiro(b.dataset.roteiro); }));
    };
    let gerados = null;
    const rodar = async (qual, fn, ok) => {
      pintar(qual, gerados);
      try { await fn(x); toast(ok); document.dispatchEvent(new CustomEvent("referencias:mudou")); }
      catch (e) { toast(String(e.message || e), true); }
      if ($("#rf-janela") === j) pintar("", gerados);
    };
    pintar("", null);
    gerados = await roteirosDaReferencia(x);
    if ($("#rf-janela") === j) pintar("", gerados);
  }

  window.painelReferencias = { carregar, extras: () => st.extras, carregado: () => st.carregado, abrir, criar: criarRoteiro, analiseSkill, FONTES };
})();
