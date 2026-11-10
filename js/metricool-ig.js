// =========================================================
// INSTAGRAM PELO METRICOOL (nov/2026, depois da restrição de anúncios da Meta em 09/11/2026)
// O painel NÃO fala mais com a API da Meta nem guarda token do Instagram. Os números vêm do
// Metricool (parceiro oficial da Meta, conectado pela própria Mari no site do Metricool).
// Uma tarefa agendada do Claude lê o Metricool 1x por dia e grava o resultado em
// configuracoes chave "metricool_instagram" = {fonte, username, atualizadoEm,
//   ev: linhas diárias [IGEV01 seguidores, IGEV05 views, IGEV06 alcance, IGEV38 interações,
//                       IGEV42 contas engajadas, IGEV43 novos, IGEV44 deixaram, IGEV37 posts, AAAAMMDD],
//   reels: [IGRE02 data/hora, IGRE03 legenda, IGRE06 link, IGRE11 alcance, IGRE23 views,
//           IGRE09 interações, IGRE12 salvos, IGRE21 compartilhamentos]}
// Usado pelo Dashboard (admin/gestao) e por Conteúdo > Métricas do Instagram (js/metricas.js).
// =========================================================
(function () {
  "use strict";
  const n = (v) => (v == null || v === "" || isNaN(Number(v)) ? null : Math.round(Number(v)));
  const iso = (s) => `${String(s).slice(0, 4)}-${String(s).slice(4, 6)}-${String(s).slice(6, 8)}`;
  const soma = (arr, k) => { const v = arr.map((d) => d[k]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) : null; };
  const variacao = (a, b) => (a == null || b == null || !b ? null : Math.round(((a - b) / b) * 1000) / 10);

  function normalizar(bruto) {
    let j = bruto;
    if (typeof j === "string") { try { j = JSON.parse(j); } catch (e) { return null; } }
    if (!j || !Array.isArray(j.ev)) return null;
    const dias = j.ev.map((r) => ({ data: iso(r[8]), seguidores: n(r[0]), views: n(r[1]), alcance: n(r[2]), interacoes: n(r[3]), engajadas: n(r[4]), novos: n(r[5]), deixaram: n(r[6]), posts: n(r[7]) }))
      .sort((a, b) => a.data.localeCompare(b.data));
    const reels = (j.reels || []).map((r) => ({ data: iso(r[0]), legenda: String(r[1] || ""), link: r[2] || "", alcance: n(r[3]), views: n(r[4]), interacoes: n(r[5]), salvos: n(r[6]), compart: n(r[7]) }))
      .sort((a, b) => b.data.localeCompare(a.data));
    return { fonte: j.fonte || "Metricool", username: j.username || "", atualizadoEm: j.atualizadoEm || "", dias, reels };
  }

  // período dos últimos N dias que têm dado, comparado com os N dias antes
  function periodo(d, qtd) {
    if (!d || !d.dias.length) return null;
    const fim = d.dias[d.dias.length - 1].data;
    const menos = (s, k) => { const t = new Date(s + "T12:00:00"); t.setDate(t.getDate() - k); return t.toISOString().slice(0, 10); };
    const de = menos(fim, qtd - 1), deAnt = menos(fim, 2 * qtd - 1), ateAnt = menos(fim, qtd);
    // dias sem nenhuma atividade não vêm na lista: entram como zero para o gráfico não pular dias
    const porData = Object.fromEntries(d.dias.map((x) => [x.data, x]));
    const faixa = (a, b) => { const out = []; for (let k = 0; ; k++) { const dt = menos(a, -k); if (dt > b) break; out.push(porData[dt] || { data: dt, novos: 0, deixaram: 0, views: 0 }); } return out; };
    const atual = faixa(de, fim);
    const ant = faixa(deAnt, ateAnt);
    const comSeg = d.dias.filter((x) => x.seguidores != null);
    const t = (arr) => ({ alcance: soma(arr, "alcance"), views: soma(arr, "views"), interacoes: soma(arr, "interacoes"), engajadas: soma(arr, "engajadas"), novos: soma(arr, "novos"), deixaram: soma(arr, "deixaram"), posts: soma(arr, "posts") });
    const A = t(atual), B = t(ant);
    const eng = (x) => (x.alcance && x.engajadas != null ? Math.round((x.engajadas / x.alcance) * 1000) / 10 : null);
    return {
      conectado: true, fonte: d.fonte, username: d.username, atualizadoEm: d.atualizadoEm, de, ate: fim,
      seguidores: comSeg.length ? comSeg[comSeg.length - 1].seguidores : null,
      novos: A.novos, deixaram: A.deixaram, posts: A.posts,
      alcance: A.alcance, alcanceVar: variacao(A.alcance, B.alcance),
      views: A.views, viewsVar: variacao(A.views, B.views),
      interacoes: A.interacoes, interacoesVar: variacao(A.interacoes, B.interacoes),
      engajadas: A.engajadas,
      alcanceDesde: (atual.find((x) => x.alcance != null) || {}).data || null, // o Metricool só tem alcance desde que foi conectado
      engajamento: eng(A), engajamentoVar: eng(A) != null && eng(B) != null ? Math.round((eng(A) - eng(B)) * 10) / 10 : null,
      viewsDia: atual.map((x) => ({ data: x.data, valor: x.views || 0 })),
      novosDia: atual.map((x) => ({ data: x.data, valor: x.novos || 0 })),
      reels: d.reels.filter((r) => r.data >= de),
    };
  }

  async function ler(cliente) {
    const { data, error } = await cliente.from("configuracoes").select("valor,updated_at").eq("chave", "metricool_instagram").maybeSingle();
    if (error) throw error;
    return data ? normalizar(data.valor) : null;
  }

  window.metricoolIG = { ler, normalizar, periodo };
})();
