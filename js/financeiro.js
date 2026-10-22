// =========================================================
// FINANÇAS BONETTO (marianabonetto.com.br/financeiro)
// App das finanças pessoais (CPF) da Mari e do Eduardo. Cada um entra com a própria senha e vê
// só o seu perfil (linha "mari" ou "eduardo" da tabela financeiro_contas; o banco decide pela
// função perfil_financeiro). O painel do Eduardo usa a paleta azul-acinzentada da referência Payno (tema-edu).
// Abas: Dashboard, Entradas, Saídas, Cartões (compras por cartão somam sozinhas na fatura e no fim
// do mês ele confere com o valor do banco), Empréstimos, Reserva & Investimentos, Ano a ano
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
  const ABAS = [["dash", "Dashboard"], ["entradas", "Entradas"], ["saidas", "Saídas"], ["cartoes", "Cartões"], ["emprestimos", "Empréstimos"], ["reserva", "Reserva & Investimentos"], ["anual", "Ano a ano"]];
  const NO_CELULAR = ["dash", "entradas", "saidas", "cartoes"]; // menu de baixo no celular; o resto fica em "Mais"
  const CURTO = { dash: "Início", reserva: "Reserva", anual: "Ano" };
  const TITULO = { dash: "Visão geral", entradas: "Entradas", saidas: "Saídas", cartoes: "Cartões", emprestimos: "Empréstimos", reserva: "Reserva & Investimentos", anual: "Ano a ano", acesso: "Acesso" };
  const CAT_ENTRADA = ["Salário", "Vale", "Renda extra", "Publicidade", "UGC", "Trabalho", "Outros"];
  const CAT_SAIDA = ["Conta fixa", "Cartão", "Empréstimo", "Financiamento", "Dívida pessoal", "Mercado", "Casa", "Filhos", "Saúde", "Transporte", "Lazer", "Assinaturas", "Outros"];
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

  const st = { sessao: null, email: "", dona: false, perfis: {}, atual: "mari", aba: "dash", ref: (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })(), anoAba: "saida", anoAbertos: {}, metodo: "avalanche", salvando: null };
  const vazio = () => ({ cartoes: [], emprestimos: [], lancamentos: [], reserva: { atual: 0, metaMeses: 6, aporte: 0 }, investimentos: [], contas: [], compras: [], extra: 150 });
  const D = () => st.perfis[st.atual] || (st.perfis[st.atual] = vazio());

  function toast(t, erro) { const el = $("#toast"); el.textContent = t; el.classList.toggle("erro", Boolean(erro)); el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 3800); }

  // ---------- banco ----------
  async function carregar() {
    const { data, error } = await banco.from("financeiro_contas").select("id,nome,dados").eq("id", st.atual);
    if (error) throw new Error("Não consegui abrir as finanças: " + error.message);
    const p = PERFIS.find((x) => x.id === st.atual), linha = (data || [])[0];
    st.perfis[p.id] = { ...vazio(), ...((linha && linha.dados) || {}) };
    if (!linha) await banco.from("financeiro_contas").upsert({ id: p.id, nome: p.nome, dados: st.perfis[p.id], atualizado_por: st.email });
    sincronizarFaturas();
    // primeira vez: o perfil da Mari puxa o Financeiro CPF do painel dela
    const m = st.perfis.mari;
    if (st.atual === "mari" && st.dona && !m.importado && !m.lancamentos.length && !m.cartoes.length) await importarDoPainel();
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
  function salvar() { sincronizarFaturas(); clearTimeout(st.salvando); const id = st.atual; st.salvando = setTimeout(() => salvarAgora(id), 900); }
  async function salvarAgora(id) {
    const p = PERFIS.find((x) => x.id === id);
    const { error } = await banco.from("financeiro_contas").upsert({ id, nome: p.nome, dados: st.perfis[id], atualizado_em: new Date().toISOString(), atualizado_por: st.email });
    if (error) toast("Não salvou: " + error.message, true);
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
        const valor = Math.round(((conf[ym] != null ? conf[ym] : somas[ym]) || 0) * 100) / 100;
        const l = d.lancamentos.find((x) => x.id === `fat-${c.id}-${ym}`) || d.lancamentos.find((x) => String(x.id).startsWith("cpff-" + c.id + "-") && x.data.slice(0, 7) === ym);
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
    const ordem = [...lista].sort((a, b) => (metodo === "avalanche" ? (b.juros - a.juros) || (a.resta - b.resta) : a.resta - b.resta));
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
  const kpi = (t, v, ic, sub, tom, chip) => `<div class="fn-kpi ${tom || ""}"><div class="fn-kpi-t"><span class="fn-kpi-ic">${ICONE[ic] || ""}</span>${esc(t)}</div><div class="fn-kpi-v">${String(v).replace(/,(\d{2})$/, '<small>,$1</small>')}</div><div class="fn-kpi-s">${chip ? `<span class="fn-chip ${chip[1] || ""}">${chip[0]}</span>` : ""}${sub ? `<span>${sub}</span>` : ""}</div></div>`;
  const delta = (a, b, inverter) => { const p = pct(a, b); if (p === null) return null; const bom = inverter ? p <= 0 : p >= 0; return [(p > 0 ? "▲ " : p < 0 ? "▼ " : "") + Math.abs(p) + "%", bom ? "" : "mal"]; };
  const CORES = ["#6b4a35", "#a87058", "#cdb39b", "#4f7a54", "#c9973b", "#4a6a8a", "#8a6650", "#d3a98f"];
  function rosca(itens, total, centro) {
    let ang = -Math.PI / 2; const r = 52, cx = 75, cy = 75;
    const arcos = itens.map((it, i) => {
      const a = (it.v / Math.max(total, 1)) * Math.PI * 2, x1 = cx + r * Math.cos(ang), y1 = cy + r * Math.sin(ang); ang += a;
      const x2 = cx + r * Math.cos(ang - 0.0001), y2 = cy + r * Math.sin(ang - 0.0001);
      return `<path d="M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${a > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}" stroke="${CORES[i % CORES.length]}" stroke-width="20" fill="none"/>`;
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
    $("#raiz").innerHTML = tingir(`<div class="fn-app">
      <aside class="fn-lado">
        <div class="fn-marca"><span class="fn-marca-ic"><svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg></span><div><b>Finanças</b><small>Bonetto</small></div></div>
        <div class="fn-dono">${esc(p.nome)}</div>
        <nav class="fn-nav">${abas.map(([k, t]) => `<button type="button" data-aba="${k}" class="${st.aba === k ? "on" : ""}">${ICONE[k] || ""}${t}</button>`).join("")}</nav>
        <div class="fn-usuario"><span class="fn-av">${esc((st.email[0] || "?").toUpperCase())}</span><div><b>${esc(st.email)}</b><small>${st.dona ? "Mari" : "acesso liberado"}</small></div><button class="fn-icone" type="button" data-sair title="Sair" aria-label="Sair">${ICONE.sair}</button></div>
      </aside>
      <main class="fn-principal">
        <div class="fn-celular-topo"><b class="fn-dono">${esc(p.nome)}</b><button class="fn-icone" type="button" data-olho aria-label="Esconder valores">${ICONE.olho}</button><button class="fn-icone" type="button" data-sair aria-label="Sair">${ICONE.sair}</button></div>
        <div class="fn-topo"><div><h1>${st.aba === "dash" ? (st.atual === "mari" ? "Oi, Mari! 💜" : "Oi, Eduardo! 💙") : `${TITULO[st.aba]} <em>${esc(p.curto)}</em>`}</h1><p>${st.aba === "dash" ? `Bom momento para cuidar das suas finanças · ${MESES[st.ref.m]} de ${st.ref.y}` : st.aba === "acesso" ? "Quem pode entrar nas finanças" : st.aba === "anual" ? `Orçamento de ${st.ref.y}, mês a mês` : `${MESES[st.ref.m]} de ${st.ref.y}`}</p></div>
          <div class="fn-topo-acoes">${st.aba === "anual" ? `<div class="fn-mes"><button type="button" data-mes="-12" aria-label="Ano anterior">‹</button><span>${st.ref.y}</span><button type="button" data-mes="12" aria-label="Próximo ano">›</button></div>` : ""}${st.aba !== "acesso" && st.aba !== "anual" ? `<div class="fn-mes"><button type="button" data-mes="-1" aria-label="Mês anterior">‹</button><span>${MESES[st.ref.m]} ${st.ref.y}</span><button type="button" data-mes="1" aria-label="Próximo mês">›</button></div>
            <button class="fn-btn" type="button" data-novo="saida">${ICONE.sai}Saída</button><button class="fn-btn principal" type="button" data-novo="entrada">${ICONE.entra}Entrada</button>` : ""}<button class="fn-icone" type="button" data-olho title="Esconder valores" aria-label="Esconder valores">${ICONE.olho}</button></div></div>
        <div id="fn-conteudo">${{ dash: telaDash, entradas: () => telaMovimento("entrada"), saidas: () => telaMovimento("saida"), cartoes: telaCartoes, emprestimos: telaEmprestimos, reserva: telaReserva, anual: telaAnual, acesso: telaAcesso }[st.aba]()}</div>
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
    const cats = {}; saidas(lm).forEach((l) => { cats[l.categoria || "Outros"] = (cats[l.categoria || "Outros"] || 0) + Number(l.valor || 0); });
    const listaCats = Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v })), top = listaCats.slice(0, 5); if (listaCats.length > 5) top.push({ k: "Outros", v: listaCats.slice(5).reduce((a, x) => a + x.v, 0) });
    const proximos = d.lancamentos.filter((l) => l.tipo === "saida" && !l.pago).filter((l) => { const dias = (new Date(l.data + "T00:00:00") - new Date(hojeIso() + "T00:00:00")) / 864e5; return dias <= 30; }).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 7);
    const dE = delta(ent, entA), dS = delta(sai, saiA, true);
    return `<div class="fn-kpis">
        ${kpi("Entrou no mês", R$(ent), "entra", `${R$(soma(entradas(lm).filter((l) => !l.pago)))} a receber`, "", dE)}
        ${kpi("Saiu no mês", R$(sai), "sai", `${R$(soma(saidas(lm).filter((l) => !l.pago)))} a pagar`, "", dS)}
        ${kpi(sobra >= 0 ? "Sobrou no mês" : "Faltou no mês", R$(sobra), "carteira", "entradas menos saídas", sobra >= 0 ? "destaque" : "ruim")}
        ${kpi("Dívida total", R$(divTotal), "queda", `${dividas.length} dívida${dividas.length === 1 ? "" : "s"} aberta${dividas.length === 1 ? "" : "s"}`)}
        ${kpi("Livre das dívidas", !dividas.length ? "Sem dívidas 🎉" : p.meses === null ? "+10 anos" : mesDaqui(p.meses), "bandeira", p.meses ? `${p.meses} meses no plano` : "", "bom")}
      </div>
      <div class="fn-grade">
        <div class="fn-caixa"><div class="fn-cab"><div><h3>Entrou x saiu em ${st.ref.y}</h3><p class="sub">Toque num mês para ver os detalhes</p></div></div>
          <div class="fn-barras">${anos.map((x) => `<div class="col${x.i === st.ref.m ? " atual" : ""}" data-ir-mes="${x.i}" title="Entrou ${R$(x.e)} · Saiu ${R$(x.s)}"><b style="color:${x.e - x.s >= 0 ? "#4f7a54" : "#b8473a"}">${x.e || x.s ? K(x.e - x.s) : ""}</b><div class="par"><i style="height:${(x.e / max * 100).toFixed(1)}%;background:${x.i === st.ref.m ? "#6b4a35" : "#cdb39b"}"></i><i style="height:${(x.s / max * 100).toFixed(1)}%;background:${x.i === st.ref.m ? "#a87058" : "#e7c9b6"}"></i></div><span>${x.n}</span></div>`).join("")}</div>
          <div class="fn-legenda"><span><i style="background:#6b4a35"></i>entrou</span><span><i style="background:#a87058"></i>saiu</span><span>número em cima = sobrou ou faltou</span></div></div>
        <div class="fn-caixa"><h3>Reserva de segurança</h3><p class="sub">Meta: ${d.reserva.metaMeses || 6} meses de gastos</p>
          <div class="fn-anel">${anel(meta ? res / meta : 0, meta ? Math.min(100, Math.round(res / meta * 100)) + "%" : "–")}<div><div class="fn-kpi-v" style="margin:0">${R$(res)}</div><small style="color:var(--suave)">de ${R$(meta)}</small><div style="margin-top:10px"><button class="fn-btn pequeno" type="button" data-aba="reserva">Ver reserva e investimentos</button></div></div></div></div>
      </div>
      <div class="fn-grade tres">
        <div class="fn-caixa"><h3>Para onde foi o dinheiro</h3><p class="sub">Saídas de ${MESES[st.ref.m].toLowerCase()} por tipo</p>${top.length ? `<div class="fn-rosca">${rosca(top, sai, K(sai))}<ul>${top.map((c, i) => `<li><i style="background:${CORES[i % CORES.length]}"></i><span>${esc(c.k)}</span><b>${Math.round(c.v / Math.max(sai, 1) * 100)}%</b></li>`).join("")}</ul></div>` : `<p class="fn-vazio">Nenhuma saída neste mês.</p>`}</div>
        <div class="fn-caixa"><h3>Próximos vencimentos</h3><p class="sub">O que falta pagar (vencidos e próximos 30 dias)</p><div class="fn-lista">${proximos.map((l) => `<div class="fn-item"><div class="x"><b>${esc(l.descricao)}</b><small>${dataBR(l.data)}${vencido(l) ? " · vencido" : ""}</small></div><span class="fn-valor sai">${R$(l.valor)}</span><button class="fn-icone" type="button" data-pagar="${esc(l.id)}" title="Marcar como pago" aria-label="Marcar como pago">${ICONE.check}</button></div>`).join("") || `<p class="fn-vazio">Nada para pagar agora.</p>`}</div></div>
        <div class="fn-caixa"><h3>Ações rápidas</h3><p class="sub">Lance na hora, do celular</p><div class="fn-par" style="grid-template-columns:1fr 1fr;gap:10px">
          <button class="fn-btn" type="button" data-novo="entrada">${ICONE.entra}Entrada</button><button class="fn-btn" type="button" data-novo="saida">${ICONE.sai}Saída</button>
          <button class="fn-btn" type="button" data-nova-compra>${ICONE.cartoes}Compra no cartão</button><button class="fn-btn" type="button" data-novo-emp>${ICONE.emprestimos}Empréstimo</button></div></div>
      </div>
      ${blocoConsultora(conselhosGerais())}
      ${blocoPlano(dividas, p)}
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
      ${blocoConsultora(conselhosCartoes(), "Consultora: cartões")}
      <div class="fn-cab" style="margin-bottom:12px"><p class="fn-dica">Lance cada compra no cartão: ela soma sozinha na fatura. No fim do mês, digite o valor que veio no banco para conferir.</p><div class="fn-acoes"><button class="fn-btn" type="button" data-min-todos="c">Minimizar / abrir todos</button><button class="fn-btn" type="button" data-novo-cartao>${ICONE.mais}Novo cartão</button><button class="fn-btn principal" type="button" data-nova-compra>${ICONE.mais}Compra no cartão</button></div></div>
      <div class="fn-cartoes">${[...cs].sort((a, b) => dividaCartao(b) - dividaCartao(a)).map((c) => {
        const uso = Number(c.limite) > 0 ? Math.max(0, Math.min(1, 1 - dispCartao(c) / Number(c.limite))) : null;
        const fat = lm.find((l) => eDoCartao(l, c));
        return `<div class="fn-plast${minimo("c" + c.id, c.status === "Quitado") ? " min" : ""}${c.status === "Quitado" ? " quitado" : /atras/i.test(c.status || "") ? " atraso" : ""}"><div class="frente"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>${esc(c.nome)}</b><span class="fn-chip neutro" style="background:rgba(255,255,255,.22);color:#fff">${esc(c.status || "Ativo")}</span></div><span class="num">•••• •••• •••• ${esc(c.final || "")}</span><div style="display:flex;justify-content:space-between"><small>${c.vencimento ? "vence dia " + esc(c.vencimento) : "sem vencimento"}${c.juros ? " · " + String(c.juros).replace(".", ",") + "% a.m." : ""}</small><small>disponível ${R$(dispCartao(c))}</small></div></div>
          ${uso !== null ? `<div><div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--suave);margin-bottom:4px"><span>Limite usado</span><span>${Math.round(uso * 100)}% de ${R$(c.limite)}</span></div><div class="fn-barra"><i style="width:${(uso * 100).toFixed(1)}%;background:${uso > 0.8 ? "#b8473a" : uso > 0.3 ? "#a87058" : "#4f7a54"}"></i></div></div>` : ""}
          <div class="fn-par"><span>Fatura de ${MES3[st.ref.m].toLowerCase()}<b>${fat ? R$(fat.valor) : "–"}</b></span><span>Situação<b>${fat ? (fat.pago ? "Paga" : vencido(fat) ? "Vencida" : "A pagar") : "–"}</b></span><span>Próxima fatura<b>${R$(c.proximaFatura)}</b></span><span>Falta pagar<b>${R$(dividaCartao(c))}</b></span></div>
          ${c.status !== "Quitado" || comprasDaFatura(c, st.ref.y, st.ref.m).length ? blocoCompras(c) : ""}
          <div class="fn-resumo"><span>Fatura de ${MES3[st.ref.m].toLowerCase()}<b>${fat ? R$(fat.valor) : "–"}</b></span><span>Falta pagar<b>${R$(dividaCartao(c))}</b></span></div>
          <div class="fn-acoes">${botaoMin("c" + c.id, c.status === "Quitado")}${fat ? `<button class="fn-btn pequeno" type="button" data-pagar="${esc(fat.id)}">${ICONE.check}${fat.pago ? "Desmarcar" : "Paguei a fatura"}</button>` : `<button class="fn-btn pequeno" type="button" data-fatura="${esc(c.id)}">${ICONE.mais}Lançar fatura</button>`}<button class="fn-icone" type="button" data-editar-c="${esc(c.id)}" aria-label="Editar">${ICONE.lapis}</button></div></div>`;
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
  function blocoCompras(c) {
    const ks = comprasDaFatura(c, st.ref.y, st.ref.m).sort((a, b) => String(b.data).localeCompare(String(a.data))), somado = ks.reduce((a, k) => a + k.parte.valor, 0);
    const ym = ymDe(st.ref.y, st.ref.m), conf = (c.conferidas || {})[ym], dif = conf != null ? Math.round((conf - somado) * 100) / 100 : null;
    return `<div class="fn-compras"><div class="fn-cab"><b>Compras na fatura de ${MES3[st.ref.m].toLowerCase()}</b><button class="fn-btn pequeno" type="button" data-nova-compra="${esc(c.id)}">${ICONE.mais}Compra</button></div>
      ${ks.map((k) => `<div class="fn-item"><div class="x"><b>${esc(k.descricao)}</b><small>${dataBR(k.data)}${k.parte.de > 1 ? ` · parcela ${k.parte.n} de ${k.parte.de}` : ""}</small></div><span class="fn-valor">${R$(k.parte.valor)}</span><button class="fn-icone" type="button" data-editar-compra="${esc(k.id)}" aria-label="Editar compra">${ICONE.lapis}</button></div>`).join("") || `<p class="fn-vazio">Nenhuma compra lançada nesta fatura.</p>`}
      <div class="fn-conferir"><span>Somado: <b>${R$(somado)}</b></span><label>Veio no banco <input class="fn-entrada" inputmode="decimal" data-conferir="${esc(c.id)}" value="${conf != null ? esc(Number(conf).toLocaleString("pt-BR", { minimumFractionDigits: 2 })) : ""}" placeholder="0,00"></label></div>
      ${dif === null ? "" : Math.abs(dif) < 0.01 ? `<p class="fn-bateu ok">✓ Bateu certinho com o banco.</p>` : `<p class="fn-bateu mal">${dif > 0 ? `O banco cobrou ${R$(dif)} a mais do que você lançou. Falta lançar alguma compra ou tem cobrança indevida.` : `O banco cobrou ${R$(-dif)} a menos. Confira se alguma compra caiu na próxima fatura.`} A fatura usa o valor do banco.</p>`}</div>`;
  }
  function telaMovimento(tipo) {
    const ent = tipo === "entrada", lm = doMes(st.ref.y, st.ref.m).filter((l) => l.tipo === tipo), ant = new Date(st.ref.y, st.ref.m - 1, 1), la = doMes(ant.getFullYear(), ant.getMonth()).filter((l) => l.tipo === tipo);
    const total = soma(lm), feito = soma(lm.filter((l) => l.pago)), ano = D().lancamentos.filter((l) => l.tipo === tipo && String(l.data).startsWith(st.ref.y + "-"));
    const mesesComValor = new Set(ano.map((l) => l.data.slice(5, 7))).size || 1;
    const porCat = {}; lm.forEach((l) => { porCat[l.categoria || "Outros"] = (porCat[l.categoria || "Outros"] || 0) + (Number(l.valor) || 0); });
    const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
    const atalhos = ent ? ["Salário", "Vale", "Renda extra"] : ["Conta fixa", "Mercado", "Dívida pessoal"];
    return `<div class="fn-kpis">
        ${kpi(ent ? "Entrou no mês" : "Saiu no mês", R$(total), ent ? "entra" : "sai", `${lm.length} lançamento${lm.length === 1 ? "" : "s"}`, "destaque", delta(total, soma(la), !ent))}
        ${kpi(ent ? "Já recebido" : "Já pago", R$(feito), "check", "")}
        ${kpi(ent ? "Falta receber" : "Falta pagar", R$(total - feito), "bandeira", "", total - feito > 0 && !ent ? "ruim" : "")}
        ${kpi(`Total em ${st.ref.y}`, R$(soma(ano)), "anual", `média de ${R$(soma(ano) / mesesComValor)} por mês`, "bom")}
      </div>
      <div class="fn-grade">
        <div class="fn-caixa"><div class="fn-cab"><div><h3>${ent ? "Entradas" : "Saídas"} de ${MESES[st.ref.m].toLowerCase()}</h3><p class="sub">Toque na situação para marcar como ${ent ? "recebido" : "pago"}</p></div>
          <div class="fn-acoes">${atalhos.map((a) => `<button class="fn-btn pequeno" type="button" data-novo-cat="${a}" data-tipo="${tipo}">${ICONE.mais}${a}</button>`).join("")}${ent ? "" : `<button class="fn-btn pequeno" type="button" data-nova-compra>${ICONE.cartoes}Compra no cartão</button>`}<button class="fn-btn pequeno principal" type="button" data-novo="${tipo}">${ICONE.mais}Outra</button></div></div>
          ${lm.length ? `<div class="fn-rolar"><table class="fn-tabela"><thead><tr><th>Dia</th><th>Descrição</th><th class="esconde">Tipo</th><th>Situação</th><th class="num">Valor</th><th></th></tr></thead><tbody>
          ${[...lm].sort((a, b) => a.data.localeCompare(b.data)).map((l) => `<tr><td>${dataBR(l.data).slice(0, 5)}</td><td>${esc(l.descricao)}${l.auto ? ' <small class="fn-auto">soma das compras</small>' : ""}</td><td class="esconde"><span class="fn-tag">${esc(l.categoria || "")}</span></td><td><button class="fn-chip ${l.pago ? "" : vencido(l) ? "mal" : "amb"}" type="button" data-pagar="${esc(l.id)}" style="border:0;cursor:pointer">${l.pago ? (ent ? "Recebido" : "Pago") : vencido(l) ? "Vencido" : ent ? "A receber" : "A pagar"}</button></td><td class="num"><span class="fn-valor ${ent ? "entra" : "sai"}">${R$(l.valor)}</span></td><td class="num"><button class="fn-icone" type="button" data-editar-l="${esc(l.id)}" aria-label="Editar">${ICONE.lapis}</button></td></tr>`).join("")}
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
  function telaAnual() {
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
    return `<div class="fn-kpis">
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
    $$("[data-tirar-membro]", box).forEach((b) => b.addEventListener("click", async () => { if (!confirm(`Tirar o acesso de ${b.dataset.tirarMembro}?`)) return; await banco.from("financeiro_membros").delete().eq("email", b.dataset.tirarMembro); pintarMembros(); }));
  }

  // ---------- formulários ----------
  function formulario(titulo, campos, valores, aoSalvar, aoApagar) {
    let dlg = $("#fn-janela"); if (!dlg) { dlg = document.createElement("dialog"); dlg.id = "fn-janela"; dlg.className = "fn-janela"; document.body.appendChild(dlg); }
    const campo = (c) => {
      const v = valores[c.k] ?? (c.padrao ?? "");
      if (c.tipo === "select") { const ops = c.opcoes.map((o) => (Array.isArray(o) ? o : [o, o])); if (v !== "" && !ops.some((o) => String(o[0]) === String(v))) ops.unshift([v, v]); return `<div class="fn-campo"><label for="f-${c.k}">${c.rotulo}</label><select class="fn-entrada" id="f-${c.k}">${ops.map(([o, t]) => `<option value="${esc(o)}" ${String(o) === String(v) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div>`; }
      if (c.tipo === "chk") return `<label class="fn-chk"><input type="checkbox" id="f-${c.k}" ${v ? "checked" : ""}> ${c.rotulo}</label>`;
      return `<div class="fn-campo"><label for="f-${c.k}">${c.rotulo}</label><input class="fn-entrada" id="f-${c.k}" ${c.tipo === "data" ? 'type="date"' : c.tipo === "num" ? 'inputmode="decimal"' : 'type="text"'} value="${esc(c.tipo === "num" && v !== "" && v != null ? String(v).replace(".", ",") : v)}" ${c.obrigatorio ? "required" : ""}></div>`;
    };
    const linhas = []; for (let i = 0; i < campos.length; i++) { const c = campos[i]; if (c.meia && campos[i + 1] && campos[i + 1].meia) { linhas.push(`<div class="duplo">${campo(c)}${campo(campos[i + 1])}</div>`); i++; } else linhas.push(campo(c)); }
    dlg.innerHTML = `<form method="dialog" novalidate><h2>${esc(titulo)}</h2>${linhas.join("")}<p class="fn-erro" id="f-erro"></p><div class="rodape">${aoApagar ? `<button class="fn-btn perigo" type="button" id="f-apagar">${ICONE.lixo}Apagar</button><span style="flex:1"></span>` : ""}<button class="fn-btn" type="button" id="f-cancelar">Cancelar</button><button class="fn-btn principal" type="submit">Salvar</button></div></form>`;
    $("#f-cancelar", dlg).addEventListener("click", () => dlg.close());
    if (aoApagar) $("#f-apagar", dlg).addEventListener("click", () => { if (confirm("Apagar mesmo?")) { aoApagar(); dlg.close(); salvar(); pintar(); } });
    $("form", dlg).addEventListener("submit", (e) => {
      e.preventDefault();
      const out = {};
      for (const c of campos) { const el = $("#f-" + c.k, dlg); out[c.k] = c.tipo === "chk" ? el.checked : c.tipo === "num" ? numOuNada(el.value) : el.value.trim(); }
      const falta = campos.find((c) => c.obrigatorio && (out[c.k] === "" || out[c.k] == null));
      if (falta) { $("#f-erro", dlg).textContent = `Preencha: ${falta.rotulo}.`; return; }
      aoSalvar(out); dlg.close(); salvar(); pintar();
    });
    dlg.showModal();
  }
  const camposL = (tipo) => [{ k: "descricao", rotulo: "Descrição", obrigatorio: true }, { k: "valor", rotulo: "Valor (R$)", tipo: "num", obrigatorio: true, meia: true }, { k: "data", rotulo: "Data", tipo: "data", obrigatorio: true, meia: true }, { k: "categoria", rotulo: "Tipo", tipo: "select", opcoes: tipo === "entrada" ? CAT_ENTRADA : CAT_SAIDA }, { k: "pago", rotulo: tipo === "entrada" ? "Já recebi" : "Já paguei", tipo: "chk" }];
  function editarLancamento(l, tipo, pre) {
    const novo = !l; l = l || { id: uid(), tipo, data: hojeIso(), pago: true, categoria: tipo === "entrada" ? "Salário" : "Outros", ...(pre || {}) };
    if (l.auto) { toast("Essa fatura é a soma das compras. Lance ou edite as compras na aba Cartões."); st.aba = "cartoes"; pintar(); return; }
    formulario(novo ? (l.tipo === "entrada" ? "Nova entrada" : "Nova saída") : "Editar lançamento", camposL(l.tipo), l, (v) => {
      const x = { ...l, ...v, valor: Number(v.valor) || 0, atrasado: false };
      const lista = D().lancamentos; const i = lista.findIndex((y) => y.id === x.id); if (i >= 0) lista[i] = x; else lista.push(x);
      toast(novo ? "Lançado." : "Salvo.");
    }, novo ? null : () => { D().lancamentos = D().lancamentos.filter((y) => y.id !== l.id); });
  }
  const CAMPOS_C = [{ k: "nome", rotulo: "Nome do cartão", obrigatorio: true }, { k: "final", rotulo: "Final do cartão (4 números)", meia: true }, { k: "vencimento", rotulo: "Vence dia", meia: true }, { k: "fechamento", rotulo: "Fecha dia (melhor dia de compra)", meia: true }, { k: "limite", rotulo: "Limite", tipo: "num", meia: true }, { k: "disponivel", rotulo: "Disponível (vazio = calculo sozinho)", tipo: "num", meia: true }, { k: "faturaAtual", rotulo: "Fatura atual", tipo: "num", meia: true }, { k: "proximaFatura", rotulo: "Próxima fatura", tipo: "num", meia: true }, { k: "divida", rotulo: "Dívida total (tudo que falta)", tipo: "num", meia: true }, { k: "parcelasFuturas", rotulo: "Parcelas futuras", tipo: "num", meia: true }, { k: "juros", rotulo: "Juros (% ao mês)", tipo: "num", meia: true }, { k: "status", rotulo: "Situação", tipo: "select", opcoes: ["Ativo", "Em redução", "Atrasado", "Quitado"], meia: true }];
  function editarCompra(k, cartaoId) {
    const d = D(), abertos = d.cartoes.filter((c) => c.status !== "Quitado"), lista = abertos.length ? abertos : d.cartoes;
    if (!lista.length) { toast("Cadastre um cartão primeiro."); editarCartao(null); return; }
    const novo = !k; k = k || { id: uid(), cartao: cartaoId || lista[0].id, data: hojeIso(), parcelas: 1 };
    formulario(novo ? "Compra no cartão" : "Editar compra", [{ k: "cartao", rotulo: "Cartão", tipo: "select", opcoes: d.cartoes.map((c) => [c.id, c.nome]) }, { k: "descricao", rotulo: "Onde / o quê (ex.: Mercado Extra)", obrigatorio: true }, { k: "valor", rotulo: "Valor total (R$)", tipo: "num", obrigatorio: true, meia: true }, { k: "parcelas", rotulo: "Parcelas", tipo: "num", meia: true }, { k: "data", rotulo: "Data da compra", tipo: "data", obrigatorio: true }], k, (v) => {
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
    formulario(`Editar "${nomeL}" em ${y}`, [{ k: "descricao", rotulo: "Nome", obrigatorio: true }, { k: "categoria", rotulo: "Tipo", tipo: "select", opcoes: tipo === "entrada" ? CAT_ENTRADA : CAT_SAIDA }, { k: "valor", rotulo: "Novo valor por mês (vazio = não muda)", tipo: "num", meia: true }, { k: "dia", rotulo: "Novo dia (vazio = não muda)", tipo: "num", meia: true }, { k: "de", rotulo: "Mudar de", tipo: "select", opcoes: meses, meia: true }, { k: "ate", rotulo: "Até", tipo: "select", opcoes: meses, meia: true }],
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
    formulario(`${st.anoAba === "entrada" ? "Entrada" : "Despesa"} em ${st.ref.y}`, [{ k: "tipo", rotulo: "É", tipo: "select", opcoes: [["saida", "Despesa"], ["entrada", "Renda"]], meia: true }, { k: "dia", rotulo: "Dia do mês", tipo: "num", meia: true }, { k: "descricao", rotulo: "Nome (ex.: Claro Móvel, Salário)", obrigatorio: true }, { k: "valor", rotulo: "Valor por mês (R$)", tipo: "num", obrigatorio: true, meia: true }, { k: "categoria", rotulo: "Tipo", tipo: "select", opcoes: [...new Set([...CAT_SAIDA, ...CAT_ENTRADA])], meia: true }, { k: "de", rotulo: "De", tipo: "select", opcoes: meses, meia: true }, { k: "ate", rotulo: "Até", tipo: "select", opcoes: meses, meia: true }],
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

  // ---------- eventos ----------
  function ligar() {
    const raiz = $("#raiz"), d = D(), acha = (lista, id) => (lista || []).find((x) => String(x.id) === String(id));
    $$("[data-aba]", raiz).forEach((b) => b.addEventListener("click", () => { st.aba = b.dataset.aba; pintar(); window.scrollTo(0, 0); }));
    $$("[data-min]", raiz).forEach((b) => b.addEventListener("click", () => { MIN[b.dataset.min] = !minimo(b.dataset.min, b.dataset.padrao === "1"); guardarMin(); pintar(); }));
    $$("[data-min-todos]", raiz).forEach((b) => b.addEventListener("click", () => {
      const pre = b.dataset.minTodos, lista = pre === "c" ? d.cartoes : d.emprestimos, ids = lista.map((x) => pre + x.id);
      const fechar = ids.some((id, i) => !minimo(id, lista[i].status === "Quitado"));
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
    $$("[data-pagar]", raiz).forEach((b) => b.addEventListener("click", () => { const l = acha(d.lancamentos, b.dataset.pagar); if (!l) return; l.pago = !l.pago; l.atrasado = false; salvar(); pintar(); toast(l.pago ? "Marcado como pago." : "Voltou para a pagar."); }));
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
    $$("[data-novo-cat]", raiz).forEach((b) => b.addEventListener("click", () => editarLancamento(null, b.dataset.tipo, { categoria: b.dataset.novoCat, descricao: b.dataset.novoCat === "Conta fixa" ? "" : b.dataset.novoCat })));
    $$("[data-grupo]", raiz).forEach((b) => b.addEventListener("click", () => { st.anoAbertos[b.dataset.grupo] = b.getAttribute("aria-expanded") !== "true"; pintar(); }));
    $$("[data-ano-aba]", raiz).forEach((b) => b.addEventListener("click", () => { st.anoAba = b.dataset.anoAba; pintar(); }));
    $$("[data-linha]", raiz).forEach((b) => b.addEventListener("click", () => { const [tipo, nomeL] = b.dataset.linha.split("|"); editarLinha(tipo, nomeL); }));
    $$("[data-mov-res]", raiz).forEach((b) => b.addEventListener("click", () => movReserva(b.dataset.movRes)));
    $$("[data-apagar-mov]", raiz).forEach((b) => b.addEventListener("click", () => {
      const rs = d.reserva, m = (rs.movs || []).find((x) => x.id === b.dataset.apagarMov); if (!m || !confirm("Apagar esse movimento? O valor volta para a reserva como estava.")) return;
      rs.atual = Math.round(((Number(rs.atual) || 0) + (m.tipo === "saque" ? m.valor : -m.valor)) * 100) / 100; rs.movs = rs.movs.filter((x) => x !== m); salvar(); pintar();
    }));
    $$("[data-linha-fixa]", raiz).forEach((b) => b.addEventListener("click", contaFixaNoAno));
    $$("[data-celula]", raiz).forEach((b) => b.addEventListener("click", () => {
      const [tipo, nomeL, cat, m, dia] = b.dataset.celula.split("|"), ym = ymDe(st.ref.y, Number(m));
      const ls = d.lancamentos.filter((x) => x.tipo === tipo && (x.descricao || "").trim().toLowerCase() === nomeL.trim().toLowerCase() && String(x.data).startsWith(ym)), l = ls[0];
      if (ls.length > 1) folha(`${nomeL} em ${MESES[Number(m)]}`, ls.map((x) => ({ ic: ICONE.lapis, t: `${dataBR(x.data).slice(0, 5)} · ${R$(x.valor)}`, acao: () => editarLancamento(x) })));
      else if (l) editarLancamento(l); else editarLancamento(null, tipo, { descricao: nomeL, categoria: cat || (tipo === "entrada" ? "Salário" : "Outros"), data: `${ym}-${String(Math.min(28, Math.max(1, Number(dia) || 10))).padStart(2, "0")}`, pago: false });
    }));
    $$("[data-metodo]", raiz).forEach((b) => b.addEventListener("click", () => { st.metodo = b.dataset.metodo; pintar(); }));
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
  iniciar();
  window.financeiroApp = { estado: st, conselhosGerais, plano }; // usado nos testes
})();
