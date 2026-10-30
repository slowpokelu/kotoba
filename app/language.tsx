'use client';
/* oxlint-disable react/react-compiler -- Restore the browser preference after hydration. */
import { createContext, useContext, useEffect, useState } from 'react';
import { translate } from '@/lib/translations.mjs';
import { LANGUAGE_KEY } from '@/lib/profile.mjs';
const LanguageContext = createContext({
  language: 'en',
  setLanguage: (_value: string) => {},
  t: (text: string) => text,
});
// A saved choice wins; otherwise follow the browser, so a Japanese phone
// starts in Japanese. Read before the first render to avoid an English flash.
function initialLanguage() {
  if (typeof window === 'undefined') return 'en';
  let saved = null;
  try {
    saved = localStorage.getItem(LANGUAGE_KEY);
  } catch {
    /* Fall back to the browser language. */
  }
  const browserJapanese = navigator.languages?.some((l) =>
    l.toLowerCase().startsWith('ja'),
  );
  return saved === 'ja' || (saved === null && browserJapanese) ? 'ja' : 'en';
}
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState(initialLanguage);
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
      localStorage.setItem(LANGUAGE_KEY, next);
    } catch {
      setNotice('表示は変更しましたが、このブラウザには設定を保存できません。');
    }
  }
  return (
    <>
      <span className="language-switch">
        <button
          type="button"
          id="language-en"
          lang="en"
          aria-label="English"
          aria-pressed={language === 'en'}
          onClick={() => selectLanguage('en')}
        >
          EN
        </button>
        <button
          type="button"
          id="language-ja"
          lang="ja"
          aria-label="日本語"
          aria-pressed={language === 'ja'}
          onClick={() => selectLanguage('ja')}
        >
          JP
        </button>
      </span>
      {notice && <output className="sr-only">{t(notice)}</output>}
    </>
  );
}
