'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import styles from './styles.module.css';
import SocialMedia from '../SocialMedia';

const SUPPORTED_LANGS = ['NL', 'EN', 'DE', 'FR', 'ES', 'IT'];

const LANGUAGE_LABELS = {
  NL: 'Nederlands',
  EN: 'English',
  DE: 'Deutsch',
  FR: 'Français',
  ES: 'Español',
  IT: 'Italiano'
};

export default function Navbar() {
  const [selectedLang, setSelectedLang] = useState('EN');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const browserLang = (() => {
      if (typeof navigator === 'undefined' || !navigator.language) return 'EN';
      const langCode = navigator.language.slice(0, 2).toUpperCase();
      return SUPPORTED_LANGS.includes(langCode) ? langCode : 'EN';
    })();
    setSelectedLang(browserLang);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (lang) => {
    setSelectedLang(lang);
    setIsOpen(false);
  };

  const handleScrollToHero = () => {
    const emailInput = document.getElementById('early-access-email');
    if (emailInput) {
      setTimeout(() => {
        try {
          emailInput.focus({ preventScroll: true });
        } catch {
          emailInput.focus();
        }
      }, 200);
    }
  };

  return (
    <header className={styles.navbar}>
      <div className={styles.leftSection}>
        <div className={styles.logo}>
          <Image src="/img/vector.svg" alt="Next Collect Logo" width={21} height={32} priority />
          <span className={styles.logoText}>protech</span>
        </div>
        <SocialMedia />
      </div>
      <div className={styles.rightSection}>
        <div className={styles.languageDropdown} ref={dropdownRef}>
          <button
            type="button"
            className={`${styles.languageSelector} ${isOpen ? styles.languageSelectorOpen : ''}`}
            onClick={() => setIsOpen((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            <Image src="/img/frame-1.svg" alt="Language" width={16} height={16} />
            <span>{LANGUAGE_LABELS[selectedLang]}</span>
          </button>
          {isOpen && (
            <div className={styles.languageMenu} role="listbox">
              {SUPPORTED_LANGS.map((lang) => (
                <button
                  type="button"
                  key={lang}
                  className={styles.languageMenuItem}
                  role="option"
                  aria-selected={lang === selectedLang}
                  onClick={() => handleSelect(lang)}
                >
                  {LANGUAGE_LABELS[lang]}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className={styles.ctaButton} onClick={handleScrollToHero}>
          Join The Waitlist
        </button>
      </div>
    </header>
  );
}
