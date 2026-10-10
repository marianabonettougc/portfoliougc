// =========================================================
// CALENDÁRIO DO IPHONE (Edge Function do Supabase)
// Lê o calendário público do iCloud da Mari (link webcal://...icloud.com/published/...)
// e devolve os eventos para o Dashboard do aplicativo Gestão UGC.
// O link fica guardado só no banco (tabela integracoes, chave "calendario_apple", que só o servidor lê),
// nunca no site nem no GitHub: quem tem o link consegue ver a agenda.
// Ações (POST): { acao: "eventos", de, ate } | { acao: "salvar", url } | { acao: "remover" } | { acao: "status" }
// Sincroniza só de lá para cá (o que ela marca no iPhone aparece no painel).
// Só a dona do painel pode usar.
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const EMAIL_DONA = "marianabonettougc@gmail.com";
const CHAVE = "calendario_apple";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

// webcal:// vira https:// e só aceita calendários publicados do iCloud
function normalizarUrl(u: unknown) {
  const url = String(u || "").trim().replace(/^webcals?:\/\//i, "https://");
  try { const x = new URL(url); return x.protocol === "https:" && /(^|\.)icloud\.com$/i.test(x.hostname) && /\/published\//.test(x.pathname) ? x.toString() : ""; }
  catch { return ""; }
}
async function baixar(url: string) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "Cache-Control": "no-cache" } });
    const txt = await r.text();
    if (!r.ok || !/BEGIN:VCALENDAR/.test(txt)) throw new Error("O iCloud não devolveu o calendário (" + r.status + "). Confira se ele continua publicado.");
    return txt;
  } finally { clearTimeout(t); }
}

// ---------- leitura do arquivo .ics ----------
type Ev = { uid: string; titulo: string; local: string; descricao: string; inicio: string; fim: string; diaTodo: boolean; rrule: string; exdates: string[]; recId: string };
const desescapar = (s: string) => s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
// data do ics em "AAAA-MM-DDTHH:MM" no horário de Brasília (ou "AAAA-MM-DD" se for o dia todo)
function lerData(param: string, valor: string) {
  const v = valor.trim();
  if (/VALUE=DATE(?!-)/.test(param) || /^\d{8}$/.test(v)) return v.slice(0, 4) + "-" + v.slice(4, 6) + "-" + v.slice(6, 8);
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return "";
  if (m[7]) { // horário UTC: passa para Brasília (UTC-3, sem horário de verão desde 2019)
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 3, +m[5]));
    return d.toISOString().slice(0, 16);
  }
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
}
function lerIcs(ics: string) {
  const linhas = ics.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const nome = desescapar((linhas.find((l) => l.startsWith("X-WR-CALNAME:")) || "").slice(13));
  const eventos: Ev[] = [];
  let ev: Ev | null = null, dentroAlarme = false;
  for (const l of linhas) {
    if (l === "BEGIN:VEVENT") { ev = { uid: "", titulo: "", local: "", descricao: "", inicio: "", fim: "", diaTodo: false, rrule: "", exdates: [], recId: "" }; continue; }
    if (l === "BEGIN:VALARM") { dentroAlarme = true; continue; }
    if (l === "END:VALARM") { dentroAlarme = false; continue; }
    if (l === "END:VEVENT") { if (ev && ev.inicio) eventos.push(ev); ev = null; continue; }
    if (!ev || dentroAlarme) continue;
    const i = l.indexOf(":"); if (i < 0) continue;
    const cab = l.slice(0, i), valor = l.slice(i + 1);
    const nomeProp = cab.split(";")[0].toUpperCase();
    if (nomeProp === "UID") ev.uid = valor.trim();
    else if (nomeProp === "SUMMARY") ev.titulo = desescapar(valor);
    else if (nomeProp === "LOCATION") ev.local = desescapar(valor).split("\n")[0];
    else if (nomeProp === "DESCRIPTION") ev.descricao = desescapar(valor).slice(0, 300);
    else if (nomeProp === "DTSTART") { ev.inicio = lerData(cab, valor); ev.diaTodo = ev.inicio.length === 10; }
    else if (nomeProp === "DTEND") ev.fim = lerData(cab, valor);
    else if (nomeProp === "RRULE") ev.rrule = valor.trim();
    else if (nomeProp === "EXDATE") valor.split(",").forEach((v) => { const d = lerData(cab, v); if (d) ev!.exdates.push(d); });
    else if (nomeProp === "RECURRENCE-ID") ev.recId = lerData(cab, valor);
  }
  return { nome, eventos };
}

