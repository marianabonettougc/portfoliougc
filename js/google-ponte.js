// =========================================================
// LIGAÇÃO COM O GOOGLE (nov/2026, pedido da Mari)
// Um Apps Script na conta Google dela (App da Web) faz tudo que precisa da conta dela:
//   e-mail dos avisos, pasta "Vídeos UGC aprovação" > <cliente> no Drive, liberar o vídeo em alta
//   depois que a marca aprova e mandar o vídeo do Drive para o YouTube (não listado).
// O link (/exec) e o segredo ficam em configuracoes "google_ponte" (e em "email_webhook",
// que a função notificacoes já usa para os e-mails). O código do script é gerado aqui (codigo()).
// window.painelGoogle: cfg, ligado, chamar, pasta, enviarAlta, liberar, youtube, codigo, PASTA_MAE
// =========================================================
(function () {
  const PASTA_MAE = "Vídeos UGC aprovação";
  const banco = () => window.banco;
  let cache = null;

  async function cfg(forcar) {
    if (cache && !forcar) return cache;
    const { data } = await banco().from("configuracoes").select("chave, valor").in("chave", ["google_ponte", "email_webhook"]);
    const ler = (k) => { const l = (data || []).find((x) => x.chave === k); try { return l && l.valor ? (typeof l.valor === "string" ? JSON.parse(l.valor) : l.valor) : null; } catch (e) { return null; } };
    cache = ler("google_ponte") || ler("email_webhook") || null;
    return cache;
  }
  async function gravar(v) {
    const valor = JSON.stringify(v);
    const { error } = await banco().from("configuracoes").upsert([{ chave: "google_ponte", valor }, { chave: "email_webhook", valor }], { onConflict: "chave" });
    if (error) throw error;
    cache = v;
  }
  async function ligado() { const c = await cfg(); return !!(c && c.url && c.drive); }

  // POST em text/plain (sem pré-voo de CORS); o Apps Script responde por um redirecionamento que o fetch segue
  async function chamar(acao, dados) {
    const c = await cfg();
    if (!c || !c.url) throw Object.assign(new Error("Ligue o Google primeiro em Ajustes > Notificações > Ligação com o Google."), { semPonte: true });
    const r = await fetch(c.url, { method: "POST", body: JSON.stringify(Object.assign({ segredo: c.segredo, acao }, dados || {})) });
    let j = null; try { j = await r.json(); } catch (e) { /* segue */ }
    if (!j) throw new Error("O Google não respondeu. Confira se o App da Web está implantado como \"Qualquer pessoa\".");
    if (!j.ok) throw new Error(j.erro === "segredo" ? "O código colado no Apps Script é de outra versão. Copie o código de novo e reimplante." : (j.erro === "acao" ? "O código do Apps Script está desatualizado. Copie o código novo e reimplante (Gerenciar implantações > editar > Nova versão)." : (j.erro || "O Google recusou o pedido.")));
    return j;
  }

  // pasta do cliente dentro da pasta mãe (cria se não existe)
  const pastas = new Map();
  async function pasta(cliente) {
    const k = String(cliente || "").trim() || "Sem cliente";
    if (pastas.has(k)) return pastas.get(k);
    const p = chamar("pasta", { cliente: k }).then((j) => ({ id: j.id, url: j.url, cliente: k }));
    pastas.set(k, p);
    p.catch(() => pastas.delete(k));
    return p;
  }

  // sobe o arquivo ORIGINAL (qualidade cheia, qualquer tamanho) direto do navegador para a pasta do Drive
  async function enviarAlta(arq, pastaId, nome, aoProgresso) {
    const { token } = await chamar("token");
    const ini = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,webViewLink", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": arq.type || "video/mp4", "X-Upload-Content-Length": String(arq.size) },
      body: JSON.stringify({ name: nome || arq.name, parents: [pastaId] }),
    });
    const sessao = ini.headers.get("Location");
    if (!ini.ok || !sessao) throw new Error("O Drive não abriu o envio (" + ini.status + "). Tente de novo.");
    return new Promise((ok, erro) => {
      const x = new XMLHttpRequest();
      x.open("PUT", sessao);
      x.setRequestHeader("Content-Type", arq.type || "video/mp4");
      x.upload.onprogress = (e) => { if (e.lengthComputable && aoProgresso) aoProgresso(Math.min(99, Math.round((e.loaded / e.total) * 100))); };
      x.onload = () => {
        if (x.status >= 200 && x.status < 300) { try { const j = JSON.parse(x.responseText); ok({ id: j.id, nome: j.name, tamanho: Number(j.size) || arq.size, url: j.webViewLink || "https://drive.google.com/file/d/" + j.id + "/view" }); } catch (e) { erro(new Error("O Drive respondeu de um jeito estranho.")); } }
        else erro(new Error("O Drive parou o envio (" + x.status + "). Tente de novo."));
      };
      x.onerror = () => erro(new Error("A internet caiu no meio do envio para o Drive. Tente de novo."));
      x.send(arq);
    });
  }

  // libera o arquivo (qualquer pessoa com o link vê e baixa) e devolve os links
  async function liberar(id) { const j = await chamar("liberar", { arquivo: id }); return { url: j.url, baixar: j.baixar }; }

  // Drive -> YouTube em pedaços; o Apps Script trabalha até ~4,5 min por chamada e a gente chama de novo até terminar
  async function youtube({ arquivo, titulo, descricao, privacidade }, aoProgresso) {
    for (let i = 0; i < 60; i++) {
      const j = await chamar("youtube", { arquivo, titulo, descricao, privacidade: privacidade || "unlisted" });
      if (j.pronto) return j;
      if (aoProgresso && j.total) aoProgresso(Math.min(99, Math.round((j.feito / j.total) * 100)));
    }
    throw new Error("O envio para o YouTube está demorando demais. Tente de novo mais tarde.");
  }

  // código do Apps Script (ela cola uma vez no script.google.com)
  const codigo = (segredo) => `// Ligação do painel da Mari com a conta Google dela.
// Faz: avisos por e-mail, pasta "${PASTA_MAE}" > cliente no Drive, liberar o vídeo em alta e enviar para o YouTube.
var SEGREDO = "${segredo}";
var PASTA_MAE = "${PASTA_MAE}";
var PEDACO = 32 * 1024 * 1024; // múltiplo de 256 KB

function resp(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doPost(e) {
  var d = {};
  try { d = JSON.parse(e.postData.contents); } catch (err) {}
  if (d.segredo !== SEGREDO) return resp({ ok: false, erro: "segredo" });
  try {
    var a = d.acao || "email";
    if (a === "email") { email(d); return resp({ ok: true }); }
    if (a === "pasta") return resp(pasta(d.cliente));
    if (a === "token") return resp({ ok: true, token: ScriptApp.getOAuthToken() });
    if (a === "liberar") return resp(liberar(d.arquivo));
    if (a === "youtube") return resp(youtube(d));
    if (a === "canal") return resp(canal());
    return resp({ ok: false, erro: "acao" });
  } catch (err) {
    return resp({ ok: false, erro: String((err && err.message) || err) });
  }
}

function email(d) {
  var corpo = (d.texto || "") + (d.link ? "\\n\\nAbrir no painel: " + d.link : "");
  MailApp.sendEmail({ to: Session.getEffectiveUser().getEmail(), subject: "[Painel] " + (d.assunto || "Aviso"), body: corpo, name: "Painel da Mari" });
}

function filha(mae, nome) { var it = mae.getFoldersByName(nome); return it.hasNext() ? it.next() : mae.createFolder(nome); }
function pasta(cliente) {
  var mae = filha(DriveApp.getRootFolder(), PASTA_MAE);
  var p = filha(mae, String(cliente || "Sem cliente").slice(0, 100));
  return { ok: true, id: p.getId(), url: p.getUrl() };
}

function liberar(id) {
  var f = DriveApp.getFileById(id);
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, url: "https://drive.google.com/file/d/" + id + "/view", baixar: "https://drive.google.com/uc?export=download&id=" + id };
}

function canal() {
  var r = YouTube.Channels.list("snippet", { mine: true });
  var c = r.items && r.items[0];
  return { ok: true, canal: c ? c.snippet.title : "" };
}

function cabecalho(r, nome) { var h = r.getAllHeaders(); for (var k in h) { if (k.toLowerCase() === nome) return h[k]; } return ""; }

function youtube(d) {
  var props = PropertiesService.getScriptProperties();
  var chave = "yt_" + d.arquivo;
  var est = JSON.parse(props.getProperty(chave) || "null");
  var token = ScriptApp.getOAuthToken();
  var f = DriveApp.getFileById(d.arquivo);
  var total = f.getSize(), tipo = f.getMimeType() || "video/mp4";
  if (!est) {
    var meta = { snippet: { title: String(d.titulo || f.getName()).slice(0, 100), description: String(d.descricao || "").slice(0, 4900), categoryId: "22" },
      status: { privacyStatus: d.privacidade || "unlisted", selfDeclaredMadeForKids: false } };
    var r = UrlFetchApp.fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
      method: "post", contentType: "application/json; charset=UTF-8", payload: JSON.stringify(meta), muteHttpExceptions: true,
      headers: { Authorization: "Bearer " + token, "X-Upload-Content-Length": String(total), "X-Upload-Content-Type": tipo } });
    if (r.getResponseCode() >= 300) return { ok: false, erro: "O YouTube recusou: " + r.getContentText().slice(0, 300) };
    est = { sessao: cabecalho(r, "location"), feito: 0 };
    props.setProperty(chave, JSON.stringify(est));
  }
  var ini = Date.now();
  while (est.feito < total && Date.now() - ini < 270000) {
    var fim = Math.min(est.feito + PEDACO, total) - 1;
    var parte = UrlFetchApp.fetch("https://www.googleapis.com/drive/v3/files/" + d.arquivo + "?alt=media", { headers: { Authorization: "Bearer " + token, Range: "bytes=" + est.feito + "-" + fim }, muteHttpExceptions: true });
    if (parte.getResponseCode() >= 300) return { ok: false, erro: "Não consegui ler o vídeo no Drive (" + parte.getResponseCode() + ")." };
    var bytes = parte.getContent();
    var up = UrlFetchApp.fetch(est.sessao, { method: "put", payload: bytes, contentType: tipo, muteHttpExceptions: true,
      headers: { "Content-Range": "bytes " + est.feito + "-" + (est.feito + bytes.length - 1) + "/" + total } });
    var c = up.getResponseCode();
    if (c === 308) {
      var rg = cabecalho(up, "range");
      est.feito = rg ? Number(String(rg).split("-")[1]) + 1 : est.feito + bytes.length;
      props.setProperty(chave, JSON.stringify(est));
      continue;
    }
    if (c === 200 || c === 201) {
      props.deleteProperty(chave);
      var v = JSON.parse(up.getContentText());
      return { ok: true, pronto: true, id: v.id, url: "https://youtu.be/" + v.id, status: v.status || {} };
    }
    props.deleteProperty(chave);
    return { ok: false, erro: "O YouTube parou o envio (" + c + "): " + up.getContentText().slice(0, 300) };
  }
  return { ok: true, pronto: false, feito: est.feito, total: total };
}

// rode UMA vez pelo editor para dar as permissões (e-mail, Drive e YouTube)
function testar() {
  filha(DriveApp.getRootFolder(), PASTA_MAE);
  var c = { canal: "" };
  try { c = canal(); } catch (err) { c.canal = "(o serviço YouTube Data API ainda não foi adicionado em Serviços)"; }
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), "[Painel] Ligação com o Google pronta", "Drive e e-mail liberados. Canal do YouTube: " + (c.canal || "(nenhum)") + ". Agora implante como App da Web.");
}`;

  window.painelGoogle = { cfg, gravar, ligado, chamar, pasta, enviarAlta, liberar, youtube, codigo, PASTA_MAE };
})();
