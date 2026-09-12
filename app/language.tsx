'use client';
/* oxlint-disable react/react-compiler -- Restore the browser preference after hydration. */
import { createContext, useContext, useEffect, useState } from 'react';
import { translate } from '@/lib/translations.mjs';
const LanguageContext = createContext({
  language: 'en',
  setLanguage: (_value: string) => {},
  t: (text: string) => text,
});
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState('en');
  useEffect(() => {
    try {
      if (localStorage.getItem('kotoba:language') === 'ja') setLanguage('ja');
    } catch {
      /* Keep English. */
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

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  const [notice, setNotice] = useState('');
  function selectLanguage(next: string) {
    setLanguage(next);
    setNotice('');
    try {
      localStorage.setItem('kotoba:language', next);
    } catch {
      setNotice('表示は変更しましたが、このブラウザには設定を保存できません。');
    }
  }
  return (
    <>
      <span>
        <button
          type="button"
          id="language-en"
          lang="en"
          aria-label="English"
          aria-pressed={language === 'en'}
          onClick={() => selectLanguage('en')}
        >
          {language === 'en' ? <u>en</u> : 'en'}
        </button>
        <span aria-hidden="true"> / </span>
        <button
          type="button"
          id="language-ja"
          lang="ja"
          aria-label="日本語"
          aria-pressed={language === 'ja'}
          onClick={() => selectLanguage('ja')}
        >
          {language === 'ja' ? <u>jp</u> : 'jp'}
        </button>
      </span>
      {notice && <output className="sr-only">{t(notice)}</output>}
    </>
  );
}
