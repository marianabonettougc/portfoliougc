// =========================================================
// NOTIFICAÇÕES NO CELULAR (Geral > Notificações no celular, hash #notificacoes)
// - "Importante, notificar": um sininho no cabeçalho de toda janela do painel (as janelas
//   <dialog> daqui e as janelas do aplicativo Gestão UGC, que chama
//   window.parent.painelLembretes.abrir). Ela escolhe dia e horário, e pode editar ou
//   desligar depois. Fica na tabela lembretes (um aviso por item: item_tipo + item_id).
// - A função notificacoes (pg_cron a cada minuto) manda o aviso no horário pelo Web Push
//   para o painel instalado na Tela de Início (admin/manifest.webmanifest, admin/sw.js) e,
//   se estiver ligado, também pelo app ntfy.
// - Página: Ativar notificações (pede a permissão do celular e inscreve), Testar,
//   próximos avisos (editar, desligar), avisos já enviados e o passo a passo para instalar.
// =========================================================
(function () {
  "use strict";

  const ABA = "notificacoes";
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const banco = () => window.banco;
  const pad = (n) => String(n).padStart(2, "0");
  const SINO = '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/></svg>';
  const eIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const instalado = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const suportaPush = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const st = { lista: [], pronto: false };

  let tempoToast = null;
  function toast(texto, erro) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = texto; t.classList.toggle("erro", Boolean(erro)); t.classList.add("visivel");
    clearTimeout(tempoToast); tempoToast = setTimeout(() => t.classList.remove("visivel"), erro ? 5200 : 2600);
  }
  const paraCampo = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const mostrarQuando = (iso) => new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  // identificador estável de um item a partir do texto (mesma janela, mesmo aviso)
  const idDoTexto = (t) => { let h = 0; for (const c of String(t)) h = (h * 31 + c.charCodeAt(0)) | 0; return "t" + (h >>> 0).toString(36); };

  async function chamar(corpo) {
    const { data, error } = await banco().functions.invoke("notificacoes", { body: corpo });
    let msg = data && data.error;
    if (error) { try { msg = (await error.context.json()).error; } catch (e) { msg = msg || "A função de notificações não respondeu agora."; } }
    if (msg) throw new Error(msg);
    return data;
  }

  // ---------- ativar neste celular ----------
  const b64 = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const raw = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))); };
  async function registrarSW() {
    if (!("serviceWorker" in navigator)) return null;
    try { return await navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin/" }); } catch (e) { return null; }
  }
  async function ativar() {
    if (eIOS && !instalado()) { toast("No iPhone, primeiro adicione o painel à Tela de Início e abra pelo ícone.", true); pintar(); return; }
    if (!suportaPush()) { toast("Este navegador não aceita notificações. No iPhone, abra pelo ícone da Tela de Início (iOS 16.4 ou mais novo).", true); return; }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { toast("A permissão foi negada. Libere em Ajustes > Notificações > Painel Mari.", true); pintar(); return; }
    try {
      const reg = (await registrarSW()) || (await navigator.serviceWorker.ready);
      await navigator.serviceWorker.ready;
      const { chave } = await chamar({ acao: "chave" });
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(chave) });
      await chamar({ acao: "inscrever", inscricao: sub.toJSON(), aparelho: (eIOS ? "iPhone" : /Android/.test(navigator.userAgent) ? "Android" : "Computador") + " · " + new Date().toLocaleDateString("pt-BR") });
      try { localStorage.setItem("notif-ativa", "1"); } catch (e) { /* sem armazenamento */ }
      toast("Notificações ativadas neste aparelho.");
    } catch (e) { toast("Não consegui ativar: " + e.message, true); }
    pintar();
  }
  async function testar(bt) {
    if (bt) bt.disabled = true;
    try { const r = await chamar({ acao: "teste" }); toast(r.celulares ? `Mandei para ${r.celulares} aparelho${r.celulares === 1 ? "" : "s"}. Olhe o celular.` : "Mandei pelo app ntfy."); }
    catch (e) { toast(e.message, true); }
    if (bt) bt.disabled = false;
  }

  // ---------- avisos ----------
  async function carregar() {
    const { data, error } = await banco().from("lembretes").select("*").order("quando");
    st.lista = error ? [] : (data || []);
    st.faltaTabela = Boolean(error);
  }

  let dlg = null;
  // abre a janelinha do aviso de um item: { tipo, id, titulo, url }
  async function abrir(item) {
    item = item || {};
    const tipo = String(item.tipo || "item").slice(0, 40);
    const titulo = String(item.titulo || "").trim().slice(0, 160);
    const id = String(item.id || idDoTexto(tipo + ":" + titulo));
    let atual = null;
    try { const r = await banco().from("lembretes").select("*").eq("item_tipo", tipo).eq("item_id", id).maybeSingle(); atual = r.data; } catch (e) { /* segue */ }
    if (!dlg) { dlg = document.createElement("dialog"); dlg.className = "janela lb-janela"; document.body.appendChild(dlg); dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }); }
    const padrao = new Date(Date.now() + 60 * 60 * 1000); padrao.setMinutes(0, 0, 0);
    const quando = atual ? new Date(atual.quando) : padrao;
    const ligado = atual && atual.ativo && !atual.enviado_em;
    dlg.innerHTML = `<div class="janela-cabeca"><div><small class="janela-sobretitulo">Importante, notificar</small><h2>${ligado ? "Aviso marcado" : atual && atual.enviado_em ? "Aviso já enviado" : "Me avisar no celular"}</h2></div><button class="icone-btn" type="button" data-fechar aria-label="Fechar"><svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="janela-corpo lb-form">
        <label class="campo"><span>Nome do aviso</span><input name="titulo" value="${esc(atual ? atual.titulo : titulo)}" placeholder="Ex.: Entregar vídeo da Natura"></label>
        <label class="campo"><span>Dia e horário</span><input type="datetime-local" name="quando" value="${paraCampo(quando)}"></label>
        <div class="lb-atalhos">${[["Em 5 min", 5], ["Em 1 hora", 60], ["Amanhã 9h", "a9"], ["Amanhã 18h", "a18"]].map(([t, v]) => `<button type="button" class="cr-chip" data-rapido="${v}">${t}</button>`).join("")}</div>
        <label class="campo"><span>Detalhe (opcional)</span><input name="detalhe" value="${esc(atual ? atual.detalhe || "" : "")}" placeholder="Aparece embaixo do nome na notificação"></label>
        ${atual && atual.enviado_em ? `<p class="pc-ajuda">Enviado em ${esc(mostrarQuando(atual.enviado_em))}. Salve com um novo horário para avisar de novo.</p>` : ""}
        ${!localAtivo() ? `<p class="faixa">Este aparelho ainda não está recebendo. Ative em <a href="#notificacoes" data-ir>Geral > Notificações no celular</a>.</p>` : ""}
      </div>
      <div class="janela-rodape">${ligado ? `<button class="btn btn-perigo" type="button" data-desligar>Desligar aviso</button>` : ""}<span style="flex:1"></span>
        <button class="btn btn-principal" type="button" data-salvar>${SINO}${ligado ? "Salvar" : "Notificar"}</button></div>`;
    $("[data-fechar]", dlg).addEventListener("click", () => dlg.close());
    const ir = $("[data-ir]", dlg); if (ir) ir.addEventListener("click", () => dlg.close());
    $$("[data-rapido]", dlg).forEach((b) => b.addEventListener("click", () => {
      const v = b.dataset.rapido; let d = new Date();
      if (v[0] === "a") { d.setDate(d.getDate() + 1); d.setHours(Number(v.slice(1)), 0, 0, 0); } else d = new Date(Date.now() + Number(v) * 60000);
      $("[name=quando]", dlg).value = paraCampo(d);
    }));
    $("[data-salvar]", dlg).addEventListener("click", async () => {
      const nome = $("[name=titulo]", dlg).value.trim(), campo = $("[name=quando]", dlg).value;
      if (!nome) { toast("Dê um nome para o aviso.", true); return; }
      if (!campo) { toast("Escolha o dia e o horário.", true); return; }
      const d = new Date(campo);
      if (d.getTime() < Date.now() - 60000) { toast("Esse horário já passou.", true); return; }
      const linha = { item_tipo: tipo, item_id: id, titulo: nome, detalhe: $("[name=detalhe]", dlg).value.trim() || null, url: item.url || (location.origin + "/admin/" + location.hash), quando: d.toISOString(), ativo: true, enviado_em: null };
      const { error } = await banco().from("lembretes").upsert(linha, { onConflict: "item_tipo,item_id" });
      if (error) { toast("Não consegui salvar: " + error.message, true); return; }
      dlg.close(); toast("Aviso marcado para " + mostrarQuando(linha.quando) + ".");
      if (st.pronto) { await carregar(); pintar(); }
    });
    const des = $("[data-desligar]", dlg);
    if (des) des.addEventListener("click", async () => {
      const { error } = await banco().from("lembretes").update({ ativo: false }).eq("id", atual.id);
      if (error) { toast(error.message, true); return; }
      dlg.close(); toast("Aviso desligado.");
      if (st.pronto) { await carregar(); pintar(); }
    });
    if (!dlg.open) dlg.showModal();
  }
  function localAtivo() { try { return localStorage.getItem("notif-ativa") === "1" || ("Notification" in window && Notification.permission === "granted"); } catch (e) { return false; } }

  // ---------- sininho em toda janela do painel ----------
  // nome do item: o primeiro campo de texto preenchido da janela (nome, marca, tema...) e o título dela
  function nomeDaJanela(raiz, tituloEl) {
    const titulo = (tituloEl && tituloEl.textContent || "").replace(/\s+/g, " ").trim();
    const campo = $$("input:not([type]), input[type=text], textarea", raiz).find((el) => el.value && el.value.trim().length > 1 && !el.closest(".lb-janela"));
    const valor = campo ? campo.value.trim().split("\n")[0].slice(0, 90) : "";
    if (valor && !/^(editar|novo|nova)\b/i.test(valor) && valor !== titulo) return /^(editar|novo|nova|adicionar)\b/i.test(titulo) || !titulo ? valor : `${valor} · ${titulo}`;
    return titulo || "Item do painel";
  }
  function botaoSino(aoClicar) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "icone-btn lb-sino"; b.title = "Importante, notificar"; b.setAttribute("aria-label", "Importante, notificar");
    b.innerHTML = SINO + "<span>Notificar</span>";
    b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); aoClicar(); });
    return b;
  }
  function colocarSino(d) {
    if (d.classList.contains("lb-janela") || d.dataset.semLembrete !== undefined) return;
    const cabeca = $(".janela-cabeca", d);
    if (!cabeca) return;
    const velho = $(".lb-sino", cabeca); if (velho) velho.remove();
    const fechar = $("[data-fechar], #janela-fechar, .icone-btn:last-child", cabeca);
    const b = botaoSino(() => {
      const tituloEl = $("h2", cabeca);
      const titulo = d.dataset.lembreteTitulo || nomeDaJanela(d, tituloEl);
      abrir({ tipo: d.dataset.lembreteTipo || (location.hash.slice(1) || "painel"), id: d.dataset.lembreteId || null, titulo });
    });
    if (fechar && fechar.parentNode === cabeca) cabeca.insertBefore(b, fechar); else cabeca.appendChild(b);
  }
  const showModalOriginal = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function () {
    const r = showModalOriginal.apply(this, arguments);
    try { colocarSino(this); } catch (e) { /* nunca atrapalha a janela */ }
    return r;
  };

  // ---------- página ----------
  function montar(sec) {
    sec.innerHTML = `<div class="lb-pagina">
      <section class="pc-cartao lb-estado" id="lb-estado"></section>
      <section class="pc-cartao"><div class="lb-cab"><h3 class="pc-h3">${SINO}Próximos avisos</h3><button class="btn" type="button" id="lb-novo">+ Novo aviso</button></div><div id="lb-proximos"></div></section>
      <section class="pc-cartao"><h3 class="pc-h3">Já enviados e desligados</h3><div id="lb-passados"></div></section>
      <section class="pc-cartao"><h3 class="pc-h3">Como marcar um aviso</h3><p class="pc-ajuda">Abra qualquer item do painel (um job, um roteiro, um post do Painel de conteúdo, uma marca...) e toque no sininho <b>Notificar</b> no alto da janela. Escolha o dia e o horário. Para mudar ou desligar, toque no sininho de novo ou use a lista acima.</p></section>
    </div>`;
    $("#lb-novo", sec).addEventListener("click", () => abrir({ tipo: "avulso", id: "a" + Date.now().toString(36), titulo: "" }));
  }
  function pintar() {
    const sec = document.getElementById("aba-" + ABA);
    if (!sec || !$("#lb-estado", sec)) return;
    const perm = "Notification" in window ? Notification.permission : "indisponivel";
    const passos = `<details class="pc-passos"${eIOS && !instalado() ? " open" : ""}><summary><b>Instalar o painel no celular</b></summary><ol class="pc-ajuda">
        <li><b>iPhone</b> (iOS 16.4 ou mais novo): abra marianabonetto.com.br/admin no <b>Safari</b>, toque em <b>Compartilhar</b> (quadrado com seta para cima), depois <b>Adicionar à Tela de Início</b> e <b>Adicionar</b>.</li>
        <li><b>Android</b>: abra no <b>Chrome</b>, toque nos três pontinhos (⋮) e em <b>Adicionar à tela inicial</b> ou <b>Instalar app</b>.</li>
        <li>Abra o painel <b>pelo ícone da Tela de Início</b> (não pelo navegador), entre com seu e-mail e senha, venha nesta página e toque em <b>Ativar notificações</b>. Aceite.</li>
        <li>Toque em <b>Testar notificação</b>.</li>
        <li>Teste de verdade: marque um aviso para daqui a 5 minutos, feche o app e espere. Se chegar, está funcionando.</li></ol></details>`;
    let estado;
    if (eIOS && !instalado()) estado = `<p class="faixa">Você está no navegador. No iPhone as notificações só funcionam com o painel <b>adicionado à Tela de Início</b> e aberto pelo ícone.</p>`;
    else if (!suportaPush()) estado = `<p class="faixa">Este navegador não aceita notificações. Use o Safari (iPhone, pelo ícone da Tela de Início) ou o Chrome (Android ou computador).</p>`;
    else if (perm === "denied") estado = `<p class="faixa faixa-erro">As notificações estão bloqueadas neste aparelho. iPhone: Ajustes > Notificações > Painel Mari > Permitir. Android: segure o ícone > Informações do app > Notificações.</p>`;
    else if (perm === "granted" && localAtivo()) estado = `<p class="faixa faixa-ok">Este aparelho está recebendo as notificações.</p>`;
    else estado = `<p class="pc-ajuda">Toque em Ativar notificações e aceite o pedido do celular.</p>`;
    $("#lb-estado", sec).innerHTML = `<h3 class="pc-h3">${SINO}Notificações no celular</h3>${estado}
      <div class="pc-linha lb-botoes"><button class="btn btn-principal" type="button" id="lb-ativar">${perm === "granted" && localAtivo() ? "Ativar de novo" : "Ativar notificações"}</button><button class="btn" type="button" id="lb-testar">Testar notificação</button></div>${passos}`;
    $("#lb-ativar", sec).addEventListener("click", ativar);
    $("#lb-testar", sec).addEventListener("click", (e) => testar(e.currentTarget));
    if (st.faltaTabela) { $("#lb-proximos", sec).innerHTML = `<p class="faixa faixa-erro">A tabela de avisos ainda não existe no banco.</p>`; return; }
    const agora = Date.now();
    const prox = st.lista.filter((l) => l.ativo && !l.enviado_em);
    const passados = st.lista.filter((l) => !(l.ativo && !l.enviado_em)).sort((a, b) => new Date(b.enviado_em || b.quando) - new Date(a.enviado_em || a.quando)).slice(0, 15);
    const linha = (l, futuro) => `<li class="lb-item${futuro && new Date(l.quando).getTime() < agora ? " atrasado" : ""}"><div><b>${esc(l.titulo)}</b><small>${esc(mostrarQuando(l.quando))}${l.detalhe ? " · " + esc(l.detalhe) : ""}${!futuro ? (l.enviado_em ? " · enviado" : " · desligado") : ""}</small></div>
      <span class="lb-acoes"><button class="btn" type="button" data-editar="${l.id}">${futuro ? "Editar" : "Avisar de novo"}</button>${futuro ? `<button class="btn" type="button" data-desligar="${l.id}">Desligar</button>` : `<button class="icone-btn" type="button" data-apagar="${l.id}" aria-label="Apagar">×</button>`}</span></li>`;
    $("#lb-proximos", sec).innerHTML = prox.length ? `<ul class="lb-lista">${prox.map((l) => linha(l, true)).join("")}</ul>` : `<p class="pc-ajuda">Nenhum aviso marcado. Toque no sininho de qualquer janela do painel, ou em + Novo aviso.</p>`;
    $("#lb-passados", sec).innerHTML = passados.length ? `<ul class="lb-lista">${passados.map((l) => linha(l, false)).join("")}</ul>` : `<p class="pc-ajuda">Nada por aqui ainda.</p>`;
    $$("[data-editar]", sec).forEach((b) => b.addEventListener("click", () => { const l = st.lista.find((x) => String(x.id) === b.dataset.editar); if (l) abrir({ tipo: l.item_tipo, id: l.item_id, titulo: l.titulo, url: l.url }); }));
    $$("[data-desligar]", sec).forEach((b) => b.addEventListener("click", async () => { const { error } = await banco().from("lembretes").update({ ativo: false }).eq("id", b.dataset.desligar); if (error) toast(error.message, true); else { toast("Aviso desligado."); await carregar(); pintar(); } }));
    $$("[data-apagar]", sec).forEach((b) => b.addEventListener("click", async () => { const { error } = await banco().from("lembretes").delete().eq("id", b.dataset.apagar); if (error) toast(error.message, true); else { await carregar(); pintar(); } }));
  }
  async function abrirAba() {
    const sec = document.getElementById("aba-" + ABA);
    if (!sec) return;
    if (!st.pronto) { montar(sec); st.pronto = true; }
    await carregar(); pintar();
  }

  window.painelLembretes = { abrir, nomeDaJanela };
  document.addEventListener("painel:aba", (e) => { if (e.detail === ABA) abrirAba(); });
  if (location.hash === "#" + ABA) setTimeout(abrirAba, 600);
  // o celular precisa do service worker registrado para receber os avisos
  if (instalado() || localAtivo()) registrarSW();
})();
