import React, { useState, useCallback, useEffect } from 'react';
import { I18nContext, Language, TranslationKey, getStoredLanguage, setStoredLanguage, t as translate } from '@/lib/i18n';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(getStoredLanguage());

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  // Keep the separate Public Display/Electron window synchronized with the
  // operator's language selection.
  useEffect(() => {
    // BroadcastChannel is required for Electron/Chromium windows where relying
    // on the storage event alone is not reliable enough for the public display.
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('wab-tkd-language');
      channel.onmessage = (event) => {
        const next = event.data;
        if (next === 'ar' || next === 'en') setLangState(next);
      };
    } catch {}

    const onStorage = (event: StorageEvent) => {
      if (event.key === 'tkd-wbd-lang' && (event.newValue === 'ar' || event.newValue === 'en')) {
        setLangState(event.newValue);
      }
    };
    const onLanguageEvent = (event: Event) => {
      const next = (event as CustomEvent).detail;
      if (next === 'ar' || next === 'en') setLangState(next);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('tkd-language-changed', onLanguageEvent);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('tkd-language-changed', onLanguageEvent);
      try { channel?.close(); } catch {}
    };
  }, []);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    setStoredLanguage(newLang);
    window.dispatchEvent(new CustomEvent('tkd-language-changed', { detail: newLang }));
    try { new BroadcastChannel('wab-tkd-language').postMessage(newLang); } catch {}
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  }, []);

  const t = useCallback((key: TranslationKey) => translate(key, lang), [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}
