// =========================================================
// LIGAÇÃO COM O GOOGLE (nov/2026, pedido da Mari)
// Um Apps Script na conta Google dela (App da Web) faz tudo que precisa da conta dela:
//   e-mail dos avisos, pasta "Vídeos UGC aprovação" > <cliente> no Drive, liberar o vídeo em alta
//   depois que a marca aprova. Sem YouTube (a Mari pediu para deixar de fora, 23/11/2026).
// O link (/exec) e o segredo ficam em configuracoes "google_ponte" (e em "email_webhook",
// que a função notificacoes já usa para os e-mails). O código do script é gerado aqui (codigo()).
// window.painelGoogle: cfg, ligado, chamar, pasta, enviarAlta, liberar, lixeira, codigo, PASTA_MAE
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

  // manda o arquivo para a lixeira do Drive (some do cliente, volta pela lixeira por 30 dias); já apagado conta como ok
  async function lixeira(id) {
    if (!id) return true;
    const { token } = await chamar("token");
    const r = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id) + "?supportsAllDrives=true", {
      method: "PATCH",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ trashed: true }),
    });
    if (r.ok || r.status === 404) return true;
    throw new Error(r.status === 403 ? "o Drive não deixou apagar (o arquivo não é da sua conta)." : "o Drive não apagou o arquivo (" + r.status + ").");
  }

  // código do Apps Script (ela cola uma vez no script.google.com)
  const codigo = (segredo) => `// Ligação do painel da Mari com a conta Google dela.
// Faz: avisos por e-mail, pasta "${PASTA_MAE}" > cliente no Drive e liberar o vídeo em alta. Não mexe no YouTube.
var SEGREDO = "${segredo}";
var PASTA_MAE = "${PASTA_MAE}";

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
    if (a === "ping") return resp({ ok: true });
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

// rode UMA vez pelo editor para dar as permissões (e-mail e Drive)
function testar() {
  filha(DriveApp.getRootFolder(), PASTA_MAE);
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), "[Painel] Ligação com o Google pronta", "Drive e e-mail liberados. Agora implante como App da Web.");
}`;

  window.painelGoogle = { cfg, gravar, ligado, chamar, pasta, enviarAlta, liberar, lixeira, codigo, PASTA_MAE };
})();