// ---------- repetição (RRULE) ----------
// trabalha com datas "ingênuas" (horário de Brasília guardado como se fosse UTC) para não errar com fuso
const paraData = (s: string) => new Date(s.length === 10 ? s + "T00:00:00Z" : s + ":00Z");
const paraTexto = (d: Date, diaTodo: boolean) => d.toISOString().slice(0, diaTodo ? 10 : 16);
const DIAS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
function ocorrencias(ev: Ev, de: Date, ate: Date): string[] {
  const inicio = paraData(ev.inicio);
  if (!ev.rrule) return [ev.inicio];
  const r: Record<string, string> = {};
  ev.rrule.split(";").forEach((p) => { const [k, v] = p.split("="); if (k && v) r[k.toUpperCase()] = v; });
  const freq = r.FREQ, intervalo = Math.max(1, Number(r.INTERVAL) || 1), count = Number(r.COUNT) || 0;
  const until = r.UNTIL ? paraData(lerData(r.UNTIL.length === 8 ? "VALUE=DATE" : "", r.UNTIL)) : null;
  const byday = (r.BYDAY || "").split(",").filter(Boolean).map((x) => { const m = x.match(/^([+-]?\d+)?([A-Z]{2})$/); return m ? { n: Number(m[1] || 0), dia: DIAS[m[2]] } : null; }).filter(Boolean) as { n: number; dia: number }[];
  const bymonthday = (r.BYMONTHDAY || "").split(",").filter(Boolean).map(Number);
  const saida: string[] = [];
  let feitos = 0;
  const aceitar = (d: Date) => {
    if (d < inicio) return true;
    if (until && d > new Date(until.getTime() + (ev.diaTodo ? 0 : 86399000))) return false;
    if (count && feitos >= count) return false;
    feitos++;
    if (d >= de && d <= ate) saida.push(paraTexto(d, ev.diaTodo));
    return true;
  };
  const h = inicio.getUTCHours(), mi = inicio.getUTCMinutes();
  const dia = (a: number, m: number, d: number) => new Date(Date.UTC(a, m, d, h, mi));
  // n-ésimo dia da semana do mês (n = -1 é o último)
  const nesimo = (a: number, m: number, n: number, ds: number) => {
    if (n > 0) { const p = new Date(Date.UTC(a, m, 1)); const d = 1 + ((ds - p.getUTCDay() + 7) % 7) + (n - 1) * 7; return d <= new Date(Date.UTC(a, m + 1, 0)).getUTCDate() ? dia(a, m, d) : null; }
    const u = new Date(Date.UTC(a, m + 1, 0)); const d = u.getUTCDate() - ((u.getUTCDay() - ds + 7) % 7) + (n + 1) * 7; return d >= 1 ? dia(a, m, d) : null;
  };
  for (let passo = 0; passo < 1500; passo++) {
    let candidatos: (Date | null)[] = [];
    if (freq === "DAILY") candidatos = [new Date(inicio.getTime() + passo * intervalo * 86400000)];
    else if (freq === "WEEKLY") {
      const semana = new Date(inicio.getTime() + passo * intervalo * 7 * 86400000);
      const seg = new Date(semana.getTime() - ((semana.getUTCDay() + 6) % 7) * 86400000);
      const dias = byday.length ? byday.map((b) => b.dia) : [inicio.getUTCDay()];
      candidatos = dias.map((ds) => new Date(seg.getTime() + ((ds + 6) % 7) * 86400000)).sort((a, b) => a.getTime() - b.getTime());
    } else if (freq === "MONTHLY") {
      const a = inicio.getUTCFullYear(), m = inicio.getUTCMonth() + passo * intervalo;
      if (byday.length) candidatos = byday.map((b) => nesimo(a, m, b.n || 1, b.dia));
      else candidatos = (bymonthday.length ? bymonthday : [inicio.getUTCDate()]).map((d) => { const x = dia(a, m, d); return x.getUTCDate() === d ? x : null; });
    } else if (freq === "YEARLY") {
      const a = inicio.getUTCFullYear() + passo * intervalo;
      const x = dia(a, inicio.getUTCMonth(), inicio.getUTCDate());
      candidatos = [x.getUTCMonth() === inicio.getUTCMonth() ? x : null];
    } else return [ev.inicio];
    let continuar = true;
    for (const c of candidatos) { if (c && !aceitar(c)) { continuar = false; break; } }
    if (!continuar) break;
    const ultimo = candidatos.filter(Boolean).pop();
    if (ultimo && ultimo > ate) break;
  }
  return saida;
}

