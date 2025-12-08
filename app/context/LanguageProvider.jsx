"use client";

import { createContext, useContext, useState, useMemo } from "react";
import en from "../i18n/en.json";
import nl from "../i18n/nl.json";
import de from "../i18n/de.json";
import fr from "../i18n/fr.json";
import es from "../i18n/es.json";
import it from "../i18n/it.json";

const translations = { en, nl, de, fr, es, it };

const LanguageContext = createContext({
  locale: "en",
  setLocale: () => {},
  t: (path) => path,
});

export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState("EN");

  const value = useMemo(() => {
    const code = (locale || "EN").toLowerCase();
    const dict = translations[code] || translations.en;

    function t(path) {
      if (!path) return "";
      const parts = path.split(".");
      let cur = dict;
      for (const p of parts) {
        if (cur && Object.prototype.hasOwnProperty.call(cur, p)) {
          cur = cur[p];
        } else {
          return "";
        }
      }
      return cur;
    }

    return {
      locale,
      setLocale,
      t,
      dict,
    };
  }, [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export default LanguageContext;
