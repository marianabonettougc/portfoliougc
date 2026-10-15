// =========================================================
// BIBLIOTECA EDITORIAL (Edge Function do Supabase)
// Criatividade > Biblioteca editorial: acompanha perfis de referência, guarda os
// posts com curtidas, comentários e visualizações (tabela biblioteca) para achar
// os que saíram da curva, e analisa um post (ideia, ângulo, gancho, estrutura
// narrativa, composição visual e CTA).
// - { acao: "buscar", usuario? }: pede ao Apify os últimos posts dos perfis (tabela biblioteca_perfis)
// - { acao: "recolher" }: guarda o que o Apify já terminou de buscar
// - { acao: "analisar", id }: análise do post pela IA (Groq) e guarda em biblioteca.analise
// Segredos: APIFY_TOKEN e GROQ_API_KEY (só no Supabase). Só a dona do painel pode usar.
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const EMAIL_DONA = "marianabonettougc@gmail.com";
const APIFY = "https://api.apify.com/v2";
const POR_PERFIL = 30;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const txt = (x: unknown, n = 800) => String(x ?? "").replace(/\s*[—–]\s*/g, ", ").trim().slice(0, n);
const num = (x: unknown) => { const n = Number(x); return Number.isFinite(n) && n >= 0 ? Math.round(n) : null; };
const lerJson = (t: string) => { try { return JSON.parse(t); } catch { const m = t.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : {}; } catch { return {}; } } };

function linhaInstagram(x: any) {
  const id = x.shortCode || x.id;
  if (!id || !x.url) return null;
  return { rede: "instagram", perfil: String(x.ownerUsername || "").toLowerCase(), post_id: String(id), link: x.url, legenda: x.caption || null, capa: x.displayUrl || null,
    tipo: x.type === "Video" || x.productType === "clips" ? "Reel" : x.type === "Sidecar" ? "Carrossel" : "Post",
    curtidas: num(x.likesCount), comentarios: num(x.commentsCount), visualizacoes: num(x.videoPlayCount || x.videoViewCount), publicado_em: x.timestamp || null, atualizado_em: new Date().toISOString() };
}
function linhaTiktok(x: any) {
  if (!x.id || !x.webVideoUrl) return null;
  return { rede: "tiktok", perfil: String(x.authorMeta?.name || "").toLowerCase(), post_id: String(x.id), link: x.webVideoUrl, legenda: x.text || null,
    capa: x.videoMeta?.coverUrl || null, tipo: "Vídeo", curtidas: num(x.diggCount), comentarios: num(x.commentCount), visualizacoes: num(x.playCount),
    publicado_em: x.createTimeISO || null, atualizado_em: new Date().toISOString() };
}

