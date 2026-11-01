// =========================================================
// CONTEÚDO > CONTEÚDOS (hash #planejar), reestruturado em out/2026 com as referências estilo Trello dela:
// quatro áreas sobre o MESMO registro de painel_conteudo (st.todos): Visão geral (indicadores, próximos,
// planejamento do mês, fluxo e plano da semana), Quadro de produção (colunas = status, arrastar muda o status),
// Calendário editorial (mensal e semanal, arrastar muda a data) e Banco de ideias (status Ideia + pastas do Instagram).
// Ajustes e IA (perfil, gerar grade, pastas, iPhone) abre por botão. Status: STATUS (nomes antigos em STATUS_ANTIGO).
// - Inspirações: posts do Laboratório (tabela laboratorio) que vieram das pastas do
//   Instagram dela pelo programa ferramentas/salvos.py: "Gravar em <mês>" e
//   "Produzir vídeos assim" (coluna colecao).
// - Gerar ideias: função painel-conteudo (método de roteiro da Lara, que fica só no
//   Supabase) devolve tema, tipo de UGC, funil, propósito, hook, desenvolvimento e CTA,
//   inspirados nas pastas sem copiar as falas. As ideias entram nos próximos dias livres.
// - Meu perfil de conteúdo (configuracoes chave "perfil_conteudo", JSON): quem ela é, objetivo,
//   pilares, tom de voz, o que evitar e o ritmo (posts por semana, dias, horário, formatos,
//   topo/meio/fundo por semana). A grade é distribuída AQUI antes de chamar a IA (planejarSlots):
//   cada espaço do ritmo recebe pilar (rodízio, o menos usado primeiro), funil e formato, e a
//   função painel-conteudo escreve a ideia exatamente naquele lugar. "Refazer com ajuste" na
//   janela do post regera só aquele post no mesmo dia, pilar, funil e formato.
// - Tudo fica na tabela painel_conteudo (só a dona). Cada post vai para Meus roteiros
//   com um clique (window.painelRoteiros.salvarNoQuadro).
// =========================================================
(function () {
  "use strict";

  const ABA = "planejar";
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const banco = () => window.banco;
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
  // etapas do quadro de produção (out/2026); os nomes antigos continuam valendo (STATUS_ANTIGO)
  const STATUS = ["Ideia", "Roteirizado", "Para gravar", "Em edição", "Pronto", "Publicado"];
  const STATUS_ANTIGO = { Gravado: "Em edição", Editado: "Pronto", Postado: "Publicado", "Para postar": "Pronto", Agendado: "Pronto" };
  const normStatus = (s) => STATUS_ANTIGO[s] || (STATUS.includes(s) ? s : "Ideia");
  const NICHOS = ["Maternidade", "Autocuidado", "Beleza e cabelo", "Moda", "Bem-estar", "Achadinhos de casa e tech"];
  const TIPOS_CONTEUDO = ["Orgânico", "UGC", "Publi"];
  const PRODUZIR = ["Ideia", "Roteirizado", "Para gravar"];
  const FORMATOS = ["Reels", "Carrossel", "Stories"];
  const FUNIS = ["Topo", "Meio", "Fundo"];
  const ROTEIROS = ["Spec ad", "Vitrine para marca", "Stories de bastidor"];
  const TIPOS = ["Falado com a câmera", "Teatro encenando uma situação", "Dois personagens comparativos", "Rotina ou dia a dia", "Testando o produto ou demonstração", "Focado em ads", "Problema versus solução", "Unboxing", "Sorteador de assuntos", "Várias vozes ou personagens com locução", "Entrevista de rua", "React", "Tutorial walkthrough", "Decupagem por frase"];
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const deIso = (s) => { const [a, m, d] = String(s).split("-").map(Number); return new Date(a, m - 1, d); };
  const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  // mesmo padrão da função painel-conteudo (PERFIL_PADRAO); ela edita no cartão
  const PERFIL_PADRAO = {
    quem: "Criadora de conteúdo UGC e mãe. Não tenho um nicho fechado: crio beleza, moda, bem-estar, maternidade, achadinhos, cabelo, casa e tech, porque no UGC dá para trabalhar com tudo.",
    objetivo: "Alinhar os conteúdos do Instagram para as marcas começarem a me seguir e me contratar. As pessoas precisam me conhecer.",
    pilares: [
      { nome: "Maternidade e autocuidado", descricao: "Me reencontrando depois de ser mãe: emagreci, voltei a cuidar de mim. Junta maternidade com beleza e autocuidado." },
      { nome: "Beleza e cabelo", descricao: "Skincare, make, cuidados com o cabelo, produto em uso real." },
      { nome: "Moda", descricao: "Looks do dia a dia de mãe, peças que funcionam, achados de roupa." },
      { nome: "Bem-estar", descricao: "Rotina, hábitos, cuidar do corpo e da cabeça." },
      { nome: "Achadinhos de casa e tech", descricao: "Coisas para casa e tecnologia que eu comprei e uso." },
    ],
    tom: 'Divertido e um pouco sarcástico, sem humor palhaço. Tom de amiga dando dica, como numa conversa: "amiga, olha, hoje eu comprei uma luminária, ela é maravilhosa, tem iluminação assim e assim, gostei bastante porque ela faz isso".',
    evitar: "Vícios de linguagem e gírias (eu não falo desse jeito). Esquetes, personagens, ceninhas e historinhas: quero UGC falando para a câmera com o produto em uso real.",
    ritmo: { porSemana: 3, dias: [0, 2, 4], horario: "12h", formatos: ["Reels", "Carrossel"], funil: { Topo: 1, Meio: 2, Fundo: 0 } },
  };
  const CMD_WIN = 'irm https://marianabonetto.com.br/ferramentas/salvos.py -OutFile "$HOME\\salvos.py"; python "$HOME\\salvos.py"';
  const hoje = new Date();
  // todos: todos os conteúdos (um registro por conteúdo, o mesmo em todas as visões); posts: só os do mês do calendário
  const st = { pronto: false, mes: `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}`, semana: 0, todos: [], lab: [], faltaTabela: false, gerando: false, transcrevendo: false, perfil: PERFIL_PADRAO,
    cal: "mes", semIni: null, filtro: { q: "", nicho: "", formato: "", funil: "", tipo: "" }, ideiaFiltro: "" };
  const mesDe = (p) => (p.data ? String(p.data).slice(0, 7) : p.mes);
  Object.defineProperty(st, "posts", { get: () => st.todos.filter((p) => mesDe(p) === st.mes) });

  let tempoToast = null;
  function toast(texto, erro) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = texto; t.classList.toggle("erro", Boolean(erro)); t.classList.add("visivel");
    clearTimeout(tempoToast); tempoToast = setTimeout(() => t.classList.remove("visivel"), erro ? 5200 : 2600);
  }
  const rotuloMes = (m) => { const [a, n] = m.split("-").map(Number); return `${MESES[n - 1]} de ${a}`; };
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

  // ---------- banco ----------
  async function carregar() {
    const [a, b] = await Promise.all([
      banco().from("painel_conteudo").select("*").order("data", { ascending: true, nullsFirst: false }).order("id").limit(3000),
      banco().from("laboratorio").select("id,link,codigo,perfil,tipo,legenda,transcricao,colecao,capa").not("colecao", "is", null).limit(1000),
    ]);
    if (a.error) { st.faltaTabela = true; st.todos = []; } else { st.faltaTabela = false; st.todos = (a.data || []).map((p) => ({ ...p, status: normStatus(p.status) })); }
    st.lab = b.error ? [] : (b.data || []);
    try {
      const { data: ap } = await banco().from("app_state").select("data").limit(1).maybeSingle();
      st.agenda = montarAgenda((ap && ap.data) || {});
    } catch (e) { st.agenda = []; }
    const c = await banco().from("configuracoes").select("chave,valor").in("chave", ["ntfy_topico", "perfil_conteudo", "temas_semana"]);
    const cfg = Object.fromEntries((c.data || []).map((x) => [x.chave, x.valor]));
    st.topico = cfg.ntfy_topico || "";
    try { st.temas = JSON.parse(cfg.temas_semana || "{}") || {}; } catch (e) { st.temas = {}; }
    try { const p = JSON.parse(cfg.perfil_conteudo || ""); st.perfil = { ...PERFIL_PADRAO, ...p, ritmo: { ...PERFIL_PADRAO.ritmo, ...(p.ritmo || {}), funil: { ...PERFIL_PADRAO.ritmo.funil, ...((p.ritmo || {}).funil || {}) } } }; } catch (e) { st.perfil = PERFIL_PADRAO; }
  }
  // Planner unido ao Painel (out/2026): prazos das publis (UGC's & Publis) e itens do antigo Planner aparecem no calendário
  function montarAgenda(est) {
    const out = [], fim = /conclu|cancel|finaliz/i;
    (est.jobs || []).forEach((j) => {
      if (fim.test(j.status || "")) return;
      const ent = j.entregaveis || {};
      Object.values(ent).forEach((lista) => (Array.isArray(lista) ? lista : []).forEach((it) => {
        if (it.concluido) return;
        [["prazoRoteiro", "Roteiro"], ["prazoConteudo", "Entregar"], ["prazoPostagem", "Postar"]].forEach(([k, verbo]) => {
          if (it[k]) out.push({ data: String(it[k]).slice(0, 10), tipo: "publi", rotulo: "PUBLI · " + String(j.marca || "").toUpperCase(), texto: `${verbo}: ${it.label || "entrega"}${Number(it.quantidade) > 1 ? " (" + it.quantidade + ")" : ""}`, ir: "campanhas" });
        });
      }));
    });
    (est.planner || []).forEach((it) => { if (it.data && !/entreg|feito|postado/i.test(it.status || "")) out.push({ data: String(it.data).slice(0, 10), tipo: "agenda", rotulo: "AGENDA" + (it.marca ? " · " + String(it.marca).toUpperCase() : ""), texto: it.titulo || "Compromisso", ir: it.roteiroId ? "quadro" : "" }); });
    return out;
  }
  // um conteúdo = um registro: mudar status, data ou classificação atualiza o mesmo registro (quadro, calendário e visão geral)
  async function salvar(post) {
    const campos = { ...post }; delete campos.id; delete campos.criado_em;
    if (campos.data) campos.mes = String(campos.data).slice(0, 7);
    if ("status" in campos) campos.status = normStatus(campos.status);
    campos.atualizado_em = new Date().toISOString();
    if (post.id) {
      const { error } = await banco().from("painel_conteudo").update(campos).eq("id", post.id);
      if (error) throw new Error(error.message);
      const atual = st.todos.find((x) => x.id === post.id); if (atual) Object.assign(atual, campos);
      return atual || { ...post, ...campos };
    }
    const { data, error } = await banco().from("painel_conteudo").insert({ ...campos, mes: campos.mes || st.mes }).select().maybeSingle();
    if (error) throw new Error(error.message);
    const novo = data ? { ...data, status: normStatus(data.status) } : { ...campos, mes: campos.mes || st.mes, id: Date.now() };
    st.todos.push(novo);
    return novo;
  }

  // ---------- pastas do Instagram ----------
  function pastasDoMes() {
    const nomeMes = semAcento(MESES[Number(st.mes.split("-")[1]) - 1]);
    const gravar = st.lab.filter((p) => { const c = semAcento(p.colecao); return c.includes("gravar") && c.includes(nomeMes); });
    const assim = st.lab.filter((p) => { const c = semAcento(p.colecao); return c.includes("produzir") || c.includes("videos assim"); });
    const outras = [...new Set(st.lab.map((p) => p.colecao))].filter((c) => !gravar.some((p) => p.colecao === c) && !assim.some((p) => p.colecao === c));
    return { gravar, assim, outras };
  }

  // ---------- gerar ideias ----------
  function proximosDiasLivres(qtd) {
    const [a, m] = st.mes.split("-").map(Number);
    const ultimo = new Date(a, m, 0).getDate();
    const ocupados = new Set(st.posts.filter((p) => p.data).map((p) => p.data));
    const inicio = a === hoje.getFullYear() && m === hoje.getMonth() + 1 ? hoje.getDate() + 1 : 1;
    const livres = [];
    for (let d = inicio; d <= ultimo && livres.length < qtd; d++) { const s = iso(new Date(a, m - 1, d)); if (!ocupados.has(s)) livres.push(s); }
    return livres;
  }
  // espaços do ritmo dela no mês (dias da semana do perfil), cada um com pilar, funil e formato.
  // modo "mes": todos os espaços livres do mês; modo "semana": só os da próxima semana com espaço.
  function planejarSlots(modo) {
    const r = st.perfil.ritmo || PERFIL_PADRAO.ritmo;
    const [a, m] = st.mes.split("-").map(Number);
    const ultimo = new Date(a, m, 0).getDate();
    const inicio = a === hoje.getFullYear() && m === hoje.getMonth() + 1 ? hoje.getDate() + 1 : 1;
    const dias = (r.dias && r.dias.length ? r.dias : [0, 2, 4]).slice().sort();
    const ocupados = new Set(st.posts.filter((p) => p.data).map((p) => p.data));
    const porSemana = Math.max(1, Number(r.porSemana) || dias.length);
    // funil da semana: ex. Topo 1 + Meio 2 = [Topo, Meio, Meio], intercalado
    const fun = r.funil || { Topo: 1, Meio: 2 };
    const sequenciaFunil = [];
    const restam = { Topo: Number(fun.Topo) || 0, Meio: Number(fun.Meio) || 0, Fundo: Number(fun.Fundo) || 0 };
    while (sequenciaFunil.length < porSemana && (restam.Topo + restam.Meio + restam.Fundo) > 0) {
      for (const f of ["Topo", "Meio", "Fundo"]) if (restam[f] > 0 && sequenciaFunil.length < porSemana) { sequenciaFunil.push(f); restam[f]--; }
    }
    while (sequenciaFunil.length < porSemana) sequenciaFunil.push("Meio");
    const formatos = r.formatos && r.formatos.length ? r.formatos : ["Reels"];
    const pilares = (st.perfil.pilares || []).map((x) => x.nome).filter(Boolean);
    const uso = new Map(pilares.map((n) => [n, st.posts.filter((p) => p.pilar === n).length]));
    const usoForm = new Map(formatos.map((f) => [f, st.posts.filter((p) => p.formato === f).length]));
    const slots = [];
    const semanas = semanasDoMes();
    for (const sem of semanas) {
      // dias do ritmo desta semana dentro do mês, a partir de amanhã
      const daSemana = dias.map((k) => sem[k]).filter((d) => d.getMonth() === m - 1 && d.getDate() >= inicio).slice(0, porSemana);
      const jaNaSemana = st.posts.filter((p) => p.data && sem.some((d) => iso(d) === p.data));
      const funisUsados = jaNaSemana.map((p) => p.funil);
      const faltam = sequenciaFunil.slice();
      funisUsados.forEach((f) => { const i = faltam.indexOf(f); if (i >= 0) faltam.splice(i, 1); });
      const livres = daSemana.filter((d) => !ocupados.has(iso(d))).slice(0, Math.max(0, porSemana - jaNaSemana.length));
      livres.forEach((d, i) => {
        const pilar = pilares.slice().sort((x, y) => uso.get(x) - uso.get(y) || pilares.indexOf(x) - pilares.indexOf(y))[0] || "";
        if (pilar) uso.set(pilar, uso.get(pilar) + 1);
        const formato = formatos.slice().sort((x, y) => usoForm.get(x) - usoForm.get(y))[0];
        usoForm.set(formato, usoForm.get(formato) + 1);
        slots.push({ data: iso(d), horario: r.horario || "12h", pilar, funil: faltam[i] || "Meio", formato });
      });
      if (modo === "semana" && slots.length) break;
    }
    return slots;
  }
  // posts das pastas que ainda não viraram ideia neste mês
  function referenciasLivres() {
    const { gravar, assim } = pastasDoMes();
    const usados = new Set(st.posts.map((p) => p.inspiracao && p.inspiracao.link).filter(Boolean));
    return [...gravar, ...assim].filter((p) => !usados.has(p.link));
  }
  async function chamarIdeias(corpo) {
    for (let t = 0; t < 4; t++) {
      const { data, error } = await banco().functions.invoke("painel-conteudo", { body: corpo });
      let msg = data && data.error, limite = data && data.limite;
      if (error) { try { const j = await error.context.json(); msg = j.error; limite = j.limite; } catch (e) { /* segue */ } msg = msg || "A função não respondeu agora."; }
      if (limite) { toast("Esperando 1 minuto pelo limite grátis da IA… pode continuar usando o painel."); await espera(62000); continue; }
      if (msg) throw new Error(msg);
      return data.ideias || [];
    }
    throw new Error("A IA está sem limite agora. Tente de novo daqui a alguns minutos.");
  }
  // monta a grade no ritmo dela: cada espaço (dia + pilar + funil + formato) vira uma ideia com roteiro.
  // Se houver posts nas pastas, cada espaço usa um como referência (com o link), até acabarem.
  async function gerar(modo, notas) {
    if (st.gerando) return;
    const slots = planejarSlots(modo);
    if (!slots.length) { toast(`A grade de ${rotuloMes(st.mes)} já está cheia no seu ritmo. Aumente os posts por semana no seu perfil ou escolha outro mês.`, true); return; }
    const refs = referenciasLivres();
    st.gerando = true; st.progresso = `0 de ${slots.length}`; pintar();
    let feitas = 0;
    const base = { acao: "ideias", rotulo: rotuloMes(st.mes), notas };
    try {
      for (let k = 0; k < slots.length; k += 3) {
        const lote = slots.slice(k, k + 3);
        const loteRefs = refs.splice(0, lote.length);
        const comRef = loteRefs.length === lote.length;
        const ideias = await chamarIdeias({ ...base, quantidade: lote.length, evitar: st.posts.map((p) => p.tema),
          slots: lote.map((x) => ({ pilar: x.pilar, funil: x.funil, formato: x.formato })),
          umaPorReferencia: comRef, inspiracoes: comRef ? loteRefs.map((p) => ({ perfil: p.perfil, tipo: p.tipo, colecao: p.colecao, legenda: p.legenda, transcricao: p.transcricao })) : [] });
        for (const [n, x] of ideias.entries()) {
          const sl = lote[n]; if (!sl) break;
          const r = comRef ? loteRefs[n] : null;
          await salvar({ data: sl.data, horario: sl.horario, pilar: sl.pilar || x.pilar || null, formato: sl.formato, funil: sl.funil, tema: x.tema, tipo_conteudo: x.tipo_conteudo || null, nicho: x.nicho || null, tipo_ugc: x.tipo_ugc, proposito: x.proposito, hook: x.hook, ganchos: x.ganchos, desenvolvimento: x.desenvolvimento, cta: x.cta, tipo_roteiro: x.tipo_roteiro, legenda: x.legenda, porque: x.porque, status: "Roteirizado",
            inspiracao: r ? { link: r.link, perfil: r.perfil ? "@" + r.perfil : x.inspirado_em, colecao: r.colecao, legenda: String(r.legenda || "").split("\n")[0].slice(0, 160), duracao_seg: x.duracao_seg } : { perfil: x.inspirado_em, duracao_seg: x.duracao_seg } });
          feitas++;
        }
        st.progresso = `${feitas} de ${slots.length}`;
        pintar();
      }
      toast(`${feitas} post${feitas === 1 ? "" : "s"} com roteiro na grade de ${rotuloMes(st.mes)}.`);
    } catch (e) { toast(e.message, true); }
    st.gerando = false;
    const prim = st.posts.filter((p) => p.data && p.data >= iso(hoje)).map((p) => p.data).sort()[0] || st.posts.filter((p) => p.data).map((p) => p.data).sort()[0];
    if (prim) st.semana = semanaDe(prim);
    pintar();
  }

  // refaz um post no mesmo lugar (dia, pilar, funil, formato) com o ajuste que ela escreveu
  async function refazer(p, ajuste) {
    const notas = `REFAZER UM POST. Ajuste pedido: ${ajuste || "uma versão melhor, mais no meu tom"}. Versão anterior (não repita igual): tema "${p.tema || ""}", hook "${p.hook || ""}".`;
    const ideias = await chamarIdeias({ acao: "ideias", rotulo: rotuloMes(st.mes), notas, quantidade: 1, evitar: st.posts.filter((x) => x.id !== p.id).map((x) => x.tema),
      slots: [{ pilar: p.pilar || "", funil: p.funil || "Meio", formato: p.formato || "Reels" }] });
    const x = ideias[0];
    if (!x) throw new Error("A IA não devolveu a nova versão. Tente de novo.");
    return salvar({ id: p.id, tema: x.tema, tipo_conteudo: x.tipo_conteudo || p.tipo_conteudo || null, nicho: x.nicho || p.nicho || null, tipo_ugc: x.tipo_ugc, proposito: x.proposito, hook: x.hook, ganchos: x.ganchos, desenvolvimento: x.desenvolvimento, cta: x.cta, tipo_roteiro: x.tipo_roteiro, legenda: x.legenda, porque: x.porque, status: "Roteirizado" });
  }

  // ---------- meu perfil de conteúdo ----------
  async function salvarPerfil(perfil) {
    const { error } = await banco().from("configuracoes").upsert({ chave: "perfil_conteudo", valor: JSON.stringify(perfil), updated_at: new Date().toISOString() }, { onConflict: "chave" });
    if (error) throw new Error(error.message);
    st.perfil = perfil;
  }
  function pintarPerfil() {
    const box = $("#pc-perfil"); if (!box) return;
    const p = st.perfil, r = p.ritmo || PERFIL_PADRAO.ritmo;
    // só redesenha quando o perfil muda (não apaga o que ela está digitando)
    const assinatura = JSON.stringify(p);
    if (box.dataset.v === assinatura) return;
    box.dataset.v = assinatura;
    const aberto = box.querySelector("details") ? box.querySelector("details").open : false;
    const pil = (p.pilares || []).map((x) => x.nome + (x.descricao ? ": " + x.descricao : "")).join("\n");
    const chk = (nome, valor, marcado, rot) => `<label class="pc-chk"><input type="checkbox" name="${nome}" value="${valor}" ${marcado ? "checked" : ""}>${rot}</label>`;
    box.innerHTML = `<details ${aberto ? "open" : ""}><summary class="pc-perfil-cab"><span class="pc-h3">${ic.brilho}Meu perfil de <em>conteúdo</em></span>
        <span class="pc-perfil-resumo">${esc(r.porSemana)} posts por semana · ${esc((r.dias || []).map((d) => DIAS[d]).join(", "))} · ${esc((r.formatos || []).join(" ou "))} · ${["Topo", "Meio", "Fundo"].filter((f) => Number(r.funil[f]) > 0).map((f) => `${r.funil[f]} ${f.toLowerCase()}`).join(" + ")} · ${(p.pilares || []).length} pilares</span></summary>
      <form class="pc-perfil-form" id="pc-perfil-form">
        <p class="pc-ajuda">Tudo o que a IA lê antes de montar a grade. Quanto mais específico, menos genérico sai.</p>
        <div class="pc-grade2">
          <label class="campo"><span>Quem eu sou</span><textarea name="quem" rows="3">${esc(p.quem)}</textarea></label>
          <label class="campo"><span>Objetivo do perfil</span><textarea name="objetivo" rows="3">${esc(p.objetivo)}</textarea></label>
        </div>
        <label class="campo"><span>Pilares (um por linha: Nome: do que fala)</span><textarea name="pilares" rows="5">${esc(pil)}</textarea></label>
        <div class="pc-grade2">
          <label class="campo"><span>Tom de voz</span><textarea name="tom" rows="3">${esc(p.tom)}</textarea></label>
          <label class="campo"><span>Nunca usar</span><textarea name="evitar" rows="3">${esc(p.evitar)}</textarea></label>
        </div>
        <div class="pc-ritmo">
          <label class="campo"><span>Posts por semana</span><input type="number" name="porSemana" min="1" max="14" value="${esc(r.porSemana)}"></label>
          <label class="campo"><span>Horário</span><input name="horario" value="${esc(r.horario || "12h")}"></label>
          <div class="campo"><span>Dias de postar</span><div class="pc-chks">${DIAS.map((d, k) => chk("dias", k, (r.dias || []).includes(k), d)).join("")}</div></div>
          <div class="campo"><span>Formatos</span><div class="pc-chks">${FORMATOS.map((f) => chk("formatos", f, (r.formatos || []).includes(f), f)).join("")}</div></div>
          <div class="campo"><span>Por semana: topo · meio · fundo</span><div class="pc-chks">${FUNIS.map((f) => `<label class="pc-num">${f}<input type="number" name="funil_${f}" min="0" max="14" value="${esc(r.funil[f] || 0)}"></label>`).join("")}</div></div>
        </div>
        <div class="pc-linha"><button class="btn btn-principal" type="submit">Salvar meu perfil</button><button class="login-link" type="button" id="pc-perfil-padrao">voltar ao padrão</button></div>
      </form></details>`;
    $("#pc-perfil-form", box).addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target, v = (n) => f.elements[n].value.trim();
      const marcados = (n) => [...f.querySelectorAll(`[name=${n}]:checked`)].map((x) => x.value);
      const pilares = v("pilares").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf(":"); return i > 0 ? { nome: l.slice(0, i).trim(), descricao: l.slice(i + 1).trim() } : { nome: l, descricao: "" }; });
      const funil = Object.fromEntries(FUNIS.map((x) => [x, Math.max(0, Number(v("funil_" + x)) || 0)]));
      const dias = marcados("dias").map(Number);
      const porSemana = Math.max(1, Number(v("porSemana")) || 3);
      if (!pilares.length) { toast("Coloque pelo menos um pilar.", true); return; }
      if (!dias.length) { toast("Marque os dias em que você quer postar.", true); return; }
      if (dias.length < porSemana) { toast(`Você marcou ${dias.length} dia${dias.length === 1 ? "" : "s"} para ${porSemana} posts por semana. Marque mais dias.`, true); return; }
      const somaFunil = funil.Topo + funil.Meio + funil.Fundo;
      if (somaFunil !== porSemana) { toast(`Topo + meio + fundo somam ${somaFunil}, mas são ${porSemana} posts por semana. Ajuste para bater.`, true); return; }
      const novo = { quem: v("quem"), objetivo: v("objetivo"), pilares, tom: v("tom"), evitar: v("evitar"),
        ritmo: { porSemana, dias, horario: v("horario") || "12h", formatos: marcados("formatos").length ? marcados("formatos") : ["Reels"], funil } };
      try { await salvarPerfil(novo); pintar(); toast("Perfil salvo. A próxima grade já sai com ele."); } catch (er) { toast("Não consegui salvar: " + er.message, true); }
    });
    $("#pc-perfil-padrao", box).addEventListener("click", async () => { if (!(await painelDialogo.confirmar("Voltar o perfil para o padrão?", { ok: "Voltar ao padrão" }))) return; try { await salvarPerfil(PERFIL_PADRAO); pintar(); toast("Perfil voltou ao padrão."); } catch (er) { toast(er.message, true); } });
  }

  // ---------- arquivo das pastas (salvos_instagram.json do programa) ----------
  async function importarArquivo(arq) {
    let j;
    try { j = JSON.parse(await arq.text()); } catch (e) { toast("Esse arquivo não é o salvos_instagram.json do programa.", true); return; }
    const lista = Array.isArray(j && j.salvos) ? j.salvos : [];
    if (!lista.length) { toast("O arquivo veio sem salvos. Rode o programa de novo.", true); return; }
    const comPasta = lista.filter((x) => x.colecao);
    const { data: existentes } = await banco().from("laboratorio").select("id,link,colecao").limit(5000);
    const porLink = new Map((existentes || []).map((r) => [r.link, r]));
    const novos = [];
    for (const x of lista) {
      const m = String(x.link || "").match(/instagram\.com\/(p|reel|reels|tv)\/([\w-]+)/i);
      if (!m) continue;
      const link = `https://www.instagram.com/${m[1].toLowerCase() === "p" ? "p" : "reel"}/${m[2]}/`;
      const ja = porLink.get(link);
      if (ja) { if (x.colecao && ja.colecao !== x.colecao) await banco().from("laboratorio").update({ colecao: x.colecao }).eq("id", ja.id); continue; }
      novos.push({ link, codigo: m[2], perfil: x.perfil || null, tipo: ["Reel", "Carrossel", "Post"].includes(x.tipo) ? x.tipo : null, legenda: x.legenda || null, colecao: x.colecao || null, status: "novo", etapa: "Nova" });
    }
    for (let k = 0; k < novos.length; k += 200) {
      const { error } = await banco().from("laboratorio").upsert(novos.slice(k, k + 200), { onConflict: "link", ignoreDuplicates: true });
      if (error) { toast("Não consegui salvar: " + error.message, true); return; }
    }
    await carregar(); pintar();
    const pastas = [...new Set(comPasta.map((x) => x.colecao))];
    toast(`${lista.length} salvos lidos${pastas.length ? `, pastas: ${pastas.join(", ")}` : ""}.`);
  }

  // ---------- transcrever os Reels das pastas ----------
  async function transcreverPastas() {
    if (st.transcrevendo) return;
    if (!window.painelSupadata || !window.painelSupadata.transcrever) { toast("Abra a página Transcrever vídeo uma vez e tente de novo.", true); return; }
    const { gravar, assim } = pastasDoMes();
    const alvo = [...gravar, ...assim].filter((p) => p.tipo === "Reel" && !p.transcricao).slice(0, 12);
    if (!alvo.length) { toast("Os Reels das pastas já estão transcritos."); return; }
    st.transcrevendo = true; pintar();
    let ok = 0;
    for (const p of alvo) {
      try {
        const r = await window.painelSupadata.transcrever(p.link);
        if (r && r.texto) { await banco().from("laboratorio").update({ transcricao: r.texto }).eq("id", p.id); p.transcricao = r.texto; ok++; }
      } catch (e) { if (e && e.tipo === "chave") { toast("Conecte a Supadata na página Transcrever vídeo.", true); break; } }
      pintar();
    }
    st.transcrevendo = false; pintar();
    toast(`${ok} Reel${ok === 1 ? "" : "s"} transcrito${ok === 1 ? "" : "s"}.`);
  }

  // ---------- semanas do mês ----------
  function semanasDoMes() {
    const [a, m] = st.mes.split("-").map(Number);
    const primeiro = new Date(a, m - 1, 1), ultimo = new Date(a, m, 0);
    const ini = new Date(primeiro); ini.setDate(ini.getDate() - ((ini.getDay() + 6) % 7));
    const semanas = [];
    for (let d = new Date(ini); d <= ultimo; d.setDate(d.getDate() + 7)) {
      semanas.push(Array.from({ length: 7 }, (_, k) => { const x = new Date(d); x.setDate(x.getDate() + k); return x; }));
    }
    return semanas;
  }
  function semanaDe(dataIso) { const s = semanasDoMes(); const i = s.findIndex((sem) => sem.some((d) => iso(d) === dataIso)); return i < 0 ? 0 : i; }

  // ---------- tela ----------
  const ic = {
    brilho: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
    mais: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    esq: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    dir: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    x: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    ajustes: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
    seta: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    lixo: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    pasta: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>',
    sino: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/></svg>',
  };
  function opcoesMes() {
    const lista = [];
    for (let k = -2; k <= 4; k++) { const d = new Date(hoje.getFullYear(), hoje.getMonth() + k, 1); lista.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); }
    if (!lista.includes(st.mes)) lista.push(st.mes);
    return lista;
  }

  function montar(sec) {
    sec.innerHTML = `<div class="cr-pagina cr-pagina-larga pc pc2">
      <header class="pc2-cab">
        <div><small class="pc2-sobre">Conteúdos</small><h2 class="pc2-titulo">Meus <em>conteúdos</em></h2></div>
        <div class="pc2-cab-acoes"><button class="btn" type="button" id="pc-ajustes" aria-expanded="false">${ic.ajustes}Ajustes e IA</button><button class="btn btn-principal" type="button" id="pc-novo">${ic.mais}Novo conteúdo</button></div>
      </header>
      <nav class="sub-abas pc-abas" aria-label="Partes de Conteúdos">
        <button type="button" class="sub-aba" data-pcaba="geral">Visão geral</button><button type="button" class="sub-aba" data-pcaba="quadro">Quadro de produção</button><button type="button" class="sub-aba" data-pcaba="cal">Calendário editorial</button><button type="button" class="sub-aba" data-pcaba="ideias">Banco de ideias</button>
      </nav>
      <section data-pcpar="geral" id="pc-geral"></section>
      <section data-pcpar="quadro" id="pc-kanban"></section>
      <section data-pcpar="cal" class="pc2-cal">
        <div class="pc-cal-cab">
          <div class="pc2-cal-tit"><select class="entrada" id="pc-mes" aria-label="Mês"></select><span class="pc-ajuda" id="pc-sobre-mes" hidden></span>
            <div class="pc2-seg" role="group" aria-label="Visualização"><button type="button" data-calvista="mes">Mensal</button><button type="button" data-calvista="semana">Semanal</button></div></div>
          <div class="pc-cal-nav"><button class="icone-btn" type="button" id="pc-ant" aria-label="Anterior">${ic.esq}</button><button class="icone-btn" type="button" id="pc-prox" aria-label="Próximo">${ic.dir}</button><button class="btn pc-btn-hoje" type="button" id="pc-hoje">Hoje</button><span id="pc-semana-rot"></span></div>
        </div>
        <p class="pc-ajuda pc2-dica">Arraste um conteúdo para outro dia para mudar a data. O + cria um conteúdo naquele dia. Toque num conteúdo para ver tudo.</p>
        <div class="pc-legenda" id="pc-legenda"></div>
        <div class="pc-numeros" id="pc-numeros" hidden></div><span id="pc-nsem" hidden></span>
        <div class="pc-cal" id="pc-quadro"></div>
        <div class="pc-cal" id="pc-semanal" hidden></div>
      </section>
      <section data-pcpar="ideias" id="pc-ideias"></section>
      <div id="pc-config" data-pcpar="cfg" hidden>
        <div class="pc2-cfg-cab"><h3 class="pc2-h">Ajustes e <em>IA</em></h3><button class="btn" type="button" id="pc-cfg-fechar">${ic.x}Fechar</button></div>
        <section class="pc-cartao pc-perfil" id="pc-perfil"></section>
        <div class="pc-baixo">
          <section class="pc-cartao pc-gerar">
            <h3 class="pc-h3">Gerar a grade no meu ritmo</h3>
            <p class="pc-ajuda" id="pc-gerar-ajuda"></p>
            <textarea class="entrada" id="pc-notas" rows="2" placeholder="Algum pedido? Ex.: foco em maternidade, uma publi de cabelo, conteúdo para atrair marcas de casa..."></textarea>
            <div class="pc-linha"><select class="entrada" id="pc-qtd" aria-label="Quanto gerar"><option value="mes" selected>Mês completo</option><option value="semana">Só a próxima semana</option></select>
              <button class="btn btn-principal" type="button" id="pc-gerar"></button></div>
          </section>
          <section class="pc-cartao" id="pc-pastas"></section>
          <section class="pc-cartao pc-iphone" id="pc-iphone"></section>
        </div>
      </div>
    </div>`;
    // quatro áreas em abas; Ajustes e IA abre por botão (perfil, gerar grade, pastas, iPhone). A escolha fica guardada.
    let anterior = "geral";
    const mostrarParte = (k) => {
      if (k !== "cfg") anterior = k;
      $$("[data-pcaba]", sec).forEach((b) => { b.classList.toggle("ativa", b.dataset.pcaba === k); b.setAttribute("aria-current", b.dataset.pcaba === k ? "page" : "false"); });
      $$("[data-pcpar]", sec).forEach((p) => { p.hidden = p.dataset.pcpar !== k; });
      $("#pc-ajustes", sec).setAttribute("aria-expanded", String(k === "cfg"));
      try { localStorage.setItem("pc-parte2", k === "cfg" ? anterior : k); } catch (e) { /* sem armazenamento */ }
    };
    st.mostrarParte = mostrarParte;
    let parte = "geral"; try { parte = localStorage.getItem("pc-parte2") || "geral"; } catch (e) { /* sem armazenamento */ }
    mostrarParte(["geral", "quadro", "cal", "ideias"].includes(parte) ? parte : "geral");
    $$("[data-pcaba]", sec).forEach((b) => b.addEventListener("click", () => mostrarParte(b.dataset.pcaba)));
    $("#pc-ajustes", sec).addEventListener("click", () => mostrarParte($("#pc-config", sec).hidden ? "cfg" : anterior));
    $("#pc-cfg-fechar", sec).addEventListener("click", () => mostrarParte(anterior));
    $("#pc-novo", sec).addEventListener("click", () => abrir(novoConteudo({})));
    $$("[data-calvista]", sec).forEach((b) => b.addEventListener("click", () => { st.cal = b.dataset.calvista; if (st.cal === "semana" && !st.semIni) st.semIni = segundaDe(iso(hoje)); pintar(); }));
    const sel = $("#pc-mes", sec);
    sel.addEventListener("change", () => { st.mes = sel.value; st.semana = 0; ajustarSemana(); pintar(); });
    const trocarMes = (k) => {
      if (st.cal === "semana") { const d = deIso(st.semIni || segundaDe(iso(hoje))); d.setDate(d.getDate() + 7 * k); st.semIni = iso(d); st.mes = st.semIni.slice(0, 7); pintar(); return; }
      const [a, m] = st.mes.split("-").map(Number); const d = new Date(a, m - 1 + k, 1); st.mes = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; ajustarSemana(); pintar();
    };
    $("#pc-ant", sec).addEventListener("click", () => trocarMes(-1));
    $("#pc-prox", sec).addEventListener("click", () => trocarMes(1));
    $("#pc-hoje", sec).addEventListener("click", () => {
      st.mes = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}`; st.semIni = segundaDe(iso(hoje)); ajustarSemana(); pintar();
      if (st.cal === "mes") { const alvo = $("#pc-sem-" + st.semana, sec); if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" }); }
    });
    $("#pc-qtd", sec).addEventListener("change", pintar);
    $("#pc-gerar", sec).addEventListener("click", () => gerar($("#pc-qtd", sec).value, $("#pc-notas", sec).value.trim()));
  }
  const segundaDe = (dataIso) => { const d = deIso(dataIso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
  // conteúdo novo: o mesmo formulário em qualquer lugar (coluna do quadro, dia do calendário, banco de ideias)
  const novoConteudo = (extra) => ({ horario: (st.perfil.ritmo || {}).horario || "12h", formato: "Reels", status: "Ideia", funil: "Topo", ...extra });
  function ajustarSemana() {
    const [a, m] = st.mes.split("-").map(Number);
    st.semana = a === hoje.getFullYear() && m === hoje.getMonth() + 1 ? semanaDe(iso(hoje)) : 0;
  }

  // cor do cartão pelo pilar (na paleta dela); Stories aparecem como texto no dia, como na referência
  const CORES_PIL = 6;
  const indicePilar = (nome) => { const i = (st.perfil.pilares || []).findIndex((x) => x.nome === nome); return i < 0 ? -1 : i % CORES_PIL; };
  const funilIc = '<svg class="traco pc-funil" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M7 10h10M10 15h4M11.5 19.5h1"/></svg>';
  // calendário = só agenda: pílulas de publicação (orgânico ou publi), gravação e compromissos dos jobs
  const ehPubli = (p) => Boolean(p.marca) || p.tipo_conteudo === "Publi";
  const tipoTxt = (p) => (ehPubli(p) ? "Publi" + (p.marca ? " · " + p.marca : "") : p.tipo_conteudo || "");
  function pilulas(s2) {
    const pubs = st.todos.filter((p) => p.data === s2).map((p) => `<button type="button" class="pc3-pill ${ehPubli(p) ? "k-publi" : "k-org"}${p.status === "Publicado" ? " feito" : ""}" data-id="${p.id}" data-arrasta="pub:${p.id}" title="${esc([p.tema, p.formato, tipoTxt(p), p.horario, p.status].filter(Boolean).join(" · "))}">${esc(p.tema || "Sem título")}</button>`);
    const gravs = st.todos.filter((p) => p.data_gravacao === s2 && p.status !== "Publicado").map((p) => `<button type="button" class="pc3-pill k-grav" data-id="${p.id}" data-arrasta="grav:${p.id}" title="Gravação de ${esc(p.tema || "")}">Gravar: ${esc(p.tema || "Sem título")}</button>`);
    const comp = (st.agenda || []).filter((x) => x.data === s2).map((x) => `<button type="button" class="pc3-pill k-comp" ${x.ir ? `data-ir="${x.ir}"` : ""} title="${esc(x.rotulo + ": " + x.texto)}">${esc(x.texto)} · ${esc(x.rotulo.replace(/^PUBLI · /, "").replace(/^AGENDA · ?/, "").toLowerCase())}</button>`);
    return gravs.join("") + pubs.join("") + comp.join("");
  }
  function celulaDia(d, fora) {
    const s2 = iso(d);
    return `<div class="pc3-dia${fora ? " fora" : ""}${s2 === iso(hoje) ? " hoje" : ""}" data-dia="${s2}"><div class="pc3-dia-cab"><b>${d.getDate()}</b><button type="button" class="pc3-add" data-novo="${s2}" aria-label="Novo conteúdo em ${d.getDate()}/${pad(d.getMonth() + 1)}">${ic.mais}</button></div>${pilulas(s2)}</div>`;
  }
  async function salvarTema(seg, texto) {
    st.temas = { ...(st.temas || {}) }; if (texto) st.temas[seg] = texto; else delete st.temas[seg];
    const { error } = await banco().from("configuracoes").upsert({ chave: "temas_semana", valor: JSON.stringify(st.temas), updated_at: new Date().toISOString() }, { onConflict: "chave" });
    if (error) toast(error.message, true);
  }

  function pintar() {
    const sec = document.getElementById("aba-" + ABA);
    if (!sec || !$("#pc-quadro", sec)) return;
    $("#pc-mes", sec).innerHTML = opcoesMes().map((m) => `<option value="${m}" ${m === st.mes ? "selected" : ""}>${rotuloMes(m)}</option>`).join("");
    $("#pc-sobre-mes", sec).textContent = rotuloMes(st.mes);
    if (st.faltaTabela) { $("#pc-quadro", sec).innerHTML = `<p class="faixa faixa-erro">A tabela do Painel de conteúdo ainda não existe no banco.</p>`; return; }
    const semanas = semanasDoMes(); st.semana = Math.min(st.semana, semanas.length - 1);
    const mesNum = Number(st.mes.split("-")[1]) - 1, br = (d) => `${d.getDate()}/${pad(d.getMonth() + 1)}`;
    $("#pc-semana-rot", sec).textContent = rotuloMes(st.mes);
    $("#pc-legenda", sec).innerHTML = `<span><i class="k-org"></i>Orgânico</span><span><i class="k-publi"></i>Publi</span><span><i class="k-grav"></i>Gravação</span><span><i class="k-comp"></i>Entregas e compromissos de jobs</span>`;
    $("#pc-quadro", sec).innerHTML = `<div class="pc3-cal-dias">${DIAS.map((d) => `<span>${d}</span>`).join("")}</div>` + semanas.map((sem, n) => {
      const seg = iso(sem[0]), tema = (st.temas || {})[seg];
      return `<div class="pc3-sem${sem.some((d) => iso(d) === iso(hoje)) ? " atual" : ""}" id="pc-sem-${n}">
        <button type="button" class="pc3-tema${tema ? " tem" : ""}" data-tema="${seg}" title="Tema da semana">${tema ? esc(tema) : "+ tema da semana"}</button>
        <div class="pc3-grade">${sem.map((d) => celulaDia(d, d.getMonth() !== mesNum)).join("")}</div></div>`;
    }).join("");
    $$("[data-tema]", sec).forEach((b) => b.addEventListener("click", async () => {
      const atual = (st.temas || {})[b.dataset.tema] || "";
      const novo = await painelDialogo.texto("Tema desta semana (ex.: Black Friday para marcas). Deixe vazio para tirar.", atual);
      if (novo === null) return; await salvarTema(b.dataset.tema, novo.trim()); pintar();
    }));
    pintarSemanal(sec);
    pintarGeral(sec); pintarKanban(sec); pintarIdeias(sec);
    const cal = $("[data-pcpar=cal]", sec);
    ligarCliques(cal);
    $$("[data-ir]", cal).forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); location.hash = "#" + b.dataset.ir; }));
    $$("[data-novo]", cal).forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); abrir(novoConteudo({ data: b.dataset.novo, status: "Roteirizado" })); }));
    // arrastar: a publicação muda a data de publicação; a gravação muda a data de gravação (sempre o mesmo cadastro)
    $$("[data-arrasta]", cal).forEach((b) => { b.draggable = true; b.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/cal", b.dataset.arrasta)); });
    $$(".pc3-dia", cal).forEach((col) => {
      col.addEventListener("dragover", (e) => { if ([...e.dataTransfer.types].includes("text/cal")) { e.preventDefault(); col.classList.add("alvo"); } });
      col.addEventListener("dragleave", () => col.classList.remove("alvo"));
      col.addEventListener("drop", async (e) => {
        e.preventDefault(); col.classList.remove("alvo");
        const [tipo, id] = String(e.dataTransfer.getData("text/cal")).split(":");
        const p = st.todos.find((x) => String(x.id) === id); if (!p) return;
        const campo = tipo === "grav" ? "data_gravacao" : "data";
        if (p[campo] === col.dataset.dia) return;
        try { await salvar({ id: p.id, [campo]: col.dataset.dia }); pintar(); toast(tipo === "grav" ? "Gravação remarcada." : "Data de publicação mudada."); } catch (er) { toast(er.message, true); }
      });
    });
    const bt = $("#pc-gerar", sec);
    const livres = referenciasLivres().length;
    const espacos = planejarSlots($("#pc-qtd", sec).value).length;
    bt.disabled = st.gerando; bt.innerHTML = st.gerando ? `Montando a grade… ${esc(st.progresso || "")}` : espacos ? `${ic.brilho}Gerar ${espacos} post${espacos === 1 ? "" : "s"}` : `${ic.brilho}Grade cheia`;
    const r = st.perfil.ritmo || PERFIL_PADRAO.ritmo;
    $("#pc-gerar-ajuda", sec).textContent = `No seu ritmo (${r.porSemana} por semana, ${(r.dias || []).map((d) => DIAS[d]).join(", ")}), cada espaço livre ganha um pilar em rodízio, o funil da semana e o formato, e a IA escreve o roteiro no seu tom pelo método da Lara (hook, desenvolvimento com direção de cena, CTA e legenda).${livres ? ` ${livres} post${livres === 1 ? "" : "s"} das suas pastas entram como referência, com o link, sem copiar as falas.` : ""}`;
    pintarPerfil();
    pintarPastas();
    pintarIphone();
  }

  function pintarPastas() {
    const box = $("#pc-pastas"); if (!box) return;
    const { gravar, assim, outras } = pastasDoMes();
    const nomeMes = MESES[Number(st.mes.split("-")[1]) - 1];
    const lista = (arr) => arr.length ? `<ul class="pc-insp">${arr.slice(0, 8).map((p) => `<li><a href="${esc(p.link)}" target="_blank" rel="noopener">@${esc(p.perfil || "post")}</a> <small>${esc(p.tipo || "")}${p.transcricao ? " · transcrito" : ""}</small><span>${esc(String(p.legenda || "").split("\n")[0].slice(0, 90))}</span></li>`).join("")}</ul>${arr.length > 8 ? `<p class="pc-ajuda">e mais ${arr.length - 8}</p>` : ""}` : "";
    const faltaReel = [...gravar, ...assim].filter((p) => p.tipo === "Reel" && !p.transcricao).length;
    box.innerHTML = `<h3 class="pc-h3">${ic.pasta}Suas pastas do Instagram</h3>
      <div class="pc-pasta"><b>Gravar em ${esc(nomeMes)}</b><small>${gravar.length} post${gravar.length === 1 ? "" : "s"}</small></div>${lista(gravar)}
      <div class="pc-pasta"><b>Produzir vídeos assim</b><small>${assim.length} post${assim.length === 1 ? "" : "s"}</small></div>${lista(assim)}
      ${faltaReel ? `<button class="btn" type="button" id="pc-transcrever" ${st.transcrevendo ? "disabled" : ""}>${st.transcrevendo ? "Transcrevendo…" : `Transcrever ${faltaReel} Reel${faltaReel === 1 ? "" : "s"} (ideias melhores)`}</button>` : ""}
      ${!gravar.length && !assim.length ? `<div class="pc-passos"><p class="pc-ajuda">Está em 0 porque o Instagram não deixa nenhum site ler suas pastas de salvos sozinho. Tem dois jeitos de trazer: pelo iPhone (cartão abaixo, cada post que você salvar) ou tudo de uma vez pelo computador.</p><p class="pc-ajuda"><b>Trazer as pastas inteiras (no Windows):</b></p>
        <ol class="pc-ajuda"><li>Aperte a tecla <b>Windows</b>, digite <b>PowerShell</b> e abra.</li><li>Cole a linha abaixo e aperte <b>Enter</b>. Se abrir a Microsoft Store pedindo o Python, instale e rode a linha de novo.</li><li>Ele entra pelo Instagram que já está aberto no seu navegador (sem senha) e grava <b>salvos_instagram.json</b> na Área de Trabalho.</li><li>Envie esse arquivo no botão abaixo.</li></ol>
        <div class="lab-comando"><code id="pc-cmd">${CMD_WIN}</code><button class="btn" type="button" id="pc-copiar">Copiar</button></div></div>` : ""}
      <label class="btn pc-enviar">${ic.pasta}Enviar arquivo das pastas<input type="file" id="pc-arquivo" accept=".json" hidden></label>
      ${outras.length ? `<p class="pc-ajuda">Outras pastas que chegaram: ${outras.map(esc).join(", ")}.</p>` : ""}`;
    const t = $("#pc-transcrever", box); if (t) t.addEventListener("click", transcreverPastas);
    const c = $("#pc-copiar", box); if (c) c.addEventListener("click", async () => { try { await navigator.clipboard.writeText(CMD_WIN); toast("Copiado. Cole no PowerShell."); } catch (e) { toast("Selecione a linha e copie com Ctrl+C.", true); } });
    $("#pc-arquivo", box).addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) importarArquivo(f); });
  }

  // ---------- iPhone: salvar pelo atalho e receber a ideia por notificação (app ntfy) ----------
  const LINK_SALVAR = "https://marianabonetto.com.br/admin/salvar/?l=";
  async function ligarNotificacoes() {
    const letras = "abcdefghijkmnpqrstuvwxyz23456789";
    const aleat = [...crypto.getRandomValues(new Uint8Array(18))].map((n) => letras[n % letras.length]).join("");
    const topico = "mari-painel-" + aleat;
    const { error } = await banco().from("configuracoes").upsert({ chave: "ntfy_topico", valor: topico, updated_at: new Date().toISOString() }, { onConflict: "chave" });
    if (error) { toast("Não consegui ligar: " + error.message, true); return; }
    st.topico = topico; pintarIphone();
  }
  async function testarNotificacao(bt) {
    bt.disabled = true;
    const { data, error } = await banco().functions.invoke("painel-conteudo", { body: { acao: "notif_teste" } });
    let msg = data && data.error;
    if (error) { try { msg = (await error.context.json()).error; } catch (e) { msg = "A função não respondeu agora."; } }
    bt.disabled = false;
    toast(msg || "Mandei! Olhe o iPhone.", Boolean(msg));
  }
  function pintarIphone() {
    const box = $("#pc-iphone"); if (!box) return;
    const copiar = (id, texto, aviso) => { const b = $(id, box); if (b) b.addEventListener("click", async () => { try { await navigator.clipboard.writeText(texto); toast(aviso); } catch (e) { toast("Selecione e copie com Ctrl+C.", true); } }); };
    box.innerHTML = `<h3 class="pc-h3">${ic.sino}No iPhone: salvou, chegou a ideia</h3>
      <p class="pc-ajuda">O Instagram não avisa ninguém quando você salva um post. Então, no iPhone, você manda o post para o painel pelo botão de compartilhar: eu guardo na pasta, crio a ideia com roteiro nesta grade e te mando uma notificação com o hook e o CTA.</p>
      <p class="pc-ajuda">A notificação chega no painel instalado na Tela de Início (ative em <a href="#notificacoes">Geral > Notificações no celular</a>). O app ntfy abaixo é opcional, uma reserva.</p>
      ${st.topico ? `<details class="pc-passos" open><summary><b>1. Notificações (uma vez)</b></summary><ol class="pc-ajuda">
          <li>Instale o app grátis <b>ntfy</b> na App Store.</li>
          <li>Abra, toque em <b>+</b> e cole este nome em <b>Topic</b> (deixe o servidor como está): <span class="lab-comando"><code>${esc(st.topico)}</code><button class="btn" type="button" id="pc-copiar-topico">Copiar</button></span></li>
          <li>Permita as notificações e toque em <button class="btn" type="button" id="pc-testar">Mandar teste</button></li></ol>
          <p class="pc-ajuda">Esse nome é o endereço secreto das suas notificações. Não mostre para ninguém. Se vazar, toque em <button class="login-link" type="button" id="pc-novo-topico">trocar o endereço</button>.</p></details>
        <details class="pc-passos"><summary><b>2. Atalho "Salvar no painel" (uma vez)</b></summary><ol class="pc-ajuda">
          <li>Abra o app <b>Atalhos</b>, toque em <b>+</b> e dê o nome <b>Salvar no painel</b>.</li>
          <li>Toque no ⓘ (ou na setinha do nome) e ligue <b>Mostrar na Folha de Compartilhamento</b>. Em tipos, deixe só <b>URLs</b>.</li>
          <li>Adicione a ação <b>Codificar URL</b> (ela usa a Entrada do Atalho).</li>
          <li>Adicione a ação <b>Abrir URLs</b> e escreva este endereço, colocando no fim a variável <b>URL Codificada</b>: <span class="lab-comando"><code>${LINK_SALVAR}</code><button class="btn" type="button" id="pc-copiar-link">Copiar</button></span></li>
          <li>Na primeira vez a página pede seu e-mail e senha do painel. Depois fica salvo.</li></ol></details>
        <details class="pc-passos"><summary><b>3. No dia a dia</b></summary><ol class="pc-ajuda">
          <li>No Instagram, salve o post na pasta como sempre.</li>
          <li>Toque no aviãozinho de compartilhar, depois em <b>Compartilhar em…</b> (ou <b>Mais</b>) e escolha <b>Salvar no painel</b>.</li>
          <li>Toque na pasta. Em 1 ou 2 minutos chega a notificação com a ideia. Tocando nela, abre este painel.</li></ol>
          <p class="pc-ajuda">Sem o atalho também dá: copie o link do post e abra <a href="../admin/salvar/" target="_blank" rel="noopener">marianabonetto.com.br/admin/salvar</a> (dá para pôr na Tela de Início).</p></details>`
        : `<button class="btn btn-principal" type="button" id="pc-ligar">Ligar as notificações no iPhone</button>`}`;
    const l = $("#pc-ligar", box); if (l) l.addEventListener("click", ligarNotificacoes);
    const t = $("#pc-testar", box); if (t) t.addEventListener("click", () => testarNotificacao(t));
    const n = $("#pc-novo-topico", box); if (n) n.addEventListener("click", async () => { if (await painelDialogo.confirmar("Trocar o endereço? Depois você assina o novo no app ntfy.", { ok: "Trocar" })) ligarNotificacoes(); });
    copiar("#pc-copiar-topico", st.topico, "Copiado. Cole no app ntfy.");
    copiar("#pc-copiar-link", LINK_SALVAR, "Copiado. Cole na ação Abrir URLs.");
  }

  // ---------- janela do post ----------
  let dlg = null;
  function abrir(p) {
    if (!p) return;
    if (!dlg) { dlg = document.createElement("dialog"); dlg.className = "janela larga"; document.body.appendChild(dlg); dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }); }
    const opt = (arr, v) => arr.map((x) => `<option ${x === v ? "selected" : ""}>${esc(x)}</option>`).join("");
    const tipos = TIPOS.includes(p.tipo_ugc) || !p.tipo_ugc ? TIPOS : [p.tipo_ugc, ...TIPOS];
    const ganchos = Array.isArray(p.ganchos) ? p.ganchos : [];
    const insp = p.inspiracao || {};
    dlg.innerHTML = `<div class="janela-cabeca"><div><small class="janela-sobretitulo">Conteúdos · ${esc(p.status || "Ideia")}</small><h2>${p.id ? esc(p.tema || "Conteúdo") : "Novo conteúdo"}</h2></div><button class="icone-btn" type="button" data-fechar aria-label="Fechar">${ic.x}</button></div>
      <div class="janela-corpo pc-form">
        ${insp.link ? `<div class="pc-ref"><small>Referência</small><a href="${esc(insp.link)}" target="_blank" rel="noopener">${esc(insp.perfil || "Abrir o post")} · abrir no Instagram</a>${insp.legenda ? `<span>${esc(insp.legenda)}</span>` : ""}${insp.colecao ? `<em>pasta ${esc(insp.colecao)}</em>` : ""}</div>` : ""}
        <label class="campo pc-largo"><span>Título</span><input name="tema" value="${esc(p.tema)}"></label>
        <div class="pc-grade4 pc-grade5">
          <label class="campo"><span>Publicação</span><input type="date" name="data" value="${esc(p.data || "")}"></label>
          <label class="campo"><span>Gravação</span><input type="date" name="data_gravacao" value="${esc(p.data_gravacao || "")}"></label>
          <label class="campo"><span>Horário</span><input name="horario" value="${esc(p.horario || "")}" placeholder="12h"></label>
          <label class="campo"><span>Formato</span><select name="formato">${opt(FORMATOS, p.formato)}</select></label>
          <label class="campo"><span>Status</span><select name="status">${opt(STATUS, p.status)}</select></label>
        </div>
        <div class="pc-grade3">
          <label class="campo"><span>Tipo</span><select name="tipo_conteudo"><option value=""></option>${opt(TIPOS_CONTEUDO, p.tipo_conteudo)}</select></label>
          <label class="campo"><span>Nicho</span><select name="nicho"><option value=""></option>${opt([...new Set([...NICHOS, ...(p.nicho ? [p.nicho] : [])])], p.nicho)}</select></label>
          <label class="campo"><span>Marca (publi)</span><input name="marca" value="${esc(p.marca || "")}" placeholder="só quando é publicidade"></label>
        </div>
        <div class="pc-grade2">
          <label class="campo"><span>Pilar</span><select name="pilar"><option value=""></option>${opt([...new Set([...(st.perfil.pilares || []).map((x) => x.nome), ...(p.pilar ? [p.pilar] : [])])], p.pilar)}</select></label>
          ${p.id ? `<div class="campo"><span>Não gostou? Refazer com ajuste</span><div class="pc-linha"><input class="entrada" id="pc-ajuste" placeholder="Ex.: mais leve, troca por produto de casa"><button class="btn" type="button" data-refazer>Refazer</button></div></div>` : ""}
        </div>
        <div class="pc-grade3">
          <label class="campo"><span>Tipo de roteiro</span><select name="tipo_roteiro"><option value=""></option>${opt(ROTEIROS, p.tipo_roteiro)}</select></label>
          <label class="campo"><span>Tipo de UGC</span><select name="tipo_ugc"><option value=""></option>${opt(tipos, p.tipo_ugc)}</select></label>
          <label class="campo"><span>Funil</span><select name="funil">${opt(FUNIS, p.funil)}</select></label>
        </div>
        ${p.porque ? `<div class="pc-porque"><small>Por que atrai marca</small>${esc(p.porque)}</div>` : ""}
        ${p.roteiro_id ? `<p class="pc-ajuda pc-ligado">Este conteúdo está ligado a um roteiro em Meus roteiros. Edite o roteiro por lá (botão Abrir roteiro).</p>` : ""}
        <label class="campo pc-largo"><span>Objetivo</span><input name="proposito" value="${esc(p.proposito)}" placeholder="Para que serve esse conteúdo no seu perfil"></label>
        <label class="campo pc-largo"><span>Hook</span><textarea name="hook" rows="2">${esc(p.hook)}</textarea></label>
        ${ganchos.length ? `<div class="pc-ganchos"><small>Outras opções de gancho (toque para usar)</small>${ganchos.map((g) => `<button type="button" class="cr-chip" data-gancho>${esc(g)}</button>`).join("")}</div>` : ""}
        <label class="campo pc-largo"><span>Desenvolvimento do roteiro</span><textarea name="desenvolvimento" rows="9">${esc(p.desenvolvimento)}</textarea></label>
        <label class="campo pc-largo"><span>CTA</span><input name="cta" value="${esc(p.cta)}"></label>
        <label class="campo pc-largo"><span>Legenda e hashtags</span><textarea name="legenda" rows="4">${esc(p.legenda)}</textarea></label>
        <label class="campo pc-largo"><span>Notas</span><textarea name="notas" rows="2">${esc(p.notas)}</textarea></label>
        ${insp.duracao_seg || (!insp.link && insp.perfil) ? `<p class="pc-ajuda">${!insp.link && insp.perfil ? `Inspirado em ${esc(insp.perfil)}. ` : ""}${insp.duracao_seg ? `Duração estimada: ${insp.duracao_seg}s.` : ""}</p>` : ""}
      </div>
      <div class="janela-rodape">${p.id ? `<button class="btn btn-perigo" type="button" data-excluir>Excluir</button>` : ""}<span style="flex:1"></span>
        ${p.id && p.roteiro_id ? `<button class="btn" type="button" data-abrir-roteiro>Abrir roteiro</button>` : ""}
        ${p.id && !p.roteiro_id ? `<button class="btn" type="button" data-quadro title="Copia o que está aqui para Meus roteiros e liga os dois">Mandar para Meus roteiros</button><button class="btn" type="button" data-skill>Criar roteiro com a Skill</button>` : ""}
        <button class="btn btn-principal" type="button" data-salvar>Salvar</button></div>`;
    const ler = () => { const o = { ...p }; $$("[name]", dlg).forEach((el) => { o[el.name] = el.value.trim() || null; }); o.status = o.status || "Ideia"; return o; };
    $("[data-fechar]", dlg).addEventListener("click", () => dlg.close());
    $$("[data-gancho]", dlg).forEach((b) => b.addEventListener("click", () => { const h = $("[name=hook]", dlg); const antigo = h.value; h.value = b.textContent; b.textContent = antigo; }));
    $("[data-salvar]", dlg).addEventListener("click", async () => {
      try { const o = ler(); if (o.data && !o.data.startsWith(st.mes)) { o.mes = o.data.slice(0, 7); } await salvar(o); dlg.close(); if (o.data) st.semana = semanaDe(o.data); pintar(); toast("Conteúdo salvo."); }
      catch (e) { toast("Não consegui salvar: " + e.message, true); }
    });
    const rf = $("[data-refazer]", dlg);
    if (rf) rf.addEventListener("click", async () => {
      rf.disabled = true; rf.textContent = "Refazendo…";
      try { const o = ler(); await salvar({ ...o, id: p.id }); const novo = await refazer({ ...p, ...o }, $("#pc-ajuste", dlg).value.trim()); pintar(); abrir(novo); toast("Nova versão pronta."); }
      catch (e) { toast(e.message, true); rf.disabled = false; rf.textContent = "Refazer"; }
    });
    const ex = $("[data-excluir]", dlg);
    if (ex) ex.addEventListener("click", async () => {
      if (!(await painelDialogo.confirmar("Excluir este conteúdo? Ele sai do quadro, do calendário e da visão geral.", { ok: "Excluir", perigo: true }))) return;
      const { error } = await banco().from("painel_conteudo").delete().eq("id", p.id);
      if (error) { toast(error.message, true); return; }
      st.todos = st.todos.filter((x) => x.id !== p.id); dlg.close(); pintar();
    });
    const q = $("[data-quadro]", dlg);
    if (q) q.addEventListener("click", async () => {
      if (!window.painelRoteiros || !window.painelRoteiros.salvarNoQuadro) { toast("Abra Meus roteiros uma vez e tente de novo.", true); return; }
      const o = ler();
      const conteudo = [o.proposito && "PROPÓSITO:\n" + o.proposito, o.hook && "HOOK:\n" + o.hook, o.desenvolvimento && "DESENVOLVIMENTO:\n" + o.desenvolvimento, o.cta && "CTA:\n" + o.cta, o.legenda && "LEGENDA:\n" + o.legenda, p.porque && "POR QUE ATRAI MARCA:\n" + p.porque, insp.link && "REFERÊNCIA:\n" + insp.link].filter(Boolean).join("\n\n");
      const rid = "pc" + p.id + "-" + Date.now().toString(36);
      const ok = await window.painelRoteiros.salvarNoQuadro({ id: rid, titulo: o.tema || "Post do painel", plataforma: "Instagram", status: "Em aberto", finalidade: "Conteúdos", etapa: o.status === "Ideia" ? "Ideias" : "Roteirização", conteudo, gancho: o.hook || "", formato: o.formato || "", tipoUgc: o.tipo_ugc || "", funil: o.funil || "", referencia: insp.link || "", dataPublicacao: o.data || "",
        origem: { tipo: "conteudo", id: String(p.id) }, historico: [{ em: new Date().toISOString(), acao: "Veio de Conteúdos" }] });
      // os dois ficam ligados: o conteúdo guarda o id do roteiro (sem cópia solta)
      if (ok) { await salvar({ ...o, id: p.id, roteiro_id: rid }); dlg.close(); pintar(); toast("Mandado para Meus roteiros e ligado a este conteúdo."); }
    });
    const ar = $("[data-abrir-roteiro]", dlg);
    if (ar) ar.addEventListener("click", () => { dlg.close(); if (window.painelSkill) window.painelSkill.abrirRoteiro(p.roteiro_id); });
    const sk = $("[data-skill]", dlg);
    if (sk) sk.addEventListener("click", async () => {
      const o = ler();
      try { await salvar({ ...o, id: p.id }); } catch (e) { /* segue com o que tem */ }
      dlg.close();
      if (window.painelSkill) window.painelSkill.criarRoteiro({ conteudoId: p.id, ideia: ideiaDoConteudo(o, insp), inicial: { formato: /tiktok/i.test(o.formato || "") ? "TikTok" : /stor/i.test(o.formato || "") ? "Stories" : /carross/i.test(o.formato || "") ? "Carrossel" : "Reels", objetivo: o.proposito || "", marca: o.marca || "" } });
    });
    // sininho "Importante, notificar" (js/lembretes.js) com o post certo
    if (p.id) { dlg.dataset.lembreteTipo = "post"; dlg.dataset.lembreteId = String(p.id); dlg.dataset.lembreteTitulo = (p.formato ? p.formato + ": " : "") + (p.tema || "Post do painel"); }
    else { delete dlg.dataset.lembreteId; delete dlg.dataset.lembreteTitulo; }
    if (!dlg.open) dlg.showModal();
  }

  // ---------- plano da semana (chega pronto todo sábado às 8h; função painel-conteudo acao "plano_semana") ----------
  const pl = { atual: null, lista: [], idx: 0, gerando: false };
  async function carregarPlano() {
    const { data, error } = await banco().from("planos_semana").select("*").order("semana", { ascending: false }).limit(8);
    pl.lista = error ? [] : (data || []);
    pl.idx = Math.min(pl.idx, Math.max(0, pl.lista.length - 1));
    pl.atual = pl.lista[pl.idx] || null;
  }
  const brCurta = (d) => `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}`;
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const ROT_ITEM = { gravar: "Gravar", postar: "Postar", publi: "Publi", agenda: "Agenda" };
  function pintarPlano() {
    const box = document.getElementById("pc-plano"); if (!box) return;
    const r = pl.atual;
    const topo = `<div class="pc-plano-cab"><div><h3 class="pc2-h">Plano da <em>semana</em></h3><p class="pc-ajuda">Gravar e postar. Chega pronto todo sábado às 8h.</p></div>
      <div class="pc-plano-acoes">${pl.lista.length > 1 ? `<select class="entrada" id="pc-plano-sem" aria-label="Qual semana">${pl.lista.map((x, i) => `<option value="${i}" ${i === pl.idx ? "selected" : ""}>${brCurta(x.semana)} a ${brCurta(x.plano && x.plano.fim || x.semana)}</option>`).join("")}</select>` : ""}
      <button class="btn" type="button" id="pc-plano-gerar"${pl.gerando ? " disabled" : ""}>${pl.gerando ? "Montando…" : r ? "Montar de novo" : "Montar agora"}</button>
      ${r ? `<button class="btn" type="button" id="pc-plano-editar">Editar foco</button><button class="btn btn-perigo" type="button" id="pc-plano-excluir">Excluir</button>` : ""}</div></div>`;
    if (!r) { box.innerHTML = topo + `<p class="pc-ajuda">Ainda não tem plano. O primeiro chega no sábado de manhã, ou clique em Montar agora.</p>`; ligarPlano(box); return; }
    const p = r.plano || {}, c = p.contas || {};
    // visual de quadro (nov/2026, pedido da Mari: igual ao Organize de UGC's & Publis): um dia = uma coluna, uma tarefa = um cartão
    const SV = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const IC_PL = {
      gravar: SV('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>'),
      postar: SV('<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>'),
      hora: SV('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
      ok: SV('<path d="m5 12 5 5 9-10"/>'),
      abrir: SV('<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>'),
      tirar: SV('<path d="M6 6l12 12M18 6 6 18"/>'),
    };
    const separar = (it) => {
      let t = String(it.texto || "").replace(/^(Gravar|Postar)\s+/i, "").trim(), fmt = "", hora = "";
      const mf = t.match(/^(Reels?|Carrossel|Stories|Story|TikTok|Foto|Post|V[ií]deo|Shorts)\b\s*:?\s*/i);
      if (mf) { fmt = mf[1]; t = t.slice(mf[0].length); }
      const mh = t.match(/\s*(?:às|as)\s+(\d{1,2}(?::\d{2}|h\d{0,2})?)\s*$/i);
      if (mh) { hora = mh[1]; t = t.slice(0, mh.index); }
      return { titulo: t.trim() || String(it.texto || ""), fmt, hora };
    };
    const tarefas = (d) => (d.itens || []).filter((it) => it.tipo === "gravar" || it.tipo === "postar");
    const todas = (p.dias || []).flatMap(tarefas), feitas = todas.filter((it) => it.feito).length;
    const pct = todas.length ? Math.round(feitas / todas.length * 100) : 0;
    const cartao = (it, onde) => {
      const x = separar(it), tipo = it.tipo === "gravar" ? "gravar" : "postar";
      return `<div class="pq-card pq-${tipo}${it.feito ? " feito" : ""}">
        <div class="pq-card-topo"><span class="pq-ico">${IC_PL[tipo]}</span><span class="pq-tipo">${ROT_ITEM[tipo]}</span>
          <span class="pq-acoes">${it.post_id ? `<button type="button" class="pq-btn" data-post="${it.post_id}" title="Abrir o post" aria-label="Abrir o post">${IC_PL.abrir}</button>` : ""}<button type="button" class="pq-btn" data-tirar="${esc(it.id)}" data-onde="${onde}" title="Tirar do plano" aria-label="Tirar do plano">${IC_PL.tirar}</button></span></div>
        <div class="pq-titulo">${esc(x.titulo)}</div>
        ${x.fmt ? `<div class="pq-sub">${esc(x.fmt)}</div>` : ""}
        <div class="pq-rodape">${x.hora ? `<span class="pq-hora">${IC_PL.hora}${esc(x.hora)}</span>` : `<span></span>`}
          <label class="pq-feito"><input type="checkbox" data-feito="${esc(it.id)}" data-onde="${onde}" ${it.feito ? "checked" : ""}><span>${it.feito ? IC_PL.ok + "Feito" : "Marcar feito"}</span></label></div>
      </div>`;
    };
    const hj = iso(hoje);
    box.innerHTML = topo + `
      ${r.foco ? `<p class="pc-plano-foco"><b>Foco:</b> ${esc(r.foco)}</p>` : ""}
      <div class="pq-resumo"><div class="pq-resumo-linha"><span>${plural(feitas, "tarefa feita", "tarefas feitas")} de ${todas.length} · ${plural(c.posts || 0, "post", "posts")}${p.novos ? ` (${plural(p.novos, "ideia nova", "ideias novas")} com roteiro)` : ""}</span><span>${pct}%</span></div><div class="pq-barra"><span style="width:${pct}%"></span></div>
        <div class="pq-legenda"><span class="pq-leg pq-gravar">${IC_PL.gravar}Gravar</span><span class="pq-leg pq-postar">${IC_PL.postar}Postar</span></div></div>
      ${p.aviso ? `<p class="faixa faixa-erro">${esc(p.aviso)}</p>` : ""}
      <div class="pq-quadro">${(p.dias || []).map((d) => { const its = tarefas(d), passou = d.data < hj; return `<div class="pq-col${d.data === hj ? " hoje" : ""}${passou ? " passou" : ""}${its.length ? "" : " livre"}">
        <div class="pq-col-topo"><span class="pq-ponto"></span><span class="pq-col-nome">${esc(d.nome)}${d.data === hj ? ` <em>hoje</em>` : ""}</span><span class="pq-col-data">${brCurta(d.data)}</span><span class="pq-col-n">${its.length}</span></div>
        ${its.map((it) => cartao(it, d.data)).join("") || `<div class="pq-vazio">Dia livre</div>`}</div>`; }).join("")}</div>`;
    const qd = $(".pq-quadro", box), colHoje = $(".pq-col.hoje", box);
    if (qd && colHoje) qd.scrollLeft = Math.max(0, colHoje.offsetLeft - qd.offsetLeft - 8);
    ligarPlano(box);
  }
  async function salvarPlano(campos) {
    const { error } = await banco().from("planos_semana").update({ ...campos, atualizado_em: new Date().toISOString() }).eq("id", pl.atual.id);
    if (error) throw error;
    Object.assign(pl.atual, campos);
  }
  function itensDe(onde) { const p = pl.atual.plano; return onde === "propostas" ? p.propostas : ((p.dias || []).find((d) => d.data === onde) || {}).itens || []; }
  function ligarPlano(box) {
    const sel = $("#pc-plano-sem", box); if (sel) sel.addEventListener("change", () => { pl.idx = Number(sel.value); pl.atual = pl.lista[pl.idx]; pintarPlano(); });
    $("#pc-plano-gerar", box).addEventListener("click", async () => {
      if (pl.atual && !(await painelDialogo.confirmar("Montar o plano de novo? Os dias livres do seu ritmo ganham ideias novas e o que você marcou como feito recomeça.", { ok: "Montar de novo" }))) return;
      pl.gerando = true; pintarPlano();
      try {
        const { data, error } = await banco().functions.invoke("painel-conteudo", { body: { acao: "plano_semana" } });
        if (error || (data && data.error)) throw new Error((data && data.error) || (error && error.message) || "erro");
        pl.idx = 0; await carregarPlano(); await carregar(); pintar(); toast("Plano da semana pronto.");
      } catch (er) { toast("Não consegui montar o plano: " + er.message, true); }
      pl.gerando = false; pintarPlano();
    });
    const ed = $("#pc-plano-editar", box); if (ed) ed.addEventListener("click", async () => {
      const novo = await painelDialogo.texto("Foco desta semana (uma frase para lembrar o que importa):", pl.atual.foco || "", { linhas: 3 });
      if (novo == null) return;
      try { await salvarPlano({ foco: novo.trim() || null }); pintarPlano(); toast("Foco salvo."); } catch (er) { toast(er.message, true); }
    });
    const ex = $("#pc-plano-excluir", box); if (ex) ex.addEventListener("click", async () => {
      if (!(await painelDialogo.confirmar("Excluir este plano da semana? Os posts do calendário continuam.", { ok: "Excluir", perigo: true }))) return;
      const { error } = await banco().from("planos_semana").delete().eq("id", pl.atual.id);
      if (error) { toast(error.message, true); return; }
      pl.idx = 0; await carregarPlano(); pintarPlano(); toast("Plano excluído.");
    });
    $$("[data-feito]", box).forEach((c) => c.addEventListener("change", async () => {
      const it = itensDe(c.dataset.onde).find((x) => x.id === c.dataset.feito); if (!it) return;
      it.feito = c.checked;
      try { await salvarPlano({ plano: pl.atual.plano }); pintarPlano(); } catch (er) { it.feito = !c.checked; toast(er.message, true); pintarPlano(); }
    }));
    $$("[data-tirar]", box).forEach((b) => b.addEventListener("click", async () => {
      const lista = itensDe(b.dataset.onde), i = lista.findIndex((x) => x.id === b.dataset.tirar); if (i < 0) return;
      const [tirado] = lista.splice(i, 1);
      try { await salvarPlano({ plano: pl.atual.plano }); pintarPlano(); } catch (er) { lista.splice(i, 0, tirado); toast(er.message, true); pintarPlano(); }
    }));
    $$("[data-post]", box).forEach((b) => b.addEventListener("click", async () => {
      let p = st.todos.find((x) => String(x.id) === b.dataset.post);
      if (!p) { const { data } = await banco().from("painel_conteudo").select("*").eq("id", b.dataset.post).maybeSingle(); p = data; }
      if (p) abrir(p); else toast("Esse post não existe mais no calendário.", true);
    }));
    $$("[data-ir]", box).forEach((b) => b.addEventListener("click", () => { location.hash = "#" + b.dataset.ir; }));
  }

  // ---------- calendário semanal (as mesmas pílulas e o mesmo arrastar do mensal) ----------
  function pintarSemanal(sec) {
    const semana = st.cal === "semana";
    $$("[data-calvista]", sec).forEach((b) => b.classList.toggle("ativa", b.dataset.calvista === st.cal));
    $("#pc-quadro", sec).hidden = semana; $("#pc-semanal", sec).hidden = !semana;
    if (!semana) return;
    const ini = st.semIni || segundaDe(iso(hoje)); st.semIni = ini;
    const dias = [...Array(7)].map((_, k) => { const d = deIso(ini); d.setDate(d.getDate() + k); return d; });
    const br = (d) => `${d.getDate()}/${pad(d.getMonth() + 1)}`;
    $("#pc-semana-rot", sec).textContent = `${br(dias[0])} a ${br(dias[6])}`;
    $("#pc-semanal", sec).innerHTML = `<div class="pc3-cal-dias">${DIAS.map((d) => `<span>${d}</span>`).join("")}</div><div class="pc3-grade pc3-grade-semana">${dias.map((d) => celulaDia(d, false)).join("")}</div>`;
  }

  // ---------- regras dos números (cada conteúdo conta uma vez em cada indicador) ----------
  // planejado = publicação no mês; sem roteiro = Ideia; em andamento = Roteirizado + Para gravar + Em edição;
  // agendado = Pronto com publicação de hoje em diante; publicado = Publicado; pendente = publicação já passou e não publicou
  const ANDAMENTO = ["Roteirizado", "Para gravar", "Em edição"];
  const contar = (lista, sts) => lista.filter((p) => sts.includes(p.status)).length;
  const dataCurta = (d) => { if (!d) return ""; const x = deIso(d); return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}`; };
  const pendente = (p) => p.data && p.data < iso(hoje) && p.status !== "Publicado";
  const slugSt = (x) => semAcento(x).replace(/[^a-z]+/g, "-");
  function pintarGeral(sec) {
    const box = $("#pc-geral", sec); if (!box) return;
    const T = st.todos, hj = iso(hoje);
    const mesAtual = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}`, doMes = T.filter((p) => p.data && p.data.startsWith(mesAtual));
    const pub = contar(doMes, ["Publicado"]), pct = doMes.length ? Math.round((pub / doMes.length) * 100) : 0;
    const agend = doMes.filter((p) => p.status === "Pronto" && p.data >= hj).length, pend = T.filter(pendente).length;
    const prox = T.filter((p) => p.status !== "Publicado" && ((p.data && p.data >= hj) || (p.data_gravacao && p.data_gravacao >= hj)))
      .map((p) => ({ p, quando: [p.data_gravacao, p.data].filter((d) => d && d >= hj).sort()[0] })).sort((a, b) => a.quando.localeCompare(b.quando)).slice(0, 5);
    const anel = `<svg class="pc3-anel" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50"/><circle cx="60" cy="60" r="50" style="stroke-dasharray:${(pct / 100) * 314.16} 314.16"/></svg>`;
    box.innerHTML = `<div class="pc3-geral">
      <div class="pc3-col-esq">
        <section class="pc3-bloco">
          <div class="pc3-bloco-cab"><h3 class="pc2-h">Próximos <em>conteúdos</em></h3><button type="button" class="pc2-link" data-ir-parte="cal">calendário ${ic.seta}</button></div>
          ${prox.length ? `<ul class="pc3-prox">${prox.map(({ p, quando }) => `<li><button type="button" data-id="${p.id}">
              <span class="pc2-data${quando === hj ? " hoje" : ""}">${quando === hj ? "hoje" : dataCurta(quando)}</span>
              <span class="pc2-prox-txt"><b>${esc(p.tema || "Sem título")}</b><small>${esc([quando === p.data_gravacao && quando !== p.data ? "gravar" : "publicar", p.formato, p.nicho || p.pilar, tipoTxt(p)].filter(Boolean).join(" · "))}</small></span>
              <span class="pc2-st st-${slugSt(p.status)}">${esc(p.status)}</span></button></li>`).join("")}</ul>`
            : `<p class="pc-ajuda">Nada marcado de hoje em diante. Dê uma data aos conteúdos no quadro ou no calendário.</p>`}
        </section>
        <section class="pc3-bloco" id="pc-plano-bloco"><div class="pc-plano" id="pc-plano"></div></section>
      </div>
      <aside class="pc3-col-dir">
        <section class="pc3-bloco pc3-mes">
          <h3 class="pc2-h">${esc(MESES[hoje.getMonth()][0].toUpperCase() + MESES[hoje.getMonth()].slice(1))}</h3>
          <div class="pc3-anel-box">${anel}<b>${pct}%</b><small>publicado</small></div>
          <dl class="pc3-stats"><div><dt>Planejados</dt><dd>${doMes.length}</dd></div><div><dt>Em andamento</dt><dd>${contar(doMes, ANDAMENTO)}</dd></div><div><dt>Agendados</dt><dd>${agend}</dd></div><div><dt>Publicados</dt><dd>${pub}</dd></div></dl>
          ${pend ? `<button type="button" class="pc3-pend" data-ir-parte="quadro">${pend} ${pend === 1 ? "conteúdo passou" : "conteúdos passaram"} da data sem publicar</button>` : ""}
        </section>
        <section class="pc3-bloco">
          <div class="pc3-bloco-cab"><h3 class="pc2-h">Produção</h3><button type="button" class="pc2-link" data-ir-parte="quadro">quadro ${ic.seta}</button></div>
          <ul class="pc3-fluxo">${STATUS.map((x) => `<li><button type="button" data-ir-parte="quadro"><span>${esc(x === "Ideia" ? "Sem roteiro" : x)}</span><b>${contar(T, [x])}</b></button></li>`).join("")}</ul>
        </section>
      </aside></div>`;
    $$("[data-ir-parte]", box).forEach((b) => b.addEventListener("click", () => st.mostrarParte(b.dataset.irParte)));
    ligarCliques(box);
    pintarPlano();
  }

  // ---------- quadro de produção (colunas = status; arrastar muda o status do mesmo registro) ----------
  function filtrados() {
    const f = st.filtro, q = semAcento(f.q);
    return st.todos.filter((p) => (!q || semAcento(p.tema).includes(q)) && (!f.nicho || (p.nicho || p.pilar) === f.nicho) && (!f.formato || p.formato === f.formato) && (!f.funil || p.funil === f.funil)
      && (!f.tipo || (f.tipo === "Publi" ? ehPubli(p) : !ehPubli(p) && p.tipo_conteudo === f.tipo)));
  }
  const corNicho = (n) => { const k = NICHOS.indexOf(n); return k < 0 ? "x" : String(k); };
  const icCal = '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M9 3.5v4M15 3.5v4"/></svg>';
  const icCam = '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="12.5" height="10" rx="2.5"/><path d="M15.5 10.5l5-3v9l-5-3z"/></svg>';
  function cartaoKanban(p) {
    const nicho = p.nicho || p.pilar;
    return `<article class="pc3-card" draggable="true" data-id="${p.id}" tabindex="0">
      <div class="pc3-card-top">${nicho ? `<span class="pc3-chip c-${corNicho(p.nicho)}">${esc(nicho)}</span>` : `<span class="pc3-chip c-x">sem nicho</span>`}<button type="button" class="pc3-menu" data-menu="${p.id}" aria-label="Opções">•••</button></div>
      <b>${esc(p.tema || "Sem título")}</b>
      <small>${esc([p.formato, tipoTxt(p), p.roteiro_id ? "com roteiro" : ""].filter(Boolean).join(" · "))}</small>
      <div class="pc3-card-rodape">${p.data ? `<span title="Publicação">${icCal}${dataCurta(p.data)}</span>` : `<span class="vazio">sem data</span>`}${p.data_gravacao && p.status !== "Publicado" ? `<span title="Gravação">${icCam}${dataCurta(p.data_gravacao)}</span>` : ""}<em class="st-${slugSt(p.status)}">${esc(p.status)}</em></div>
    </article>`;
  }
  function pintarKanban(sec) {
    const box = $("#pc-kanban", sec); if (!box) return;
    const f = st.filtro, lista = filtrados();
    const nichos = [...new Set([...NICHOS, ...st.todos.map((p) => p.nicho || p.pilar).filter(Boolean)])];
    const sel = (k, rot, ops) => `<select class="entrada" data-filtro="${k}" aria-label="${rot}"><option value="">${rot}</option>${ops.map((o) => `<option ${f[k] === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
    const foco = document.activeElement && document.activeElement.id === "pc-busca";
    box.innerHTML = `<div class="pc3-painel">
      <div class="pc3-painel-cab"><div class="pc2-filtros"><input class="entrada" type="search" id="pc-busca" placeholder="Buscar pelo título" value="${esc(f.q)}">
        ${sel("nicho", "Nicho", nichos)}${sel("formato", "Formato", FORMATOS)}${sel("funil", "Funil", FUNIS)}${sel("tipo", "Tipo", ["Orgânico", "UGC", "Publi"])}
        ${f.q || f.nicho || f.formato || f.funil || f.tipo ? `<button type="button" class="pc2-link" id="pc-limpar">limpar</button>` : ""}</div></div>
      <div class="pc2-kanban pc3-kanban">${STATUS.map((col) => {
        let cards = lista.filter((p) => p.status === col);
        const total = cards.length;
        if (col === "Publicado") cards = cards.sort((a, b) => String(b.data || "").localeCompare(String(a.data || ""))).slice(0, 30);
        else cards = cards.sort((a, b) => String(a.data || "9").localeCompare(String(b.data || "9")));
        return `<section class="pc2-col pc3-col" data-col="${esc(col)}"><div class="pc2-col-cab"><b>${esc(col === "Ideia" ? "Ideias" : col)}</b><span>${total}</span><button type="button" class="pc2-mais" data-criar="${esc(col)}" aria-label="Adicionar em ${esc(col)}">${ic.mais}</button></div>
          <div class="pc2-col-lista">${cards.map(cartaoKanban).join("") || `<p class="pc2-vazio">arraste para cá</p>`}</div></section>`;
      }).join("")}</div></div>`;
    ligarCliques(box);
    const busca = $("#pc-busca", box);
    busca.addEventListener("input", () => { st.filtro.q = busca.value; pintarKanban(sec); });
    if (foco) { const b = $("#pc-busca", box); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
    $$("[data-filtro]", box).forEach((x) => x.addEventListener("change", () => { st.filtro[x.dataset.filtro] = x.value; pintarKanban(sec); }));
    const lp = $("#pc-limpar", box); if (lp) lp.addEventListener("click", () => { st.filtro = { q: "", nicho: "", formato: "", funil: "", tipo: "" }; pintarKanban(sec); });
    $$("[data-criar]", box).forEach((b) => b.addEventListener("click", () => abrir(novoConteudo({ status: b.dataset.criar }))));
    $$("[data-menu]", box).forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); menuCartao(b, st.todos.find((x) => String(x.id) === b.dataset.menu)); }));
    $$(".pc3-card", box).forEach((c) => { c.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/kanban", c.dataset.id); c.classList.add("arrastando"); }); c.addEventListener("dragend", () => c.classList.remove("arrastando")); c.addEventListener("keydown", (e) => { if (e.key === "Enter") c.click(); }); });
    $$(".pc2-col", box).forEach((col) => {
      col.addEventListener("dragover", (e) => { if ([...e.dataTransfer.types].includes("text/kanban")) { e.preventDefault(); col.classList.add("alvo"); } });
      col.addEventListener("dragleave", () => col.classList.remove("alvo"));
      col.addEventListener("drop", (e) => { e.preventDefault(); col.classList.remove("alvo"); moverStatus(e.dataTransfer.getData("text/kanban"), col.dataset.col); });
    });
  }
  async function moverStatus(id, status) {
    const p = st.todos.find((x) => String(x.id) === String(id)); if (!p || !status || p.status === status) return;
    try { await salvar({ id: p.id, status }); pintar(); toast(`${p.tema || "Conteúdo"}: ${status}.`); } catch (er) { toast(er.message, true); }
  }
  async function excluirConteudo(p) {
    if (!(await painelDialogo.confirmar(`Excluir "${p.tema || "este conteúdo"}"? Ele sai do quadro, do calendário e da visão geral.`, { ok: "Excluir", perigo: true }))) return false;
    const { error } = await banco().from("painel_conteudo").delete().eq("id", p.id);
    if (error) { toast(error.message, true); return false; }
    st.todos = st.todos.filter((x) => x.id !== p.id);
    if (st.ideias) st.ideias.forEach((it) => { if (it.post_id === p.id) it.post_id = null; });
    pintar(); toast("Conteúdo excluído."); return true;
  }
  // menu ••• do cartão: editar, mover (útil no celular, onde não dá para arrastar) e excluir
  function menuCartao(bt, p) {
    if (!p) return;
    document.querySelectorAll(".pc3-pop").forEach((x) => x.remove());
    const pop = document.createElement("div"); pop.className = "pc3-pop";
    pop.innerHTML = `<button type="button" data-a="abrir">Abrir e editar</button>${STATUS.filter((x) => x !== p.status).map((x) => `<button type="button" data-a="mover" data-v="${esc(x)}">Mover para ${esc(x === "Ideia" ? "Ideias" : x)}</button>`).join("")}<button type="button" data-a="excluir" class="perigo">Excluir</button>`;
    document.body.appendChild(pop);
    const r = bt.getBoundingClientRect();
    pop.style.top = Math.min(window.innerHeight - pop.offsetHeight - 8, r.bottom + 4) + "px";
    pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth)) + "px";
    const fechar = () => { pop.remove(); document.removeEventListener("click", fora, true); };
    const fora = (e) => { if (!pop.contains(e.target)) fechar(); };
    setTimeout(() => document.addEventListener("click", fora, true), 0);
    pop.addEventListener("click", (e) => {
      const b = e.target.closest("[data-a]"); if (!b) return; fechar();
      if (b.dataset.a === "abrir") abrir(p); else if (b.dataset.a === "mover") moverStatus(p.id, b.dataset.v); else excluirConteudo(p);
    });
  }

  // ---------- banco de ideias (tabela ideias_organizadas; ideia só vira conteúdo pelo botão Transformar em conteúdo) ----------
  const SITUACOES = [["minha", "Minhas ideias"], ["desenvolver", "Para desenvolver"], ["descartada", "Descartadas"]];
  async function carregarIdeias() {
    const { data, error } = await banco().from("ideias_organizadas").select("*").order("criado_em", { ascending: false }).limit(1000);
    st.ideias = error ? [] : (data || []);
  }
  async function salvarIdeia(campos, id) {
    const dados = { ...campos, atualizado_em: new Date().toISOString() };
    if (id) {
      const { error } = await banco().from("ideias_organizadas").update(dados).eq("id", id); if (error) throw new Error(error.message);
      const it = st.ideias.find((x) => x.id === id); if (it) Object.assign(it, dados); return it;
    }
    const { data, error } = await banco().from("ideias_organizadas").insert(dados).select().maybeSingle(); if (error) throw new Error(error.message);
    const novo = data || { ...dados, id: Date.now(), criado_em: new Date().toISOString() }; st.ideias.unshift(novo); return novo;
  }
  // o que um conteúdo leva para a Skill UGC (Meus roteiros)
  function ideiaDoConteudo(o, insp) {
    return [o.tema && "Tema: " + o.tema, o.proposito && "Objetivo: " + o.proposito, o.hook && "Gancho que eu pensei: " + o.hook, o.desenvolvimento && "Rascunho:\n" + o.desenvolvimento, o.cta && "CTA: " + o.cta, o.notas && "Notas: " + o.notas, insp && insp.link && "Inspiração: " + insp.link].filter(Boolean).join("\n");
  }
  async function desenvolverComIA(p) {
    const notas = `DESENVOLVER ESTA IDEIA DELA EM ROTEIRO: "${p.tema || ""}". ${p.notas ? "Observações dela: " + p.notas + "." : ""} ${p.inspiracao && p.inspiracao.link ? "Inspiração: " + p.inspiracao.link + "." : ""} Mantenha o tema dela.`;
    const ideias = await chamarIdeias({ acao: "ideias", rotulo: rotuloMes(mesDe(p) || st.mes), notas, quantidade: 1, evitar: st.todos.filter((x) => x.id !== p.id).map((x) => x.tema),
      slots: [{ pilar: p.pilar || "", funil: p.funil || "Topo", formato: p.formato || "Reels" }] });
    const x = ideias[0]; if (!x) throw new Error("A IA não devolveu o roteiro. O conteúdo ficou criado; tente de novo pela janela dele.");
    return salvar({ id: p.id, tipo_conteudo: p.tipo_conteudo || x.tipo_conteudo || null, nicho: p.nicho || x.nicho || null,
      tipo_ugc: x.tipo_ugc, proposito: x.proposito, hook: x.hook, ganchos: x.ganchos, desenvolvimento: x.desenvolvimento, cta: x.cta, tipo_roteiro: x.tipo_roteiro, legenda: x.legenda, porque: x.porque });
  }
  const transformando = new Set();
  function janelaIdeia(titulo, corpo, okTxt) {
    return new Promise((res) => {
      const d = document.createElement("dialog"); d.className = "janela pc3-janela";
      d.innerHTML = `<form method="dialog"><div class="janela-cabeca"><h2>${titulo}</h2></div><div class="janela-corpo pc3-form">${corpo}</div>
        <div class="janela-rodape"><button class="btn" type="button" data-x>Cancelar</button><button class="btn btn-principal" type="submit">${okTxt}</button></div></form>`;
      document.body.appendChild(d); let val = null;
      d.querySelector("[data-x]").onclick = () => d.close();
      d.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); val = Object.fromEntries(new FormData(e.target)); d.close(); });
      d.addEventListener("close", () => { d.remove(); res(val); });
      d.showModal();
    });
  }
  async function transformarIdeia(it) {
    const ja = it.post_id && st.todos.find((p) => p.id === it.post_id);
    if (ja) { toast("Essa ideia já virou conteúdo. Abrindo."); abrir(ja); return; }
    if (transformando.has(it.id)) return;
    const v = await janelaIdeia("Transformar em conteúdo", `<p class="pc-ajuda">"${esc(it.titulo || it.texto || "")}" entra no Quadro de produção. A ideia continua guardada e ligada a ele.</p>
      <label class="campo"><span>Começa em</span><select name="status"><option value="Ideia">Ideias (sem roteiro)</option><option value="Roteirizado">Roteirizado (a Skill UGC escreve o roteiro em Meus roteiros)</option><option value="Para gravar">Para gravar</option></select></label>
      <div class="pc-grade2"><label class="campo"><span>Gravação (opcional)</span><input type="date" name="data_gravacao"></label><label class="campo"><span>Publicação (opcional)</span><input type="date" name="data"></label></div>
      <div class="pc-grade2"><label class="campo"><span>Formato</span><select name="formato">${FORMATOS.map((f) => `<option ${f === (it.formato || "Reels") ? "selected" : ""}>${f}</option>`).join("")}</select></label><label class="campo"><span>Funil</span><select name="funil">${FUNIS.map((f) => `<option ${f === (it.funil || "Topo") ? "selected" : ""}>${f}</option>`).join("")}</select></label></div>`, "Transformar");
    if (!v) return;
    transformando.add(it.id); pintar();
    try {
      const nicho = NICHOS.includes(it.categoria) ? it.categoria : null;
      const novo = await salvar({ tema: it.titulo || String(it.texto || "").slice(0, 120), nicho, pilar: it.pilar || (!nicho ? it.categoria : null) || null, formato: v.formato, funil: v.funil, status: v.status === "Roteirizado" ? "Ideia" : v.status,
        data: v.data || null, data_gravacao: v.data_gravacao || null, mes: (v.data || "").slice(0, 7) || st.mes, notas: [it.notas, it.resumo].filter(Boolean).join("\n") || null, hook: it.gancho || null, desenvolvimento: it.roteiro || null,
        marca: it.finalidade === "Publi" ? it.marca || null : null, tipo_conteudo: it.finalidade === "Publi" ? "Publi" : it.finalidade === "Conteúdos" ? "Orgânico" : it.finalidade === "UGC" ? "UGC" : null,
        inspiracao: it.link ? { link: it.link } : null });
      await salvarIdeia({ post_id: novo.id }, it.id);
      if (v.status === "Roteirizado") {
        // a Skill UGC é o motor único de roteiro: abre Meus roteiros com a ideia; ao salvar lá, o conteúdo fica ligado e vira Roteirizado
        toast("Conteúdo criado. Abrindo a Skill UGC em Meus roteiros…");
        if (window.painelSkill) window.painelSkill.criarRoteiro({ conteudoId: novo.id, ideia: ideiaDoConteudo(novo, novo.inspiracao), inicial: { formato: /tiktok/i.test(novo.formato || "") ? "TikTok" : /stor/i.test(novo.formato || "") ? "Stories" : /carross/i.test(novo.formato || "") ? "Carrossel" : "Reels" } });
      } else toast(`Conteúdo criado em ${v.status === "Ideia" ? "Ideias" : v.status} no quadro.`);
    } catch (er) { toast("Não consegui transformar: " + er.message, true); }
    transformando.delete(it.id); pintar();
  }
  function camposIdeia(it) {
    return `<label class="campo"><span>Ideia</span><input name="titulo" required value="${esc(it.titulo || "")}"></label>
      <div class="pc-grade2"><label class="campo"><span>Nicho</span><select name="categoria"><option value=""></option>${[...new Set([...NICHOS, ...(it.categoria ? [it.categoria] : [])])].map((n) => `<option ${n === it.categoria ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
      <label class="campo"><span>Pilar</span><select name="pilar"><option value=""></option>${[...new Set([...(st.perfil.pilares || []).map((x) => x.nome), ...(it.pilar ? [it.pilar] : [])])].map((n) => `<option ${n === it.pilar ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label></div>
      <label class="campo"><span>Link de inspiração</span><input name="link" type="url" placeholder="https://" value="${esc(it.link || "")}"></label>
      <label class="campo"><span>Observações</span><textarea name="notas" rows="3">${esc(it.notas || it.resumo || "")}</textarea></label>
      <label class="campo"><span>Situação</span><select name="situacao">${SITUACOES.map(([k, t]) => `<option value="${k}" ${k === (it.situacao || "minha") ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
  }
  function pintarIdeias(sec) {
    const box = $("#pc-ideias", sec); if (!box) return;
    if (!st.ideias) { box.innerHTML = `<p class="pc-ajuda">Carregando ideias…</p>`; return; }
    const sit = st.ideiaSit || "minha", nf = st.ideiaFiltro, q = semAcento(st.ideiaBusca || "");
    const daSit = st.ideias.filter((it) => (it.situacao || "minha") === sit);
    const lista = daSit.filter((it) => (!nf || it.categoria === nf) && (!q || semAcento([it.titulo, it.texto, it.notas, it.resumo].join(" ")).includes(q)));
    const nichos = [...new Set([...NICHOS, ...st.ideias.map((it) => it.categoria).filter(Boolean)])];
    const foco = document.activeElement && document.activeElement.id === "pc-ideia-busca";
    box.innerHTML = `<div class="pc3-painel">
      <form class="pc3-rapida" id="pc-ideia-rapida"><input class="entrada" name="titulo" required placeholder="Escreva uma ideia e aperte Enter"><select class="entrada" name="categoria" aria-label="Nicho"><option value="">Nicho</option>${NICHOS.map((n) => `<option>${esc(n)}</option>`).join("")}</select><select class="entrada" name="pilar" aria-label="Pilar"><option value="">Pilar</option>${(st.perfil.pilares || []).map((x) => `<option>${esc(x.nome)}</option>`).join("")}</select><button class="btn btn-principal" type="submit">${ic.mais}Guardar</button><button class="btn" type="button" data-organizar title="Escreva solto ou cole um print: a IA separa as ideias">Organizar ideia ou print</button></form>
      <div class="pc3-ideias-cab"><nav class="pc2-seg" aria-label="Situação">${SITUACOES.map(([k, t]) => `<button type="button" data-sit="${k}" class="${k === sit ? "ativa" : ""}">${t} <small>${st.ideias.filter((it) => (it.situacao || "minha") === k).length}</small></button>`).join("")}</nav>
        <div class="pc2-filtros"><input class="entrada" type="search" id="pc-ideia-busca" placeholder="Pesquisar ideias" value="${esc(st.ideiaBusca || "")}"><select class="entrada" id="pc-ideia-nicho" aria-label="Nicho"><option value="">Todos os nichos</option>${nichos.map((n) => `<option ${nf === n ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></div></div>
      ${lista.length ? `<div class="pc3-ideias">${lista.map((it) => { const virou = it.post_id && st.todos.some((p) => p.id === it.post_id); return `<article class="pc3-ideia">
          <div class="pc3-card-top">${it.categoria ? `<span class="pc3-chip c-${corNicho(it.categoria)}">${esc(it.categoria)}</span>` : "<span></span>"}<small>${it.criado_em ? dataCurta(String(it.criado_em).slice(0, 10)) : ""}</small></div>
          <b>${esc(it.titulo || String(it.texto || "").slice(0, 120) || "Sem título")}</b>
          ${it.notas || it.resumo ? `<p>${esc(String(it.notas || it.resumo).slice(0, 160))}</p>` : ""}
          ${it.link ? `<a class="pc3-link" href="${esc(it.link)}" target="_blank" rel="noopener">inspiração</a>` : ""}
          <div class="pc3-ideia-acoes">${virou ? `<button type="button" class="btn btn-mini" data-ver="${it.id}">Ver conteúdo</button>` : `<button type="button" class="btn btn-mini btn-principal" data-transformar="${it.id}" ${transformando.has(it.id) ? "disabled" : ""}>${transformando.has(it.id) ? "Criando…" : "Transformar em conteúdo"}</button>`}
            <button type="button" class="btn btn-mini" data-editar-ideia="${it.id}">Editar</button><button type="button" class="btn btn-mini btn-perigo" data-apagar-ideia="${it.id}" aria-label="Excluir ideia">${ic.lixo}</button></div>
        </article>`; }).join("")}</div>`
        : `<p class="pc-ajuda pc3-vazio">${daSit.length ? "Nenhuma ideia com esse filtro." : sit === "minha" ? "Nenhuma ideia guardada ainda. Escreva acima." : "Nada aqui."}</p>`}
    </div>`;
    const acha = (id) => st.ideias.find((x) => String(x.id) === String(id));
    const org = $("[data-organizar]", box); if (org) org.addEventListener("click", () => { location.hash = "#ferideias"; });
    $("#pc-ideia-rapida", box).addEventListener("submit", async (e) => {
      e.preventDefault(); const fd = new FormData(e.target), v = (k) => String(fd.get(k) || "").trim();
      try { await salvarIdeia({ titulo: v("titulo"), texto: v("titulo"), categoria: v("categoria") || null, pilar: v("pilar") || null, situacao: sit === "descartada" ? "minha" : sit }); pintarIdeias(sec); toast("Ideia guardada."); $("#pc-ideia-rapida input", box) && $("#pc-ideia-rapida [name=titulo]", $("#pc-ideias")).focus(); }
      catch (er) { toast("Não consegui guardar: " + er.message, true); }
    });
    $$("[data-sit]", box).forEach((b) => b.addEventListener("click", () => { st.ideiaSit = b.dataset.sit; pintarIdeias(sec); }));
    const bu = $("#pc-ideia-busca", box); bu.addEventListener("input", () => { st.ideiaBusca = bu.value; pintarIdeias(sec); });
    if (foco) { const b = $("#pc-ideia-busca", box); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
    $("#pc-ideia-nicho", box).addEventListener("change", (e) => { st.ideiaFiltro = e.target.value; pintarIdeias(sec); });
    $$("[data-transformar]", box).forEach((b) => b.addEventListener("click", () => { const it = acha(b.dataset.transformar); if (it) transformarIdeia(it); }));
    $$("[data-ver]", box).forEach((b) => b.addEventListener("click", () => { const it = acha(b.dataset.ver); const p = it && st.todos.find((x) => x.id === it.post_id); if (p) abrir(p); }));
    $$("[data-editar-ideia]", box).forEach((b) => b.addEventListener("click", async () => {
      const it = acha(b.dataset.editarIdeia); if (!it) return;
      const v = await janelaIdeia("Editar ideia", camposIdeia(it), "Salvar"); if (!v) return;
      try { await salvarIdeia({ titulo: v.titulo.trim(), categoria: v.categoria || null, pilar: v.pilar || null, link: v.link.trim() || null, notas: v.notas.trim() || null, situacao: v.situacao }, it.id); pintarIdeias(sec); toast("Ideia salva."); }
      catch (er) { toast("Não salvou: " + er.message, true); }
    }));
    $$("[data-apagar-ideia]", box).forEach((b) => b.addEventListener("click", async () => {
      const it = acha(b.dataset.apagarIdeia); if (!it) return;
      if (!(await painelDialogo.confirmar(`Excluir a ideia "${it.titulo || ""}"?${it.post_id ? " O conteúdo que veio dela continua no quadro." : ""}`, { ok: "Excluir", perigo: true }))) return;
      const { error } = await banco().from("ideias_organizadas").delete().eq("id", it.id);
      if (error) { toast(error.message, true); return; }
      st.ideias = st.ideias.filter((x) => x.id !== it.id); pintarIdeias(sec); toast("Ideia excluída.");
    }));
  }
  // os cartões de cada área abrem o mesmo formulário do conteúdo
  function ligarCliques(raiz) { $$("[data-id]", raiz).forEach((b) => b.addEventListener("click", () => abrir(st.todos.find((p) => String(p.id) === b.dataset.id)))); }

  async function abrirAba() {
    const sec = document.getElementById("aba-" + ABA);
    if (!sec) return;
    if (!st.pronto) { montar(sec); st.pronto = true; await Promise.all([carregar(), carregarIdeias()]); ajustarSemana(); }
    else await Promise.all([carregar(), carregarIdeias()]);
    pintar();
    try { await carregarPlano(); } catch (er) { pl.lista = []; pl.atual = null; }
    pintarPlano();
  }
  document.addEventListener("painel:aba", (e) => { if (e.detail === ABA) abrirAba(); });
  if (location.hash === "#" + ABA) setTimeout(abrirAba, 600);
})();
