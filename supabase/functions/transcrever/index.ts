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

const TOKSCRIPT = "https://api.tokscript.com";
// o TokScript só aceita devolver o login para um endereço local; a Mari copia esse endereço e cola no painel (uma vez só)
const VOLTA_TOKSCRIPT = "http://localhost:3000/callback";

// banco com acesso de servidor (só aqui dentro): guarda a conexão com o TokScript
const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
async function lerIntegracao(chave: string) {
  const { data } = await admin().from("integracoes").select("valor").eq("chave", chave).maybeSingle();
  return (data?.valor || null) as any;
}
async function salvarIntegracao(chave: string, valor: unknown) {
  const { error } = await admin().from("integracoes").upsert({ chave, valor, atualizado_em: new Date().toISOString() });
  if (error) throw new Error("Não consegui guardar a conexão: " + error.message);
}

// ---------- TokScript: login (OAuth com PKCE) ----------
const b64url = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const aleatorio = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
async function tokscriptInicio() {
  let cfg = (await lerIntegracao("tokscript")) || {};
  if (!cfg.client_id || cfg.redirect !== VOLTA_TOKSCRIPT) {
    const r = await fetch(`${TOKSCRIPT}/api/connector/oauth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_name: "Painel Mari Bonetto", redirect_uris: [VOLTA_TOKSCRIPT], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none", scope: "mcp:access" }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.client_id) throw new Aviso("O TokScript não aceitou o cadastro do painel (" + (j.error_description || j.error || r.status) + ").");
    cfg = { client_id: j.client_id, redirect: VOLTA_TOKSCRIPT };
  }
  const verifier = aleatorio(48);
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const state = "ts_" + aleatorio(16);
  await salvarIntegracao("tokscript", { ...cfg, verifier, state });
  const u = new URL(`${TOKSCRIPT}/api/connector/oauth/authorize`);
  u.search = new URLSearchParams({ response_type: "code", client_id: cfg.client_id, redirect_uri: VOLTA_TOKSCRIPT, code_challenge: challenge, code_challenge_method: "S256", state, scope: "mcp:access", resource: `${TOKSCRIPT}/mcp` }).toString();
  return { url: u.toString() };
}
async function guardarTokens(cfg: any, j: any) {
  const novo = { ...cfg, access_token: j.access_token, refresh_token: j.refresh_token || cfg.refresh_token, expira: Date.now() + (Number(j.expires_in) || 3600) * 1000 - 60000 };
  delete novo.verifier; delete novo.state;
  await salvarIntegracao("tokscript", novo);
  return novo;
}
async function tokscriptFinalizar(code: string, state: string) {
  const cfg = await lerIntegracao("tokscript");
  if (!cfg || !cfg.state || cfg.state !== state) throw new Aviso("A conexão com o TokScript expirou. Clique em Conectar TokScript de novo.");
  const r = await fetch(`${TOKSCRIPT}/api/connector/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: VOLTA_TOKSCRIPT, client_id: cfg.client_id, code_verifier: cfg.verifier, resource: `${TOKSCRIPT}/mcp` }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Aviso("O TokScript não confirmou o login (" + (j.error_description || j.error || r.status) + "). Tente de novo.");
  await guardarTokens(cfg, j);
  return { ok: true };
}
async function tokenTokscript(): Promise<string | null> {
  let cfg = await lerIntegracao("tokscript");
  if (!cfg?.access_token) return null;
  if (Date.now() < (cfg.expira || 0)) return cfg.access_token;
  if (!cfg.refresh_token) return null;
  const r = await fetch(`${TOKSCRIPT}/api/connector/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: cfg.refresh_token, client_id: cfg.client_id, resource: `${TOKSCRIPT}/mcp` }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) { await salvarIntegracao("tokscript", { client_id: cfg.client_id, redirect: cfg.redirect }); return null; }
  cfg = await guardarTokens(cfg, j);
  return cfg.access_token;
}

// ---------- TokScript: chama a ferramenta de transcrição (protocolo MCP) ----------
async function mcp(token: string, sessao: string | null, corpo: unknown) {
  const h: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" };
  if (sessao) h["Mcp-Session-Id"] = sessao;
  const r = await fetch(`${TOKSCRIPT}/mcp`, { method: "POST", headers: h, body: JSON.stringify(corpo) });
  const novaSessao = r.headers.get("mcp-session-id") || sessao;
  const t = await r.text();
  if (r.status === 401) throw new Aviso("A conexão com o TokScript caiu. Clique em Conectar TokScript de novo.");
  let msg: any = null;
  if (/^\s*[{[]/.test(t)) { try { msg = JSON.parse(t); } catch { /* segue */ } }
  if (!msg) {
    const linhas = t.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim());
    for (const l of linhas.reverse()) { try { const m = JSON.parse(l); if (m.result || m.error) { msg = m; break; } } catch { /* segue */ } }
  }
  if (!r.ok && !msg) throw new Error(`TokScript respondeu ${r.status}: ${t.slice(0, 200)}`);
  return { msg, sessao: novaSessao };
}
function acharTexto(v: any): string {
  if (!v) return "";
  if (typeof v === "string") {
    const s = v.trim();
    if (/^[{[]/.test(s)) { try { return acharTexto(JSON.parse(s)); } catch { /* texto comum */ } }
    return s;
  }
  if (Array.isArray(v)) {
    if (v.length && typeof v[0] === "object" && v[0] && ("text" in v[0]) && ("start" in v[0] || "offset" in v[0] || "timestamp" in v[0] || "time" in v[0])) return v.map((x: any) => x.text).join(" ");
    return v.map(acharTexto).filter(Boolean).join("\n");
  }
  if (typeof v === "object") {
    for (const k of ["transcript", "transcript_text", "transcriptText", "full_text", "text", "content", "captions", "segments", "data", "result"]) {
      if (k in v) { const t = acharTexto(v[k]); if (t && t.length > 20) return t; }
    }
  }
  return "";
}
async function transcreverTokscript(link: string, origem: string): Promise<Midia | null> {
  const token = await tokenTokscript();
  if (!token) return null;
  let { sessao } = await mcp(token, null, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "painel-mari", version: "1.0" } } });
  await mcp(token, sessao, { jsonrpc: "2.0", method: "notifications/initialized" }).catch(() => null);
  const ferramenta = origem === "instagram" ? "get_instagram_transcript" : origem === "tiktok" ? "get_tiktok_transcript" : "get_youtube_transcript";
  // descobre o nome do campo do link na ferramenta
  let campoLink = "url";
  const lista = await mcp(token, sessao, { jsonrpc: "2.0", id: 2, method: "tools/list" }).catch(() => null);
  const def = lista?.msg?.result?.tools?.find((t: any) => t.name === ferramenta);
  if (def?.inputSchema?.properties) {
    const nomes = Object.keys(def.inputSchema.properties);
    campoLink = nomes.find((n) => /url|link/i.test(n)) || (def.inputSchema.required || [])[0] || nomes[0] || "url";
  }
  // tenta até 2 vezes: o serviço do TokScript às vezes demora ou fica instável por alguns minutos
  let res: any = {}, bruto: any = "";
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const { msg } = await mcp(token, sessao, { jsonrpc: "2.0", id: 2 + tentativa, method: "tools/call", params: { name: ferramenta, arguments: { [campoLink]: link } } });
    if (msg?.error) throw new Aviso("O TokScript não conseguiu transcrever: " + (msg.error.message || "erro"));
    res = msg?.result || {};
    bruto = res.structuredContent ?? (res.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    const erroTxt = res.isError ? String(acharTexto(bruto) || bruto) : "";
    if (!res.isError) break;
    const instavel = /timed out|temporarily unavailable|try again later|timeout|503|502/i.test(erroTxt);
    if (instavel && tentativa < 2) { await new Promise((r) => setTimeout(r, 3000)); continue; }
    const rede = origem === "instagram" ? "Instagram" : origem === "tiktok" ? "TikTok" : "YouTube";
    if (instavel) throw new Aviso(`O serviço de ${rede} do TokScript está instável agora (problema do lado deles). Tente de novo em alguns minutos, ou use "Enviar o arquivo do vídeo".`);
    if (/limit|quota|upgrade|subscription|per day/i.test(erroTxt)) throw new Aviso("Você chegou ao limite do plano grátis do TokScript (5 vídeos por dia). Amanhã libera de novo, ou use \"Enviar o arquivo do vídeo\".");
    if (/private|not found|unavailable|no transcript/i.test(erroTxt)) throw new Aviso("O TokScript não encontrou fala nesse vídeo (pode ser privado, foto ou vídeo sem fala). Se tiver o arquivo, use \"Enviar o arquivo do vídeo\".");
    throw new Aviso("O TokScript não conseguiu transcrever: " + erroTxt.slice(0, 300));
  }
  const texto = acharTexto(bruto);
  if (!texto) throw new Aviso("O TokScript não encontrou fala nesse vídeo.");
  let meta: any = {};
  try { meta = typeof bruto === "string" ? JSON.parse(bruto) : bruto; } catch { /* sem dados extras */ }
  const perfil = meta?.author?.username || meta?.username || meta?.author_username || meta?.owner?.username || meta?.creator || undefined;
  const legenda = meta?.caption || meta?.description || meta?.desc || undefined;
  return { texto, perfil: typeof perfil === "string" ? perfil : undefined, legenda: typeof legenda === "string" ? legenda : undefined };
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
class Aviso extends Error {}

// ---------- Groq: escolhe sozinho um modelo que ainda existe ----------
// O Groq aposenta modelos de tempos em tempos. Em vez de fixar um nome,
// pergunta a lista de modelos ativos e usa o melhor disponível.
let modelosGroq: { texto: string; audio: string } | null = null;
async function modelos(chave: string) {
  if (modelosGroq) return modelosGroq;
  let ids: string[] = [];
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${chave}` } });
    const j = await r.json();
    ids = (j.data || []).filter((m: any) => m.active !== false).map((m: any) => String(m.id));
  } catch { /* usa os nomes padrão abaixo */ }
  const preferidos = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "moonshotai/kimi-k2-instruct-0905", "moonshotai/kimi-k2-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct", "qwen/qwen3-32b", "openai/gpt-oss-20b", "llama-3.1-8b-instant"];
  const texto = preferidos.find((p) => ids.includes(p)) || ids.find((id) => !/whisper|guard|tts|playai|orpheus|compound|prompt|distil/i.test(id)) || "openai/gpt-oss-120b";
  const audio = ["whisper-large-v3-turbo", "whisper-large-v3"].find((p) => ids.includes(p)) || ids.find((id) => /whisper/i.test(id)) || "whisper-large-v3-turbo";
  console.log("Modelos do Groq em uso:", texto, audio);
  if (ids.length) modelosGroq = { texto, audio };
  return { texto, audio };
}
// conversa com o Groq e devolve o texto da resposta (tenta de novo sem o modo JSON se o modelo não aceitar)
async function conversarGroq(chave: string, mensagens: unknown[], opcoes: { json?: boolean; temperatura?: number; max?: number } = {}) {
  const { texto: modelo } = await modelos(chave);
  const pedir = async (comJson: boolean) => fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelo, temperature: opcoes.temperatura ?? 0.2, ...(opcoes.max ? { max_tokens: opcoes.max } : {}), ...(comJson ? { response_format: { type: "json_object" } } : {}), messages: mensagens }),
  });
  let r = await pedir(!!opcoes.json);
  let j = await r.json().catch(() => ({}));
  if (!r.ok && opcoes.json) { r = await pedir(false); j = await r.json().catch(() => ({})); }
  if (!r.ok) { if (r.status === 404 || /model/i.test(j?.error?.message || "")) modelosGroq = null; throw new Error(j?.error?.message || "Groq respondeu " + r.status); }
  return String(j.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
const lerJson = (t: string) => { try { return JSON.parse(t); } catch { const m = t.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : {}; } };

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
  const semTokscript = " Para Instagram funcionar sempre, clique em \"Conectar TokScript\" no topo da aba Roteiros.";
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
  if (!video) throw new Aviso("O Instagram não deixa servidores baixarem vídeos sem login, mesmo de perfil aberto." + semTokscript + " Ou use \"Enviar o arquivo do vídeo\".");
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
  if (!chave) throw new Aviso("Falta guardar a chave do Groq no Supabase (segredo GROQ_API_KEY).");
  if (audio.size > LIMITE_ARQUIVO) throw new Aviso("O vídeo é grande demais para transcrever (máximo 25 MB). Envie um vídeo mais curto.");
  const form = new FormData();
  form.append("file", new File([audio], "video.mp4", { type: audio.type || "video/mp4" }));
  form.append("model", (await modelos(chave)).audio);
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
  if (!chave) return null;
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
  let c: any;
  try {
    c = lerJson(await conversarGroq(chave, [{ role: "user", content: pedido }], { json: true, temperatura: 0.2 }));
  } catch (e) {
    console.error("Groq não preencheu os campos:", e);
    return null; // a transcrição continua valendo mesmo sem os campos
  }
  try {
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

    const chave = Deno.env.get("GROQ_API_KEY") || "";

    let link = "", midia: Midia | null = null;
    const tipo = req.headers.get("content-type") || "";
    if (tipo.includes("application/json")) {
      const espiar = await req.clone().json().catch(() => ({}));
      if (espiar.acao === "tokscript_status") { const c = await lerIntegracao("tokscript"); return resposta({ conectado: Boolean(c?.access_token || c?.refresh_token) }); }
      if (espiar.acao === "tokscript_inicio") return resposta(await tokscriptInicio());
      if (espiar.acao === "tokscript_finalizar") return resposta(await tokscriptFinalizar(String(espiar.code || ""), String(espiar.state || "")));
      if (espiar.acao === "tokscript_sair") { const c = await lerIntegracao("tokscript"); await salvarIntegracao("tokscript", { client_id: c?.client_id, redirect: c?.redirect }); return resposta({ ok: true }); }
    }
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
      // 1º TokScript (se estiver conectado); se não, tenta baixar direto
      if (origem !== "outro") {
        try { midia = await transcreverTokscript(link, origem); }
        catch (e) { if (e instanceof Aviso) throw e; console.error("TokScript falhou:", e); midia = null; }
      }
      if (midia) { /* já veio do TokScript */ }
      else if (origem === "tiktok") midia = await midiaTiktok(link);
      else if (origem === "instagram") midia = await midiaInstagram(link);
      else if (origem === "youtube") midia = await midiaYoutube(link);
      else throw new Aviso("Por enquanto eu transcrevo links do Instagram, TikTok e YouTube.");
    }

    if (!midia) throw new Aviso("Não consegui pegar esse vídeo.");
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
