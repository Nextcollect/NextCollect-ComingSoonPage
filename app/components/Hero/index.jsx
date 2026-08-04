'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './styles.module.css';
import { validateEmail } from './validation';
import SocialMedia from '../SocialMedia';
import { useLanguage } from '../../context/LanguageProvider';

const EUROPEAN_COUNTRIES = Object.freeze([
  'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic',
  'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece',
  'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg',
  'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia',
  'Slovenia', 'Spain', 'Sweden', 'United Kingdom', 'Switzerland', 'Norway'
].sort());

// NOTE: milestone thresholds are duplicated in supabase/functions/send-confirmation-email/index.ts
const getMilestoneText = (position, t) => {
  const milestones = [100, 500, 1000, 2000, 3000, 5000, 10000];
  for (const threshold of milestones) {
    if (position <= threshold) {
      return (t('success.milestone_first') || "You're now part of the first {threshold} helping shape the platform")
        .replace('{threshold}', threshold);
    }
  }
  return (t('success.milestone_number') || "You're registrant #{position}")
    .replace('{position}', position);
};

export default function Hero() {
  const { t, locale } = useLanguage();
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const countryDropdownRef = useRef(null);
  const modalRef = useRef(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendError, setResendError] = useState('');
  const [registrationPosition, setRegistrationPosition] = useState(null);

  // D-002: the edge function is the only path that writes the table. The anon key has no
  // database access at all, so there is no client-side insert any more — signup and resend
  // are both a single call to this function.
  const callSignupFunction = async (payload) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      throw new Error('Supabase keys are missing');
    }

    const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/send-confirmation-email`;

    return fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  };

  const handleCloseSuccess = () => {
    setShowSuccess(false);
    setEmailSent(false);
    setIsResending(false);
    setResendEmail('');
    setResendError('');
    setRegistrationPosition(null);
  };

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = showSuccess ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showSuccess]);

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

    const modal = modalRef.current;
    if (modal) {
      const focusable = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) focusable[0].focus();
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleCloseSuccess();
        return;
      }
      if (event.key !== 'Tab' || !modal) return;
      const focusable = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSuccess]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setMessage('');
    setMessageType('');

    if (!email.trim() || !country.trim()) {
      setMessage(t('form.error_fields_required') || 'Please fill in all fields');
      setMessageType('error');
      return;
    }

    if (!validateEmail(email)) {
      setMessage(t('form.error_email_invalid') || 'Please enter a valid email address');
      setMessageType('error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await callSignupFunction({
        action: 'signup',
        email: email.trim(),
        country,
        // Stored so the unsubscribe page can be shown in the language they signed up in.
        locale: (locale || 'EN').toLowerCase(),
      });

      if (response.status === 409) {
        setMessage(t('form.error_email_exists') || 'This email is already registered');
        setMessageType('error');
        return;
      }

      if (!response.ok) {
        // C6: a server-side failure is NOT the same as bad input. Say so, so an outage
        // reads as an outage rather than as the user's mistake.
        setMessage(t('form.error_unavailable') || "We couldn't reach the signup service. Please try again in a moment.");
        setMessageType('error');
        return;
      }

      const result = await response.json();

      setRegistrationPosition(result.position ?? null);
      setResendEmail(email.trim());
      setEmailSent(result.emailSent === true);
      setShowSuccess(true);
      setMessage('');
      setMessageType('');
      setEmail('');
      setCountry('');
    } catch (err) {
      // C6: fetch only throws on network/DNS/CORS failure — never on an HTTP error status.
      // This branch means the service was unreachable, which is exactly the failure that
      // went undetected for five months (D-012). It must not read as "your input was wrong".
      console.error('Signup request failed to reach the service:', err);
      setMessage(t('form.error_unavailable') || "We couldn't reach the signup service. Please try again in a moment.");
      setMessageType('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmail = async () => {
    if (isResending) return;
    setResendError('');
    setIsResending(true);
    try {
      // Resend never sends a position — the server looks it up. D-001.
      const response = await callSignupFunction({
        action: 'resend',
        email: resendEmail,
      });

      if (response.ok) {
        setEmailSent(true);
      } else {
        setResendError(t('form.error_resend') || 'Failed to resend. Please try again.');
      }
    } catch (err) {
      setResendError(t('form.error_resend') || 'Failed to resend. Please try again.');
    } finally {
      setIsResending(false);
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
                disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting}
              aria-disabled={isSubmitting}
            >
              {isSubmitting
                ? (t('form.submitting') || 'Sending…')
                : (t('form.submit') || 'Get Early Access')}
            </button>
          </form>

          {/* OUTSIDE the <form> on purpose. .emailForm is `flex-direction: row` above
              768px, so a <p> placed among the inputs becomes a flex item and gets squeezed
              into a ~12-character column between the country select and the button. Below
              768px the form switches to `column` and it looked fine, which is why this only
              broke on desktop. Sitting after </form> takes it out of the flex row at every
              width — the same place the status message already lives. */}
          <p className={styles.consent}>
            {t('form.consent') || "We'll store your email and country to send you a confirmation now and one announcement at launch — nothing else. Unsubscribe any time."}{' '}
            <Link href={`/privacy?lang=${(locale || 'EN').toLowerCase()}`} className={styles.consentLink}>
              {t('form.privacy_link') || 'Privacy'}
            </Link>
          </p>
      {message && (
        <div className={`${styles.message} ${styles[messageType]}`} role="status" aria-live="polite">
          {message}
        </div>
      )}

      {showSuccess && (
        <div className={styles.successOverlay} role="dialog" aria-modal="true" aria-labelledby="success-title">
          <div className={styles.successCard} ref={modalRef}>
            <h2 id="success-title" className={styles.successTitle}>{t('success.title') || "You're in the list"}</h2>
            <p className={styles.successSubtitle}>
              {t('success.subtitle') || 'Thanks for joining our early group. You\'ll be one of the founding members and get access before anyone else.'}
            </p>
            {registrationPosition && (
              <p className={styles.successMilestone}>
                {getMilestoneText(registrationPosition, t)}
              </p>
            )}
            {/* Decorative success check. Was a dotlottie player pulling a runtime from
                unpkg.com and an asset from lottie.host — two third-party requests that
                disclosed every visitor's IP for an aria-hidden decoration. Inline SVG +
                CSS stroke animation needs no network, no dependency, and cannot fail
                silently. Honours prefers-reduced-motion. */}
            <div className={styles.successCheck} aria-hidden="true">
              <svg
                className={styles.successCheckMark}
                viewBox="0 0 52 52"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                focusable="false"
              >
                <circle className={styles.successCheckCircle} cx="26" cy="26" r="24" />
                <path className={styles.successCheckPath} d="M14 27l8 8 16-16" />
              </svg>
            </div>
            <div className={styles.emailNotification}>
              <p>
                {emailSent
                  ? (t('success.check_email') || "Check your email for updates. Don't see it? Check your spam folder.")
                  : (t('success.no_email') || "Didn't receive a confirmation email?")}
              </p>
              <button
                type="button"
                className={styles.resendLink}
                onClick={handleResendEmail}
                disabled={isResending}
              >
                {isResending ? '…' : (t('success.resend') || 'Resend email')}
              </button>
              {resendError && (
                <p role="alert" className={styles.resendError}>{resendError}</p>
              )}
            </div>
            <button type="button" className={styles.successButton} onClick={handleCloseSuccess}>
              {t('success.continue') || 'Continue'}
            </button>
            <a href="mailto:info@nxtcollect.com" className={styles.successEmail}>info@nxtcollect.com</a>
          </div>
        </div>
      )}
        </div>
        <div className={styles.heroImage}>
          <Image
            src="/img/Test_header_Image.png"
            alt="Collectibles"
            width={720}
            height={600}
            style={{ width: '100%', height: 'auto' }}
            priority
          />
        </div>
      </div>
    </section>
  );
}
