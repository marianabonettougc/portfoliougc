// =========================================================
// PORTAL DO CLIENTE (Edge Function do Supabase, verify_jwt false; faz a própria checagem)
// A marca abre o link marianabonetto.com.br/cliente/?m=<código> e digita só a senha que a Mari criou no painel
// (tabela portal_marcas, senha em PBKDF2) e vê SÓ a pasta dela: os jobs ligados a ela
// (aprovacao_links.portal_marca_id), com o roteiro enviado, as versões e o histórico.
// Nunca devolve valores, briefing, observações nem nada de outra marca.
// Ações da marca: marca {m}, entrar {login: código do link, senha}, sair {s}, pasta {s}, responder {s, job, envio, tipo, nome, texto, gancho}
// Ação da Mari (com o login dela no painel): previa {marca_id} = a pasta como a marca vê, sem registrar nada.
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
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
function novoToken() { const b = new Uint8Array(32); crypto.getRandomValues(b); return b64(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

// senha guardada como "pbkdf2$<voltas>$<sal base64>$<hash base64>" (o painel calcula igual no navegador)
async function confereSenha(senha: string, guardado: string) {
  const p = String(guardado || "").split("$");
  if (p.length !== 4 || p[0] !== "pbkdf2") return false;
  const voltas = Number(p[1]);
  if (!(voltas >= 50000 && voltas <= 1000000)) return false;
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: deB64(p[2]), iterations: voltas }, chave, 256));
  const esperado = deB64(p[3]);
  if (esperado.length !== bits.length) return false;
  let dif = 0; for (let i = 0; i < bits.length; i++) dif |= bits[i] ^ esperado[i];
  return dif === 0;
}

const SAIU = "Sua sessão terminou. Digite a senha de novo.";
const ERRO_LOGIN = "Senha não confere. Confira e tente de novo.";
const FRASE: Record<string, string> = { aprovado: "aprovou", ajustes: "pediu ajustes", refacao: "pediu refação" };
const DOC_APROVACAO_URL = "https://script.google.com/macros/s/AKfycbzpQfjXGILijQDYVB_dDVm-3z4GFtGtFCOuXka1r5g34T-5AuHFypzV-00R705q7jJibw/exec";
const DIAS_SESSAO = 30, MAX_FALHAS = 5, MIN_BLOQUEIO = 15;

// deno-lint-ignore no-explicit-any
type Adm = any;

