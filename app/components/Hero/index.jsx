'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './styles.module.css';
import { supabase } from './supabase';
import { validateEmail } from './validation';
import SocialMedia from '../SocialMedia';
import { useLanguage } from '../../context/LanguageProvider';

const EUROPEAN_COUNTRIES = [
  'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic',
  'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece',
  'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg',
  'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia',
  'Slovenia', 'Spain', 'Sweden', 'United Kingdom', 'Switzerland', 'Norway'
].sort();

const getMilestoneText = (position) => {
  const milestones = [100, 500, 1000, 2000, 3000, 5000, 10000];
  for (const threshold of milestones) {
    if (position <= threshold) {
      return `You’re now part of the first ${threshold} helping shape the platform`;
    }
  }
  return `You're registrant #${position}`;
};

export default function Hero() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const countryDropdownRef = useRef(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [registrationPosition, setRegistrationPosition] = useState(null);

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
      const { data, error } = await supabase
        .from('early_access_signups')
        .insert([{ email: email.trim(), country }])
        .select('registration_position')
        .maybeSingle();

      if (error) {
        if (error.code === '23505') {
          setMessage('This email is already registered');
          setMessageType('error');
        } else {
          setMessage('There was an issue with this entry. Please try again.');
          setMessageType('error');
        }
      } else {
        setRegistrationPosition(data?.registration_position);
        setResendEmail(email.trim());
        setShowSuccess(true);
        setMessage('');
        setMessageType('');
        setEmail('');
        setCountry('');

        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          const response = await fetch(`${supabaseUrl}/functions/v1/send-confirmation-email`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: email.trim(),
              registrationPosition: data?.registration_position,
            }),
          });

          if (response.ok) {
            setEmailSent(true);
          } else {
            console.error('Email send failed:', await response.json());
            setEmailSent(false);
          }
        } catch (emailErr) {
          console.error('Error sending email:', emailErr);
          setEmailSent(false);
        }
      }
    } catch (err) {
      setMessage('Something went wrong. Please try again.');
      setMessageType('error');
    }
  };

  const handleResendEmail = async () => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/send-confirmation-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: resendEmail,
          registrationPosition,
        }),
      });

      if (response.ok) {
        setEmailSent(true);
      } else {
        console.error('Resend failed:', await response.json());
      }
    } catch (err) {
      console.error('Error resending email:', err);
    }
  };

  return (
    <section className={styles.hero} id="hero">
      <div className={styles.heroCard}>
        <div className={styles.heroContent}>
          <div className={styles.textContent}>
            <h1 className={styles.heroTitle}>
              {t('hero.title') || "Europe's Trusted Platform for Collectors Launching 2026"}
            </h1>
            <p className={styles.heroDescription}>
              {t('hero.description') || 'Connect with verified collectors across 6 European countries. Discuss, authenticate, and discover collectibles, from Pokémon and vinyl to art and vintage watches.'}
            </p>
          </div>
          <form onSubmit={handleSubmit} className={styles.emailForm}>
            <div className={styles.formControl}>
              <label htmlFor="early-access-email" className={styles.formLabel}>
                {t('form.email_label') || 'Email'}
              </label>
              <input
                type="email"
                id="early-access-email"
                placeholder={t('form.email_placeholder') || 'Enter your email address'}
                className={styles.emailInput}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className={`${styles.formControl} ${styles.formControlCountry}`}>
              <label htmlFor="country-select" className={styles.formLabel}>
                {t('form.country_label') || 'Country'}
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
                  <span>{country || t('form.select_country') || 'Select country'}</span>
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
              {t('form.submit') || 'Get Early Access'}
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
            <h2 id="success-title" className={styles.successTitle}>{t('success.title') || "You're in the list"}</h2>
            <p className={styles.successSubtitle}>
              {t('success.subtitle') || 'Thanks for joining our early group. You’ll be one of the founding members and get access before anyone else.'}
            </p>
            {registrationPosition && (
              <p className={styles.successMilestone}>
                {getMilestoneText(registrationPosition)}
              </p>
            )}
            <div className={styles.successCheck} aria-hidden="true">
              <dotlottie-wc
                class={styles.successLottie}
                src="https://lottie.host/56c326e0-28f2-4909-b3d6-05d01ba82897/DwmTJJcvkN.lottie"
                autoplay
              ></dotlottie-wc>
            </div>
            {emailSent && (
              <div className={styles.emailNotification}>
                <p>{t('success.check_email') || "Check your email for updates. Don't see it? Check your spam folder."}</p>
                <button type="button" className={styles.resendLink} onClick={handleResendEmail}>
                  {t('success.resend') || 'Resend email'}
                </button>
              </div>
            )}
            <button type="button" className={styles.successButton} onClick={() => setShowSuccess(false)}>
              {t('success.continue') || 'Continue'}
            </button>
            <a href="mailto:info@nxtcollect.com" className={styles.successEmail}>info@nxtcollect.com</a>
          </div>
        </div>
      )}
        </div>
        <div className={styles.heroImage}>
          <img src="/img/Test_header_Image.png" alt="Collectibles" />
        </div>
      </div>
    </section>
  );
}
