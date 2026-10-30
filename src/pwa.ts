interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installPrompt: InstallPrompt | null = null;
let snapshot = { offline: !navigator.onLine, ready: false, updateAvailable: false, installed: isInstalled(), canInstall: false, failed: false };
const listeners = new Set<() => void>();
function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}
function update(values: Partial<typeof snapshot>) {
  snapshot = { ...snapshot, ...values };
  listeners.forEach(listener => listener());
}
export const pwaStore = {
  getSnapshot: () => snapshot,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
};
export async function installApp() {
  const prompt = installPrompt;
  if (!prompt) return;
  installPrompt = null;
  update({ canInstall: false });
  await prompt.prompt();
  await prompt.userChoice;
}

export function initializePwa() {
  window.addEventListener('online', () => update({ offline: false }));
  window.addEventListener('offline', () => update({ offline: true }));
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event as InstallPrompt;
    update({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    update({ installed: true, canInstall: false });
  });
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
    const refresh = () => update({ ready: !!registration.active, updateAvailable: !!registration.waiting });
    const watchInstallation = () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        refresh();
        if (worker.state === 'redundant' && !registration.active) update({ failed: true });
        if (worker.state === 'activated') update({ failed: false });
      });
    };
    refresh();
    watchInstallation();
    registration.addEventListener('updatefound', watchInstallation);
    navigator.serviceWorker.addEventListener('controllerchange', refresh);
    const check = () => { if (navigator.onLine) void registration.update().catch(() => {}); };
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  }).catch(() => update({ failed: true }));
}
