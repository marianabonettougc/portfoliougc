// =========================================================
// SKILL UGC (Edge Function do Supabase)
// O motor único de roteiro do painel. Lê a Skill "roteiro-ugc" (SKILL.md e as
// referências, guardadas na tabela metodo_roteiro e no repositório em
// skills/roteiro-ugc) e usa só as partes que cada pedido precisa, para caber no
// limite grátis do Groq (8000 tokens por minuto).
// Ações (corpo JSON, campo "acao"):
// - "criar": briefing, produto, objetivo, público, formato, duração, falas
//   obrigatórias, restrições, observações, transcrições, imagens e, se tiver,
//   uma referência. Devolve checklist do briefing, alertas, campos faltando,
//   tipo, estrutura, 2 ou 3 ganchos, o roteiro em blocos (fala e cena), CTA,
//   legenda, duração calculada pelo ritmo de fala e a decisão de ângulo.
// - "revisar": confere um roteiro contra a Skill e devolve os problemas e o
//   roteiro inteiro corrigido.
// - "ajustar": aplica um pedido ("mais curto", "gancho de objeção") e devolve
//   o roteiro inteiro.
// - "analisar": lê a transcrição de um vídeo de referência e separa o que se
//   vê no vídeo (observado) do que é leitura da IA (interpretação).
// - multipart com "audio": transcreve a ideia falada.
// Conferências feitas aqui no servidor: sem travessão, sem as construções
// proibidas da Skill ("não é X, é Y", "aí eu descobri"...), duração pelo ritmo
// real. Se sobrar erro, a IA corrige uma vez só as falas com problema.
// Chave do Groq só no segredo GROQ_API_KEY. Só a dona do painel pode usar (ou o próprio
// banco, com o cabeçalho x-cron = segredos_servidor "cron_painel").
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const EMAIL_DONA = "marianabonettougc@gmail.com";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
class Limite extends Error {}

