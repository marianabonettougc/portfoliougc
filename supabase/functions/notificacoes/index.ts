// =========================================================
// NOTIFICAÇÕES NO CELULAR (Edge Function do Supabase)
// Notificação de verdade no celular (Web Push) para o painel instalado na Tela de Início
// (admin/manifest.webmanifest + admin/sw.js), com o app ntfy como reserva.
// - { acao: "chave" }: chave pública para o celular se inscrever (sem login).
// - { acao: "inscrever", inscricao }: guarda a inscrição deste celular (só a dona).
// - { acao: "teste" }: manda uma notificação de teste agora (só a dona).
// - { acao: "enviar", titulo, texto, url }: manda uma notificação agora (só a dona; usada
//   pela função painel-conteudo quando ela salva uma referência).
// - { acao: "disparar" }: chamada a cada minuto pelo pg_cron. Manda os lembretes cujo
//   horário chegou (tabela lembretes, "Importante, notificar") e marca como enviados.
//   Não precisa de login: só manda o que já venceu e nunca manda duas vezes.
// As chaves VAPID são criadas aqui mesmo na primeira vez e ficam na tabela chaves_push,
// que só o servidor lê. Nenhuma chave vai para arquivo.
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const EMAIL_DONA = "marianabonettougc@gmail.com";
const PAINEL = "https://marianabonetto.com.br/admin/";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const txt = (x: unknown, n = 300) => String(x ?? "").replace(/\s*[—–]\s*/g, ", ").trim().slice(0, n);

const servidor = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function chaves(adm: any) {
  const { data } = await adm.from("chaves_push").select("publica, privada").eq("id", 1).maybeSingle();
  if (data) return data;
  const k = webpush.generateVAPIDKeys();
  await adm.from("chaves_push").upsert({ id: 1, publica: k.publicKey, privada: k.privateKey }, { onConflict: "id", ignoreDuplicates: true });
  const { data: d2 } = await adm.from("chaves_push").select("publica, privada").eq("id", 1).maybeSingle();
  return d2;
}

async function enviarTudo(adm: any, titulo: string, texto: string, url = PAINEL, tag?: string) {
  const k = await chaves(adm);
  webpush.setVapidDetails("mailto:" + EMAIL_DONA, k.publica, k.privada);
  const { data: inscricoes } = await adm.from("push_inscricoes").select("*");
  const carga = JSON.stringify({ titulo, texto, url, tag });
  let ok = 0;
  for (const s of inscricoes || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, { TTL: 86400, urgency: "high" });
      ok++;
    } catch (e) {
      const st = (e as any)?.statusCode;
      if (st === 404 || st === 410) await adm.from("push_inscricoes").delete().eq("id", s.id); // celular desinscrito
      else console.error("push", st, (e as any)?.body || e);
    }
  }
  // reserva: app ntfy, se ela ligou no Painel de conteúdo
  const { data: cfg } = await adm.from("configuracoes").select("valor").eq("chave", "ntfy_topico").maybeSingle();
  const topico = String(cfg?.valor || "").replace(/"/g, "").trim();
  let ntfy = false;
  if (topico) {
    const r = await fetch("https://ntfy.sh/", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: topico, title: titulo.slice(0, 120), message: (texto || titulo).slice(0, 3800), tags: ["bell"], click: url }) }).catch(() => null);
    ntfy = Boolean(r?.ok);
  }
  return { celulares: ok, inscritos: (inscricoes || []).length, ntfy };
}

function quandoBR(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function disparar(adm: any) {
  const { data: vencidos } = await adm.from("lembretes").select("*").eq("ativo", true).is("enviado_em", null).lte("quando", new Date().toISOString()).order("quando").limit(30);
  let n = 0;
  for (const l of vencidos || []) {
    // marca antes de mandar, para nunca sair duas vezes se o minuto seguinte chegar junto
    const { data: marcado } = await adm.from("lembretes").update({ enviado_em: new Date().toISOString() }).eq("id", l.id).is("enviado_em", null).select("id");
    if (!marcado?.length) continue;
    await enviarTudo(adm, "Importante: " + l.titulo, l.detalhe || `Aviso marcado para ${quandoBR(l.quando)}.`, l.url || PAINEL, "lembrete-" + l.id);
    n++;
  }
  return n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ error: "Use POST." }, 405);
  try {
    const corpo = await req.json().catch(() => ({}));
    const adm = servidor();
    if (corpo.acao === "disparar") return resposta({ enviados: await disparar(adm) });
    if (corpo.acao === "chave") return resposta({ chave: (await chaves(adm)).publica });

    const auth = req.headers.get("Authorization") || "";
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supa.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!user || user.email !== EMAIL_DONA) return resposta({ error: "Não autorizado" }, 401);

    if (corpo.acao === "inscrever") {
      const s = corpo.inscricao || {};
      if (!s.endpoint || !s.keys?.p256dh || !s.keys?.auth) return resposta({ error: "Inscrição inválida." }, 400);
      const { error } = await adm.from("push_inscricoes").upsert({ endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, aparelho: txt(corpo.aparelho, 120) }, { onConflict: "endpoint" });
      if (error) throw new Error(error.message);
      return resposta({ ok: true });
    }
    if (corpo.acao === "teste") {
      const r = await enviarTudo(adm, "Painel da Mari", "Notificações funcionando! Os avisos marcados como Importante chegam assim.", PAINEL, "teste");
      if (!r.celulares && !r.ntfy) return resposta({ error: "Nenhum celular ativado ainda. Toque em Ativar notificações no celular." }, 400);
      return resposta({ ok: true, ...r });
    }
    if (corpo.acao === "enviar") {
      return resposta({ ok: true, ...(await enviarTudo(adm, txt(corpo.titulo, 120) || "Painel da Mari", txt(corpo.texto, 3000), txt(corpo.url, 300) || PAINEL)) });
    }
    return resposta({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error(e);
    return resposta({ error: String((e as Error).message || "Algo deu errado.") }, 502);
  }
});
