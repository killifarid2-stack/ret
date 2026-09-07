import React, { useState } from 'react';
import { Link as LinkIcon, Camera, Copy, Check, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface JudgeConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (method: 'link' | 'camera', value: string) => void;
  matchLink: string;
}

export default function JudgeConnectionDialog({ isOpen, onClose, onConnect, matchLink }: JudgeConnectionDialogProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'select' | 'link' | 'camera'>('select');
  const [linkInput, setLinkInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'pending' | 'granted' | 'denied'>('pending');

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(matchLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleRequestCamera = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraPermission('granted');
      setMode('camera');
    } catch {
      setCameraPermission('denied');
    }
  };

  const handleLinkSubmit = () => {
    if (linkInput.trim()) {
      onConnect('link', linkInput.trim());
      setLinkInput('');
      setMode('select');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="panel p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-sm font-bold text-foreground">{t('judgeConnectionTitle')}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {mode === 'select' && (
          <div className="space-y-3">
            {/* Copy link */}
            <div className="p-3 rounded-lg bg-secondary/50 border border-border">
              <div className="text-xs text-muted-foreground mb-2">{t('shareMatchLinkLabel')}</div>
              <div className="flex gap-2">
                <input
                  value={matchLink}
                  readOnly
                  className="flex-1 px-2 py-1.5 rounded bg-background text-xs text-foreground border border-border"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? t('copiedLabel') : t('copyLabel')}
                </button>
              </div>
            </div>

            {/* Options */}
            <button
              onClick={() => setMode('link')}
              className="w-full p-4 rounded-xl bg-secondary border border-border hover:border-primary/50 transition-colors flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <LinkIcon size={18} className="text-primary" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-foreground">{t('enterLinkTitle')}</div>
                <div className="text-xs text-muted-foreground">{t('enterLinkDesc')}</div>
              </div>
            </button>

            <button
              onClick={handleRequestCamera}
              className="w-full p-4 rounded-xl bg-secondary border border-border hover:border-primary/50 transition-colors flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Camera size={18} className="text-primary" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-foreground">{t('scanQrTitle')}</div>
                <div className="text-xs text-muted-foreground">{t('scanQrDesc')}</div>
              </div>
            </button>

            {cameraPermission === 'denied' && (
              <p className="text-xs text-destructive text-center">{t('cameraDeniedText')}</p>
            )}
          </div>
        )}

        {mode === 'link' && (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">{t('enterMatchLinkLabel')}</div>
            <input
              value={linkInput}
              onChange={e => setLinkInput(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setMode('select')} className="flex-1 py-2 rounded-lg bg-secondary text-muted-foreground text-sm font-semibold">
                {t('backLabel')}
              </button>
              <button onClick={handleLinkSubmit} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
                {t('connectLabel')}
              </button>
            </div>
          </div>
        )}

        {mode === 'camera' && (
          <div className="space-y-3">
            <div className="aspect-square bg-secondary rounded-lg flex items-center justify-center border border-border">
              <div className="text-center">
                <Camera className="mx-auto text-primary mb-2" size={32} />
                <p className="text-xs text-muted-foreground">{t('cameraActiveText')}</p>
              </div>
            </div>
            <button onClick={() => setMode('select')} className="w-full py-2 rounded-lg bg-secondary text-muted-foreground text-sm font-semibold">
              {t('backLabel')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
