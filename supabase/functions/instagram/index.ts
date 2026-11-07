// =========================================================
// INSTAGRAM NO DASHBOARD (Edge Function do Supabase)
// Lê os números do perfil da Mari pela API OFICIAL da Meta (Instagram API com login do Instagram,
// graph.instagram.com). Só leitura: não posta, não segue, não curte, não pede senha.
// O token fica guardado só no banco (tabela integracoes, chave "instagram", que só o servidor lê),
// nunca no site nem no GitHub.
// Ações (POST): { acao: "dados", dias: 7|14|30 } | { acao: "salvar", token } | { acao: "remover" } | { acao: "status" }
// Só a dona do painel pode usar.
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const EMAIL_DONA = "marianabonettougc@gmail.com";
const CHAVE = "instagram";
const API = "https://graph.instagram.com/v23.0";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

async function ig(caminho: string, token: string, params: Record<string, string | number> = {}) {
  const u = new URL(API + caminho);
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
      if (token.length < 30) return resposta({ error: "Cole o token gerado no painel de desenvolvedor da Meta." }, 400);
      let perfil;
      try { perfil = await ig("/me", token, { fields: "user_id,username,account_type" }); }
      catch (e) { return resposta({ error: "A Meta não aceitou esse token: " + (e as Error).message }, 400); }
      // o token gerado no painel da Meta já vale 60 dias; a ação "dados" renova sozinha a cada 7 dias
      await db.from("integracoes").upsert({ chave: CHAVE, valor: { token, username: perfil.username, tipo: perfil.account_type, conectadoEm: new Date().toISOString(), renovadoEm: new Date().toISOString(), historico: {}, cache: {} }, atualizado_em: new Date().toISOString() });
      return resposta({ conectado: true, username: perfil.username });
    }
    if (acao === "remover") {
      await db.from("integracoes").delete().eq("chave", CHAVE);
      return resposta({ conectado: false });
    }

    const { data } = await db.from("integracoes").select("valor").eq("chave", CHAVE).maybeSingle();
    const v = (data?.valor || null) as any;
    if (!v?.token) return resposta({ conectado: false });
    if (acao === "status") return resposta({ conectado: true, username: v.username || "" });

    // renova o token a cada 7 dias (o de 60 dias vence se ninguém renovar)
    if (!v.renovadoEm || Date.now() - new Date(v.renovadoEm).getTime() > 7 * 86400000) {
      try {
        const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(v.token)}`);
        const j = await r.json();
        if (j.access_token) { v.token = j.access_token; v.renovadoEm = new Date().toISOString(); }
      } catch { /* tenta de novo na próxima */ }
    }

    const dias = [7, 14, 30].includes(Number(corpo.dias)) ? Number(corpo.dias) : 7;
    const cache = v.cache?.[dias];
    if (cache && Date.now() - new Date(cache.em).getTime() < 30 * 60000 && !corpo.forcar) return resposta({ conectado: true, ...cache.dados, doCache: true });

    const ate = hojeBR(), de = somarDias(ate, -dias), dePrev = somarDias(de, -dias);
    let perfil;
    try { perfil = await ig("/me", v.token, { fields: "username,name,profile_picture_url,followers_count,follows_count,media_count" }); }
    catch (e) {
      const ex = e as Error & { codigo?: number };
      if (ex.codigo === 190) return resposta({ conectado: true, expirado: true, error: "O token do Instagram venceu. Gere outro no painel da Meta e cole de novo." });
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
