// =========================================================
// CORRETOR DE ROTEIRO (out/2026). Carregado no painel (admin/index.html) e no aplicativo (admin/gestao).
// Ao focar um campo de roteiro aparece embaixo dele uma barrinha que se atualiza a cada tecla: avisos quando
// a fala foge do jeito dela (travessão, construções proibidas e ganchos batidos iguais aos da função
// painel-conteudo, vícios, frases genéricas, [confirme: ...] sem preencher, frase longa demais e as regras
// dela em configuracoes "regras_fala") e a conta de segundos só da fala, no ritmo dela (estilo_ugc.ritmo_fala).
// Clicar num aviso seleciona o trecho no campo. Dentro de um <dialog> aberto a barra entra no próprio dialog.
// =========================================================
(function () {
  "use strict";
  if (window.__corretorRoteiro) return; window.__corretorRoteiro = true;
  const SELETOR = 'textarea[data-corretor="fala"], .pc-form [name="hook"], .pc-form [name="desenvolvimento"], .pc-form [name="cta"], #roteiro-texto, #met-texto, #ed-roteiro';
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fmt = (n) => String(Math.round(n * 100) / 100).replace(".", ",");
  const de = (nome) => { try { return window[nome] || (window.parent !== window && window.parent[nome]); } catch (e) { return window[nome]; } };

  // iguais aos da Edge Function painel-conteudo (FRASE_PROIBIDA e GANCHO_BATIDO)
  const FRASE_PROIBIDA = /\bn[aã]o [eé] (s[oó] |sobre |isso|apenas )[^.!?]{0,60}, [eé] |o problema n[aã]o [eé]|a[ií] eu (descobri|conheci)|hoje eu descobri|foi a[ií] que|foi quando|[eé] o tipo de|voc[eê] j[aá] reparou|voc[eê] sabia que|e sinceramente\?|isso muda (tudo|o jogo)|ol[aá],? pessoal|hoje vou falar sobre|queria compartilhar com voc[eê]s|hoje vim indicar|tem produtos que|se voc[eê] ainda t[aá] no ciclo|at[eé] (eu )?(descobrir|conhecer|encontrar)|at[eé] que (eu )?(descobri|conheci|encontrei)|mas n[aã]o [eé] (bem )?assim/i;
  const GANCHO_BATIDO = /^\s*(voc[eê] j[aá] (cansou|acordou|se sentiu|sofreu)|cansad[ao] de|sabia que|descobri o segredo|chega de|quer saber como|\d+ passos simples|j[aá] acordou|adeus)/i;
  const VICIOS = ["tipo assim", "né", "gente", "mano", "bora", "miga", "socorro", "basicamente", "literalmente"];
  const GENERICAS = ["nesse vídeo eu vou", "neste vídeo eu vou", "game changer", "divisor de águas", "mudou minha vida", "mudou a minha vida", "não vivo sem", "simplesmente incrível", "vem comigo", "vem comigo que", "você precisa conhecer", "experiência única", "no dia a dia corrido", "na correria do dia a dia", "elevar o nível", "eleva o nível", "outro nível", "fez toda a diferença", "faz toda a diferença", "melhor custo-benefício", "não pode faltar", "item indispensável", "queridinho", "amei demais", "sem palavras"];
  const LINHA_FORA = /^\s*(cena|texto na tela|b-?roll|legenda|take|m[uú]sica)\b/i;
  const ROTULO_NOME = /^\s*(gancho|identifica[cç][aã]o|solu[cç][aã]o|prova|fechamento|contexto|conte[uú]do|desenvolvimento|cta|hook|fala|slide\s*\d+|parte\s*\d+|op[cç][aã]o\s*\d+)\s*:\s*/i;
  const ROTULO_MAIUSC = /^\s*[A-ZÀ-Ú][A-ZÀ-Ú0-9 ]{1,28}:\s*/;
  const tirarRotulo = (l) => l.replace(ROTULO_NOME, "").replace(ROTULO_MAIUSC, "");
  const LETRA = "[\\p{L}\\p{N}]";
  const palavraRe = (lista) => new RegExp(`(?<!${LETRA})(${lista.map(escRe).join("|")})(?!${LETRA})`, "giu");

  const cfg = { ritmo: 2.75, temRitmo: false, regras: [], lido: false, lendo: null };
  function lerConfig() {
    if (cfg.lendo) return cfg.lendo;
    const b = de("banco");
    if (!b) { cfg.lido = true; return (cfg.lendo = Promise.resolve()); }
    cfg.lendo = Promise.all([
      b.from("estilo_ugc").select("ritmo_fala").eq("id", 1).maybeSingle(),
      b.from("configuracoes").select("valor").eq("chave", "regras_fala").maybeSingle(),
    ]).then(([r1, r2]) => {
      const r = Number(r1 && r1.data && r1.data.ritmo_fala); if (r > 0) { cfg.ritmo = r; cfg.temRitmo = true; }
      try { const v = JSON.parse((r2 && r2.data && r2.data.valor) || "{}"); cfg.regras = Array.isArray(v.evitar) ? v.evitar.filter(Boolean) : []; } catch (e) { cfg.regras = []; }
    }).catch(() => {}).then(() => { cfg.lido = true; if (atual) atualizar(); });
    return cfg.lendo;
  }

  // só a fala: tira [direções], (parênteses), linhas de cena/texto na tela/b-roll e rótulos como GANCHO:
  function falaDe(texto) {
    return String(texto || "").split("\n").filter((l) => !LINHA_FORA.test(l))
      .map((l) => tirarRotulo(l).replace(/\[[^\]]*\]/g, " ").replace(/\([^)]*\)/g, " ")).join("\n");
  }
  const contar = (t) => (String(t).match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []).length;

  function avisosDe(texto, comGancho) {
    const av = [], t = String(texto || "");
    const add = (tipo, ini, fim, dica) => { if (!av.some((a) => a.ini === ini && a.tipo === tipo)) av.push({ tipo, ini, fim, trecho: t.slice(ini, fim), dica }); };
    const todos = (re, fn) => { re.lastIndex = 0; let m; while ((m = re.exec(t))) { if (!m[0]) { re.lastIndex++; continue; } fn(m); } };
    todos(/[—–]| - /g, (m) => add("Travessão", m.index, m.index + m[0].length, "troque por vírgula, ponto ou dois pontos"));
    todos(new RegExp(FRASE_PROIBIDA.source, "gi"), (m) => add("Construção proibida", m.index, m.index + m[0].length, "diga direto o que aconteceu"));
    if (comGancho) {
      const linhas = t.split("\n"); let pos = 0;
      for (const l of linhas) {
        if (!LINHA_FORA.test(l)) {
          const limpa = tirarRotulo(l).replace(/\[[^\]]*\]/g, "").replace(/\([^)]*\)/g, "");
          if (limpa.trim()) { const m = limpa.match(GANCHO_BATIDO); if (m) { const i = t.indexOf(m[0].trim(), pos); if (i >= 0) add("Gancho batido", i, i + m[0].trim().length, "abra com um detalhe concreto seu"); } break; }
        }
        pos += l.length + 1;
      }
    }
    todos(palavraRe(VICIOS), (m) => add("Vício de fala", m.index, m.index + m[0].length, "corte, sem ele a frase fica mais firme"));
    todos(palavraRe(GENERICAS), (m) => add("Frase genérica", m.index, m.index + m[0].length, "troque por algo que só você diria"));
    todos(/\[(?:\s*confirme\s*:[^\]]*|\s*preencher[^\]]*)\]/gi, (m) => add("Falta preencher", m.index, m.index + m[0].length, "troque pelo dado real"));
    todos(/[^.!?\n]+/g, (m) => { if (contar(falaDe(m[0])) > 30) { const ini = m.index + (m[0].length - m[0].trimStart().length); add("Frase longa", ini, m.index + m[0].trimEnd().length, "mais de 30 palavras sem ponto; quebre em duas"); } });
    if (cfg.regras.length) todos(palavraRe(cfg.regras), (m) => add("Sua regra", m.index, m.index + m[0].length, "está na sua lista de evitar"));
    return av.sort((a, b) => a.ini - b.ini);
  }

  // ---------- barrinha ----------
  let barra = null, atual = null, esconder = null;
  function criarBarra() {
    const b = document.createElement("div");
    b.className = "cr-barra"; b.setAttribute("role", "status");
    b.addEventListener("mousedown", (e) => { if (!e.target.closest("[data-cr-regras]")) e.preventDefault(); });
    b.addEventListener("click", (e) => {
      const a = e.target.closest("[data-cr-av]");
      if (a && atual) { const ini = +a.dataset.ini, fim = +a.dataset.fim; atual.focus(); try { atual.setSelectionRange(ini, fim); } catch (er) { /* sem seleção */ } rolarAte(atual, ini); return; }
      if (e.target.closest("[data-cr-regras]")) { e.preventDefault(); minhasRegras(); }
    });
    if (!document.getElementById("cr-estilo")) {
      const s = document.createElement("style"); s.id = "cr-estilo";
      s.textContent = `.cr-barra{position:fixed;z-index:2147483000;max-width:min(560px,calc(100vw - 16px));background:#fffdf9;color:#3d2b20;border:1px solid rgba(107,74,53,.28);border-radius:12px;box-shadow:0 8px 24px rgba(61,43,32,.14);padding:8px 12px;font:12px/1.45 Poppins,system-ui,sans-serif;max-height:min(220px,40vh);overflow:auto}
.cr-topo{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px}
.cr-ok{color:#4f7a54;font-weight:600}.cr-alerta{color:#a87058;font-weight:600}
.cr-conta{color:#7a6355}
.cr-regras{margin-left:auto;border:0;background:none;padding:0;color:#7a6355;font:inherit;text-decoration:underline;cursor:pointer}
.cr-lista{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:2px}
.cr-lista button{display:block;width:100%;text-align:left;border:0;background:none;padding:3px 6px;border-radius:6px;font:inherit;color:#3d2b20;cursor:pointer}
.cr-lista button:hover{background:#efe5d8}
.cr-lista b{color:#a87058;font-weight:600}.cr-lista i{color:#7a6355;font-style:normal}`;
      document.head.appendChild(s);
    }
    return b;
  }
  function rolarAte(campo, ini) {
    const antes = campo.value.slice(0, ini).split("\n").length - 1;
    const lh = parseFloat(getComputedStyle(campo).lineHeight) || 18;
    campo.scrollTop = Math.max(0, antes * lh - campo.clientHeight / 2);
  }
  function grupoDe(campo) {
    const raiz = campo.closest("dialog[open]") || campo.closest("form") || campo.closest(".janela, .modal, [role=dialog]") || null;
    if (!raiz) return [campo];
    return [...raiz.querySelectorAll(SELETOR)].filter((c) => c.offsetParent !== null || c === campo);
  }
  function seg(p) { return Math.round(p / cfg.ritmo); }
  function atualizar() {
    if (!atual || !barra) return;
    const grupo = grupoDe(atual);
    const ehGancho = (c) => c.matches('[name="hook"]') || /gancho/i.test((c.closest("label, .field, [class*=campo]") || {}).textContent || "") && c.rows <= 3;
    const primeiro = grupo.find((c) => (c.value || "").trim()) || atual;
    const av = avisosDe(atual.value, atual === primeiro || ehGancho(atual));
    const p = contar(falaDe(atual.value));
    const ritmoTxt = `${fmt(cfg.ritmo)}/s`;
    let conta;
    if (grupo.length > 1) {
      const tot = grupo.reduce((s, c) => s + contar(falaDe(c.value)), 0);
      conta = `este campo ${seg(p)}s · roteiro todo ${tot} ${tot === 1 ? "palavra" : "palavras"}, uns ${seg(tot)}s no seu ritmo (${ritmoTxt})`;
    } else conta = `${p} ${p === 1 ? "palavra falada" : "palavras faladas"}, uns ${seg(p)} segundos no seu ritmo (${ritmoTxt})`;
    const mostrar = av.slice(0, 12);
    barra.innerHTML = `<div class="cr-topo">${av.length ? `<span class="cr-alerta">⚠ ${av.length} ${av.length === 1 ? "aviso" : "avisos"}</span>` : `<span class="cr-ok">✓ Dentro das suas regras</span>`}<span class="cr-conta">${esc(conta)}</span><button type="button" class="cr-regras" data-cr-regras>Minhas regras</button></div>
      ${av.length ? `<ul class="cr-lista">${mostrar.map((a) => `<li><button type="button" data-cr-av data-ini="${a.ini}" data-fim="${a.fim}"><b>${esc(a.tipo)}:</b> “${esc(a.trecho.length > 60 ? a.trecho.slice(0, 57) + "…" : a.trecho)}” <i>${esc(a.dica)}</i></button></li>`).join("")}${av.length > mostrar.length ? `<li><i>e mais ${av.length - mostrar.length}</i></li>` : ""}</ul>` : ""}`;
    posicionar();
  }
  function posicionar() {
    if (!atual || !barra || !barra.isConnected) return;
    const r = atual.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) { sair(); return; }
    const larg = Math.max(280, Math.min(r.width, 560));
    barra.style.width = Math.min(larg, window.innerWidth - 16) + "px";
    const h = barra.offsetHeight;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - barra.offsetWidth - 8));
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = r.top - h - 6 >= 8 ? r.top - h - 6 : window.innerHeight - h - 8;
    // dentro de um dialog com transform, position fixed fica relativo a ele
    const pai = barra.parentElement, pr = pai && pai !== document.body ? pai.getBoundingClientRect() : null;
    const ajusta = pr && getComputedStyle(pai).transform !== "none";
    barra.style.left = (left - (ajusta ? pr.left : 0)) + "px";
    barra.style.top = (top - (ajusta ? pr.top : 0)) + "px";
  }
  function entrar(campo) {
    clearTimeout(esconder);
    if (atual && atual !== campo) atual.removeEventListener("input", atualizar);
    atual = campo;
    if (!barra) barra = criarBarra();
    const dono = campo.closest("dialog[open]") || document.body;
    if (barra.parentElement !== dono) dono.appendChild(barra);
    campo.addEventListener("input", atualizar);
    if (!cfg.lido) lerConfig();
    atualizar();
  }
  function sair() {
    if (atual) atual.removeEventListener("input", atualizar);
    atual = null; if (barra) barra.remove();
  }
  document.addEventListener("focusin", (e) => {
    const c = e.target && e.target.closest ? e.target.closest(SELETOR) : null;
    if (c && c.tagName === "TEXTAREA" || c && c.tagName === "INPUT") entrar(c);
  });
  document.addEventListener("focusout", (e) => {
    if (!atual || e.target !== atual) return;
    clearTimeout(esconder);
    esconder = setTimeout(() => { if (atual && document.activeElement !== atual) sair(); }, 180);
  });
  window.addEventListener("resize", posicionar);
  document.addEventListener("scroll", posicionar, true);

  async function minhasRegras() {
    const D = de("painelDialogo"), b = de("banco");
    if (!D || !b) return;
    const campo = atual;
    await lerConfig();
    const txt = await D.texto("Expressões que você não quer usar nos roteiros, uma por linha (o corretor avisa quando aparecerem):", cfg.regras.join("\n"), { linhas: 8 });
    if (txt == null) { if (campo) campo.focus(); return; }
    const lista = [...new Set(txt.split("\n").map((x) => x.trim()).filter(Boolean))];
    const { error } = await b.from("configuracoes").upsert({ chave: "regras_fala", valor: JSON.stringify({ evitar: lista }), updated_at: new Date().toISOString() }, { onConflict: "chave" });
    if (error) { D.aviso("Não consegui salvar suas regras: " + error.message); return; }
    cfg.regras = lista;
    if (campo && campo.isConnected) campo.focus();
  }
  window.painelCorretor = { avisosDe, falaDe, contar, cfg, lerConfig };
})();
