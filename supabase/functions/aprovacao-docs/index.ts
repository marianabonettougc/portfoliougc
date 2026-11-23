// =========================================================
// APROVAÇÃO PELO GOOGLE DOC (Edge Function do Supabase, verify_jwt false)
// O Apps Script do Doc "ROTEIROS PARA MARCAS OFICIAL" chama esta função quando a marca
// escolhe o gancho, comenta ou aprova na página .../exec?r=<aba>.
// Confere o segredo (sha256 em configuracoes.docs_segredo_hash), acha o job ligado àquela aba
// (aprovacao_links.doc_aba), registra a resposta no mesmo fluxo do portal (aprovacao_envios/eventos)
// e manda o aviso para o celular (lembretes, disparado pelo cron em até 1 minuto).
// Corpo: { segredo, aba, abaId, tipo: "aprovar" | "comentario" | "gancho", nome, texto, parte, marca }
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const txt = (v: unknown, max: number) => String(v ?? "").replace(/\u0000/g, "").trim().slice(0, max);
async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const URL_JOBS = "https://marianabonetto.com.br/admin/#aprovacoes";

Deno.serve(async (req) => {
  if (req.method !== "POST") return resposta({ error: "Use POST." }, 405);
  try {
    const corpo = await req.json().catch(() => ({}));
    const adm = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: cfg } = await adm.from("configuracoes").select("valor").eq("chave", "docs_segredo_hash").maybeSingle();
    if (!cfg || !cfg.valor || (await sha256(txt(corpo.segredo, 200))) !== cfg.valor) return resposta({ error: "Não autorizado." }, 401);

    const aba = txt(corpo.aba, 120), tipo = txt(corpo.tipo, 20), nome = txt(corpo.nome, 80), texto = txt(corpo.texto, 4000), parte = txt(corpo.parte, 300);
    if (!aba || !["aprovar", "comentario", "gancho"].includes(tipo)) return resposta({ error: "Pedido inválido." }, 400);
    const agora = new Date().toISOString();

    // job ligado a esta aba (o último cadastrado, se por engano houver dois)
    // pelo nome da aba ou pelo código dela (t.xxxx, que o painel guarda quando puxa o roteiro do Doc)
    const abaId = txt(corpo.abaId, 80);
    let link = null;
    if (abaId) {
      const { data: porId } = await adm.from("aprovacao_links").select("job_id, marca, ativo").eq("doc_tab", abaId).order("criado_em", { ascending: false }).limit(1);
      link = porId && porId[0];
    }
    if (!link) {
      const { data: links } = await adm.from("aprovacao_links").select("job_id, marca, ativo").ilike("doc_aba", aba.replace(/[%_\\]/g, "\\$&")).order("criado_em", { ascending: false }).limit(1);
      link = links && links[0];
    }
    if (!link) {
      const { data: links } = await adm.from("aprovacao_links").select("job_id, marca, ativo").eq("doc_tab", aba).order("criado_em", { ascending: false }).limit(1);
      link = links && links[0];
    }
    const marca = (link && link.marca) || txt(corpo.marca, 80) || aba;

    let eventoId = "", ligado = false;
    if (link) {
      const { data: envios } = await adm.from("aprovacao_envios").select("id, versao, situacao").eq("job_id", link.job_id).eq("tipo", "roteiro").order("versao", { ascending: false }).limit(1);
      const envio = envios && envios[0];
      if (envio) {
        ligado = true;
        if (tipo === "aprovar" && envio.situacao !== "aprovado") {
          // no Doc o roteiro é editado ao vivo: a marca pode comentar e depois aprovar a mesma versão
          await adm.from("aprovacao_envios").update({ situacao: "aprovado", respondido_em: agora }).eq("id", envio.id);
          const { data: ev } = await adm.from("aprovacao_eventos").insert({ envio_id: envio.id, job_id: link.job_id, tipo: "aprovado", autor: nome || null, texto: texto || null }).select("id").single();
          eventoId = String(ev?.id || "");
        } else if (tipo === "comentario" && envio.situacao !== "aprovado") {
          await adm.from("aprovacao_envios").update({ situacao: "ajustes", respondido_em: agora }).eq("id", envio.id);
          const { data: ev } = await adm.from("aprovacao_eventos").insert({ envio_id: envio.id, job_id: link.job_id, tipo: "ajustes", autor: nome || null, texto: (parte ? `[${parte}] ` : "") + texto || null }).select("id").single();
          eventoId = String(ev?.id || "");
        } else if (tipo === "gancho") {
          // só guarda o gancho escolhido no envio aberto (aparece no job junto da próxima resposta)
          await adm.from("aprovacao_eventos").insert({ envio_id: envio.id, job_id: link.job_id, tipo: "abriu", autor: nome || null, gancho: parte || texto || null, aplicado: true }).then(() => null, () => null);
        }
      }
    }

    // aviso no celular (sempre, mesmo se a aba ainda não estiver ligada a um job)
    const titulo = tipo === "aprovar" ? `${marca} aprovou o roteiro` : tipo === "comentario" ? `${marca} comentou no roteiro` : `${marca} escolheu o gancho`;
    const detalhe = tipo === "gancho" ? `${parte || texto}` : [nome ? `${nome}` : "", parte && tipo === "comentario" ? `em ${parte}` : "", texto].filter(Boolean).join(": ");
    await adm.from("lembretes").insert({ item_tipo: "aprovacao", item_id: eventoId || `doc-${aba}-${tipo}-${agora}`, titulo: titulo.slice(0, 120),
      detalhe: (detalhe || `Aba ${aba}`).slice(0, 600), url: URL_JOBS, quando: agora }).then(() => null, () => null);

    return resposta({ ok: true, ligado });
  } catch (e) {
    console.error(e);
    return resposta({ error: "Falha ao registrar." }, 500);
  }
});
