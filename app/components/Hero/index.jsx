'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './styles.module.css';
import { supabase } from './supabase';
import { validateEmail } from './validation';
import SocialMedia from '../SocialMedia';

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
  const [showSuccess, setShowSuccess] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resendEmail, setResendEmail] = useState('');

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

  useEffect(() => {
    if (!showSuccess) return undefined;
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setShowSuccess(false);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showSuccess]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setMessageType('');

    if (!supabase) {
      setMessage('Signups are unavailable right now. Please set the Supabase keys.');
      setMessageType('error');
      return;
    }

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
        setResendEmail(email.trim());
        setEmailSent(true);
        setShowSuccess(true);
        setMessage('');
        setMessageType('');
        setEmail('');
        setCountry('');
      }
    } catch (err) {
      setMessage('Something went wrong. Please try again.');
      setMessageType('error');
    }
  };

  const handleResendEmail = () => {
    setEmailSent(false);
    setTimeout(() => setEmailSent(true), 500);
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
                  <span className={styles.countryCaret} aria-hidden="true">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path
                        d="M13 5.5L8 10.5L3 5.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
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

      {showSuccess && (
        <div className={styles.successOverlay} role="dialog" aria-modal="true" aria-labelledby="success-title">
          <div className={styles.successCard}>
            <h2 id="success-title" className={styles.successTitle}>You&apos;re on the list!</h2>
            <p className={styles.successSubtitle}>
              Thanks for being among the first to show interest.
            </p>
            <div className={styles.successCheck} aria-hidden="true">
              <dotlottie-wc src="https://lottie.host/56c326e0-28f2-4909-b3d6-05d01ba82897/DwmTJJcvkN.lottie" style={{width: '300px', height: '300px'}} autoplay loop></dotlottie-wc>
            </div>
            <p className={styles.successBody}>We&apos;ll notify you as soon as the product is live.</p>
            {emailSent && (
              <div className={styles.emailNotification}>
                <p>Check your email for updates. Don&apos;t see it? Check your spam folder.</p>
                <button type="button" className={styles.resendLink} onClick={handleResendEmail}>
                  Resend email
                </button>
              </div>
            )}
            <button type="button" className={styles.successButton} onClick={() => setShowSuccess(false)}>
              Continue
            </button>
            <div className={styles.successSocial}>
              <SocialMedia variant="modal" />
            </div>
            <a href="mailto:info@nxtcollect.com" className={styles.successEmail}>info@nxtcollect.com</a>
          </div>
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