// ---------- Groq ----------
let modelosGroq: { texto: string; audio: string; visao: string } | null = null;
async function modelos(chave: string) {
  if (modelosGroq) return modelosGroq;
  let ids: string[] = [];
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${chave}` } });
    const j = await r.json();
    ids = (j.data || []).filter((m: any) => m.active !== false).map((m: any) => String(m.id));
  } catch { /* nomes padrão */ }
  const texto = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "moonshotai/kimi-k2-instruct-0905", "qwen/qwen3-32b", "openai/gpt-oss-20b"].find((p) => ids.includes(p)) || "openai/gpt-oss-120b";
  const audio = ["whisper-large-v3-turbo", "whisper-large-v3"].find((p) => ids.includes(p)) || "whisper-large-v3-turbo";
  const visao = ["qwen/qwen3.8-27b", "meta-llama/llama-4-maverick-17b-128e-instruct", "meta-llama/llama-4-scout-17b-16e-instruct"].find((p) => ids.includes(p)) || ids.find((id) => /qwen3\.[5-9]|vision|llama-4|-vl/i.test(id)) || "qwen/qwen3.8-27b";
  if (ids.length) modelosGroq = { texto, audio, visao };
  return { texto, audio, visao };
}
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tokens = (t: string) => Math.ceil(t.length / 3.4);

async function conversar(chave: string, sistema: string, pedido: string, opcoes: { max: number; temperatura?: number; modelo?: string }) {
  const m = await modelos(chave);
  const modelo = opcoes.modelo || m.texto;
  const pedir = (comJson: boolean) => fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelo, temperature: opcoes.temperatura ?? 0.6, max_tokens: opcoes.max,
      ...(/gpt-oss/.test(modelo) ? { reasoning_effort: "low" } : {}),
      ...(comJson ? { response_format: { type: "json_object" } } : {}),
      messages: [{ role: "system", content: sistema }, { role: "user", content: pedido }],
    }),
  });
  let r = await pedir(true);
  let j = await r.json().catch(() => ({}));
  if (r.status === 429) {
    const espera = Number(String(j?.error?.message || "").match(/try again in ([\d.]+)s/)?.[1] || 0);
    if (espera && espera <= 20) { await esperar(espera * 1000 + 300); r = await pedir(true); j = await r.json().catch(() => ({})); }
  }
  if (!r.ok && r.status !== 429 && r.status !== 413) { r = await pedir(false); j = await r.json().catch(() => ({})); }
  if (!r.ok) {
    if (r.status === 404) modelosGroq = null;
    const msg = String(j?.error?.message || "Groq respondeu " + r.status);
    if (r.status === 429 || r.status === 413 || /rate limit|tokens per (minute|day)|TPM|TPD/i.test(msg)) throw new Limite(msg);
    throw new Error(msg);
  }
  return String(j.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
// tenta o modelo principal; se o limite estourar ou a resposta vier vazia, usa o Qwen (tem cota própria)
async function pedirJson(chave: string, sistema: string, pedido: string, valido: (j: any) => boolean, max: number, temperatura = 0.6) {
  const espaco = 7800 - tokens(sistema + pedido);
  let ultimoErro: unknown = null;
  const tentativas: { modelo?: string; max: number }[] = [{ max: Math.max(1800, Math.min(max, espaco)) }, { modelo: (await modelos(chave)).visao, max: Math.min(max + 800, 5000) }];
  for (const t of tentativas) {
    try {
      const j = lerJson(await conversar(chave, sistema, pedido, { ...t, temperatura }));
      if (valido(j)) return j;
      ultimoErro = new Error("resposta incompleta");
    } catch (e) { ultimoErro = e; console.error("Tentativa falhou:", String((e as Error).message)); }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error("sem resposta");
}
const lerJson = (t: string) => { try { return JSON.parse(t); } catch { const m = t.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : {}; } catch { return {}; } } };

// ---------- texto ----------
const semTravessao = (t: unknown) => String(t ?? "").replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",").trim();
const txt = (x: unknown, n = 800) => semTravessao(x).slice(0, n);
const lista = (x: unknown, n = 12, tam = 300) => (Array.isArray(x) ? x : []).map((i) => txt(typeof i === "string" ? i : (i?.texto || i?.item || ""), tam)).filter(Boolean).slice(0, n);

// construções proibidas pela Skill (references/linguagem.md)
const FRASE_PROIBIDA = /\bn[aã]o [eé] (s[oó] |sobre |isso|apenas )[^.!?]{0,60}, [eé] |o problema n[aã]o [eé]|a[ií] eu (descobri|conheci)|hoje eu descobri|foi a[ií] que|foi quando|[eé] o tipo de|voc[eê] j[aá] reparou|voc[eê] sabia que|e sinceramente\?|isso muda (tudo|o jogo)|ol[aá],? pessoal|hoje vou falar sobre|queria compartilhar com voc[eê]s|hoje vim indicar|tem produtos? que|se voc[eê] ainda t[aá] no ciclo|at[eé] que (eu )?(descobri|conheci|encontrei)|de um lado[^.!?]{0,60}do outro|n[aã]o [eé] [^.!?,]{1,40}, [eé] [^.!?]{1,40}|\bdescobri (o|a|os|as|esse|essa|este|esta|um|uma)\b|\b(a[ií]|ent[aã]o) (eu )?conheci\b|eu sou a mari|meu nome [eé]/i;
// resultado, prazo ou depoimento que ela não contou (references/compliance.md: nunca inventar dado)
const ALVO = "(?:manchas?|espinhas?|olheiras?|rugas?|linhas de express[aã]o|celulite|estrias?|acne|poros?|oleosidade|frizz|queda|pele|cabelo|fios|rosto)";
const MUDOU = "(?:desapareceram|desapareceu|sumiram|sumiu|clarearam|clareou|diminu[ií]ram|diminuiu|melhoraram|melhorou|mudou|ficou|ficaram)";
const RESULTADO = new RegExp(`\\b(?:depois de|em|ap[oó]s|h[aá]) (?:poucos|uma|duas|tr[eê]s|quatro|\\d+) (?:semanas?|dias?|m[eê]s|meses)\\b|${ALVO}[^.!?]{0,30}${MUDOU}|${MUDOU}[^.!?]{0,20}${ALVO}|resultado (?:imediato|na hora)|j[aá] d[aá] pra ver a diferen[cç]a|[uú]ltima unidade|(?:amiga|m[aã]e|irm[aã]|marido|namorado) (?:testou|usou|notou|amou|adorou)`, "i");
const GANCHO_BATIDO = /^\s*(voc[eê] j[aá] (cansou|acordou|se sentiu|sofreu)|cansad[ao] de|sabia que|descobri o segredo|chega de|quer saber como|\d+ passos simples|j[aá] acordou|adeus)/i;

// ---------- a Skill ----------
type Arquivo = { arquivo: string; conteudo: string; atualizado_em?: string };
let skillCache: { arquivos: Record<string, string>; versao: string; quando: number } | null = null;
async function carregarSkill(supa: any) {
  if (skillCache && Date.now() - skillCache.quando < 5 * 60000) return skillCache;
  const { data, error } = await supa.from("metodo_roteiro").select("arquivo, conteudo, atualizado_em").order("ordem");
  if (error || !data?.length) throw new Error("Não encontrei a Skill UGC no banco (tabela metodo_roteiro).");
  const arquivos: Record<string, string> = {};
  let juntos = "", ultima = "";
  for (const a of data as Arquivo[]) {
    arquivos[a.arquivo] = String(a.conteudo || "");
    juntos += a.arquivo + a.conteudo;
    if (a.atualizado_em && a.atualizado_em > ultima) ultima = a.atualizado_em;
  }
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(juntos)))).slice(0, 4).map((b) => b.toString(16).padStart(2, "0")).join("");
  skillCache = { arquivos, versao: `roteiro-ugc ${String(ultima).slice(0, 10)} ${hash}`, quando: Date.now() };
  return skillCache;
}
// o SKILL.md sem o cabeçalho e sem as partes de documento e lista de arquivos (não ajudam a escrever)
function nucleo(skill: string) {
  return skill.replace(/^---[\s\S]*?---\s*/, "")
    .replace(/## A entrega[\s\S]*?(?=## O fluxo completo)/, "")
    .replace(/## Arquivos de referência[\s\S]*$/, "")
    .replace(/Leia `references\/[^`]+`[^.]*\.\s*/g, "")
    .replace(/\n{3,}/g, "\n\n").trim();
}
// junta as partes da Skill por prioridade, até o orçamento de tokens
// tira seções (pelo título "## ...") que não ajudam neste pedido
function semSecoes(texto: string, tirar?: RegExp) {
  if (!tirar) return texto;
  return texto.split(/(?=^## )/m).filter((s) => !(/^## /.test(s) && tirar.test(s.split("\n")[0]))).join("").trim();
}
function montarSkill(arquivos: Record<string, string>, ordem: string[], orcamento: number, cortes: Record<string, RegExp> = {}) {
  const usados: string[] = [];
  let texto = "";
  for (const nome of [...new Set(ordem)]) {
    const bruto = semSecoes(nome === "SKILL.md" ? nucleo(arquivos["SKILL.md"] || "") : String(arquivos["references/" + nome] || "").trim(), cortes[nome]);
    if (!bruto) continue;
    const parte = `\n\n### ${nome === "SKILL.md" ? "MÉTODO CENTRAL (SKILL.md)" : "REFERÊNCIA " + nome}\n${bruto}`;
    if (usados.length && tokens(texto + parte) > orcamento) continue;
    texto += parte; usados.push(nome);
  }
  return { texto: texto.trim(), usados };
}

// ---------- duração (references/duracao.md) ----------
function contarPalavras(t: string) {
  return String(t || "").replace(/\([^)]*\)|\[[^\]]*\]/g, " ").split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w)).length;
}
function calcularDuracao(blocos: any[], ritmo: number, alvo: number) {
  const palavras = contarPalavras(blocos.map((b) => b.fala).join(" "));
  const segundos = Math.round(palavras / ritmo);
  const r: any = { palavras, ritmo, segundos, media: Math.round(palavras / 2.75), rapida: Math.round(palavras / 3.7) };
  if (alvo > 0) {
    r.alvo = alvo; r.diferenca = segundos - alvo;
    const mexer = Math.round(Math.abs(r.diferenca) * ritmo);
    r.dica = Math.abs(r.diferenca) <= 1 ? "Dentro do tempo." : r.diferenca > 0 ? `Passou ${r.diferenca}s: corte cerca de ${mexer} palavras.` : `Faltam ${-r.diferenca}s: cabem cerca de ${mexer} palavras a mais.`;
  }
  return r;
}

