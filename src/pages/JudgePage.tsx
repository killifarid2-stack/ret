import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import JudgePanel from '@/components/JudgePanel';
import { Link as LinkIcon, User, Hash, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function JudgePage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const urlMatch = params.get('match') || '';
  const urlPos = params.get('pos') || '';
  const urlName = params.get('name') || '';

  const [connected, setConnected] = useState(false);
  const [name, setName] = useState(() => urlName || localStorage.getItem('tkd-judge-name') || '');
  const [matchId, setMatchId] = useState(urlMatch);
  const [position, setPosition] = useState(urlPos || '1');
  const [linkInput, setLinkInput] = useState('');
  const [error, setError] = useState('');

  // Auto-connect if URL has both match id and name
  useEffect(() => {
    if (urlMatch && (urlName || localStorage.getItem('tkd-judge-name'))) {
      setConnected(true);
    }
  }, [urlMatch, urlName]);

  const parseLink = () => {
    setError('');
    try {
      const u = new URL(linkInput.trim());
      const m = u.searchParams.get('match');
      const p = u.searchParams.get('pos');
      if (!m) { setError(t('linkNoMatchIdError')); return; }
      setMatchId(m);
      if (p) setPosition(p);
    } catch {
      // treat as raw match id
      if (linkInput.trim()) setMatchId(linkInput.trim());
      else setError(t('enterValidLinkError'));
    }
  };

  const handleConnect = () => {
    if (!name.trim()) { setError(t('enterNameError')); return; }
    if (!matchId.trim()) { setError(t('enterMatchLinkError')); return; }
    localStorage.setItem('tkd-judge-name', name.trim());
    setConnected(true);
  };

  if (connected) {
    return <JudgePanel judgeId={`judge-${position}`} judgeName={name.trim() || `${t('judge')} ${position}`} />;
  }

  return (
    <div className="min-h-screen gradient-dark">
      
      <div className="flex items-center justify-center p-6" style={{ minHeight: 'calc(100vh - 48px)' }}>
        <div className="panel p-6 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[hsl(var(--primary))]/20 mb-3">
              <ShieldCheck className="text-[hsl(var(--primary))]" size={28} />
            </div>
            <h2 className="title-power text-lg">{t('judgeConnectionTitle')}</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              {t('judgeConnectionSubtitle')}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] flex items-center gap-1 mb-1">
                <User size={12} /> {t('judgeNameLabel')}
              </label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder={t('judgeNamePlaceholder')}
                className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm text-[hsl(var(--foreground))] focus:ring-2 focus:ring-[hsl(var(--primary))] focus:outline-none" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {['1','2','3','4'].map(p => (
                <button key={p} onClick={() => setPosition(p)}
                  className={`py-2 rounded-lg text-sm font-bold transition-all ${
                    position === p
                      ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                      : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))]'
                  }`}>
                  {t('judge')} {p}
                </button>
              ))}
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] flex items-center gap-1 mb-1">
                <Hash size={12} /> {t('matchIdLabel')}
              </label>
              <input value={matchId} onChange={e => setMatchId(e.target.value)} placeholder={t('matchIdPlaceholder')}
                className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm text-[hsl(var(--foreground))] font-mono" />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] flex items-center gap-1 mb-1">
                <LinkIcon size={12} /> {t('pasteMatchLinkLabel')}
              </label>
              <div className="flex gap-2">
                <input value={linkInput} onChange={e => setLinkInput(e.target.value)}
                  placeholder="https://.../judge?match=..."
                  className="flex-1 px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-xs text-[hsl(var(--foreground))]" />
                <button onClick={parseLink}
                  className="px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] text-xs font-semibold hover:text-[hsl(var(--foreground))]">
                  {t('parseLabel')}
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-[hsl(var(--destructive))] text-center">{error}</p>}

            <button onClick={handleConnect}
              className="btn-power w-full py-3 rounded-xl font-display text-sm">
              {t('connectToMatchLabel')}
            </button>

            <p className="text-[10px] text-center text-[hsl(var(--muted-foreground))]">
              {t('judgeQrTip')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
