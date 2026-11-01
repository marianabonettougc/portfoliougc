// Vídeos guardados no painel (nov/2026, pedido da Mari: ela apaga o vídeo do celular depois de enviar)
// Bucket privado "videos" do Supabase (só a dona). Vídeo até 20 MB vai como está; maior é reduzido
// no navegador para 720p (MediaRecorder, leva o tempo do vídeo) antes de subir. Limite por arquivo: 50 MB.
(function () {
  const BUCKET = "videos";
  const MAX = 50 * 1024 * 1024;
  const SEM_REDUZIR = 20 * 1024 * 1024;
  const banco = () => window.banco;

  const ehVideo = (arq) => !!arq && (/^video\//.test(arq.type || "") || /\.(mp4|mov|m4v|webm|avi)$/i.test(arq.name || ""));
  const tipoGravador = () => {
    const op = ["video/mp4;codecs=avc1.42E01F,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    return op.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
  };
  const extDoTipo = (t) => (/mp4/.test(t) ? "mp4" : /webm/.test(t) ? "webm" : /quicktime/.test(t) ? "mov" : "mp4");
  const limpo = (s) => String(s || "video").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 50) || "video";

  // reduz para no máximo 720 de largura (ou altura, se deitado), uns 2,2 Mbps; toca o vídeo uma vez, sem som na caixa de som
  async function reduzir(arq, aoProgresso) {
    const tipo = tipoGravador();
    if (!tipo) throw new Error("Este navegador não consegue reduzir o vídeo. Use o Chrome, o Edge ou o Safari atualizado.");
    const url = URL.createObjectURL(arq);
    const v = document.createElement("video");
    v.src = url; v.playsInline = true; v.preload = "auto"; v.crossOrigin = "anonymous";
    v.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none";
    document.body.appendChild(v);
    let ac = null;
    try {
      await new Promise((ok, erro) => { v.onloadedmetadata = ok; v.onerror = () => erro(new Error("Não consegui abrir esse vídeo para guardar.")); });
      const dur = v.duration || 0;
      const lado = Math.min(720, Math.min(v.videoWidth, v.videoHeight) || 720);
      const fator = lado / (Math.min(v.videoWidth, v.videoHeight) || lado);
      const W = Math.round((v.videoWidth * fator) / 2) * 2, H = Math.round((v.videoHeight * fator) / 2) * 2;
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const x = c.getContext("2d");
      const stream = c.captureStream(30);
      // áudio pelo WebAudio: vai para a gravação e não sai na caixa de som
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        if (ac.state === "suspended") await ac.resume();
        const dest = ac.createMediaStreamDestination();
        ac.createMediaElementSource(v).connect(dest);
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      } catch (e) { v.muted = true; }
      const partes = [];
      const rec = new MediaRecorder(stream, { mimeType: tipo, videoBitsPerSecond: 2200000, audioBitsPerSecond: 128000 });
      rec.ondataavailable = (e) => { if (e.data && e.data.size) partes.push(e.data); };
      const parou = new Promise((ok) => { rec.onstop = ok; });
      let vivo = true;
      const desenhar = () => {
        if (!vivo) return;
        x.drawImage(v, 0, 0, W, H);
        if (aoProgresso && dur) aoProgresso(Math.min(99, Math.round((v.currentTime / dur) * 100)));
        if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(desenhar); else requestAnimationFrame(desenhar);
      };
      v.currentTime = 0;
      await v.play();
      rec.start(1000);
      desenhar();
      await new Promise((ok) => { v.onended = ok; });
      vivo = false;
      x.drawImage(v, 0, 0, W, H);
      rec.stop();
      await parou;
      stream.getTracks().forEach((t) => t.stop());
      return new Blob(partes, { type: tipo.split(";")[0] });
    } finally {
      try { v.pause(); } catch (e) { /* segue */ }
      v.remove(); URL.revokeObjectURL(url);
      if (ac) ac.close().catch(() => {});
    }
  }

  // devolve o arquivo que vai ser guardado (o original se for leve; senão a versão reduzida)
  async function preparar(arq, aoProgresso) {
    if (!ehVideo(arq)) return null;
    if (arq.size <= SEM_REDUZIR) return arq;
    const b = await reduzir(arq, aoProgresso);
    if (b.size > MAX) throw new Error("Mesmo reduzido, esse vídeo passou de 50 MB. Envie um trecho mais curto.");
    return b;
  }

  // sobe para o bucket e devolve { path, tamanho }
  async function subir(blob, nome, pasta) {
    if (!blob) return null;
    if (blob.size > MAX) throw new Error("Esse vídeo passa de 50 MB, o limite para guardar no painel.");
    const tipo = blob.type || "video/mp4";
    const path = `${pasta || "referencias"}/${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}-${limpo(nome)}.${extDoTipo(tipo)}`;
    const { error } = await banco().storage.from(BUCKET).upload(path, blob, { contentType: tipo === "video/quicktime" ? "video/quicktime" : tipo, upsert: false });
    if (error) throw new Error(/exceed|size/i.test(error.message || "") ? "O espaço do painel para vídeos encheu (1 GB do plano grátis). Apague vídeos antigos." : "Não consegui guardar o vídeo no painel: " + (error.message || "erro"));
    return { path, tamanho: blob.size };
  }

  async function guardar(arq, { pasta, aoProgresso } = {}) {
    const b = await preparar(arq, aoProgresso);
    return subir(b, arq.name, pasta);
  }

  const cacheUrl = new Map();
  async function url(path) {
    if (!path) return "";
    const c = cacheUrl.get(path);
    if (c && c.ate > Date.now()) return c.url;
    const { data, error } = await banco().storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error || !data) return "";
    cacheUrl.set(path, { url: data.signedUrl, ate: Date.now() + 50 * 60 * 1000 });
    return data.signedUrl;
  }
  async function baixar(path, nome) {
    const { data, error } = await banco().storage.from(BUCKET).createSignedUrl(path, 600, { download: nome || true });
    if (!error && data) window.open(data.signedUrl, "_blank", "noopener");
  }
  async function apagar(path) {
    if (!path) return;
    try { await banco().storage.from(BUCKET).remove([path]); } catch (e) { /* segue */ }
  }
  // <video data-video-path="..."> dentro da caixa: põe o link assinado
  async function tocarEm(caixa) {
    const els = (caixa || document).querySelectorAll("video[data-video-path]");
    for (const el of els) { if (!el.src) el.src = await url(el.dataset.videoPath); }
  }

  // vídeo enviado antes de o painel guardar vídeos (ou que falhou): ela escolhe o arquivo de novo e ele fica guardado na linha de roteiros
  function escolherVideo() {
    return new Promise((ok) => {
      const i = document.createElement("input"); i.type = "file"; i.accept = "video/*,.mov,.mp4,.m4v,.webm";
      i.style.cssText = "position:fixed;left:-9999px;opacity:0";
      i.addEventListener("change", () => { ok(i.files[0] || null); i.remove(); });
      document.body.appendChild(i); i.click();
    });
  }
  async function anexarAoRoteiro(r, aviso) {
    const arq = await escolherVideo();
    if (!arq) return null;
    if (!ehVideo(arq)) throw new Error("Escolha um arquivo de vídeo.");
    const msg = aviso || (() => {});
    msg("Guardando o vídeo no painel...");
    const g = await guardar(arq, { pasta: "transcricoes", aoProgresso: (p) => msg("Preparando o vídeo para guardar... " + p + "% (deixe a tela aberta)") });
    if (!g) throw new Error("Não consegui guardar o vídeo.");
    const { error } = await banco().from("roteiros").update({ video_path: g.path, video_tamanho: g.tamanho }).eq("id", r.id);
    if (error) { apagar(g.path); throw new Error("Não consegui ligar o vídeo à referência: " + error.message); }
    r.video_path = g.path; r.video_tamanho = g.tamanho;
    return g.path;
  }
  // janela do "vídeo não ficou guardado": pergunta e já guarda (usada pelas capas sem vídeo)
  async function oferecerAnexar(r, aviso, depois) {
    const pergunta = "Esse vídeo foi enviado antes de o painel guardar vídeos, então o arquivo não ficou salvo aqui. Quer escolher o vídeo de novo para ele ficar guardado nesta referência?";
    const sim = window.painelDialogo ? await window.painelDialogo.confirmar(pergunta, { ok: "Escolher o vídeo" }) : true;
    if (!sim) return;
    try { const p = await anexarAoRoteiro(r, aviso); if (p) { aviso && aviso("Vídeo guardado no painel."); if (depois) depois(r); } }
    catch (e) { aviso && aviso(e.message || "Não consegui guardar o vídeo.", true); }
  }

  window.painelVideos = { ehVideo, preparar, subir, guardar, url, baixar, apagar, tocarEm, reduzir, anexarAoRoteiro, oferecerAnexar };
})();