// ---------- formato da resposta ----------
const FORMATO_ROTEIRO = `"roteiro":{"titulo":"curto","tipo":"um destes: Falado com a câmera, Teatro, Dois personagens comparativos, Rotina, Testando o produto, Focado em ads, Problema versus solução, Unboxing, Sorteador de assuntos, Várias vozes, Entrevista de rua, React, Tutorial walkthrough, Decupagem por frase","estrutura":"rótulos na ordem, ex.: GANCHO, IDENTIFICAÇÃO, SOLUÇÃO, PROVA, FECHAMENTO","formato":"Reels, TikTok, Stories, Carrossel ou o pedido","ganchos":[{"tipo":"tipo de ganchos.md","fala":"..."}],"blocos":[{"bloco":"GANCHO","fala":"o que eu falo, entre aspas não precisa","cena":"direção de imagem em primeira pessoa, ex.: aponto pros meus poros"}],"cta":"a única ação do fechamento","legenda":"...","hashtags":"#...","decisao":"uma linha explicando a decisão de ângulo"}`;
function limparRoteiro(r: any) {
  const blocos = (Array.isArray(r?.blocos) ? r.blocos : []).slice(0, 14).map((b: any) => ({ bloco: txt(b?.bloco, 40).toUpperCase(), fala: txt(b?.fala, 700), cena: txt(b?.cena ?? b?.visual, 400) })).filter((b: any) => b.fala || b.cena);
  return {
    titulo: txt(r?.titulo, 80) || "Roteiro UGC", tipo: txt(r?.tipo, 60), estrutura: txt(r?.estrutura, 160), formato: txt(r?.formato, 60),
    ganchos: (Array.isArray(r?.ganchos) ? r.ganchos : []).slice(0, 3).map((g: any) => ({ tipo: txt(g?.tipo, 50), fala: txt(g?.fala ?? g?.texto, 300) })).filter((g: any) => g.fala),
    blocos, cta: txt(r?.cta, 300), legenda: txt(r?.legenda, 900), hashtags: txt(r?.hashtags, 300), decisao: txt(r?.decisao, 400),
  };
}
const roteiroValido = (j: any) => Array.isArray(j?.roteiro?.blocos) && j.roteiro.blocos.some((b: any) => b?.fala);
function problemasDoRoteiro(r: any, obrigatorias: string[], contou = "") {
  const erros: string[] = [];
  const disse = contou.toLowerCase();
  const falas = [...r.ganchos.map((g: any) => g.fala), ...r.blocos.map((b: any) => b.fala), r.cta];
  for (const f of falas) {
    const m = String(f || "").match(FRASE_PROIBIDA); if (m) erros.push(`construção proibida "${m[0]}" em: "${f}"`);
    const res = String(f || "").replace(/\([^)]*\)/g, "").match(RESULTADO);
    if (res && !disse.includes(res[0].toLowerCase())) erros.push(`resultado ou prazo que ela não contou "${res[0]}" em: "${f}" (troque por algo que se vê na tela ou por um campo entre parênteses para ela completar, ex.: "(conte o que mudou na sua pele)")`);
  }
  for (const g of r.ganchos) if (GANCHO_BATIDO.test(g.fala)) erros.push(`gancho batido: "${g.fala}" (use um detalhe concreto do pedido)`);
  const tudo = falas.join(" ").toLowerCase().replace(/\s+/g, " ");
  for (const o of obrigatorias) { const limpa = o.toLowerCase().replace(/\s+/g, " ").replace(/^["“]|["”]$/g, "").trim(); if (limpa.length > 3 && !tudo.includes(limpa)) erros.push(`fala obrigatória não está literal: "${o}"`); }
  if (r.ganchos.length < 2) erros.push("precisa de pelo menos 2 opções de gancho");
  return [...new Set(erros)].slice(0, 8);
}
// uma passada de conserto: só as falas com erro, com a lista de construções banidas
async function consertar(chave: string, arquivos: Record<string, string>, r: any, erros: string[], duracao: any) {
  const extra = duracao?.alvo && Math.abs(duracao.diferenca) > 2 ? [`duração: ${duracao.dica} (ritmo ${duracao.ritmo} palavras por segundo; falas obrigatórias não podem ser mexidas; ao cortar, tire a frase menos essencial; ao esticar, reforce o benefício principal, nunca enchimento)`] : [];
  const todos = [...erros, ...extra];
  if (!todos.length) return r;
  const sistema = `Você revisa roteiros UGC seguindo a Skill. Regras de linguagem:\n${String(arquivos["references/linguagem.md"] || "").slice(0, 2600)}\nNunca use travessão. Responda só JSON.`;
  const pedido = `Corrija este roteiro. Problemas encontrados:\n- ${todos.join("\n- ")}\n\nMexa só no necessário, mantenha o resto igual e devolva o roteiro INTEIRO no mesmo formato: {${FORMATO_ROTEIRO}}\n\nRoteiro:\n${JSON.stringify({ roteiro: r })}`;
  try {
    const j = await pedirJson(chave, sistema, pedido, roteiroValido, 3000, 0.3);
    const novo = limparRoteiro(j.roteiro);
    return novo.blocos.length ? novo : r;
  } catch (e) { console.error("Conserto falhou:", String((e as Error).message)); return r; }
}

