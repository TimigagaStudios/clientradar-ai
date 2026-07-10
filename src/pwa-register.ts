// ClientRadar AI - PWA register
// Import this once in src/main.tsx :  import './pwa-register'
export {};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        // console.log('SW registered', reg.scope);
        // Auto-reload when a new version takes control
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      })
      .catch(err => console.warn('SW register failed:', err));
  });
}

// iOS install prompt helper â€“ iOS doesn't fire beforeinstallprompt
let deferredPrompt: any = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

export const canInstallPWA = () => !!deferredPrompt;
export const promptInstallPWA = async () => {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
};