// ============================================================
// useLanguage — i18n context + hook
// ============================================================

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import en from '../i18n/en';
import ms from '../i18n/ms';
import type { TranslationKeys } from '../i18n/en';
import { useAuth } from './useAuth';

type Language = 'en' | 'ms';

interface LanguageContextType {
  lang: Language;
  t: TranslationKeys;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const translations: Record<Language, TranslationKeys> = { en, ms };

const LanguageContext = createContext<LanguageContextType | null>(null);

function getInitialLanguage(): Language {
  const stored = localStorage.getItem('preferred_language');
  if (stored === 'en' || stored === 'ms') return stored;
  return 'en';
}

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Language>(getInitialLanguage);
  const { profile } = useAuth();

  // Sync from profile preference when available
  useEffect(() => {
    if (profile?.preferred_language) {
      setLangState(profile.preferred_language);
      localStorage.setItem('preferred_language', profile.preferred_language);
    }
  }, [profile?.preferred_language]);

  const setLanguage = useCallback((l: Language) => {
    setLangState(l);
    localStorage.setItem('preferred_language', l);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(lang === 'en' ? 'ms' : 'en');
  }, [lang, setLanguage]);

  return (
    <LanguageContext.Provider
      value={{
        lang,
        t: translations[lang],
        setLanguage,
        toggleLanguage,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
