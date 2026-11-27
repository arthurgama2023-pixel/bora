// Google Tag Manager: fila de eventos lida pelo container.
export {};

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}
