 'use client';

import { useCallback } from 'react';
import styles from './styles.module.css';

export function AboutSection() {
  return (
    <section className={styles.section}>
      <div className={styles.textColumn}>
        <h2 className={styles.sectionTitle}>Built By Collectors, For Collectors</h2>
        <p className={styles.sectionSubtitle}>
          For European collectors who value community as much as their collections
        </p>
        <p className={styles.sectionText}>
          We are a team of European collectors building a trusted platform for collectors across Europe. Our goal is to bring together professionals and passionate collectors within their niche, local areas and European communities, creating a trusted, fair and transparent market shaped by European expertise and knowledge.
          <br /><br />
          Our mission is to make the collecting community more accessible, reliable and truly built for Europe. Whether you are a local expert, a seasoned collector or a business in a collector niche, Next Collect helps you connect with verified collectors nearby or across Europe, share knowledge you can trust and trade with confidence all in one place.
        </p>
      </div>
      <div className={styles.imageColumn}>
        <img src="/img/right-1.png" alt="Collectors community" />
      </div>
    </section>
  );
}

export function FeaturesSection() {
  const features = [
    {
      icon: '/img/frame.svg',
      title: 'Everything In One Place',
      description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin nibh eros, facilisis quis velit et, efficitur congue eros.'
    },
    {
      icon: '/img/frame.svg',
      title: 'Verified Users',
      description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin nibh eros, facilisis quis velit et.'
    },
    {
      icon: '/img/frame.svg',
      title: 'Multi Language',
      description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin nibh eros, facilisis quis velit et, efficitur congue eros.'
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
          Join The Waitlist
        </button>
        <p className={styles.ctaText}>
          Become a part of the first wave that joins the community and became a founder member.
        </p>
      </div>
    </section>
  );
}
