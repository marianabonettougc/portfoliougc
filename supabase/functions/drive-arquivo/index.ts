// =========================================================
// DRIVE ARQUIVO (Edge Function do Supabase, nov/2026)
// Traz para o painel um arquivo do Google Drive dela que está aberto para "qualquer pessoa com o link"
// (ex.: o vídeo final que ela subiu na pasta APROVAÇÕES DE CONTEÚDOS). Só a dona pode usar.
// Ações: {acao:"info", id} devolve nome, tipo e tamanho; {id} devolve o arquivo (stream).
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "content-length, content-type, x-nome",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const auth = req.headers.get("Authorization") || "";
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: dona } = await supa.rpc("e_a_dona");
    if (dona !== true) return resposta({ error: "Não autorizado" }, 401);
    const corpo = await req.json().catch(() => ({}));
    const id = String(corpo.id || "").match(/[\w-]{20,}/)?.[0];
    if (!id) return resposta({ error: "Mande o link ou o id do arquivo do Drive." }, 400);
    const r = await fetch(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`, { redirect: "follow" });
    const tipo = r.headers.get("content-type") || "";
    if (!r.ok || /text\/html/.test(tipo)) {
      return resposta({ error: "Não consegui baixar esse arquivo. No Drive, ele precisa estar como \"Qualquer pessoa com o link\"." }, 404);
    }
    const disp = r.headers.get("content-disposition") || "";
    const nome = decodeURIComponent((disp.match(/filename\*=UTF-8''([^;]+)/) || [])[1] || (disp.match(/filename="([^"]+)"/) || [])[1] || "video");
    if (corpo.acao === "info") {
      try { await r.body?.cancel(); } catch (_) { /* segue */ }
      return resposta({ ok: true, nome, tipo, tamanho: Number(r.headers.get("content-length") || 0) });
    }
    const h: Record<string, string> = { ...CORS, "Content-Type": tipo || "application/octet-stream", "x-nome": encodeURIComponent(nome) };
    const len = r.headers.get("content-length"); if (len) h["Content-Length"] = len;
    return new Response(r.body, { status: 200, headers: h });
  } catch (e) {
    return resposta({ error: String((e as Error)?.message || e) }, 500);
  }
});
