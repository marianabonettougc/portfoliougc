// =========================================================
// INSTAGRAM NO DASHBOARD (Edge Function do Supabase)
// Lê os números do perfil da Mari pela API OFICIAL da Meta (Instagram API com login do Instagram,
// graph.instagram.com). Só leitura: não posta, não segue, não curte, não pede senha.
// O token fica guardado só no banco (tabela integracoes, chave "instagram", que só o servidor lê),
// nunca no site nem no GitHub.
// Ações (POST): { acao: "dados", dias: 7|14|30 } | { acao: "metricas", dias: 30|90 } | { acao: "salvar", token } | { acao: "remover" } | { acao: "status" }
// Só a dona do painel pode usar.
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const EMAIL_DONA = "marianabonettougc@gmail.com";
const CHAVE = "instagram";
const API_IG = "https://graph.instagram.com/v23.0";
const API_FB = "https://graph.facebook.com/v23.0";
// Dois tipos de token funcionam:
//  - "IGAA..." (API do Instagram com login do Instagram) -> graph.instagram.com, nó "me"
//  - "EAA..."  (login do Facebook / Explorador da Graph API) -> graph.facebook.com, nó = id da conta do Instagram ligada à página
type Alvo = { api: string; no: string };
const ehFacebook = (t: string) => /^EAA/.test(t);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