async function buscar(supa: any, token: string, usuario?: string) {
  let q = supa.from("biblioteca_perfis").select("*");
  if (usuario) q = q.eq("usuario", usuario.replace(/^@/, "").toLowerCase());
  const { data: perfis } = await q;
  const iniciados: string[] = [];
  for (const p of perfis || []) {
    const ator = p.rede === "tiktok" ? "clockworks~tiktok-scraper" : "apify~instagram-scraper";
    const corpo = p.rede === "tiktok"
      ? { profiles: [p.usuario], resultsPerPage: POR_PERFIL, shouldDownloadVideos: false, shouldDownloadCovers: false }
      : { directUrls: [`https://www.instagram.com/${p.usuario}/`], resultsType: "posts", resultsLimit: POR_PERFIL, addParentData: false };
    const r = await fetch(`${APIFY}/acts/${ator}/runs?token=${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.data?.id) { if (r.status === 402) throw new Error("Os créditos do Apify deste mês acabaram."); continue; }
    await supa.from("biblioteca_perfis").update({ run_id: j.data.id }).eq("id", p.id);
    iniciados.push(p.usuario);
  }
  return { iniciados };
}

async function recolher(supa: any, token: string) {
  const { data: perfis } = await supa.from("biblioteca_perfis").select("*").not("run_id", "is", null);
  let novos = 0, pendentes = 0;
  for (const p of perfis || []) {
    const st = (await (await fetch(`${APIFY}/actor-runs/${p.run_id}?token=${token}`)).json().catch(() => ({})))?.data?.status;
    if (st === "RUNNING" || st === "READY") { pendentes++; continue; }
    if (st === "SUCCEEDED") {
      const itens = await (await fetch(`${APIFY}/actor-runs/${p.run_id}/dataset/items?token=${token}&clean=true`)).json().catch(() => []);
      const linhas = (Array.isArray(itens) ? itens : []).map(p.rede === "tiktok" ? linhaTiktok : linhaInstagram).filter(Boolean).map((l: any) => ({ ...l, perfil: l.perfil || p.usuario }));
      if (linhas.length) {
        const { error } = await supa.from("biblioteca").upsert(linhas, { onConflict: "rede,post_id" });
        if (!error) novos += linhas.length;
      }
    }
    await supa.from("biblioteca_perfis").update({ run_id: null, ultima_busca: new Date().toISOString() }).eq("id", p.id);
  }
  return { novos, pendentes };
}

// ---------- análise ----------
let modelo = "";
async function modeloTexto(chave: string) {
  if (modelo) return modelo;
  try {
    const j = await (await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${chave}` } })).json();
    const ids = (j.data || []).map((m: any) => String(m.id));
    modelo = ["openai/gpt-oss-120b", "qwen/qwen3-32b", "openai/gpt-oss-20b", "llama-3.1-8b-instant"].find((p) => ids.includes(p)) || "openai/gpt-oss-120b";
  } catch { modelo = "openai/gpt-oss-120b"; }
  return modelo;
}
async function verCapa(chave: string, url: string) {
  if (!url) return "";
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "qwen/qwen3.8-27b", temperature: 0.2, max_tokens: 400, messages: [{ role: "user", content: [
        { type: "text", text: "Descreva em português, em tópicos curtos, a composição visual desta capa de vídeo: enquadramento, quem aparece, expressão, texto escrito na tela, cores, cenário." },
        { type: "image_url", image_url: { url } }] }] }),
    });
    const j = await r.json().catch(() => ({}));
    return r.ok ? String(j.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim().slice(0, 900) : "";
  } catch { return ""; }
}
async function analisar(supa: any, chave: string, id: number, transcricao?: string) {
  const { data: post } = await supa.from("biblioteca").select("*").eq("id", id).maybeSingle();
  if (!post) throw new Error("Não achei esse post.");
  if (transcricao) { await supa.from("biblioteca").update({ transcricao: txt(transcricao, 8000) }).eq("id", id); post.transcricao = transcricao; }
  const { data: outros } = await supa.from("biblioteca").select("curtidas").eq("perfil", post.perfil).eq("rede", post.rede);
  const cs = (outros || []).map((o: any) => Number(o.curtidas) || 0).sort((a: number, b: number) => a - b);
  const mediana = cs.length ? cs[Math.floor(cs.length / 2)] : 0;
  const capa = await verCapa(chave, post.capa);
  const pedido = `Você analisa conteúdos de redes sociais para uma criadora brasileira de UGC entender por que alguns posts performam muito acima da média.

POST (${post.tipo || "post"} de @${post.perfil}, ${post.rede})
Curtidas: ${post.curtidas ?? "?"} (mediana do perfil: ${mediana || "?"}) · Comentários: ${post.comentarios ?? "?"}${post.visualizacoes ? ` · Visualizações: ${post.visualizacoes}` : ""}
Legenda: ${txt(post.legenda, 1500) || "sem legenda"}
${post.transcricao ? "O que a pessoa fala: " + txt(post.transcricao, 3000) : "Sem transcrição da fala."}
${capa ? "Capa do vídeo:\n" + capa : ""}

Responda SOMENTE um JSON:
{"por_que_saiu_da_curva":"2 frases objetivas","ideia":"a ideia central em 1 frase","angulo":"o ângulo escolhido (o recorte que deixou a ideia interessante)","gancho":"como o post prende nos primeiros segundos e por quê",
"estrutura":[{"parte":"Gancho | Contexto | Desenvolvimento | Virada | Prova | CTA","texto":"o que acontece, 1 frase"}],
"composicao_visual":"enquadramento, texto na tela, cenário, ritmo de cortes (o que dá para saber pela capa e pelo texto)","cta":"qual é o CTA e como ele é pedido (ou 'sem CTA claro')",
"como_usar":"1 frase: como ela pode usar essa mesma lógica num vídeo UGC dela"}
Português do Brasil, frases curtas e concretas tiradas do post, nada genérico. Nunca invente números. Nunca use travessão.`;
  const m = await modeloTexto(chave);
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: m, temperature: 0.4, max_tokens: 2200, response_format: { type: "json_object" }, ...(/gpt-oss/.test(m) ? { reasoning_effort: "low" } : {}), messages: [{ role: "user", content: pedido }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 429 ? "O limite grátis da IA deste minuto acabou. Espere um pouquinho e tente de novo." : "A IA não respondeu agora. Tente de novo.");
  const a = lerJson(String(j.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, ""));
  const analise = {
    por_que_saiu_da_curva: txt(a.por_que_saiu_da_curva, 500), ideia: txt(a.ideia, 300), angulo: txt(a.angulo, 300), gancho: txt(a.gancho, 400),
    estrutura: (Array.isArray(a.estrutura) ? a.estrutura : []).slice(0, 8).map((e: any) => ({ parte: txt(e.parte, 30), texto: txt(e.texto, 300) })).filter((e: any) => e.texto),
    composicao_visual: txt(a.composicao_visual, 600), cta: txt(a.cta, 300), como_usar: txt(a.como_usar, 400), mediana, feitaEm: new Date().toISOString(),
  };
  await supa.from("biblioteca").update({ analise }).eq("id", id);
  return { analise };
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
    const token = Deno.env.get("APIFY_TOKEN") || "";
    if (corpo.acao === "buscar" || corpo.acao === "recolher") {
      if (!token) return resposta({ error: "Falta o APIFY_TOKEN no Supabase." }, 500);
      return resposta(corpo.acao === "buscar" ? await buscar(supa, token, corpo.usuario) : await recolher(supa, token));
    }
    if (corpo.acao === "analisar") {
      const chave = Deno.env.get("GROQ_API_KEY") || "";
      if (!chave) return resposta({ error: "Falta a chave do Groq no Supabase (GROQ_API_KEY)." }, 500);
      return resposta(await analisar(supa, chave, Number(corpo.id), corpo.transcricao));
    }
    return resposta({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error(e);
    return resposta({ error: String((e as Error).message || "Algo deu errado.") }, 502);
  }
});
