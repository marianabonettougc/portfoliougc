/* Janelas próprias do painel no lugar de confirm/prompt/alert do navegador.
   painelDialogo.confirmar(msg, {ok, perigo}) -> Promise<boolean>
   painelDialogo.texto(msg, padrao, {linhas, ok}) -> Promise<string|null>
   painelDialogo.aviso(msg) -> Promise (só botão Ok) */
(() => {
  const css = `dialog.dq{border:0;border-radius:16px;padding:0;width:min(440px,calc(100vw - 24px));background:var(--cartao,#fffaf3);color:var(--texto,#3b2a20);box-shadow:0 20px 60px rgba(30,20,14,.3);font:inherit}
dialog.dq::backdrop{background:rgba(30,20,14,.45)}
.dq-corpo{padding:18px 18px 8px;font-size:14px;line-height:1.5;white-space:pre-line}
.dq-corpo textarea,.dq-corpo input{display:block;width:100%;box-sizing:border-box;margin-top:10px;padding:10px 12px;border:1px solid var(--linha,#e4d6c6);border-radius:10px;font:inherit;background:var(--fundo,#fff);color:inherit;resize:vertical}
.dq-rodape{display:flex;gap:8px;justify-content:flex-end;padding:12px 18px 16px;flex-wrap:wrap}
.dq-rodape button{border:1px solid var(--linha,#e4d6c6);background:transparent;color:inherit;border-radius:999px;padding:9px 18px;font:inherit;font-size:13px;cursor:pointer;min-height:40px}
.dq-rodape .dq-ok{background:var(--marrom,#6b4a36);border-color:var(--marrom,#6b4a36);color:#fff}
.dq-rodape .dq-ok.dq-perigo{background:var(--terracota,#b5573b);border-color:var(--terracota,#b5573b)}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function abrir(msg, campo, op) {
    return new Promise((res) => {
      const d = document.createElement("dialog"); d.className = "dq";
      const ehTexto = campo !== undefined;
      const entrada = !ehTexto ? "" : (op.linhas || 1) > 1 ? `<textarea rows="${op.linhas}">${esc(campo || "")}</textarea>` : `<input type="text" value="${esc(campo || "")}">`;
      const nao = op.soOk ? "" : `<button type="button" class="dq-nao">${esc(op.nao || "Cancelar")}</button>`;
      d.innerHTML = `<div class="dq-corpo">${esc(msg)}${entrada}</div><div class="dq-rodape">${nao}<button type="button" class="dq-ok${op.perigo ? " dq-perigo" : ""}">${esc(op.ok || (ehTexto ? "Salvar" : "Confirmar"))}</button></div>`;
      document.body.appendChild(d);
      let valor = ehTexto ? null : false;
      const fechar = () => { d.close(); };
      if (!op.soOk) d.querySelector(".dq-nao").onclick = fechar;
      d.querySelector(".dq-ok").onclick = () => { valor = ehTexto ? d.querySelector("textarea,input").value : true; fechar(); };
      const inp = d.querySelector("input"); if (inp) inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); d.querySelector(".dq-ok").click(); } });
      d.addEventListener("close", () => { d.remove(); res(valor); });
      d.addEventListener("click", (e) => { if (e.target === d) fechar(); });
      d.showModal();
      const foco = d.querySelector("textarea,input") || d.querySelector(".dq-ok"); foco.focus(); if (foco.select && ehTexto) foco.select();
    });
  }
  window.painelDialogo = {
    confirmar: (msg, op = {}) => abrir(msg, undefined, op),
    texto: (msg, padrao = "", op = {}) => abrir(msg, padrao, op),
    aviso: (msg) => abrir(msg, undefined, { ok: "Ok", soOk: true }),
  };
  // Qualquer alert que ainda exista vira a janela do painel (não trava a página).
  window.alert = (msg) => { window.painelDialogo.aviso(msg == null ? "" : msg); };
})();