async function montarPasta(adm: Adm, marcaId: string, registrar: boolean) {
  const { data: links } = await adm.from("aprovacao_links").select("job_id, marca, produto, resumo, doc_aba, criado_em")
    .eq("portal_marca_id", marcaId).eq("ativo", true).order("criado_em", { ascending: false });
  const ls = links || [];
  if (!ls.length) return [];
  const ids = ls.map((l: Adm) => l.job_id);
  const [{ data: envios }, { data: eventos }] = await Promise.all([
    adm.from("aprovacao_envios").select("id, job_id, tipo, versao, titulo, conteudo, video, situacao, enviado_em, respondido_em").in("job_id", ids).order("enviado_em", { ascending: true }),
    adm.from("aprovacao_eventos").select("envio_id, job_id, tipo, autor, texto, gancho, criado_em").in("job_id", ids).order("criado_em", { ascending: true }),
  ]);
  const todos = envios || [], evs = eventos || [];
  // vídeos para aprovar: link assinado de 6 horas do bucket privado "videos" (a marca nunca vê o caminho)
  const assinados: Record<number, string> = {};
  await Promise.all(todos.filter((e: Adm) => e.tipo === "video" && e.video && e.video.path).map(async (e: Adm) => {
    const { data } = await adm.storage.from("videos").createSignedUrl(e.video.path, 6 * 3600);
    if (data) assinados[e.id] = data.signedUrl;
  }));
  const jobs = [];
  for (const l of ls) {
    const lista = todos.filter((e: Adm) => e.job_id === l.job_id);
    const ultimo = (tipo: string) => lista.filter((e: Adm) => e.tipo === tipo).slice(-1)[0];
    const doDoc = String(l.doc_aba || "").trim();
    if (registrar) {
      for (const tipo of ["roteiro", "video"]) {
        const e = ultimo(tipo);
        if (e && e.situacao === "enviado" && !evs.some((x: Adm) => x.envio_id === e.id && x.tipo === "abriu"))
          await adm.from("aprovacao_eventos").insert({ envio_id: e.id, job_id: l.job_id, tipo: "abriu", aplicado: true }).then(() => null, () => null);
      }
    }
    jobs.push({
      id: l.job_id, marca: l.marca, produto: l.produto, resumo: l.resumo || "",
      doc: doDoc ? DOC_APROVACAO_URL + "?r=" + encodeURIComponent(doDoc) : "",
      envios: lista.map((e: Adm) => ({ id: e.id, tipo: e.tipo, versao: e.versao, titulo: e.titulo, conteudo: doDoc && e.tipo === "roteiro" ? "" : e.conteudo, situacao: e.situacao,
        video: assinados[e.id] || "",
        enviado_em: e.enviado_em, respondido_em: e.respondido_em, atual: ultimo(e.tipo).id === e.id })),
      historico: evs.filter((x: Adm) => x.job_id === l.job_id && x.tipo !== "abriu").map((x: Adm) => {
        const e = lista.find((y: Adm) => y.id === x.envio_id);
        return { tipo: x.tipo, autor: x.autor, texto: x.texto, gancho: x.gancho, em: x.criado_em, de: e ? e.tipo : "roteiro", versao: e ? e.versao : 1 };
      }),
    });
  }
  return jobs;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ error: "Use POST." }, 405);
  try {
    const corpo = await req.json().catch(() => ({}));
    const acao = txt(corpo.acao, 20);
    const adm = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ---------- prévia da Mari: confere que quem chama é a dona (pelo login dela no painel) ----------
    if (acao === "previa") {
      const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const eu = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: "Bearer " + jwt } } });
      const { data: dona } = await eu.rpc("e_a_dona");
      if (dona !== true) return resposta({ error: "Só a Mari vê a prévia." }, 403);
      const { data: m } = await adm.from("portal_marcas").select("id, marca").eq("id", txt(corpo.marca_id, 60)).maybeSingle();
      if (!m) return resposta({ error: "Acesso não encontrado." }, 404);
      return resposta({ marca: m.marca, previa: true, jobs: await montarPasta(adm, m.id, false) });
    }

    // ---------- nome da marca do link (para a tela de senha dizer de quem é a área) ----------
    if (acao === "marca") {
      const login = txt(corpo.m, 80).toLowerCase();
      const { data: m } = login ? await adm.from("portal_marcas").select("marca, ativo").eq("login", login).maybeSingle() : { data: null };
      if (!m || !m.ativo) return resposta({ error: "Este link não está ativo. Fale com a Mari para receber o link certo." }, 404);
      return resposta({ marca: m.marca });
    }

    // ---------- entrar (o "login" é o código do link: ?m=<código>) ----------
    if (acao === "entrar") {
      const login = txt(corpo.login, 80).toLowerCase(), senha = String(corpo.senha ?? "").slice(0, 200);
      if (!login) return resposta({ error: "Abra a área pelo link que a Mari enviou." }, 400);
      if (!senha) return resposta({ error: "Escreva sua senha." }, 400);
      const { data: m } = await adm.from("portal_marcas").select("id, marca, senha_hash, ativo, falhas, bloqueado_ate").eq("login", login).maybeSingle();
      if (!m || !m.ativo) { await new Promise((r) => setTimeout(r, 600)); return resposta({ error: ERRO_LOGIN }, 401); }
      if (m.bloqueado_ate && new Date(m.bloqueado_ate).getTime() > Date.now())
        return resposta({ error: `Muitas tentativas erradas. Tente de novo em ${MIN_BLOQUEIO} minutos.` }, 429);
      if (!(await confereSenha(senha, m.senha_hash))) {
        const falhas = (m.falhas || 0) + 1;
        await adm.from("portal_marcas").update(falhas >= MAX_FALHAS
          ? { falhas: 0, bloqueado_ate: new Date(Date.now() + MIN_BLOQUEIO * 60000).toISOString() }
          : { falhas }).eq("id", m.id);
        return resposta({ error: ERRO_LOGIN }, 401);
      }
      const s = novoToken(), expira = new Date(Date.now() + DIAS_SESSAO * 86400000).toISOString();
      await adm.from("portal_sessoes").delete().eq("marca_id", m.id).lt("expira_em", new Date().toISOString());
      await adm.from("portal_sessoes").insert({ token_hash: await sha256(s), marca_id: m.id, expira_em: expira });
      await adm.from("portal_marcas").update({ falhas: 0, bloqueado_ate: null, ultimo_acesso: new Date().toISOString() }).eq("id", m.id);
      return resposta({ ok: true, s, marca: m.marca, expira });
    }

    // ---------- daqui para baixo precisa de sessão ----------
    const s = txt(corpo.s, 200);
    if (!/^[A-Za-z0-9_-]{30,}$/.test(s)) return resposta({ error: SAIU, sair: true }, 401);
    const hs = await sha256(s);
    const { data: sessao } = await adm.from("portal_sessoes").select("marca_id, expira_em").eq("token_hash", hs).maybeSingle();
    if (!sessao || new Date(sessao.expira_em).getTime() < Date.now()) return resposta({ error: SAIU, sair: true }, 401);
    const { data: m } = await adm.from("portal_marcas").select("id, marca, ativo").eq("id", sessao.marca_id).maybeSingle();
    if (!m || !m.ativo) return resposta({ error: "Este acesso foi desligado. Fale com a Mari.", sair: true }, 401);

    if (acao === "sair") { await adm.from("portal_sessoes").delete().eq("token_hash", hs); return resposta({ ok: true }); }

    if (acao === "pasta") {
      await adm.from("portal_marcas").update({ ultimo_acesso: new Date().toISOString() }).eq("id", m.id);
      return resposta({ marca: m.marca, jobs: await montarPasta(adm, m.id, true) });
    }

    if (acao === "responder") {
      const jobId = txt(corpo.job, 80);
      const { data: link } = await adm.from("aprovacao_links").select("job_id, marca, doc_aba").eq("job_id", jobId).eq("portal_marca_id", m.id).eq("ativo", true).maybeSingle();
      if (!link) return resposta({ error: "Não encontrei este projeto na sua pasta." }, 404);
      const tipo = txt(corpo.tipo, 20), nome = txt(corpo.nome, 80), texto = txt(corpo.texto, 4000), gancho = txt(corpo.gancho, 600);
      if (!FRASE[tipo]) return resposta({ error: "Resposta desconhecida." }, 400);
      const { data: envios } = await adm.from("aprovacao_envios").select("id, tipo, versao, situacao").eq("job_id", link.job_id).order("enviado_em", { ascending: true });
      const lista = envios || [];
      const envio = lista.find((e: Adm) => e.id === Number(corpo.envio));
      if (!envio) return resposta({ error: "Não encontrei este envio." }, 404);
      if (envio.tipo === "roteiro" && String(link.doc_aba || "").trim()) return resposta({ error: "Este roteiro é aprovado pelo Google Doc. Use o botão Abrir o roteiro." }, 400);
      const ult = lista.filter((e: Adm) => e.tipo === envio.tipo).slice(-1)[0];
      if (ult.id !== envio.id) return resposta({ error: "A Mari já enviou uma versão mais nova. Atualize a página para ver.", versaoNova: true }, 409);
      if (envio.situacao !== "enviado") return resposta({ ok: true, repetido: true, situacao: envio.situacao });
      if (!nome) return resposta({ error: "Escreva seu nome para registrar a resposta." }, 400);
      if (tipo !== "aprovado" && texto.length < 3) return resposta({ error: "Explique o que precisa mudar." }, 400);
      const agora = new Date().toISOString();
      const { data: mudou } = await adm.from("aprovacao_envios").update({ situacao: tipo, respondido_em: agora }).eq("id", envio.id).eq("situacao", "enviado").select("id");
      if (!mudou || !mudou.length) return resposta({ ok: true, repetido: true });
      const { data: ev } = await adm.from("aprovacao_eventos").insert({ envio_id: envio.id, job_id: link.job_id, tipo, autor: nome, texto: texto || null, gancho: gancho || null }).select("id").single();
      const oque = envio.tipo === "video" ? "o vídeo" : "o roteiro";
      const quem = m.marca || link.marca || "A marca";
      const titulo = tipo === "aprovado" ? `${quem} aprovou ${oque}` : `${quem} ${FRASE[tipo]} n${oque}`;
      await adm.from("lembretes").insert({ item_tipo: "aprovacao", item_id: String(ev?.id || envio.id + "-" + tipo), titulo: titulo.slice(0, 120),
        detalhe: (texto ? `${nome}: ${texto}` : `Por ${nome}.`).slice(0, 600), url: "https://marianabonetto.com.br/admin/#aprovacoes", quando: agora }).then(() => null, () => null);
      return resposta({ ok: true, situacao: tipo, em: agora });
    }

    return resposta({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error(e);
    return resposta({ error: "Não consegui carregar agora. Tente de novo em instantes." }, 500);
  }
});
