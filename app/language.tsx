'use client';
/* oxlint-disable react/react-compiler -- Restore the browser preference after hydration. */
import { createContext, useContext, useEffect, useState } from 'react';
import { translate } from '@/lib/translations.mjs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  const [notice, setNotice] = useState('');
  return (
    <>
      <RadioGroup
        className="language-switcher"
        aria-label={t('表示言語')}
        value={language}
        onValueChange={(value) => {
          const next = String(value);
          if (next !== 'ja' && next !== 'en') return;
          setLanguage(next);
          setNotice('');
          try {
            localStorage.setItem('kotoba:language', next);
          } catch {
            setNotice(
              '表示は変更しましたが、このブラウザには設定を保存できません。',
            );
          }
        }}
      >
        <label className="language-choice" lang="ja" htmlFor="language-ja">
          <RadioGroupItem
            id="language-ja"
            value="ja"
            aria-label="日本語"
            className="language-radio"
          />
          <span aria-hidden="true">
            <span className="language-native">日本語</span>
            <span className="language-short">JP</span>
          </span>
        </label>
        <label className="language-choice" lang="en" htmlFor="language-en">
          <RadioGroupItem
            id="language-en"
            value="en"
            aria-label="English"
            className="language-radio"
          />
          <span aria-hidden="true">EN</span>
        </label>
      </RadioGroup>
      {notice && <output className="sr-only">{t(notice)}</output>}
    </>
  );
}
