'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './styles.module.css';
import { supabase } from './supabase';
import { validateEmail } from './validation';

const EUROPEAN_COUNTRIES = [
  'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic',
  'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece',
  'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg',
  'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia',
  'Slovenia', 'Spain', 'Sweden', 'United Kingdom', 'Switzerland', 'Norway'
].sort();

export default function Hero() {
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const countryDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!countryDropdownRef.current) return;
      if (!countryDropdownRef.current.contains(event.target)) {
        setIsCountryOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setMessageType('');

    if (!email.trim() || !country.trim()) {
      setMessage('Please fill in all fields');
      setMessageType('error');
      return;
    }

    if (!validateEmail(email)) {
      setMessage('Please enter a valid email address');
      setMessageType('error');
      return;
    }

    try {
      const { error } = await supabase
        .from('early_access_signups')
        .insert([{ email: email.trim(), country }]);

      if (error) {
        if (error.code === '23505') {
          setMessage('This email is already registered');
          setMessageType('error');
        } else {
          setMessage('Error signing up. Please try again.');
          setMessageType('error');
        }
      } else {
        setMessage('Thanks for signing up! Check your email for updates.');
        setMessageType('success');
        setEmail('');
        setCountry('');
      }
    } catch (err) {
      setMessage('Something went wrong. Please try again.');
      setMessageType('error');
    }
  };

  return (
    <section className={styles.hero} id="hero">
      <div className={styles.heroCard}>
        <div className={styles.heroContent}>
          <div className={styles.textContent}>
            <h1 className={styles.heroTitle}>
              Europe's Trusted Platform for Collectors Launching 2026
            </h1>
            <p className={styles.heroDescription}>
              Connect with verified collectors across 6 European countries. Discuss, authenticate, and discover collectibles, from Pokémon and vinyl to art and vintage watches.
            </p>
          </div>
          <form onSubmit={handleSubmit} className={styles.emailForm}>
            <div className={styles.formControl}>
              <label htmlFor="early-access-email" className={styles.formLabel}>
                Email
              </label>
              <input
                type="email"
                id="early-access-email"
                placeholder="Enter your email address"
                className={styles.emailInput}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className={`${styles.formControl} ${styles.formControlCountry}`}>
              <label htmlFor="country-select" className={styles.formLabel}>
                Country
              </label>
              <div className={styles.countryDropdown} ref={countryDropdownRef}>
                <button
                  type="button"
                  id="country-select"
                  className={`${styles.countrySelect} ${isCountryOpen ? styles.countrySelectOpen : ''}`}
                  onClick={() => setIsCountryOpen((prev) => !prev)}
                  aria-haspopup="listbox"
                  aria-expanded={isCountryOpen}
                >
                  <span>{country || 'Select country'}</span>
                  <span className={styles.countryCaret} aria-hidden="true">▾</span>
                </button>
                {isCountryOpen && (
                  <div className={styles.countryMenu} role="listbox">
                    {EUROPEAN_COUNTRIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={styles.countryMenuItem}
                        role="option"
                        aria-selected={country === c}
                        onClick={() => {
                          setCountry(c);
                          setIsCountryOpen(false);
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button type="submit" className={styles.submitButton}>
              Get Early Access
            </button>
          </form>
          {message && (
            <div className={`${styles.message} ${styles[messageType]}`}>
              {message}
            </div>
          )}
        </div>
        <div className={styles.heroImage}>
          <img src="/img/right-1.png" alt="Collectibles" />
        </div>
      </div>
    </section>
  );
}
