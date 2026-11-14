// =========================================================
// PORTAL DE APROVAÇÃO (Edge Function do Supabase, verify_jwt false)
// A marca abre marianabonetto.com.br/aprovar/?t=<código> e esta função é a ÚNICA porta dela:
// confere o código (sha256 em aprovacao_links), devolve só o que a marca pode ver
// (marca, produto, roteiro/vídeo enviado e o histórico de respostas daquele job) e registra a resposta.
// Nunca devolve valores, briefing, observações nem nada de outro job.
// Ações: { acao: "ver", t, previa } e { acao: "responder", t, envio, tipo: aprovado|ajustes|refacao, nome, texto, gancho }
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const txt = (v: unknown, max: number) => String(v ?? "").replace(/\u0000/g, "").trim().slice(0, max);
async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const INVALIDO = "Este link não está mais ativo. Fale com a Mari para receber um link novo.";
const FRASE: Record<string, string> = { aprovado: "aprovou", ajustes: "pediu ajustes", refacao: "pediu refação" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ error: "Use POST." }, 405);
  try {
    const corpo = await req.json().catch(() => ({}));
    const t = txt(corpo.t, 200);
    if (!/^[A-Za-z0-9_-]{30,}$/.test(t)) return resposta({ error: INVALIDO }, 404);
    const adm = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: link } = await adm.from("aprovacao_links").select("job_id, marca, produto, ativo").eq("token_hash", await sha256(t)).maybeSingle();
    if (!link || !link.ativo) return resposta({ error: INVALIDO }, 404);

    const { data: envios } = await adm.from("aprovacao_envios").select("id, tipo, versao, titulo, conteudo, video, situacao, enviado_em, respondido_em")
      .eq("job_id", link.job_id).order("enviado_em", { ascending: true });
    const lista = envios || [];
    const ultimo = (tipo: string) => lista.filter((e) => e.tipo === tipo).slice(-1)[0];

    if (corpo.acao === "responder") {
      const tipo = txt(corpo.tipo, 20), nome = txt(corpo.nome, 80), texto = txt(corpo.texto, 4000), gancho = txt(corpo.gancho, 600);
      if (!FRASE[tipo]) return resposta({ error: "Resposta desconhecida." }, 400);
      const envio = lista.find((e) => e.id === Number(corpo.envio));
      if (!envio) return resposta({ error: "Não encontrei este envio." }, 404);
      if (ultimo(envio.tipo).id !== envio.id) return resposta({ error: "A Mari já enviou uma versão mais nova. Atualize a página para ver.", versaoNova: true }, 409);
      // já respondido: não conta duas vezes, só mostra o que ficou registrado
      if (envio.situacao !== "enviado") return resposta({ ok: true, repetido: true, situacao: envio.situacao });
      if (!nome) return resposta({ error: "Escreva seu nome para registrar a resposta." }, 400);
      if (tipo !== "aprovado" && texto.length < 3) return resposta({ error: "Explique o que precisa mudar." }, 400);
      const agora = new Date().toISOString();
      const { data: mudou } = await adm.from("aprovacao_envios").update({ situacao: tipo, respondido_em: agora }).eq("id", envio.id).eq("situacao", "enviado").select("id");
      if (!mudou || !mudou.length) return resposta({ ok: true, repetido: true });
      const { data: ev } = await adm.from("aprovacao_eventos").insert({ envio_id: envio.id, job_id: link.job_id, tipo, autor: nome, texto: texto || null, gancho: gancho || null }).select("id").single();
      // aviso no celular da Mari: entra como lembrete para agora (o cron do banco dispara em até 1 minuto)
      const oque = envio.tipo === "video" ? "o vídeo" : "o roteiro";
      const titulo = tipo === "aprovado" ? `${link.marca || "A marca"} aprovou ${oque}` : `${link.marca || "A marca"} ${FRASE[tipo]} n${oque}`;
      await adm.from("lembretes").insert({ item_tipo: "aprovacao", item_id: String(ev?.id || envio.id + "-" + tipo), titulo: titulo.slice(0, 120),
        detalhe: (texto ? `${nome}: ${texto}` : `Por ${nome}.`).slice(0, 600), url: "https://marianabonetto.com.br/admin/#campanhas", quando: agora }).then(() => null, () => null);
      return resposta({ ok: true, situacao: tipo, em: agora });
    }

    // ver: registra a primeira abertura de cada envio (menos na prévia da própria Mari)
    const { data: eventos } = await adm.from("aprovacao_eventos").select("envio_id, tipo, autor, texto, gancho, criado_em").eq("job_id", link.job_id).order("criado_em", { ascending: true });
    const evs = eventos || [];
    if (!corpo.previa) {
      for (const tipo of ["roteiro", "video"]) {
        const e = ultimo(tipo);
        if (e && e.situacao === "enviado" && !evs.some((x) => x.envio_id === e.id && x.tipo === "abriu"))
          await adm.from("aprovacao_eventos").insert({ envio_id: e.id, job_id: link.job_id, tipo: "abriu", aplicado: true }).then(() => null, () => null);
      }
    }
    return resposta({
      marca: link.marca, produto: link.produto,
      envios: lista.map((e) => ({ id: e.id, tipo: e.tipo, versao: e.versao, titulo: e.titulo, conteudo: e.conteudo, situacao: e.situacao, enviado_em: e.enviado_em, respondido_em: e.respondido_em,
        atual: ultimo(e.tipo).id === e.id })),
      historico: evs.filter((x) => x.tipo !== "abriu").map((x) => { const e = lista.find((y) => y.id === x.envio_id); return { tipo: x.tipo, autor: x.autor, texto: x.texto, gancho: x.gancho, em: x.criado_em, de: e ? e.tipo : "roteiro", versao: e ? e.versao : 1 }; }),
    });
  } catch (e) {
    console.error(e);
    return resposta({ error: "Não consegui carregar agora. Tente de novo em instantes." }, 500);
  }
});
