'use client';
/* oxlint-disable react/react-compiler -- Restore the browser preference after hydration. */
import { createContext, useContext, useEffect, useState } from 'react';
import { translate } from '@/lib/translations.mjs';
const LanguageContext = createContext({
  language: 'ja',
  setLanguage: (_value: string) => {},
  t: (text: string) => text,
});
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState('ja');
  useEffect(() => {
    try {
      if (localStorage.getItem('kotoba:language') === 'en') setLanguage('en');
    } catch {
      /* Keep Japanese. */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t: (text: string) => translate(text, language),
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}
export const useLanguage = () => useContext(LanguageContext);
