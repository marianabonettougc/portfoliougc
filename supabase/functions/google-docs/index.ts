// =========================================================
// GOOGLE DOCS (Edge Function do Supabase)
// Lê um documento do Google Docs para importar como roteiro no Quadro de roteiros.
// Funciona com documentos compartilhados como "Qualquer pessoa com o link" (exportação em texto do próprio Google).
// Documentos privados precisariam da conta Google conectada (OAuth), que ainda não está configurada:
// nesse caso a função devolve um erro explicando, nunca um texto falso.
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
const PRIVADO = "Esse documento não está aberto para quem tem o link. No Google Docs, clique em Compartilhar e escolha \"Qualquer pessoa com o link: leitor\". (Ler documentos privados exige conectar a conta Google ao painel, o que ainda não está configurado.)";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ error: "Use POST." }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supa.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!user || user.email !== EMAIL_DONA) return resposta({ error: "Não autorizado" }, 401);
    const corpo = await req.json().catch(() => ({}));
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
