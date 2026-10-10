// =========================================================
// CAPA DO VÍDEO (Edge Function do Supabase)
// Pega a capa (imagem) de um vídeo de referência e devolve a imagem em si (data URL),
// para o painel guardar uma cópia pequena na tabela roteiros (coluna capa).
// As capas do Instagram vêm com endereço que expira em poucos dias; guardando a imagem, ela nunca some.
// TikTok: oEmbed. YouTube: imagem pública. Instagram: prévia da página e, se o Instagram bloquear,
// o Apify (segredo APIFY_TOKEN). Também aceita { imagem } com o endereço de uma capa já conhecida.
// Só a dona do painel pode usar.
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const EMAIL_DONA = "marianabonettougc@gmail.com";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const NAVEGADOR = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
async function abrir(url: string, ua = NAVEGADOR, ms = 8000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { headers: { "User-Agent": ua, "Accept-Language": "pt-BR,pt;q=0.9" }, redirect: "follow", signal: ctl.signal }); } finally { clearTimeout(t); }
}
const ogImage = (html: string) => (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image/i))?.[1]?.replace(/&amp;/g, "&") || "";

async function enderecoDaCapa(link: string): Promise<string> {
  if (/tiktok\.com/i.test(link)) {
    const j = await (await abrir(`https://www.tiktok.com/oembed?url=${encodeURIComponent(link)}`)).json().catch(() => ({}));
    return j.thumbnail_url || "";
  }
  const yt = link.match(/(?:shorts\/|v=|youtu\.be\/|embed\/|live\/)([A-Za-z0-9_-]{11})/)?.[1];
  if (yt) return `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
  if (/instagram\.com/i.test(link)) {
    // 1º a prévia que o Instagram mostra para links compartilhados
    for (const ua of ["facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", NAVEGADOR]) {
      try { const img = ogImage(await (await abrir(link, ua)).text()); if (img) return img; } catch { /* tenta o próximo */ }
    }
    // 2º o Apify (o mesmo serviço que traz as inspirações do Dashboard)
    const token = Deno.env.get("APIFY_TOKEN") || "";
    if (token) {
      try {
        const r = await fetch(`https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}&timeout=50`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directUrls: [link], resultsType: "posts", resultsLimit: 1, addParentData: false }),
        });
        const itens = await r.json().catch(() => []);
        const it = Array.isArray(itens) ? itens[0] : null;
        if (it && (it.displayUrl || (it.images || [])[0])) return it.displayUrl || it.images[0];
      } catch { /* sem capa */ }
    }
  }
  return "";
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
    const link = String(corpo.link || "");
    let endereco = /^https:\/\//.test(String(corpo.imagem || "")) ? String(corpo.imagem) : "";
    if (!endereco && /^https?:\/\//.test(link)) endereco = await enderecoDaCapa(link);
    if (!endereco) return resposta({ imagem: null });
    const r = await abrir(endereco, NAVEGADOR, 10000);
    const tipo = r.headers.get("content-type") || "image/jpeg";
    if (!r.ok || !/^image\//.test(tipo)) return resposta({ imagem: null });
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length > 4_000_000) return resposta({ imagem: null });
    let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return resposta({ imagem: `data:${tipo.split(";")[0]};base64,${btoa(bin)}` });
  } catch (e) {
    console.error(e);
    return resposta({ imagem: null });
  }
});
