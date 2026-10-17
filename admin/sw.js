// Service worker do painel instalado na Tela de Início: só recebe as notificações
// (Web Push da função notificacoes) e abre o painel quando ela toca no aviso.
// Não guarda nada em cache: o painel sempre carrega a versão nova.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { titulo: "Painel da Mari", texto: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.titulo || "Painel da Mari", {
    body: d.texto || "",
    icon: "/admin/icones/icone-192.png",
    badge: "/admin/icones/icone-192.png",
    tag: d.tag || undefined,
    data: { url: d.url || "/admin/" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/admin/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abertas) => {
    for (const c of abertas) { if (c.url.includes("/admin")) { c.focus(); return c.navigate ? c.navigate(url) : null; } }
    return self.clients.openWindow(url);
  }));
});
