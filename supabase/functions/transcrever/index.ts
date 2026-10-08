// =========================================================
// TRANSCREVER (Edge Function do Supabase)
// Recebe o link de um vídeo do Instagram, TikTok ou YouTube (ou o próprio
// arquivo do vídeo), transcreve com o Groq e devolve os campos do roteiro
// já preenchidos: título, gancho, passos, CTA, expressões, por que prende...
// A chave do Groq fica guardada no Supabase (segredo GROQ_API_KEY),
// nunca no site.
// Só a dona do painel (e-mail abaixo) pode usar.
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const EMAIL_DONA = "marianabonettougc@gmail.com";
const GROQ = "https://api.groq.com/openai/v1";
const LIMITE_ARQUIVO = 25 * 1024 * 1024; // limite do plano grátis do Groq
const NAVEGADOR = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
class Aviso extends Error {}

// ---------- quem é a rede do link ----------
function origemDoLink(link: string) {
  if (/instagram\.com/i.test(link)) return "instagram";
  if (/tiktok\.com/i.test(link)) return "tiktok";
  if (/youtube\.com|youtu\.be/i.test(link)) return "youtube";
  return "outro";
}
function idYoutube(link: string) {
  const m = link.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
const desescapar = (t: string) => {
  try { return JSON.parse(`"${t}"`); } catch { return t.replace(/\\u0026/g, "&").replace(/\\\//g, "/"); }
};
const dataIso = (seg?: number | string) => {
  const n = Number(seg);
  if (!n) return null;
  return new Date(n * 1000).toISOString().slice(0, 10);
};

type Midia = { audio?: Blob; texto?: string; perfil?: string; legenda?: string; data_post?: string | null };

// ---------- TikTok ----------
async function midiaTiktok(link: string): Promise<Midia> {
  let pagina = await fetch(link, { headers: { "User-Agent": NAVEGADOR, "Accept-Language": "pt-BR,pt;q=0.9" }, redirect: "follow" });
  const cookies = (pagina.headers.get("set-cookie") || "").split(/,(?=[^;]+=)/).map((c) => c.split(";")[0]).join("; ");
  const html = await pagina.text();
  const bloco = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  let item: any = null;
  if (bloco) {
    try { item = JSON.parse(bloco[1])?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct; } catch { /* segue */ }
  }
  const enderecos = [item?.video?.playAddr, item?.video?.downloadAddr].filter(Boolean);
  if (!enderecos.length) {
    const m = html.match(/"playAddr":"(.*?)"/);
    if (m) enderecos.push(desescapar(m[1]));
  }
  if (!enderecos.length) throw new Aviso("Não consegui abrir esse vídeo do TikTok (pode ser privado ou o TikTok bloqueou). Use o botão \"Enviar o arquivo do vídeo\".");
  for (const end of enderecos) {
    const v = await fetch(end, { headers: { "User-Agent": NAVEGADOR, Referer: "https://www.tiktok.com/", Cookie: cookies } });
    if (v.ok) return { audio: await v.blob(), perfil: item?.author?.uniqueId, legenda: item?.desc, data_post: dataIso(item?.createTime) };
  }
  throw new Aviso("O TikTok não deixou baixar esse vídeo. Use o botão \"Enviar o arquivo do vídeo\".");
}

// ---------- Instagram ----------
async function midiaInstagram(link: string): Promise<Midia> {
  const m = link.match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/i);
  if (!m) throw new Aviso("Esse link do Instagram não é de um post ou reel. Use o link completo (instagram.com/reel/...).");
  const codigo = m[1];
  const tentativas = [
    `https://www.instagram.com/p/${codigo}/embed/captioned/`,
    `https://www.instagram.com/reel/${codigo}/embed/captioned/`,
  ];
  let perfil: string | undefined, legenda: string | undefined, video: string | undefined;
  for (const url of tentativas) {
    const r = await fetch(url, { headers: { "User-Agent": NAVEGADOR, "Accept-Language": "pt-BR,pt;q=0.9" } });
    if (!r.ok) continue;
    const html = await r.text();
    const v = html.match(/\\?"video_url\\?":\\?"(.*?)\\?"/);
    if (v) video = desescapar(v[1].replace(/\\\\/g, "\\"));
    const u = html.match(/\\?"username\\?":\\?"([\w.]+)\\?"/) || html.match(/class="UsernameText"[^>]*>([\w.]+)</);
    if (u) perfil = u[1];
    const c = html.match(/class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments"/);
    if (c) legenda = c[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (video) break;
  }
  if (!video) throw new Aviso("O Instagram não liberou esse vídeo para baixar (acontece com perfis privados ou quando o Instagram bloqueia). Use o botão \"Enviar o arquivo do vídeo\".");
  const arq = await fetch(video, { headers: { "User-Agent": NAVEGADOR, Referer: "https://www.instagram.com/" } });
  if (!arq.ok) throw new Aviso("O Instagram não deixou baixar esse vídeo. Use o botão \"Enviar o arquivo do vídeo\".");
  return { audio: await arq.blob(), perfil, legenda };
}

// ---------- YouTube (usa a legenda do próprio vídeo) ----------
async function midiaYoutube(link: string): Promise<Midia> {
  const id = idYoutube(link);
  if (!id) throw new Aviso("Esse link do YouTube não tem o código do vídeo.");
  const r = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "com.google.android.youtube/19.09.37 (Linux; U; Android 13) gzip" },
    body: JSON.stringify({ videoId: id, context: { client: { clientName: "ANDROID", clientVersion: "19.09.37", androidSdkVersion: 33, hl: "pt", gl: "BR" } } }),
  });
  const info = await r.json().catch(() => ({}));
  const det = info?.videoDetails || {};
  const faixas = info?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  const faixa = faixas.find((f: any) => /^pt/.test(f.languageCode) && f.kind !== "asr") || faixas.find((f: any) => /^pt/.test(f.languageCode)) || faixas[0];
  const perfil = det.author ? String(det.author).replace(/\s+/g, "") : undefined;
  if (!faixa) throw new Aviso("Esse vídeo do YouTube não tem legenda para eu ler. Use o botão \"Enviar o arquivo do vídeo\".");
  const xml = await (await fetch(faixa.baseUrl + "&fmt=json3")).text();
  let texto = "";
  try {
    const j = JSON.parse(xml);
    texto = (j.events || []).flatMap((e: any) => (e.segs || []).map((s: any) => s.utf8)).join("").replace(/\s+/g, " ").trim();
  } catch {
    texto = xml.replace(/<[^>]+>/g, " ").replace(/&amp;#39;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  }
  if (!texto) throw new Aviso("Não consegui ler a legenda desse vídeo do YouTube. Use o botão \"Enviar o arquivo do vídeo\".");
  return { texto, perfil, legenda: det.shortDescription };
}

// ---------- Groq: transcrição ----------
async function transcreverAudio(audio: Blob, chave: string) {
  if (audio.size > LIMITE_ARQUIVO) throw new Aviso("O vídeo é grande demais para transcrever (máximo 25 MB). Envie um vídeo mais curto.");
  const form = new FormData();
  form.append("file", new File([audio], "video.mp4", { type: audio.type || "video/mp4" }));
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "json");
  form.append("temperature", "0");
  const r = await fetch(`${GROQ}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${chave}` }, body: form });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401) throw new Aviso("A chave do Groq não foi aceita. Confira o segredo GROQ_API_KEY no Supabase.");
    if (r.status === 429) throw new Aviso("O limite grátis do Groq de hoje acabou. Tente de novo mais tarde.");
    throw new Aviso("O Groq não conseguiu transcrever: " + (j?.error?.message || r.status));
  }
  return String(j.text || "").trim();
}

