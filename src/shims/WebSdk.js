/**
 * WebSdk Shim for Vite
 *
 * @digitalpersona/devices does a bare `import 'WebSdk'` in its source.
 * Vite needs a module to satisfy that import.
 *
 * The REAL WebSdk library is loaded via a <script src="/WebSdk.js"> tag
 * in index.html BEFORE React mounts, so window.WebSdk is already the
 * real DigitalPersona implementation by the time this shim runs.
 *
 * We only install a fallback mock if the real script somehow failed to load.
 */
if (typeof window !== 'undefined' && typeof window.WebSdk === 'undefined') {
  console.error(
    '[WebSdk Shim] window.WebSdk is not defined! ' +
    'The real DigitalPersona WebSdk script (/WebSdk.js) failed to load from index.html. ' +
    'Fingerprint capture will NOT work. Check the browser Network tab for a 404 on /WebSdk.js.'
  );
  // Emergency fallback so the app doesn't crash — but capture will still fail
  window.WebSdk = {
    WebChannelOptions: class { constructor() {} },
    WebChannelClient: class {
      constructor() {}
      onConnectionFailed() {}
      onConnectionSucceed() {}
      onDataReceivedBin() {}
      onDataReceivedTxt() {}
      connect() {
        console.error('[WebSdk Shim] Fallback connect() called — real SDK not available.');
        setTimeout(() => {
          if (typeof this.onConnectionFailed === 'function') this.onConnectionFailed();
        }, 100);
      }
      disconnect() {}
      sendDataBin() {}
      sendDataTxt() {}
      isConnected() { return false; }
    }
  };
} else {
  console.log('[WebSdk Shim] Real window.WebSdk is loaded ✓');
}
