import { useState, ReactNode } from 'react';
import viTranslations from '@/locales/vi';
import koTranslations from '@/locales/ko';
import { I18nContext, type Language } from './i18nContextCore';

const translations = {
  vi: viTranslations,
  ko: koTranslations,
};

interface I18nProviderProps {
  children: ReactNode;
}

export const I18nProvider = ({ children }: I18nProviderProps) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language') as Language;
    return saved && (saved === 'vi' || saved === 'ko') ? saved : 'vi';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = translations[language];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        value = translations.vi;
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = value[fallbackKey];
          } else {
            return key;
          }
        }
        break;
      }
    }

    let result = typeof value === 'string' ? value : key;

    if (params) {
      Object.keys(params).forEach((paramKey) => {
        result = result.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(params[paramKey]));
      });
    }

    return result;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export type { Language } from './i18nContextCore';
