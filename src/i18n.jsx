import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { detectLocale, formatUtc, translate } from './locales.mjs';

const Context = createContext(null);
const STORAGE_KEY = 'suitokensaver:locale';

export function LocaleProvider({ children }) {
  const [locale, setLocale] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || detectLocale(navigator.languages); }
    catch { return detectLocale(navigator.languages); }
  });
  useEffect(() => {
    document.documentElement.lang = locale;
    try { localStorage.setItem(STORAGE_KEY, locale); } catch {}
  }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t: (text, variables) => translate(locale, text, variables), time: (value) => formatUtc(value, locale) }), [locale]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useI18n() {
  const value = useContext(Context);
  if (!value) throw new Error('LocaleProvider is required.');
  return value;
}
