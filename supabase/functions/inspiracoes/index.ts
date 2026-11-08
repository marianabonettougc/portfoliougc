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
// Bombou (nov/2026): cada post ganha "multiplicador" = visualizações (vídeo) ou curtidas (foto/carrossel)
// divididas pela mediana dos OUTROS posts do mesmo perfil (precisa de 5 para comparar). Os até 3 que mais
// passaram de 2x nos últimos 14 dias são os destaques; cada um ganha "radar" {gancho, porque, teste, ...}
// em segundo plano: transcreve 1 por vez pela Supadata (chave em configuracoes, só se sobrar crédito) e
// pede a ideia à função referencias acao "laboratorio" (a mesma dos Salvos, sem repetir o pedido à IA).
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
    video: x.type === "Video" || !!x.videoUrl, visualizacoes: x.videoPlayCount || x.videoViewCount || null, publicado_em: x.timestamp || null,
    curtidas: x.likesCount >= 0 ? x.likesCount : null, comentarios: x.commentsCount >= 0 ? x.commentsCount : null };
}
function linhaTiktok(x: any) {
  if (!x.id || !x.webVideoUrl) return null;
  return { rede: "tiktok", perfil: limpar(x.authorMeta?.name || x["authorMeta.name"]), post_id: String(x.id), link: x.webVideoUrl, legenda: x.text || null,
    capa: x.videoMeta?.coverUrl || x.covers?.[0] || null, video: true, visualizacoes: x.playCount || null, publicado_em: x.createTimeISO || null,
    curtidas: x.diggCount ?? null, comentarios: x.commentCount ?? null };
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


// ---------- Bombou: multiplicador sobre a mediana do perfil + análise dos destaques ----------
const DIAS_DESTAQUE = 14, MIN_COMPARAR = 5, CORTE = 2, DESTAQUES = 3;
const mediana = (l: number[]) => { const o = [...l].sort((a, b) => a - b), m = Math.floor(o.length / 2); return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2; };
const metrica = (x: any) => x.video ? Number(x.visualizacoes) || 0 : Number(x.curtidas) || 0;
async function calcularMultiplicadores(perfis: string[]) {
  const db = admin();
  const { data } = await db.from("inspiracoes").select("id,rede,perfil,video,visualizacoes,curtidas,multiplicador").in("perfil", perfis.length ? perfis : ["-"]);
  const grupos: Record<string, any[]> = {};
  for (const x of data || []) (grupos[`${x.rede}|${x.perfil}|${x.video ? "v" : "f"}`] ||= []).push(x);
  const mudar: { id: number; multiplicador: number | null }[] = [];
  for (const lista of Object.values(grupos)) {
    const comNumero = lista.filter((x) => metrica(x) > 0);
    for (const x of lista) {
      const outros = comNumero.filter((o) => o.id !== x.id).map(metrica);
      const base = outros.length >= MIN_COMPARAR ? mediana(outros) : 0;
      const m = base > 0 && metrica(x) > 0 ? Math.round((metrica(x) / base) * 10) / 10 : null;
      if (m !== (x.multiplicador === null ? null : Number(x.multiplicador))) mudar.push({ id: x.id, multiplicador: m });
    }
  }
  for (const u of mudar) await db.from("inspiracoes").update({ multiplicador: u.multiplicador }).eq("id", u.id);
}
async function destaques(perfis: string[]) {
  const desde = new Date(Date.now() - DIAS_DESTAQUE * 86400000).toISOString();
  const { data } = await admin().from("inspiracoes").select("*").in("perfil", perfis.length ? perfis : ["-"]).eq("oculto", false)
    .gte("publicado_em", desde).gte("multiplicador", CORTE).order("multiplicador", { ascending: false }).limit(DESTAQUES);
  return data || [];
}
async function chaveSupadata() {
  const { data } = await admin().from("configuracoes").select("valor").eq("chave", "supadata_api_key").maybeSingle();
  return String(data?.valor || "").trim();
}
async function transcreverSupadata(chave: string, link: string) {
  const api = "https://api.supadata.ai/v1", h = { "x-api-key": chave };
  try {
    const me = await (await fetch(`${api}/me`, { headers: h })).json();
    if ((Number(me.maxCredits) || 0) - (Number(me.usedCredits) || 0) < 15) return ""; // guarda crédito para o que ela transcreve à mão
    const q = new URLSearchParams({ url: link, mode: "auto", text: "true", lang: "pt" });
    let r = await fetch(`${api}/transcript?${q}`, { headers: h }), j = await r.json().catch(() => ({}));
    if (r.status === 202 && j.jobId) {
      for (let i = 0; i < 18; i++) { // até 90 s
        await new Promise((ok) => setTimeout(ok, 5000));
        j = await (await fetch(`${api}/transcript/${encodeURIComponent(j.jobId)}`, { headers: h })).json().catch(() => ({}));
        const st = String(j.status || "").toLowerCase();
        if (st === "completed") break; if (st === "failed") return "";
      }
    } else if (!r.ok) return "";
    if (String(j.lang || "").toLowerCase() === "none") return "";
    const c = j.content;
    return (Array.isArray(c) ? c.map((s: any) => s.text).join(" ") : String(c || "")).replace(/\s+/g, " ").trim();
  } catch { return ""; }
}
const precisaRadar = (x: any) => !x.radar || (x.video && !x.radar.comFala && !x.radar.tentouFala);
async function analisarDestaques(lista: any[], auth: string) {
  const db = admin();
  let transcreveu = false;
  for (const x of lista) {
    if (!precisaRadar(x)) continue;
    let transcricao = x.transcricao || "", tentouFala = !!transcricao;
    if (x.video && !transcricao && !transcreveu) {
      transcreveu = tentouFala = true; // 1 transcrição por vez, para não gastar os créditos da Supadata
      const chave = await chaveSupadata();
      if (chave) { transcricao = await transcreverSupadata(chave, x.link); if (transcricao) await db.from("inspiracoes").update({ transcricao }).eq("id", x.id); }
    }
    if (x.radar && !transcricao) { // já tem a análise pela legenda; vídeo sem fala (ou sem crédito): não tenta de novo
      if (tentouFala) await db.from("inspiracoes").update({ radar: { ...x.radar, tentouFala: true } }).eq("id", x.id);
      continue;
    }
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/referencias`, {
      method: "POST", headers: { Authorization: auth, apikey: Deno.env.get("SUPABASE_ANON_KEY")!, "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "laboratorio", post: { tipo: x.video ? "Reel" : "Post", perfil: x.perfil, legenda: x.legenda, transcricao } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error || !j.por_que_funciona) { console.error("radar:", j.error || r.status); break; } // limite da IA: tenta na próxima abertura
    const radar = { gancho: j.gancho_original || "", porque: j.por_que_funciona, formato: j.formato || "", tema: j.tema || "",
      teste: j.ideia?.descricao || "", testeTitulo: j.ideia?.titulo || "", testeGancho: j.ideia?.gancho || "", comFala: !!transcricao, tentouFala, em: new Date().toISOString() };
    await db.from("inspiracoes").update({ radar }).eq("id", x.id);
  }
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
    let bombou: any[] = [];
    try {
      await calcularMultiplicadores([...todos]);
      bombou = await destaques([...todos]);
      const falta = bombou.filter(precisaRadar);
      // a análise roda depois da resposta (o Dashboard não espera e pergunta de novo em 1 min se ainda faltar)
      if (falta.length) (globalThis as any).EdgeRuntime?.waitUntil(analisarDestaques(falta, auth).catch((e) => console.error("radar:", e)));
    } catch (e) { console.error("bombou:", e); }
    const { data: itens } = await supa.from("inspiracoes").select("*").in("perfil", [...todos].length ? [...todos] : ["-"]).eq("oculto", false)
      .order("publicado_em", { ascending: false, nullsFirst: false }).limit(80);
    return resposta({ itens: itens || [], bombou, analisando: bombou.some((x) => !x.radar), semToken: !token, rodando, ultimaBusca: estado.iniciadoEm || null, aviso: aviso || estado.erro || "" });
  } catch (e) {
    console.error(e);
    return resposta({ erro: "Algo deu errado ao buscar as inspirações." }, 500);
  }
});
