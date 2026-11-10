// Edge Function "instagram": DESLIGADA em 10/11/2026 (pedido da Mari).
// Ela lia o Instagram pela API da Meta com um token de app de desenvolvedor (graph.instagram.com / graph.facebook.com).
// Em 09/11/2026 a Meta restringiu os anúncios da conta profissional e a Mari pediu para tirar qualquer ligação
// que pudesse parecer suspeita. Os números agora vêm do Metricool (parceiro oficial da Meta), gravados em
// configuracoes "metricool_instagram" (js/metricool-ig.js). O código antigo está no histórico do git.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  return new Response(JSON.stringify({ conectado: false, desligada: true, error: "Desligada por segurança: os números do Instagram vêm do Metricool." }), { status: 410, headers: CORS });
});