// ---------- entradas ----------
function briefingDoCorpo(c: any) {
  const campos: [string, unknown, number][] = [
    ["Briefing da marca", c.briefing, 3500], ["Produto", c.produto, 400], ["Marca", c.marca, 120], ["Objetivo", c.objetivo, 300],
    ["Público", c.publico, 300], ["Formato", c.formato, 80], ["Duração pedida (segundos)", c.duracao, 20],
    ["Falas obrigatórias (literais)", Array.isArray(c.obrigatorias) ? c.obrigatorias.join("\n") : c.obrigatorias, 900],
    ["Restrições e palavras proibidas", c.restricoes, 900], ["Observações", c.observacoes, 900], ["Ideia dela (texto ou áudio)", c.ideia, 1500],
    ["O que aparece nas imagens que ela mandou", c._imagens, 1200], ["Transcrições de vídeos dela, para o tom", c.transcricoes, 1500],
  ];
  return campos.filter(([, v]) => String(v ?? "").trim()).map(([k, v, n]) => `${k}:\n${txt(v, n)}`).join("\n\n");
}
function referenciaDoCorpo(ref: any) {
  if (!ref) return "";
  const partes = [ref.titulo && `Título: ${txt(ref.titulo, 120)}`, ref.perfil && `Perfil: ${txt(ref.perfil, 60)}`, ref.legenda && `Legenda: ${txt(ref.legenda, 400)}`,
    ref.analise && `Análise: ${txt(typeof ref.analise === "string" ? ref.analise : JSON.stringify(ref.analise), 900)}`,
    ref.transcricao && `Transcrição: ${txt(ref.transcricao, 1800)}`].filter(Boolean);
  return partes.length ? `VÍDEO DE REFERÊNCIA (use o mecanismo: o tipo de gancho, a estrutura, o ritmo e a prova; nunca copie as falas nem a assinatura de quem gravou, escreva tudo do zero com o produto e a realidade dela):\n${partes.join("\n")}` : "";
}
const listaObrigatorias = (c: any) => (Array.isArray(c.obrigatorias) ? c.obrigatorias : String(c.obrigatorias || "").split(/\n+/)).map((s: string) => txt(s, 300)).filter((s: string) => s.length > 3).slice(0, 8);