function eventosNoPeriodo(eventos: Ev[], deIso: string, ateIso: string) {
  const de = paraData(deIso), ate = paraData(ateIso + "T23:59");
  // remarcações de um evento que se repete (RECURRENCE-ID) substituem a ocorrência original
  const remarcados = new Set(eventos.filter((e) => e.recId).map((e) => e.uid + "|" + e.recId));
  const saida: any[] = [];
  for (const ev of eventos) {
    const duracao = ev.fim ? paraData(ev.fim).getTime() - paraData(ev.inicio).getTime() : (ev.diaTodo ? 86400000 : 0);
    const exc = new Set(ev.exdates.map((d) => d.slice(0, ev.diaTodo ? 10 : 16)));
    const lista = ev.recId ? (paraData(ev.inicio) >= new Date(de.getTime() - 40 * 86400000) && paraData(ev.inicio) <= ate ? [ev.inicio] : []) : ocorrencias(ev, new Date(de.getTime() - 40 * 86400000), ate);
    for (const ini of lista) {
      if (!ev.recId && (exc.has(ini) || exc.has(ini.slice(0, 10)) || remarcados.has(ev.uid + "|" + ini))) continue;
      const fim = new Date(paraData(ini).getTime() + duracao);
      // evento de dia inteiro que dura vários dias aparece em cada dia (até 31)
      const dias = ev.diaTodo ? Math.max(1, Math.min(31, Math.round(duracao / 86400000))) : 1;
      for (let k = 0; k < dias; k++) {
        const d = new Date(paraData(ini.slice(0, 10)).getTime() + k * 86400000).toISOString().slice(0, 10);
        if (d < deIso || d > ateIso) continue;
        saida.push({ id: (ev.uid || ev.titulo) + "|" + d + (ev.diaTodo ? "" : ini.slice(10)), data: d, hora: ev.diaTodo ? "" : ini.slice(11, 16),
          fim: ev.diaTodo ? "" : fim.toISOString().slice(11, 16), diaTodo: ev.diaTodo, titulo: ev.titulo || "(sem título)", local: ev.local, descricao: ev.descricao });
      }
    }
  }
  return saida.sort((a, b) => (a.data + (a.hora || "00:00")).localeCompare(b.data + (b.hora || "00:00")));
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
    const acao = String(corpo.acao || "eventos");
    if (acao === "salvar") {
      const url = normalizarUrl(corpo.url);
      if (!url) return resposta({ error: "Cole o link do calendário público do iCloud (começa com webcal:// e tem icloud.com/published)." }, 400);
      const { nome, eventos } = lerIcs(await baixar(url));
      await admin().from("integracoes").upsert({ chave: CHAVE, valor: { url, nome, conectadoEm: new Date().toISOString() }, atualizado_em: new Date().toISOString() });
      return resposta({ conectado: true, nome, total: eventos.length });
    }
    if (acao === "remover") {
      await admin().from("integracoes").delete().eq("chave", CHAVE);
      return resposta({ conectado: false });
    }
    const { data } = await admin().from("integracoes").select("valor").eq("chave", CHAVE).maybeSingle();
    const url = (data?.valor as any)?.url;
    if (!url) return resposta({ conectado: false, eventos: [] });
    if (acao === "status") return resposta({ conectado: true, nome: (data?.valor as any)?.nome || "" });
    const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
    const valido = (s: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
    const de = valido(corpo.de) ? String(corpo.de) : hoje;
    const ate = valido(corpo.ate) ? String(corpo.ate) : new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const { nome, eventos } = lerIcs(await baixar(url));
    return resposta({ conectado: true, nome, eventos: eventosNoPeriodo(eventos, de, ate).slice(0, 800), atualizadoEm: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    return resposta({ error: String((e as Error).message || "Não consegui ler o calendário do iPhone.") }, 502);
  }
});
