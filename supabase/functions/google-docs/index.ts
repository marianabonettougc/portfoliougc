// =========================================================
// GOOGLE DOCS (Edge Function do Supabase)
// Lê um documento do Google Docs para importar como roteiro no Quadro de roteiros.
// Funciona com documentos compartilhados como "Qualquer pessoa com o link" (exportação em texto do próprio Google).
// Documentos privados precisariam da conta Google conectada (OAuth), que ainda não está configurada:
// nesse caso a função devolve um erro explicando, nunca um texto falso.
// Só a dona do painel pode usar.
// Ações: {url} lê um documento inteiro; {acao:"abas"} lista as abas do Doc de roteiros (id, MARCA, PRODUTO, ENTREGA, texto);
// {acao:"aba", tab} lê uma aba só.
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const DOC_ROTEIROS = "1V7i4HEZhTdVCwgfPYsrdJ4zQ7S3_R8xDJw9I9RzcLzI"; // Doc "ROTEIROS PARA MARCAS OFICIAL"
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const PRIVADO = "Esse documento não está aberto para quem tem o link. No Google Docs, clique em Compartilhar e escolha \"Qualquer pessoa com o link: leitor\". (Ler documentos privados exige conectar a conta Google ao painel, o que ainda não está configurado.)";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ error: "Use POST." }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    // só a dona: a mesma regra do banco (e_a_dona), sem e-mail escrito no código
    const { data: dona } = await supa.rpc("e_a_dona");
    if (dona !== true) return resposta({ error: "Não autorizado" }, 401);
    const corpo = await req.json().catch(() => ({}));
    // abas do Doc "ROTEIROS PARA MARCAS OFICIAL" (uma aba por campanha): lista com MARCA, PRODUTO, ENTREGA e o texto
    if (corpo.acao === "abas" || corpo.acao === "aba") {
      const docId = String(corpo.doc || DOC_ROTEIROS).match(/[\w-]{20,}/)?.[0] || DOC_ROTEIROS;
      let ids: string[] = [];
      if (corpo.acao === "aba") ids = [String(corpo.tab || "").replace(/[^\w.]/g, "").slice(0, 40)].filter(Boolean);
      else {
        const html = await (await fetch(`https://docs.google.com/document/d/${docId}/edit`, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
        ids = ["t.0", ...new Set([...html.matchAll(/"(t\.[a-z0-9]{8,20})"/g)].map((m) => m[1]))].slice(0, 40);
      }
      const lerAba = async (tab: string) => {
        const r = await fetch(`https://docs.google.com/document/d/${docId}/export?format=txt&tab=${encodeURIComponent(tab)}`);
        if (!r.ok || /text\/html/.test(r.headers.get("content-type") || "")) return null;
        const texto = (await r.text()).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
        const campo = (nome: string) => (texto.match(new RegExp("^\\s*" + nome + "\\s*:\\s*(.+)$", "im")) || [])[1]?.trim() || "";
        return { id: tab, marca: campo("MARCA"), produto: campo("PRODUTO"), entrega: campo("ENTREGA"), formato: campo("FORMATO"), texto: texto.slice(0, 30000) };
      };
      const abas = (await Promise.all(ids.map((t) => lerAba(t).catch(() => null)))).filter((x) => x && x.texto);
      if (!abas.length) return resposta({ error: PRIVADO }, 403);
      return resposta({ abas });
    }
    const id = String(corpo.url || "").match(/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([\w-]{20,})/)?.[1];
    if (!id) return resposta({ error: "Esse não parece um link de documento do Google Docs (docs.google.com/document/d/...)." }, 400);
    const r = await fetch(`https://docs.google.com/document/d/${id}/export?format=txt`, { redirect: "manual" });
    // documento privado: o Google manda para a tela de login
    if (r.status >= 300 && r.status < 400) { const destino = r.headers.get("location") || ""; if (/accounts\.google\.com|ServiceLogin/i.test(destino)) return resposta({ error: PRIVADO }, 403); }
    let final = r;
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) final = await fetch(r.headers.get("location")!, { redirect: "follow" });
    if (final.status === 401 || final.status === 403) return resposta({ error: PRIVADO }, 403);
    if (final.status === 404) return resposta({ error: "Não encontrei esse documento. Confira o link." }, 404);
    const tipo = final.headers.get("content-type") || "";
    const texto = (await final.text()).replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();
    if (!final.ok || /text\/html/.test(tipo)) return resposta({ error: /text\/html/.test(tipo) ? PRIVADO : "O Google Docs não devolveu o documento (" + final.status + ")." }, 502);
    if (!texto) return resposta({ error: "O documento está vazio." }, 422);
    // título: primeira linha com texto (o Google não manda o nome do arquivo na exportação)
    const titulo = (texto.split("\n").find((l) => l.trim()) || "Roteiro do Google Docs").trim().slice(0, 90);
    return resposta({ titulo, texto: texto.slice(0, 50000) });
  } catch (e) {
    console.error(e);
    return resposta({ error: "Não consegui ler o documento agora. Tente de novo." }, 500);
  }
});
