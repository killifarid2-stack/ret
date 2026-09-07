import React, { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { Download, Smartphone, Monitor, CheckCircle } from 'lucide-react';
import appIconUrl from '@/assets/app-icon.png';

export default function InstallPage() {
  const { t } = useI18n();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen gradient-dark">
      
      <div className="flex items-center justify-center p-8" style={{ minHeight: 'calc(100vh - 48px)' }}>
        <div className="max-w-md w-full text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl overflow-hidden mb-4" style={{ boxShadow: 'var(--shadow-gold-strong)' }}>
            <img src={appIconUrl} alt="WAB-TKD" className="w-full h-full object-cover" />
          </div>

          <h1 className="title-power text-2xl">
            {t('installApp')}
          </h1>
          
          {installed ? (
            <div className="panel p-6">
              <CheckCircle size={48} className="mx-auto text-[hsl(var(--success))] mb-3" />
              <p className="text-[hsl(var(--success))] font-semibold">App installed successfully!</p>
            </div>
          ) : deferredPrompt ? (
            <button onClick={handleInstall}
              className="btn-power w-full py-4 rounded-xl font-display text-lg">
              {t('installReady')} — Click to Install
            </button>
          ) : (
            <div className="space-y-4">
              <div className="panel p-4">
                <Smartphone size={24} className="mx-auto text-[hsl(var(--primary))] mb-2" />
                <h3 className="font-display text-sm font-bold text-[hsl(var(--foreground))] mb-2">Android / Mobile</h3>
                <ol className="text-xs text-[hsl(var(--muted-foreground))] space-y-1 text-start">
                  <li>1. Open this page in Chrome</li>
                  <li>2. Tap the menu (⋮) → "Add to Home Screen"</li>
                  <li>3. Tap "Install" or "Add"</li>
                </ol>
              </div>
              <div className="panel p-4">
                <Monitor size={24} className="mx-auto text-[hsl(var(--primary))] mb-2" />
                <h3 className="font-display text-sm font-bold text-[hsl(var(--foreground))] mb-2">Windows / Desktop</h3>
                <ol className="text-xs text-[hsl(var(--muted-foreground))] space-y-1 text-start">
                  <li>1. Open this page in Chrome or Edge</li>
                  <li>2. Click the install icon (⊕) in the address bar</li>
                  <li>3. Click "Install"</li>
                </ol>
              </div>
            </div>
          )}

          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            WAB-TKD works offline once installed
          </p>
        </div>
      </div>
    </div>
  );
}
