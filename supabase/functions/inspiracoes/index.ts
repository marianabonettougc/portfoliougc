// =========================================================
// INSPIRAÇÕES (Edge Function do Supabase)
// Olha os perfis que a Mari acompanha no Instagram e no TikTok e guarda
// os vídeos novos na tabela inspiracoes, para aparecerem no Dashboard.
// O Instagram e o TikTok bloqueiam servidores, então a busca é feita pelo
// Apify (serviço próprio para isso). A chave fica só no Supabase, no
// segredo APIFY_TOKEN, nunca no site.
// Como funciona: o Dashboard chama esta função ao abrir. Se já passaram 12 horas
// desde a última busca, ela pede ao Apify uma busca nova; na próxima vez que o
// Dashboard abrir (ou no botão Buscar agora), ela recolhe o resultado.
// Capas: cada capa é copiada para o Storage (bucket público "capas", pasta insp/) porque o link do Instagram expira.
// Só a dona do painel pode usar.
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const EMAIL_DONA = "marianabonettougc@gmail.com";
const APIFY = "https://api.apify.com/v2";
const INTERVALO = 12 * 3600 * 1000; // busca nova no máximo a cada 12 horas (o plano grátis do Apify dá conta)
const POR_PERFIL = 4; // últimos posts de cada perfil (os antigos continuam guardados)
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

// as capas do Instagram/TikTok expiram em poucos dias: guarda uma cópia no Storage (bucket público "capas") e troca o link
const NAVEGADOR = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
async function baixar(url: string, ua = NAVEGADOR) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  try { return await fetch(url, { headers: { "User-Agent": ua }, redirect: "follow", signal: ctl.signal }); } finally { clearTimeout(t); }
}
async function imagemDe(url: string): Promise<{ bytes: Uint8Array; tipo: string } | null> {
  try { const r = await baixar(url); const tipo = r.headers.get("content-type") || ""; if (!r.ok || !tipo.startsWith("image/")) return null;
    const bytes = new Uint8Array(await r.arrayBuffer()); return bytes.length > 500 ? { bytes, tipo } : null; } catch { return null; }
}
async function capaNova(link: string): Promise<string> {
  if (/tiktok\.com/i.test(link)) { try { const j = await (await baixar(`https://www.tiktok.com/oembed?url=${encodeURIComponent(link)}`)).json(); return j.thumbnail_url || ""; } catch { return ""; } }
  for (const ua of ["facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", NAVEGADOR]) {
    try { const html = await (await baixar(link, ua)).text();
      const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image/i);
      if (m) return m[1].replace(/&amp;/g, "&"); } catch { /* tenta o próximo */ }
  }
  return "";
}
async function guardarCapas(limite = 40) {
  const db = admin(), base = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/capas/`;
  const umDia = new Date(Date.now() - 86400000).toISOString();
  const { data } = await db.from("inspiracoes").select("id,rede,post_id,link,capa,capa_tentou").eq("oculto", false)
    .or(`capa_tentou.is.null,capa_tentou.lt.${umDia}`).order("publicado_em", { ascending: false, nullsFirst: false }).limit(200);
  const fila = (data || []).filter((x: any) => !String(x.capa || "").startsWith(base)).slice(0, limite);
  const um = async (x: any) => {
    let img = x.capa ? await imagemDe(x.capa) : null;
    if (!img && x.link) { const u = await capaNova(x.link); if (u) img = await imagemDe(u); }
    if (!img) { await db.from("inspiracoes").update({ capa_tentou: new Date().toISOString() }).eq("id", x.id); return; }
    const caminho = `insp/${x.rede}-${String(x.post_id).replace(/[^\w-]/g, "")}.${img.tipo.includes("png") ? "png" : img.tipo.includes("webp") ? "webp" : "jpg"}`;
    const { error } = await db.storage.from("capas").upload(caminho, img.bytes, { contentType: img.tipo, upsert: true });
    await db.from("inspiracoes").update(error ? { capa_tentou: new Date().toISOString() } : { capa: base + caminho, capa_tentou: new Date().toISOString() }).eq("id", x.id);
  };
  for (let i = 0; i < fila.length; i += 8) await Promise.all(fila.slice(i, i + 8).map(um));
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

    try { await guardarCapas(corpo.capas ? 80 : 40); } catch (e) { console.error("capas:", e); }
    const { data: itens } = await supa.from("inspiracoes").select("*").in("perfil", [...todos].length ? [...todos] : ["-"]).eq("oculto", false)
      .order("publicado_em", { ascending: false, nullsFirst: false }).limit(80);
    return resposta({ itens: itens || [], semToken: !token, rodando, ultimaBusca: estado.iniciadoEm || null, aviso: aviso || estado.erro || "" });
  } catch (e) {
    console.error(e);
    return resposta({ erro: "Algo deu errado ao buscar as inspirações." }, 500);
  }
});