async function descreverImagens(chave: string, imagens: string[]) {
  const validas = (imagens || []).filter((i) => /^data:image\/(png|jpe?g|webp);base64,/.test(i) && i.length < 3_500_000).slice(0, 4);
  if (!validas.length) return "";
  const { visao } = await modelos(chave);
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: visao, temperature: 0.2, max_tokens: 700, messages: [{ role: "user", content: [
      { type: "text", text: "Descreva em português, em tópicos curtos, o que aparece nestas imagens para uma creator fazer um roteiro: produto, marca, embalagem, textos escritos (copie igual), regras de briefing visíveis, ambiente. Não invente nada que não aparece." },
      ...validas.map((url) => ({ type: "image_url", image_url: { url } })),
    ] }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("Visão falhou:", j?.error?.message); return ""; }
  return String(j.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
async function transcreverAudio(chave: string, arquivo: File) {
  if (arquivo.size > 25 * 1024 * 1024) throw new Error("O áudio é grande demais (máximo 25 MB).");
  const form = new FormData();
  form.append("file", arquivo, arquivo.name || "audio.webm");
  form.append("model", (await modelos(chave)).audio);
  form.append("language", "pt");
  form.append("response_format", "json");
  const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${chave}` }, body: form });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw r.status === 429 ? new Limite("audio") : new Error("Não consegui entender o áudio: " + (j?.error?.message || r.status));
  return semTravessao(j.text || "");
}

async function ritmoDela(supa: any, c: any) {
  const pedido = Number(c.ritmo);
  if (pedido > 1 && pedido < 6) return pedido;
  try { const { data } = await supa.from("estilo_ugc").select("ritmo_fala").eq("id", 1).maybeSingle(); const r = Number(data?.ritmo_fala); if (r > 1 && r < 6) return r; } catch { /* média */ }
  return 2.75;
}

const SISTEMA_BASE = `Você é a Skill UGC da Mari Bonetto (@maribonettougc), creator de UGC. Escreva em português do Brasil falado, primeira pessoa, frases curtas, como ela falaria para a câmera. Siga o método abaixo à risca: ele é a única fonte de regras. Nunca use travessão. Nunca use "não é X, é Y" nem as construções banidas. Nunca invente número, preço, prazo, resultado, cupom ou funcionalidade: o que não se sabe vira campo entre parênteses, ex.: "(preço)". Responda só com JSON válido.`;

// ---------- ações ----------
async function criar(chave: string, supa: any, c: any) {
  const { arquivos, versao } = await carregarSkill(supa);
  if (Array.isArray(c.imagens) && c.imagens.length) c._imagens = await descreverImagens(chave, c.imagens.map(String));
  const temMarca = !!String(c.briefing || c.marca || c.restricoes || c.obrigatorias || "").trim();
  const ordem = ["SKILL.md", "linguagem.md", ...(temMarca ? ["compliance.md"] : []), "ganchos.md", ...(!String(c.formato || "").trim() || c.referencia ? ["tipos.md"] : []), ...(Number(c.duracao) > 0 ? ["duracao.md"] : []), ...(temMarca ? ["casos.md"] : [])];
  const entrada = [briefingDoCorpo(c), referenciaDoCorpo(c.referencia), c.ajuste ? `Ajuste pedido em cima da versão anterior: ${txt(c.ajuste, 400)}` : "", c.anterior ? `Versão anterior (não repita os mesmos ganchos):\n${txt(typeof c.anterior === "string" ? c.anterior : JSON.stringify(c.anterior), 1500)}` : ""].filter(Boolean).join("\n\n");
  if (!entrada.trim()) throw new Error("Conte a ideia, o produto ou cole o briefing.");
  const ritmo = await ritmoDela(supa, c);
  const alvo = Math.max(0, Math.min(600, Number(c.duracao) || 0));
  const orcamento = 4600 - tokens(entrada);
  const comentar = /coment|palavra|direct|\bdm\b/i.test(entrada);
  const { texto: skill, usados } = montarSkill(arquivos, ordem, Math.max(1800, orcamento), {
    "compliance.md": new RegExp(`Exclusividade|revisão da marca se contradiz${comentar ? "" : "|Automação de DM"}`, "i"),
    "casos.md": /conta de teste|prazo do briefing|some com parte|mais plataformas/i,
  });
  const sistema = `${SISTEMA_BASE}\n\n${skill}`;
  const pedido = `Siga o fluxo completo da Skill para este pedido.

${entrada}

Ritmo de fala dela: ${ritmo} palavras por segundo.${alvo ? ` A duração precisa fechar em ${alvo} segundos, o que dá cerca de ${Math.round(alvo * ritmo)} palavras faladas no total. Calcule as falas obrigatórias primeiro.` : ""}

Devolva este JSON:
{"checklist":[{"item":"cada obrigatoriedade e proibição do briefing, uma por linha","ok":true}],"alertas":["contradições, exigências impossíveis ou riscos de compliance, apontados antes"],"faltando":["informação que falta e virou campo entre parênteses"],${FORMATO_ROTEIRO}}

Regras da resposta:
- "ganchos": 2 ou 3 opções de tipos diferentes; a primeira é a usada no bloco GANCHO.
- "blocos": na estrutura da Skill (para marca: GANCHO, IDENTIFICAÇÃO, SOLUÇÃO, PROVA, FECHAMENTO; conteúdo de valor no perfil: GANCHO, CONTEXTO, CONTEÚDO, FECHAMENTO). Se o briefing traz a estrutura da marca, use a da marca.
- IDENTIFICAÇÃO é a dor ou situação de quem assiste, nunca apresentação ("eu sou a Mari").
- PROVA é o que ela mostra na tela (textura, aplicação, antes e depois real) ou o que ela contou. Resultado que ela não contou vira campo entre parênteses, ex.: "(conte o que mudou na sua pele)".
- O fechamento tem uma ação só.
- Falas obrigatórias entram literais.
- "checklist": cada exigência do briefing com ok true só se o roteiro cumpre; vazio se não houver briefing.`;
  const j = await pedirJson(chave, sistema, pedido, roteiroValido, 4200, c.ajuste ? 0.5 : 0.7);
  let roteiro = limparRoteiro(j.roteiro);
  const obrig = listaObrigatorias(c);
  let duracao = calcularDuracao(roteiro.blocos, ritmo, alvo);
  const erros = problemasDoRoteiro(roteiro, obrig, entrada);
  if (erros.length || (alvo && Math.abs(duracao.diferenca) > 2)) {
    roteiro = await consertar(chave, arquivos, roteiro, erros, duracao);
    duracao = calcularDuracao(roteiro.blocos, ritmo, alvo);
  }
  return {
    roteiro, duracao,
    checklist: (Array.isArray(j.checklist) ? j.checklist : []).slice(0, 20).map((i: any) => ({ item: txt(i?.item ?? i, 300), ok: i?.ok !== false })).filter((i: any) => i.item),
    alertas: lista(j.alertas, 8), faltando: lista(j.faltando, 10),
    avisos: problemasDoRoteiro(roteiro, obrig, entrada),
    skill: { versao, partes: usados },
  };
}

async function revisarOuAjustar(chave: string, supa: any, c: any, acao: "revisar" | "ajustar") {
  const { arquivos, versao } = await carregarSkill(supa);
  const atual = typeof c.roteiro === "string" ? txt(c.roteiro, 4000) : JSON.stringify(c.roteiro || {}).slice(0, 4000);
  if (atual.length < 20) throw new Error("Mande o roteiro para revisar.");
  if (acao === "ajustar" && !String(c.pedido || "").trim()) throw new Error("Diga o que você quer mudar.");
  const ritmo = await ritmoDela(supa, c);
  const alvo = Math.max(0, Math.min(600, Number(c.duracao) || 0));
  const contexto = briefingDoCorpo({ briefing: c.briefing, obrigatorias: c.obrigatorias, restricoes: c.restricoes, produto: c.produto, formato: c.formato, duracao: c.duracao });
  const ordem = ["SKILL.md", "linguagem.md", ...(alvo ? ["duracao.md"] : []), ...(contexto ? ["compliance.md"] : []), "ganchos.md", "duracao.md", "casos.md"];
  const { texto: skill, usados } = montarSkill(arquivos, ordem, Math.max(1800, 4400 - tokens(atual + contexto)), { "compliance.md": /Exclusividade|Automação de DM/i });
  const pedido = `${acao === "revisar" ? "Revise este roteiro contra a checklist final da Skill, item por item. Liste o que falhou e entregue o roteiro inteiro corrigido." : `Ajuste este roteiro conforme o pedido dela: "${txt(c.pedido, 500)}". Entregue o roteiro INTEIRO, não só o trecho mudado.`}

${contexto ? contexto + "\n\n" : ""}Ritmo de fala dela: ${ritmo} palavras por segundo.${alvo ? ` Duração alvo: ${alvo} segundos.` : ""}

Roteiro atual:
${atual}

Devolva este JSON:
{"problemas":["o que estava errado, citando o trecho"],"mudancas":["o que você mudou, em uma linha cada"],${FORMATO_ROTEIRO}}`;
  const j = await pedirJson(chave, `${SISTEMA_BASE}\n\n${skill}`, pedido, roteiroValido, 4000, 0.4);
  let roteiro = limparRoteiro(j.roteiro);
  const obrig = listaObrigatorias(c);
  let duracao = calcularDuracao(roteiro.blocos, ritmo, alvo);
  const erros = problemasDoRoteiro(roteiro, obrig, atual + contexto).filter((e) => !/2 opções de gancho/.test(e));
  if (erros.length || (alvo && Math.abs(duracao.diferenca) > 2)) { roteiro = await consertar(chave, arquivos, roteiro, erros, duracao); duracao = calcularDuracao(roteiro.blocos, ritmo, alvo); }
  return { roteiro, duracao, problemas: lista(j.problemas, 12), mudancas: lista(j.mudancas, 12), avisos: problemasDoRoteiro(roteiro, obrig, atual + contexto).filter((e) => !/2 opções de gancho/.test(e)), skill: { versao, partes: usados } };
}

async function analisar(chave: string, supa: any, c: any) {
  const { arquivos, versao } = await carregarSkill(supa);
  const transcricao = txt(c.transcricao, 5000);
  if (transcricao.length < 30 && !String(c.legenda || "").trim()) throw new Error("Essa referência ainda não tem transcrição. Transcreva primeiro.");
  const seg = Number(c.duracao_seg) || 0;
  const palavras = contarPalavras(transcricao);
  const ritmo = seg > 3 && palavras ? Math.round((palavras / seg) * 100) / 100 : 0;
  const { texto: skill, usados } = montarSkill(arquivos, ["SKILL.md", "ganchos.md", "tipos.md", "linguagem.md"], Math.max(1600, 4200 - tokens(transcricao)));
  const pedido = `Analise este vídeo de referência pela Skill.

${c.perfil ? `Perfil: ${txt(c.perfil, 60)}\n` : ""}${c.legenda ? `Legenda: ${txt(c.legenda, 600)}\n` : ""}${seg ? `Duração: ${seg} segundos (${palavras} palavras, ${ritmo} por segundo)\n` : ""}Transcrição:
${transcricao || "(sem fala)"}

Separe com rigor:
- "observado": só o que está na transcrição ou na legenda. Cite trechos. Se algo não dá para saber pelo texto (ex.: o que aparece na imagem), escreva "não dá para saber pela transcrição".
- "interpretacao": a sua leitura, marcada como hipótese.

Devolva este JSON:
{"observado":{"gancho":"a frase de abertura, literal","gancho_tipo":"tipo de ganchos.md","estrutura":"blocos na ordem, com o trecho de cada um","formato":"tipo de tipos.md que dá para identificar","ritmo":"frases curtas ou longas, pausas, quantas ideias","demonstracao":"o que a fala indica que é mostrado","argumentos":["argumentos usados, literais"],"cta":"o fechamento, literal"},"interpretacao":{"por_que_funciona":"...","publico":"para quem parece ser","emocao":"o que a pessoa sente","pontos_fracos":["o que a Skill reprovaria, ex.: construção banida, CTA duplo"],"como_adaptar":"como a Mari usa o mecanismo sem copiar"},"ideias":["2 ou 3 ideias de roteiro dela a partir do mecanismo"]}`;
  const j = await pedirJson(chave, `${SISTEMA_BASE}\n\n${skill}`, pedido, (x) => !!x?.observado, 2600, 0.3);
  const o = j.observado || {}, i = j.interpretacao || {};
  return {
    analise: {
      observado: { gancho: txt(o.gancho, 400), gancho_tipo: txt(o.gancho_tipo, 50), estrutura: txt(o.estrutura, 900), formato: txt(o.formato, 120), ritmo: txt(o.ritmo, 300) + (ritmo ? ` (${ritmo} palavras por segundo)` : ""), demonstracao: txt(o.demonstracao, 400), argumentos: lista(o.argumentos, 8), cta: txt(o.cta, 300) },
      interpretacao: { por_que_funciona: txt(i.por_que_funciona, 600), publico: txt(i.publico, 200), emocao: txt(i.emocao, 200), pontos_fracos: lista(i.pontos_fracos, 6), como_adaptar: txt(i.como_adaptar, 600) },
      ideias: lista(j.ideias, 3, 400),
      skill: versao, em: new Date().toISOString(),
    },
    skill: { versao, partes: usados },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ error: "Use POST." }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    let supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    // tarefas do próprio banco (pg_cron e testes): segredo guardado só no banco (segredos_servidor "cron_painel")
    const cron = req.headers.get("x-cron") || "";
    let liberado = false;
    if (cron.length >= 20) {
      const srv = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: seg } = await srv.from("segredos_servidor").select("valor").eq("chave", "cron_painel").maybeSingle();
      if (seg?.valor && seg.valor === cron) { supa = srv; liberado = true; }
    }
    if (!liberado) {
      const { data: { user } } = await supa.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
      if (!user || user.email !== EMAIL_DONA) return resposta({ error: "Não autorizado" }, 401);
    }
    const chave = Deno.env.get("GROQ_API_KEY") || "";
    if (!chave) return resposta({ error: "Falta a chave do Groq no Supabase (GROQ_API_KEY)." }, 500);

    if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
      const form = await req.formData();
      const arquivo = form.get("audio");
      if (!(arquivo instanceof File)) return resposta({ error: "Nenhum áudio foi enviado." }, 400);
      return resposta({ texto: await transcreverAudio(chave, arquivo) });
    }
    const c = await req.json().catch(() => ({}));
    const acao = String(c.acao || "criar");
    if (acao === "versao") { const s = await carregarSkill(supa); return resposta({ versao: s.versao, arquivos: Object.keys(s.arquivos) }); }
    if (acao === "criar") return resposta(await criar(chave, supa, c));
    if (acao === "revisar" || acao === "ajustar") return resposta(await revisarOuAjustar(chave, supa, c, acao));
    if (acao === "analisar") return resposta(await analisar(chave, supa, c));
    return resposta({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    if (e instanceof Limite) return resposta({ error: "O limite grátis da IA (Groq) encheu neste minuto. Espere 1 minuto e tente de novo.", limite: true }, 429);
    const msg = String((e as Error)?.message || e);
    console.error(e);
    if (/^(Conte|Mande|Diga|Essa referência|Não encontrei a Skill|O áudio|Não consegui entender)/.test(msg)) return resposta({ error: msg }, 422);
    return resposta({ error: "A Skill não conseguiu responder agora. Tente de novo em instantes." }, 502);
  }
});
