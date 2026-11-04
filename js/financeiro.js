// =========================================================
// FINANÇAS BONETTO (marianabonetto.com.br/financeiro)
// App das finanças pessoais (CPF) da Mari e do Eduardo. Cada um entra com a própria senha e vê
// só o seu perfil (linha "mari" ou "eduardo" da tabela financeiro_contas; o banco decide pela
// função perfil_financeiro). O painel do Eduardo usa a paleta azul-acinzentada da referência Payno (tema-edu).
// Abas: Dashboard, Entradas, Saídas, Cartões (compras por cartão somam sozinhas na fatura e no fim
// do mês ele confere com o valor do banco), Empréstimos, Reserva & Investimentos, Visão anual
// (a planilha do ano, mês a mês) e (só a Mari) Acesso.
// Em toda aba tem a consultora financeira: conselhos calculados com os números de quem está
// aberto (o que quitar primeiro, o que negociar, quanto guardar, quando fica livre das dívidas).
// Na primeira vez, o perfil da Mari puxa o Financeiro CPF do painel dela (app_state).
// Acesso: a Mari (e-mail da dona) e quem ela libera na aba Acesso (tabela financeiro_membros).
// =========================================================
(function () {
  "use strict";
  const banco = window.banco;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const num = (v) => { const n = Number(String(v ?? "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const numOuNada = (v) => (v === "" || v == null ? null : num(v));
  const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const MES3 = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  let ocultar = false; try { ocultar = localStorage.getItem("fn-ocultar") === "1"; } catch (e) { /* sem armazenamento */ }
  const R$ = (v) => ocultar ? "R$ •••••" : "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const K = (v) => { v = Number(v) || 0; if (ocultar) return "•••"; return Math.abs(v) >= 1000 ? (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "k" : Math.round(v).toLocaleString("pt-BR"); };
  const pct = (a, b) => (b ? Math.round((a - b) / Math.abs(b) * 100) : null);
  const dataBR = (iso) => iso ? new Date(iso + "T00:00:00").toLocaleDateString("pt-BR") : "";

  const PERFIS = [{ id: "mari", nome: "Mari Bonetto", curto: "Mari" }, { id: "eduardo", nome: "Eduardo Bonetto", curto: "Eduardo" }];
  const ABAS = [["dash", "Dashboard"], ["entradas", "Entradas"], ["saidas", "Saídas"], ["cartoes", "Cartões"], ["emprestimos", "Empréstimos"], ["reserva", "Reserva & Investimentos"], ["anual", "Visão anual"]];
  const NO_CELULAR = ["dash", "anual", "saidas", "cartoes"]; // nov/2026: a Visão anual (onde se lança) fica no menu de baixo; Entradas vai para "Mais" // menu de baixo no celular; o resto fica em "Mais"
  const CURTO = { dash: "Início", reserva: "Reserva", anual: "Ano" };
  const TITULO = { dash: "Visão geral", entradas: "Entradas", saidas: "Saídas", cartoes: "Cartões", emprestimos: "Empréstimos", reserva: "Reserva & Investimentos", anual: "Visão anual", acesso: "Acesso" };
  const CAT_ENTRADA = ["Salário", "UGC", "PUBLI", "PUBLI COMERCIAL", "MARKETPLACE", "Outros"]; // nov/2026: etiquetas pedidas pela Mari (+ as que ela criar, em dados.etiquetas)
  const CAT_SAIDA = ["Conta fixa", "Cartão", "Empréstimo", "Financiamento", "Dívida pessoal", "Mercado", "Farmácia", "Delivery", "Restaurante", "Streaming", "Assinaturas", "Transporte", "Combustível", "Compras online", "Roupas", "Beleza", "Casa", "Filhos", "Pet", "Saúde", "Educação", "Lazer", "Outros"];
  // nov/2026: a saída ganha o tipo sozinha pelo que ela escreve (ela pode trocar)
  const REGRAS_CAT = [
    ["Cartão", /^fatura\b/], ["Empréstimo", /\b(parcela|emprest|consignad)/],
    ["Delivery", /\b(ifood|i food|rappi|delivery|aiqfome|ze delivery|keeta|99 ?food)/],
    ["Farmácia", /\b(farmac|drogari|droga raia|drogasil|pague menos|panvel|pacheco|remedio)/],
    ["Compras online", /\b(shopee|mercado livre|amazon|shein|magalu|magazine luiza|aliexpress|temu|americanas)/],
    ["Mercado", /\b(mercado|supermerc|atacad|assai|hortifruti|sacolao|feira|acougue|carrefour|extra|pao de acucar|dia%?)\b/],
    ["Streaming", /\b(netflix|spotify|disney|hbo|max\b|prime video|youtube|deezer|globoplay)/],
    ["Assinaturas", /\b(icloud|apple|canva|capcut|chatgpt|openai|adobe|assinatura|mensalidade)/],
    ["Restaurante", /\b(restaurante|lanchonete|padaria|cafe|cafeteria|pizza|hamburg|burger|mcdonald|bk\b|sushi|acai|sorvete|bar\b)/],
    ["Combustível", /\b(posto|gasolina|combustiv|etanol|alcool|diesel|shell|ipiranga)/],
    ["Transporte", /\b(uber|99\b|99 pop|taxi|onibus|metro|van\b|pedagio|estacionamento|passagem|bilhete)/],
    ["Conta fixa", /\b(agua|energia|luz|internet|claro|vivo|tim\b|aluguel|condominio|gas\b|mei\b|das\b|iptu|ipva)/],
    ["Saúde", /\b(medic|consulta|exame|dentista|hospital|clinica|plano de saude|unimed|psicolog|terapia|academia|laborator)/],
    ["Beleza", /\b(salao|cabelo|manicure|unha|sobrancelha|estetica|maquiagem|boticario|natura|sephora|perfum|depila)/],
    ["Roupas", /\b(roupa|sapato|calcado|tenis|zara|hering|renner|riachuelo|c&a|cea\b|marisa)/],
    ["Pet", /\b(pet|racao|veterinar|petz|cobasi)/],
    ["Filhos", /\b(fralda|bebe|creche|brinquedo|escola infantil)/],
    ["Educação", /\b(curso|escola|faculdade|livro|apostila|material escolar)/],
    ["Casa", /\b(moveis|leroy|limpeza|utensil|decoracao|eletrodomest|casa)/],
    ["Lazer", /\b(cinema|show|ingresso|viagem|hotel|airbnb|passeio|parque|festa)/],
  ];
  const semAcento = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const catAuto = (desc) => { const t = semAcento(desc); const r = REGRAS_CAT.find(([, re]) => re.test(t)); return r ? r[0] : ""; };
  const FORMAS = [["pix", "Pix"], ["debito", "Cartão de débito"], ["credito", "Cartão de crédito"], ["dinheiro", "Dinheiro"], ["boleto", "Boleto"]];
  // o painel do Eduardo usa a paleta azul-acinzentada da referência Payno: troca as cores da Mari pelas dele no HTML
  const CORES_EDU = { "#3d2b20": "#1e2633", "#7a6355": "#8a94a6", "#6b4a35": "#3d5a85", "#a87058": "#9fb2cd", "#cdb39b": "#7f95b8", "#e7c9b6": "#c9d4e4", "#efe5d8": "#e8edf4", "#8a6650": "#5d77a0", "#4f7a54": "#2f8f5b", "#b8473a": "#d0545b", "#c9973b": "#c9a24a", "#4a6a8a": "#6fa3c9", "#d3a98f": "#b7c4d8" };
  // o painel da Mari (out/2026, pedido dela: "cansei do marrom") usa a paleta lilás das referências FinSet/Fincheck
  const CORES_MARI = { "#3d2b20": "#1f1d2b", "#7a6355": "#8a8798", "#6b4a35": "#7b6cf6", "#a87058": "#c3bbfb", "#cdb39b": "#a99ff8", "#e7c9b6": "#d6d0fd", "#efe5d8": "#f1effd", "#8a6650": "#9d92f8", "#4f7a54": "#2f9e5b", "#b8473a": "#e5484d", "#c9973b": "#f2b84b", "#4a6a8a": "#5ab4e6", "#d3a98f": "#f59ac0" };
  const tingir = (html) => { const mapa = st.atual === "eduardo" ? CORES_EDU : CORES_MARI; return html.replace(/#[0-9a-f]{6}/g, (c) => mapa[c] || c); };
  const ICONE = {
    dash: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></svg>',
    cartoes: '<svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6.5 15h4"/></svg>',
    emprestimos: '<svg viewBox="0 0 24 24"><path d="M4 10h16M6 10v8M10 10v8M14 10v8M18 10v8M3 20h18M12 3l9 5H3z"/></svg>',
    reserva: '<svg viewBox="0 0 24 24"><path d="M19 9a7 6 0 1 0-12.5 3.7L5 17h3l1-1.5a8 8 0 0 0 5 0L15 17h3l-.7-3A6 6 0 0 0 19 9z"/><circle cx="15" cy="8.5" r=".6"/></svg>',
    acesso: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 8v6M14 11h6"/></svg>',
    entra: '<svg viewBox="0 0 24 24"><path d="M17 7 7 17M7 9v8h8"/></svg>',
    sai: '<svg viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8"/></svg>',
    carteira: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12.5h2M3 9h15a3 3 0 0 0-3-3"/></svg>',
    queda: '<svg viewBox="0 0 24 24"><path d="M3 7l6 6 4-4 8 8M15 17h6v-6"/></svg>',
    bandeira: '<svg viewBox="0 0 24 24"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
    mais: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    lapis: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
    lixo: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    olho: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    sair: '<svg viewBox="0 0 24 24"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>',
    anual: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 4v16M15 4v16"/></svg>',
    brilho: '<svg viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></svg>',
  };
  ICONE.mais3 = '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>';
  ICONE.entradas = ICONE.entra; ICONE.saidas = ICONE.sai;
  ICONE.voltar = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';
  ICONE.clipe = '<svg viewBox="0 0 24 24"><path d="M20 11.5 12.4 19a5 5 0 0 1-7.1-7.1l8-8a3.4 3.4 0 0 1 4.8 4.8l-8 8a1.7 1.7 0 0 1-2.4-2.4l7.3-7.3"/></svg>';
  ICONE.elo = '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>';
  ICONE.doc = '<svg viewBox="0 0 24 24"><path d="M6.5 3.5h8l3.5 3.5v13.5h-11.5z"/><path d="M14.5 3.5V7H18M9 11.5h6M9 15h6"/></svg>';
  ICONE.copiar = '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/></svg>';
  ICONE.calendario = '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
  ICONE.banco = '<svg viewBox="0 0 24 24"><path d="M3.5 9.5 12 4l8.5 5.5M5 20.5h14M6.5 10.5v7M10 10.5v7M14 10.5v7M17.5 10.5v7M4 9.5h16"/></svg>';

  const st = { sessao: null, email: "", dona: false, perfis: {}, atual: "mari", aba: "dash", ref: (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })(), anoAba: "saida", anoAbertos: {}, metodo: "recomendado", visaoGastos: "categoria", salvando: null };
  const vazio = () => ({ cartoes: [], emprestimos: [], lancamentos: [], reserva: { atual: 0, metaMeses: 6, aporte: 0 }, investimentos: [], contas: [], compras: [], extra: 150 });
  const D = () => st.perfis[st.atual] || (st.perfis[st.atual] = vazio());

  function toast(t, erro) { const el = $("#toast"); el.textContent = t; el.classList.toggle("erro", Boolean(erro)); el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 3800); }

  // ---------- banco ----------
  async function carregar() {
    const { data, error } = await banco.from("financeiro_contas").select("id,nome,dados,atualizado_em").eq("id", st.atual);
    if (error) throw new Error("Não consegui abrir as finanças: " + error.message);
    const p = PERFIS.find((x) => x.id === st.atual), linha = (data || [])[0];
    st.perfis[p.id] = { ...vazio(), ...((linha && linha.dados) || {}) };
    lembrarBase(p.id, linha && linha.atualizado_em);
    if (!linha) await salvarAgora(p.id);
    sincronizarFaturas();
    // primeira vez: o perfil da Mari puxa o Financeiro CPF do painel dela
    const m = st.perfis.mari;
    if (st.atual === "mari" && st.dona && !m.importado && !m.lancamentos.length && !m.cartoes.length) await importarDoPainel();
    if (st.atual === "mari") { migrarEtiquetas(); try { await sincronizarPJ(); } catch (e) { /* tenta na próxima abertura */ } }
  }
  async function importarDoPainel() {
    try {
      const { data } = await banco.from("app_state").select("data").maybeSingle();
      const est = (data && data.data) || {};
      const f = est.financaCpf || {}, tx = est.transacoesCpf || [];
      if (!tx.length && !(f.cartoes || []).length) return;
      st.perfis.mari = {
        ...vazio(), importado: new Date().toISOString(),
        cartoes: (f.cartoes || []).map((c) => ({ ...c })), emprestimos: (f.emprestimos || []).map((e) => ({ ...e })),
        reserva: { atual: Number((f.reserva || {}).atual) || 0, metaMeses: 6, aporte: Number(f.aporteReserva) || 0 },
        contas: (f.contas || []).map((c) => ({ ...c })), extra: Number(f.orcamentoDividas) || 150,
        lancamentos: tx.map((t) => ({ id: t.id || uid(), tipo: t.tipo === "receita" ? "entrada" : "saida", descricao: t.descricao || "", valor: Number(t.valor) || 0, data: t.data, pago: t.status === "Confirmado", atrasado: Boolean(t.atrasado), categoria: t.categoria || "Outros", obs: t.obs || "" })),
      };
      await salvarAgora("mari");
      toast("Trouxe o seu Financeiro CPF do painel para cá.");
    } catch (e) { /* segue vazio */ }
  }
  function salvar() { sincronizarFaturas(); clearTimeout(st.salvando); st.pendente = true; const id = st.atual; st.salvando = setTimeout(() => salvarAgora(id), 900); }
  // Salvar sem apagar o que outro aparelho mudou (nov/2026): o app guarda como os dados estavam quando abriu ("base").
  // Se o banco mudou desde então (celular e computador abertos ao mesmo tempo), junta: o que mudou aqui vai por cima,
  // o resto fica como está no banco. Lançamentos são juntados um por um (pelo id); apagar aqui apaga lá.
  st.base = {}; st.baseEm = {};
  function lembrarBase(id, em) { st.base[id] = JSON.parse(JSON.stringify(st.perfis[id] || {})); st.baseEm[id] = em || null; }
  function mesclar(base, local, remoto) {
    const out = { ...remoto }, igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    for (const k of Object.keys(local)) if (k !== "lancamentos" && !igual(local[k], base[k])) out[k] = local[k];
    const antes = new Map((base.lancamentos || []).map((l) => [l.id, JSON.stringify(l)]));
    const aqui = new Map((local.lancamentos || []).map((l) => [l.id, l]));
    let lista = (remoto.lancamentos || []).filter((l) => !(antes.has(l.id) && !aqui.has(l.id)));
    const noBanco = new Set(lista.map((l) => l.id));
    for (const [id, l] of aqui) if (antes.get(id) !== JSON.stringify(l)) { if (noBanco.has(id)) lista = lista.map((x) => (x.id === id ? l : x)); else lista.push(l); }
    out.lancamentos = lista;
    return out;
  }
  async function salvarAgora(id) {
    const p = PERFIS.find((x) => x.id === id);
    let dados = st.perfis[id], juntou = false;
    try {
      const { data: rem } = await banco.from("financeiro_contas").select("dados,atualizado_em").eq("id", id).maybeSingle();
      if (rem && rem.dados && st.base[id] && (!st.baseEm[id] || new Date(rem.atualizado_em).getTime() !== new Date(st.baseEm[id]).getTime())) {
        dados = mesclar(st.base[id], dados, rem.dados); juntou = true;
      }
    } catch (e) { /* sem conferir: salva o que tem */ }
    const em = new Date().toISOString();
    const { error } = await banco.from("financeiro_contas").upsert({ id, nome: p.nome, dados, atualizado_em: em, atualizado_por: st.email });
    if (error) { toast("Não salvou: " + error.message, true); return; }
    st.perfis[id] = dados; lembrarBase(id, em); st.pendente = false;
    if (juntou && id === st.atual && !document.querySelector("dialog[open]")) pintar();
  }

  // ---------- contas ----------
  const doMes = (y, m) => D().lancamentos.filter((l) => { const d = new Date(l.data + "T00:00:00"); return d.getFullYear() === y && d.getMonth() === m; });
  const soma = (l) => l.reduce((a, x) => a + (Number(x.valor) || 0), 0);
  const entradas = (l) => l.filter((x) => x.tipo === "entrada"), saidas = (l) => l.filter((x) => x.tipo === "saida");
  const vencido = (l) => !l.pago && l.tipo === "saida" && (l.atrasado || l.data < hojeIso());
  function dividaCartao(c) {
    if (c.status === "Quitado") return 0;
    if (Number(c.divida) > 0) return Number(c.divida);
    return soma(D().lancamentos.filter((l) => !l.pago && eDoCartao(l, c)));
  }
  // ---------- compras no cartão: cada compra soma sozinha na fatura do mês certo ----------
  const ymDe = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;
  const eDoCartao = (l, c) => { const id = String(l.id); return id.startsWith("cpff-" + c.id + "-") || id.startsWith("fat-" + c.id + "-") || (l.categoria === "Cartão" && (l.descricao === "Fatura " + c.nome || l.descricao === c.nome)); };
  function mesDaFatura(c, iso) {
    const d = new Date(iso + "T00:00:00"); let m = d.getMonth();
    const venc = parseInt(c.vencimento, 10) || 0, fecha = parseInt(c.fechamento, 10) || (venc ? ((venc - 7 + 30) % 30) || 30 : 0);
    if (fecha) { if (d.getDate() >= fecha) m++; if (venc && venc <= fecha) m++; } // passou do fechamento: próxima fatura
    const x = new Date(d.getFullYear(), m, 1); return { y: x.getFullYear(), m: x.getMonth() };
  }
  function parcelasDaCompra(c, k) {
    const n = Math.max(1, parseInt(k.parcelas, 10) || 1), base = mesDaFatura(c, k.data), v = Math.round((Number(k.valor) || 0) / n * 100) / 100;
    return Array.from({ length: n }, (_, i) => { const x = new Date(base.y, base.m + i, 1); return { y: x.getFullYear(), m: x.getMonth(), valor: v, n: i + 1, de: n }; });
  }
  const comprasDaFatura = (c, y, m) => (D().compras || []).filter((k) => k.cartao === c.id).flatMap((k) => parcelasDaCompra(c, k).filter((p) => p.y === y && p.m === m).map((p) => ({ ...k, parte: p })));
  function sincronizarFaturas() {
    const d = D(); if (!d.compras) d.compras = [];
    for (const c of d.cartoes) {
      const somas = {}, conf = c.conferidas || {};
      d.compras.filter((k) => k.cartao === c.id).forEach((k) => parcelasDaCompra(c, k).forEach((p) => { const ym = ymDe(p.y, p.m); somas[ym] = (somas[ym] || 0) + p.valor; }));
      const meses = new Set([...Object.keys(somas), ...Object.keys(conf).filter((k) => conf[k] != null)]);
      d.lancamentos = d.lancamentos.filter((l) => !(String(l.id).startsWith("fat-" + c.id + "-") && !l.pago && !meses.has(l.data.slice(0, 7))));
      const dia = String(Math.min(28, Math.max(1, parseInt(c.vencimento, 10) || 10))).padStart(2, "0");
      for (const ym of meses) {
        const l = d.lancamentos.find((x) => x.id === `fat-${c.id}-${ym}`) || d.lancamentos.find((x) => String(x.id).startsWith("cpff-" + c.id + "-") && x.data.slice(0, 7) === ym);
        // nov/2026: fatura que já tinha valor (planilha, digitado) guarda esse valor em valorBase; a fatura vale o maior
        // entre ele e a soma das compras (compras só explicam a fatura, nunca somam por cima). "Veio no banco" manda em tudo.
        if (l && !l.auto && l.valorBase == null) l.valorBase = Number(l.valor) || 0;
        const base = l && !l.auto ? Number(l.valorBase) || 0 : 0;
        const valor = Math.round(((conf[ym] != null ? conf[ym] : Math.max(base, somas[ym] || 0)) || 0) * 100) / 100;
        if (l) l.valor = valor;
        else d.lancamentos.push({ id: `fat-${c.id}-${ym}`, tipo: "saida", descricao: "Fatura " + c.nome, valor, data: `${ym}-${dia}`, pago: false, categoria: "Cartão", auto: true });
      }
    }
  }
  // disponível: o que ele digitou; se não digitou, limite menos o que falta pagar
  const dispCartao = (c) => (c.disponivel !== undefined && c.disponivel !== null && c.disponivel !== "" ? Number(c.disponivel) || 0 : Math.max(0, (Number(c.limite) || 0) - dividaCartao(c)));
  const dividaEmp = (e) => (e.status === "Quitado" ? 0 : Number(e.saldo) || 0);
  function media3() {
    const h = new Date(); let e = 0, s = 0;
    for (let n = 1; n <= 3; n++) { const d = new Date(h.getFullYear(), h.getMonth() - n, 1); const l = doMes(d.getFullYear(), d.getMonth()); e += soma(entradas(l)); s += soma(saidas(l)); }
    return { e: e / 3, s: s / 3 };
  }
  function listaDividas() {
    const d = D();
    return [
      ...d.cartoes.filter((c) => dividaCartao(c) > 0).map((c) => ({ id: "c" + c.id, nome: c.nome, tipo: "Cartão", saldo: dividaCartao(c), juros: Number(c.juros) || 0, minimo: Math.max(1, Number(c.proximaFatura) || Number(c.faturaAtual) || dividaCartao(c) / 12) })),
      ...d.emprestimos.filter((e) => dividaEmp(e) > 0).map((e) => ({ id: "e" + e.id, nome: e.nome, tipo: "Empréstimo", saldo: dividaEmp(e), juros: Number(e.juros) || 0, minimo: Math.max(1, Number(e.parcela) || dividaEmp(e) / 12) })),
    ];
  }
  function plano(dividas, extra, metodo) {
    const lista = dividas.map((d) => ({ ...d, resta: d.saldo, quitada: null }));
    // nov/2026: quatro estratégias (Cartões): recomendado (juros + tamanho + parcela juntos), menor dívida, maiores juros, liberar orçamento (maior parcela)
    const mx = (k) => Math.max(1e-9, ...lista.map((d) => Number(d[k]) || 0));
    const nota = (d) => 0.5 * ((Number(d.juros) || 0) / mx("juros")) + 0.3 * (1 - d.resta / mx("resta")) + 0.2 * (d.minimo / mx("minimo"));
    const ordem = [...lista].sort((a, b) => metodo === "avalanche" ? (b.juros - a.juros) || (a.resta - b.resta) : metodo === "parcela" ? (b.minimo - a.minimo) || (a.resta - b.resta) : metodo === "recomendado" ? nota(b) - nota(a) : a.resta - b.resta);
    const linha = []; let mes = 0;
    while (lista.some((d) => d.resta > 0.5) && mes < 120) {
      mes++; let livre = Number(extra) || 0;
      lista.forEach((d) => { if (d.resta <= 0.5) { livre += d.minimo; return; } const p = Math.min(d.minimo, d.resta); d.resta -= p; livre += d.minimo - p; });
      for (const o of ordem) { if (livre <= 0) break; const x = lista.find((y) => y.id === o.id); if (x.resta <= 0.5) continue; const p = Math.min(livre, x.resta); x.resta -= p; livre -= p; }
      lista.forEach((d) => { if (d.resta <= 0.5 && d.quitada === null) { d.resta = 0; d.quitada = mes; } });
      linha.push(lista.reduce((a, d) => a + d.resta, 0));
    }
    return { ordem: ordem.map((o) => lista.find((x) => x.id === o.id)), meses: lista.some((d) => d.resta > 0.5) ? null : mes, linha };
  }
  const mesDaqui = (n) => { const d = new Date(); d.setMonth(d.getMonth() + n); return MES3[d.getMonth()] + "/" + String(d.getFullYear()).slice(2); };
  const nome = () => PERFIS.find((p) => p.id === st.atual).curto;

  // ---------- consultora ----------
  function custoMensal() { const m = media3(); return m.s || soma(saidas(doMes(st.ref.y, st.ref.m))); }
  function conselhosGerais() {
    const d = D(), out = [], m = media3(), dividas = listaDividas(), divTotal = dividas.reduce((a, x) => a + x.saldo, 0);
    const venc = d.lancamentos.filter(vencido), empAtraso = d.emprestimos.filter((e) => /atras/i.test(e.status || ""));
    if (venc.length || empAtraso.length) out.push({ alerta: true, t: `Apagar o fogo: ${venc.length + empAtraso.length} conta${venc.length + empAtraso.length > 1 ? "s" : ""} vencida${venc.length + empAtraso.length > 1 ? "s" : ""} sem pagamento`, x: `${[...new Set([...venc.map((l) => l.descricao), ...empAtraso.map((e) => e.nome)])].slice(0, 4).join(", ")}${venc.length ? ` (${R$(soma(venc))})` : ""}. Atraso cobra multa, juros todo dia e suja o nome. Se já pagou, marque como pago. Se não, ligue e peça o valor à vista com desconto ou um parcelamento que caiba.` });
    if (m.e || m.s) {
      const sobra = m.e - m.s;
      out.push(sobra < 0
        ? { alerta: true, t: `Está saindo mais do que entra: ${R$(-sobra)} por mês`, x: `Média dos últimos 3 meses: entrou ${R$(m.e)} e saiu ${R$(m.s)}. Enquanto isso não virar, a dívida cresce. Nada de compra nova no cartão e corte primeiro o que é assinatura, delivery e lazer.` }
        : { t: `Sobram em média ${R$(sobra)} por mês`, x: `Separe essa sobra no dia que o dinheiro cair: uma parte para a dívida da vez e outra para a reserva. O que fica parado na conta acaba gasto.` });
      const parcelas = dividas.reduce((a, x) => a + x.minimo, 0);
      if (m.e) { const comp = Math.round(parcelas / m.e * 100); out.push({ alerta: comp > 30, t: `${comp}% da renda vai para dívidas`, x: comp > 30 ? `O saudável é até 30%. Acima disso, qualquer imprevisto vira dívida nova. Por isso a prioridade agora é quitar, não parcelar mais nada.` : `Está dentro do limite saudável (até 30%). Mantenha assim: compra nova só à vista.` }); }
    }
    if (dividas.length) {
      const p = plano(dividas, d.extra, "avalanche"), sem = plano(dividas, 0, "avalanche"), mais = plano(dividas, (Number(d.extra) || 0) + 100, "avalanche");
      const ordem = p.ordem.slice(0, 3).map((x, i) => `${i + 1}º ${x.nome}${x.juros ? ` (${String(x.juros).replace(".", ",")}% a.m.)` : ""}`).join(", ");
      out.push({ t: `Ordem para quitar: ${ordem}`, x: `Pague o mínimo de todas e jogue todo dinheiro extra na primeira da lista. Quando ela acabar, o valor dela vai para a próxima. A de juros mais altos primeiro é a que faz você pagar menos no total.` });
      if (p.meses !== null) out.push({ t: `Livre das dívidas em ${mesDaqui(p.meses)}`, x: `Com ${R$(d.extra)} a mais por mês além dos mínimos.${sem.meses !== null && sem.meses !== p.meses ? ` Pagando só o mínimo seria ${mesDaqui(sem.meses)}.` : ""}${mais.meses !== null && mais.meses < p.meses ? ` Com R$ 100 a mais por mês, cai para ${mesDaqui(mais.meses)}.` : ""} Total devido hoje: ${R$(divTotal)}.` });
    }
    const res = Number(d.reserva.atual) || 0, custo = custoMensal();
    if (custo && res < custo) out.push({ t: `Reserva cobre menos de 1 mês`, x: `Você tem ${R$(res)} e um mês de gastos é uns ${R$(custo)}. Antes de investir, chegue a 1 mês guardado (mesmo pagando dívida): é ela que impede um imprevisto de virar empréstimo novo.` });
    if (!out.length) out.push({ t: "Tudo em dia por aqui", x: "Continue lançando as entradas e saídas para eu acompanhar com você." });
    return out;
  }
  function conselhosCartoes() {
    const d = D(), out = [], cs = d.cartoes;
    if (!cs.length) return [{ t: "Cadastre os cartões", x: "Com limite, fatura, dívida e juros de cada um eu digo qual pagar primeiro e quanto falta." }];
    const atras = cs.filter((c) => /atras/i.test(c.status || ""));
    if (atras.length) out.push({ alerta: true, t: `${atras.map((c) => c.nome).join(", ")} em atraso`, x: "Fatura atrasada entra no rotativo, que passa de 10% ao mês. Ligue no banco e peça para parcelar a fatura (os juros do parcelamento são bem menores que os do rotativo) ou negocie à vista com desconto." });
    const caro = cs.filter((c) => dividaCartao(c) > 0 && Number(c.juros) > 0).sort((a, b) => b.juros - a.juros)[0];
    if (caro) out.push({ t: `Primeiro o ${caro.nome} (${String(caro.juros).replace(".", ",")}% ao mês)`, x: `Todo dinheiro extra vai para ele até zerar. Nunca pague só o mínimo: a diferença vai para o rotativo e a dívida dobra em poucos meses. Se tiver um empréstimo com juros menores que ${Math.round(caro.juros)}% ao mês, vale trocar essa dívida por ele.` });
    const estour = cs.filter((c) => Number(c.limite) > 0 && c.status !== "Quitado" && (1 - dispCartao(c) / Number(c.limite)) > 0.8);
    if (estour.length) out.push({ t: `${estour.map((c) => c.nome).join(", ")} com mais de 80% do limite usado`, x: "Uso alto do limite derruba o score e deixa você sem folga. Não faça compra nova neles até baixar de 30%." });
    const futuras = cs.reduce((a, c) => a + (Number(c.parcelasFuturas) || 0), 0);
    if (futuras > 0) out.push({ t: `${R$(futuras)} em parcelas futuras nos cartões`, x: "Esse valor já está comprometido nos próximos meses. Até ele acabar, nenhuma compra parcelada nova: cada parcela nova empurra a data de sair das dívidas." });
    const quit = cs.filter((c) => c.status === "Quitado");
    if (quit.length) out.push({ t: `${quit.map((c) => c.nome).join(", ")} já quitado${quit.length > 1 ? "s" : ""}`, x: "Guarde na gaveta. Se tiver anuidade, peça para zerar ou cancele. Cartão quitado que volta a ser usado é a forma mais comum de voltar para as dívidas." });
    if (cs.filter((c) => c.status !== "Quitado").length > 3) out.push({ t: "Cartões demais abertos", x: "Fique com 1 ou 2 cartões para o dia a dia, de preferência sem anuidade. Os outros, depois de quitados, cancele." });
    out.push({ t: "Rotina da fatura", x: "Confira a fatura assim que fechar, pague no dia do vencimento (ou antes) e marque aqui como paga. Coloque um lembrete 2 dias antes de cada vencimento." });
    return out;
  }
  function conselhosEmprestimos() {
    const d = D(), out = [], es = d.emprestimos.filter((e) => dividaEmp(e) > 0);
    if (!d.emprestimos.length) return [{ t: "Cadastre os empréstimos", x: "Com parcela, saldo, valor para quitar e juros eu mostro qual quitar primeiro e quanto você economiza." }];
    const atras = d.emprestimos.filter((e) => /atras/i.test(e.status || ""));
    if (atras.length) out.push({ alerta: true, t: `${atras.map((e) => e.nome).join(", ")} em atraso`, x: "Parcela atrasada acumula multa e juros. Peça ao credor um acordo: muitas vezes eles tiram juros e multa para receber à vista ou em menos parcelas." });
    const econ = es.map((e) => ({ e, v: Math.max(0, (Number(e.saldo) || 0) - (Number(e.quitacao) || Number(e.saldo) || 0)) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
    if (econ.length) out.push({ t: `Quitar o ${econ[0].e.nome} hoje economiza ${R$(econ[0].v)}`, x: `Para quitar agora sai ${R$(econ[0].e.quitacao)} em vez dos ${R$(econ[0].e.saldo)} que faltam pagar. Quitação antecipada tira os juros futuros: é o melhor uso de um dinheiro extra (publi que caiu, 13º, restituição).` });
    const caro = [...es].sort((a, b) => (Number(b.juros) || 0) - (Number(a.juros) || 0))[0];
    if (caro && Number(caro.juros)) out.push({ t: `O mais caro é o ${caro.nome} (${String(caro.juros).replace(".", ",")}% a.m.)`, x: "Quando sobrar dinheiro, peça para amortizar as últimas parcelas dele: o desconto de juros é maior nas parcelas mais distantes e o fim do empréstimo chega antes." });
    out.push({ t: "Não pegue empréstimo para pagar empréstimo", x: "Só vale trocar uma dívida por outra se os juros da nova forem bem menores e a parcela couber. Empréstimo novo para cobrir o mês é sinal de que precisa cortar gastos primeiro." });
    const parcelas = es.reduce((a, e) => a + (Number(e.parcela) || 0), 0), m = media3();
    if (parcelas && m.e) out.push({ alerta: parcelas / m.e > 0.3, t: `Parcelas de empréstimo: ${R$(parcelas)} por mês (${Math.round(parcelas / m.e * 100)}% da renda)`, x: "Somando com as faturas, o ideal é que as dívidas não passem de 30% do que entra." });
    return out;
  }
  function conselhosReserva() {
    const d = D(), out = [], res = Number(d.reserva.atual) || 0, custo = custoMensal(), meta = custo * (Number(d.reserva.metaMeses) || 6);
    const dividas = listaDividas(), caro = dividas.filter((x) => x.juros >= 2).sort((a, b) => b.juros - a.juros);
    if (custo && res < custo) out.push({ alerta: true, t: "Primeiro passo: 1 mês de gastos guardado", x: `Faltam ${R$(custo - res)} para cobrir um mês (${R$(custo)}). Junte isso mesmo pagando dívidas: é o que evita pegar empréstimo quando aparece um imprevisto.` });
    if (caro.length && res >= custo) out.push({ t: `Depois de 1 mês guardado, quite antes de investir`, x: `${caro[0].nome} cobra ${String(caro[0].juros).replace(".", ",")}% ao mês. Nenhum investimento seguro rende isso (a renda fixa rende perto de 1% ao mês). Cada real que vai para essa dívida "rende" ${String(caro[0].juros).replace(".", ",")}% garantido.` });
    if (meta) out.push({ t: `Meta da reserva: ${R$(meta)} (${d.reserva.metaMeses || 6} meses de gastos)`, x: `Você tem ${Math.min(100, Math.round(res / meta * 100))}%.${Number(d.reserva.aporte) > 0 ? ` Guardando ${R$(d.reserva.aporte)} por mês, chega lá em ${Math.ceil(Math.max(0, meta - res) / d.reserva.aporte)} meses.` : " Defina quanto vai guardar por mês para eu calcular quando chega."} Quem trabalha por conta (publi, UGC) precisa de 6 meses ou mais, porque a renda varia.` });
    out.push({ t: "Onde deixar a reserva", x: "Em lugar seguro e que dá para tirar no mesmo dia: Tesouro Selic, CDB de liquidez diária que pague 100% do CDI ou mais, ou conta remunerada. Não em poupança (rende menos), nem em ações ou cripto (podem cair justo quando você precisar)." });
    const inv = d.investimentos || [];
    const ruim = inv.filter((i) => caro.length && Number(i.rendimento) < caro[0].juros && Number(i.valor) > 0);
    if (ruim.length) out.push({ alerta: true, t: `Seu dinheiro investido rende menos que os juros que você paga`, x: `${ruim.map((i) => i.nome).join(", ")} rende${ruim.length > 1 ? "m" : ""} menos que os ${String(caro[0].juros).replace(".", ",")}% ao mês do ${caro[0].nome}. Fora a reserva de emergência, vale resgatar e quitar essa dívida.` });
    if (!dividas.length && res >= meta && meta) out.push({ t: "Pronto para investir para o futuro", x: "Sem dívidas e com a reserva completa: agora sim, invista todo mês uma parte fixa (aposentadoria, estudo das meninas, viagem), diversificando entre renda fixa e um pouco de renda variável." });
    out.push({ t: "Automático é mais fácil", x: "Programe uma transferência para a reserva no mesmo dia em que o dinheiro cai. O que sai primeiro não faz falta no fim do mês." });
    return out;
  }
  function blocoConsultora(lista, titulo) {
    const chave = "cons-" + st.aba;
    return `<section class="fn-consultora${minimo(chave, false) ? " min" : ""}"><h3>${ICONE.brilho} ${esc(titulo || "Sua consultora financeira")}${botaoMin(chave, false)}</h3><p>O que fazer agora, na ordem, olhando os seus números.</p>
      ${lista.map((c, i) => `<div class="fn-passo${c.alerta ? " alerta" : ""}"><span class="nn">${c.alerta ? "!" : i + 1}</span><div><b>${esc(c.t)}</b><small>${esc(c.x)}</small></div></div>`).join("")}</section>`;
  }

  // ---------- desenho ----------
  const kpi = (t, v, ic, sub, tom, chip, abre) => `<div class="fn-kpi ${tom || ""}${abre ? " clica" : ""}"${abre ? ` data-kpi="${abre}" role="button" tabindex="0" aria-label="Ver detalhes: ${esc(t)}"` : ""}><div class="fn-kpi-t"><span class="fn-kpi-ic">${ICONE[ic] || ""}</span>${esc(t)}</div><div class="fn-kpi-v">${String(v).replace(/,(\d{2})$/, '<small>,$1</small>')}</div><div class="fn-kpi-s">${chip ? `<span class="fn-chip ${chip[1] || ""}">${chip[0]}</span>` : ""}${sub ? `<span>${sub}</span>` : ""}</div></div>`;
  const delta = (a, b, inverter) => { const p = pct(a, b); if (p === null) return null; const bom = inverter ? p <= 0 : p >= 0; return [(p > 0 ? "▲ " : p < 0 ? "▼ " : "") + Math.abs(p) + "%", bom ? "" : "mal"]; };
  const CORES = ["#6b4a35", "#a87058", "#cdb39b", "#4f7a54", "#c9973b", "#4a6a8a", "#8a6650", "#d3a98f"];
  // cores dos tipos de saída (bem diferentes entre si; o tingir não mexe nelas)
  const CORES_CAT = ["#7c6df5", "#3fc8cf", "#f383b3", "#6ea6f4", "#f2a541", "#34b27b", "#ef7a5a", "#b78af0", "#e2c044", "#2fa3a0", "#d95f8c", "#8fa3c7", "#9ccc65", "#c98a5e", "#5c6bc0", "#a3a1b5"];
  const COR_ENT = "#13a097", COR_SAI = "#ea5f4b";
  // gráfico Entradas x Despesas do ano (passar o mouse ou tocar mostra o mês; clicar abre o mês)
  function graficoAno(anos) {
    const maior = Math.max(1, ...anos.map((x) => Math.max(x.e, x.s)));
    const bruto = maior / 4, pot = Math.pow(10, Math.floor(Math.log10(bruto))), passo = [1, 1.5, 2, 2.5, 3, 5, 10].map((f) => f * pot).find((f) => f >= bruto), topo = passo * 4;
    const marca = (v) => (v >= 1000 ? (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "k" : String(Math.round(v)));
    return `<div class="fn-caixa fn-gr-caixa"><p class="fn-gr-tit">Entradas x Despesas · ${st.ref.y}</p><p class="sub">Passe o mouse ou toque num mês para ver os valores. Clique para abrir o mês.</p>
      <div class="fn-gr"><div class="fn-gr-y">${[4, 3, 2, 1, 0].map((k) => `<span>${ocultar ? "•" : marca(passo * k)}</span>`).join("")}</div>
        <div class="fn-gr-area">${[4, 3, 2, 1, 0].map((k) => `<i class="fn-gr-linha" style="bottom:${k * 25}%"></i>`).join("")}
          <div class="fn-gr-cols">${anos.map((x) => `<div class="fn-gr-col${x.i === st.ref.m ? " atual" : ""}" data-gr-mes="${x.i}" data-e="${x.e}" data-s="${x.s}" data-n="${x.n.toUpperCase()}" tabindex="0" role="button" aria-label="${MESES[x.i]}: entradas ${R$(x.e)}, despesas ${R$(x.s)}"><div class="par"><i style="height:${(x.e / topo * 100).toFixed(2)}%;background:${COR_ENT}"></i><i style="height:${(x.s / topo * 100).toFixed(2)}%;background:${COR_SAI}"></i></div></div>`).join("")}</div>
          <div class="fn-gr-dica" hidden></div></div></div>
      <div class="fn-gr-x">${anos.map((x) => `<span class="${x.i === st.ref.m ? "atual" : ""}">${x.n.toUpperCase()}</span>`).join("")}</div>
      <div class="fn-gr-leg"><span style="color:${COR_SAI}"><i style="background:${COR_SAI}"></i>Despesas</span><span style="color:${COR_ENT}"><i style="background:${COR_ENT}"></i>Entradas</span></div></div>`;
  }
  // Próximos vencimentos (3 primeiros; "Ver todos" abre a lista inteira)
  const iconeConta = (l) => /empr|financ|d[ií]vida/i.test(l.categoria || "") ? ICONE.banco : /cart/i.test(l.categoria || "") || D().cartoes.some((c) => eDoCartao(l, c)) ? ICONE.cartoes : ICONE.doc;
  const linhaVenc = (l, comBotao) => `<div class="fn-venc-item" data-venc="${esc(l.id)}" role="button" tabindex="0"><span class="fn-venc-ic">${iconeConta(l)}</span><div class="x"><b>${esc(l.descricao || "Sem nome")}</b><small>${esc(l.categoria || "Conta")} · ${dataBR(l.data).slice(0, 5)}</small></div><div class="fn-venc-v"><b>${R$(l.valor)}</b><small>${vencido(l) && l.data < hojeIso() ? "Vencido" : "A pagar"}</small></div>${comBotao ? `<button class="fn-icone" type="button" data-pagar-venc="${esc(l.id)}" title="Marcar como pago" aria-label="Marcar como pago">${ICONE.check}</button>` : ""}</div>`;
  function blocoVencimentos(lista, pagas) {
    return `<div class="fn-caixa fn-venc"><p class="fn-venc-tit">${ICONE.calendario}Próximos vencimentos</p>
      ${lista.length ? `<div class="fn-venc-lista">${lista.slice(0, 3).map((l) => linhaVenc(l)).join("")}</div>${lista.length > 3 ? `<button class="fn-venc-todos" type="button" data-venc-todos>Ver todos os vencimentos (${lista.length}) →</button>` : ""}` : `<p class="fn-vazio">Nada para pagar agora.</p>`}
      ${pagas ? `<p class="fn-venc-ok">${ICONE.check}${pagas} conta${pagas === 1 ? "" : "s"} já paga${pagas === 1 ? "" : "s"} este mês. Parabéns!</p>` : ""}</div>`;
  }
  function rosca(itens, total, centro, cores) {
    cores = cores || CORES;
    let ang = -Math.PI / 2; const r = 52, cx = 75, cy = 75;
    const arcos = itens.map((it, i) => {
      const a = (it.v / Math.max(total, 1)) * Math.PI * 2, x1 = cx + r * Math.cos(ang), y1 = cy + r * Math.sin(ang); ang += a;
      const x2 = cx + r * Math.cos(ang - 0.0001), y2 = cy + r * Math.sin(ang - 0.0001);
      return `<path d="M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${a > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}" stroke="${cores[i % cores.length]}" stroke-width="20" fill="none"/>`;
    }).join("");
    return `<svg viewBox="0 0 150 150" aria-hidden="true"><circle cx="75" cy="75" r="52" stroke="#efe5d8" stroke-width="20" fill="none"/>${arcos}<text x="75" y="72" text-anchor="middle" font-size="15" font-weight="700" fill="#3d2b20">${esc(centro)}</text><text x="75" y="90" text-anchor="middle" font-size="10" fill="#7a6355">no mês</text></svg>`;
  }
  function anel(p, rotulo) {
    const r = 46, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, p));
    return `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${r}" stroke="#efe5d8" stroke-width="12" fill="none"/><circle cx="60" cy="60" r="${r}" stroke="#6b4a35" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)"/><text x="60" y="66" text-anchor="middle" font-size="20" font-weight="700" fill="#3d2b20">${esc(rotulo)}</text></svg>`;
  }

  function telaEntrar(modo = "entrar", msg = "") {
    $("#raiz").innerHTML = `<div class="fn-entrar"><form id="fn-form-entrar" novalidate>
      <h1>Finanças <em>Bonetto</em></h1><p>${modo === "criar" ? "Primeiro acesso: crie a sua senha com o e-mail que a Mari liberou." : modo === "esqueci" ? "Digite o seu e-mail que eu mando um link para criar uma senha nova." : modo === "nova" ? "Crie a sua senha nova." : "Entre com o seu e-mail e senha."}</p>
      ${modo !== "nova" ? `<div class="fn-campo"><label for="fn-email">E-mail</label><input class="fn-entrada" id="fn-email" type="email" autocomplete="username" required></div>` : ""}
      ${modo !== "esqueci" ? `<div class="fn-campo"><label for="fn-senha">${modo === "entrar" ? "Senha" : "Nova senha (mínimo 6 letras ou números)"}</label><input class="fn-entrada" id="fn-senha" type="password" autocomplete="${modo === "entrar" ? "current-password" : "new-password"}" required></div>` : ""}
      <p class="fn-erro" id="fn-erro" role="alert">${esc(msg)}</p>
      <button class="fn-btn principal" type="submit">${modo === "criar" ? "Criar minha senha" : modo === "esqueci" ? "Mandar link" : modo === "nova" ? "Salvar senha" : "Entrar"}</button>
      ${modo !== "nova" ? `<div class="fn-links">${modo !== "entrar" ? `<button type="button" data-modo="entrar">Já tenho senha</button>` : `<button type="button" data-modo="criar">Primeiro acesso</button><button type="button" data-modo="esqueci">Esqueci a senha</button>`}</div>` : ""}
    </form></div>`;
    $$("[data-modo]").forEach((b) => b.addEventListener("click", () => telaEntrar(b.dataset.modo)));
    $("#fn-form-entrar").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("#fn-email") ? $("#fn-email").value.trim().toLowerCase() : "", senha = $("#fn-senha") ? $("#fn-senha").value : "";
      const erro = (t) => { $("#fn-erro").textContent = t; };
      if (modo !== "nova" && !/^\S+@\S+\.\S+$/.test(email)) return erro("Confira o e-mail.");
      if (modo !== "esqueci" && senha.length < 6) return erro("A senha precisa ter pelo menos 6 letras ou números.");
      if (modo === "entrar") { const { error } = await banco.auth.signInWithPassword({ email, password: senha }); if (error) return erro("E-mail ou senha não conferem."); return iniciar(); }
      if (modo === "criar") { const { data, error } = await banco.auth.signUp({ email, password: senha, options: { emailRedirectTo: location.origin + "/financeiro/" } }); if (error) return erro(/registered|already/i.test(error.message) ? "Esse e-mail já tem senha. Use Entrar ou Esqueci a senha." : "Não consegui criar: " + error.message); if (data && data.session) return iniciar(); return telaEntrar("entrar", "Pronto! Confirme no e-mail que acabei de mandar e depois entre aqui."); }
      if (modo === "esqueci") { await banco.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/financeiro/" }); return telaEntrar("entrar", "Se esse e-mail tiver acesso, chegou um link para criar a senha nova."); }
      if (modo === "nova") { const { error } = await banco.auth.updateUser({ password: senha }); if (error) return erro("Não consegui salvar: " + error.message); recuperando = false; history.replaceState(null, "", location.pathname); toast("Senha nova salva."); return iniciar(); }
    });
  }

  function pintar() {
    const p = PERFIS.find((x) => x.id === st.atual);
    const abas = [...ABAS, ...(st.dona ? [["acesso", "Acesso"]] : [])];
    const bloq = !["anual", "acesso"].includes(st.aba); // nov/2026 (pedido da Mari): só a Visão anual lança e edita; o resto só mostra
    $("#raiz").innerHTML = tingir(`<div class="fn-app${bloq ? " fn-bloq" : ""}">
      <aside class="fn-lado">
        ${st.dona ? `<a class="fn-voltar" href="../admin/#dashboard">${ICONE.voltar}Voltar ao painel</a>` : ""}
        <div class="fn-marca"><span class="fn-marca-ic"><svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg></span><div><b>Finanças</b><small>Bonetto</small></div></div>
        <div class="fn-dono">${esc(p.nome)}</div>
        <nav class="fn-nav">${abas.map(([k, t]) => `<button type="button" data-aba="${k}" class="${st.aba === k ? "on" : ""}">${ICONE[k] || ""}${t}</button>`).join("")}</nav>
        <div class="fn-usuario"><span class="fn-av">${esc((st.email[0] || "?").toUpperCase())}</span><div><b>${esc(st.email)}</b><small>${st.dona ? "Mari" : "acesso liberado"}</small></div><button class="fn-icone" type="button" data-sair title="Sair" aria-label="Sair">${ICONE.sair}</button></div>
      </aside>
      <main class="fn-principal">
        <div class="fn-celular-topo">${st.dona ? `<a class="fn-icone fn-voltar-cel" href="../admin/#dashboard" aria-label="Voltar ao painel" title="Voltar ao painel">${ICONE.voltar}</a>` : ""}<b class="fn-dono">${esc(p.nome)}</b><button class="fn-icone" type="button" data-olho aria-label="Esconder valores">${ICONE.olho}</button><button class="fn-icone" type="button" data-sair aria-label="Sair">${ICONE.sair}</button></div>
        <div class="fn-topo"><div><h1>${st.aba === "dash" ? (st.atual === "mari" ? "Oi, Mari! 💜" : "Oi, Eduardo! 💙") : `${TITULO[st.aba]} <em>${esc(p.curto)}</em>`}</h1><p>${st.aba === "dash" ? `Bom momento para cuidar das suas finanças · ${MESES[st.ref.m]} de ${st.ref.y}` : st.aba === "acesso" ? "Quem pode entrar nas finanças" : st.aba === "anual" ? `Navegue pelos meses e acompanhe cada ${st.anoAba === "entrada" ? "entrada" : "saída"}` : `${MESES[st.ref.m]} de ${st.ref.y}`}</p></div>
          <div class="fn-topo-acoes">${st.aba !== "acesso" && st.aba !== "anual" ? `<div class="fn-mes"><button type="button" data-mes="-1" aria-label="Mês anterior">‹</button><span>${MESES[st.ref.m]} ${st.ref.y}</span><button type="button" data-mes="1" aria-label="Próximo mês">›</button></div>
            <button class="fn-btn" type="button" data-novo="saida">${ICONE.sai}Saída</button><button class="fn-btn principal" type="button" data-novo="entrada">${ICONE.entra}Entrada</button>` : ""}<button class="fn-icone" type="button" data-olho title="Esconder valores" aria-label="Esconder valores">${ICONE.olho}</button></div></div>
        ${bloq ? `<div class="fn-aviso-bloq">${ICONE.anual}<span>Aqui é só para ver. Para lançar ou mudar valores, use a <b>Visão anual</b>.</span><button class="fn-btn pequeno principal" type="button" data-aba="anual">Abrir a Visão anual</button></div>` : ""}
        <div id="fn-conteudo">${blocoAjuda(st.aba)}${{ dash: telaDash, entradas: () => telaMovimento("entrada"), saidas: () => telaMovimento("saida"), cartoes: telaCartoes, emprestimos: telaEmprestimos, reserva: telaReserva, anual: telaAnual, acesso: telaAcesso }[st.aba]()}</div>
      </main>
      <nav class="fn-baixo">${NO_CELULAR.map((k) => `<button type="button" data-aba="${k}" class="${st.aba === k ? "on" : ""}">${ICONE[k] || ""}${CURTO[k] || TITULO[k]}</button>`).join("")}<button type="button" data-mais class="${NO_CELULAR.includes(st.aba) ? "" : "on"}">${ICONE.mais3}Mais</button></nav>
      <button class="fn-fab" type="button" data-fab aria-label="Lançar entrada, saída ou compra">${ICONE.mais}</button>
    </div>`);
    ligar();
  }

  function telaDash() {
    const d = D(), lm = doMes(st.ref.y, st.ref.m), ant = new Date(st.ref.y, st.ref.m - 1, 1), la = doMes(ant.getFullYear(), ant.getMonth());
    const ent = soma(entradas(lm)), sai = soma(saidas(lm)), entA = soma(entradas(la)), saiA = soma(saidas(la)), sobra = ent - sai;
    const dividas = listaDividas(), divTotal = dividas.reduce((a, x) => a + x.saldo, 0), p = plano(dividas, d.extra, st.metodo);
    const res = Number(d.reserva.atual) || 0, meta = custoMensal() * (Number(d.reserva.metaMeses) || 6);
    const anos = MES3.map((n, i) => { const l = doMes(st.ref.y, i); return { n, i, e: soma(entradas(l)), s: soma(saidas(l)) }; }), max = Math.max(1, ...anos.map((x) => Math.max(x.e, x.s)));
    const top = (st.visaoGastos === "pagamento" ? porFormaPagamento(saidas(lm)) : porTipo(saidas(lm), false)).map(([k, v]) => ({ k, v }));
    const pagasMes = saidas(lm).filter((l) => l.pago).length;
    const proximos = d.lancamentos.filter((l) => l.tipo === "saida" && !l.pago).filter((l) => { const dias = (new Date(l.data + "T00:00:00") - new Date(hojeIso() + "T00:00:00")) / 864e5; return dias <= 30; }).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 40);
    const dE = delta(ent, entA), dS = delta(sai, saiA, true);
    return `<div class="fn-kpis">
        ${kpi("Entrou no mês", R$(ent), "entra", `${R$(soma(entradas(lm).filter((l) => !l.pago)))} a receber`, "", dE, "entrou")}
        ${kpi("Saiu no mês", R$(sai), "sai", `${R$(soma(saidas(lm).filter((l) => !l.pago)))} a pagar`, "", dS, "saiu")}
        ${kpi(sobra >= 0 ? "Sobrou no mês" : "Faltou no mês", R$(sobra), "carteira", "entradas menos saídas", sobra >= 0 ? "destaque" : "ruim", null, "sobra")}
        ${kpi("Dívida total", R$(divTotal), "queda", `${dividas.length} dívida${dividas.length === 1 ? "" : "s"} aberta${dividas.length === 1 ? "" : "s"}`, "", null, "divida")}
        ${kpi("Livre das dívidas", !dividas.length ? "Sem dívidas 🎉" : p.meses === null ? "+10 anos" : mesDaqui(p.meses), "bandeira", p.meses ? `${p.meses} meses no plano` : "", "bom", null, "livre")}
      </div>
      <div class="fn-grade">
        ${graficoAno(anos)}
        <div class="fn-caixa"><h3>Reserva de segurança</h3><p class="sub">Meta: ${d.reserva.metaMeses || 6} meses de gastos</p>
          <div class="fn-anel">${anel(meta ? res / meta : 0, meta ? Math.min(100, Math.round(res / meta * 100)) + "%" : "–")}<div><div class="fn-kpi-v" style="margin:0">${R$(res)}</div><small style="color:var(--suave)">de ${R$(meta)}</small><div style="margin-top:10px"><button class="fn-btn pequeno" type="button" data-aba="reserva">Ver reserva e investimentos</button></div></div></div></div>
      </div>
      <div class="fn-grade tres">
        <div class="fn-caixa"><div class="fn-cab"><div><h3>Para onde foi o dinheiro</h3><p class="sub">Saídas de ${MESES[st.ref.m].toLowerCase()} por ${st.visaoGastos === "pagamento" ? "forma de pagamento" : "categoria"}${top.length ? ` · ${top.length} ${top.length === 1 ? "grupo" : "grupos"}` : ""}</p></div><div class="fn-seg" role="group" aria-label="Visualização dos gastos"><button type="button" data-grafico-gastos="categoria" class="${st.visaoGastos === "categoria" ? "on" : ""}">Categorias</button><button type="button" data-grafico-gastos="pagamento" class="${st.visaoGastos === "pagamento" ? "on" : ""}">Pagamento</button></div></div>${top.length ? `<div class="fn-rosca">${rosca(top, sai, K(sai), CORES_CAT)}<ul class="fn-tipos">${top.map((c, i) => `<li><i style="background:${CORES_CAT[i % CORES_CAT.length]}"></i><span>${esc(c.k)}</span><em>${R$(c.v)}</em><b>${Math.round(c.v / Math.max(sai, 1) * 100)}%</b></li>`).join("")}</ul></div>` : `<p class="fn-vazio">Nenhuma saída neste mês.</p>`}</div>
        ${blocoVencimentos(proximos, pagasMes)}
        ${blocoSituacao(lm, ent, sai)}
      </div>
      ${blocoJornada(lm, dividas, p)}
      ${blocoConsultora(conselhosGerais())}
      <div class="fn-caixa${minimo("dash-lanc", false) ? " min" : ""}"><div class="fn-cab"><div><h3>Lançamentos de ${MESES[st.ref.m].toLowerCase()}</h3><p class="sub">${lm.length} lançamento${lm.length === 1 ? "" : "s"}${minimo("dash-lanc", false) ? " · toque na setinha para ver" : ""}</p></div>${botaoMin("dash-lanc", false)}</div>
        ${lm.length ? `<div class="fn-rolar"><table class="fn-tabela"><thead><tr><th>Data</th><th>Descrição</th><th class="esconde">Categoria</th><th>Situação</th><th class="num">Valor</th><th></th></tr></thead><tbody>
          ${[...lm].sort((a, b) => a.data.localeCompare(b.data)).map((l) => `<tr><td>${dataBR(l.data).slice(0, 5)}</td><td>${esc(l.descricao)}</td><td class="esconde"><span class="fn-tag">${esc(l.categoria || "")}</span></td><td><button class="fn-chip ${l.pago ? "" : vencido(l) ? "mal" : "amb"}" type="button" data-pagar="${esc(l.id)}" style="border:0;cursor:pointer">${l.pago ? (l.tipo === "entrada" ? "Recebido" : "Pago") : vencido(l) ? "Vencido" : "A " + (l.tipo === "entrada" ? "receber" : "pagar")}</button></td><td class="num"><span class="fn-valor ${l.tipo === "entrada" ? "entra" : "sai"}">${l.tipo === "entrada" ? "+" : "-"} ${R$(l.valor)}</span></td><td class="num"><button class="fn-icone" type="button" data-editar-l="${esc(l.id)}" aria-label="Editar">${ICONE.lapis}</button></td></tr>`).join("")}
        </tbody></table></div>` : `<p class="fn-vazio">Nenhum lançamento neste mês. Use os botões Entrada e Saída.</p>`}</div>`;
  }
  function blocoPlano(dividas, p) {
    const d = D();
    if (!dividas.length) return "";
    const m = minimo("dash-plano", false);
    return `<div class="fn-caixa${m ? " min" : ""}" style="margin-bottom:14px"><div class="fn-cab"><div><h3>Plano para sair das dívidas</h3><p class="sub">${m ? `${p.ordem.length} dívida${p.ordem.length === 1 ? "" : "s"} · livre ${p.meses !== null ? "em " + mesDaqui(p.meses) : "em mais de 10 anos"} · toque na setinha para ver` : "Paga o mínimo de todas e joga o extra numa só. Quando ela acaba, o valor dela vai para a próxima."}</p></div>${botaoMin("dash-plano", false)}
        <div class="fn-perfis" style="min-width:260px"><button type="button" data-metodo="avalanche" class="${st.metodo === "avalanche" ? "on" : ""}">Juros maior primeiro</button><button type="button" data-metodo="bola" class="${st.metodo === "bola" ? "on" : ""}">Menor dívida primeiro</button></div></div>
      <div class="fn-campo" style="max-width:320px;margin-bottom:10px"><label for="fn-extra">Quanto consigo pôr a mais por mês (além dos mínimos)</label><input class="fn-entrada" id="fn-extra" inputmode="decimal" value="${esc(d.extra)}"></div>
      <div class="fn-lista">${p.ordem.map((x, i) => `<div class="fn-item"><span class="fn-av" style="width:28px;height:28px;font-size:12px;background:${i ? "#cdb39b" : "#6b4a35"}">${i + 1}</span><div class="x"><b>${esc(x.nome)}</b><small>${x.tipo} · mínimo ${R$(x.minimo)}/mês${x.juros ? ` · ${String(x.juros).replace(".", ",")}% a.m.` : ""}</small></div><span class="fn-valor">${R$(x.saldo)}</span><span class="fn-chip neutro">${x.quitada ? mesDaqui(x.quitada) : "–"}</span></div>`).join("")}</div>
      <p style="font-size:11.5px;color:var(--suave);margin:8px 0 0">Estimativa: usa a dívida e o mínimo cadastrados e não soma juros novos (as parcelas já têm juros). Compra nova no cartão empurra a data para frente.</p></div>`;
  }
  function telaCartoes() {
    const d = D(), cs = d.cartoes, lm = doMes(st.ref.y, st.ref.m);
    const limite = cs.reduce((a, c) => a + (Number(c.limite) || 0), 0), disp = cs.reduce((a, c) => a + dispCartao(c), 0), div = cs.reduce((a, c) => a + dividaCartao(c), 0);
    const faturas = lm.filter((l) => l.categoria === "Cartão");
    return `<div class="fn-kpis">
        ${kpi("Limite total", R$(limite), "cartoes", `${cs.length} cartão${cs.length === 1 ? "" : "es"}`)}
        ${kpi("Limite disponível", R$(disp), "carteira", limite ? `${Math.round((1 - disp / limite) * 100)}% usado` : "")}
        ${kpi("Faturas do mês", R$(soma(faturas)), "sai", `${R$(soma(faturas.filter((l) => !l.pago)))} a pagar`, "destaque")}
        ${kpi("Dívida nos cartões", R$(div), "queda", "")}
        ${kpi("Quitados", `${cs.filter((c) => c.status === "Quitado").length} de ${cs.length}`, "check", "", "bom")}
      </div>
      ${blocoSairCartoes()}
      ${blocoConsultora(conselhosCartoes(), "Consultora: cartões")}
      <div class="fn-cab" style="margin-bottom:12px"><p class="fn-dica">Abra um cartão para ver a fatura por etiqueta. As compras do dia a dia ficam dentro da fatura e nunca somam duas vezes: a fatura vale o maior entre o valor dela e as compras lançadas. No fim do mês, digite o que veio no banco.</p><div class="fn-acoes"><button class="fn-btn" type="button" data-min-todos="c">Minimizar / abrir todos</button><button class="fn-btn" type="button" data-novo-cartao>${ICONE.mais}Novo cartão</button><button class="fn-btn principal" type="button" data-nova-compra>${ICONE.mais}Compra no cartão</button></div></div>
      <div class="fn-cartoes">${[...cs].sort((a, b) => dividaCartao(b) - dividaCartao(a)).map((c) => {
        const uso = Number(c.limite) > 0 ? Math.max(0, Math.min(1, 1 - dispCartao(c) / Number(c.limite))) : null;
        const fat = lm.find((l) => eDoCartao(l, c));
        if (!minimo("c" + c.id, true)) return cartaoAberto(c, fat, uso);
        return `<div class="fn-plast${minimo("c" + c.id, true) ? " min" : ""}${c.status === "Quitado" ? " quitado" : /atras/i.test(c.status || "") ? " atraso" : ""}"><div class="frente"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>${esc(c.nome)}</b><span class="fn-chip neutro" style="background:rgba(255,255,255,.22);color:#fff">${esc(c.status || "Ativo")}</span></div><span class="num">•••• •••• •••• ${esc(c.final || "")}</span><div style="display:flex;justify-content:space-between"><small>${c.vencimento ? "vence dia " + esc(c.vencimento) : "sem vencimento"}${c.juros ? " · " + String(c.juros).replace(".", ",") + "% a.m." : ""}</small><small>disponível ${R$(dispCartao(c))}</small></div></div>
          ${uso !== null ? `<div><div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--suave);margin-bottom:4px"><span>Limite usado</span><span>${Math.round(uso * 100)}% de ${R$(c.limite)}</span></div><div class="fn-barra"><i style="width:${(uso * 100).toFixed(1)}%;background:${uso > 0.8 ? "#b8473a" : uso > 0.3 ? "#a87058" : "#4f7a54"}"></i></div></div>` : ""}
          <div class="fn-par"><span>Fatura de ${MES3[st.ref.m].toLowerCase()}<b>${fat ? R$(fat.valor) : "–"}</b></span><span>Situação<b>${fat ? (fat.pago ? "Paga" : vencido(fat) ? "Vencida" : "A pagar") : "–"}</b></span><span>Próxima fatura<b>${R$(c.proximaFatura)}</b></span><span>Falta pagar<b>${R$(dividaCartao(c))}</b></span></div>
          ${c.status !== "Quitado" || comprasDaFatura(c, st.ref.y, st.ref.m).length ? blocoCompras(c) : ""}
          <div class="fn-resumo"><span>Fatura de ${MES3[st.ref.m].toLowerCase()}<b>${fat ? R$(fat.valor) : "–"}</b></span><span>Falta pagar<b>${R$(dividaCartao(c))}</b></span></div>
          <div class="fn-acoes">${botaoMin("c" + c.id, true)}${fat ? `<button class="fn-btn pequeno" type="button" data-pagar="${esc(fat.id)}">${ICONE.check}${fat.pago ? "Desmarcar" : "Paguei a fatura"}</button>` : `<button class="fn-btn pequeno" type="button" data-fatura="${esc(c.id)}">${ICONE.mais}Lançar fatura</button>`}<button class="fn-icone" type="button" data-editar-c="${esc(c.id)}" aria-label="Editar">${ICONE.lapis}</button></div></div>`;
      }).join("") || `<p class="fn-vazio">Nenhum cartão ainda.</p>`}</div>`;
  }
  function telaEmprestimos() {
    const d = D(), es = d.emprestimos, abertos = es.filter((e) => dividaEmp(e) > 0);
    const saldo = abertos.reduce((a, e) => a + dividaEmp(e), 0), parc = abertos.reduce((a, e) => a + (Number(e.parcela) || 0), 0);
    const quitar = abertos.reduce((a, e) => a + (Number(e.quitacao) || Number(e.saldo) || 0), 0), econ = abertos.reduce((a, e) => a + Math.max(0, (Number(e.saldo) || 0) - (Number(e.quitacao) || Number(e.saldo) || 0)), 0);
    return `<div class="fn-kpis">
        ${kpi("Saldo devedor", R$(saldo), "queda", `${abertos.length} em aberto`)}
        ${kpi("Parcelas por mês", R$(parc), "sai", "")}
        ${kpi("Quitar tudo hoje sairia", R$(quitar), "carteira", econ ? `economia de ${R$(econ)}` : "", "bom")}
        ${kpi("Em atraso", String(es.filter((e) => /atras/i.test(e.status || "")).length), "bandeira", "", es.some((e) => /atras/i.test(e.status || "")) ? "ruim" : "")}
        ${kpi("Quitados", `${es.filter((e) => e.status === "Quitado").length} de ${es.length}`, "check", "", "destaque")}
      </div>
      ${blocoEmpNovos()}
      ${blocoConsultora(conselhosEmprestimos(), "Consultora: empréstimos")}
      <div class="fn-cab" style="margin-bottom:12px"><span></span><div class="fn-acoes"><button class="fn-btn" type="button" data-min-todos="e">Minimizar / abrir todos</button><button class="fn-btn principal" type="button" data-novo-emp>${ICONE.mais}Novo empréstimo</button></div></div>
      <div class="fn-cartoes">${[...es].sort((a, b) => dividaEmp(b) - dividaEmp(a)).map((e) => {
        const prog = Number(e.totalParcelas) > 0 ? Math.min(1, Number(e.pagas || 0) / Number(e.totalParcelas)) : null, ec = Math.max(0, (Number(e.saldo) || 0) - (Number(e.quitacao) || Number(e.saldo) || 0));
        return `<div class="fn-plast${minimo("e" + e.id, e.status === "Quitado") ? " min" : ""}${e.status === "Quitado" ? " quitado" : /atras/i.test(e.status || "") ? " atraso" : ""}"><div class="frente"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(e.nome)}</b><span class="fn-chip neutro" style="background:rgba(255,255,255,.22);color:#fff">${esc(e.status || "Ativo")}</span></div><small>${e.vencimento ? "vence dia " + esc(e.vencimento) : "sem vencimento"}${e.juros ? " · " + String(e.juros).replace(".", ",") + "% a.m." : ""}</small></div>
          ${prog !== null ? `<div><div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--suave);margin-bottom:4px"><span>${e.pagas || 0} de ${e.totalParcelas} parcelas pagas</span><span>${Math.round(prog * 100)}%</span></div><div class="fn-barra"><i style="width:${(prog * 100).toFixed(1)}%;background:#4f7a54"></i></div></div>` : ""}
          <div class="fn-par"><span>Parcela<b>${R$(e.parcela)}</b></span><span>Saldo devedor<b>${R$(e.saldo)}</b></span><span>Quitar hoje<b>${e.quitacao ? R$(e.quitacao) : "–"}</b></span><span>Economia quitando<b style="color:${ec ? "#4f7a54" : "inherit"}">${ec ? R$(ec) : "–"}</b></span></div>
          <div class="fn-resumo"><span>Parcela<b>${R$(e.parcela)}</b></span><span>Saldo devedor<b>${R$(e.saldo)}</b></span></div>
          <div class="fn-acoes">${botaoMin("e" + e.id, e.status === "Quitado")}${e.status !== "Quitado" ? `<button class="fn-btn pequeno" type="button" data-parcela="${esc(e.id)}">${ICONE.check}Paguei a parcela</button>` : ""}<button class="fn-icone" type="button" data-editar-e="${esc(e.id)}" aria-label="Editar">${ICONE.lapis}</button></div></div>`;
      }).join("") || `<p class="fn-vazio">Nenhum empréstimo ainda.</p>`}</div>`;
  }
  function telaReserva() {
    const d = D(), res = Number(d.reserva.atual) || 0, custo = custoMensal(), meta = custo * (Number(d.reserva.metaMeses) || 6);
    const inv = d.investimentos || [], totInv = inv.reduce((a, i) => a + (Number(i.valor) || 0), 0), contas = d.contas || [];
    const falta = Math.max(0, meta - res), meses = Number(d.reserva.aporte) > 0 ? Math.ceil(falta / d.reserva.aporte) : null;
    const movs = d.reserva.movs || [], sacadoAno = movs.filter((m) => m.tipo === "saque" && String(m.data).startsWith(st.ref.y + "-")).reduce((a, m) => a + (Number(m.valor) || 0), 0);
    return `<div class="fn-kpis">
        ${kpi("Reserva hoje", R$(res), "reserva", `${meta ? Math.min(100, Math.round(res / meta * 100)) + "% da meta · " : ""}sacado em ${st.ref.y}: ${R$(sacadoAno)}`, "bom")}
        ${kpi("Meta da reserva", R$(meta), "bandeira", `${d.reserva.metaMeses || 6} meses de ${R$(custo)}`)}
        ${kpi("Guardando por mês", R$(d.reserva.aporte), "entra", meses !== null ? (falta ? `meta em ${meses} meses` : "meta batida") : "defina o valor")}
        ${kpi("Investido", R$(totInv), "queda", `${inv.length} aplicaç${inv.length === 1 ? "ão" : "ões"}`, "destaque")}
        ${kpi("Saldo nas contas", R$(contas.reduce((a, c) => a + (Number(c.saldo) || 0), 0)), "carteira", `${contas.length} conta${contas.length === 1 ? "" : "s"}`)}
      </div>
      ${blocoConsultora(conselhosReserva(), "Consultora: reserva e investimentos")}
      <div class="fn-grade meio">
        <div class="fn-caixa"><h3>Reserva de segurança</h3><p class="sub">Dinheiro para imprevisto, que dá para tirar no mesmo dia</p>
          <div class="fn-anel" style="margin-bottom:12px">${anel(meta ? res / meta : 0, meta ? Math.min(100, Math.round(res / meta * 100)) + "%" : "–")}<div><small style="color:var(--suave)">Sobrou na reserva</small><br><b style="font-size:22px">${R$(res)}</b><br><small style="color:var(--suave)">faltam ${R$(falta)} para a meta</small></div></div>
          <div class="fn-acoes" style="justify-content:flex-start;margin-bottom:14px"><button class="fn-btn perigo" type="button" data-mov-res="saque">${ICONE.sai}Fiz um saque</button><button class="fn-btn principal" type="button" data-mov-res="deposito">${ICONE.entra}Guardei dinheiro</button></div>
          <div class="duplo" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <div class="fn-campo"><label for="fn-res">Guardado</label><input class="fn-entrada" id="fn-res" inputmode="decimal" value="${esc(d.reserva.atual)}"></div>
            <div class="fn-campo"><label for="fn-aporte">Por mês</label><input class="fn-entrada" id="fn-aporte" inputmode="decimal" value="${esc(d.reserva.aporte)}"></div>
            <div class="fn-campo"><label for="fn-metam">Meta (meses)</label><input class="fn-entrada" id="fn-metam" inputmode="numeric" value="${esc(d.reserva.metaMeses || 6)}"></div></div>
          <p style="font-size:11.5px;color:var(--suave);margin:10px 0 0">Gasto mensal usado na conta: média das saídas dos últimos 3 meses (${R$(custo)}).</p>
          <h3 style="margin-top:18px">Saques e depósitos</h3><p class="sub">Cada movimento atualiza quanto sobrou</p>
          <div class="fn-lista">${movs.slice(0, 12).map((m) => `<div class="fn-item"><div class="x"><b>${m.tipo === "saque" ? "Saque" : "Guardei"}${m.obs ? " · " + esc(m.obs) : ""}</b><small>${dataBR(m.data)} · ficou ${R$(m.saldo)}</small></div><span class="fn-valor ${m.tipo === "saque" ? "sai" : "entra"}">${m.tipo === "saque" ? "-" : "+"} ${R$(m.valor)}</span><button class="fn-icone" type="button" data-apagar-mov="${esc(m.id)}" aria-label="Apagar movimento">${ICONE.lixo}</button></div>`).join("") || `<p class="fn-vazio">Nenhum saque ou depósito ainda.</p>`}</div></div>
        <div class="fn-caixa"><div class="fn-cab"><div><h3>Investimentos</h3><p class="sub">Onde o dinheiro está aplicado</p></div><button class="fn-btn pequeno" type="button" data-novo-inv>${ICONE.mais}Novo</button></div>
          <div class="fn-lista">${inv.map((i) => `<div class="fn-item"><div class="x"><b>${esc(i.nome)}</b><small>${esc(i.tipo || "")}${i.rendimento ? ` · rende ${String(i.rendimento).replace(".", ",")}% a.m.` : ""}${i.liquidez ? " · " + esc(i.liquidez) : ""}</small></div><span class="fn-valor">${R$(i.valor)}</span><button class="fn-icone" type="button" data-editar-i="${esc(i.id)}" aria-label="Editar">${ICONE.lapis}</button></div>`).join("") || `<p class="fn-vazio">Nenhum investimento cadastrado.</p>`}</div>
          <h3 style="margin-top:18px">Contas no banco</h3><p class="sub">Saldo de cada conta</p>
          <div class="fn-lista">${contas.map((c) => `<div class="fn-item"><div class="x"><b>${esc(c.nome)}</b></div><span class="fn-valor">${R$(c.saldo)}</span><button class="fn-icone" type="button" data-editar-conta="${esc(c.id)}" aria-label="Editar">${ICONE.lapis}</button></div>`).join("")}</div>
          <button class="fn-btn pequeno" type="button" data-nova-conta style="margin-top:8px">${ICONE.mais}Conta</button></div>
      </div>`;
  }
  // minimizar cartão/empréstimo (fica só o plástico e o resumo); quitados começam minimizados. Guardado neste aparelho.
  let MIN = {}; try { MIN = JSON.parse(localStorage.getItem("fn-min") || "{}"); } catch (e) { MIN = {}; }
  const minimo = (id, padrao) => (id in MIN ? MIN[id] : padrao);
  const botaoMin = (id, padrao) => { const m = minimo(id, padrao); return `<button class="fn-icone fn-min-btn" type="button" data-min="${esc(id)}" data-padrao="${padrao ? 1 : 0}" aria-expanded="${!m}" title="${m ? "Ver tudo" : "Minimizar"}" aria-label="${m ? "Ver tudo" : "Minimizar"}"><svg viewBox="0 0 24 24"><path d="${m ? "M6 9l6 6 6-6" : "M6 15l6-6 6 6"}"/></svg></button>`; };
  const guardarMin = () => { try { localStorage.setItem("fn-min", JSON.stringify(MIN)); } catch (e) { /* sem armazenamento */ } };
  // nov/2026 (referência da Mari): cartão aberto em painel, com o cartão desenhado, a fatura, gastos por etiqueta, gastos por dia e as compras
  const corEtq = (k) => k === "Sem detalhe" ? "#c9c4d6" : CORES_CAT[Math.max(0, CAT_SAIDA.indexOf(k)) % CORES_CAT.length];
  function cartaoAberto(c, fat, uso) {
    const ks = comprasDaFatura(c, st.ref.y, st.ref.m).sort((a, b) => String(b.data).localeCompare(String(a.data)));
    const somado = Math.round(ks.reduce((a, k) => a + k.parte.valor, 0) * 100) / 100, valorFat = fat ? Number(fat.valor) || 0 : somado;
    const semDet = Math.max(0, Math.round((valorFat - somado) * 100) / 100);
    const porEtq = {}; ks.forEach((k) => { const e = k.categoria || catAuto(k.descricao) || "Outros"; porEtq[e] = (porEtq[e] || 0) + k.parte.valor; });
    const itens = Object.entries(porEtq).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v }));
    if (semDet > 0.004) itens.push({ k: "Sem detalhe", v: semDet });
    const total = itens.reduce((a, x) => a + x.v, 0);
    const curto = (v) => v >= 1000 ? "R$ " + (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "k" : "R$ " + Math.round(v);
    // gastos por dia das compras desta fatura
    const dias = {}; ks.forEach((k) => { dias[k.data] = (dias[k.data] || 0) + k.parte.valor; });
    const ld = Object.entries(dias).sort((a, b) => a[0].localeCompare(b[0])), maxD = Math.max(1, ...ld.map(([, v]) => v));
    const ym = ymDe(st.ref.y, st.ref.m), conf = (c.conferidas || {})[ym], dif = conf != null ? Math.round((conf - somado) * 100) / 100 : null;
    const cls = c.status === "Quitado" ? " quitado" : /atras/i.test(c.status || "") ? " atraso" : "";
    return `<div class="fn-plast fn-cd${cls}">
      <div class="fn-cd-lado">
        <div class="frente"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>${esc(c.nome)}</b><span class="fn-chip neutro" style="background:rgba(255,255,255,.22);color:#fff">${esc(c.status || "Ativo")}</span></div><span class="fn-cd-chip" aria-hidden="true"></span><span class="num">•••• •••• •••• ${esc(c.final || "")}</span><small>${c.vencimento ? "vence dia " + esc(c.vencimento) : "sem vencimento"}${c.fechamento ? " · fecha dia " + esc(c.fechamento) : ""}${c.juros ? " · " + String(c.juros).replace(".", ",") + "% a.m." : ""}</small></div>
        <div class="fn-cd-disp"><small>Limite disponível</small><b>${R$(dispCartao(c))}</b>
          ${uso !== null ? `<div class="fn-barra"><i style="width:${(uso * 100).toFixed(1)}%;background:${uso > 0.8 ? "#b8473a" : uso > 0.3 ? "#a87058" : "#4f7a54"}"></i></div><small>${Math.round(uso * 100)}% de ${R$(c.limite)} usado</small>` : ""}</div>
        <div class="fn-par"><span>Situação<b>${fat ? (fat.pago ? "Paga" : vencido(fat) ? "Vencida" : "A pagar") : "–"}</b></span><span>Próxima fatura<b>${R$(c.proximaFatura)}</b></span><span>Falta pagar<b>${R$(dividaCartao(c))}</b></span></div>
        <div class="fn-acoes">${botaoMin("c" + c.id, true)}${fat ? `<button class="fn-btn pequeno" type="button" data-pagar="${esc(fat.id)}">${ICONE.check}${fat.pago ? "Desmarcar" : "Paguei a fatura"}</button>` : `<button class="fn-btn pequeno" type="button" data-fatura="${esc(c.id)}">${ICONE.mais}Lançar fatura</button>`}<button class="fn-icone" type="button" data-editar-c="${esc(c.id)}" aria-label="Editar cartão">${ICONE.lapis}</button></div>
      </div>
      <div class="fn-cd-meio">
        <div class="fn-cd-topo"><div><small>Fatura de ${MESES[st.ref.m].toLowerCase()}</small><b>${R$(valorFat)}</b><span class="fn-cd-expl">${somado > 0 ? `${R$(somado)} em compras lançadas${semDet > 0.004 ? ` · ${R$(semDet)} sem detalhe` : ""}` : "Lance as compras do dia a dia para ver onde foi o dinheiro"}</span></div>
          <button class="fn-btn pequeno principal" type="button" data-nova-compra="${esc(c.id)}">${ICONE.mais}Compra</button></div>
        <div class="fn-cd-graf">
          <div class="fn-cd-bloco"><h4>Gastos por etiqueta</h4>${total > 0 ? `<div class="fn-cd-rosca">${rosca(itens, total, curto(total), itens.map((x) => corEtq(x.k)))}<ul>${itens.map((x) => `<li><i style="background:${corEtq(x.k)}"></i><span>${esc(x.k)}</span><em>${Math.round(x.v / total * 100)}%</em><b>${R$(x.v)}</b></li>`).join("")}</ul></div>` : `<p class="fn-vazio">Sem gastos nesta fatura ainda.</p>`}</div>
          <div class="fn-cd-bloco"><h4>Gastos por dia</h4>${ld.length ? `<div class="fn-cd-barras">${ld.map(([dt, v]) => `<div title="${dataBR(dt)}: ${R$(v)}"><i style="height:${Math.max(4, v / maxD * 100).toFixed(1)}%"></i><small>${dt.slice(8, 10)}/${dt.slice(5, 7)}</small></div>`).join("")}</div>` : `<p class="fn-vazio">As compras lançadas aparecem aqui, dia a dia.</p>`}</div>
        </div>
        <div class="fn-cd-bloco"><h4>Compras na fatura</h4>
          ${ks.length ? `<div class="fn-cd-lista">${ks.map((k) => { const e = k.categoria || catAuto(k.descricao) || "Outros"; return `<div class="fn-cd-item"><span class="fn-cd-dia">${dataBR(k.data).slice(0, 5)}</span><span class="fn-cd-desc"><b>${esc(k.descricao)}</b>${k.parte.de > 1 ? `<small>parcela ${k.parte.n} de ${k.parte.de}</small>` : ""}</span><span class="fn-cd-etq" style="--c:${corEtq(e)}">${esc(e)}</span><span class="fn-valor">${R$(k.parte.valor)}</span><button class="fn-icone" type="button" data-editar-compra="${esc(k.id)}" aria-label="Editar compra">${ICONE.lapis}</button></div>`; }).join("")}</div>` : `<p class="fn-vazio">Nenhuma compra lançada nesta fatura.</p>`}
          <div class="fn-conferir"><span>Somado: <b>${R$(somado)}</b></span><label>Veio no banco <input class="fn-entrada" inputmode="decimal" data-conferir="${esc(c.id)}" value="${conf != null ? esc(Number(conf).toLocaleString("pt-BR", { minimumFractionDigits: 2 })) : ""}" placeholder="0,00"></label></div>
          ${dif === null ? "" : Math.abs(dif) < 0.01 ? `<p class="fn-bateu ok">✓ Bateu certinho com o banco.</p>` : `<p class="fn-bateu mal">${dif > 0 ? `O banco cobrou ${R$(dif)} a mais do que você lançou.` : `O banco cobrou ${R$(-dif)} a menos do que você lançou. Confira se alguma compra caiu na próxima fatura.`} A fatura usa o valor do banco.</p>`}
        </div>
      </div>
    </div>`;
  }
  // nov/2026: na Visão anual, o botão do cartão na linha da fatura abre as compras dela (lançar, editar, conferir com o banco)
  function janelaCompras(c, ym) {
    let dlg = $("#fn-janela"); if (!dlg) { dlg = document.createElement("dialog"); dlg.id = "fn-janela"; dlg.className = "fn-janela"; document.body.appendChild(dlg); }
    const [y, m] = ym.split("-").map(Number), ks = comprasDaFatura(c, y, m - 1).sort((a, b) => String(b.data).localeCompare(String(a.data)));
    const somado = Math.round(ks.reduce((a, k) => a + k.parte.valor, 0) * 100) / 100, fat = D().lancamentos.find((l) => eDoCartao(l, c) && l.data.slice(0, 7) === ym);
    const valor = fat ? Number(fat.valor) || 0 : somado, semDet = Math.max(0, Math.round((valor - somado) * 100) / 100), conf = (c.conferidas || {})[ym];
    dlg.innerHTML = `<form method="dialog" novalidate><h2>${esc(c.nome)} · fatura de ${MESES[m - 1].toLowerCase()}</h2>
      <p class="fn-dica" style="margin:0 0 10px">Fatura: <b>${R$(valor)}</b>${somado > 0 ? ` · ${R$(somado)} em compras${semDet > 0.004 ? ` · ${R$(semDet)} sem detalhe` : ""}` : ""}. As compras ficam dentro da fatura: nunca somam duas vezes.</p>
      <div class="fn-cd-lista">${ks.map((k) => { const e = k.categoria || catAuto(k.descricao) || "Outros"; return `<div class="fn-cd-item"><span class="fn-cd-dia">${dataBR(k.data).slice(0, 5)}</span><span class="fn-cd-desc"><b>${esc(k.descricao)}</b>${k.parte.de > 1 ? `<small>parcela ${k.parte.n} de ${k.parte.de}</small>` : ""}</span><span class="fn-cd-etq" style="--c:${corEtq(e)}">${esc(e)}</span><span class="fn-valor">${R$(k.parte.valor)}</span><button class="fn-icone" type="button" data-jc-editar="${esc(k.id)}" aria-label="Editar compra">${ICONE.lapis}</button></div>`; }).join("") || `<p class="fn-vazio">Nenhuma compra lançada nesta fatura.</p>`}</div>
      <div class="fn-conferir"><span>Somado: <b>${R$(somado)}</b></span><label>Veio no banco <input class="fn-entrada" inputmode="decimal" id="jc-conf" value="${conf != null ? esc(Number(conf).toLocaleString("pt-BR", { minimumFractionDigits: 2 })) : ""}" placeholder="0,00"></label></div>
      <div class="rodape"><button class="fn-btn" type="button" id="jc-fechar">Fechar</button><button class="fn-btn principal" type="button" id="jc-nova">${ICONE.mais}Compra</button></div></form>`;
    $("#jc-fechar", dlg).addEventListener("click", () => dlg.close());
    $("#jc-nova", dlg).addEventListener("click", () => editarCompra(null, c.id));
    $$("[data-jc-editar]", dlg).forEach((b) => b.addEventListener("click", () => editarCompra((D().compras || []).find((k) => k.id === b.dataset.jcEditar))));
    $("#jc-conf", dlg).addEventListener("change", (e) => { c.conferidas = c.conferidas || {}; c.conferidas[ym] = e.target.value.trim() === "" ? null : numOuNada(e.target.value); salvar(); pintar(); janelaCompras(c, ym); });
    if (!dlg.open) dlg.showModal();
  }
  // nov/2026 (pedido da Mari): "Como usar esta aba", para não esquecer; fica fechado até ela tocar
  const AJUDA = {
    dash: ["Esta tela só mostra: tudo vem do que você lança na Visão anual.", "Os cartões coloridos do topo abrem o detalhe ao tocar.", "Situação do mês: se sobrou ou faltou, o que mais pesou e quanto das entradas vai para dívidas (o ideal é até 30%).", "Minha jornada: quanto falta de dívida, o seu plano do mês (marca sozinho) e o melhor movimento agora.", "Use as setas do mês no topo para ver outros meses."],
    anual: ["É aqui que você lança e edita tudo, igual à planilha. O resto do app só mostra.", "Escolha Saídas ou Entradas, o ano e o mês. + Nova saída / + Nova entrada para lançar.", "Gasto no cartão: em Nova saída, escolha o cartão em \"Como paguei\". Ele entra dentro da fatura e não soma duas vezes.", "Na linha da fatura, o botão do cartão abre as compras dela: + Compra, editar e \"Veio no banco\".", "Troque a situação (pago, a pagar) direto na tabela. O botão de copiar leva a linha para o mês seguinte."],
    entradas: ["Só mostra as entradas do mês. Para lançar ou mudar, use a Visão anual.", "Entradas do CNPJ (publi e UGC) chegam sozinhas do painel e aparecem com a marca CNPJ.", "Salário, MARKETPLACE e PUBLI COMERCIAL você lança na Visão anual."],
    saidas: ["Só mostra as saídas do mês. Para lançar ou mudar, use a Visão anual.", "\"Por tipo\" abre as faturas de cartão pelas etiquetas das compras: é aqui que você vê onde cortar."],
    cartoes: ["Cada cartão começa minimizado: toque na setinha para abrir a fatura, as etiquetas, os gastos por dia e as compras.", "Compras do cartão você lança na Visão anual (Nova saída com o cartão em \"Como paguei\", ou pelo botão do cartão na linha da fatura).", "A fatura vale o maior entre o valor dela e as compras lançadas; \"Veio no banco\" manda em tudo.", "Sair das dívidas: escolha a estratégia e arraste o valor extra para ver quando você fica livre."],
    emprestimos: ["A projeção usa as parcelas que estão na Visão anual: o saldo cai a cada mês até zerar.", "Cadastre ou edite o empréstimo (nome, parcela, juros) aqui; as parcelas do mês você marca como pagas na Visão anual.", "A dica inteligente mostra qual empréstimo termina primeiro e quanto sobra por mês quando ele acabar."],
    reserva: ["Guarde ou retire dinheiro da reserva aqui; a meta é de alguns meses dos seus gastos.", "As contas e investimentos ficam cadastrados aqui mesmo."],
  };
  const blocoAjuda = (aba) => AJUDA[aba] ? `<details class="fn-ajuda"><summary>${ICONE.brilho}Como usar esta aba</summary><ul>${AJUDA[aba].map((t) => `<li>${esc(t)}</li>`).join("")}</ul></details>` : "";

  // ---------- empréstimos: projeção do saldo, resumo e dica (pelas parcelas lançadas) ----------
  function parcelasEmp() {
    const hj = hojeIso().slice(0, 7);
    const ls = D().lancamentos.filter((l) => l.tipo === "saida" && !l.pago && (l.categoria === "Empréstimo" || String(l.id).startsWith("cpfe-")) && l.data.slice(0, 7) >= hj);
    const grupos = {}; ls.forEach((l) => { const k = String(l.id).startsWith("cpfe-") ? String(l.id).split("-").slice(0, 2).join("-") : l.descricao; (grupos[k] = grupos[k] || { nome: l.descricao, ls: [] }).ls.push(l); });
    return { ls, grupos: Object.values(grupos).map((g) => ({ nome: g.nome.replace(/^Parcela\s+/i, ""), total: soma(g.ls), parcela: Number(g.ls.sort((a, b) => a.data.localeCompare(b.data))[0].valor) || 0, fim: g.ls[g.ls.length - 1].data, n: g.ls.length })).sort((a, b) => a.fim.localeCompare(b.fim)) };
  }
  function blocoEmpNovos() {
    const { ls, grupos } = parcelasEmp(); const hoje = new Date();
    const meses = Array.from({ length: 12 }, (_, i) => { const x = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1); const ym = ymDe(x.getFullYear(), x.getMonth()); return { r: MES3[x.getMonth()], v: soma(ls.filter((l) => l.data.slice(0, 7) >= ym)) }; });
    const max = Math.max(1, ...meses.map((m) => m.v)), total = meses[0].v, porMes = soma(ls.filter((l) => l.data.slice(0, 7) === hojeIso().slice(0, 7)));
    const prim = grupos[0];
    const dica = !grupos.length ? "Lance as parcelas dos empréstimos na Visão anual (com a etiqueta Empréstimo) que eu projeto quando você fica livre." :
      `${esc(prim.nome)} é o primeiro a acabar: última parcela em ${MESES[new Date(prim.fim + "T00:00:00").getMonth()].toLowerCase()} de ${prim.fim.slice(0, 4)}. Depois dele sobram ${R$(prim.parcela)} por mês: em vez de gastar, jogue esse valor na dívida de juros mais altos.`;
    return `<div class="fn-grade meio">
      <div class="fn-caixa"><h3>Projeção do saldo devedor</h3><p class="sub">Como o total cai nos próximos meses, mantendo as parcelas atuais</p>
        ${total > 0 ? `<div class="fn-proj">${meses.map((m) => `<div title="${m.r}: ${R$(m.v)}"><i style="height:${Math.max(2, m.v / max * 100).toFixed(1)}%"></i><small>${m.r}</small></div>`).join("")}</div>` : `<p class="fn-vazio">Sem saldo devedor para projetar. 🎉</p>`}</div>
      <div class="fn-caixa"><h3>Resumo dos empréstimos</h3><p class="sub">${total > 0 ? `${R$(total)} pela frente · ${R$(porMes)} neste mês` : "Nenhum empréstimo com parcela a pagar"}</p>
        <div class="fn-lista">${grupos.map((g) => `<div class="fn-item"><div class="x"><b>${esc(g.nome)}</b><small>${g.n} parcela${g.n === 1 ? "" : "s"} de ${R$(g.parcela)} · termina em ${MES3[new Date(g.fim + "T00:00:00").getMonth()].toLowerCase()}/${g.fim.slice(2, 4)}</small></div><span class="fn-valor">${R$(g.total)}</span></div>`).join("")}</div></div>
    </div>
    <div class="fn-dica-int">${ICONE.brilho}<div><b>Dica inteligente</b><span>${dica}</span></div></div>`;
  }

  // ---------- cartões: sair das dívidas (estratégia, ataque primeiro, jornada, dinheiro extra) ----------
  const ESTRATEGIAS = [["recomendado", "Recomendado pelo app", "Considera juros, tamanho da dívida e peso no orçamento juntos."], ["bola", "Menor dívida primeiro", "Quita a menor primeiro, para sentir progresso rápido."], ["avalanche", "Maiores juros primeiro", "Ataca a de maior juros: economiza mais no total."], ["parcela", "Liberar orçamento mais rápido", "Ataca a maior parcela, para sobrar dinheiro livre antes."]];
  function blocoSairCartoes() {
    const d = D(), dividas = listaDividas().filter((x) => x.tipo === "Cartão"), p = plano(dividas, d.extra, st.metodo), p0 = plano(dividas, 0, st.metodo);
    const cs = d.cartoes, com = cs.filter((c) => dividaCartao(c) > 0).length, sem = cs.length - com, pct = cs.length ? Math.round(sem / cs.length * 100) : 100;
    const ganho = p.meses !== null && p0.meses !== null ? p0.meses - p.meses : null;
    return `<div class="fn-caixa" style="margin-bottom:14px"><h3>Estratégia de quitação</h3><p class="sub">Escolha como atacar as dívidas dos cartões</p>
        <div class="fn-estr">${ESTRATEGIAS.map(([k, t, x]) => `<button type="button" data-metodo="${k}" class="${st.metodo === k ? "on" : ""}"><b>${t}${st.metodo === k ? " ✓" : ""}</b><small>${x}</small></button>`).join("")}</div></div>
      <div class="fn-grade meio">
        <div class="fn-caixa"><h3 class="fn-h-ataque">🔥 Ataque primeiro</h3><p class="sub">Ordem sugerida para você se livrar das dívidas</p>
          ${p.ordem.length ? `<div class="fn-lista">${p.ordem.map((x, i) => `<div class="fn-item"><span class="fn-av" style="width:28px;height:28px;font-size:12px;background:${i ? "#cdb39b" : "#6b4a35"}">${i + 1}</span><div class="x"><b>${esc(x.nome)}</b><small>${x.juros ? String(x.juros).replace(".", ",") + "% a.m. · " : ""}parcela ${R$(x.minimo)}${x.quitada ? ` · livre em ${mesDaqui(x.quitada)}` : ""}</small></div><span class="fn-valor">${R$(x.saldo)}</span></div>`).join("")}</div>` : `<p class="fn-vazio">Nenhuma dívida ativa nos cartões. 🎉</p>`}</div>
        <div class="fn-caixa"><h3>Sua jornada de liberdade</h3><p class="sub">${pct >= 100 ? "Todos os cartões sem dívida!" : "Você está cada vez mais perto de se livrar dos cartões"}</p>
          <div class="fn-jornada"><b>${pct}%</b><small>dos cartões sem dívida</small><div class="fn-barra"><i style="width:${pct}%;background:#4f7a54"></i></div>
          <div class="fn-par" style="grid-template-columns:repeat(3,1fr);text-align:center"><span>Cartões<b>${cs.length}</b></span><span>Sem dívida<b style="color:#4f7a54">${sem}</b></span><span>Com dívida<b style="color:#b8473a">${com}</b></span></div></div></div>
      </div>
      ${dividas.length ? `<div class="fn-caixa" style="margin-bottom:14px"><h3>💬 E se eu tiver dinheiro extra?</h3><p class="sub">Veja como um valor a mais por mês acelera a sua liberdade</p>
        <label class="fn-extra-rot" for="fn-extra-r">Quanto consigo pôr por mês além das faturas: <b id="fn-extra-v">${R$(d.extra)}</b></label>
        <input type="range" id="fn-extra-r" class="fn-extra-r" min="0" max="1500" step="50" value="${Math.min(1500, Number(d.extra) || 0)}">
        <p class="fn-extra-res">${p.meses === null ? "Com esse valor, as dívidas dos cartões passam de 10 anos. Tente um valor maior." : `Livre dos cartões em <b>${mesDaqui(p.meses)}</b> (${p.meses} ${p.meses === 1 ? "mês" : "meses"})${ganho > 0 ? `, ${ganho} ${ganho === 1 ? "mês" : "meses"} antes do que pagando só as faturas` : ""}.`}</p></div>` : ""}`;
  }

  // ---------- dashboard: situação do mês e minha jornada ----------
  function blocoSituacao(lm, ent, sai) {
    const sobra = ent - sai, top = porTipo(saidas(lm), false).slice(0, 3);
    const divid = soma(saidas(lm).filter((l) => ["Cartão", "Empréstimo", "Financiamento", "Dívida pessoal"].includes(l.categoria) || String(l.id).startsWith("cpff-") || String(l.id).startsWith("cpfe-")));
    const comp = ent > 0 ? Math.round(divid / ent * 100) : null;
    return `<div class="fn-caixa"><h3 class="${sobra >= 0 ? "fn-h-bom" : "fn-h-mal"}">${ICONE.bandeira}Situação de ${MESES[st.ref.m].toLowerCase()}</h3>
      <p class="fn-sit-frase">${sobra >= 0 ? `Sobraram ${R$(sobra)} este mês.` : `Seu orçamento está negativo em ${R$(-sobra)}.`}</p><p class="sub">${sobra >= 0 ? "Você recebeu mais do que gastou. Guarde parte na reserva." : "Você gastou mais do que recebeu este mês."}</p>
      ${top.length ? `<p class="fn-mini-tit">O que mais está pesando</p><div class="fn-lista">${top.map(([k, v]) => `<div class="fn-item"><div class="x"><b>${esc(k)}</b></div><span class="fn-valor sai">${R$(v)}</span></div>`).join("")}</div>` : ""}
      ${comp !== null ? `<p class="fn-mini-tit">Comprometimento da renda com dívidas</p><div class="fn-comp"><b class="${comp > 30 ? "mal" : "bom"}">${comp}%</b><small>de ${R$(ent)} · ideal até 30%</small></div><div class="fn-barra"><i style="width:${Math.min(100, comp)}%;background:${comp > 30 ? "#b8473a" : "#4f7a54"}"></i></div>` : ""}</div>`;
  }
  function blocoJornada(lm, dividas, p) {
    const d = D(), ym = ymDe(st.ref.y, st.ref.m), divTotal = dividas.reduce((a, x) => a + x.saldo, 0);
    const fixas = saidas(lm).filter((l) => l.categoria === "Conta fixa"), okFixas = fixas.length > 0 && fixas.every((l) => l.pago);
    const novasParc = (d.compras || []).some((k) => String(k.data).slice(0, 7) === ym && (Number(k.parcelas) || 1) > 1);
    const guardou = ((d.reserva && d.reserva.movs) || []).some((m) => m.tipo !== "saque" && String(m.data).slice(0, 7) === ym);
    const passos = [["Pagar todas as contas fixas", okFixas], ["Não criar novas parcelas ou dívidas", !novasParc], ["Guardar algo na reserva", guardou]];
    const alvo = p.ordem.find((x) => x.saldo > 0);
    return `<div class="fn-grade tres">
      <div class="fn-caixa"><h3>Dívidas</h3><p class="fn-sit-valor mal">${R$(divTotal)}</p><p class="sub">restantes em cartões e empréstimos${p.meses !== null && dividas.length ? ` · livre em ${mesDaqui(p.meses)}` : ""}</p></div>
      <div class="fn-caixa"><h3>Seu plano para ${MESES[st.ref.m].toLowerCase()}</h3><ul class="fn-passos">${passos.map(([t, ok], i) => `<li class="${ok ? "ok" : ""}"><span>${ok ? "✓" : i + 1}</span>${t}</li>`).join("")}</ul></div>
      <div class="fn-caixa"><h3 class="fn-h-estrela">⭐ Melhor movimento agora</h3>${alvo ? `<p class="fn-sit-frase" style="font-size:15px">Atacar <b>${esc(alvo.nome)}</b></p><p class="sub">Faltam ${R$(alvo.saldo)}${alvo.juros ? ` · ${String(alvo.juros).replace(".", ",")}% a.m.` : ""}. Pague o mínimo das outras e coloque o extra aqui.</p><button class="fn-btn pequeno" type="button" data-aba="${alvo.tipo === "Cartão" ? "cartoes" : "emprestimos"}">Ver o plano</button>` : `<p class="sub">Sem dívidas ativas: nada para atacar agora. 🎉</p>`}</div>
    </div>`;
  }
  function blocoCompras(c) {
    const ks = comprasDaFatura(c, st.ref.y, st.ref.m).sort((a, b) => String(b.data).localeCompare(String(a.data))), somado = ks.reduce((a, k) => a + k.parte.valor, 0);
    const ym = ymDe(st.ref.y, st.ref.m), conf = (c.conferidas || {})[ym], dif = conf != null ? Math.round((conf - somado) * 100) / 100 : null;
    return `<div class="fn-compras"><div class="fn-cab"><b>Compras na fatura de ${MES3[st.ref.m].toLowerCase()}</b><button class="fn-btn pequeno" type="button" data-nova-compra="${esc(c.id)}">${ICONE.mais}Compra</button></div>
      ${ks.map((k) => `<div class="fn-item"><div class="x"><b>${esc(k.descricao)}</b><small>${dataBR(k.data)}${k.parte.de > 1 ? ` · parcela ${k.parte.n} de ${k.parte.de}` : ""}</small></div><span class="fn-valor">${R$(k.parte.valor)}</span><button class="fn-icone" type="button" data-editar-compra="${esc(k.id)}" aria-label="Editar compra">${ICONE.lapis}</button></div>`).join("") || `<p class="fn-vazio">Nenhuma compra lançada nesta fatura.</p>`}
      <div class="fn-conferir"><span>Somado: <b>${R$(somado)}</b></span><label>Veio no banco <input class="fn-entrada" inputmode="decimal" data-conferir="${esc(c.id)}" value="${conf != null ? esc(Number(conf).toLocaleString("pt-BR", { minimumFractionDigits: 2 })) : ""}" placeholder="0,00"></label></div>
      ${dif === null ? "" : Math.abs(dif) < 0.01 ? `<p class="fn-bateu ok">✓ Bateu certinho com o banco.</p>` : `<p class="fn-bateu mal">${dif > 0 ? `O banco cobrou ${R$(dif)} a mais do que você lançou. Falta lançar alguma compra ou tem cobrança indevida.` : `O banco cobrou ${R$(-dif)} a menos. Confira se alguma compra caiu na próxima fatura.`} A fatura usa o valor do banco.</p>`}</div>`;
  }
  // soma por tipo; nas saídas a fatura do cartão abre nas compras dela (Mercado, Farmácia, Delivery...)
  function porTipo(lm, ent) {
    const porCat = {}, add = (k, v) => { porCat[k] = (porCat[k] || 0) + v; };
    lm.forEach((l) => {
      const c = !ent && D().cartoes.find((y) => eDoCartao(l, y));
      if (c) { // o que não foi lançado como compra fica em Cartão
        let resto = Number(l.valor) || 0; const dt = new Date(l.data + "T00:00:00");
        comprasDaFatura(c, dt.getFullYear(), dt.getMonth()).forEach((k) => { const v = Math.min(resto, k.parte.valor); if (v > 0) { add(k.categoria || catAuto(k.descricao) || "Outros", v); resto -= v; } });
        if (resto > 0.004) add("Gastos não detalhados", resto); return;
      }
      const cat = l.categoria && l.categoria !== "Outros" ? l.categoria : (!ent && catAuto(l.descricao)) || l.categoria || "Outros";
      add(cat, Number(l.valor) || 0);
    });
    return Object.entries(porCat).filter(([, v]) => v > 0.004).sort((a, b) => b[1] - a[1]);
  }
  // A fatura é agrupada pelo cartão; as demais saídas usam a forma registrada no lançamento.
  function porFormaPagamento(lm) {
    const grupos = {}, add = (k, v) => { grupos[k] = (grupos[k] || 0) + (Number(v) || 0); };
    lm.forEach((l) => {
      const c = D().cartoes.find((y) => eDoCartao(l, y));
      if (c) { add(c.nome, l.valor); return; }
      const forma = FORMAS.find(([k]) => k === l.forma);
      add(forma ? forma[1] : "Não informado", l.valor);
    });
    return Object.entries(grupos).filter(([, v]) => v > 0.004).sort((a, b) => b[1] - a[1]);
  }
  function telaMovimento(tipo) {
    const ent = tipo === "entrada", lm = doMes(st.ref.y, st.ref.m).filter((l) => l.tipo === tipo), ant = new Date(st.ref.y, st.ref.m - 1, 1), la = doMes(ant.getFullYear(), ant.getMonth()).filter((l) => l.tipo === tipo);
    const total = soma(lm), feito = soma(lm.filter((l) => l.pago)), ano = D().lancamentos.filter((l) => l.tipo === tipo && String(l.data).startsWith(st.ref.y + "-"));
    const mesesComValor = new Set(ano.map((l) => l.data.slice(5, 7))).size || 1;
    const cats = porTipo(lm, ent);
    const atalhos = ent ? ["Salário", "PUBLI", "MARKETPLACE"] : ["Conta fixa", "Mercado", "Delivery"];
    return `<div class="fn-kpis">
        ${kpi(ent ? "Entrou no mês" : "Saiu no mês", R$(total), ent ? "entra" : "sai", `${lm.length} lançamento${lm.length === 1 ? "" : "s"}`, "destaque", delta(total, soma(la), !ent))}
        ${kpi(ent ? "Já recebido" : "Já pago", R$(feito), "check", "")}
        ${kpi(ent ? "Falta receber" : "Falta pagar", R$(total - feito), "bandeira", "", total - feito > 0 && !ent ? "ruim" : "")}
        ${kpi(`Total em ${st.ref.y}`, R$(soma(ano)), "anual", `média de ${R$(soma(ano) / mesesComValor)} por mês`, "bom")}
      </div>
      <div class="fn-grade">
        <div class="fn-caixa"><div class="fn-cab"><div><h3>${ent ? "Entradas" : "Saídas"} de ${MESES[st.ref.m].toLowerCase()}</h3><p class="sub">Toque na situação para marcar como ${ent ? "recebido" : "pago"}</p></div>
          <div class="fn-acoes">${ent ? `${atalhos.map((a) => `<button class="fn-btn pequeno" type="button" data-novo-cat="${a}" data-tipo="${tipo}">${ICONE.mais}${a}</button>`).join("")}<button class="fn-btn pequeno principal" type="button" data-novo="${tipo}">${ICONE.mais}Outra</button>` : `<button class="fn-btn pequeno principal" type="button" data-novo="saida">${ICONE.mais}Nova saída</button>`}</div></div>
          ${lm.length ? `<div class="fn-rolar"><table class="fn-tabela"><thead><tr><th>Dia</th><th>Descrição</th><th class="esconde">Tipo</th><th>Situação</th><th class="num">Valor</th><th></th></tr></thead><tbody>
          ${[...lm].sort((a, b) => a.data.localeCompare(b.data)).map((l) => `<tr><td>${dataBR(l.data).slice(0, 5)}</td><td>${esc(l.descricao)}${l.auto ? ' <small class="fn-auto">soma das compras</small>' : ""}${l.marketplace || l.influencer ? `<small class="fn-loja">${esc([l.marketplace && "Loja: " + l.marketplace, l.influencer].filter(Boolean).join(" · "))}</small>` : ""}${l.origem === "pj" ? '<small class="fn-loja">CNPJ</small>' : ""}${!ent && l.forma ? `<small class="fn-loja">${esc((FORMAS.find(([k]) => k === l.forma) || [, ""])[1])}</small>` : ""}</td><td class="esconde"><span class="fn-tag">${esc(l.categoria || "")}</span></td><td><button class="fn-chip ${l.pago ? "" : vencido(l) ? "mal" : "amb"}" type="button" data-pagar="${esc(l.id)}" style="border:0;cursor:pointer">${l.pago ? (ent ? "Recebido" : "Pago") : vencido(l) ? "Vencido" : ent ? "A receber" : "A pagar"}</button></td><td class="num"><span class="fn-valor ${ent ? "entra" : "sai"}">${R$(l.valor)}</span></td><td class="num"><button class="fn-icone" type="button" data-editar-l="${esc(l.id)}" aria-label="Editar">${ICONE.lapis}</button></td></tr>`).join("")}
          </tbody></table></div>` : `<p class="fn-vazio">Nada lançado neste mês ainda.</p>`}</div>
        <div class="fn-caixa"><h3>Por tipo</h3><p class="sub">${ent ? "De onde veio o dinheiro" : "Para onde foi o dinheiro"}</p>
          <div class="fn-lista">${cats.map(([k, v], i) => `<div class="fn-item" style="flex-wrap:wrap"><div class="x"><b>${esc(k)}</b></div><span class="fn-valor">${R$(v)}</span><div class="fn-barra" style="flex-basis:100%"><i style="width:${(v / Math.max(total, 1) * 100).toFixed(1)}%;background:${CORES[i % CORES.length]}"></i></div></div>`).join("") || `<p class="fn-vazio">Sem valores neste mês.</p>`}</div></div>
      </div>
      ${blocoConsultora(ent ? conselhosEntradas() : conselhosGerais().slice(0, 4), ent ? "Consultora: entradas" : "Consultora: saídas")}`;
  }
  function conselhosEntradas() {
    const m = media3(), d = D(), out = [], fixas = d.lancamentos.filter((l) => l.tipo === "entrada" && /sal[aá]rio|vale/i.test(l.categoria || ""));
    const extra = d.lancamentos.filter((l) => l.tipo === "entrada" && /extra/i.test(l.categoria || "") && String(l.data).startsWith(st.ref.y + "-"));
    if (m.e) out.push({ t: `Você recebe em média ${R$(m.e)} por mês`, x: `Esse é o número para planejar. Conta fixa e parcela devem caber em, no máximo, 70% dele (${R$(m.e * 0.7)}), deixando o resto para dívida e reserva.` });
    if (fixas.length) out.push({ t: "Salário e vale: dinheiro com dia certo", x: "No dia em que cair, pague primeiro as contas fixas e a parcela da dívida da vez. O que sobra é o que dá para gastar no mês." });
    out.push({ t: extra.length ? `Renda extra em ${st.ref.y}: ${R$(soma(extra))}` : "Renda extra vai inteira para a dívida", x: "Toda renda extra (bico, hora extra, venda, 13º, restituição) deve ir inteira para a dívida mais cara ou para a reserva. Ela não entra no orçamento do mês, assim você sai das dívidas mais rápido." });
    return out;
  }
  function telaPlanilha() {
    const y = st.ref.y, doAno = D().lancamentos.filter((l) => String(l.data).startsWith(y + "-"));
    const grupos = (tipo) => {
      const g = new Map();
      doAno.filter((l) => l.tipo === tipo).forEach((l) => {
        const k = (l.descricao || "").trim().toLowerCase();
        if (!g.has(k)) g.set(k, { nome: l.descricao, cat: l.categoria, tipo, dias: {}, meses: Array.from({ length: 12 }, () => []) });
        const x = g.get(k), dia = Number(l.data.slice(8, 10)); x.meses[Number(l.data.slice(5, 7)) - 1].push(l); x.dias[dia] = (x.dias[dia] || 0) + 1;
      });
      return [...g.values()].map((x) => ({ ...x, vals: x.meses.map(soma), dia: Number(Object.entries(x.dias).sort((a, b) => b[1] - a[1])[0][0]) })).sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome));
    };
    const ents = grupos("entrada"), sais = grupos("saida");
    const totM = (gs) => Array.from({ length: 12 }, (_, m) => gs.reduce((a, g) => a + g.vals[m], 0));
    const tE = totM(ents), tS = totM(sais), soma12 = (v) => v.reduce((a, x) => a + x, 0);
    const mesHoje = y === new Date().getFullYear() ? new Date().getMonth() : -1;
    const cel = (g, m) => {
      const ls = g.meses[m], v = g.vals[m], cls = !ls.length ? "vazio" : ls.every((l) => l.pago) ? "ok" : ls.some(vencido) ? "mal" : "amb";
      return `<td class="num${m === mesHoje ? " hoje" : ""}"><button type="button" class="v ${cls}" data-celula="${esc(g.tipo)}|${esc(g.nome)}|${esc(g.cat || "")}|${m}|${g.dia}" title="${ls.length ? R$(v) + " · editar" : "Lançar"} ${esc(g.nome)} em ${MESES[m]}" aria-label="${ls.length ? "Editar" : "Lançar"} ${esc(g.nome)} em ${MESES[m]}">${ls.length ? K0(v) : ""}</button></td>`;
    };
    const linha = (g, sub) => `<tr class="fn-ano-item${sub ? " sub" : ""}"><th scope="row"><button type="button" class="nome" data-linha="${esc(g.tipo)}|${esc(g.nome)}" title="Editar ${esc(g.nome)} no ano todo">${esc(g.nome)}</button>${g.tipo === "saida" && g.dia ? `<small>vence dia ${g.dia}</small>` : sub ? "" : `<small>${esc(g.cat || "")}</small>`}</th>${g.vals.map((_, m) => cel(g, m)).join("")}<td class="num tot">${R$(soma12(g.vals))}</td></tr>`;
    const porCat = (gs) => { const mp = new Map(); gs.forEach((g) => { const k = g.cat || "Outros"; if (!mp.has(k)) mp.set(k, []); mp.get(k).push(g); }); return [...mp.entries()].map(([cat, itens]) => ({ cat, itens, vals: totM(itens) })).sort((a, b) => soma12(b.vals) - soma12(a.vals)); };
    const corpo = (gs, tipo) => porCat(gs).map((c) => {
      if (c.itens.length === 1) return linha(c.itens[0], false);
      const chave = tipo + "|" + c.cat, aberto = st.anoAbertos[chave] ?? c.itens.length <= 4;
      return `<tr class="fn-ano-grupo${aberto ? " aberto" : ""}"><th scope="row"><button type="button" data-grupo="${esc(chave)}" aria-expanded="${aberto}"><span class="seta">›</span><span class="nome">${esc(c.cat)}</span><small>${c.itens.length} itens</small></button></th>${c.vals.map((v, m) => `<td class="num${m === mesHoje ? " hoje" : ""}">${v ? K0(v) : ""}</td>`).join("")}<td class="num tot">${R$(soma12(c.vals))}</td></tr>`
        + (aberto ? c.itens.map((g) => linha(g, true)).join("") : "");
    }).join("");
    const totalLinha = (rot, v, cls) => `<tr class="fn-ano-tot ${cls}"><th scope="row">${rot}</th>${v.map((x, m) => `<td class="num${m === mesHoje ? " hoje" : ""}">${x ? K0(x) : "–"}</td>`).join("")}<td class="num tot">${R$(soma12(v))}</td></tr>`;
    const cab = (t) => `<tr class="fn-ano-cab"><th>${t}</th>${MES3.map((n, i) => `<th class="num${i === mesHoje ? " hoje" : ""}">${n}</th>`).join("")}<th class="num">Total</th></tr>`;
    const sobra = tE.map((x, i) => x - tS[i]);
    return `<div class="fn-va-topo"><button type="button" class="fn-btn" data-planilha-sair>‹ Voltar para a visão por mês</button><div class="fn-mes"><button type="button" data-mes="-12" aria-label="Ano anterior">‹</button><span>${y}</span><button type="button" data-mes="12" aria-label="Próximo ano">›</button></div></div>
      <div class="fn-kpis">
        ${kpi(`Renda em ${y}`, R$(soma12(tE)), "entra", `média ${R$(soma12(tE) / 12)} por mês`, "bom")}
        ${kpi(`Despesas em ${y}`, R$(soma12(tS)), "sai", `média ${R$(soma12(tS) / 12)} por mês`)}
        ${kpi("Sobra no ano", R$(soma12(sobra)), "carteira", "renda menos despesas", soma12(sobra) >= 0 ? "destaque" : "ruim")}
        ${kpi("Meses no vermelho", String(sobra.filter((x) => x < 0).length), "queda", sobra.some((x) => x < 0) ? sobra.map((x, i) => (x < 0 ? MES3[i] : "")).filter(Boolean).join(", ") : "nenhum")}
      </div>
      <div class="fn-ano-abas" role="tablist">
        <button type="button" role="tab" data-ano-aba="saida" aria-selected="${st.anoAba === "saida"}" class="${st.anoAba === "saida" ? "on" : ""}">${ICONE.sai}Despesas <b>${R$(soma12(tS))}</b></button>
        <button type="button" role="tab" data-ano-aba="entrada" aria-selected="${st.anoAba === "entrada"}" class="${st.anoAba === "entrada" ? "on" : ""}">${ICONE.entra}Entradas <b>${R$(soma12(tE))}</b></button>
      </div>
      <div class="fn-caixa fn-ano-caixa"><div class="fn-cab"><div><h3>${st.anoAba === "entrada" ? "Entradas" : "Despesas"} de ${y}</h3><p class="sub">Toque num valor para editar ou num espaço vazio para lançar naquele mês. O que você muda aqui já aparece no Dashboard, em Entradas, Saídas e Cartões. Verde = ${st.anoAba === "entrada" ? "recebido" : "pago"}, amarelo = ${st.anoAba === "entrada" ? "a receber" : "a pagar"}, vermelho = vencido.</p></div>
          <button class="fn-btn principal" type="button" data-linha-fixa>${ICONE.mais}${st.anoAba === "entrada" ? "Nova entrada" : "Nova despesa"} no ano</button></div>
        <div class="fn-rolar"><table class="fn-ano">
          ${st.anoAba === "entrada"
            ? `<tbody>${cab("Tipo de renda")}${corpo(ents, "entrada") || `<tr><td colspan="14" class="fn-vazio">Nenhuma entrada em ${y}.</td></tr>`}${totalLinha("Renda total", tE, "entra")}</tbody>`
            : `<tbody>${cab("Despesas")}${corpo(sais, "saida") || `<tr><td colspan="14" class="fn-vazio">Nenhuma despesa em ${y}.</td></tr>`}${totalLinha("Despesas totais", tS, "sai")}</tbody>`}
          <tbody>${totalLinha("Sobrou no mês", sobra, "sobra")}</tbody>
        </table></div></div>`;
  }
  const K2 = (v) => (ocultar ? "•••" : (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  // na tabela do ano: sem centavos para caber e ficar limpo (o valor exato aparece ao passar o dedo/mouse e no total)
  const K0 = (v) => (ocultar ? "•••" : Math.round(Number(v) || 0).toLocaleString("pt-BR"));
  // ---------- etiquetas, anexos e a janela de entrada (nov/2026) ----------
  const ETQ_PADRAO = ["Salário", "UGC", "PUBLI", "PUBLI COMERCIAL", "MARKETPLACE", "Outros"];
  const COM_INFLUENCER = ["PUBLI COMERCIAL", "MARKETPLACE"]; // etiquetas que pedem o nome da influencer
  const etiquetasEntrada = (atual) => [...new Set([...ETQ_PADRAO, ...(D().etiquetas || []), ...(atual ? [atual] : [])])];
  const nomeArquivo = (n) => String(n || "arquivo").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-80);
  async function enviarAnexo(arquivo, lid, tipo) {
    if (arquivo.size > 15 * 1024 * 1024) throw new Error("O arquivo passa de 15 MB.");
    const path = `${st.atual}/${lid}/${tipo}-${Date.now()}-${nomeArquivo(arquivo.name)}`;
    const { error } = await banco.storage.from("financeiro").upload(path, arquivo, { upsert: false, contentType: arquivo.type || undefined });
    if (error) throw new Error("Não consegui anexar: " + error.message);
    return { path, nome: arquivo.name, em: hojeIso() };
  }
  async function abrirAnexo(a) {
    const janela = window.open("", "_blank");
    const { data, error } = await banco.storage.from("financeiro").createSignedUrl(a.path, 300);
    if (error || !data) { if (janela) janela.close(); toast("Não consegui abrir o anexo.", true); return; }
    if (janela) janela.location = data.signedUrl; else location.href = data.signedUrl;
  }
  const tirarArquivos = (paths) => { const p = paths.filter(Boolean); if (p.length) banco.storage.from("financeiro").remove(p).catch(() => {}); };
  async function novaEtiqueta() {
    const nome = String((await painelDialogo.texto("Nome da nova etiqueta", "")) || "").trim().slice(0, 30);
    if (!nome) return "";
    const d = D(); d.etiquetas = [...new Set([...(d.etiquetas || []), nome])];
    return nome;
  }
  // datas de uma entrada: prevista e de pagamento (as antigas só tinham "data" e "pago")
  const datasDe = (l) => ({ prevista: l.dataPrevista != null ? l.dataPrevista : (l.pago ? "" : l.data), pagamento: l.dataPagamento != null ? l.dataPagamento : (l.pago ? l.data : "") });
  function editarEntrada(l, pre) {
    const novo = !l;
    l = l || { id: uid(), tipo: "entrada", data: hojeIso(), dataPrevista: hojeIso(), dataPagamento: "", pago: false, categoria: "Salário", ...(pre || {}) };
    const daPJ = l.origem === "pj", dt = datasDe(l);
    let nf = l.nf || null, comp = l.comprovante || null, tac = l.tac || null;
    const enviados = [], trocados = [];
    let dlg = $("#fn-janela"); if (!dlg) { dlg = document.createElement("dialog"); dlg.id = "fn-janela"; dlg.className = "fn-janela"; document.body.appendChild(dlg); }
    const ops = (atual) => etiquetasEntrada(atual).map((o) => `<option ${o === atual ? "selected" : ""}>${esc(o)}</option>`).join("") + `<option value="__nova">+ Criar etiqueta</option>`;
    const anexoHtml = (qual, a) => `<div class="fn-anexo" data-anexo="${qual}">${a ? `<button type="button" class="fn-anexo-ver" data-ver>${ICONE.clipe}<span>${esc(a.nome)}</span></button><button type="button" class="fn-btn pequeno" data-tirar>Tirar</button>` : `<span class="fn-anexo-vazio">Nenhum arquivo</span>`}<label class="fn-btn pequeno">${ICONE.clipe}${a ? "Trocar" : "Anexar"}<input type="file" accept="application/pdf,image/*,.xml" hidden></label></div>`;
    dlg.innerHTML = `<form method="dialog" novalidate class="fn-form-entrada"><h2>${novo ? "Nova entrada" : "Editar entrada"}</h2>
      ${daPJ ? `<p class="fn-aviso-pj">${ICONE.elo}<span>Vem do painel CNPJ${l.marca ? " (" + esc(l.marca) + ")" : ""}. Valor e datas mudam lá e chegam aqui sozinhos. Aqui você completa etiqueta, NF, comprovante e observação.</span></p>` : ""}
      <div class="fn-campo"><label for="e-descricao">Descrição</label><input class="fn-entrada" id="e-descricao" value="${esc(l.descricao || "")}" ${daPJ ? "disabled" : ""} placeholder="Ex.: Salário, Job da marca X"></div>
      <div class="duplo"><div class="fn-campo"><label for="e-valor">Valor (R$)</label><input class="fn-entrada" id="e-valor" inputmode="decimal" value="${l.valor != null && l.valor !== "" ? String(l.valor).replace(".", ",") : ""}" ${daPJ ? "disabled" : ""}></div>
        <div class="fn-campo"><label for="e-etq">Etiqueta</label><select class="fn-entrada" id="e-etq">${ops(l.categoria)}</select></div></div>
      <div class="fn-campo" id="e-infl-campo" ${COM_INFLUENCER.includes(l.categoria) ? "" : "hidden"}><label for="e-infl">Nome da influencer</label><input class="fn-entrada" id="e-infl" value="${esc(l.influencer || "")}" placeholder="Quem fez a publi"></div>
      <div id="e-mkt-campos" ${l.categoria === "MARKETPLACE" ? "" : "hidden"}>
        <div class="fn-campo"><label for="e-mkt">Loja (marketplace)</label><input class="fn-entrada" id="e-mkt" value="${esc(l.marketplace || "")}" placeholder="Ex.: Shopee, TikTok Shop, Mercado Livre"></div>
        <div class="fn-campo"><label>TAC</label><div data-lugar="tac">${anexoHtml("tac", tac)}</div></div>
      </div>
      <div class="duplo"><div class="fn-campo"><label for="e-prev">Data prevista de pagamento</label><input class="fn-entrada" type="date" id="e-prev" value="${esc(dt.prevista || "")}" ${daPJ ? "disabled" : ""}></div>
        <div class="fn-campo"><label for="e-pag">Data de pagamento</label><input class="fn-entrada" type="date" id="e-pag" value="${esc(dt.pagamento || "")}" ${daPJ ? "disabled" : ""}></div></div>
      ${daPJ ? "" : `<p class="fn-dica">A entrada fica no mês em que o dinheiro caiu (data de pagamento) e já conta como recebida. Sem data de pagamento, ela fica no mês previsto, como a receber.</p>`}
      <div class="fn-campo"><label>Tem NF?</label><div class="fn-seg" role="radiogroup" aria-label="Tem NF?"><button type="button" data-nf="sim" class="${l.temNF ? "on" : ""}" aria-checked="${!!l.temNF}" role="radio">Sim</button><button type="button" data-nf="nao" class="${l.temNF ? "" : "on"}" aria-checked="${!l.temNF}" role="radio">Não</button></div></div>
      <div class="fn-campo" id="e-nf-campo" ${l.temNF ? "" : "hidden"}><label>Nota fiscal</label><div data-lugar="nf">${anexoHtml("nf", nf)}</div></div>
      <div class="fn-campo"><label>Comprovante de pagamento</label><div data-lugar="comp">${anexoHtml("comp", comp)}</div></div>
      <div class="fn-campo"><label for="e-obs">Observação</label><input class="fn-entrada" id="e-obs" value="${esc(l.obs || "")}"></div>
      <p class="fn-erro" id="e-erro"></p>
      <div class="rodape">${!novo && !daPJ ? `<button class="fn-btn perigo" type="button" id="e-apagar">${ICONE.lixo}Apagar</button><span style="flex:1"></span>` : ""}<button class="fn-btn" type="button" id="e-cancelar">Cancelar</button><button class="fn-btn principal" type="submit">Salvar</button></div></form>`;
    let temNF = !!l.temNF;
    const erro = (t) => { $("#e-erro", dlg).textContent = t; };
    const ligarAnexo = (qual) => {
      const pega = () => (qual === "nf" ? nf : qual === "tac" ? tac : comp), poe = (v) => { if (qual === "nf") nf = v; else if (qual === "tac") tac = v; else comp = v; };
      const lugar = $(`[data-lugar="${qual}"]`, dlg), a = pega();
      lugar.innerHTML = anexoHtml(qual, a);
      const ver = $("[data-ver]", lugar); if (ver) ver.addEventListener("click", () => abrirAnexo(pega()));
      const tirar = $("[data-tirar]", lugar); if (tirar) tirar.addEventListener("click", () => { const at = pega(); if (at) trocados.push(at.path); poe(null); ligarAnexo(qual); });
      $("input[type=file]", lugar).addEventListener("change", async (e) => {
        const arq = e.target.files[0]; if (!arq) return;
        erro(""); lugar.querySelector(".fn-anexo").classList.add("enviando");
        try { const novoA = await enviarAnexo(arq, l.id, qual); enviados.push(novoA.path); const at = pega(); if (at) trocados.push(at.path); poe(novoA); }
        catch (er) { erro(er.message); }
        ligarAnexo(qual);
      });
    };
    ligarAnexo("nf"); ligarAnexo("comp"); ligarAnexo("tac");
    // MARKETPLACE: a descrição se monta sozinha ("Comissão Shopee · Mariana · Out/26") enquanto ela não escrever outra
    let descAuto = "";
    const sugerir = () => {
      const ed = $("#e-descricao", dlg); if (!ed || ed.disabled || $("#e-etq", dlg).value !== "MARKETPLACE") return;
      const quando = $("#e-pag", dlg).value || $("#e-prev", dlg).value, mes = quando ? `${MES3[Number(quando.slice(5, 7)) - 1]}/${quando.slice(2, 4)}` : "";
      const s = ["Comissão " + ($("#e-mkt", dlg).value.trim() || "(loja)"), $("#e-infl", dlg).value.trim(), mes].filter(Boolean).join(" · ");
      if (!ed.value.trim() || ed.value === descAuto) { ed.value = s; descAuto = s; }
      ed.placeholder = s;
    };
    ["#e-mkt", "#e-infl", "#e-pag", "#e-prev"].forEach((sel) => { const el = $(sel, dlg); if (el) el.addEventListener("input", sugerir); });
    $("#e-etq", dlg).addEventListener("change", async (e) => {
      if (e.target.value === "__nova") { const n = await novaEtiqueta(); e.target.innerHTML = ops(n || l.categoria); }
      $("#e-infl-campo", dlg).hidden = !COM_INFLUENCER.includes(e.target.value);
      $("#e-mkt-campos", dlg).hidden = e.target.value !== "MARKETPLACE";
      sugerir();
    });
    $$("[data-nf]", dlg).forEach((b) => b.addEventListener("click", () => { temNF = b.dataset.nf === "sim"; $$("[data-nf]", dlg).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", String(x === b)); }); $("#e-nf-campo", dlg).hidden = !temNF; }));
    const fechar = () => { tirarArquivos(enviados); dlg.close(); };
    $("#e-cancelar", dlg).addEventListener("click", fechar);
    dlg.oncancel = () => tirarArquivos(enviados);
    const ap = $("#e-apagar", dlg);
    if (ap) ap.addEventListener("click", async () => { if (!(await painelDialogo.confirmar("Apagar esta entrada? Os anexos dela também saem.", { ok: "Apagar", perigo: true }))) return; tirarArquivos([...enviados, ...trocados, nf && nf.path, comp && comp.path, tac && tac.path]); D().lancamentos = D().lancamentos.filter((y) => y.id !== l.id); dlg.close(); salvar(); pintar(); });
    $("form", dlg).addEventListener("submit", (e) => {
      e.preventDefault();
      const etq = $("#e-etq", dlg).value === "__nova" ? l.categoria : $("#e-etq", dlg).value;
      const x = { ...l, categoria: etq, influencer: COM_INFLUENCER.includes(etq) ? $("#e-infl", dlg).value.trim() : (l.influencer || ""), marketplace: etq === "MARKETPLACE" ? $("#e-mkt", dlg).value.trim() : (l.marketplace || ""), tac, temNF, nf: temNF ? nf : null, comprovante: comp, obs: $("#e-obs", dlg).value.trim() };
      if (!temNF && nf) trocados.push(nf.path);
      if (daPJ) x.etiquetaManual = true;
      else {
        const desc = $("#e-descricao", dlg).value.trim(), valor = numOuNada($("#e-valor", dlg).value), prev = $("#e-prev", dlg).value, pag = $("#e-pag", dlg).value;
        if (!desc) { erro("Preencha a descrição."); return; }
        if (valor == null) { erro("Preencha o valor."); return; }
        if (!prev && !pag) { erro("Coloque a data prevista ou a data de pagamento."); return; }
        Object.assign(x, { descricao: desc, valor, dataPrevista: prev, dataPagamento: pag, data: pag || prev, pago: !!pag, atrasado: false });
      }
      const lista = D().lancamentos, i = lista.findIndex((y) => y.id === x.id); if (i >= 0) lista[i] = x; else lista.push(x);
      tirarArquivos(trocados.filter((p) => p !== (x.nf && x.nf.path) && p !== (x.comprovante && x.comprovante.path) && p !== (x.tac && x.tac.path)));
      dlg.close(); salvar(); pintar(); toast(novo ? "Entrada lançada." : "Salvo.");
    });
    dlg.showModal();
  }

  // ---------- receitas do painel CNPJ entram aqui sozinhas (só no perfil da Mari) ----------
  // Cada receita do painel (app_state.transacoes, tipo receita) vira a entrada "pj-<id>". Se já existir uma entrada
  // digitada à mão com o mesmo valor e data próxima (até 45 dias), ela é ligada em vez de duplicar.
  // Etiqueta: job Publi = PUBLI, job UGC = UGC; se ela trocar aqui, a escolha dela fica.
  // NF, comprovante, influencer e observação são só daqui e nunca são apagados pela sincronização.
  async function sincronizarPJ() {
    if (st.atual !== "mari" || !st.dona || !st.sessao) return false;
    let est = null;
    try { const { data } = await banco.from("app_state").select("data").eq("user_id", st.sessao.user.id).maybeSingle(); est = data && data.data; } catch (e) { return false; }
    if (!est) return false;
    const d = D(), jobs = new Map((est.jobs || []).map((j) => [String(j.id), j]));
    const tx = (est.transacoes || []).filter((t) => t.tipo === "receita" && t.status !== "Cancelado" && Number(t.valor) > 0);
    const assinatura = (l) => JSON.stringify([l.descricao, l.valor, l.dataPrevista, l.dataPagamento, l.data, l.pago, l.categoria, l.marca, l.pjRemovido]);
    let mudou = false; const vistos = new Set();
    const dias = (a, b) => Math.abs((new Date(a + "T00:00:00") - new Date(b + "T00:00:00")) / 86400000);
    for (const t of tx) {
      const pjId = String(t.id), j = t.jobId ? jobs.get(String(t.jobId)) : null, pg = (j && j.pagamento) || {}, conf = t.status === "Confirmado";
      const cat = String((j && j.categoria) || t.categoria || "");
      const etq = /publi/i.test(cat) ? "PUBLI" : /ugc/i.test(cat) ? "UGC" : "Outros";
      const moeda = t.moeda && t.moeda !== "BRL" ? t.moeda : "";
      const dataPagamento = conf ? (pg.dataPagamento || t.data || "") : "";
      const dataPrevista = pg.dataPrevista || (j && j.dataPagamento) || t.data || "";
      const base = { descricao: (t.descricao || (j && j.marca) || "Receita CNPJ") + (moeda ? ` (${moeda})` : ""), valor: Number(t.valor) || 0, dataPrevista, dataPagamento, data: dataPagamento || dataPrevista || hojeIso(), pago: conf, atrasado: false, origem: "pj", pjId, marca: (j && j.marca) || "", pjRemovido: false };
      let atual = d.lancamentos.find((l) => l.origem === "pj" && l.pjId === pjId);
      if (!atual) {
        // já lançada à mão? liga em vez de criar outra
        atual = d.lancamentos.find((l) => l.tipo === "entrada" && l.origem !== "pj" && !/sal[aá]rio|vale/i.test(l.categoria || "") && Math.abs((Number(l.valor) || 0) - base.valor) < 0.01 && l.data && base.data && dias(l.data, base.data) <= 45);
        if (atual) { atual.etiquetaManual = true; if (/^publicidade$/i.test(atual.categoria || "")) atual.categoria = "PUBLI"; }
      }
      vistos.add(pjId);
      if (!atual) { d.lancamentos.push({ id: "pj-" + pjId, tipo: "entrada", categoria: etq, obs: "", ...base }); mudou = true; continue; }
      const antes = assinatura(atual);
      Object.assign(atual, base, { categoria: atual.etiquetaManual ? atual.categoria : etq });
      if (assinatura(atual) !== antes) mudou = true;
    }
    // receita apagada no painel: some daqui, a não ser que tenha anexo (aí fica marcada)
    const n0 = d.lancamentos.length;
    d.lancamentos = d.lancamentos.filter((l) => !(l.origem === "pj" && !vistos.has(l.pjId) && !l.nf && !l.comprovante && !l.tac));
    d.lancamentos.filter((l) => l.origem === "pj" && !vistos.has(l.pjId) && !l.pjRemovido).forEach((l) => { l.pjRemovido = true; mudou = true; });
    if (d.lancamentos.length !== n0) mudou = true;
    if (mudou) await salvarAgora("mari");
    return mudou;
  }
  // etiquetas novas (nov/2026): "Publicidade" vira PUBLI; as outras que ela já usava viram etiquetas dela
  function migrarEtiquetas() {
    const d = D(); if (d.etiquetasV2) return;
    d.lancamentos.filter((l) => l.tipo === "entrada" && /^publicidade$/i.test(l.categoria || "")).forEach((l) => { l.categoria = "PUBLI"; });
    const antigas = [...new Set(d.lancamentos.filter((l) => l.tipo === "entrada" && l.categoria && !ETQ_PADRAO.includes(l.categoria)).map((l) => l.categoria))];
    d.etiquetas = [...new Set([...(d.etiquetas || []), ...antigas])];
    d.etiquetasV2 = true; salvar();
  }

  // ---------- Visão anual (nov/2026, a partir da referência da Mari): meses no topo, o mês escolhido embaixo ----------
  function mudarSituacao(l, sit) {
    const ent = l.tipo === "entrada";
    if (sit === "pago") { l.pago = true; l.atrasado = false; if (ent) { const dt = datasDe(l); l.dataPrevista = dt.prevista || l.data; l.dataPagamento = dt.pagamento || hojeIso(); l.data = l.dataPagamento; } }
    else { l.pago = false; l.atrasado = sit === "atraso"; if (ent) { const dt = datasDe(l); l.dataPrevista = dt.prevista || dt.pagamento || l.data; l.dataPagamento = ""; l.data = l.dataPrevista; } }
  }
  function situacaoMes(ls) {
    if (!ls.length) return "vazio";
    if (ls.every((l) => l.pago)) return "ok";
    return ls.some(vencidoL) ? "mal" : "amb";
  }
  // vencido vale para saída e entrada (entrada: passou da data prevista sem receber)
  const vencidoL = (l) => !l.pago && (l.atrasado || (l.data && l.data < hojeIso()));
  function telaAnual() {
    if (st.anoModo === "planilha") return telaPlanilha();
    const y = st.ref.y, tipo = st.anoAba === "entrada" ? "entrada" : "saida", ent = tipo === "entrada";
    if (st.anoMes == null) st.anoMes = y === new Date().getFullYear() ? new Date().getMonth() : 0;
    const m = st.anoMes, mesHoje = y === new Date().getFullYear() ? new Date().getMonth() : -1;
    const doMesT = (mm) => doMes(y, mm).filter((l) => l.tipo === tipo);
    const todos = doMesT(m), q = (st.anoBusca || "").trim().toLowerCase();
    const sit = (l) => l.pago ? "pago" : vencidoL(l) ? "atraso" : "pendente";
    const lista = todos.filter((l) => (!q || [l.descricao, l.categoria, l.obs, l.influencer, l.marketplace].join(" ").toLowerCase().includes(q)) && (!st.anoStatus || sit(l) === st.anoStatus))
      .sort((a, b) => String(a.data).localeCompare(String(b.data)) || String(a.descricao).localeCompare(String(b.descricao)));
    const total = soma(todos), pago = soma(todos.filter((l) => l.pago)), atraso = soma(todos.filter((l) => !l.pago && vencidoL(l))), pend = total - pago - atraso;
    const s = situacaoMes(todos), rotSit = { ok: "Concluído", amb: "Em aberto", mal: "Com atraso", vazio: "Sem lançamentos" }[s];
    const dataCol = (l) => { const dt = datasDe(l); return ent ? `<td>${dt.prevista ? dataBR(dt.prevista) : "–"}</td><td>${dt.pagamento ? dataBR(dt.pagamento) : "–"}</td>` : `<td>${dataBR(l.data)}</td>`; };
    const anexos = (l) => (l.nf || l.comprovante || l.tac) ? `<span class="fn-clipes">${l.nf ? `<button type="button" class="fn-clipe" data-anexo-ver="${esc(l.id)}|nf" title="Nota fiscal: ${esc(l.nf.nome)}">NF</button>` : ""}${l.comprovante ? `<button type="button" class="fn-clipe" data-anexo-ver="${esc(l.id)}|comprovante" title="Comprovante: ${esc(l.comprovante.nome)}">${ICONE.clipe}</button>` : ""}${l.tac ? `<button type="button" class="fn-clipe" data-anexo-ver="${esc(l.id)}|tac" title="TAC: ${esc(l.tac.nome)}">TAC</button>` : ""}</span>` : (ent && l.temNF ? `<span class="fn-clipe falta" title="Marcada com NF, falta anexar">NF</span>` : "");
    const linhas = lista.map((l) => `<tr>
        <td><div class="fn-va-nome"><span class="fn-va-ic ${ent ? "entra" : "sai"}">${ent ? ICONE.entra : ICONE.doc}</span><div><b>${esc(l.descricao || "Sem nome")}</b>${l.origem === "pj" ? `<small class="fn-pj">${ICONE.elo}CNPJ${l.pjRemovido ? " (apagado lá)" : ""}</small>` : l.auto ? `<small>soma das compras</small>` : ""}${l.influencer || l.marketplace ? `<small>${esc([l.influencer, l.marketplace].filter(Boolean).join(" · "))}</small>` : ""}</div></div></td>
        <td class="num"><b>${R$(l.valor)}</b></td>
        ${dataCol(l)}
        <td><span class="fn-tag">${esc(l.categoria || "Outros")}</span></td>
        ${ent ? `<td>${anexos(l)}</td>` : ""}
        <td><select class="fn-va-status ${sit(l)}" data-status-l="${esc(l.id)}" aria-label="Situação" ${l.origem === "pj" ? "disabled" : ""}>
          <option value="pago" ${sit(l) === "pago" ? "selected" : ""}>${ent ? "Recebido" : "Pago"}</option><option value="pendente" ${sit(l) === "pendente" ? "selected" : ""}>Pendente</option><option value="atraso" ${sit(l) === "atraso" ? "selected" : ""}>Em atraso</option></select></td>
        <td class="fn-va-obs">${esc(l.obs || "")}</td>
        <td class="num fn-va-acoes">${(() => { const c = !ent && D().cartoes.find((k) => eDoCartao(l, k)); return c ? `<button class="fn-icone" type="button" data-compras-fat="${esc(c.id)}|${esc(l.data.slice(0, 7))}" aria-label="Compras desta fatura" title="Compras desta fatura">${ICONE.cartoes}</button>` : ""; })()}<button class="fn-icone" type="button" data-editar-l="${esc(l.id)}" aria-label="Editar">${ICONE.lapis}</button>${l.origem === "pj" || l.auto ? "" : `<button class="fn-icone" type="button" data-duplicar="${esc(l.id)}" aria-label="Copiar para o mês seguinte" title="Copiar para o mês seguinte">${ICONE.copiar}</button><button class="fn-icone" type="button" data-apagar-l="${esc(l.id)}" aria-label="Apagar">${ICONE.lixo}</button>`}</td>
      </tr>`).join("");
    return `<div class="fn-va-topo">
        <div class="fn-seg" role="tablist"><button type="button" data-ano-aba="saida" class="${ent ? "" : "on"}">Saídas</button><button type="button" data-ano-aba="entrada" class="${ent ? "on" : ""}">Entradas</button></div>
        <div class="fn-mes"><button type="button" data-mes="-12" aria-label="Ano anterior">‹</button><span>${y}</span><button type="button" data-mes="12" aria-label="Próximo ano">›</button></div>
        <input class="fn-entrada fn-va-busca" type="search" id="fn-va-busca" placeholder="Buscar ${ent ? "entrada" : "saída"}" value="${esc(st.anoBusca || "")}">
        <select class="fn-entrada fn-va-filtro" id="fn-va-status" aria-label="Situação"><option value="">Todos os status</option><option value="pago" ${st.anoStatus === "pago" ? "selected" : ""}>${ent ? "Recebidos" : "Pagos"}</option><option value="pendente" ${st.anoStatus === "pendente" ? "selected" : ""}>Pendentes</option><option value="atraso" ${st.anoStatus === "atraso" ? "selected" : ""}>Em atraso</option></select>
        <button class="fn-btn principal" type="button" data-novo-ano>${ICONE.mais}${ent ? "Nova entrada" : "Nova saída"}</button>
      </div>
      <div class="fn-va-meses" role="tablist" aria-label="Meses de ${y}">${MES3.map((n, i) => { const sm = situacaoMes(doMesT(i)); return `<button type="button" role="tab" data-ano-mes="${i}" class="${i === m ? "on" : ""}" aria-selected="${i === m}"><b>${n.toUpperCase()}</b>${i === mesHoje ? "<small>MÊS ATUAL</small>" : ""}<i class="pt ${sm}" aria-label="${{ ok: "tudo " + (ent ? "recebido" : "pago"), amb: "tem pendente", mal: "tem atraso", vazio: "sem lançamentos" }[sm]}"></i></button>`; }).join("")}</div>
      <div class="fn-caixa fn-va-caixa">
        <div class="fn-va-cab"><h3>${MESES[m]} ${y}</h3><span class="fn-va-sit ${s}">${rotSit}</span><span style="flex:1"></span><button type="button" class="fn-link" data-planilha>Ver o ano em planilha</button></div>
        <div class="fn-va-kpis">
          <div class="fn-va-kpi"><span class="ic">${ICONE.doc}</span><div><small>Total previsto</small><b>${R$(total)}</b></div></div>
          <div class="fn-va-kpi ok"><span class="ic">${ICONE.check}</span><div><small>${ent ? "Recebido" : "Pago"}</small><b>${R$(pago)}</b></div></div>
          <div class="fn-va-kpi amb"><span class="ic">${ICONE.calendario}</span><div><small>Pendente</small><b>${R$(pend)}</b></div></div>
          <div class="fn-va-kpi mal"><span class="ic">${ICONE.bandeira}</span><div><small>Em atraso</small><b>${R$(atraso)}</b></div></div>
        </div>
        ${lista.length ? `<div class="fn-rolar"><table class="fn-va-tabela"><thead><tr><th>${ent ? "Entrada" : "Saída"}</th><th class="num">Valor</th>${ent ? "<th>Previsto</th><th>Pago em</th>" : "<th>Vencimento</th>"}<th>Etiqueta</th>${ent ? "<th>NF</th>" : ""}<th>Status</th><th>Observação</th><th class="num">Ações</th></tr></thead><tbody>${linhas}</tbody></table></div>`
          : `<p class="fn-vazio">${todos.length ? "Nada com esse filtro." : `Nenhuma ${ent ? "entrada" : "saída"} em ${MESES[m].toLowerCase()}.`}</p>`}
      </div>`;
  }

  function telaAcesso() {
    return `<div class="fn-caixa" style="max-width:640px"><h3>Quem pode entrar</h3><p class="sub">A Mari sempre entra. Coloque o e-mail do Eduardo para liberar: ele entra em marianabonetto.com.br/financeiro, toca em "Primeiro acesso" e cria a senha dele.</p>
      <div class="fn-lista" id="fn-membros"><p class="fn-vazio">Carregando…</p></div>
      <form id="fn-add-membro" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><input class="fn-entrada" id="fn-membro-email" type="email" placeholder="e-mail do Eduardo" style="flex:1;min-width:200px" required><button class="fn-btn principal" type="submit">${ICONE.mais}Liberar acesso</button></form>
      <p style="font-size:11.5px;color:var(--suave);margin:12px 0 0">Quem é liberado vê e lança nas finanças da Mari e do Eduardo. Ninguém além de você entra no painel de trabalho (/admin).</p></div>`;
  }
  async function pintarMembros() {
    const box = $("#fn-membros"); if (!box) return;
    const { data, error } = await banco.from("financeiro_membros").select("email,nome").order("criado_em");
    if (error) { box.innerHTML = `<p class="fn-vazio">Não consegui carregar: ${esc(error.message)}</p>`; return; }
    box.innerHTML = tingir(`<div class="fn-item"><span class="fn-av">M</span><div class="x"><b>${esc(window.BANCO_EMAIL_DONA)}</b><small>Mari (sempre tem acesso)</small></div></div>` + (data || []).map((m) => `<div class="fn-item"><span class="fn-av" style="background:#8a6650">${esc((m.nome || m.email)[0].toUpperCase())}</span><div class="x"><b>${esc(m.email)}</b><small>${esc(m.nome || "")}</small></div><button class="fn-icone" type="button" data-tirar-membro="${esc(m.email)}" aria-label="Tirar acesso">${ICONE.lixo}</button></div>`).join(""));
    $$("[data-tirar-membro]", box).forEach((b) => b.addEventListener("click", async () => { if (!(await painelDialogo.confirmar(`Tirar o acesso de ${b.dataset.tirarMembro}?`, { ok: "Tirar acesso", perigo: true }))) return; await banco.from("financeiro_membros").delete().eq("email", b.dataset.tirarMembro); pintarMembros(); }));
  }

  // ---------- formulários ----------
  function formulario(titulo, campos, valores, aoSalvar, aoApagar) {
    let dlg = $("#fn-janela"); if (!dlg) { dlg = document.createElement("dialog"); dlg.id = "fn-janela"; dlg.className = "fn-janela"; document.body.appendChild(dlg); }
    const campo = (c) => {
      const v = valores[c.k] ?? (c.padrao ?? "");
      if (c.tipo === "select") { const ops = c.opcoes.map((o) => (Array.isArray(o) ? o : [o, o])); if (v !== "" && !ops.some((o) => String(o[0]) === String(v))) ops.unshift([v, v]); return `<div class="fn-campo" data-k="${c.k}"><label for="f-${c.k}">${c.rotulo}</label><select class="fn-entrada" id="f-${c.k}">${ops.map(([o, t]) => `<option value="${esc(o)}" ${String(o) === String(v) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div>`; }
      if (c.tipo === "pilulas") { const ops = c.opcoes.includes(v) || !v ? c.opcoes : [v, ...c.opcoes];
        return `<div class="fn-campo" data-k="${c.k}"><label>${c.rotulo} <small class="fn-auto-aviso" id="f-${c.k}-aviso" hidden>escolhida sozinha</small></label><input type="hidden" id="f-${c.k}" value="${esc(v)}"><div class="fn-pilulas" role="group" aria-label="${esc(c.rotulo)}">${ops.map((o) => `<button type="button" class="fn-pilula${o === v ? " on" : ""}" data-pilula="${c.k}" data-v="${esc(o)}" aria-pressed="${o === v}">${esc(o)}</button>`).join("")}</div></div>`; }
      if (c.tipo === "comprovante") return `<div class="fn-campo fn-print" data-k="${c.k}"><label class="fn-print-caixa">${ICONE.clipe}<span><b>Subir comprovante ou print</b><small id="f-${c.k}-msg">Foto ou print: eu leio e preencho para você. PDF fica só anexado.</small></span><input type="file" id="f-${c.k}" accept="image/*,application/pdf" hidden></label></div>`;
      if (c.tipo === "chk") return `<label class="fn-chk" data-k="${c.k}"><input type="checkbox" id="f-${c.k}" ${v ? "checked" : ""}> ${c.rotulo}</label>`;
      return `<div class="fn-campo" data-k="${c.k}"><label for="f-${c.k}">${c.rotulo}</label><input class="fn-entrada" id="f-${c.k}" ${c.tipo === "data" ? 'type="date"' : c.tipo === "num" ? 'inputmode="decimal"' : 'type="text"'} value="${esc(c.tipo === "num" && v !== "" && v != null ? String(v).replace(".", ",") : v)}" ${c.obrigatorio ? "required" : ""}></div>`;
    };
    const linhas = []; for (let i = 0; i < campos.length; i++) { const c = campos[i]; if (c.meia && campos[i + 1] && campos[i + 1].meia) { linhas.push(`<div class="duplo">${campo(c)}${campo(campos[i + 1])}</div>`); i++; } else linhas.push(campo(c)); }
    dlg.innerHTML = `<form method="dialog" novalidate><h2>${esc(titulo)}</h2>${linhas.join("")}<p class="fn-erro" id="f-erro"></p><div class="rodape">${aoApagar ? `<button class="fn-btn perigo" type="button" id="f-apagar">${ICONE.lixo}Apagar</button><span style="flex:1"></span>` : ""}<button class="fn-btn" type="button" id="f-cancelar">Cancelar</button><button class="fn-btn principal" type="submit">Salvar</button></div></form>`;
    $("#f-cancelar", dlg).addEventListener("click", () => dlg.close());
    // campos que só aparecem em certos casos (ex.: cartão e parcelas só no crédito) e tipo automático pela descrição
    const ler = () => { const o = {}; campos.forEach((c) => { const el = $("#f-" + c.k, dlg); if (el) o[c.k] = c.tipo === "chk" ? el.checked : el.value; }); return o; };
    const visivel = (c, o) => !c.mostrar || c.mostrar(o);
    const atualizar = () => { const o = ler(); campos.forEach((c) => { const w = $(`[data-k="${c.k}"]`, dlg); if (w) w.style.display = visivel(c, o) ? "" : "none"; }); };
    // etiquetas em pílula: clicar marca; a marcada fica na cor principal
    const marcarPilula = (k, v, aviso) => { const h = $("#f-" + k, dlg); if (!h) return false; const b = $$(`[data-pilula="${k}"]`, dlg).find((x) => x.dataset.v === v); if (!b) return false;
      h.value = v; $$(`[data-pilula="${k}"]`, dlg).forEach((x) => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); });
      const av = $(`#f-${k}-aviso`, dlg); if (av) { av.hidden = !aviso; if (aviso) av.textContent = aviso; } return true; };
    const cAuto = campos.find((c) => c.auto), dEl = $("#f-descricao", dlg);
    let mexeu = !!(cAuto && valores[cAuto.k] && valores[cAuto.k] !== "Outros");
    $$("[data-pilula]", dlg).forEach((b) => b.addEventListener("click", () => { marcarPilula(b.dataset.pilula, b.dataset.v, ""); if (cAuto && b.dataset.pilula === cAuto.k) mexeu = true; atualizar(); }));
    const porTipo = (k, v, aviso) => { const c = campos.find((x) => x.k === k); if (!c) return; if (c.tipo === "pilulas") return marcarPilula(k, v, aviso); const el = $("#f-" + k, dlg); if (!el) return;
      if (el.tagName === "SELECT") { if ([...el.options].some((o) => o.value === v)) el.value = v; } else el.value = c.tipo === "num" ? (typeof v === "number" ? v.toFixed(2) : String(v)).replace(".", ",") : v; };
    if (cAuto && dEl) dEl.addEventListener("input", () => { if (mexeu) return; const k = catAuto(dEl.value); if (k) { if (cAuto.tipo === "pilulas") marcarPilula(cAuto.k, k, "escolhida sozinha"); else { const sel = $("#f-" + cAuto.k, dlg); if ([...sel.options].some((o) => o.value === k)) sel.value = k; } } });
    // comprovante ou print: guarda o arquivo e, se for imagem, a IA lê e preenche
    const cArq = campos.find((c) => c.tipo === "comprovante"); let arquivo = null;
    if (cArq) $("#f-" + cArq.k, dlg).addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return; arquivo = f; const msg = $(`#f-${cArq.k}-msg`, dlg);
      if (!/^image\//.test(f.type)) { msg.textContent = `${f.name} anexado. PDF não é lido sozinho: preencha os campos.`; return; }
      msg.textContent = "Lendo o comprovante..."; dlg.classList.add("lendo");
      try {
        const r = await lerComprovante(f, campos.find((c) => c.k === "categoria"));
        if (r.descricao) { porTipo("descricao", r.descricao); }
        if (r.valor) porTipo("valor", r.valor); if (r.data) porTipo("data", r.data);
        if (r.categoria) { marcarPilula("categoria", r.categoria, "escolhida sozinha"); mexeu = false; } else if (r.descricao && dEl) dEl.dispatchEvent(new Event("input"));
        if (r.forma) porTipo("forma", r.forma);
        atualizar(); msg.textContent = `${f.name}: li e preenchi. Confira antes de salvar.`;
      } catch (err) { msg.textContent = `${f.name} anexado. Não consegui ler (${err.message || err}). Preencha os campos.`; }
      dlg.classList.remove("lendo");
    });
    $("form", dlg).addEventListener("change", atualizar); atualizar();
    if (aoApagar) $("#f-apagar", dlg).addEventListener("click", async () => { if (await painelDialogo.confirmar("Apagar mesmo?", { ok: "Apagar", perigo: true })) { aoApagar(); dlg.close(); salvar(); pintar(); } });
    $("form", dlg).addEventListener("submit", (e) => {
      e.preventDefault();
      const out = {};
      for (const c of campos) { const el = $("#f-" + c.k, dlg); out[c.k] = c.tipo === "comprovante" ? arquivo : c.tipo === "chk" ? el.checked : c.tipo === "num" ? numOuNada(el.value) : el.value.trim(); }
      const falta = campos.find((c) => c.obrigatorio && visivel(c, out) && (out[c.k] === "" || out[c.k] == null));
      if (falta) { $("#f-erro", dlg).textContent = `Preencha: ${falta.rotulo}.`; return; }
      const erro = aoSalvar(out); if (typeof erro === "string") { $("#f-erro", dlg).textContent = erro; return; } dlg.close(); salvar(); pintar();
    });
    dlg.showModal();
  }
  // reduz a imagem para no máximo 1600 px (JPEG) antes de mandar para a IA
  async function reduzirImagem(f, max = 1600) {
    const url = URL.createObjectURL(f);
    try {
      const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error("imagem não abriu")); i.src = url; });
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
      return cv.toDataURL("image/jpeg", 0.85);
    } finally { URL.revokeObjectURL(url); }
  }
  async function lerComprovante(f, cCat) {
    const imagem = await reduzirImagem(f);
    const { data, error } = await banco.functions.invoke("ferramentas", { body: { acao: "gasto", imagem, categorias: (cCat && cCat.opcoes) || CAT_SAIDA, hoje: hojeIso() } });
    if (error) { let m = error.message; try { const j = await error.context.json(); m = j.error || m; } catch (e) { /* sem detalhe */ } throw new Error(m); }
    if (data && data.error) throw new Error(data.error);
    return data || {};
  }
  // depois de salvar: sobe o comprovante e guarda no lançamento (ou na compra do cartão)
  function anexarDepois(arq, alvo, id) {
    if (!arq) return;
    enviarAnexo(arq, id, "comprovante").then((a) => { alvo.comprovante = a; salvar(); toast("Comprovante anexado."); }).catch((e) => toast(e.message || "Não consegui anexar o comprovante.", true));
  }
  const camposL = (tipo) => [{ k: "descricao", rotulo: "Descrição", obrigatorio: true }, { k: "valor", rotulo: "Valor (R$)", tipo: "num", obrigatorio: true, meia: true }, { k: "data", rotulo: "Data", tipo: "data", obrigatorio: true, meia: true }, { k: "categoria", rotulo: "Tipo", tipo: "select", opcoes: tipo === "entrada" ? CAT_ENTRADA : CAT_SAIDA }, { k: "pago", rotulo: tipo === "entrada" ? "Já recebi" : "Já paguei", tipo: "chk" }];
  function editarLancamento(l, tipo, pre) {
    if (((l && l.tipo) || tipo) === "entrada" && !(l && l.auto)) { editarEntrada(l, pre); return; }
    const novo = !l; l = l || { id: uid(), tipo, data: hojeIso(), pago: true, categoria: tipo === "entrada" ? "Salário" : "Outros", ...(pre || {}) };
    if (l.auto) { const c = D().cartoes.find((k) => eDoCartao(l, k)); if (c) { janelaCompras(c, l.data.slice(0, 7)); return; } }
    const conta = String(l.id).startsWith("cpff-") || String(l.id).startsWith("fat-") || l.categoria === "Cartão"; // fatura/conta do cartão não vira compra
    const d0 = D(), cartoesAbertos = d0.cartoes.filter((c) => c.status !== "Quitado");
    // Como paguei (nov/2026): pix, débito, dinheiro, boleto e cada cartão pelo nome; cartão vira compra na fatura dele (fatura não oferece cartão)
    const noCartao = (o) => String(o.forma || "").startsWith("cartao:");
    const opForma = [...(!novo && !l.forma ? [["", "Não informado"]] : []), ...FORMAS.filter(([k]) => k !== "credito"), ...(conta ? [] : (cartoesAbertos.length ? cartoesAbertos : d0.cartoes).map((c) => ["cartao:" + c.id, c.nome + (c.final ? " •••• " + c.final : "")]))];
    const campos = l.tipo === "saida" ? [...(novo ? [{ k: "comprovante", tipo: "comprovante" }] : []), { k: "descricao", rotulo: "Descrição (ex.: iFood, Drogasil, Netflix)", obrigatorio: true }, { k: "valor", rotulo: "Valor (R$)", tipo: "num", obrigatorio: true, meia: true }, { k: "data", rotulo: "Data", tipo: "data", obrigatorio: true, meia: true },
      { k: "categoria", rotulo: "Etiqueta", tipo: "pilulas", opcoes: CAT_SAIDA, auto: true },
      { k: "forma", rotulo: "Como paguei", tipo: "select", opcoes: opForma, meia: true }, { k: "parcelas", rotulo: "Parcelas", tipo: "num", padrao: 1, mostrar: noCartao, meia: true },
      { k: "pago", rotulo: "Já paguei", tipo: "chk", mostrar: (o) => !noCartao(o) }] : camposL(l.tipo);
    if (l.tipo === "saida" && !l.forma && novo) l.forma = "pix";
    formulario(novo ? (l.tipo === "entrada" ? "Nova entrada" : "Nova saída") : "Editar lançamento", campos, l, (v) => {
      if (l.tipo === "saida" && (!v.categoria || v.categoria === "Outros")) { const k = catAuto(v.descricao); if (k) v.categoria = k; }
      const arq = v.comprovante || null; delete v.comprovante;
      if (l.tipo === "saida" && noCartao(v)) {
        // pago no cartão: vira compra do cartão, soma na fatura certa e sai da lista de saídas soltas
        const c = d0.cartoes.find((y) => "cartao:" + y.id === v.forma); if (!c) return "Cadastre um cartão na aba Cartões primeiro.";
        if (!d0.compras) d0.compras = [];
        const k = { id: uid(), cartao: c.id, descricao: v.descricao, valor: Number(v.valor) || 0, parcelas: Math.max(1, Math.round(Number(v.parcelas) || 1)), data: v.data, categoria: v.categoria };
        d0.compras.push(k); D().lancamentos = D().lancamentos.filter((y) => y.id !== l.id);
        anexarDepois(arq, k, k.id);
        const f = mesDaFatura(c, k.data); toast(`Somado na fatura de ${MESES[f.m].toLowerCase()} do ${c.nome}.`); return;
      }
      delete v.cartao; delete v.parcelas;
      const x = { ...l, ...v, valor: Number(v.valor) || 0, atrasado: false };
      if (x.valorBase != null) x.valorBase = x.valor; // fatura editada à mão: esse passa a ser o valor dela
      const lista = D().lancamentos; const i = lista.findIndex((y) => y.id === x.id); if (i >= 0) lista[i] = x; else lista.push(x);
      anexarDepois(arq, x, x.id);
      toast(novo ? "Lançado." : "Salvo.");
    }, novo ? null : () => { D().lancamentos = D().lancamentos.filter((y) => y.id !== l.id); });
  }
  const CAMPOS_C = [{ k: "nome", rotulo: "Nome do cartão", obrigatorio: true }, { k: "final", rotulo: "Final do cartão (4 números)", meia: true }, { k: "vencimento", rotulo: "Vence dia", meia: true }, { k: "fechamento", rotulo: "Fecha dia (melhor dia de compra)", meia: true }, { k: "limite", rotulo: "Limite", tipo: "num", meia: true }, { k: "disponivel", rotulo: "Disponível (vazio = calculo sozinho)", tipo: "num", meia: true }, { k: "faturaAtual", rotulo: "Fatura atual", tipo: "num", meia: true }, { k: "proximaFatura", rotulo: "Próxima fatura", tipo: "num", meia: true }, { k: "divida", rotulo: "Dívida total (tudo que falta)", tipo: "num", meia: true }, { k: "parcelasFuturas", rotulo: "Parcelas futuras", tipo: "num", meia: true }, { k: "juros", rotulo: "Juros (% ao mês)", tipo: "num", meia: true }, { k: "status", rotulo: "Situação", tipo: "select", opcoes: ["Ativo", "Em redução", "Atrasado", "Quitado"], meia: true }];
  function editarCompra(k, cartaoId) {
    const d = D(), abertos = d.cartoes.filter((c) => c.status !== "Quitado"), lista = abertos.length ? abertos : d.cartoes;
    if (!lista.length) { toast("Cadastre um cartão primeiro."); editarCartao(null); return; }
    const novo = !k; k = k || { id: uid(), cartao: cartaoId || lista[0].id, data: hojeIso(), parcelas: 1 };
    formulario(novo ? "Compra no cartão" : "Editar compra", [{ k: "cartao", rotulo: "Cartão", tipo: "select", opcoes: d.cartoes.map((c) => [c.id, c.nome]) }, { k: "descricao", rotulo: "Onde / o quê (ex.: Mercado Extra)", obrigatorio: true }, { k: "valor", rotulo: "Valor total (R$)", tipo: "num", obrigatorio: true, meia: true }, { k: "parcelas", rotulo: "Parcelas", tipo: "num", meia: true }, { k: "data", rotulo: "Data da compra", tipo: "data", obrigatorio: true, meia: true }, { k: "categoria", rotulo: "Etiqueta", tipo: "pilulas", opcoes: CAT_SAIDA.filter((c) => !["Cartão", "Empréstimo", "Financiamento"].includes(c)), auto: true }], k, (v) => {
      if (!v.categoria || v.categoria === "Outros") v.categoria = catAuto(v.descricao) || "Outros";
      const x = { ...k, ...v, valor: Number(v.valor) || 0, parcelas: Math.max(1, Math.round(Number(v.parcelas) || 1)) };
      const i = d.compras.findIndex((y) => y.id === x.id); if (i >= 0) d.compras[i] = x; else d.compras.push(x);
      const c = d.cartoes.find((y) => y.id === x.cartao), f = c ? mesDaFatura(c, x.data) : null;
      toast(f ? `Somado na fatura de ${MESES[f.m].toLowerCase()} do ${c.nome}.` : "Compra salva.");
    }, novo ? null : () => { d.compras = d.compras.filter((y) => y.id !== k.id); });
  }
  function editarLinha(tipo, nomeL) {
    const y = st.ref.y, k = nomeL.trim().toLowerCase();
    const ls = () => D().lancamentos.filter((x) => x.tipo === tipo && (x.descricao || "").trim().toLowerCase() === k && String(x.data).startsWith(y + "-"));
    const a = ls(); if (!a.length) return;
    if (a.every((l) => l.auto)) { toast("Essa fatura é a soma das compras. Edite as compras na aba Cartões."); st.aba = "cartoes"; pintar(); return; }
    const meses = MESES.map((n, i) => [String(i), n]), com = a.map((l) => Number(l.data.slice(5, 7)) - 1);
    formulario(`Editar "${nomeL}" em ${y}`, [{ k: "descricao", rotulo: "Nome", obrigatorio: true }, { k: "categoria", rotulo: "Tipo", tipo: "select", opcoes: tipo === "entrada" ? etiquetasEntrada() : CAT_SAIDA }, { k: "valor", rotulo: "Novo valor por mês (vazio = não muda)", tipo: "num", meia: true }, { k: "dia", rotulo: "Novo dia (vazio = não muda)", tipo: "num", meia: true }, { k: "de", rotulo: "Mudar de", tipo: "select", opcoes: meses, meia: true }, { k: "ate", rotulo: "Até", tipo: "select", opcoes: meses, meia: true }],
      { descricao: a[0].descricao, categoria: a[0].categoria, valor: "", dia: "", de: String(Math.min(...com)), ate: String(Math.max(...com)) }, (v) => {
        ls().filter((l) => !l.auto).forEach((l) => {
          const m = Number(l.data.slice(5, 7)) - 1; l.descricao = v.descricao; l.categoria = v.categoria;
          if (m >= Number(v.de) && m <= Number(v.ate)) { if (v.valor != null) l.valor = v.valor; if (v.dia != null) l.data = l.data.slice(0, 8) + String(Math.min(28, Math.max(1, Math.round(v.dia)))).padStart(2, "0"); }
        });
        toast("Linha atualizada em todo o painel.");
      }, () => { const ids = new Set(ls().filter((l) => !l.auto).map((l) => l.id)); D().lancamentos = D().lancamentos.filter((l) => !ids.has(l.id)); toast(`Apaguei ${nomeL} de ${y}.`); });
  }
  function movReserva(tipo) {
    formulario(tipo === "saque" ? "Saque da reserva" : "Guardar na reserva", [{ k: "valor", rotulo: "Valor (R$)", tipo: "num", obrigatorio: true, meia: true }, { k: "data", rotulo: "Data", tipo: "data", obrigatorio: true, meia: true }, { k: "obs", rotulo: tipo === "saque" ? "Para quê? (ex.: conserto do carro)" : "Observação" }], { data: hojeIso() }, (v) => {
      const rs = D().reserva, val = Math.abs(Number(v.valor) || 0); rs.movs = rs.movs || [];
      rs.atual = Math.round(((Number(rs.atual) || 0) + (tipo === "saque" ? -val : val)) * 100) / 100;
      rs.movs.unshift({ id: uid(), tipo, valor: val, data: v.data, obs: v.obs, saldo: rs.atual });
      toast(tipo === "saque" ? `Saque registrado. Sobrou ${R$(rs.atual)} na reserva.` : `Guardado! A reserva está com ${R$(rs.atual)}.`);
    });
  }
  function contaFixaNoAno() {
    const mesAtual = st.ref.y === new Date().getFullYear() ? new Date().getMonth() : 0, meses = MESES.map((n, i) => [String(i), n]);
    formulario(`${st.anoAba === "entrada" ? "Entrada" : "Despesa"} em ${st.ref.y}`, [{ k: "tipo", rotulo: "É", tipo: "select", opcoes: [["saida", "Despesa"], ["entrada", "Renda"]], meia: true }, { k: "dia", rotulo: "Dia do mês", tipo: "num", meia: true }, { k: "descricao", rotulo: "Nome (ex.: Claro Móvel, Salário)", obrigatorio: true }, { k: "valor", rotulo: "Valor por mês (R$)", tipo: "num", obrigatorio: true, meia: true }, { k: "categoria", rotulo: "Tipo", tipo: "select", opcoes: [...new Set([...CAT_SAIDA, ...etiquetasEntrada()])], meia: true }, { k: "de", rotulo: "De", tipo: "select", opcoes: meses, meia: true }, { k: "ate", rotulo: "Até", tipo: "select", opcoes: meses, meia: true }],
      { tipo: st.anoAba, dia: st.anoAba === "entrada" ? 5 : 10, categoria: st.anoAba === "entrada" ? "Salário" : "Conta fixa", de: String(mesAtual), ate: "11" }, (v) => {
        const dia = String(Math.min(28, Math.max(1, Math.round(Number(v.dia) || 10)))).padStart(2, "0"), de = Number(v.de), ate = Math.max(de, Number(v.ate));
        for (let m = de; m <= ate; m++) D().lancamentos.push({ id: uid(), tipo: v.tipo, descricao: v.descricao, valor: Number(v.valor) || 0, data: `${ymDe(st.ref.y, m)}-${dia}`, pago: false, categoria: v.categoria });
        toast(`Lancei ${ate - de + 1} meses de ${v.descricao}.`);
      });
  }
  function editarCartao(c) {
    const novo = !c; c = c || { id: uid(), status: "Ativo" };
    formulario(novo ? "Novo cartão" : "Editar cartão", CAMPOS_C, c, (v) => { const x = { ...c, ...v }; const l = D().cartoes; const i = l.findIndex((y) => y.id === x.id); if (i >= 0) l[i] = x; else l.push(x); }, novo ? null : () => { D().cartoes = D().cartoes.filter((y) => y.id !== c.id); });
  }
  const CAMPOS_E = [{ k: "nome", rotulo: "Nome", obrigatorio: true }, { k: "parcela", rotulo: "Valor da parcela", tipo: "num", meia: true }, { k: "vencimento", rotulo: "Vence dia", meia: true }, { k: "pagas", rotulo: "Parcelas pagas", tipo: "num", meia: true }, { k: "totalParcelas", rotulo: "Total de parcelas", tipo: "num", meia: true }, { k: "saldo", rotulo: "Saldo devedor", tipo: "num", meia: true }, { k: "quitacao", rotulo: "Valor para quitar hoje", tipo: "num", meia: true }, { k: "valorOriginal", rotulo: "Valor pego", tipo: "num", meia: true }, { k: "juros", rotulo: "Juros (% ao mês)", tipo: "num", meia: true }, { k: "status", rotulo: "Situação", tipo: "select", opcoes: ["Ativo", "Atraso", "Quitado"] }];
  function editarEmprestimo(e) {
    const novo = !e; e = e || { id: uid(), status: "Ativo", pagas: 0 };
    formulario(novo ? "Novo empréstimo" : "Editar empréstimo", CAMPOS_E, e, (v) => { const x = { ...e, ...v }; const l = D().emprestimos; const i = l.findIndex((y) => y.id === x.id); if (i >= 0) l[i] = x; else l.push(x); }, novo ? null : () => { D().emprestimos = D().emprestimos.filter((y) => y.id !== e.id); });
  }
  const CAMPOS_I = [{ k: "nome", rotulo: "Nome", obrigatorio: true }, { k: "tipo", rotulo: "Tipo", tipo: "select", opcoes: ["Reserva", "Tesouro Selic", "CDB", "Poupança", "Conta remunerada", "Previdência", "Ações / Fundos", "Cripto", "Outro"], meia: true }, { k: "valor", rotulo: "Valor hoje", tipo: "num", meia: true }, { k: "rendimento", rotulo: "Rende (% ao mês)", tipo: "num", meia: true }, { k: "liquidez", rotulo: "Quando dá para tirar", tipo: "select", opcoes: ["No mesmo dia", "Em alguns dias", "Só no vencimento"], meia: true }];
  function editarInvestimento(i) {
    const novo = !i; i = i || { id: uid(), tipo: "CDB", liquidez: "No mesmo dia" };
    formulario(novo ? "Novo investimento" : "Editar investimento", CAMPOS_I, i, (v) => { const x = { ...i, ...v }; const l = (D().investimentos = D().investimentos || []); const k = l.findIndex((y) => y.id === x.id); if (k >= 0) l[k] = x; else l.push(x); }, novo ? null : () => { D().investimentos = D().investimentos.filter((y) => y.id !== i.id); });
  }
  function editarConta(c) {
    const novo = !c; c = c || { id: uid() };
    formulario(novo ? "Nova conta" : "Editar conta", [{ k: "nome", rotulo: "Banco / conta", obrigatorio: true }, { k: "saldo", rotulo: "Saldo", tipo: "num" }], c, (v) => { const x = { ...c, ...v }; const l = (D().contas = D().contas || []); const k = l.findIndex((y) => y.id === x.id); if (k >= 0) l[k] = x; else l.push(x); }, novo ? null : () => { D().contas = D().contas.filter((y) => y.id !== c.id); });
  }

  // folha que sobe de baixo no celular (botão + e menu Mais)
  function folha(titulo, itens) {
    let f = $("#fn-folha"); if (!f) { f = document.createElement("dialog"); f.id = "fn-folha"; f.className = "fn-folha"; document.body.appendChild(f); }
    f.innerHTML = tingir(`<h2>${esc(titulo)}</h2><div class="grade">${itens.map((x, i) => `<button type="button" data-i="${i}">${x.ic}${esc(x.t)}</button>`).join("")}</div><button class="fn-btn fechar" type="button" data-fechar>Fechar</button>`);
    $$("[data-i]", f).forEach((b) => b.addEventListener("click", () => { f.close(); itens[Number(b.dataset.i)].acao(); }));
    $("[data-fechar]", f).addEventListener("click", () => f.close());
    f.addEventListener("click", (e) => { if (e.target === f) f.close(); });
    f.showModal();
  }

  // detalhe dos cards coloridos do Dashboard (abre ao tocar no card)
  function detalheKpi(qual) {
    const d = D(), lm = doMes(st.ref.y, st.ref.m), mesN = MESES[st.ref.m].toLowerCase() + " de " + st.ref.y;
    const ant = new Date(st.ref.y, st.ref.m - 1, 1), la = doMes(ant.getFullYear(), ant.getMonth());
    const dividas = listaDividas(), divTotal = dividas.reduce((a, x) => a + x.saldo, 0), p = plano(dividas, d.extra, st.metodo);
    const linha = (l) => { const ent = l.tipo === "entrada", sit = l.pago ? (ent ? "Recebido" : "Pago") : vencido(l) ? "Vencido" : ent ? "A receber" : "A pagar";
      return `<button type="button" class="fn-item" data-det-l="${esc(l.id)}"><div class="x"><b>${esc(l.descricao || "Sem descrição")}</b><small>${dataBR(l.data)} · ${esc(l.categoria || "")}</small></div><span class="fn-chip ${l.pago ? "" : vencido(l) ? "mal" : "amb"}">${sit}</span><span class="fn-valor ${ent ? "entra" : "sai"}">${R$(l.valor)}</span></button>`; };
    const resumo = (itens) => `<div class="fn-det-res">${itens.map(([t, v, c]) => `<div${c ? ` class="${c}"` : ""}><small>${t}</small><b>${v}</b></div>`).join("")}</div>`;
    const ordena = (l) => [...l].sort((a, b) => a.data.localeCompare(b.data));
    let titulo = "", corpo = "", acoes = [];
    if (qual === "entrou" || qual === "saiu") {
      const ent = qual === "entrou", lista = ent ? entradas(lm) : saidas(lm), tot = soma(lista), feito = soma(lista.filter((l) => l.pago)), antT = soma(ent ? entradas(la) : saidas(la));
      titulo = (ent ? "Entrou em " : "Saiu em ") + mesN;
      corpo = resumo([["Total", R$(tot)], [ent ? "Recebido" : "Pago", R$(feito), "ok"], [ent ? "A receber" : "A pagar", R$(tot - feito), "amb"], ["Mês passado", R$(antT)]])
        + (lista.length ? `<div class="fn-lista">${ordena(lista).map(linha).join("")}</div>` : `<p class="fn-vazio">Nada ${ent ? "entrou" : "saiu"} neste mês.</p>`);
      acoes = [[ent ? "Ver todas as entradas" : "Ver todas as saídas", ent ? "entradas" : "saidas"]];
    } else if (qual === "sobra") {
      const e = soma(entradas(lm)), s = soma(saidas(lm)), cats = {};
      saidas(lm).forEach((l) => { cats[l.categoria || "Outros"] = (cats[l.categoria || "Outros"] || 0) + Number(l.valor || 0); });
      titulo = (e - s >= 0 ? "Sobrou em " : "Faltou em ") + mesN;
      corpo = resumo([["Entrou", R$(e), "ok"], ["Saiu", R$(s), "mal"], [e - s >= 0 ? "Sobrou" : "Faltou", R$(e - s), e - s >= 0 ? "ok" : "mal"]])
        + `<h4>Saídas por tipo</h4>` + (Object.keys(cats).length ? `<div class="fn-lista">${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="fn-item"><div class="x"><b>${esc(k)}</b><small>${Math.round(v / Math.max(s, 1) * 100)}% das saídas</small></div><span class="fn-valor sai">${R$(v)}</span></div>`).join("")}</div>` : `<p class="fn-vazio">Nenhuma saída neste mês.</p>`);
      acoes = [["Ver entradas", "entradas"], ["Ver saídas", "saidas"]];
    } else if (qual === "divida") {
      titulo = "Dívida total";
      corpo = resumo([["Total devido", R$(divTotal), "mal"], ["Em cartões", R$(dividas.filter((x) => x.tipo === "Cartão").reduce((a, x) => a + x.saldo, 0))], ["Em empréstimos", R$(dividas.filter((x) => x.tipo !== "Cartão").reduce((a, x) => a + x.saldo, 0))]])
        + (dividas.length ? `<div class="fn-lista">${[...dividas].sort((a, b) => b.saldo - a.saldo).map((x) => `<button type="button" class="fn-item" data-aba-det="${x.tipo === "Cartão" ? "cartoes" : "emprestimos"}"><div class="x"><b>${esc(x.nome)}</b><small>${x.tipo} · mínimo ${R$(x.minimo)}/mês${x.juros ? ` · ${String(x.juros).replace(".", ",")}% a.m.` : ""}</small></div><span class="fn-valor sai">${R$(x.saldo)}</span></button>`).join("")}</div>` : `<p class="fn-vazio">Nenhuma dívida aberta. 🎉</p>`);
      acoes = [["Ver cartões", "cartoes"], ["Ver empréstimos", "emprestimos"]];
    } else if (qual === "livre") {
      titulo = "Livre das dívidas";
      corpo = (dividas.length ? resumo([["Livre em", p.meses === null ? "+10 anos" : mesDaqui(p.meses), "ok"], ["Extra por mês", R$(d.extra)], ["Método", st.metodo === "bola" ? "Menor primeiro" : "Juros maior primeiro"]])
        + `<h4>Ordem de quitação</h4><div class="fn-lista">${p.ordem.map((x, i) => `<div class="fn-item"><span class="fn-av" style="width:28px;height:28px;font-size:12px">${i + 1}</span><div class="x"><b>${esc(x.nome)}</b><small>${x.tipo} · ${R$(x.saldo)}</small></div><span class="fn-chip neutro">${x.quitada ? mesDaqui(x.quitada) : "–"}</span></div>`).join("")}</div>
        <p class="fn-det-nota">O plano completo (com o valor extra por mês e a troca de método) fica mais abaixo no Início.</p>` : `<p class="fn-vazio">Você não tem dívidas abertas. 🎉</p>`);
      acoes = [["Ver empréstimos", "emprestimos"], ["Ver cartões", "cartoes"]];
    } else return;
    let f = $("#fn-detalhe"); if (!f) { f = document.createElement("dialog"); f.id = "fn-detalhe"; f.className = "fn-folha fn-detalhe"; document.body.appendChild(f); }
    f.innerHTML = tingir(`<div class="fn-det-cab"><h2>${esc(titulo)}</h2><button class="fn-icone" type="button" data-fechar aria-label="Fechar">✕</button></div>${corpo}
      <div class="fn-det-acoes">${acoes.map(([t, a]) => `<button class="fn-btn" type="button" data-aba-det="${a}">${esc(t)}</button>`).join("")}</div>`);
    $$("[data-det-l]", f).forEach((b) => b.addEventListener("click", () => { const l = d.lancamentos.find((x) => String(x.id) === b.dataset.detL); f.close(); if (l) editarLancamento(l); }));
    $$("[data-aba-det]", f).forEach((b) => b.addEventListener("click", () => { f.close(); st.aba = b.dataset.abaDet; pintar(); window.scrollTo(0, 0); }));
    $("[data-fechar]", f).addEventListener("click", () => f.close());
    f.onclick = (e) => { if (e.target === f) f.close(); };
    f.showModal();
  }

  // lista inteira de vencimentos (botão "Ver todos os vencimentos")
  function todosVencimentos() {
    const d = D(), lista = d.lancamentos.filter((l) => l.tipo === "saida" && !l.pago).filter((l) => (new Date(l.data + "T00:00:00") - new Date(hojeIso() + "T00:00:00")) / 864e5 <= 30).sort((a, b) => a.data.localeCompare(b.data));
    let f = $("#fn-detalhe"); if (!f) { f = document.createElement("dialog"); f.id = "fn-detalhe"; f.className = "fn-folha fn-detalhe"; document.body.appendChild(f); }
    f.innerHTML = tingir(`<div class="fn-det-cab"><h2>Próximos vencimentos</h2><button class="fn-icone" type="button" data-fechar aria-label="Fechar">✕</button></div>
      <p class="fn-det-nota" style="margin:0 0 8px">Vencidos e os próximos 30 dias · total ${R$(soma(lista))}. Toque no ✓ para marcar como pago.</p>
      ${lista.length ? `<div class="fn-venc-lista">${lista.map((l) => linhaVenc(l, true)).join("")}</div>` : `<p class="fn-vazio">Nada para pagar agora.</p>`}`);
    $$("[data-pagar-venc]", f).forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); const l = d.lancamentos.find((x) => String(x.id) === b.dataset.pagarVenc); if (!l) return; mudarSituacao(l, "pago"); salvar(); pintar(); toast("Marcado como pago."); todosVencimentos(); }));
    $$("[data-venc]", f).forEach((b) => b.addEventListener("click", () => { const l = d.lancamentos.find((x) => String(x.id) === b.dataset.venc); f.close(); if (l) editarLancamento(l); }));
    $("[data-fechar]", f).addEventListener("click", () => f.close());
    f.onclick = (e) => { if (e.target === f) f.close(); };
    if (!f.open) f.showModal();
  }

  // ---------- eventos ----------
  function ligar() {
    requestAnimationFrame(() => $$(".fn-rolar").forEach((r) => { r.scrollLeft = 0; }));
    const raiz = $("#raiz"), d = D(), acha = (lista, id) => (lista || []).find((x) => String(x.id) === String(id));
    $$("[data-aba]", raiz).forEach((b) => b.addEventListener("click", () => { st.aba = b.dataset.aba; pintar(); window.scrollTo(0, 0); }));
    $$("[data-venc]", raiz).forEach((b) => { const abre = () => { const l = acha(d.lancamentos, b.dataset.venc); if (l) editarLancamento(l); }; b.addEventListener("click", abre); b.addEventListener("keydown", (e) => { if (e.key === "Enter") abre(); }); });
    $$("[data-venc-todos]", raiz).forEach((b) => b.addEventListener("click", todosVencimentos));
    $$(".fn-gr", raiz).forEach((g) => {
      const dica = $(".fn-gr-dica", g), area = $(".fn-gr-area", g); let toque = false, ultimo = null;
      const mostra = (c) => {
        $$(".fn-gr-col", g).forEach((x) => x.classList.toggle("hover", x === c));
        dica.innerHTML = `<b>${esc(c.dataset.n)}</b><span style="color:${COR_SAI}">Despesas : ${R$(c.dataset.s)}</span><span style="color:${COR_ENT}">Entradas : ${R$(c.dataset.e)}</span>`;
        dica.hidden = false;
        const a = area.getBoundingClientRect(), r = c.getBoundingClientRect(), w = dica.offsetWidth;
        let x = r.right - a.left + 8; if (x + w > a.width) x = r.left - a.left - w - 8; if (x < 0) x = Math.max(0, (a.width - w) / 2);
        dica.style.left = x + "px";
      };
      const esconde = () => { dica.hidden = true; $$(".fn-gr-col", g).forEach((x) => x.classList.remove("hover")); ultimo = null; };
      $$(".fn-gr-col", g).forEach((c) => {
        c.addEventListener("pointerdown", (e) => { toque = e.pointerType !== "mouse"; });
        c.addEventListener("mouseenter", () => { if (!toque) mostra(c); });
        c.addEventListener("focus", () => mostra(c));
        c.addEventListener("click", () => { // no celular: 1º toque mostra os valores, 2º abre o mês
          if (toque && ultimo !== c) { ultimo = c; mostra(c); return; }
          st.ref = { y: st.ref.y, m: Number(c.dataset.grMes) }; pintar();
        });
      });
      g.addEventListener("mouseleave", () => { if (!toque) esconde(); });
    });
    $$("[data-kpi]", raiz).forEach((b) => { b.addEventListener("click", () => detalheKpi(b.dataset.kpi)); b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); detalheKpi(b.dataset.kpi); } }); });
    $$("[data-min]", raiz).forEach((b) => b.addEventListener("click", () => { MIN[b.dataset.min] = !minimo(b.dataset.min, b.dataset.padrao === "1"); guardarMin(); pintar(); }));
    $$("[data-min-todos]", raiz).forEach((b) => b.addEventListener("click", () => {
      const pre = b.dataset.minTodos, lista = pre === "c" ? d.cartoes : d.emprestimos, ids = lista.map((x) => pre + x.id);
      const fechar = ids.some((id, i) => !minimo(id, pre === "c" ? true : lista[i].status === "Quitado"));
      ids.forEach((id) => { MIN[id] = fechar; }); guardarMin(); pintar();
    }));
    $$("[data-fab]", raiz).forEach((b) => b.addEventListener("click", () => folha("O que você quer lançar?", [
      { ic: ICONE.entra, t: "Entrada", acao: () => editarLancamento(null, "entrada") },
      { ic: ICONE.sai, t: "Saída", acao: () => editarLancamento(null, "saida") },
      { ic: ICONE.cartoes, t: "Compra no cartão", acao: () => editarCompra(null) },
    ])));
    $$("[data-mais]", raiz).forEach((b) => b.addEventListener("click", () => folha("Mais", [
      ...[...ABAS, ...(st.dona ? [["acesso", "Acesso"]] : [])].filter(([k]) => !NO_CELULAR.includes(k)).map(([k, t]) => ({ ic: ICONE[k], t: k === "reserva" ? "Reserva e investimentos" : t, acao: () => { st.aba = k; pintar(); window.scrollTo(0, 0); } })),
      { ic: ICONE.olho, t: ocultar ? "Mostrar valores" : "Esconder valores", acao: () => { ocultar = !ocultar; try { localStorage.setItem("fn-ocultar", ocultar ? "1" : "0"); } catch (e) { /* sem armazenamento */ } pintar(); } },
      { ic: ICONE.sair, t: "Sair", acao: async () => { await banco.auth.signOut(); telaEntrar(); } },
    ])));
    $$("[data-sair]", raiz).forEach((b) => b.addEventListener("click", async () => { await banco.auth.signOut(); telaEntrar(); }));
    $$("[data-olho]", raiz).forEach((b) => b.addEventListener("click", () => { ocultar = !ocultar; try { localStorage.setItem("fn-ocultar", ocultar ? "1" : "0"); } catch (e) { /* sem armazenamento */ } pintar(); }));
    $$("[data-mes]", raiz).forEach((b) => b.addEventListener("click", () => { const x = new Date(st.ref.y, st.ref.m + Number(b.dataset.mes), 1); st.ref = { y: x.getFullYear(), m: x.getMonth() }; pintar(); }));
    $$("[data-ir-mes]", raiz).forEach((b) => b.addEventListener("click", () => { st.ref = { y: st.ref.y, m: Number(b.dataset.irMes) }; pintar(); }));
    $$("[data-novo]", raiz).forEach((b) => b.addEventListener("click", () => editarLancamento(null, b.dataset.novo)));
    $$("[data-editar-l]", raiz).forEach((b) => b.addEventListener("click", () => editarLancamento(acha(d.lancamentos, b.dataset.editarL))));
    $$("[data-compras-fat]", raiz).forEach((b) => b.addEventListener("click", () => { const [cid, ym] = b.dataset.comprasFat.split("|"); const c = acha(d.cartoes, cid); if (c) janelaCompras(c, ym); }));
    if (!raiz.querySelector(".fn-bloq")) $$("[data-pagar]", raiz).forEach((b) => b.addEventListener("click", () => { const l = acha(d.lancamentos, b.dataset.pagar); if (!l) return; if (l.origem === "pj") { toast("Essa entrada vem do painel CNPJ: marque o pagamento lá."); return; } mudarSituacao(l, l.pago ? "pendente" : "pago"); salvar(); pintar(); toast(l.pago ? (l.tipo === "entrada" ? "Marcado como recebido." : "Marcado como pago.") : "Voltou para pendente."); }));
    // visão anual
    $$("[data-ano-mes]", raiz).forEach((b) => b.addEventListener("click", () => { st.anoMes = Number(b.dataset.anoMes); pintar(); }));
    const vb = $("#fn-va-busca"); if (vb) vb.addEventListener("input", () => { st.anoBusca = vb.value; const pos = vb.selectionStart; pintar(); const nv = $("#fn-va-busca"); if (nv) { nv.focus(); try { nv.setSelectionRange(pos, pos); } catch (e) { /* busca */ } } });
    const vs = $("#fn-va-status"); if (vs) vs.addEventListener("change", () => { st.anoStatus = vs.value; pintar(); });
    $$("[data-novo-ano]", raiz).forEach((b) => b.addEventListener("click", () => { const ym = ymDe(st.ref.y, st.anoMes || 0), dia = st.ref.y === new Date().getFullYear() && st.anoMes === new Date().getMonth() ? hojeIso() : ym + "-10";
      if (st.anoAba === "entrada") editarEntrada(null, { dataPrevista: dia, data: dia }); else editarLancamento(null, "saida", { data: dia, pago: false }); }));
    $$("[data-status-l]", raiz).forEach((el) => el.addEventListener("change", () => { const l = acha(d.lancamentos, el.dataset.statusL); if (!l) return; mudarSituacao(l, el.value); salvar(); pintar(); }));
    $$("[data-duplicar]", raiz).forEach((b) => b.addEventListener("click", () => { const l = acha(d.lancamentos, b.dataset.duplicar); if (!l) return;
      const mover = (iso) => { if (!iso) return iso; const x = new Date(iso + "T00:00:00"); const n = new Date(x.getFullYear(), x.getMonth() + 1, Math.min(28, x.getDate())); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`; };
      const base = l.tipo === "entrada" ? (datasDe(l).prevista || l.data) : l.data;
      const c = { ...l, id: uid(), data: mover(base), pago: false, atrasado: false, nf: null, comprovante: null, tac: null, origem: undefined, pjId: undefined, etiquetaManual: undefined, ...(l.tipo === "entrada" ? { dataPrevista: mover(base), dataPagamento: "" } : {}) };
      d.lancamentos.push(c); salvar(); pintar(); toast(`Copiei para ${MESES[Number(c.data.slice(5, 7)) - 1].toLowerCase()}.`); }));
    $$("[data-apagar-l]", raiz).forEach((b) => b.addEventListener("click", async () => { const l = acha(d.lancamentos, b.dataset.apagarL); if (!l || !(await painelDialogo.confirmar(`Apagar "${l.descricao || "lançamento"}"?`, { ok: "Apagar", perigo: true }))) return;
      tirarArquivos([l.nf && l.nf.path, l.comprovante && l.comprovante.path, l.tac && l.tac.path]); d.lancamentos = d.lancamentos.filter((x) => x.id !== l.id); salvar(); pintar(); }));
    $$("[data-anexo-ver]", raiz).forEach((b) => b.addEventListener("click", () => { const [id, qual] = b.dataset.anexoVer.split("|"); const l = acha(d.lancamentos, id); if (l && l[qual]) abrirAnexo(l[qual]); }));
    $$("[data-planilha]", raiz).forEach((b) => b.addEventListener("click", () => { st.anoModo = "planilha"; pintar(); }));
    $$("[data-planilha-sair]", raiz).forEach((b) => b.addEventListener("click", () => { st.anoModo = "mes"; pintar(); }));
    $$("[data-novo-cartao]", raiz).forEach((b) => b.addEventListener("click", () => editarCartao(null)));
    $$("[data-editar-c]", raiz).forEach((b) => b.addEventListener("click", () => editarCartao(acha(d.cartoes, b.dataset.editarC))));
    $$("[data-fatura]", raiz).forEach((b) => b.addEventListener("click", () => { const c = acha(d.cartoes, b.dataset.fatura); const dia = String(Math.min(28, Math.max(1, parseInt(c.vencimento, 10) || 10))).padStart(2, "0"); editarLancamento(null, "saida"); setTimeout(() => { $("#f-descricao").value = "Fatura " + c.nome; $("#f-categoria").value = "Cartão"; $("#f-valor").value = String(c.faturaAtual || "").replace(".", ","); $("#f-data").value = `${st.ref.y}-${String(st.ref.m + 1).padStart(2, "0")}-${dia}`; $("#f-pago").checked = false; }, 0); }));
    $$("[data-novo-emp]", raiz).forEach((b) => b.addEventListener("click", () => editarEmprestimo(null)));
    $$("[data-editar-e]", raiz).forEach((b) => b.addEventListener("click", () => editarEmprestimo(acha(d.emprestimos, b.dataset.editarE))));
    $$("[data-parcela]", raiz).forEach((b) => b.addEventListener("click", () => {
      const e = acha(d.emprestimos, b.dataset.parcela); if (!e) return;
      e.pagas = (Number(e.pagas) || 0) + 1; e.saldo = Math.max(0, (Number(e.saldo) || 0) - (Number(e.parcela) || 0));
      if (Number(e.totalParcelas) && e.pagas >= Number(e.totalParcelas)) { e.status = "Quitado"; e.saldo = 0; }
      d.lancamentos.push({ id: uid(), tipo: "saida", descricao: "Parcela " + e.nome, valor: Number(e.parcela) || 0, data: hojeIso(), pago: true, categoria: "Empréstimo" });
      salvar(); pintar(); toast(e.status === "Quitado" ? `${e.nome} quitado! 🎉` : "Parcela registrada e lançada como saída.");
    }));
    $$("[data-novo-inv]", raiz).forEach((b) => b.addEventListener("click", () => editarInvestimento(null)));
    $$("[data-editar-i]", raiz).forEach((b) => b.addEventListener("click", () => editarInvestimento(acha(d.investimentos, b.dataset.editarI))));
    $$("[data-nova-conta]", raiz).forEach((b) => b.addEventListener("click", () => editarConta(null)));
    $$("[data-editar-conta]", raiz).forEach((b) => b.addEventListener("click", () => editarConta(acha(d.contas, b.dataset.editarConta))));
    $$("[data-nova-compra]", raiz).forEach((b) => b.addEventListener("click", () => editarCompra(null, b.dataset.novaCompra || null)));
    $$("[data-editar-compra]", raiz).forEach((b) => b.addEventListener("click", () => editarCompra(acha(d.compras, b.dataset.editarCompra))));
    $$("[data-conferir]", raiz).forEach((el) => el.addEventListener("change", () => { const c = acha(d.cartoes, el.dataset.conferir); if (!c) return; c.conferidas = c.conferidas || {}; c.conferidas[ymDe(st.ref.y, st.ref.m)] = el.value.trim() === "" ? null : num(el.value); salvar(); pintar(); }));
    $$("[data-novo-cat]", raiz).forEach((b) => b.addEventListener("click", () => editarLancamento(null, b.dataset.tipo, { categoria: b.dataset.novoCat, descricao: ["Conta fixa", "PUBLI", "MARKETPLACE"].includes(b.dataset.novoCat) ? "" : b.dataset.novoCat })));
    $$("[data-grupo]", raiz).forEach((b) => b.addEventListener("click", () => { st.anoAbertos[b.dataset.grupo] = b.getAttribute("aria-expanded") !== "true"; pintar(); }));
    $$("[data-ano-aba]", raiz).forEach((b) => b.addEventListener("click", () => { st.anoAba = b.dataset.anoAba; pintar(); }));
    $$("[data-linha]", raiz).forEach((b) => b.addEventListener("click", () => { const [tipo, nomeL] = b.dataset.linha.split("|"); editarLinha(tipo, nomeL); }));
    $$("[data-mov-res]", raiz).forEach((b) => b.addEventListener("click", () => movReserva(b.dataset.movRes)));
    $$("[data-apagar-mov]", raiz).forEach((b) => b.addEventListener("click", async () => {
      const rs = d.reserva, m = (rs.movs || []).find((x) => x.id === b.dataset.apagarMov); if (!m || !(await painelDialogo.confirmar("Apagar esse movimento? O valor volta para a reserva como estava.", { ok: "Apagar", perigo: true }))) return;
      rs.atual = Math.round(((Number(rs.atual) || 0) + (m.tipo === "saque" ? m.valor : -m.valor)) * 100) / 100; rs.movs = rs.movs.filter((x) => x !== m); salvar(); pintar();
    }));
    $$("[data-linha-fixa]", raiz).forEach((b) => b.addEventListener("click", contaFixaNoAno));
    $$("[data-celula]", raiz).forEach((b) => b.addEventListener("click", () => {
      const [tipo, nomeL, cat, m, dia] = b.dataset.celula.split("|"), ym = ymDe(st.ref.y, Number(m));
      const ls = d.lancamentos.filter((x) => x.tipo === tipo && (x.descricao || "").trim().toLowerCase() === nomeL.trim().toLowerCase() && String(x.data).startsWith(ym)), l = ls[0];
      if (ls.length > 1) folha(`${nomeL} em ${MESES[Number(m)]}`, ls.map((x) => ({ ic: ICONE.lapis, t: `${dataBR(x.data).slice(0, 5)} · ${R$(x.valor)}`, acao: () => editarLancamento(x) })));
      else if (l) editarLancamento(l); else editarLancamento(null, tipo, { descricao: nomeL, categoria: cat || (tipo === "entrada" ? "Salário" : "Outros"), data: `${ym}-${String(Math.min(28, Math.max(1, Number(dia) || 10))).padStart(2, "0")}`, pago: false });
    }));
    $("[data-metodo]", raiz).forEach((b) => b.addEventListener("click", () => { st.metodo = b.dataset.metodo; pintar(); }));
    $("[data-grafico-gastos]", raiz).forEach((b) => b.addEventListener("click", () => { st.visaoGastos = b.dataset.graficoGastos; pintar(); }));
    const xr = $("#fn-extra-r"); if (xr) { xr.addEventListener("input", () => { $("#fn-extra-v").textContent = R$(Number(xr.value)); }); xr.addEventListener("change", () => { D().extra = Number(xr.value) || 0; salvar(); const y = window.scrollY; pintar(); window.scrollTo(0, y); }); }
    const ex = $("#fn-extra"); if (ex) ex.addEventListener("change", () => { d.extra = num(ex.value); salvar(); pintar(); });
    [["#fn-res", "atual"], ["#fn-aporte", "aporte"], ["#fn-metam", "metaMeses"]].forEach(([s, k]) => { const el = $(s); if (el) el.addEventListener("change", () => { d.reserva[k] = num(el.value); salvar(); pintar(); }); });
    const fm = $("#fn-add-membro");
    if (fm) {
      pintarMembros();
      fm.addEventListener("submit", async (e) => { e.preventDefault(); const email = $("#fn-membro-email").value.trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(email)) { toast("Confira o e-mail.", true); return; } const { error } = await banco.from("financeiro_membros").upsert({ email, nome: "Eduardo", perfil: "eduardo" }); if (error) { toast("Não consegui liberar: " + error.message, true); return; } $("#fn-membro-email").value = ""; toast("Acesso liberado. Agora ele entra e toca em Primeiro acesso."); pintarMembros(); });
    }
  }

  // ---------- início ----------
  async function iniciar() {
    if (!banco) { $("#raiz").innerHTML = `<p class="fn-carregando">Não carregou. Confira a internet e abra de novo.</p>`; return; }
    const { data } = await banco.auth.getSession();
    if (!data || !data.session) { telaEntrar(); return; }
    if (recuperando) { telaEntrar("nova"); return; }
    st.sessao = data.session; st.email = (data.session.user.email || "").toLowerCase(); st.dona = st.email === window.BANCO_EMAIL_DONA;
    const { data: perfil } = await banco.rpc("perfil_financeiro");
    if (!perfil || !PERFIS.some((p) => p.id === perfil)) { await banco.auth.signOut(); telaEntrar("entrar", "Esse e-mail ainda não tem acesso. Peça para a Mari liberar na aba Acesso."); return; }
    st.atual = perfil; document.body.classList.toggle("tema-edu", perfil === "eduardo"); document.body.classList.toggle("tema-mari", perfil === "mari");
    const tema = document.querySelector('meta[name="theme-color"]'); if (tema) tema.content = perfil === "eduardo" ? "#eef1f6" : "#f4f2ff";
    $("#raiz").innerHTML = `<p class="fn-carregando">Abrindo as finanças…</p>`;
    try { await carregar(); } catch (e) { $("#raiz").innerHTML = `<p class="fn-carregando">${esc(e.message)}</p>`; return; }
    pintar();
  }
  // link de "Esqueci a senha": abre a tela de senha nova e NÃO entra direto no painel
  // (antes o painel abria por cima e a senha nunca era trocada)
  let recuperando = /type=recovery/.test(location.hash + location.search);
  if (banco) banco.auth.onAuthStateChange((ev) => { if (ev === "PASSWORD_RECOVERY") { recuperando = true; telaEntrar("nova"); } });
  // versão nova publicada: recarrega sozinho quando o app volta para a tela (sem precisar limpar cache)
  const MINHA_V = ((document.currentScript && document.currentScript.src) || "").match(/v=(\d+)/)?.[1] || (([...document.scripts].find((x) => /financeiro\.js/.test(x.src)) || {}).src || "").match(/v=(\d+)/)?.[1];
  async function conferirVersao() {
    try {
      const h = await (await fetch(location.pathname + "?t=" + Date.now(), { cache: "no-store" })).text(), v = (h.match(/financeiro\.js\?v=(\d+)/) || [])[1];
      const ocupado = document.querySelector("dialog[open]") || (document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName));
      if (MINHA_V && v && v !== MINHA_V && !ocupado) location.reload();
    } catch (e) { /* sem internet: tenta depois */ }
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { conferirVersao(); if (st.sessao && !st.pendente && !document.querySelector("dialog[open]")) carregar().then(() => pintar()).catch(() => {}); } });
  setInterval(conferirVersao, 5 * 60 * 1000);
  iniciar();
  window.financeiroApp = { estado: st, conselhosGerais, plano }; // usado nos testes
})();
