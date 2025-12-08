 'use client';

import { useCallback } from 'react';
import { useLanguage } from '../../context/LanguageProvider';
import styles from './styles.module.css';

export function AboutSection() {
  const { t } = useLanguage();
  return (
    <section className={styles.section}>
      <div className={styles.textColumn}>
        <h2 className={styles.sectionTitle}>{t('section.title') || 'Built By Collectors, For Collectors'}</h2>
        <p className={styles.sectionSubtitle}>
          {t('section.subtitle') || 'For European collectors who value community as much as their collections'}
        </p>
        <p className={styles.sectionText}>
          {t('section.paragraph') ||
            'We are a team of European collectors building a trusted platform for collectors across Europe. Our goal is to bring together professionals and passionate collectors within their niche, local areas and European communities, creating a trusted, fair and transparent market shaped by European expertise and knowledge. Our mission is to make the collecting community more accessible, reliable and truly built for Europe. Whether you are a local expert, a seasoned collector or a business in a collector niche, Next Collect helps you connect with verified collectors nearby or across Europe, share knowledge you can trust and trade with confidence all in one place.'}
        </p>
      </div>
      <div className={styles.imageColumn}>
        <img src="/img/Test_header_Image.png" alt="Collectors community" />
      </div>
    </section>
  );
}

export function FeaturesSection() {
  const { t } = useLanguage();
  const features = [
    {
      icon: '/img/NextCollect_All-In-One_Icon.svg',
      title: t('features.f1_title') || 'Everything In One Place',
      description: t('features.f1_description') || 'No more scattered groups. One home for collectors to follow trends, meet others, and stay up to date across the Europe market.'
    },
    {
      icon: '/img/NextCollect_Verification_Icon.svg',
      title: t('features.f2_title') || 'Verified Users',
      description: t('features.f2_description') || 'Know you are talking to real collectors. Only verified members so trading and advice stay honest and collector driven.'
    },
    {
      icon: '/img/NextCollect_Language_Icon.svg',
      title: t('features.f3_title') || 'Multi Language',
      description: t('features.f3_description') || 'No language barriers. Talk in your native language with any collector in Europe as messages are translated in real time.'
    }
  ];

  return (
    <section className={styles.featuresSection}>
      <div className={styles.featuresGrid}>
        {features.map((feature, index) => (
          <div key={index} className={styles.featureCard}>
            <img src={feature.icon} alt={feature.title} className={styles.featureIcon} />
            <h3 className={styles.featureTitle}>{feature.title}</h3>
            <p className={styles.featureDescription}>{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CTASection() {
  const { t } = useLanguage();
  const handleScrollToHero = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const emailInput = document.getElementById('early-access-email');
    if (emailInput) {
      setTimeout(() => emailInput.focus(), 350);
    }
  }, []);

  return (
    <section className={styles.ctaSection}>
      <div className={styles.ctaContent}>
        <button className={styles.ctaButton} onClick={handleScrollToHero}>
          {t('cta.join') || 'Join The Waitlist'}
        </button>
        <p className={styles.ctaText}>
          {t('cta.subtext') || 'Become a part of the first wave that joins the community and became a founder member.'}
        </p>
      </div>
    </section>
  );
}
