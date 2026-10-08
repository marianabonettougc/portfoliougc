// =========================================================
// INSPIRAÇÕES (Edge Function do Supabase)
// Olha os perfis que a Mari acompanha no Instagram e no TikTok e guarda
// os vídeos novos na tabela inspiracoes, para aparecerem no Dashboard.
// O Instagram e o TikTok bloqueiam servidores, então a busca é feita pelo
// Apify (serviço próprio para isso). A chave fica só no Supabase, no
// segredo APIFY_TOKEN, nunca no site.
// Como funciona: o Dashboard chama esta função ao abrir. Se já passaram 6 horas
// desde a última busca, ela pede ao Apify uma busca nova; na próxima vez que o
// Dashboard abrir (ou no botão Buscar agora), ela recolhe o resultado.
// Só a dona do painel pode usar.
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const EMAIL_DONA = "marianabonettougc@gmail.com";
const APIFY = "https://api.apify.com/v2";
const INTERVALO = 6 * 3600 * 1000; // busca nova no máximo a cada 6 horas
const POR_PERFIL = 3; // últimos posts de cada perfil
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const limpar = (u: unknown) => String(u || "").trim().replace(/^@/, "").toLowerCase();

async function lerEstado() {
  const { data } = await admin().from("integracoes").select("valor").eq("chave", "apify").maybeSingle();
  return (data?.valor || { runs: [], iniciadoEm: 0 }) as { runs: { id: string; rede: string }[]; iniciadoEm: number; erro?: string };
}
async function salvarEstado(valor: unknown) {
  await admin().from("integracoes").upsert({ chave: "apify", valor, atualizado_em: new Date().toISOString() });
}

// transforma o resultado do Apify numa linha da tabela inspiracoes
function linhaInstagram(x: any) {
  const id = x.shortCode || x.id;
  if (!id || !x.url) return null;
  return { rede: "instagram", perfil: limpar(x.ownerUsername), post_id: String(id), link: x.url, legenda: x.caption || null, capa: x.displayUrl || null,
    video: x.type === "Video" || !!x.videoUrl, visualizacoes: x.videoPlayCount || x.videoViewCount || null, publicado_em: x.timestamp || null };
}
function linhaTiktok(x: any) {
  if (!x.id || !x.webVideoUrl) return null;
  return { rede: "tiktok", perfil: limpar(x.authorMeta?.name || x["authorMeta.name"]), post_id: String(x.id), link: x.webVideoUrl, legenda: x.text || null,
    capa: x.videoMeta?.coverUrl || x.covers?.[0] || null, video: true, visualizacoes: x.playCount || null, publicado_em: x.createTimeISO || null };
}

async function recolher(token: string, estado: any, perfis: Set<string>) {
  const pendentes: any[] = [];
  for (const run of estado.runs || []) {
    const r = await fetch(`${APIFY}/actor-runs/${run.id}?token=${token}`);
    const st = (await r.json().catch(() => ({})))?.data?.status;
    if (st === "RUNNING" || st === "READY") { pendentes.push(run); continue; }
    if (st !== "SUCCEEDED") continue; // falhou ou foi cancelada: tenta de novo na próxima busca
    const itens = await (await fetch(`${APIFY}/actor-runs/${run.id}/dataset/items?token=${token}&clean=true`)).json().catch(() => []);
    const linhas = (Array.isArray(itens) ? itens : []).map(run.rede === "tiktok" ? linhaTiktok : linhaInstagram)
      .filter((l: any) => l && l.perfil && perfis.has(l.perfil));
    if (linhas.length) {
      const { error } = await admin().from("inspiracoes").upsert(linhas, { onConflict: "rede,post_id", ignoreDuplicates: false });
      if (error) console.error("Não salvou as inspirações:", error.message);
    }
  }
  return pendentes;
}

async function iniciar(token: string, ig: string[], tt: string[]) {
  const runs: { id: string; rede: string }[] = [];
  let erro = "";
  const pedir = async (ator: string, corpo: unknown, rede: string) => {
    const r = await fetch(`${APIFY}/acts/${ator}/runs?token=${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    const j = await r.json().catch(() => ({}));
    if (j?.data?.id) runs.push({ id: j.data.id, rede });
    else erro = j?.error?.message || ("Apify respondeu " + r.status);
  };
  if (ig.length) await pedir("apify~instagram-scraper", { directUrls: ig.map((u) => `https://www.instagram.com/${u}/`), resultsType: "posts", resultsLimit: POR_PERFIL, addParentData: false }, "instagram");
  if (tt.length) await pedir("clockworks~tiktok-scraper", { profiles: tt, resultsPerPage: POR_PERFIL, profileSorting: "latest", profileScrapeSections: ["videos"], shouldDownloadVideos: false, shouldDownloadCovers: false, shouldDownloadSubtitles: false, shouldDownloadSlideshowImages: false }, "tiktok");
  return { runs, erro };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "Use POST." }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supa.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!user || user.email !== EMAIL_DONA) return resposta({ erro: "Não autorizado" }, 401);

    const corpo = await req.json().catch(() => ({}));
    const lista = (Array.isArray(corpo.perfis) ? corpo.perfis : []).slice(0, 40);
    const ig = [...new Set(lista.filter((p: any) => p.rede !== "tiktok").map((p: any) => limpar(p.usuario)).filter(Boolean))] as string[];
    const tt = [...new Set(lista.filter((p: any) => p.rede === "tiktok").map((p: any) => limpar(p.usuario)).filter(Boolean))] as string[];
    const todos = new Set([...ig, ...tt]);

    const token = Deno.env.get("APIFY_TOKEN") || "";
    let estado = await lerEstado();
    let rodando = false, aviso = "";
    if (token && todos.size) {
      const pendentes = await recolher(token, estado, todos);
      rodando = pendentes.length > 0;
      if (!rodando && (corpo.forcar || Date.now() - (estado.iniciadoEm || 0) > INTERVALO)) {
        const { runs, erro } = await iniciar(token, ig, tt);
        estado = { runs, iniciadoEm: Date.now(), erro: erro || undefined };
        rodando = runs.length > 0;
        aviso = erro;
      } else estado = { ...estado, runs: pendentes };
      await salvarEstado(estado);
    }

    const { data: itens } = await supa.from("inspiracoes").select("*").in("perfil", [...todos].length ? [...todos] : ["-"])
      .order("publicado_em", { ascending: false, nullsFirst: false }).limit(40);
    return resposta({ itens: itens || [], semToken: !token, rodando, ultimaBusca: estado.iniciadoEm || null, aviso: aviso || estado.erro || "" });
  } catch (e) {
    console.error(e);
    return resposta({ erro: "Algo deu errado ao buscar as inspirações." }, 500);
  }
});
