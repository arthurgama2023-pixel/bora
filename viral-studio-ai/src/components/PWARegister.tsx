"use client";
import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Registra o service worker (torna o app instalável) e mostra um botão
// "Instalar app" quando o navegador oferece a instalação (Android/Chrome/Edge).
// No iOS não há evento de instalação — mostramos uma dica de "Compartilhar →
// Adicionar à Tela de Início" na primeira visita em Safari.
export default function PWARegister() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // Auto-atualização: se já havia um SW controlando esta página e um novo
    // assume o controle (nova versão do app publicada), recarrega UMA vez para
    // pegar o código novo — o usuário nunca fica preso num bundle em cache.
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    const onControllerChange = () => {
      if (!hadController || reloading) return; // 1ª instalação não recarrega
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const onLoad = () =>
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // procura por atualização já na carga e sempre que a aba volta ao foco
          void reg.update();
          const onVisible = () => document.visibilityState === "visible" && void reg.update();
          document.addEventListener("visibilitychange", onVisible);
        })
        .catch(() => {});
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS Safari fora de standalone → dica de instalação manual
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isIOS && !standalone && !localStorage.getItem("vs-ios-hint")) {
      setTimeout(() => setIosHint(true), 1500);
    }

    return () => {
      window.removeEventListener("load", onLoad);
      window.removeEventListener("beforeinstallprompt", onBIP);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => null);
    setDeferred(null);
  };

  const dismissIos = () => {
    localStorage.setItem("vs-ios-hint", "1");
    setIosHint(false);
  };

  if (deferred) {
    return (
      <button className="pwa-install" onClick={() => void install()}>
        📲 Instalar app
      </button>
    );
  }
  if (iosHint) {
    return (
      <div className="pwa-ios-hint" onClick={dismissIos}>
        <span>
          📲 Para instalar: toque em <b>Compartilhar</b> e depois em <b>“Adicionar à Tela de Início”</b>
        </span>
        <button aria-label="Fechar">✕</button>
      </div>
    );
  }
  return null;
}