let ALVO: Alvo = { api: API_IG, no: "me" };
async function ig(caminho: string, token: string, params: Record<string, string | number> = {}) {
  const u = new URL(ALVO.api + caminho.replace(/^\/me(?=\/|$)/, "/" + ALVO.no));
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  u.searchParams.set("access_token", token);
  const r = await fetch(u);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const msg = j?.error?.message || ("Erro " + r.status);
    const e = new Error(msg) as Error & { codigo?: number };
    e.codigo = j?.error?.code;
    throw e;
  }
  return j;
}
// token do Facebook: acha a conta do Instagram profissional ligada a uma página
async function alvoFacebook(token: string): Promise<{ alvo: Alvo; username: string }> {
  const r = await fetch(`${API_FB}/me/accounts?fields=name,instagram_business_account{id,username}&limit=100&access_token=${encodeURIComponent(token)}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j?.error?.message || ("Erro " + r.status));
  const pg = (j.data || []).find((p: any) => p.instagram_business_account?.id);
  if (!pg) throw new Error("esse token não tem acesso a nenhuma conta do Instagram profissional ligada a uma página do Facebook. Ao gerar, marque instagram_basic, instagram_manage_insights, pages_show_list e pages_read_engagement e escolha a página ligada ao seu Instagram.");
  return { alvo: { api: API_FB, no: pg.instagram_business_account.id }, username: pg.instagram_business_account.username || "" };
}
const hojeBR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const unix = (iso: string) => Math.floor(new Date(iso + "T03:00:00Z").getTime() / 1000);
const somarDias = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// total de uma métrica no período (metric_type=total_value)
async function totais(token: string, metricas: string[], de: string, ate: string) {
  const out: Record<string, number | null> = {};
  await Promise.all(metricas.map(async (m) => {
    try {
      const j = await ig("/me/insights", token, { metric: m, period: "day", metric_type: "total_value", since: unix(de), until: unix(ate) });
      out[m] = j?.data?.[0]?.total_value?.value ?? null;
    } catch { out[m] = null; }
  }));
  return out;
}
// série por dia de uma métrica (follower_count e reach aceitam)
async function serie(token: string, metrica: string, de: string, ate: string) {
  try {
    const j = await ig("/me/insights", token, { metric: metrica, period: "day", since: unix(de), until: unix(ate) });
    return (j?.data?.[0]?.values || []).map((v: any) => ({ data: String(v.end_time || "").slice(0, 10), valor: Number(v.value || 0) }));
  } catch { return []; }
}
async function deixaram(token: string, de: string, ate: string) {
  try {
    const j = await ig("/me/insights", token, { metric: "follows_and_unfollows", period: "day", metric_type: "total_value", breakdown: "follow_type", since: unix(de), until: unix(ate) });
    const res = j?.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
    const un = res.find((x: any) => (x.dimension_values || []).includes("NON_FOLLOWER"));
    return un ? Number(un.value || 0) : null;
  } catch { return null; }
}
const variacao = (a: number | null, b: number | null) => (a == null || b == null || !b) ? null : Math.round((a - b) / b * 1000) / 10;

// ---------------------------------------------------------
// MÉTRICAS DO INSTAGRAM (aba #metricas, nov/2026)
// acao "metricas" { dias: 30 | 90, forcar }: totais do período e do período anterior, alcance por dia,
// seguidores x não seguidores, toques no link, público e cada post com os números dele.
// A Meta só aceita 30 dias por pedido de insights, então períodos maiores são somados em pedaços de 30.
// ---------------------------------------------------------
let ERRO_META = ""; // primeiro erro da Meta nos insights (ex.: permissão faltando), mostrado na aba
function pedacos(de: string, ate: string) {
  const out: [string, string][] = [];
  let ini = de;
  while (ini < ate) {
    let fim = somarDias(ini, 30);
    if (fim > ate) fim = ate;
    out.push([ini, fim]);
    ini = fim;
  }
  return out;
}
async function totalPeriodo(token: string, metrica: string, de: string, ate: string, breakdown = "") {
  let soma: number | null = null;
  const partes: Record<string, number> = {};
  for (const [a, b] of pedacos(de, ate)) {
    try {
      const p: Record<string, string | number> = { metric: metrica, period: "day", metric_type: "total_value", since: unix(a), until: unix(b) };
      if (breakdown) p.breakdown = breakdown;
      const j = await ig("/me/insights", token, p);
      const tv = j?.data?.[0]?.total_value;
      if (tv?.value != null) soma = (soma || 0) + Number(tv.value);
      for (const r of tv?.breakdowns?.[0]?.results || []) {
        const k = (r.dimension_values || []).join("|") || "outro";
        partes[k] = (partes[k] || 0) + Number(r.value || 0);
      }
    } catch (e) { if (!ERRO_META) ERRO_META = (e as Error).message; }
  }
  return { total: soma, partes };
}
async function serieLonga(token: string, metrica: string, de: string, ate: string) {
  const out: { data: string; valor: number }[] = [];
  for (const [a, b] of pedacos(de, ate)) out.push(...await serie(token, metrica, a, b));
  const visto = new Set<string>();
  return out.filter((x) => (visto.has(x.data) ? false : (visto.add(x.data), true))).sort((x, y) => x.data.localeCompare(y.data));
}
async function insightsPost(token: string, m: any) {
  const reel = m.media_product_type === "REELS";
  const listas = reel
    ? ["reach,views,likes,comments,saved,shares,total_interactions,ig_reels_avg_watch_time", "reach,views,likes,comments,saved,shares,total_interactions", "reach,likes,comments,saved,shares"]
    : ["reach,views,likes,comments,saved,shares,total_interactions,profile_visits,follows", "reach,views,likes,comments,saved,shares,total_interactions", "reach,likes,comments,saved,shares"];
  for (const metric of listas) {
    try {
      const j = await ig(`/${m.id}/insights`, token, { metric });
      const o: Record<string, number> = {};
      for (const d of j?.data || []) o[d.name] = Number(d?.values?.[0]?.value ?? d?.total_value?.value ?? 0);
      return o;
    } catch (e) { if (!ERRO_META) ERRO_META = (e as Error).message; }
  }
  return {};
}
async function postsDoPeriodo(token: string, desde: string) {
  const campos = "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count";
  const lista: any[] = [];
  let after = "";
  for (let i = 0; i < 6; i++) {
    const p: Record<string, string | number> = { fields: campos, limit: 50 };
    if (after) p.after = after;
    const j = await ig("/me/media", token, p);
    const dados = j?.data || [];
    lista.push(...dados);
    after = j?.paging?.cursors?.after || "";
    const ultimo = dados[dados.length - 1];
    if (!after || !j?.paging?.next || !ultimo || String(ultimo.timestamp).slice(0, 10) < desde) break;
  }
  const doPeriodo = lista.filter((m) => String(m.timestamp).slice(0, 10) >= desde);
  const out: any[] = [];
  for (let i = 0; i < doPeriodo.length; i += 8) {
    const lote = doPeriodo.slice(i, i + 8);
    const ins = await Promise.all(lote.map((m) => insightsPost(token, m)));
    lote.forEach((m, k) => {
      const n = ins[k] || {};
      const formato = m.media_product_type === "REELS" ? "Reels" : m.media_type === "CAROUSEL_ALBUM" ? "Carrossel" : m.media_type === "VIDEO" ? "Vídeo" : "Foto";
      const curtidas = n.likes ?? m.like_count ?? 0, comentarios = n.comments ?? m.comments_count ?? 0;
      const interacoes = n.total_interactions ?? (curtidas + comentarios + (n.saved || 0) + (n.shares || 0));
      out.push({
        id: m.id, link: m.permalink, capa: m.thumbnail_url || m.media_url || "", legenda: String(m.caption || "").slice(0, 400),
        data: m.timestamp, formato,
        alcance: n.reach ?? null, views: n.views ?? null, curtidas, comentarios, salvos: n.saved ?? null, compart: n.shares ?? null,
        interacoes, visitasPerfil: n.profile_visits ?? null, seguiram: n.follows ?? null,
        tempoMedio: n.ig_reels_avg_watch_time != null ? Math.round(n.ig_reels_avg_watch_time / 100) / 10 : null,
        engaj: n.reach ? Math.round(interacoes / n.reach * 1000) / 10 : null,
      });
    });
  }
  return out;
}
async function publico(token: string) {
  const out: Record<string, { nome: string; valor: number }[]> = {};
  for (const b of ["age", "gender", "city"]) {
    for (const extra of [{}, { timeframe: "this_month" }]) {
      try {
        const j = await ig("/me/insights", token, { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", breakdown: b, ...extra });
        const res = j?.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
        out[b] = res.map((r: any) => ({ nome: (r.dimension_values || []).join(" "), valor: Number(r.value || 0) })).sort((x: any, y: any) => y.valor - x.valor);
        break;
      } catch { /* tenta com timeframe */ }
    }
  }
  return out;
}
async function metricasCompletas(token: string, dias: number, v: any) {
  ERRO_META = "";
  const ate = hojeBR(), de = somarDias(ate, -dias), dePrev = somarDias(de, -dias);
  const perfil = await ig("/me", token, { fields: "username,name,profile_picture_url,followers_count,follows_count,media_count" });
  const nomes = ["reach", "views", "accounts_engaged", "total_interactions", "likes", "comments", "saves", "shares", "profile_links_taps"];
  const [atual, anterior, alcanceSeg, viewsFmt, seguem, alcanceDia, seguidoresDia, posts, pub] = await Promise.all([
    Promise.all(nomes.map((n) => totalPeriodo(token, n, de, ate))),
    Promise.all(nomes.map((n) => totalPeriodo(token, n, dePrev, de))),
    totalPeriodo(token, "reach", de, ate, "follow_type"),
    totalPeriodo(token, "views", de, ate, "media_product_type"),
    totalPeriodo(token, "follows_and_unfollows", de, ate, "follow_type"),
    serieLonga(token, "reach", de, ate),
    serie(token, "follower_count", somarDias(ate, -30), ate),
    postsDoPeriodo(token, de),
    publico(token),
  ]);
  const t = (arr: any[], n: string) => arr[nomes.indexOf(n)]?.total ?? null;
  const tot: Record<string, any> = {};
  for (const n of nomes) tot[n] = { atual: t(atual, n), anterior: t(anterior, n), var: variacao(t(atual, n), t(anterior, n)) };
  const seg = alcanceSeg.partes;
  return {
    username: perfil.username, nome: perfil.name || "", foto: perfil.profile_picture_url || "",
    seguidores: perfil.followers_count, seguindo: perfil.follows_count, totalPosts: perfil.media_count,
    dias, de, ate, totais: tot,
    alcanceSeguidores: seg.FOLLOWER ?? null, alcanceNaoSeguidores: seg.NON_FOLLOWER ?? null,
    viewsPorFormato: viewsFmt.partes,
    novosSeguidores: seguem.partes.FOLLOWER ?? null, deixaram: seguem.partes.NON_FOLLOWER ?? null,
    alcanceDia, seguidoresDia, historico: v.historico || {},
    posts, publico: pub, erroMeta: ERRO_META,
    atualizadoEm: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ error: "Use POST." }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supa.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!user || user.email !== EMAIL_DONA) return resposta({ error: "Não autorizado" }, 401);

    const corpo = await req.json().catch(() => ({}));
    const acao = String(corpo.acao || "dados");
    const db = admin();

    if (acao === "salvar") {
      const token = String(corpo.token || "").trim();
      if (token.length < 30) return resposta({ error: "Cole o token gerado no painel de desenvolvedor da Meta." });
      let perfil: any, igId = "";
      try {
        if (ehFacebook(token)) {
          const f = await alvoFacebook(token);
          ALVO = f.alvo; igId = f.alvo.no;
          perfil = await ig("/me", token, { fields: "username" });
          perfil.account_type = "BUSINESS";
        } else {
          ALVO = { api: API_IG, no: "me" };
          perfil = await ig("/me", token, { fields: "user_id,username,account_type" });
        }
      }
      catch (e) { return resposta({ error: "A Meta não aceitou esse token: " + (e as Error).message }); }
      // o token gerado no painel da Meta já vale 60 dias; a ação "dados" renova sozinha a cada 7 dias
      await db.from("integracoes").upsert({ chave: CHAVE, valor: { token, igId, origem: igId ? "facebook" : "instagram", username: perfil.username, tipo: perfil.account_type, conectadoEm: new Date().toISOString(), renovadoEm: new Date().toISOString(), historico: {}, cache: {} }, atualizado_em: new Date().toISOString() });
      return resposta({ conectado: true, username: perfil.username });
    }
    if (acao === "remover") {
      await db.from("integracoes").delete().eq("chave", CHAVE);
      return resposta({ conectado: false });
    }

    const { data } = await db.from("integracoes").select("valor").eq("chave", CHAVE).maybeSingle();
    const v = (data?.valor || null) as any;
    if (!v?.token) return resposta({ conectado: false });
    ALVO = v.igId ? { api: API_FB, no: v.igId } : { api: API_IG, no: "me" };
    if (acao === "status") return resposta({ conectado: true, username: v.username || "" });

    // renova o token a cada 7 dias (o de 60 dias vence se ninguém renovar)
    if (!v.igId && (!v.renovadoEm || Date.now() - new Date(v.renovadoEm).getTime() > 7 * 86400000)) {
      try {
        const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(v.token)}`);
        const j = await r.json();
        if (j.access_token) { v.token = j.access_token; v.renovadoEm = new Date().toISOString(); }
      } catch { /* tenta de novo na próxima */ }
    }

    if (acao === "metricas") {
      const diasM = [30, 90].includes(Number(corpo.dias)) ? Number(corpo.dias) : 90;
      const cm = v.cacheMet?.[diasM];
      if (cm && Date.now() - new Date(cm.em).getTime() < 30 * 60000 && !corpo.forcar) return resposta({ conectado: true, ...cm.dados, doCache: true });
      let dadosM;
      try { dadosM = await metricasCompletas(v.token, diasM, v); }
      catch (e) {
        const ex = e as Error & { codigo?: number };
        if (ex.codigo === 190 || ex.codigo === 102) return resposta({ conectado: true, expirado: true, error: "O token do Instagram venceu. Gere outro no painel da Meta e cole de novo no Dashboard." });
        throw e;
      }
      // guarda os seguidores de hoje no histórico (o mesmo do Dashboard)
      v.historico = { ...(v.historico || {}), [dadosM.ate]: dadosM.seguidores };
      const ds = Object.keys(v.historico).sort().slice(-120);
      v.historico = Object.fromEntries(ds.map((d) => [d, v.historico[d]]));
      dadosM.historico = v.historico;
      v.cacheMet = { [diasM]: { em: new Date().toISOString(), dados: dadosM } };
      await db.from("integracoes").update({ valor: v, atualizado_em: new Date().toISOString() }).eq("chave", CHAVE);
      return resposta({ conectado: true, ...dadosM });
    }

    const dias = [7, 14, 30].includes(Number(corpo.dias)) ? Number(corpo.dias) : 7;
    const cache = v.cache?.[dias];
    if (cache && Date.now() - new Date(cache.em).getTime() < 30 * 60000 && !corpo.forcar) return resposta({ conectado: true, ...cache.dados, doCache: true });

    const ate = hojeBR(), de = somarDias(ate, -dias), dePrev = somarDias(de, -dias);
    let perfil;
    try { perfil = await ig("/me", v.token, { fields: "username,name,profile_picture_url,followers_count,follows_count,media_count" }); }
    catch (e) {
      const ex = e as Error & { codigo?: number };
      if (ex.codigo === 190 || ex.codigo === 102) return resposta({ conectado: true, expirado: true, error: "O token do Instagram venceu. Gere outro no painel da Meta e cole de novo." });
      throw e;
    }
    const metricas = ["reach", "views", "accounts_engaged", "total_interactions"];
    const [atual, anterior, novos, saidas, alcanceDia] = await Promise.all([
      totais(v.token, metricas, de, ate),
      totais(v.token, metricas, dePrev, de),
      serie(v.token, "follower_count", de, ate),
      deixaram(v.token, de, ate),
      serie(v.token, "reach", de, ate),
    ]);
    // seguidores do dia guardados para comparar depois
    v.historico = { ...(v.historico || {}), [ate]: perfil.followers_count };
    const datas = Object.keys(v.historico).sort().slice(-120);
    v.historico = Object.fromEntries(datas.map((d) => [d, v.historico[d]]));
    const dPrev = datas.filter((d) => d <= de).pop();

    const engaj = atual.reach ? Math.round((atual.accounts_engaged || 0) / atual.reach * 1000) / 10 : null;
    const engajPrev = anterior.reach ? Math.round((anterior.accounts_engaged || 0) / anterior.reach * 1000) / 10 : null;
    const dados = {
      username: perfil.username, nome: perfil.name || "", foto: perfil.profile_picture_url || "",
      seguidores: perfil.followers_count, seguindo: perfil.follows_count, posts: perfil.media_count,
      dias, de, ate,
      novos: novos.reduce((a: number, x: any) => a + x.valor, 0),
      novosDia: novos,
      deixaram: saidas,
      seguidoresAntes: dPrev ? v.historico[dPrev] : null,
      alcance: atual.reach, alcanceVar: variacao(atual.reach, anterior.reach),
      views: atual.views, viewsVar: variacao(atual.views, anterior.views),
      interacoes: atual.total_interactions, interacoesVar: variacao(atual.total_interactions, anterior.total_interactions),
      engajamento: engaj, engajamentoVar: engaj != null && engajPrev != null ? Math.round((engaj - engajPrev) * 10) / 10 : null,
      alcanceDia,
      atualizadoEm: new Date().toISOString(),
    };
    v.cache = { ...(v.cache || {}), [dias]: { em: new Date().toISOString(), dados } };
    await db.from("integracoes").update({ valor: v, atualizado_em: new Date().toISOString() }).eq("chave", CHAVE);
    return resposta({ conectado: true, ...dados });
  } catch (e) {
    return resposta({ error: String((e as Error).message || e) }, 500);
  }
});