// ---------- Groq: reconhece os campos do roteiro ----------
async function montarCampos(texto: string, legenda: string | undefined, chave: string) {
  const pedido = `Você analisa roteiros de vídeos curtos (Reels, TikTok, Shorts) para uma criadora de conteúdo UGC.
Leia a transcrição e devolva SOMENTE um JSON com estes campos, em português do Brasil:
- "titulo": do que é o vídeo, em até 90 caracteres
- "gancho": a frase de abertura exatamente como foi falada
- "gancho_tipo": uma palavra entre pergunta, promessa, dor, curiosidade, polêmica, número, história, prova
- "desenvolvimento": lista com os passos ou blocos do meio, cada um em uma frase curta
- "cta": a chamada final exatamente como foi falada (vazio se não tiver)
- "expressoes": lista com até 6 expressões marcantes que a pessoa usa
- "por_que": 1 ou 2 frases explicando por que esse roteiro prende a atenção
- "etiquetas": lista com 2 a 4 etiquetas curtas (ex.: tutorial, beleza, unboxing)
Regras: não invente nada que não esteja no vídeo. Nunca use travessão (—). Use frases simples.

Transcrição:
"""${texto.slice(0, 12000)}"""
${legenda ? `\nLegenda do post (só para contexto):\n"""${legenda.slice(0, 1500)}"""` : ""}`;
  const r = await fetch(`${GROQ}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: pedido }],
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return null; // a transcrição continua valendo mesmo sem os campos
  try {
    const c = JSON.parse(j.choices?.[0]?.message?.content || "{}");
    const lista = (v: unknown) => (Array.isArray(v) ? v.map(String) : String(v || "").split(/\n|,/)).map((x) => x.replace(/—/g, ",").trim()).filter(Boolean);
    const limpo = (v: unknown) => String(v || "").replace(/\s*—\s*/g, ", ").trim();
    return {
      titulo: limpo(c.titulo).slice(0, 120),
      gancho: limpo(c.gancho),
      gancho_tipo: limpo(c.gancho_tipo).toLowerCase(),
      desenvolvimento: lista(c.desenvolvimento).join("\n"),
      cta: limpo(c.cta),
      expressoes: lista(c.expressoes).join(", "),
      por_que: limpo(c.por_que),
      etiquetas: lista(c.etiquetas).join(", "),
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "Use POST." }, 405);
  try {
    // só a dona do painel
    const auth = req.headers.get("Authorization") || "";
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supa.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!user || user.email !== EMAIL_DONA) return resposta({ erro: "Entre no painel com o seu e-mail para transcrever." }, 401);

    const chave = Deno.env.get("GROQ_API_KEY");
    if (!chave) throw new Aviso("Falta guardar a chave do Groq no Supabase (segredo GROQ_API_KEY).");

    let link = "", midia: Midia;
    const tipo = req.headers.get("content-type") || "";
    if (tipo.includes("multipart/form-data")) {
      const form = await req.formData();
      const arquivo = form.get("arquivo");
      link = String(form.get("link") || "");
      if (!(arquivo instanceof File)) throw new Aviso("Nenhum arquivo de vídeo foi enviado.");
      midia = { audio: arquivo };
    } else {
      const corpo = await req.json().catch(() => ({}));
      link = String(corpo.link || "").trim();
      if (!/^https?:\/\//i.test(link)) throw new Aviso("Cole o link completo do vídeo.");
      const origem = origemDoLink(link);
      if (origem === "tiktok") midia = await midiaTiktok(link);
      else if (origem === "instagram") midia = await midiaInstagram(link);
      else if (origem === "youtube") midia = await midiaYoutube(link);
      else throw new Aviso("Por enquanto eu transcrevo links do Instagram, TikTok e YouTube.");
    }

    const transcricao = midia.texto || (midia.audio ? await transcreverAudio(midia.audio, chave) : "");
    if (!transcricao) throw new Aviso("Não encontrei fala nesse vídeo para transcrever.");
    const campos = await montarCampos(transcricao, midia.legenda, chave);
    return resposta({
      transcricao,
      perfil: midia.perfil || null,
      data_post: midia.data_post || null,
      origem: link ? origemDoLink(link) : null,
      campos,
    });
  } catch (e) {
    if (e instanceof Aviso) return resposta({ erro: e.message }, 422);
    console.error(e);
    return resposta({ erro: "Algo deu errado ao transcrever. Tente de novo ou envie o arquivo do vídeo." }, 500);
  }
});
