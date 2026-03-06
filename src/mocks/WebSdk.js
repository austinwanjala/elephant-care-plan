if (typeof window !== 'undefined') {
  if (!window.WebSdk) {
    window.WebSdk = {
      WebChannelOptions: class {
        constructor(options) {}
      },
      WebChannelClient: class {
        constructor(path, options) {
          this.path = path;
          this.options = options;
        }
        
        onConnectionFailed() {}
        onConnectionSucceed() {}
        onDataReceivedBin(data) {}
        onDataReceivedTxt(data) {}
        
        connect() {
          console.warn("WebSdk is mock. Triggering connection failed fallback.");
          // Attempt to fail gracefully so the UI can show the installation prompt
          setTimeout(() => {
            if (typeof this.onConnectionFailed === 'function') {
              this.onConnectionFailed();
            }
          }, 100);
        }
        
        disconnect() {}
        sendDataBin(data) {}
        sendDataTxt(data) {}
        isConnected() { return false; }
      }
    };
  }
}

export default window?.WebSdk || {};
