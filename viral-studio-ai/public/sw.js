// Service worker do Viral Studio (PWA).
// Estratégia deliberadamente conservadora: o app depende do servidor para
// operações e render, então NÃO fazemos cache agressivo (quebraria edição e
// atrapalharia o HMR em dev). O SW existe para (1) tornar o app instalável —
// o Chrome exige um handler de fetch — e (2) mostrar uma tela offline decente.
const SHELL_CACHE = "vs-shell-v2";
const SHELL_ASSETS = ["/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

const OFFLINE_HTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sem conexão · Viral Studio</title>
<style>
  html,body{margin:0;height:100%;background:#0b0b0d;color:#f2f0ea;
    font-family:system-ui,-apple-system,sans-serif;display:grid;place-items:center;text-align:center}
  .b{max-width:320px;padding:24px}
  h1{font-family:Georgia,serif;color:#e8b64c;font-size:26px;margin:0 0 8px}
  p{color:#9b988f;font-size:14px;line-height:1.5}
  button{margin-top:16px;background:#e8b64c;color:#17130a;border:0;border-radius:10px;
    padding:11px 22px;font-weight:700;font-size:14px}
</style></head><body><div class="b">
  <h1>Viral <em>Studio</em></h1>
  <p>Você está sem conexão. O editor precisa do servidor para processar e renderizar — reconecte para continuar.</p>
  <button onclick="location.reload()">Tentar de novo</button>
</div></body></html>`;

// Network-first. Só serve fallback offline para navegações que falham.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } }))
    );
    return;
  }
  // ícones/manifest: cache-first (leves, estáveis)
  const url = new URL(req.url);
  if (SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});
